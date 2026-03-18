"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DailyRow } from "@/lib/queries/dashboard";

interface DailyTableProps {
  rows: DailyRow[];
  onRowClick: (fecha: string, metaAds: number, tiktokAds: number) => void;
}

function formatDate(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function eur(n: number) {
  return n.toFixed(2);
}

export function DailyTable({ rows, onRowClick }: DailyTableProps) {
  // Totals
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
      pedidos: 0,
      enviados: 0,
      entregados: 0,
      rechazados: 0,
      cancelados: 0,
      pendientes: 0,
      ventas: 0,
      bruto: 0,
      total_ads: 0,
      gestion: 0,
      gastos: 0,
      pnl_teorico: 0,
      pnl_real: 0,
    }
  );

  const totalTasaEntrega =
    totals.enviados > 0 ? totals.entregados / totals.enviados : 0;
  const totalPctMargin = totals.ventas > 0 ? totals.pnl_real / totals.ventas : 0;
  const totalCpa =
    totals.entregados > 0 ? totals.total_ads / totals.entregados : 0;

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="w-16">Dia</TableHead>
            <TableHead className="text-right">Ped.</TableHead>
            <TableHead className="text-right">Env.</TableHead>
            <TableHead className="text-right">Ent.</TableHead>
            <TableHead className="text-right">Pend.</TableHead>
            <TableHead className="text-right">Rech.</TableHead>
            <TableHead className="text-right">Canc.</TableHead>
            <TableHead className="text-right">%Ent</TableHead>
            <TableHead className="text-right">Ventas</TableHead>
            <TableHead className="text-right">Bruto</TableHead>
            <TableHead className="text-right">Ads</TableHead>
            <TableHead className="text-right">Gest.</TableHead>
            <TableHead className="text-right">Gastos</TableHead>
            <TableHead className="text-right">P&L Teo.</TableHead>
            <TableHead className="text-right">P&L Real</TableHead>
            <TableHead className="text-right">%Vtas</TableHead>
            <TableHead className="text-right">CPA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Totals row */}
          <TableRow className="font-semibold bg-muted/50 text-xs">
            <TableCell>TOTAL</TableCell>
            <TableCell className="text-right">{totals.pedidos}</TableCell>
            <TableCell className="text-right">{totals.enviados}</TableCell>
            <TableCell className="text-right">{totals.entregados}</TableCell>
            <TableCell className="text-right">{totals.pendientes}</TableCell>
            <TableCell className="text-right">{totals.rechazados}</TableCell>
            <TableCell className="text-right">{totals.cancelados}</TableCell>
            <TableCell className="text-right">{pct(totalTasaEntrega)}</TableCell>
            <TableCell className="text-right">{eur(totals.ventas)}</TableCell>
            <TableCell className="text-right">{eur(totals.bruto)}</TableCell>
            <TableCell className="text-right">{eur(totals.total_ads)}</TableCell>
            <TableCell className="text-right">{eur(totals.gestion)}</TableCell>
            <TableCell className="text-right">{eur(totals.gastos)}</TableCell>
            <TableCell className={`text-right ${totals.pnl_teorico < 0 ? "text-red-600" : ""}`}>
              {eur(totals.pnl_teorico)}
            </TableCell>
            <TableCell className={`text-right ${totals.pnl_real < 0 ? "text-red-600" : ""}`}>
              {eur(totals.pnl_real)}
            </TableCell>
            <TableCell className="text-right">{pct(totalPctMargin)}</TableCell>
            <TableCell className="text-right">{eur(totalCpa)}</TableCell>
          </TableRow>

          {rows.map((row) => (
            <TableRow
              key={row.fecha}
              className={`text-xs cursor-pointer hover:bg-muted/30 ${
                row.pnl_real < 0 ? "text-red-600" : ""
              }`}
              onClick={() => onRowClick(row.fecha, row.meta_ads, row.tiktok_ads)}
            >
              <TableCell className="font-medium">{formatDate(row.fecha)}</TableCell>
              <TableCell className="text-right">{row.pedidos}</TableCell>
              <TableCell className="text-right">{row.enviados}</TableCell>
              <TableCell className="text-right">{row.entregados}</TableCell>
              <TableCell className="text-right">{row.pendientes}</TableCell>
              <TableCell className="text-right">{row.rechazados}</TableCell>
              <TableCell className="text-right">{row.cancelados}</TableCell>
              <TableCell className="text-right">{pct(row.tasa_entrega)}</TableCell>
              <TableCell className="text-right">{eur(row.ventas)}</TableCell>
              <TableCell className="text-right">{eur(row.bruto)}</TableCell>
              <TableCell className="text-right">{eur(row.total_ads)}</TableCell>
              <TableCell className="text-right">{eur(row.gestion)}</TableCell>
              <TableCell className="text-right">{eur(row.gastos)}</TableCell>
              <TableCell className="text-right">{eur(row.pnl_teorico)}</TableCell>
              <TableCell className="text-right">{eur(row.pnl_real)}</TableCell>
              <TableCell className="text-right">{pct(row.pct_margin)}</TableCell>
              <TableCell className="text-right">{eur(row.cpa_real)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
