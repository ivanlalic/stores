"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, RefreshCw } from "lucide-react";

export interface CatalogRow {
  id: string;
  dropea_product_id: number;
  dropea_variant_id: number;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  price: number | string;
  stock: number;
  product_status: string;
  synced_at: string;
}

function eur(n: number | string) {
  const num = typeof n === "string" ? parseFloat(n) : n;
  return num.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CatalogTable({ rows }: { rows: CatalogRow[] }) {
  const [showAll, setShowAll] = useState(false);

  const displayRows = showAll ? rows : rows.slice(0, 20);

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="size-4 text-primary" />
          Stock / Catálogo
        </CardTitle>
        <span className="text-xs text-muted-foreground">{rows.length} productos</span>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="[&_td]:py-1.5 [&_td]:px-2 [&_th]:px-2 text-xs">
            <TableHeader>
              <TableRow className="bg-muted/80">
                <TableHead className="text-left">Producto</TableHead>
                <TableHead className="text-left">Variante</TableHead>
                <TableHead className="text-right">SKU</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row) => (
                <TableRow key={row.id || row.dropea_variant_id} className="hover:bg-primary/5">
                  <TableCell className="font-medium max-w-[260px] truncate">
                    {row.product_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[140px] truncate">
                    {row.variant_name || "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.sku || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{eur(row.price)}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${
                      row.stock === 0
                        ? "text-red-600"
                        : row.stock <= 10
                          ? "text-amber-600"
                          : "text-emerald-600"
                    }`}
                  >
                    {row.stock}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground capitalize">
                    {row.product_status.toLowerCase()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {rows.length > 20 && (
          <div className="py-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll ? "▲ Ver menos" : `▼ Ver todos (${rows.length})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
