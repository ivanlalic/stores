import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Target, DollarSign, Activity } from "lucide-react";
import type { BreakevenMetrics } from "@/lib/queries/dashboard";

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
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Break-even diario en envíos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">B/E Diario</CardTitle>
          <Target className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight">
            {isFinite(m.breakeven_enviados_diario)
              ? `${Math.ceil(m.breakeven_enviados_diario)} env/día`
              : "—"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ads prom: {formatEur(m.ads_promedio_diario)}/día
          </p>
          <p className="text-xs text-muted-foreground">
            Margen/env: {formatEur(m.margen_variable)} · Rechazo: {(m.tasa_rechazo * 100).toFixed(1)}% ({m.dias_resueltos}d resueltos)
          </p>
        </CardContent>
      </Card>

      {/* Break-even diario en facturación */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">B/E Facturación</CardTitle>
          <DollarSign className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight">
            {isFinite(m.breakeven_facturacion_diario)
              ? `${formatEur(m.breakeven_facturacion_diario)}/día`
              : "—"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ticket prom: {formatEur(m.ticket_promedio)}
          </p>
          <p className="text-xs text-muted-foreground">
            Bruto/env: {formatEur(m.bruto_por_enviado)}
          </p>
        </CardContent>
      </Card>

      {/* Estado actual con semáforo */}
      <Card className={semaforo.bgColor}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estado Diario</CardTitle>
          <Activity className={`size-4 ${semaforo.color}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold tracking-tight ${semaforo.color}`}>
            {m.enviados_promedio_diario.toFixed(0)} / {isFinite(m.breakeven_enviados_diario) ? Math.ceil(m.breakeven_enviados_diario) : "—"}
          </div>
          <p className={`text-xs font-medium mt-1 ${semaforo.color}`}>
            {semaforo.label}
          </p>
          <p className="text-xs text-muted-foreground">
            P&L diario est: <span className={plDiarioEstimado >= 0 ? "text-emerald-600" : "text-red-600"}>
              {formatEur(plDiarioEstimado)}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
