"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Info, ArrowDown, ArrowUp } from "lucide-react";
import type { DailyRow } from "@/lib/queries/dashboard";

interface KpiCardsProps { rows: DailyRow[]; }

function formatEur(n: number) {
  return `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatEurShort(n: number) {
  return `€${Math.round(n).toLocaleString("es-ES")}`;
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

function useTotals(rows: DailyRow[]) {
  return {
    totalPedidos: rows.reduce((s, r) => s + r.pedidos, 0),
    totalEntregados: rows.reduce((s, r) => s + r.entregados, 0),
    totalEnviados: rows.reduce((s, r) => s + r.enviados, 0),
    totalVentas: rows.reduce((s, r) => s + r.ventas, 0),
    totalPnlTeo: rows.reduce((s, r) => s + r.pnl_teorico, 0),
    totalPnlReal: rows.reduce((s, r) => s + r.pnl_real, 0),
    totalPendientes: rows.reduce((s, r) => s + r.pendientes, 0),
    totalEntregadosRaw: rows.reduce((s, r) => s + r.entregados, 0),
  };
}

export function VentasCard({ rows }: KpiCardsProps) {
  const { totalPedidos, totalEnviados, totalVentas } = useTotals(rows);
  const today = new Date().toISOString().slice(0, 10);
  const todayRow = rows.find((r) => r.fecha === today);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          Ventas
          <InfoTip text="Importe total de pedidos enviados. Incluye en tránsito, entregados y rechazados." />
        </CardTitle>
        <TrendingUp className="size-3.5 text-emerald-500" />
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="text-base sm:text-lg font-bold tracking-tight">{formatEur(totalVentas)}</div>
        <p className="text-xs text-emerald-600 mt-0.5">{totalPedidos} pedidos · {totalEnviados} env.</p>
        {todayRow ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            Hoy: <span className="font-medium text-foreground">{formatEur(todayRow.ventas)}</span>
            <span className="ml-1 opacity-60">({todayRow.enviados} env.)</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">Sin datos hoy</p>
        )}
      </CardContent>
    </Card>
  );
}

export function PnlCard({ rows, costoRechazo = 13.76 }: KpiCardsProps & { costoRechazo?: number }) {
  const { totalVentas, totalPnlTeo, totalPnlReal, totalPendientes } = useTotals(rows);
  const pnlPeor = totalPnlReal - totalPendientes * costoRechazo;
  const isPos = totalPnlReal >= 0;
  const margin = totalVentas > 0 ? ((totalPnlReal / totalVentas) * 100).toFixed(1) : "0";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          P&L del Mes
          <InfoTip text={`Resuelto: pedidos cerrados. Peor caso: si todos los pendientes se rechazan (−€${costoRechazo.toFixed(2)} c/u). Mejor caso: si todos los pendientes se entregan.`} />
        </CardTitle>
        <div className={isPos ? "text-emerald-500" : "text-red-500"}>
          {isPos ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="text-base sm:text-lg font-bold tracking-tight">{formatEur(totalPnlReal)}</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isPos ? "+" : ""}{margin}% margen
          {totalPendientes > 0 && <span className="text-amber-600"> · {totalPendientes} pend.</span>}
        </p>
        {totalPendientes > 0 && (
          <p className="text-xs mt-1 flex items-center gap-1.5">
            <span className="flex items-center gap-0.5 text-red-500">
              <ArrowDown className="size-2.5" />{formatEurShort(pnlPeor)}
            </span>
            <span className="text-muted-foreground">—</span>
            <span className="flex items-center gap-0.5 text-emerald-600">
              <ArrowUp className="size-2.5" />{formatEurShort(totalPnlTeo)}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TasaEntregaCard({ rows }: KpiCardsProps) {
  const { totalEntregados, totalEnviados } = useTotals(rows);
  const tasa = totalEnviados > 0 ? totalEntregados / totalEnviados : 0;
  const isGood = tasa >= 0.6;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          Tasa Entrega
          <InfoTip text="Entregados ÷ Enviados. Porcentaje de pedidos cobrados exitosamente. Buen ratio: >60%." />
        </CardTitle>
        <div className={isGood ? "text-emerald-500" : "text-red-500"}>
          {isGood ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="text-base sm:text-lg font-bold tracking-tight">{(tasa * 100).toFixed(1)}%</div>
        <p className={`text-xs mt-0.5 ${isGood ? "text-emerald-600" : "text-red-500"}`}>
          {totalEntregados} de {totalEnviados}
        </p>
        <p className="text-xs text-muted-foreground">{isGood ? "Buen ratio" : "Necesita atención"}</p>
      </CardContent>
    </Card>
  );
}

// Legacy wrapper kept for monthly view or other pages
export function KpiCards({ rows }: KpiCardsProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
      <VentasCard rows={rows} />
      <PnlCard rows={rows} />
      <TasaEntregaCard rows={rows} />
    </div>
  );
}

export function GastosCard({ rows, className }: KpiCardsProps & { className?: string }) {
  const totalAds = rows.reduce((s, r) => s + r.total_ads, 0);
  const totalGestion = rows.reduce((s, r) => s + r.gestion, 0);
  const totalGastos = rows.reduce((s, r) => s + r.gastos, 0);
  const totalComision = rows.reduce((s, r) => s + r.total_commission, 0);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          Gastos
          <InfoTip text="Ads + fee de gestión por envío. El total es lo que sale del bolsillo antes de contar ingresos." />
        </CardTitle>
        <TrendingDown className="size-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="text-base sm:text-lg font-bold tracking-tight">{formatEur(totalGastos)}</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ads: <span className="font-medium text-foreground">{formatEur(totalAds)}</span>
        </p>
        {totalComision > 0 && (
          <p className="text-xs text-muted-foreground">
            Comisión agencia: <span className="font-medium text-foreground">{formatEur(totalComision)}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Gest: <span className="font-medium text-foreground">{formatEur(totalGestion)}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export function CpaCard({ rows, className }: KpiCardsProps & { className?: string }) {
  const totalAds = rows.reduce((s, r) => s + r.total_ads, 0);
  const totalEnviados = rows.reduce((s, r) => s + r.enviados, 0);
  const totalEntregados = rows.reduce((s, r) => s + r.entregados, 0);
  const cpaEnviado = totalEnviados > 0 ? totalAds / totalEnviados : 0;
  const cpaReal = totalEntregados > 0 ? totalAds / totalEntregados : 0;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          CPA
          <InfoTip text="CPA Enviado: Ads÷Enviados (antes de saber si se entrega). CPA Real: Ads÷Entregados (costo por cliente pagador)." />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="text-base sm:text-lg font-bold tracking-tight">{formatEur(cpaEnviado)}</div>
        <p className="text-xs text-muted-foreground mt-0.5">por enviado</p>
        <p className="text-xs text-muted-foreground">
          Real: <span className="font-medium text-foreground">{formatEur(cpaReal)}</span>
        </p>
      </CardContent>
    </Card>
  );
}

// Keep for backwards compat
export function KpiCardsSecondary({ rows }: KpiCardsProps) {
  return (
    <div className="grid gap-3 grid-cols-2">
      <GastosCard rows={rows} />
      <CpaCard rows={rows} />
    </div>
  );
}
