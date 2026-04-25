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
import { TrendingUp, TrendingDown, Info, ArrowDown, ArrowUp } from "lucide-react";
import type { DailyRow } from "@/lib/queries/dashboard";

const COSTO_RECHAZO = 13.76;

interface KpiCardsProps {
  rows: DailyRow[];
}

function formatEur(n: number) {
  return `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Info className="size-3.5 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function KpiCards({ rows }: KpiCardsProps) {
  const totalPedidos = rows.reduce((s, r) => s + r.pedidos, 0);
  const totalEntregados = rows.reduce((s, r) => s + r.entregados, 0);
  const totalEnviados = rows.reduce((s, r) => s + r.enviados, 0);
  const totalVentas = rows.reduce((s, r) => s + r.ventas, 0);
  const totalPnlTeo = rows.reduce((s, r) => s + r.pnl_teorico, 0);
  const totalPnlReal = rows.reduce((s, r) => s + r.pnl_real, 0);
  const totalPendientes = rows.reduce((s, r) => s + r.pendientes, 0);
  const tasaEntrega = totalEnviados > 0 ? totalEntregados / totalEnviados : 0;

  const pnlPeor = totalPnlReal - totalPendientes * COSTO_RECHAZO;
  const pnlResuelto = totalPnlReal;
  const pnlMejor = totalPnlTeo;

  const marginResuelto = totalVentas > 0 ? ((pnlResuelto / totalVentas) * 100).toFixed(1) : "0";

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {/* Ventas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
            Ventas
            <InfoTip text="Importe total de pedidos enviados al cliente. Incluye pedidos en tránsito, entregados y rechazados." />
          </CardTitle>
          <TrendingUp className="size-4 text-emerald-500" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold tracking-tight">{formatEur(totalVentas)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-emerald-600">{totalPedidos} pedidos</span>
          </p>
          <p className="text-xs text-muted-foreground hidden sm:block">{totalEnviados} enviados</p>
        </CardContent>
      </Card>

      {/* P&L del Mes — card ancho */}
      <Card className="col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
            P&L del Mes
            <InfoTip text="Tres escenarios según el resultado de los pedidos en tránsito. Resuelto: solo pedidos ya cerrados. Peor caso: si todos los pendientes se rechazan (−€13.76 c/u). Mejor caso: si todos los pendientes se entregan." />
          </CardTitle>
          <div className={pnlResuelto >= 0 ? "text-emerald-500" : "text-red-500"}>
            {pnlResuelto >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {/* Número principal */}
          <div className="text-lg sm:text-2xl font-bold tracking-tight">
            {formatEur(pnlResuelto)}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Resuelto · {pnlResuelto >= 0 ? "+" : ""}{marginResuelto}% margen
            {totalPendientes > 0 && (
              <span className="ml-1 text-amber-600">· {totalPendientes} en tránsito</span>
            )}
          </p>

          {/* Rango peor / mejor caso */}
          {totalPendientes > 0 && (
            <div className="mt-2 flex flex-col sm:flex-row gap-1 sm:gap-4">
              <span className="flex items-center gap-1 text-xs text-red-500">
                <ArrowDown className="size-3" />
                {formatEur(pnlPeor)}
                <span className="text-muted-foreground">peor caso</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <ArrowUp className="size-3" />
                {formatEur(pnlMejor)}
                <span className="text-muted-foreground">mejor caso</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasa Entrega */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
            Tasa Entrega
            <InfoTip text="Porcentaje de pedidos enviados que fueron entregados y cobrados. Fórmula: Entregados ÷ Enviados. Buen ratio: >60%." />
          </CardTitle>
          <div className={tasaEntrega >= 0.6 ? "text-emerald-500" : "text-red-500"}>
            {tasaEntrega >= 0.6 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold tracking-tight">
            {(tasaEntrega * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <span className={tasaEntrega >= 0.6 ? "text-emerald-600" : "text-red-600"}>
              {totalEntregados} de {totalEnviados}
            </span>
          </p>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {tasaEntrega >= 0.6 ? "Buen ratio" : "Necesita atención"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function KpiCardsSecondary({ rows }: KpiCardsProps) {
  const totalAds = rows.reduce((s, r) => s + r.total_ads, 0);
  const totalGastos = rows.reduce((s, r) => s + r.gastos, 0);
  const totalEnviados = rows.reduce((s, r) => s + r.enviados, 0);
  const totalEntregados = rows.reduce((s, r) => s + r.entregados, 0);
  const cpaEnviado = totalEnviados > 0 ? totalAds / totalEnviados : 0;
  const cpaReal = totalEntregados > 0 ? totalAds / totalEntregados : 0;

  const items = [
    {
      label: "Total Ads",
      tooltip: "Gasto total en publicidad del período (Meta Ads + TikTok Ads).",
      value: formatEur(totalAds),
    },
    {
      label: "Total Gastos",
      tooltip: "Gastos totales: Ads + fee de gestión por cada pedido enviado.",
      value: formatEur(totalGastos),
    },
    {
      label: "CPA Enviado",
      tooltip: "Costo por pedido enviado. Fórmula: Ads ÷ Enviados. Mide eficiencia de publicidad antes de saber si el pedido se entrega.",
      value: formatEur(cpaEnviado),
    },
    {
      label: "CPA Real",
      tooltip: "Costo por pedido entregado y cobrado. Fórmula: Ads ÷ Entregados. El costo real de conseguir un cliente pagador.",
      value: formatEur(cpaReal),
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
              {item.label}
              <InfoTip text={item.tooltip} />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold tracking-tight">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
