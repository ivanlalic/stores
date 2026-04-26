"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Info, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ProductoRow } from "@/lib/queries/dashboard";

interface Props { rows: ProductoRow[]; }

type SortKey = keyof ProductoRow;

function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }
function eur(n: number) {
  return `€${n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const columnInfo: Record<string, string> = {
  "Producto":   "Nombre del producto tal como aparece en Dropea",
  "Pedidos":    "Órdenes que contienen este producto (incluye combos)",
  "Unidades":   "Cantidad total de unidades vendidas",
  "Env.":       "Pedidos enviados al courier",
  "Ent.":       "Pedidos entregados al cliente",
  "%Ent":       "Tasa de entrega: Entregados ÷ Enviados",
  "Rech.":      "Pedidos rechazados o devueltos",
  "%Rech":      "Tasa de rechazo: Rechazados ÷ Enviados",
  "Pend.":      "Pedidos en tránsito sin resolver",
  "Ventas":     "Facturación (solo órdenes de producto único — multi-producto excluido para evitar doble conteo)",
  "Neto":       "Ganancia neta (solo órdenes de producto único)",
  "Neto/ord":   "Neto medio por orden enviada de este producto (solo órdenes únicas)",
};

function InfoHeader({ label, sortKey, sortState, onSort }: {
  label: string;
  sortKey: SortKey;
  sortState: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
}) {
  const info = columnInfo[label];
  const isActive = sortState.key === sortKey;
  const Icon = isActive ? (sortState.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      className="inline-flex items-center gap-0.5 cursor-pointer whitespace-nowrap hover:text-foreground"
      onClick={() => onSort(sortKey)}
    >
      {info ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="inline-flex items-center gap-0.5">
              {label}
              <Info className="size-3 opacity-30" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">{info}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : label}
      <Icon className={`size-3 ml-0.5 ${isActive ? "opacity-80" : "opacity-30"}`} />
    </button>
  );
}

export function ProductsTable({ rows }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "pedidos",
    dir: "desc",
  });

  function handleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" });
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    const diff = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? (typeof diff === "number" ? diff : 0) : (typeof diff === "number" ? -diff : 0);
  });

  function H({ label, k }: { label: string; k: SortKey }) {
    return <InfoHeader label={label} sortKey={k} sortState={sort} onSort={handleSort} />;
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="max-h-[70vh] overflow-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-20">
            <TableRow className="bg-muted/80 hover:bg-muted/80">
              <TableHead className="bg-muted/80 min-w-[200px]"><H label="Producto" k="nombre" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="Pedidos" k="pedidos" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="Unidades" k="unidades" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="Env." k="enviados" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="Ent." k="entregados" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="%Ent" k="tasa_entrega" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="Rech." k="rechazados" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="%Rech" k="tasa_rechazo" /></TableHead>
              <TableHead className="text-right border-r border-border/40 bg-muted/80"><H label="Pend." k="pendientes" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="Ventas" k="ventas" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="Neto" k="neto" /></TableHead>
              <TableHead className="text-right bg-muted/80"><H label="Neto/ord" k="neto_por_unidad" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow
                key={row.nombre}
                className={`transition-colors hover:bg-primary/5 ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
              >
                <TableCell className="font-medium max-w-[280px] truncate" title={row.nombre}>
                  {row.nombre}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.pedidos}</TableCell>
                <TableCell className="text-right tabular-nums">{row.unidades}</TableCell>
                <TableCell className="text-right tabular-nums">{row.enviados}</TableCell>
                <TableCell className="text-right tabular-nums">{row.entregados}</TableCell>
                <TableCell className={`text-right tabular-nums ${
                  row.tasa_entrega < 0.6 ? "text-red-500 font-medium" : row.tasa_entrega >= 0.8 ? "text-emerald-600 font-medium" : ""
                }`}>{row.enviados > 0 ? pct(row.tasa_entrega) : "—"}</TableCell>
                <TableCell className={`text-right tabular-nums ${row.rechazados > 0 ? "text-red-500" : ""}`}>
                  {row.rechazados}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${
                  row.tasa_rechazo > 0.3 ? "text-red-600 font-medium" : row.tasa_rechazo > 0.2 ? "text-amber-600" : ""
                }`}>{row.enviados > 0 ? pct(row.tasa_rechazo) : "—"}</TableCell>
                <TableCell className={`text-right tabular-nums border-r border-border/40 ${row.pendientes > 0 ? "text-amber-600" : ""}`}>
                  {row.pendientes}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.ventas > 0 ? eur(row.ventas) : "—"}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${
                  row.neto > 0 ? "text-emerald-600" : row.neto < 0 ? "text-red-600" : "text-muted-foreground"
                }`}>
                  {row.ventas > 0 ? eur(row.neto) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.neto_por_unidad > 0 ? eur(row.neto_por_unidad) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
