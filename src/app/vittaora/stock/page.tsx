"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Boxes, ArrowUpDown } from "lucide-react";

interface SyncMeta { id: string; synced_at: string; total: number; }
interface ProductRow {
  dropi_id: string;
  name: string;
  image: string | null;
  stock: number;
  prevStock: number | null;
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
    " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function StockContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") || "";
  const storeParam = storeId ? `?store_id=${storeId}` : "";

  const [syncs, setSyncs] = useState<SyncMeta[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState("");
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("variacion");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dropi-stock${storeParam}`);
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
    setSyncProgress("Iniciando...");
    try {
      let page = 1;
      let syncId: string | undefined;
      let sessionCookies: string | undefined;
      let done = 0;
      let hasMore = true;

      while (hasMore) {
        const body: Record<string, unknown> = { page, done };
        if (syncId) body.syncId = syncId;
        if (sessionCookies) body.sessionCookies = sessionCookies;

        const res = await fetch(`/api/dropi-stock${storeParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setSyncMsg(`Error: ${data.error || res.statusText}`);
          return;
        }

        const data = await res.json();
        if (data.error) { setSyncMsg(`Error: ${data.error}`); return; }

        syncId = data.syncId;
        sessionCookies = data.sessionCookies;
        done = data.done;
        hasMore = data.hasMore;
        page = data.nextPage;
        setSyncProgress(`Sincronizando... ${done} productos (pág. ${page - 1})`);
      }

      setSyncMsg(`${done} productos sincronizados`);
      await loadData();
    } catch {
      setSyncMsg("Error de conexión");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "variacion" ? "asc" : "desc"); }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortKey === "name") diff = a.name.localeCompare(b.name);
    else if (sortKey === "stock") diff = a.stock - b.stock;
    else {
      if (a.variacion === null && b.variacion === null) diff = 0;
      else if (a.variacion === null) diff = 1;
      else if (b.variacion === null) diff = -1;
      else diff = a.variacion - b.variacion;
    }
    return sortDir === "asc" ? diff : -diff;
  });

  const latestSyncDate = syncs[0]?.synced_at ? fmtDate(syncs[0].synced_at) : "";
  const prevSyncDate = syncs[1]?.synced_at ? fmtDate(syncs[1].synced_at) : "";

  function ColHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <th className="text-right px-2 py-1.5 font-medium cursor-pointer select-none hover:text-foreground"
        onClick={() => toggleSort(k)}>
        <span className="inline-flex items-center gap-1 justify-end">
          {label}
          <ArrowUpDown className={`size-3 ${sortKey === k ? "text-foreground" : "text-muted-foreground/40"}`} />
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
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
                {products.length} productos{syncs[0] ? ` · ${fmtDate(syncs[0].synced_at)}` : ""}
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

      {syncProgress && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <span className="inline-block size-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          {syncProgress}
        </p>
      )}
      {syncMsg && !syncProgress && (
        <p className={`text-sm ${syncMsg.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
          {syncMsg}
        </p>
      )}

      {loading ? (
        <LoadingSpinner text="Cargando stock..." />
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <p className="text-sm">No hay datos.</p>
          <p className="text-xs">Haz clic en "Sincronizar" para importar el catálogo.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-2 py-1.5 font-medium cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("name")}>
                  <span className="inline-flex items-center gap-1">
                    Producto
                    <ArrowUpDown className={`size-3 ${sortKey === "name" ? "text-foreground" : "text-muted-foreground/40"}`} />
                  </span>
                </th>
                <th className="text-center px-2 py-1.5 font-medium">Img</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground text-[10px] leading-tight">
                  Ant.<br />{prevSyncDate}
                </th>
                <ColHeader label={`Stock ${latestSyncDate}`} k="stock" />
                <ColHeader label="Var" k="variacion" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const varColor =
                  p.variacion === null ? "text-muted-foreground"
                  : p.variacion < 0 ? "text-destructive font-medium"
                  : p.variacion > 0 ? "text-green-600 font-medium"
                  : "text-muted-foreground";
                const stockBadge =
                  p.stock === 0 ? <span className="ml-1 inline-flex items-center rounded px-1 py-0 text-[10px] font-medium bg-destructive/10 text-destructive">0</span>
                  : p.stock < 10 ? <span className="ml-1 inline-flex items-center rounded px-1 py-0 text-[10px] font-medium bg-amber-500/10 text-amber-600">!</span>
                  : null;

                return (
                  <tr key={p.dropi_id} className="border-b hover:bg-muted/30">
                    <td className="px-2 py-1 max-w-[280px] truncate text-xs leading-tight">{p.name}</td>
                    <td className="px-2 py-1 text-center">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className="size-8 object-contain rounded mx-auto"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="size-8 bg-muted rounded mx-auto" />
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-xs tabular-nums text-muted-foreground">
                      {p.prevStock !== null ? p.prevStock.toLocaleString("es-ES") : "—"}
                    </td>
                    <td className="px-2 py-1 text-right text-xs tabular-nums font-medium">
                      {p.stock.toLocaleString("es-ES")}{stockBadge}
                    </td>
                    <td className={`px-2 py-1 text-right text-xs tabular-nums ${varColor}`}>
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

export default function VittaoraStockPage() {
  return (
    <Suspense fallback={null}>
      <StockContent />
    </Suspense>
  );
}
