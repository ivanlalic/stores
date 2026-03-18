import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { DailyRow } from "@/lib/queries/dashboard";

interface KpiCardsProps {
  rows: DailyRow[];
}

export function KpiCards({ rows }: KpiCardsProps) {
  const totalPedidos = rows.reduce((s, r) => s + r.pedidos, 0);
  const totalEntregados = rows.reduce((s, r) => s + r.entregados, 0);
  const totalEnviados = rows.reduce((s, r) => s + r.enviados, 0);
  const totalVentas = rows.reduce((s, r) => s + r.ventas, 0);
  const totalPnlTeo = rows.reduce((s, r) => s + r.pnl_teorico, 0);
  const totalPnlReal = rows.reduce((s, r) => s + r.pnl_real, 0);
  const totalAds = rows.reduce((s, r) => s + r.total_ads, 0);
  const totalGastos = rows.reduce((s, r) => s + r.gastos, 0);
  const tasaEntrega = totalEnviados > 0 ? totalEntregados / totalEnviados : 0;
  const cpaEnviado = totalEnviados > 0 ? totalAds / totalEnviados : 0;

  const kpis = [
    {
      label: "Ventas",
      value: `€${totalVentas.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      trend: totalPnlReal >= 0 ? "up" : "down",
      detail: `${totalPedidos} pedidos`,
      subtext: `${totalEnviados} enviados`,
    },
    {
      label: "P&L Teórico",
      value: `€${totalPnlTeo.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      trend: totalPnlTeo >= 0 ? "up" : "down",
      detail: totalPnlTeo >= 0 ? "Positivo" : "Negativo",
      subtext: totalVentas > 0 ? `${((totalPnlTeo / totalVentas) * 100).toFixed(1)}% margen` : "",
    },
    {
      label: "P&L Real",
      value: `€${totalPnlReal.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      trend: totalPnlReal >= 0 ? "up" : "down",
      detail: totalPnlReal >= 0 ? "Positivo" : "Negativo",
      subtext: totalVentas > 0 ? `${((totalPnlReal / totalVentas) * 100).toFixed(1)}% margen` : "",
    },
    {
      label: "Tasa Entrega",
      value: `${(tasaEntrega * 100).toFixed(1)}%`,
      trend: tasaEntrega >= 0.6 ? "up" : "down",
      detail: `${totalEntregados} de ${totalEnviados}`,
      subtext: tasaEntrega >= 0.6 ? "Buen ratio" : "Necesita atención",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpi.label}
            </CardTitle>
            {kpi.trend === "up" ? (
              <TrendingUp className="size-4 text-emerald-500" />
            ) : (
              <TrendingDown className="size-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpi.detail}
            </p>
            <p className="text-xs text-muted-foreground">
              {kpi.subtext}
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
    { label: "Total Ads", value: `€${totalAds.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
    { label: "Total Gastos", value: `€${totalGastos.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
    { label: "CPA Enviado", value: `€${cpaEnviado.toFixed(2)}` },
    { label: "CPA Real", value: `€${cpaReal.toFixed(2)}` },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
