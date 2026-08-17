"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Info } from "lucide-react";
import type { MonthlyRow } from "@/lib/queries/dashboard";

interface MonthlyTableProps {
  rows: MonthlyRow[];
}

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function eur(n: number) {
  return `€${n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const monthNames = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function monthLabel(mes: string) {
  const [y, m] = mes.split("-");
  return `${monthNames[parseInt(m) - 1]} ${y}`;
}

const columnInfo: Record<string, string> = {
  "Mes": "Mes del período",
  "Ventas": "Suma del precio de venta de los pedidos enviados ese mes",
  "Env.": "Pedidos enviados al courier ese mes",
  "Entregados": "Pedidos entregados con éxito al cliente",
  "%Ent": "Tasa de entrega: Entregados ÷ Enviados",
  "Ticket": "Ticket medio por pedido enviado: Ventas ÷ Enviados",
  "Rech.": "Pedidos rechazados o devueltos ese mes",
  "Pend.": "Pedidos en tránsito aún sin resolver: Enviados − Entregados − Rechazados",
  "Bruto": "Suma del neto (venta − costo de producto) de todos los enviados",
  "Gastos": "Ads + fee de gestión por envío",
  "%G": "Gastos ÷ Ventas — qué porcentaje de la facturación se va en gastos",
  "P&L Teo.": "Máximo posible: Bruto − Gastos. Asume que todos los pendientes se entregan.",
  "P&L Real": "Estado actual resuelto: neto de entregados + neto de rechazados − Gastos",
  "%P": "P&L Real ÷ Ventas — margen neto sobre facturación",
  "Peor caso": "Mínimo posible: P&L Real − (Pendientes × €13). Si el mes está cerrado (sin pendientes), se muestra —.",
  "Reserva": "Capital retenido en pedidos pendientes: Pendientes × €13",
  "CPA Real": "Costo por cliente pagador: Ads ÷ Entregados",
};

const columnGroups = [
  { label: "", cols: ["Mes"] },
  { label: "Ventas", cols: ["Ventas", "Env.", "Entregados", "%Ent", "Ticket"] },
  { label: "Rechazos", cols: ["Rech.", "Pend."] },
  { label: "P&L", cols: ["Bruto", "Gastos", "%G", "P&L Teo.", "P&L Real", "%P", "Peor caso"] },
  { label: "", cols: ["Reserva", "CPA Real"] },
];

function InfoHeader({ label }: { label: string }) {
  const info = columnInfo[label];
  if (!info) return <span>{label}</span>;
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center gap-0.5 cursor-help whitespace-nowrap">
        {label}
        <Info className="size-3 opacity-30" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {info}
      </TooltipContent>
    </Tooltip>
  );
}

export function MonthlyTable({ rows }: MonthlyTableProps) {
  const totals = rows.reduce(
    (t, r) => ({
      ventas: t.ventas + r.ventas,
      enviados: t.enviados + r.enviados,
      entregados: t.entregados + r.entregados,
      rechazados: t.rechazados + r.rechazados,
      pendientes: t.pendientes + r.pendientes,
      bruto: t.bruto + r.bruto,
      gastos: t.gastos + r.gastos,
      total_ads: t.total_ads + r.total_ads,
      pnl_teorico: t.pnl_teorico + r.pnl_teorico,
      pnl_real: t.pnl_real + r.pnl_real,
      pnl_ajustado: t.pnl_ajustado + r.pnl_ajustado,
      reserva: t.reserva + r.reserva,
    }),
    {
      ventas: 0, enviados: 0, entregados: 0, rechazados: 0, pendientes: 0,
      bruto: 0, gastos: 0, total_ads: 0, pnl_teorico: 0, pnl_real: 0,
      pnl_ajustado: 0, reserva: 0,
    }
  );

  const totalTasaEntrega = totals.enviados > 0 ? totals.entregados / totals.enviados : 0;
  const totalTicket = totals.enviados > 0 ? totals.ventas / totals.enviados : 0;
  const totalPctGastos = totals.ventas > 0 ? totals.gastos / totals.ventas : 0;
  const totalPctPnl = totals.ventas > 0 ? totals.pnl_real / totals.ventas : 0;
  const totalCpaReal = totals.entregados > 0 ? totals.total_ads / totals.entregados : 0;

  return (
    <TooltipProvider>
      <Card className="p-0 overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 z-20">
              {/* Group header */}
              <TableRow className="border-b-0 bg-muted">
                {columnGroups.map((group) => (
                  <TableHead
                    key={group.label + group.cols.join()}
                    colSpan={group.cols.length}
                    className="text-center text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold py-1.5 border-l first:border-l-0 border-border/40 bg-muted"
                  >
                    {group.label}
                  </TableHead>
                ))}
              </TableRow>
              {/* Column headers */}
              <TableRow className="bg-muted/80 hover:bg-muted/80">
                <TableHead className="w-24 bg-muted/80"><InfoHeader label="Mes" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="Ventas" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="Env." /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="Entregados" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="%Ent" /></TableHead>
                <TableHead className="text-right border-r border-border/40 bg-muted/80"><InfoHeader label="Ticket" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="Rech." /></TableHead>
                <TableHead className="text-right border-r border-border/40 bg-muted/80"><InfoHeader label="Pend." /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="Bruto" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="Gastos" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="%G" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="P&L Teo." /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="P&L Real" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="%P" /></TableHead>
                <TableHead className="text-right border-r border-border/40 bg-muted/80"><InfoHeader label="Peor caso" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="Reserva" /></TableHead>
                <TableHead className="text-right bg-muted/80"><InfoHeader label="CPA Real" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow
                  key={row.mes}
                  className={`transition-colors hover:bg-primary/5 ${
                    i % 2 === 0 ? "bg-background" : "bg-muted/20"
                  }`}
                >
                  <TableCell className="font-semibold text-primary">{monthLabel(row.mes)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{eur(row.ventas)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.enviados}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.entregados}</TableCell>
                  <TableCell className={`text-right tabular-nums ${
                    row.tasa_entrega < 0.6 ? "text-red-500 font-medium" : row.tasa_entrega >= 0.8 ? "text-emerald-600 font-medium" : ""
                  }`}>{pct(row.tasa_entrega)}</TableCell>
                  <TableCell className="text-right tabular-nums border-r border-border/40">{eur(row.ticket_promedio)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${row.rechazados > 0 ? "text-red-500" : ""}`}>{row.rechazados}</TableCell>
                  <TableCell className={`text-right tabular-nums border-r border-border/40 ${row.pendientes > 0 ? "text-amber-600" : ""}`}>{row.pendientes}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(row.bruto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(row.gastos)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{pct(row.pct_gastos)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${row.pnl_teorico >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {eur(row.pnl_teorico)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-bold ${row.pnl_real < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {eur(row.pnl_real)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${row.pct_pnl < 0 ? "text-red-500" : "text-emerald-600"}`}>
                    {pct(row.pct_pnl)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums border-r border-border/40 ${
                    row.pendientes === 0 ? "text-muted-foreground" : row.pnl_ajustado < 0 ? "text-red-600" : "text-emerald-600"
                  }`}>
                    {row.pendientes === 0 ? "—" : eur(row.pnl_ajustado)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.reserva > 0 ? eur(row.reserva) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.cpa_real > 0 ? eur(row.cpa_real) : "—"}
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals row */}
              <TableRow className="font-semibold bg-primary/5 border-t-2 border-primary/20 hover:bg-primary/5">
                <TableCell className="text-primary font-bold">TOTAL</TableCell>
                <TableCell className="text-right tabular-nums">{eur(totals.ventas)}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.enviados}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.entregados}</TableCell>
                <TableCell className={`text-right tabular-nums ${
                  totalTasaEntrega < 0.6 ? "text-red-500" : totalTasaEntrega >= 0.8 ? "text-emerald-600" : ""
                }`}>{pct(totalTasaEntrega)}</TableCell>
                <TableCell className="text-right tabular-nums border-r border-border/40">{eur(totalTicket)}</TableCell>
                <TableCell className="text-right tabular-nums text-red-500">{totals.rechazados}</TableCell>
                <TableCell className={`text-right tabular-nums border-r border-border/40 ${totals.pendientes > 0 ? "text-amber-600" : ""}`}>{totals.pendientes}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(totals.bruto)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(totals.gastos)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{pct(totalPctGastos)}</TableCell>
                <TableCell className={`text-right tabular-nums ${totals.pnl_teorico >= 0 ? "text-emerald-600" : "text-red-600"}`}>{eur(totals.pnl_teorico)}</TableCell>
                <TableCell className={`text-right tabular-nums font-bold ${totals.pnl_real < 0 ? "text-red-600" : "text-emerald-600"}`}>{eur(totals.pnl_real)}</TableCell>
                <TableCell className={`text-right tabular-nums ${totalPctPnl < 0 ? "text-red-500" : "text-emerald-600"}`}>{pct(totalPctPnl)}</TableCell>
                <TableCell className={`text-right tabular-nums border-r border-border/40 ${
                  totals.pendientes === 0 ? "text-muted-foreground" : totals.pnl_ajustado < 0 ? "text-red-600" : "text-emerald-600"
                }`}>{totals.pendientes === 0 ? "—" : eur(totals.pnl_ajustado)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {totals.reserva > 0 ? eur(totals.reserva) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{eur(totalCpaReal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </TooltipProvider>
  );
}
