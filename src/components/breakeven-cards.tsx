"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import type { BreakevenMetrics } from "@/lib/queries/dashboard";

interface Props { metrics: BreakevenMetrics | null; diasRolling?: number; }

function formatEur(n: number) {
  return `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getSemaforo(envDiario: number, beDiario: number) {
  if (!isFinite(beDiario) || beDiario <= 0)
    return { label: "Sin datos", color: "text-muted-foreground", bgColor: "bg-muted" };
  const ratio = envDiario / beDiario;
  if (ratio >= 1.5) return { label: "Excelente", color: "text-emerald-700", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" };
  if (ratio >= 1.2) return { label: "Buen ritmo", color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" };
  if (ratio >= 1.0) return { label: "Cubre costos", color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/30" };
  if (ratio >= 0.8) return { label: "Por debajo", color: "text-red-500", bgColor: "bg-red-50 dark:bg-red-950/30" };
  return { label: "Pérdida", color: "text-red-700", bgColor: "bg-red-50 dark:bg-red-950/30" };
}

export function EquilibrioCard({ metrics, diasRolling = 30 }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!metrics) return null;
  const m = metrics;
  const semaforo = getSemaforo(m.enviados_promedio_diario, m.breakeven_enviados_diario);
  const plDiarioEstimado = (m.enviados_promedio_diario * m.margen_variable) - m.ads_promedio_diario;

  return (
    <Card
      className={`cursor-pointer select-none transition-shadow hover:shadow-md ${semaforo.bgColor}`}
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          Ritmo · B/E
          <InfoTip text="Enviados promedio/día vs mínimo para cubrir ads. P&L est = ganancia diaria al ritmo actual. Toca para ver el cálculo." />
        </CardTitle>
        <div className="flex items-center gap-1">
          <Activity className={`size-3.5 ${semaforo.color}`} />
          {expanded ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className={`text-base sm:text-lg font-bold tracking-tight ${semaforo.color}`}>
          {m.enviados_promedio_diario.toFixed(0)} / {isFinite(m.breakeven_enviados_diario) ? Math.ceil(m.breakeven_enviados_diario) : "—"}
        </div>
        <p className={`text-xs font-medium mt-0.5 ${semaforo.color}`}>{semaforo.label}</p>
        <p className="text-xs text-muted-foreground">
          B/E: {isFinite(m.breakeven_facturacion_diario) ? `${formatEur(m.breakeven_facturacion_diario)}/día` : "—"}
        </p>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">P&L est/día</span>
              <span className={`font-medium ${plDiarioEstimado >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatEur(plDiarioEstimado)}/día</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">En envíos</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Ads promedio/día</span>
                  <span className="font-medium text-foreground">{formatEur(m.ads_promedio_diario)}</span>
                </div>
                <div className="flex justify-between">
                  <span>÷ Margen por envío</span>
                  <span className="font-medium text-foreground">{formatEur(m.margen_variable)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span>= Envíos mínimos</span>
                  <span className="font-medium text-foreground">{m.breakeven_enviados_diario.toFixed(1)} env/día</span>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">En facturación</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>B/E envíos × ticket</span>
                  <span className="font-medium text-foreground">{m.breakeven_enviados_diario.toFixed(1)} × {formatEur(m.ticket_promedio)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span>= Facturación mínima</span>
                  <span className="font-medium text-foreground">{formatEur(m.breakeven_facturacion_diario)}/día</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-2">
              Margen/env calculado sobre <strong>{m.dias_resueltos} días resueltos</strong> (últimos {diasRolling}d). Tasa de rechazo <strong>{(m.tasa_rechazo * 100).toFixed(1)}%</strong> ya incluida en el margen.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


