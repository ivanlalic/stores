import { Card, CardContent } from "@/components/ui/card";
import {
  ShoppingCart,
  DollarSign,
  Truck,
  TrendingUp,
  TrendingDown,
  Target,
  Crosshair,
} from "lucide-react";
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
  const tasaEntrega = totalEnviados > 0 ? totalEntregados / totalEnviados : 0;
  const cpaEnviado = totalEnviados > 0 ? totalAds / totalEnviados : 0;
  const cpaReal = totalEntregados > 0 ? totalAds / totalEntregados : 0;

  const kpis = [
    {
      label: "Pedidos",
      value: totalPedidos.toLocaleString("es-ES"),
      icon: ShoppingCart,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Ventas",
      value: `€${totalVentas.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Tasa entrega",
      value: `${(tasaEntrega * 100).toFixed(1)}%`,
      icon: Truck,
      color: tasaEntrega > 0 && tasaEntrega < 0.6 ? "text-amber-600 bg-amber-50" : "text-sky-600 bg-sky-50",
      alert: tasaEntrega > 0 && tasaEntrega < 0.6,
    },
    {
      label: "P&L Teórico",
      value: `€${totalPnlTeo.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      icon: totalPnlTeo >= 0 ? TrendingUp : TrendingDown,
      color: totalPnlTeo >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50",
      negative: totalPnlTeo < 0,
    },
    {
      label: "P&L Real",
      value: `€${totalPnlReal.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      icon: totalPnlReal >= 0 ? TrendingUp : TrendingDown,
      color: totalPnlReal >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50",
      negative: totalPnlReal < 0,
    },
    {
      label: "CPA Enviado",
      value: `€${cpaEnviado.toFixed(2)}`,
      icon: Target,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "CPA Real",
      value: `€${cpaReal.toFixed(2)}`,
      icon: Crosshair,
      color: "text-violet-600 bg-violet-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          className="p-0 hover:shadow-md transition-shadow border-border/60"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </p>
              <div className={`flex items-center justify-center size-7 rounded-md ${kpi.color}`}>
                <kpi.icon className="size-3.5" />
              </div>
            </div>
            <p
              className={`text-xl font-bold tracking-tight ${
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
