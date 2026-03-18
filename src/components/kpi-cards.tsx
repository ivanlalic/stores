import { Card, CardContent } from "@/components/ui/card";
import type { DailyRow } from "@/lib/queries/dashboard";

interface KpiCardsProps {
  rows: DailyRow[];
}

export function KpiCards({ rows }: KpiCardsProps) {
  const totalPedidos = rows.reduce((s, r) => s + r.pedidos, 0);
  const totalEntregados = rows.reduce((s, r) => s + r.entregados, 0);
  const totalEnviados = rows.reduce((s, r) => s + r.enviados, 0);
  const totalVentas = rows.reduce((s, r) => s + r.ventas, 0);
  const totalPnl = rows.reduce((s, r) => s + r.pnl_real, 0);
  const totalAds = rows.reduce((s, r) => s + r.total_ads, 0);
  const tasaEntrega = totalEnviados > 0 ? totalEntregados / totalEnviados : 0;
  const cpaEnviado = totalEnviados > 0 ? totalAds / totalEnviados : 0;
  const cpaReal = totalEntregados > 0 ? totalAds / totalEntregados : 0;

  const daysWithAds = rows.filter((r) => r.total_ads > 0).length;
  const breakeven =
    daysWithAds > 0
      ? Math.round((totalAds / (daysWithAds || 1)) * 100) / 100
      : 0;

  const kpis = [
    { label: "Pedidos", value: totalPedidos },
    { label: "Ventas", value: `${totalVentas.toFixed(2)} EUR` },
    {
      label: "Tasa entrega",
      value: `${(tasaEntrega * 100).toFixed(1)}%`,
      alert: tasaEntrega > 0 && tasaEntrega < 0.6,
    },
    {
      label: "P&L Real",
      value: `${totalPnl.toFixed(2)} EUR`,
      negative: totalPnl < 0,
    },
    { label: "CPA Enviado", value: `${cpaEnviado.toFixed(2)} EUR` },
    { label: "CPA Real", value: `${cpaReal.toFixed(2)} EUR` },
    { label: "Break-even/dia", value: `${breakeven} EUR` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="p-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p
              className={`text-lg font-semibold ${
                kpi.negative
                  ? "text-red-600"
                  : kpi.alert
                  ? "text-amber-600"
                  : ""
              }`}
            >
              {kpi.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
