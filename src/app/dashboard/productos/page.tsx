"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProductsTable } from "@/components/products-table";
import { SyncButton } from "@/components/sync-button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { CatalogTable, type CatalogRow } from "@/components/catalog-table";
import { Button } from "@/components/ui/button";
import { Package, RefreshCw } from "lucide-react";
import type { ProductoRow } from "@/lib/queries/dashboard";

function ProductosContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") || "";
  const [rows, setRows] = useState<ProductoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [catalogMsg, setCatalogMsg] = useState("");

  async function fetchData() {
    setLoading(true);
    try {
      const storeParam = storeId ? `&store_id=${storeId}` : "";
      const res = await fetch(`/api/dashboard?type=productos${storeParam}`);
      const data = await res.json();
      setRows(data.rows || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  async function fetchCatalog() {
    setCatalogLoading(true);
    try {
      const storeParam = storeId ? `?store_id=${storeId}` : "";
      const res = await fetch(`/api/dropea/products${storeParam}`);
      const data = await res.json();
      setCatalog(data.rows || []);
    } catch {
      // handle error
    } finally {
      setCatalogLoading(false);
    }
  }

  async function syncCatalog() {
    setSyncingCatalog(true);
    setCatalogMsg("Sincronizando catálogo...");
    try {
      const storeParam = storeId ? `?store_id=${storeId}` : "";
      const res = await fetch(`/api/dropea/products${storeParam}`, { method: "POST" });
      const data = await res.json();
      setCatalogMsg(data.message || data.error || "Sincronizado");
      await fetchCatalog();
    } catch {
      setCatalogMsg("Error sincronizando catálogo");
    } finally {
      setSyncingCatalog(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData();
    fetchCatalog();
  }, [storeId]);

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
        <SyncButton onComplete={fetchData} storeId={storeId || undefined} />
      </div>

      {loading ? (
        <LoadingSpinner text="Cargando productos..." />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <p className="text-sm">No hay datos.</p>
          <p className="text-xs">Sincroniza tus pedidos primero.</p>
        </div>
      ) : (
        <ProductsTable rows={rows} />
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold">Catálogo / Stock</h3>
          <p className="text-xs text-muted-foreground">
            Stock actual de productos desde Dropea (v2).
          </p>
        </div>
        <Button
          size="sm"
          onClick={syncCatalog}
          disabled={syncingCatalog}
          className="gap-1.5"
        >
          <RefreshCw className={`size-4 ${syncingCatalog ? "animate-spin" : ""}`} />
          {syncingCatalog ? "Sincronizando..." : "Sincronizar catálogo"}
        </Button>
      </div>
      {catalogMsg && <p className="text-xs text-muted-foreground">{catalogMsg}</p>}

      {catalogLoading ? (
        <LoadingSpinner text="Cargando catálogo..." />
      ) : catalog.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2 rounded-lg border border-border/60">
          <Package className="size-6 opacity-40" />
          <p className="text-sm">Catálogo vacío.</p>
          <p className="text-xs">Pulsa "Sincronizar catálogo" para traer el stock de Dropea.</p>
        </div>
      ) : (
        <CatalogTable rows={catalog} />
      )}
    </div>
  );
}

export default function ProductosPage() {
  return (
    <Suspense fallback={null}>
      <ProductosContent />
    </Suspense>
  );
}
