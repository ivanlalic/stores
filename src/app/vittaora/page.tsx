"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropiAdsModal } from "@/components/dropi-ads-modal";
import type { DropiDailyRow } from "@/lib/queries/dropi-dashboard";

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

function MonthSelector({
  month,
  onChange,
}: {
  month: string;
  onChange: (m: string) => void;
}) {
  const prev = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const next = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const label = new Date(month + "-15").toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={prev}>←</Button>
      <span className="text-sm font-medium capitalize w-32 text-center">{label}</span>
      <Button variant="outline" size="sm" onClick={next}>→</Button>
    </div>
  );
}

function VittaoraContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") || "";

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<DropiDailyRow[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [storeName, setStoreName] = useState("Vittaora");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [adsModal, setAdsModal] = useState<{
    open: boolean;
    fecha: string;
    meta: number;
    tiktok: number;
  }>({ open: false, fecha: "", meta: 0, tiktok: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const storeParam = storeId ? `&store_id=${storeId}` : "";
      const res = await fetch(`/api/dropi/dashboard?month=${month}${storeParam}`);
      const data = await res.json();
      setRows(data.rows || []);
      if (data.storeName) setStoreName(data.storeName);
    } finally {
      setLoading(false);
    }
  }, [month, storeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const storeParam = storeId ? `?store_id=${storeId}` : "";
      const res = await fetch(`/api/dropi/sync${storeParam}`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncMsg(`Error: ${data.error}`);
      } else {
        setSyncMsg(`${data.total} pedidos importados`);
        await loadData();
      }
    } catch {
      setSyncMsg("Error de conexión");
    } finally {
      setSyncing(false);
    }
  }

  // Totals for KPI cards
  const totPedidos = rows.reduce((s, r) => s + r.pedidos, 0);
  const totEnviados = rows.reduce((s, r) => s + r.enviados, 0);
  const totEntregados = rows.reduce((s, r) => s + r.entregados, 0);
  const totRechazados = rows.reduce((s, r) => s + r.rechazados, 0);
  const totVentas = rows.reduce((s, r) => s + r.ventas, 0);
  const totBruto = rows.reduce((s, r) => s + r.bruto, 0);
  const totPnlTeorico = rows.reduce((s, r) => s + r.pnl_teorico, 0);
  const totPnlReal = rows.reduce((s, r) => s + r.pnl_real, 0);
  const totAds = rows.reduce((s, r) => s + r.total_ads, 0);
  const tasaEntrega = totEnviados > 0 ? totEntregados / totEnviados : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="size-8 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">{storeName} — Dashboard Diario</h2>
            <p className="text-xs text-muted-foreground">Dropi · Portugal</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <MonthSelector month={month} onChange={setMonth} />
          <Button
            onClick={handleSync}
            disabled={syncing}
            size="sm"
          >
            {syncing ? "Sincronizando..." : "Sincronizar Dropi"}
          </Button>
        </div>
      </div>

      {syncMsg && (
        <p className={`text-sm ${syncMsg.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
          {syncMsg}
        </p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">Pedidos</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold">{totPedidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">Enviados</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold">{totEnviados}</p>
            <p className="text-xs text-muted-foreground">{totRechazados} rechazados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">% Entregados</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold">{pct(tasaEntrega)}</p>
            <p className="text-xs text-muted-foreground">{totEntregados} entregados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">Ventas</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold">€{fmt(totVentas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">P&L Teórico</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className={`text-2xl font-bold ${totPnlTeorico >= 0 ? "text-green-600" : "text-destructive"}`}>
              €{fmt(totPnlTeorico)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">P&L Real</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className={`text-2xl font-bold ${totPnlReal >= 0 ? "text-green-600" : "text-destructive"}`}>
              €{fmt(totPnlReal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">Ads</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold">€{fmt(totAds)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium">Fecha</th>
              <th className="text-right px-3 py-2 font-medium">Pedidos</th>
              <th className="text-right px-3 py-2 font-medium">Enviados</th>
              <th className="text-right px-3 py-2 font-medium">%Enviados</th>
              <th className="text-right px-3 py-2 font-medium">Rechazados</th>
              <th className="text-right px-3 py-2 font-medium">Ventas</th>
              <th className="text-right px-3 py-2 font-medium">Bruto</th>
              <th className="text-right px-3 py-2 font-medium">Ads</th>
              <th className="text-right px-3 py-2 font-medium">P&L Teórico</th>
              <th className="text-right px-3 py-2 font-medium">P&L Real</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-muted-foreground">
                  Sin datos. Haz clic en &quot;Sincronizar Dropi&quot; para importar pedidos.
                </td>
              </tr>
            ) : (
              (showAll ? [...rows].reverse() : [...rows].reverse().slice(0, 5)).map((row) => {
                const displayDate = new Date(row.fecha + "T12:00:00").toLocaleDateString(
                  "es-ES",
                  { weekday: "short", day: "numeric", month: "short" }
                );
                const pctEnviados = row.pedidos > 0
                  ? Math.round(row.enviados / row.pedidos * 100) + "%"
                  : "—";
                return (
                  <tr
                    key={row.fecha}
                    className="border-b hover:bg-muted/30 cursor-pointer"
                    onClick={() =>
                      setAdsModal({
                        open: true,
                        fecha: row.fecha,
                        meta: row.meta_ads,
                        tiktok: row.tiktok_ads,
                      })
                    }
                  >
                    <td className="px-3 py-2 text-muted-foreground capitalize">{displayDate}</td>
                    <td className="px-3 py-2 text-right">{row.pedidos}</td>
                    <td className="px-3 py-2 text-right">{row.enviados}</td>
                    <td className="px-3 py-2 text-right">{pctEnviados}</td>
                    <td className="px-3 py-2 text-right text-destructive">{row.rechazados || ""}</td>
                    <td className="px-3 py-2 text-right">
                      {row.ventas > 0 ? `€${fmt(row.ventas)}` : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right ${row.bruto > 0 ? "text-green-600" : row.bruto < 0 ? "text-destructive" : ""}`}>
                      {row.ventas > 0 ? `€${fmt(row.bruto)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {row.total_ads > 0 ? `€${fmt(row.total_ads)}` : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${row.pnl_teorico > 0 ? "text-green-600" : row.pnl_teorico < 0 ? "text-destructive" : ""}`}>
                      {row.ventas > 0 || row.total_ads > 0
                        ? `€${fmt(row.pnl_teorico)}`
                        : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${row.pnl_real > 0 ? "text-green-600" : row.pnl_real < 0 ? "text-destructive" : ""}`}>
                      {row.ventas > 0 || row.total_ads > 0
                        ? `€${fmt(row.pnl_real)}`
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && !loading && (
            <tfoot>
              <tr className="border-t bg-muted/50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{totPedidos}</td>
                <td className="px-3 py-2 text-right">{totEnviados}</td>
                <td className="px-3 py-2 text-right">
                  {totPedidos > 0 ? Math.round(totEnviados / totPedidos * 100) + "%" : "—"}
                </td>
                <td className="px-3 py-2 text-right text-destructive">{totRechazados || ""}</td>
                <td className="px-3 py-2 text-right">€{fmt(totVentas)}</td>
                <td className={`px-3 py-2 text-right ${totBruto >= 0 ? "text-green-600" : "text-destructive"}`}>
                  €{fmt(totBruto)}
                </td>
                <td className="px-3 py-2 text-right">€{fmt(totAds)}</td>
                <td className={`px-3 py-2 text-right ${totPnlTeorico >= 0 ? "text-green-600" : "text-destructive"}`}>
                  €{fmt(totPnlTeorico)}
                </td>
                <td className={`px-3 py-2 text-right ${totPnlReal >= 0 ? "text-green-600" : "text-destructive"}`}>
                  €{fmt(totPnlReal)}
                </td>
              </tr>
            </tfoot>
          )}
          {rows.length > 5 && !loading && (
            <tfoot>
              <tr>
                <td colSpan={10} className="text-center py-1.5">
                  <button
                    onClick={() => setShowAll((s) => !s)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAll ? "▲ Ver menos" : `▼ Ver mes completo (${rows.length} días)`}
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <DropiAdsModal
        open={adsModal.open}
        onOpenChange={(open) => setAdsModal((s) => ({ ...s, open }))}
        fecha={adsModal.fecha}
        initialMetaAds={adsModal.meta}
        initialTiktokAds={adsModal.tiktok}
        onSave={loadData}
        storeId={storeId || undefined}
      />
    </div>
  );
}

export default function VittaoraPage() {
  return (
    <Suspense fallback={null}>
      <VittaoraContent />
    </Suspense>
  );
}
