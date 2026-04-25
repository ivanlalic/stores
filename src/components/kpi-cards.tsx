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
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import type { DailyRow } from "@/lib/queries/dashboard";

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
  const tasaEntrega = totalEnviados > 0 ? totalEntregados / totalEnviados : 0;

  const marginPnlTeo = totalVentas > 0 ? ((totalPnlTeo / totalVentas) * 100).toFixed(1) : "0";
  const marginPnlReal = totalVentas > 0 ? ((totalPnlReal / totalVentas) * 100).toFixed(1) : "0";

  const kpis = [
    {
      label: "Ventas",
      tooltip: "Importe total de pedidos enviados al cliente. Incluye pedidos en tránsito, entregados y rechazados.",
      value: formatEur(totalVentas),
      isPositive: true,
      change: `${totalPedidos} pedidos`,
      description: `${totalEnviados} enviados`,
    },
    {
      label: "P&L Teórico",
      tooltip: "Ganancia si todos los pedidos en tránsito se entregaran. Fórmula: Σ beneficio(enviados) − ads − gestión. Incluye pedidos aún sin resolver.",
      value: formatEur(totalPnlTeo),
      isPositive: totalPnlTeo >= 0,
      change: `${totalPnlTeo >= 0 ? "+" : ""}${marginPnlTeo}%`,
      description: "Margen sobre ventas",
    },
    {
      label: "P&L Real",
      tooltip: "Ganancia real de pedidos ya resueltos. Fórmula: Σ beneficio(entregados) + Σ beneficio(rechazados) − ads − gestión. Los rechazos suman negativo (≈−€13.76). Excluye pedidos en tránsito.",
      value: formatEur(totalPnlReal),
      isPositive: totalPnlReal >= 0,
      change: `${totalPnlReal >= 0 ? "+" : ""}${marginPnlReal}%`,
      description: "Margen sobre ventas",
    },
    {
      label: "Tasa Entrega",
      tooltip: "Porcentaje de pedidos enviados que fueron entregados y cobrados. Fórmula: Entregados ÷ Enviados. Buen ratio: >60%.",
      value: `${(tasaEntrega * 100).toFixed(1)}%`,
      isPositive: tasaEntrega >= 0.6,
      change: `${totalEntregados} de ${totalEnviados}`,
      description: tasaEntrega >= 0.6 ? "Buen ratio" : "Necesita atención",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
              {kpi.label}
              <InfoTip text={kpi.tooltip} />
            </CardTitle>
            <div className={kpi.isPositive ? "text-emerald-500" : "text-red-500"}>
              {kpi.isPositive ? (
                <TrendingUp className="size-4" />
              ) : (
                <TrendingDown className="size-4" />
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold tracking-tight">{kpi.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className={kpi.isPositive ? "text-emerald-600" : "text-red-600"}>
                {kpi.change}
              </span>
            </p>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {kpi.description}
            </p>
          </CardContent>
        </Card>
      ))}
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
