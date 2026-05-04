import * as XLSX from "xlsx";
import type { MonthlyRow } from "@/lib/queries/dashboard";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function monthLabel(mes: string) {
  const [y, m] = mes.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function r(n: number) {
  return Math.round(n * 100) / 100;
}

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

const HEADERS = [
  "Mes", "Ventas (€)", "Enviados", "Entregados", "%Entrega", "Ticket (€)",
  "Rechazados", "Pendientes",
  "Bruto (€)", "Gastos (€)", "%Gastos", "P&L Teo. (€)", "P&L Real (€)", "%P&L", "Peor Caso (€)",
  "Reserva (€)", "CPA Real (€)",
];

function rowToArray(row: MonthlyRow): (string | number)[] {
  return [
    monthLabel(row.mes),
    r(row.ventas),
    row.enviados,
    row.entregados,
    pct(row.tasa_entrega),
    r(row.ticket_promedio),
    row.rechazados,
    row.pendientes,
    r(row.bruto),
    r(row.gastos),
    pct(row.pct_gastos),
    r(row.pnl_teorico),
    r(row.pnl_real),
    pct(row.pct_pnl),
    row.pendientes === 0 ? "—" : r(row.pnl_ajustado),
    row.reserva > 0 ? r(row.reserva) : "—",
    row.cpa_real > 0 ? r(row.cpa_real) : "—",
  ];
}

function buildTotalsRow(rows: MonthlyRow[]): (string | number)[] {
  const t = rows.reduce(
    (acc, r) => ({
      ventas: acc.ventas + r.ventas,
      enviados: acc.enviados + r.enviados,
      entregados: acc.entregados + r.entregados,
      rechazados: acc.rechazados + r.rechazados,
      pendientes: acc.pendientes + r.pendientes,
      bruto: acc.bruto + r.bruto,
      gastos: acc.gastos + r.gastos,
      total_ads: acc.total_ads + r.total_ads,
      pnl_teorico: acc.pnl_teorico + r.pnl_teorico,
      pnl_real: acc.pnl_real + r.pnl_real,
      pnl_ajustado: acc.pnl_ajustado + r.pnl_ajustado,
      reserva: acc.reserva + r.reserva,
    }),
    { ventas: 0, enviados: 0, entregados: 0, rechazados: 0, pendientes: 0, bruto: 0, gastos: 0, total_ads: 0, pnl_teorico: 0, pnl_real: 0, pnl_ajustado: 0, reserva: 0 }
  );

  const tasaEntrega = t.enviados > 0 ? t.entregados / t.enviados : 0;
  const ticket = t.enviados > 0 ? t.ventas / t.enviados : 0;
  const pctGastos = t.ventas > 0 ? t.gastos / t.ventas : 0;
  const pctPnl = t.ventas > 0 ? t.pnl_real / t.ventas : 0;
  const cpaReal = t.entregados > 0 ? t.total_ads / t.entregados : 0;

  return [
    "TOTAL",
    Math.round(t.ventas * 100) / 100,
    t.enviados,
    t.entregados,
    pct(tasaEntrega),
    Math.round(ticket * 100) / 100,
    t.rechazados,
    t.pendientes,
    Math.round(t.bruto * 100) / 100,
    Math.round(t.gastos * 100) / 100,
    pct(pctGastos),
    Math.round(t.pnl_teorico * 100) / 100,
    Math.round(t.pnl_real * 100) / 100,
    pct(pctPnl),
    t.pendientes === 0 ? "—" : Math.round(t.pnl_ajustado * 100) / 100,
    t.reserva > 0 ? Math.round(t.reserva * 100) / 100 : "—",
    Math.round(cpaReal * 100) / 100,
  ];
}

export function exportMonthlyToExcel(rows: MonthlyRow[], storeName: string, label: string) {
  const today = new Date().toLocaleDateString("es-ES");
  const ncols = HEADERS.length;

  const sheetData: (string | number)[][] = [
    [storeName, ...Array(ncols - 1).fill("")],
    [`Exportado: ${today}`, ...Array(ncols - 1).fill("")],
    Array(ncols).fill(""),
    HEADERS,
    ...rows.map(rowToArray),
    buildTotalsRow(rows),
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Merge store name across all columns
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } }];

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, // Mes
    { wch: 12 }, // Ventas
    { wch: 10 }, // Enviados
    { wch: 12 }, // Entregados
    { wch: 9 },  // %Entrega
    { wch: 11 }, // Ticket
    { wch: 12 }, // Rechazados
    { wch: 11 }, // Pendientes
    { wch: 12 }, // Bruto
    { wch: 12 }, // Gastos
    { wch: 9 },  // %Gastos
    { wch: 13 }, // P&L Teo.
    { wch: 13 }, // P&L Real
    { wch: 8 },  // %P&L
    { wch: 13 }, // Peor Caso
    { wch: 12 }, // Reserva
    { wch: 12 }, // CPA Real
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mensual");

  const filename = `${storeName}_${label}_mensual.xlsx`
    .toLowerCase()
    .replace(/\s+/g, "_");

  XLSX.writeFile(wb, filename);
}
