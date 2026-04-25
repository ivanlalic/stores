"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Target, DollarSign, Activity, Info } from "lucide-react";
import type { BreakevenMetrics } from "@/lib/queries/dashboard";

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="size-3.5 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface BreakevenCardsProps {
  metrics: BreakevenMetrics | null;
}

function formatEur(n: number) {
  return `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getSemaforo(envDiario: number, beDiario: number) {
  if (!isFinite(beDiario) || beDiario <= 0) {
    return { label: "Sin datos", color: "text-muted-foreground", bgColor: "bg-muted" };
  }
  const ratio = envDiario / beDiario;
  if (ratio >= 1.5) return { label: "Excelente", color: "text-emerald-700", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" };
  if (ratio >= 1.2) return { label: "Buen ritmo", color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" };
  if (ratio >= 1.0) return { label: "Cubre costos", color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/30" };
  if (ratio >= 0.8) return { label: "Por debajo", color: "text-red-500", bgColor: "bg-red-50 dark:bg-red-950/30" };
  return { label: "Pérdida", color: "text-red-700", bgColor: "bg-red-50 dark:bg-red-950/30" };
}

export function BreakevenCards({ metrics }: BreakevenCardsProps) {
  if (!metrics) return null;

  const m = metrics;
  const semaforo = getSemaforo(m.enviados_promedio_diario, m.breakeven_enviados_diario);
  const plDiarioEstimado = (m.enviados_promedio_diario * m.margen_variable) - m.ads_promedio_diario;

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
      {/* Break-even diario en envíos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
              B/E Diario
              <InfoTip text="Envíos mínimos por día para cubrir el gasto en ads. Fórmula: Ads promedio diario ÷ Margen por envío. Calculado con días resueltos de los últimos 60 días." />
            </CardTitle>
          <Target className="size-4 text-muted-foreground hidden sm:block" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold tracking-tight">
            {isFinite(m.breakeven_enviados_diario)
              ? `${Math.ceil(m.breakeven_enviados_diario)} env/día`
              : "—"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ads: {formatEur(m.ads_promedio_diario)}/día
          </p>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Margen/env: {formatEur(m.margen_variable)} · Rechazo: {(m.tasa_rechazo * 100).toFixed(1)}% ({m.dias_resueltos}d resueltos)
          </p>
          <p className="text-xs text-muted-foreground sm:hidden">
            Mrg: {formatEur(m.margen_variable)} · Rch: {(m.tasa_rechazo * 100).toFixed(0)}%
          </p>
        </CardContent>
      </Card>

      {/* Break-even diario en facturación */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
              B/E Facturación
              <InfoTip text="Facturación diaria mínima para cubrir costos. Fórmula: B/E envíos × ticket promedio del período." />
            </CardTitle>
          <DollarSign className="size-4 text-muted-foreground hidden sm:block" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold tracking-tight">
            {isFinite(m.breakeven_facturacion_diario)
              ? `${formatEur(m.breakeven_facturacion_diario)}/día`
              : "—"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ticket: {formatEur(m.ticket_promedio)}
          </p>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Bruto/env: {formatEur(m.bruto_por_enviado)}
          </p>
        </CardContent>
      </Card>

      {/* Estado actual con semáforo */}
      <Card className={`col-span-2 sm:col-span-1 ${semaforo.bgColor}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
              Estado Diario
              <InfoTip text="Ritmo actual del mes vs break-even. Izquierda: enviados promedio/día del mes. Derecha: B/E diario. P&L est = ganancia diaria estimada al ritmo actual." />
            </CardTitle>
          <Activity className={`size-4 ${semaforo.color}`} />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className={`text-lg sm:text-2xl font-bold tracking-tight ${semaforo.color}`}>
            {m.enviados_promedio_diario.toFixed(0)} / {isFinite(m.breakeven_enviados_diario) ? Math.ceil(m.breakeven_enviados_diario) : "—"}
          </div>
          <p className={`text-xs font-medium mt-1 ${semaforo.color}`}>
            {semaforo.label}
          </p>
          <p className="text-xs text-muted-foreground">
            P&L est: <span className={plDiarioEstimado >= 0 ? "text-emerald-600" : "text-red-600"}>
              {formatEur(plDiarioEstimado)}/día
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
