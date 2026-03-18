import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
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

const columnGroups = [
  { label: "", cols: ["Mes"] },
  { label: "Ventas", cols: ["Ventas", "Pedidos", "Entregados", "%", "Ticket"] },
  { label: "Rechazos", cols: ["Rech.", "Pend."] },
  { label: "P&L", cols: ["Bruto", "Gastos", "%G", "P&L Real", "%P", "P&L Ajust.", "%A"] },
  { label: "", cols: ["Reserva"] },
];

export function MonthlyTable({ rows }: MonthlyTableProps) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="max-h-[70vh] overflow-auto">
        <Table>
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
            <TableRow className="text-sm bg-muted/80 hover:bg-muted/80">
              <TableHead className="w-24 bg-muted/80">Mes</TableHead>
              <TableHead className="text-right bg-muted/80">Ventas</TableHead>
              <TableHead className="text-right bg-muted/80">Pedidos</TableHead>
              <TableHead className="text-right bg-muted/80">Entregados</TableHead>
              <TableHead className="text-right bg-muted/80">%</TableHead>
              <TableHead className="text-right border-r border-border/40 bg-muted/80">Ticket</TableHead>
              <TableHead className="text-right bg-muted/80">Rech.</TableHead>
              <TableHead className="text-right border-r border-border/40 bg-muted/80">Pend.</TableHead>
              <TableHead className="text-right bg-muted/80">Bruto</TableHead>
              <TableHead className="text-right bg-muted/80">Gastos</TableHead>
              <TableHead className="text-right bg-muted/80">%</TableHead>
              <TableHead className="text-right bg-muted/80">P&L Real</TableHead>
              <TableHead className="text-right bg-muted/80">%</TableHead>
              <TableHead className="text-right bg-muted/80">P&L Ajust.</TableHead>
              <TableHead className="text-right border-r border-border/40 bg-muted/80">%</TableHead>
              <TableHead className="text-right bg-muted/80">Reserva</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={row.mes}
                className={`text-sm transition-colors hover:bg-primary/5 ${
                  i % 2 === 0 ? "bg-background" : "bg-muted/20"
                }`}
              >
                <TableCell className="font-semibold text-primary">
                  {monthLabel(row.mes)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {eur(row.ventas)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.pedidos}</TableCell>
                <TableCell className="text-right tabular-nums">{row.entregados}</TableCell>
                <TableCell className={`text-right tabular-nums ${
                  row.tasa_entrega < 0.6 ? "text-red-500 font-medium" : row.tasa_entrega >= 0.8 ? "text-emerald-600 font-medium" : ""
                }`}>{pct(row.tasa_entrega)}</TableCell>
                <TableCell className="text-right tabular-nums border-r border-border/40">
                  {eur(row.ticket_promedio)}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${row.rechazados > 0 ? "text-red-500" : ""}`}>
                  {row.rechazados}
                </TableCell>
                <TableCell className={`text-right tabular-nums border-r border-border/40 ${row.pendientes > 0 ? "text-amber-600" : ""}`}>
                  {row.pendientes}
                </TableCell>
                <TableCell className="text-right tabular-nums">{eur(row.bruto)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(row.gastos)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {pct(row.pct_gastos)}
                </TableCell>
                <TableCell className={`text-right tabular-nums font-bold ${
                  row.pnl_real < 0 ? "text-red-600" : "text-emerald-600"
                }`}>
                  {eur(row.pnl_real)}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${
                  row.pct_pnl < 0 ? "text-red-500" : "text-emerald-600"
                }`}>{pct(row.pct_pnl)}</TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${
                  row.pnl_ajustado < 0 ? "text-red-600" : "text-emerald-600"
                }`}>
                  {eur(row.pnl_ajustado)}
                </TableCell>
                <TableCell className={`text-right tabular-nums border-r border-border/40 ${
                  row.pct_pnl_ajustado < 0 ? "text-red-500" : ""
                }`}>{pct(row.pct_pnl_ajustado)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.reserva > 0 ? `€${Math.round(row.reserva).toLocaleString("es-ES")}` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
