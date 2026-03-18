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
import type { DailyRow } from "@/lib/queries/dashboard";

interface DailyTableProps {
  rows: DailyRow[];
  onRowClick: (fecha: string, metaAds: number, tiktokAds: number) => void;
}

function formatDate(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  const day = d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  const weekday = d.toLocaleDateString("es-ES", { weekday: "short" });
  return { day, weekday };
}

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function eur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const columnInfo: Record<string, string> = {
  "Dia": "Fecha del día",
  "Ped.": "Pedidos: total de pedidos recibidos ese día",
  "Env.": "Enviados: pedidos que fueron enviados al courier",
  "Ent.": "Entregados: pedidos entregados con éxito al cliente",
  "Pend.": "Pendientes: Enviados - Entregados - Rechazados",
  "Rech.": "Rechazados: pedidos devueltos o no entregados",
  "Canc.": "Cancelados: pedidos cancelados antes de enviar",
  "%Ent": "Tasa de entrega: Entregados / Enviados",
  "Ventas": "Ventas: suma del precio de venta de los pedidos enviados",
  "Bruto": "Bruto: suma del neto (venta - costo producto) de los enviados",
  "Ads": "Ads: gasto en Meta Ads + TikTok Ads",
  "Gest.": "Gestión: costo de envío por pedido × cantidad de enviados",
  "Gastos": "Gastos: Ads + Gestión",
  "P&L Teo.": "P&L Teórico: Bruto - Gastos (asume que todos se entregan)",
  "P&L Real": "P&L Real: Neto entregados + Neto rechazados - Gastos",
  "%Vtas": "Margen: P&L Real / Ventas",
  "CPA Env.": "CPA Enviado: Ads / Enviados",
  "CPA Real": "CPA Real: Ads / Entregados",
};

const columnGroups = [
  { label: "Pedidos", cols: ["Dia", "Ped.", "Env.", "Ent.", "Pend.", "Rech.", "Canc.", "%Ent"] },
  { label: "Finanzas", cols: ["Ventas", "Bruto", "Ads", "Gest.", "Gastos"] },
  { label: "Resultado", cols: ["P&L Teo.", "P&L Real", "%Vtas"] },
  { label: "CPA", cols: ["CPA Env.", "CPA Real"] },
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

function ValueCell({ value, negative, positive, bold }: { value: string; negative?: boolean; positive?: boolean; bold?: boolean }) {
  return (
    <TableCell
      className={`text-right tabular-nums ${bold ? "font-semibold" : ""} ${
        negative ? "text-red-600 font-medium" : positive ? "text-emerald-600 font-medium" : ""
      }`}
    >
      {value}
    </TableCell>
  );
}

export function DailyTable({ rows, onRowClick }: DailyTableProps) {
  const totals = rows.reduce(
    (t, r) => ({
      pedidos: t.pedidos + r.pedidos,
      enviados: t.enviados + r.enviados,
      entregados: t.entregados + r.entregados,
      rechazados: t.rechazados + r.rechazados,
      cancelados: t.cancelados + r.cancelados,
      pendientes: t.pendientes + r.pendientes,
      ventas: t.ventas + r.ventas,
      bruto: t.bruto + r.bruto,
      total_ads: t.total_ads + r.total_ads,
      gestion: t.gestion + r.gestion,
      gastos: t.gastos + r.gastos,
      pnl_teorico: t.pnl_teorico + r.pnl_teorico,
      pnl_real: t.pnl_real + r.pnl_real,
    }),
    {
      pedidos: 0, enviados: 0, entregados: 0, rechazados: 0,
      cancelados: 0, pendientes: 0, ventas: 0, bruto: 0,
      total_ads: 0, gestion: 0, gastos: 0, pnl_teorico: 0, pnl_real: 0,
    }
  );

  const totalTasaEntrega = totals.enviados > 0 ? totals.entregados / totals.enviados : 0;
  const totalPctMargin = totals.ventas > 0 ? totals.pnl_real / totals.ventas : 0;
  const totalCpaEnviado = totals.enviados > 0 ? totals.total_ads / totals.enviados : 0;
  const totalCpaReal = totals.entregados > 0 ? totals.total_ads / totals.entregados : 0;

  return (
    <TooltipProvider>
      <Card className="p-0 overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-20">
              {/* Group header row */}
              <TableRow className="border-b-0 bg-muted">
                {columnGroups.map((group) => (
                  <TableHead
                    key={group.label}
                    colSpan={group.cols.length}
                    className="text-center text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold py-1.5 border-l first:border-l-0 border-border/40 bg-muted"
                  >
                    {group.label}
                  </TableHead>
                ))}
              </TableRow>
              {/* Column header row */}
              <TableRow className="text-sm bg-muted/80 hover:bg-muted/80">
                {columnGroups.flatMap((group, gi) =>
                  group.cols.map((h, hi) => (
                    <TableHead
                      key={h}
                      className={`${h === "Dia" ? "w-20 sticky left-0 bg-muted/80 z-30" : "text-right"} ${
                        hi === 0 && gi > 0 ? "border-l border-border/40" : ""
                      } py-2.5 bg-muted/80`}
                    >
                      <InfoHeader label={h} />
                    </TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => {
                const { day, weekday } = formatDate(row.fecha);
                const isWeekend = weekday === "sáb" || weekday === "dom" || weekday === "sáb." || weekday === "dom.";
                return (
                  <TableRow
                    key={row.fecha}
                    className={`text-sm cursor-pointer transition-colors hover:bg-primary/5 ${
                      i % 2 === 0 ? "bg-background" : "bg-muted/20"
                    } ${isWeekend ? "bg-muted/30" : ""}`}
                    onClick={() => onRowClick(row.fecha, row.meta_ads, row.tiktok_ads)}
                  >
                    {/* Date */}
                    <TableCell className="font-medium sticky left-0 bg-inherit z-10">
                      <div className="flex flex-col">
                        <span>{day}</span>
                        <span className="text-xs text-muted-foreground capitalize">{weekday}</span>
                      </div>
                    </TableCell>
                    {/* Orders group */}
                    <TableCell className="text-right tabular-nums">{row.pedidos}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.enviados}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{row.entregados}</TableCell>
                    <TableCell className={`text-right tabular-nums ${row.pendientes > 0 ? "text-amber-600" : ""}`}>{row.pendientes}</TableCell>
                    <TableCell className={`text-right tabular-nums ${row.rechazados > 0 ? "text-red-500" : ""}`}>{row.rechazados}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{row.cancelados}</TableCell>
                    <TableCell className={`text-right tabular-nums border-r border-border/40 ${
                      row.tasa_entrega > 0 && row.tasa_entrega < 0.6 ? "text-red-500 font-medium" : row.tasa_entrega >= 0.8 ? "text-emerald-600 font-medium" : ""
                    }`}>{pct(row.tasa_entrega)}</TableCell>
                    {/* Finance group */}
                    <ValueCell value={eur(row.ventas)} />
                    <ValueCell value={eur(row.bruto)} />
                    <ValueCell value={eur(row.total_ads)} />
                    <ValueCell value={eur(row.gestion)} />
                    <TableCell className="text-right tabular-nums border-r border-border/40">{eur(row.gastos)}</TableCell>
                    {/* Result group */}
                    <ValueCell value={eur(row.pnl_teorico)} negative={row.pnl_teorico < 0} positive={row.pnl_teorico > 0} />
                    <ValueCell value={eur(row.pnl_real)} negative={row.pnl_real < 0} positive={row.pnl_real > 0} bold />
                    <TableCell className={`text-right tabular-nums border-r border-border/40 ${
                      row.pct_margin < 0 ? "text-red-500" : row.pct_margin > 0.2 ? "text-emerald-600" : ""
                    }`}>{pct(row.pct_margin)}</TableCell>
                    {/* CPA group */}
                    <TableCell className="text-right tabular-nums">{eur(row.cpa_enviado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(row.cpa_real)}</TableCell>
                  </TableRow>
                );
              })}

              {/* Totals row */}
              <TableRow className="font-semibold bg-primary/5 text-sm border-t-2 border-primary/20 hover:bg-primary/5">
                <TableCell className="sticky left-0 bg-primary/5 z-10">
                  <span className="text-primary font-bold">TOTAL</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{totals.pedidos}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.enviados}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.entregados}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.pendientes}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.rechazados}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.cancelados}</TableCell>
                <TableCell className="text-right tabular-nums border-r border-border/40">{pct(totalTasaEntrega)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(totals.ventas)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(totals.bruto)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(totals.total_ads)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(totals.gestion)}</TableCell>
                <TableCell className="text-right tabular-nums border-r border-border/40">{eur(totals.gastos)}</TableCell>
                <ValueCell value={eur(totals.pnl_teorico)} negative={totals.pnl_teorico < 0} positive={totals.pnl_teorico > 0} bold />
                <ValueCell value={eur(totals.pnl_real)} negative={totals.pnl_real < 0} positive={totals.pnl_real > 0} bold />
                <TableCell className="text-right tabular-nums border-r border-border/40">{pct(totalPctMargin)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(totalCpaEnviado)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(totalCpaReal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </TooltipProvider>
  );
}
