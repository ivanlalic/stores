"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Boxes,
  X,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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
  prevStock: number | null;
  variacion: number | null;
}

interface DiagSync {
  id: string;
  syncedAt: string;
  declaredTotal: number;
  actualSnapshotCount: number;
  zeroStockCount: number;
  discrepancy: number;
  isIncomplete: boolean;
  zeroStockRatio: number;
}

interface DiagData {
  storeId: string;
  storeName: string;
  totalSyncs: number;
  syncs: DiagSync[];
  latestCatalogSize: number | null;
  incompleteSymptoms: {
    syncId: string;
    syncedAt: string;
    declaredTotal: number;
    actualSnapshotCount: number;
    zeroStockCount: number;
    discrepancy: number;
    symptom: string;
    severity: string;
  }[];
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
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [hideInnovaGoods, setHideInnovaGoods] = useState(false);
  const [hideSinStock, setHideSinStock] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("variacion");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [diag, setDiag] = useState<DiagData | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);

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

  const loadDiag = useCallback(async () => {
    setDiagLoading(true);
    try {
      const res = await fetch(`/api/stock/diag${storeParam}`);
      const data = await res.json();
      if (!data.error) setDiag(data);
    } finally {
      setDiagLoading(false);
    }
  }, [storeParam]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    setSyncProgress("Iniciando...");
    let errorsDuringSync = 0;
    try {
      let startPage = 1;
      let syncId: string | undefined;
      let done = 0;
      let hasMore = true;

      while (hasMore) {
        const body: Record<string, unknown> = { startPage, done };
        if (syncId) body.syncId = syncId;

        const res = await fetch(`/api/stock${storeParam}`, {
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
        done = data.done;
        hasMore = data.hasMore;
        if (data.errors) errorsDuringSync += data.errors;

        const progressText = data.isIncomplete
          ? `Sincronizando... ${done} / ${data.total} productos (⚠️ incompleto)`
          : `Sincronizando... ${done} / ${data.total} productos`;
        setSyncProgress(progressText);
        startPage = data.nextPage;
      }

      const msg = errorsDuringSync > 0
        ? `${done} productos sincronizados con ${errorsDuringSync} errores de página`
        : `${done} productos sincronizados`;
      setSyncMsg(msg);
      await loadData();
      await loadDiag();
    } catch {
      setSyncMsg("Error de conexión");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }

  async function handleDeleteSync(syncId: string) {
    const res = await fetch(`/api/stock/syncs/${syncId}${storeParam}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      await loadData();
      await loadDiag();
    }
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

  const filtered = products.filter((p) => {
    if (hideInnovaGoods && p.name.toLowerCase().includes("innovagoods")) return false;
    if (hideSinStock && p.stock === 0) return false;
    return p.name.toLowerCase().includes(filter.toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortKey === "name") {
      diff = a.name.localeCompare(b.name);
    } else if (sortKey === "stock") {
      diff = a.stock - b.stock;
    } else {
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
        className="text-right px-2 py-1.5 font-medium cursor-pointer select-none hover:text-foreground"
        onClick={() => toggleSort(k)}
      >
        <span className="inline-flex items-center gap-1 justify-end">
          {label}
          <ArrowUpDown className={`size-3 ${active ? "text-foreground" : "text-muted-foreground/40"}`} />
        </span>
      </th>
    );
  }

  const latestSyncDate = syncs[0]?.synced_at ? fmtDate(syncs[0].synced_at) : "";
  const prevSyncDate = syncs[1]?.synced_at ? fmtDate(syncs[1].synced_at) : "";

  const latestSyncIncomplete = diag?.incompleteSymptoms.some(
    (s) => s.syncId === syncs[0]?.id
  );

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
                {syncs[0] ? ` · ${fmtDate(syncs[0].synced_at)}` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setShowDiag((v) => !v); if (!diag) loadDiag(); }}
            disabled={diagLoading}
          >
            <BarChart3 className="size-4 mr-1" />
            Diagnóstico
            {diagLoading && <span className="ml-1 size-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" />}
          </Button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideSinStock}
              onChange={(e) => setHideSinStock(e.target.checked)}
              className="rounded"
            />
            Ocultar sin stock
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideInnovaGoods}
              onChange={(e) => setHideInnovaGoods(e.target.checked)}
              className="rounded"
            />
            Ocultar InnovaGoods
          </label>
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

      {/* Incomplete sync warning */}
      {latestSyncIncomplete && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">La última sincronización parece incompleta</p>
            <p className="text-xs opacity-80">
              El número de productos guardados es menor al total declarado por Dropea.
              Haz clic en <strong>Sincronizar</strong> para reintentar.
            </p>
          </div>
        </div>
      )}

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

      {/* Diagnosis panel */}
      {showDiag && diag && (
        <div className="rounded-md border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <BarChart3 className="size-4" />
              Diagnóstico de sincronizaciones
            </h3>
            <span className="text-xs text-muted-foreground">
              {diag.totalSyncs} syncs en total
            </span>
          </div>

          {diag.incompleteSymptoms.length > 0 && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                <AlertTriangle className="size-4" />
                {diag.incompleteSymptoms.length} sync{diag.incompleteSymptoms.length > 1 ? "s" : ""} con problemas detectados
              </p>
              <div className="space-y-1.5">
                {diag.incompleteSymptoms.map((sym) => (
                  <div key={sym.syncId} className="text-xs flex items-center gap-2">
                    <span className={`inline-block size-2 rounded-full ${sym.severity === "high" ? "bg-destructive" : sym.severity === "medium" ? "bg-amber-500" : "bg-yellow-400"}`} />
                    <span className="text-muted-foreground">{fmtDate(sym.syncedAt)}</span>
                    <span className="font-mono">{sym.actualSnapshotCount}/{sym.declaredTotal}</span>
                    <span className="text-destructive">-{sym.discrepancy} prod</span>
                    <span className="text-muted-foreground">({sym.symptom})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-2 py-1.5 font-medium">Fecha</th>
                  <th className="text-right px-2 py-1.5 font-medium">Declarado</th>
                  <th className="text-right px-2 py-1.5 font-medium">Guardado</th>
                  <th className="text-right px-2 py-1.5 font-medium">Sin stock</th>
                  <th className="text-right px-2 py-1.5 font-medium">Diferencia</th>
                  <th className="text-center px-2 py-1.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {diag.syncs.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-2 py-1.5">{fmtDate(s.syncedAt)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{s.declaredTotal}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{s.actualSnapshotCount}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {s.zeroStockCount}
                      <span className="text-muted-foreground ml-1">({Math.round(s.zeroStockRatio * 100)}%)</span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {s.discrepancy > 0 ? (
                        <span className="text-destructive">-{s.discrepancy}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {s.isIncomplete ? (
                        <AlertTriangle className="size-4 text-destructive mx-auto" />
                      ) : (
                        <CheckCircle2 className="size-4 text-green-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
                  className="text-left px-2 py-1.5 font-medium cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("name")}
                >
                  <span className="inline-flex items-center gap-1">
                    Producto
                    <ArrowUpDown className={`size-3 ${sortKey === "name" ? "text-foreground" : "text-muted-foreground/40"}`} />
                  </span>
                </th>
                <th className="text-left px-2 py-1.5 font-medium">SKU</th>
                <th className="text-center px-2 py-1.5 font-medium">Img</th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground text-[10px] leading-tight">
                  Ant.<br/>{prevSyncDate}
                </th>
                <ColHeader label={`Stock ${latestSyncDate}`} k="stock" />
                <ColHeader label="Var" k="variacion" />
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
                    <span className="ml-1 inline-flex items-center rounded px-1 py-0 text-[10px] font-medium bg-destructive/10 text-destructive">
                      0
                    </span>
                  ) : p.stock < 10 ? (
                    <span className="ml-1 inline-flex items-center rounded px-1 py-0 text-[10px] font-medium bg-amber-500/10 text-amber-600">
                      !
                    </span>
                  ) : null;

                return (
                  <tr key={p.dropea_id} className="border-b hover:bg-muted/30">
                    <td className="px-2 py-1 max-w-[260px] truncate text-xs leading-tight">{p.name}</td>
                    <td className="px-2 py-1 text-muted-foreground font-mono text-[10px]">{p.sku || "—"}</td>
                    <td className="px-2 py-1 text-center">
                      {p.image ? (
                        <img
                          src={`/api/proxy-image?url=${encodeURIComponent(p.image)}&store_id=${storeId}`}
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
                      {p.stock.toLocaleString("es-ES")}
                      {stockBadge}
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

export default function StockPage() {
  return (
    <Suspense fallback={null}>
      <StockContent />
    </Suspense>
  );
}
