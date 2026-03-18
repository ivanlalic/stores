import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MonthlyRow } from "@/lib/queries/dashboard";

interface MonthlyTableProps {
  rows: MonthlyRow[];
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function eur(n: number) {
  return n.toFixed(2);
}

function monthLabel(mes: string) {
  const [y, m] = mes.split("-");
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export function MonthlyTable({ rows }: MonthlyTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead>Mes</TableHead>
            <TableHead className="text-right">Ventas</TableHead>
            <TableHead className="text-right">Ped.</TableHead>
            <TableHead className="text-right">Ent.</TableHead>
            <TableHead className="text-right">%Ent</TableHead>
            <TableHead className="text-right">Ticket</TableHead>
            <TableHead className="text-right">Rech.</TableHead>
            <TableHead className="text-right">Pend.</TableHead>
            <TableHead className="text-right">Bruto</TableHead>
            <TableHead className="text-right">Gastos</TableHead>
            <TableHead className="text-right">%Gastos</TableHead>
            <TableHead className="text-right">P&L Real</TableHead>
            <TableHead className="text-right">%P&L</TableHead>
            <TableHead className="text-right">CPA Env.</TableHead>
            <TableHead className="text-right">CPA Real</TableHead>
            <TableHead className="text-right">P&L Ajust.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.mes}
              className={`text-xs ${row.pnl_real < 0 ? "text-red-600" : ""}`}
            >
              <TableCell className="font-medium">{monthLabel(row.mes)}</TableCell>
              <TableCell className="text-right">{eur(row.ventas)}</TableCell>
              <TableCell className="text-right">{row.pedidos}</TableCell>
              <TableCell className="text-right">{row.entregados}</TableCell>
              <TableCell className="text-right">{pct(row.tasa_entrega)}</TableCell>
              <TableCell className="text-right">{eur(row.ticket_promedio)}</TableCell>
              <TableCell className="text-right">{row.rechazados}</TableCell>
              <TableCell className="text-right">{row.pendientes}</TableCell>
              <TableCell className="text-right">{eur(row.bruto)}</TableCell>
              <TableCell className="text-right">{eur(row.gastos)}</TableCell>
              <TableCell className="text-right">{pct(row.pct_gastos)}</TableCell>
              <TableCell className={`text-right font-semibold ${row.pnl_real < 0 ? "text-red-600" : "text-green-600"}`}>
                {eur(row.pnl_real)}
              </TableCell>
              <TableCell className="text-right">{pct(row.pct_pnl)}</TableCell>
              <TableCell className="text-right">{eur(row.cpa_enviado)}</TableCell>
              <TableCell className="text-right">{eur(row.cpa_real)}</TableCell>
              <TableCell className={`text-right ${row.pnl_ajustado < 0 ? "text-red-600" : ""}`}>
                {eur(row.pnl_ajustado)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
