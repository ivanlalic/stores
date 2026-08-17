"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FlaskConical, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SyncV3ButtonProps {
  onComplete?: () => void;
  className?: string;
  storeId?: string;
}

type ToastState =
  | { status: "idle" }
  | { status: "syncing"; message: string }
  | { status: "done"; added: number; updated: number; skipped: number }
  | { status: "error"; message: string };

export function SyncV3Button({ onComplete, className, storeId }: SyncV3ButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<ToastState>({ status: "idle" });

  useEffect(() => {
    if (toast.status === "done") {
      const t = setTimeout(() => setToast({ status: "idle" }), 5000);
      return () => clearTimeout(t);
    }
  }, [toast.status]);

  async function handleSync() {
    setSyncing(true);
    setToast({ status: "syncing", message: "Conectando..." });

    try {
      const storeParam = storeId ? `?store_id=${storeId}` : "";
      const url = `/api/dropea/v3/sync${storeParam}`;
      const response = await fetch(url, { method: "POST" });

      if (!response.body) {
        setToast({ status: "error", message: "No se pudo conectar" });
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
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.message) {
              if (data.message.startsWith("Error")) {
                setToast({ status: "error", message: data.message });
              } else {
                setToast({ status: "syncing", message: data.message });
              }
            }
            if (data.done) {
              setToast({
                status: "done",
                added: data.added ?? 0,
                updated: data.updated ?? 0,
                skipped: data.skipped ?? 0,
              });
              onComplete?.();
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      setToast({
        status: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <div className={className}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button
                onClick={handleSync}
                disabled={syncing}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <FlaskConical className={`size-3.5 ${syncing ? "animate-pulse" : ""}`} />
                <span className="hidden sm:inline">
                  {syncing ? "Sync v3..." : "Sync v3 (sombra)"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px] text-center leading-snug">
              Modo sombra: sincroniza a pedidos_v3/order_events (paralelo, sin tocar el
              pipeline actual). Escribe solo en tablas v3.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {toast.status !== "idle" && (
        <div className="fixed bottom-4 right-4 z-50 flex items-start gap-2 rounded-lg border bg-card shadow-lg px-3 py-2.5 text-xs max-w-[300px] animate-in slide-in-from-bottom-2 fade-in duration-200">
          {toast.status === "syncing" && (
            <>
              <FlaskConical className="size-3.5 text-primary animate-pulse mt-0.5 shrink-0" />
              <span className="text-muted-foreground truncate">{toast.message}</span>
            </>
          )}
          {toast.status === "done" && (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <span className="text-foreground">
                {toast.added} nuevos · {toast.updated} actualizados · {toast.skipped} ignorados
              </span>
              <button onClick={() => setToast({ status: "idle" })} className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
                <X className="size-3" />
              </button>
            </>
          )}
          {toast.status === "error" && (
            <>
              <AlertCircle className="size-3.5 text-destructive mt-0.5 shrink-0" />
              <span className="text-destructive truncate">{toast.message}</span>
              <button onClick={() => setToast({ status: "idle" })} className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
                <X className="size-3" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
