"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, CheckCircle2, AlertCircle } from "lucide-react";

interface SyncButtonProps {
  onComplete?: () => void;
  className?: string;
}

export function SyncButton({ onComplete, className }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  async function handleSync() {
    setSyncing(true);
    setMessages([]);
    setShowLog(true);

    try {
      const response = await fetch("/api/sync", { method: "POST" });

      if (!response.body) {
        setMessages((m) => [...m, "Error: No se pudo conectar"]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) {
                setMessages((m) => [...m, data.message]);
              }
              if (data.done) {
                onComplete?.();
              }
            } catch {
              // skip malformed JSON
            }
          }
        }

        if (logRef.current) {
          logRef.current.scrollTop = logRef.current.scrollHeight;
        }
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        `Error: ${err instanceof Error ? err.message : "Error desconocido"}`,
      ]);
    } finally {
      setSyncing(false);
    }
  }

  const hasErrors = messages.some((m) => m.startsWith("Error"));
  const isDone = !syncing && messages.length > 0;

  return (
    <div className={className}>
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant="outline"
        size="sm"
        className="gap-1.5"
      >
        <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando..." : "Sincronizar"}
      </Button>

      {showLog && messages.length > 0 && (
        <div className="mt-3 rounded-lg border bg-card shadow-sm overflow-hidden">
          {/* Log header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {syncing ? (
                <RefreshCw className="size-3 animate-spin text-primary" />
              ) : hasErrors ? (
                <AlertCircle className="size-3 text-destructive" />
              ) : (
                <CheckCircle2 className="size-3 text-emerald-600" />
              )}
              <span>{syncing ? "Sincronizando..." : hasErrors ? "Completado con errores" : "Sincronización completa"}</span>
            </div>
            {!syncing && (
              <button
                onClick={() => setShowLog(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {/* Log body */}
          <div
            ref={logRef}
            className="max-h-40 overflow-y-auto px-3 py-2 text-xs font-mono space-y-0.5"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={msg.startsWith("Error") ? "text-destructive" : "text-muted-foreground"}
              >
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
