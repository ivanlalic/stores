"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SyncButtonProps {
  onComplete?: () => void;
  className?: string;
  showQuickSync?: boolean;
}

type ToastState =
  | { status: "idle" }
  | { status: "syncing"; message: string }
  | { status: "done"; added: number; updated: number }
  | { status: "error"; message: string };

export function SyncButton({ onComplete, className, showQuickSync = true }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncMode, setSyncMode] = useState<"48h" | "full" | null>(null);
  const [toast, setToast] = useState<ToastState>({ status: "idle" });

  useEffect(() => {
    if (toast.status === "done") {
      const t = setTimeout(() => setToast({ status: "idle" }), 4000);
      return () => clearTimeout(t);
    }
  }, [toast.status]);

  async function handleSync(mode: "48h" | "full") {
    setSyncing(true);
    setSyncMode(mode);
    setToast({ status: "syncing", message: "Conectando..." });

    try {
      const url = mode === "48h" ? "/api/sync?mode=48h" : "/api/sync";
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
              setToast({ status: "done", added: data.added ?? 0, updated: data.updated ?? 0 });
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
      setSyncMode(null);
    }
  }

  return (
    <>
      <div className={className}>
        <div className="flex items-center gap-1.5">
          {showQuickSync && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    onClick={() => handleSync("48h")}
                    disabled={syncing}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    <Zap className={`size-3.5 ${syncing && syncMode === "48h" ? "animate-pulse" : ""}`} />
                    <span className="hidden sm:inline">{syncing && syncMode === "48h" ? "Actualizando..." : "Actualizar"}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px] text-center leading-snug">
                  Trae pedidos actualizados en los últimos 15 días. Captura nuevos estados: rechazos, entregas, incidencias.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  onClick={() => handleSync("full")}
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <RefreshCw className={`size-3.5 ${syncing && syncMode === "full" ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{syncing && syncMode === "full" ? "Cargando..." : "Carga completa"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-center leading-snug">
                Descarga todos los pedidos de los últimos 2 meses por fecha de creación. Usar para sincronización inicial o recuperar datos históricos.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Toast overlay — fixed bottom-right, non-intrusive */}
      {toast.status !== "idle" && (
        <div className="fixed bottom-4 right-4 z-50 flex items-start gap-2 rounded-lg border bg-card shadow-lg px-3 py-2.5 text-xs max-w-[300px] animate-in slide-in-from-bottom-2 fade-in duration-200">
          {toast.status === "syncing" && (
            <>
              <RefreshCw className="size-3.5 text-primary animate-spin mt-0.5 shrink-0" />
              <span className="text-muted-foreground truncate">{toast.message}</span>
            </>
          )}
          {toast.status === "done" && (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <span className="text-foreground">
                {toast.added} nuevos · {toast.updated} actualizados
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
