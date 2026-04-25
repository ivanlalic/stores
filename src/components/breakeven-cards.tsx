"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Target, DollarSign, Activity, Info, ChevronDown, ChevronUp } from "lucide-react";
import type { BreakevenMetrics } from "@/lib/queries/dashboard";

interface Props { metrics: BreakevenMetrics | null; }

function formatEur(n: number) {
  return `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Info className="size-3 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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

export function BEDiarioCard({ metrics }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!metrics) return null;
  const m = metrics;

  return (
    <Card
      className="cursor-pointer select-none transition-shadow hover:shadow-md"
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          B/E Diario
          <InfoTip text="Envíos mínimos por día para cubrir el gasto en ads. Toca para ver el cálculo." />
        </CardTitle>
        <div className="flex items-center gap-1">
          <Target className="size-3.5 text-muted-foreground" />
          {expanded ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="text-base sm:text-lg font-bold tracking-tight">
          {isFinite(m.breakeven_enviados_diario) ? `${Math.ceil(m.breakeven_enviados_diario)} env/día` : "—"}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Ads: {formatEur(m.ads_promedio_diario)}/día</p>
        <p className="text-xs text-muted-foreground">
          Mrg: {formatEur(m.margen_variable)} · Rch: {(m.tasa_rechazo * 100).toFixed(1)}%
        </p>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold text-foreground">Cómo se calcula</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Ads promedio/día</span>
                <span className="font-medium text-foreground">{formatEur(m.ads_promedio_diario)}</span>
              </div>
              <div className="flex justify-between">
                <span>÷ Margen por envío</span>
                <span className="font-medium text-foreground">{formatEur(m.margen_variable)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span>= B/E exacto</span>
                <span className="font-medium text-foreground">{m.breakeven_enviados_diario.toFixed(1)} env/día</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Margen/env = beneficio promedio de pedidos enviados (entregados y rechazados con −€13.76), calculado sobre <strong>{m.dias_resueltos} días resueltos</strong> de los últimos 60 días.
            </p>
            <p className="text-xs text-muted-foreground">
              Tasa de rechazo actual: <strong>{(m.tasa_rechazo * 100).toFixed(1)}%</strong> — ya descontada del margen.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BEFacturacionCard({ metrics }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!metrics) return null;
  const m = metrics;

  return (
    <Card
      className="cursor-pointer select-none transition-shadow hover:shadow-md"
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          B/E Facturación
          <InfoTip text="Facturación diaria mínima para cubrir costos. Toca para ver el cálculo." />
        </CardTitle>
        <div className="flex items-center gap-1">
          <DollarSign className="size-3.5 text-muted-foreground" />
          {expanded ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="text-base sm:text-lg font-bold tracking-tight">
          {isFinite(m.breakeven_facturacion_diario) ? `${formatEur(m.breakeven_facturacion_diario)}/día` : "—"}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Ticket: {formatEur(m.ticket_promedio)}</p>
        <p className="text-xs text-muted-foreground">Bruto/env: {formatEur(m.bruto_por_enviado)}</p>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold text-foreground">Cómo se calcula</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>B/E envíos/día</span>
                <span className="font-medium text-foreground">{m.breakeven_enviados_diario.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span>× Ticket promedio</span>
                <span className="font-medium text-foreground">{formatEur(m.ticket_promedio)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span>= Facturación mínima</span>
                <span className="font-medium text-foreground">{formatEur(m.breakeven_facturacion_diario)}/día</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Ticket promedio = ventas ÷ enviados, calculado sobre días resueltos. Bruto/env (<strong>{formatEur(m.bruto_por_enviado)}</strong>) es el beneficio de Dropea por pedido enviado antes de ads.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EstadoDiarioCard({ metrics }: Props) {
  if (!metrics) return null;
  const m = metrics;
  const semaforo = getSemaforo(m.enviados_promedio_diario, m.breakeven_enviados_diario);
  const plDiarioEstimado = (m.enviados_promedio_diario * m.margen_variable) - m.ads_promedio_diario;

  return (
    <Card className={semaforo.bgColor}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          Estado Diario
          <InfoTip text="Enviados promedio/día del mes vs B/E diario. P&L est = ganancia diaria estimada al ritmo actual." />
        </CardTitle>
        <Activity className={`size-3.5 ${semaforo.color}`} />
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className={`text-base sm:text-lg font-bold tracking-tight ${semaforo.color}`}>
          {m.enviados_promedio_diario.toFixed(0)} / {isFinite(m.breakeven_enviados_diario) ? Math.ceil(m.breakeven_enviados_diario) : "—"}
        </div>
        <p className={`text-xs font-medium mt-0.5 ${semaforo.color}`}>{semaforo.label}</p>
        <p className="text-xs text-muted-foreground">
          P&L est:{" "}
          <span className={plDiarioEstimado >= 0 ? "text-emerald-600" : "text-red-600"}>
            {formatEur(plDiarioEstimado)}/día
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

// Legacy wrapper
export function BreakevenCards({ metrics }: Props) {
  if (!metrics) return null;
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
      <BEDiarioCard metrics={metrics} />
      <BEFacturacionCard metrics={metrics} />
      <EstadoDiarioCard metrics={metrics} />
    </div>
  );
}
