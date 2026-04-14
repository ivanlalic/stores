import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { DailyRow } from "@/lib/queries/dashboard";

interface KpiCardsProps {
  rows: DailyRow[];
}

function formatEur(n: number) {
  return `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function KpiCards({ rows }: KpiCardsProps) {
  const totalPedidos = rows.reduce((s, r) => s + r.pedidos, 0);
  const totalEntregados = rows.reduce((s, r) => s + r.entregados, 0);
  const totalEnviados = rows.reduce((s, r) => s + r.enviados, 0);
  const totalVentas = rows.reduce((s, r) => s + r.ventas, 0);
  const totalPnlTeo = rows.reduce((s, r) => s + r.pnl_teorico, 0);
  const totalPnlReal = rows.reduce((s, r) => s + r.pnl_real, 0);
  const totalAds = rows.reduce((s, r) => s + r.total_ads, 0);
  const tasaEntrega = totalEnviados > 0 ? totalEntregados / totalEnviados : 0;

  const marginPnlTeo = totalVentas > 0 ? ((totalPnlTeo / totalVentas) * 100).toFixed(1) : "0";
  const marginPnlReal = totalVentas > 0 ? ((totalPnlReal / totalVentas) * 100).toFixed(1) : "0";

  const kpis = [
    {
      label: "Ventas",
      value: formatEur(totalVentas),
      isPositive: true,
      change: `${totalPedidos} pedidos`,
      description: `${totalEnviados} enviados`,
    },
    {
      label: "P&L Teórico",
      value: formatEur(totalPnlTeo),
      isPositive: totalPnlTeo >= 0,
      change: `${totalPnlTeo >= 0 ? "+" : ""}${marginPnlTeo}%`,
      description: "Margen sobre ventas",
    },
    {
      label: "P&L Real",
      value: formatEur(totalPnlReal),
      isPositive: totalPnlReal >= 0,
      change: `${totalPnlReal >= 0 ? "+" : ""}${marginPnlReal}%`,
      description: "Margen sobre ventas",
    },
    {
      label: "Tasa Entrega",
      value: `${(tasaEntrega * 100).toFixed(1)}%`,
      isPositive: tasaEntrega >= 0.6,
      change: `${totalEntregados} de ${totalEnviados}`,
      description: tasaEntrega >= 0.6 ? "Buen ratio" : "Necesita atención",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">
              {kpi.label}
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
    { label: "Total Ads", value: formatEur(totalAds) },
    { label: "Total Gastos", value: formatEur(totalGastos) },
    { label: "CPA Enviado", value: formatEur(cpaEnviado) },
    { label: "CPA Real", value: formatEur(cpaReal) },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">
              {item.label}
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
