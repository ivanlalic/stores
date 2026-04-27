"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Boxes, X, ArrowUpDown } from "lucide-react";

interface SyncMeta {
  id: string;
  synced_at: string;
  total: number;
}

interface ProductStockRow {
  dropea_id: string;
  sku: string | null;
  name: string;
  image: string | null;
  stock: number;
  variacion: number | null;
}

type SortKey = "name" | "stock" | "variacion";
type SortDir = "asc" | "desc";

function fmt(n: number | null) {
  if (n === null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function StockContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") || "";

  const [syncs, setSyncs] = useState<SyncMeta[]>([]);
  const [products, setProducts] = useState<ProductStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("variacion");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const storeParam = storeId ? `?store_id=${storeId}` : "";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock${storeParam}`);
      const data = await res.json();
      setSyncs(data.syncs || []);
      setProducts(data.products || []);
    } finally {
      setLoading(false);
    }
  }, [storeParam]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch(`/api/stock${storeParam}`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncMsg(`Error: ${data.error}`);
      } else {
        setSyncMsg(`${data.total} productos sincronizados`);
        await loadData();
      }
    } catch {
      setSyncMsg("Error de conexión");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteSync(syncId: string) {
    const res = await fetch(`/api/stock/syncs/${syncId}${storeParam}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) await loadData();
    else setSyncMsg(`Error: ${data.error}`);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "variacion" ? "asc" : "desc");
    }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortKey === "name") {
      diff = a.name.localeCompare(b.name);
    } else if (sortKey === "stock") {
      diff = a.stock - b.stock;
    } else {
      // variacion: null goes last
      if (a.variacion === null && b.variacion === null) diff = 0;
      else if (a.variacion === null) diff = 1;
      else if (b.variacion === null) diff = -1;
      else diff = a.variacion - b.variacion;
    }
    return sortDir === "asc" ? diff : -diff;
  });

  function ColHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <th
        className="text-right px-3 py-2 font-medium cursor-pointer select-none hover:text-foreground"
        onClick={() => toggleSort(k)}
      >
        <span className="inline-flex items-center gap-1 justify-end">
          {label}
          <ArrowUpDown className={`size-3 ${active ? "text-foreground" : "text-muted-foreground/40"}`} />
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="size-8 shrink-0" />
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
              <Boxes className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Stock · Catálogo</h2>
              <p className="text-xs text-muted-foreground">
                {products.length} productos
                {syncs[0] ? ` · última sync: ${fmtDate(syncs[0].synced_at)}` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Filtrar productos..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 w-48 text-sm"
          />
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>
      </div>

      {syncMsg && (
        <p className={`text-sm ${syncMsg.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
          {syncMsg}
        </p>
      )}

      {/* Sync history pills */}
      {syncs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Syncs guardadas:</span>
          {syncs.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              <span>{fmtDate(s.synced_at)} · {s.total} prod</span>
              <button
                onClick={() => handleDeleteSync(s.id)}
                disabled={syncs.length <= 1}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={syncs.length <= 1 ? "No se puede borrar la única sync" : "Borrar esta sync"}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Cargando stock...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <p className="text-sm">No hay datos.</p>
          <p className="text-xs">Haz clic en &quot;Sincronizar&quot; para importar el catálogo.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th
                  className="text-left px-3 py-2 font-medium cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("name")}
                >
                  <span className="inline-flex items-center gap-1">
                    Producto
                    <ArrowUpDown className={`size-3 ${sortKey === "name" ? "text-foreground" : "text-muted-foreground/40"}`} />
                  </span>
                </th>
                <th className="text-left px-3 py-2 font-medium">SKU</th>
                <th className="text-left px-3 py-2 font-medium">Imagen</th>
                <ColHeader label="Stock" k="stock" />
                <ColHeader label="Variación" k="variacion" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const varColor =
                  p.variacion === null
                    ? "text-muted-foreground"
                    : p.variacion < 0
                    ? "text-destructive font-medium"
                    : p.variacion > 0
                    ? "text-green-600 font-medium"
                    : "text-muted-foreground";

                const stockBadge =
                  p.stock === 0 ? (
                    <span className="ml-1 inline-flex items-center rounded px-1 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                      Sin stock
                    </span>
                  ) : p.stock < 10 ? (
                    <span className="ml-1 inline-flex items-center rounded px-1 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-600">
                      Poco
                    </span>
                  ) : null;

                return (
                  <tr key={p.dropea_id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 max-w-[280px] truncate">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{p.sku || "—"}</td>
                    <td className="px-3 py-2">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="size-12 object-contain rounded" />
                      ) : (
                        <div className="size-12 bg-muted rounded" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.stock}
                      {stockBadge}
                    </td>
                    <td className={`px-3 py-2 text-right ${varColor}`}>
                      {fmt(p.variacion)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && filter && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sin resultados para &quot;{filter}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={null}>
      <StockContent />
    </Suspense>
  );
}
