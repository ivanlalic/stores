"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

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

        // Auto-scroll log
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

  return (
    <div className={className}>
      <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
        {syncing ? "Sincronizando..." : "Sincronizar"}
      </Button>

      {showLog && messages.length > 0 && (
        <div
          ref={logRef}
          className="mt-2 max-h-48 overflow-y-auto rounded-md border bg-muted p-3 text-xs font-mono"
        >
          {messages.map((msg, i) => (
            <div key={i} className={msg.startsWith("Error") ? "text-destructive" : ""}>
              {msg}
            </div>
          ))}
          {!syncing && (
            <button
              onClick={() => setShowLog(false)}
              className="mt-2 text-muted-foreground hover:underline"
            >
              Cerrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
