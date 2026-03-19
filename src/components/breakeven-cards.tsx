import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Target, DollarSign, Activity } from "lucide-react";
import type { DailyRow } from "@/lib/queries/dashboard";

export interface BreakevenConfig {
  fee_gestion_eur: number;
  costo_rechazo: number;
  dias_rolling: number;
  dias_excluir: number;
}

interface BreakevenCardsProps {
  rows: DailyRow[];
  config: BreakevenConfig;
}

function formatEur(n: number) {
  return `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeBreakeven(rows: DailyRow[], config: BreakevenConfig) {
  // Only use rows with activity
  const activeRows = rows.filter((r) => r.enviados > 0 || r.total_ads > 0);
  if (activeRows.length === 0) return null;

  // Bruto por enviado (all active days)
  const totalBruto = activeRows.reduce((s, r) => s + r.bruto, 0);
  const totalEnviados = activeRows.reduce((s, r) => s + r.enviados, 0);
  if (totalEnviados === 0) return null;

  const brutoPorEnviado = totalBruto / totalEnviados;

  // Tasa de rechazo: exclude last N days for pending orders
  const sortedRows = [...activeRows].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const rowsForRechazo = config.dias_excluir > 0
    ? sortedRows.slice(0, Math.max(1, sortedRows.length - config.dias_excluir))
    : sortedRows;

  const rechazosTotal = rowsForRechazo.reduce((s, r) => s + r.rechazados, 0);
  const enviadosForRechazo = rowsForRechazo.reduce((s, r) => s + r.enviados, 0);
  const tasaRechazo = enviadosForRechazo > 0 ? rechazosTotal / enviadosForRechazo : 0;

  // Margen variable por enviado
  const margenVariable = brutoPorEnviado - config.fee_gestion_eur - (tasaRechazo * config.costo_rechazo);

  if (margenVariable <= 0) return { margenVariable, breakevenEnviados: Infinity, breakevenFacturacion: Infinity, totalEnviados, totalAds: activeRows.reduce((s, r) => s + r.total_ads, 0), ticketPromedio: 0, tasaRechazo, brutoPorEnviado, diasActivos: activeRows.length };

  // Totals for the period
  const totalAds = activeRows.reduce((s, r) => s + r.total_ads, 0);
  const totalVentas = activeRows.reduce((s, r) => s + r.ventas, 0);
  const ticketPromedio = totalVentas / totalEnviados;

  // Break-even for the period
  const breakevenEnviados = totalAds / margenVariable;
  const breakevenFacturacion = breakevenEnviados * ticketPromedio;

  return {
    margenVariable,
    breakevenEnviados,
    breakevenFacturacion,
    totalEnviados,
    totalAds,
    ticketPromedio,
    tasaRechazo,
    brutoPorEnviado,
    diasActivos: activeRows.length,
  };
}

type SemaforoLevel = "excelente" | "bueno" | "ok" | "flojo" | "malo";

function getSemaforo(enviados: number, breakeven: number): { level: SemaforoLevel; label: string; color: string; bgColor: string } {
  if (!isFinite(breakeven) || breakeven <= 0) {
    return { level: "malo", label: "Sin datos", color: "text-muted-foreground", bgColor: "bg-muted" };
  }
  const ratio = enviados / breakeven;
  if (ratio >= 1.5) return { level: "excelente", label: "Excelente", color: "text-emerald-700", bgColor: "bg-emerald-50" };
  if (ratio >= 1.2) return { level: "bueno", label: "Buen mes", color: "text-emerald-600", bgColor: "bg-emerald-50" };
  if (ratio >= 1.0) return { level: "ok", label: "Cubre costos", color: "text-amber-600", bgColor: "bg-amber-50" };
  if (ratio >= 0.8) return { level: "flojo", label: "Por debajo", color: "text-red-500", bgColor: "bg-red-50" };
  return { level: "malo", label: "Pérdida", color: "text-red-700", bgColor: "bg-red-50" };
}

export function BreakevenCards({ rows, config }: BreakevenCardsProps) {
  const data = computeBreakeven(rows, config);

  if (!data) {
    return null;
  }

  const semaforo = getSemaforo(data.totalEnviados, data.breakevenEnviados);
  const plEstimado = (data.totalEnviados * data.margenVariable) - data.totalAds;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Break-even en pedidos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">B/E Enviados</CardTitle>
          <Target className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight">
            {isFinite(data.breakevenEnviados) ? Math.ceil(data.breakevenEnviados) : "—"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            enviados necesarios para cubrir costos
          </p>
          <p className="text-xs text-muted-foreground">
            Margen/env: {formatEur(data.margenVariable)} · Rechazo: {(data.tasaRechazo * 100).toFixed(1)}%
          </p>
        </CardContent>
      </Card>

      {/* Break-even en facturación */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">B/E Facturación</CardTitle>
          <DollarSign className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight">
            {isFinite(data.breakevenFacturacion) ? formatEur(data.breakevenFacturacion) : "—"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            facturación mínima para cubrir costos
          </p>
          <p className="text-xs text-muted-foreground">
            Ticket prom: {formatEur(data.ticketPromedio)} · Bruto/env: {formatEur(data.brutoPorEnviado)}
          </p>
        </CardContent>
      </Card>

      {/* Estado actual con semáforo */}
      <Card className={semaforo.bgColor}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estado</CardTitle>
          <Activity className={`size-4 ${semaforo.color}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold tracking-tight ${semaforo.color}`}>
            {data.totalEnviados} / {isFinite(data.breakevenEnviados) ? Math.ceil(data.breakevenEnviados) : "—"}
          </div>
          <p className={`text-xs font-medium mt-1 ${semaforo.color}`}>
            {semaforo.label}
          </p>
          <p className="text-xs text-muted-foreground">
            P&L estimado: <span className={plEstimado >= 0 ? "text-emerald-600" : "text-red-600"}>{formatEur(plEstimado)}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
