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

function InfoHeader({ label }: { label: string }) {
  const info = columnInfo[label];
  if (!info) return <span>{label}</span>;

  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center gap-0.5 cursor-help">
        {label}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="size-3 opacity-40"
        >
          <path
            fillRule="evenodd"
            d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z"
            clipRule="evenodd"
          />
        </svg>
      </TooltipTrigger>
      <TooltipContent side="top">{info}</TooltipContent>
    </Tooltip>
  );
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
  const totalCpaEnviado =
    totals.enviados > 0 ? totals.total_ads / totals.enviados : 0;
  const totalCpaReal =
    totals.entregados > 0 ? totals.total_ads / totals.entregados : 0;

  const headers = [
    "Dia", "Ped.", "Env.", "Ent.", "Pend.", "Rech.", "Canc.",
    "%Ent", "Ventas", "Bruto", "Ads", "Gest.", "Gastos",
    "P&L Teo.", "P&L Real", "%Vtas", "CPA Env.", "CPA Real",
  ];

  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              {headers.map((h) => (
                <TableHead
                  key={h}
                  className={h === "Dia" ? "w-16" : "text-right"}
                >
                  <InfoHeader label={h} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
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
                <TableCell className="text-right">{eur(row.cpa_enviado)}</TableCell>
                <TableCell className="text-right">{eur(row.cpa_real)}</TableCell>
              </TableRow>
            ))}

            {/* Totals row at the bottom */}
            <TableRow className="font-semibold bg-muted/50 text-xs border-t-2">
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
              <TableCell className="text-right">{eur(totalCpaEnviado)}</TableCell>
              <TableCell className="text-right">{eur(totalCpaReal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
