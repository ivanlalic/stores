"use client";

import { useState, useEffect } from "react";
import { ProductsTable } from "@/components/products-table";
import { SyncButton } from "@/components/sync-button";
import { Package } from "lucide-react";
import type { ProductoRow } from "@/lib/queries/dashboard";

export default function ProductosPage() {
  const [rows, setRows] = useState<ProductoRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard?type=productos");
      const data = await res.json();
      setRows(data.rows || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
            <Package className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Productos</h2>
            <p className="text-xs text-muted-foreground">
              Rendimiento por producto · {rows.length} productos · click en columna para ordenar
            </p>
          </div>
        </div>
        <SyncButton onComplete={fetchData} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Cargando productos...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <p className="text-sm">No hay datos.</p>
          <p className="text-xs">Sincroniza tus pedidos primero.</p>
        </div>
      ) : (
        <ProductsTable rows={rows} />
      )}
    </div>
  );
}
