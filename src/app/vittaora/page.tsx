"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    metaFee: number;
    tiktokFee: number;
  }>({ open: false, fecha: "", meta: 0, tiktok: 0, metaFee: 0, tiktokFee: 0 });

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
      <div className="flex items-center justify-between flex-wrap gap-3 relative">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="size-8 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">{storeName} — Dashboard Diario</h2>
            <p className="text-xs text-muted-foreground">Dropi · Portugal</p>
          </div>
        </div>

        {/* Center: Active Store Badge */}
        {storeName && (
          <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-2 px-3 py-1 bg-accent/40 rounded-full border border-border/80 shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span className="font-bold text-xs tracking-tight text-foreground">{storeName}</span>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase bg-background px-1.5 py-0.5 rounded border border-border/60">
              Dropi
            </span>
          </div>
        )}
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
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">%Enviados</TableHead>
              <TableHead className="text-right">Entregados</TableHead>
              <TableHead className="text-right">%Entregados</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Ads</TableHead>
              <TableHead className="text-right">P&L Teórico</TableHead>
              <TableHead className="text-right">P&L Real</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Sin datos. Haz clic en &quot;Sincronizar Dropi&quot; para importar pedidos.
                </TableCell>
              </TableRow>
            ) : (
              (showAll ? [...rows].reverse() : [...rows].reverse().slice(0, 5)).map((row) => {
                const displayDate = new Date(row.fecha + "T12:00:00").toLocaleDateString(
                  "es-ES",
                  { weekday: "short", day: "numeric", month: "short" }
                );
                const pctEnviados = row.pedidos > 0
                  ? Math.round(row.enviados / row.pedidos * 100) + "%"
                  : "—";
                const pctEntregados = row.enviados > 0
                  ? (row.tasa_entrega * 100).toFixed(1) + "%"
                  : "—";
                return (
                  <TableRow
                    key={row.fecha}
                    className="cursor-pointer"
                    onClick={() =>
                      setAdsModal({
                        open: true,
                        fecha: row.fecha,
                        meta: row.meta_ads,
                        tiktok: row.tiktok_ads,
                        metaFee: row.meta_agency_fee_pct,
                        tiktokFee: row.tiktok_agency_fee_pct,
                      })
                    }
                  >
                    <TableCell className="text-muted-foreground capitalize">{displayDate}</TableCell>
                    <TableCell className="text-right">{row.pedidos}</TableCell>
                    <TableCell className="text-right">{row.enviados}</TableCell>
                    <TableCell className="text-right">{pctEnviados}</TableCell>
                    <TableCell className="text-right">{row.entregados || ""}</TableCell>
                    <TableCell className={`text-right ${row.tasa_entrega < 0.6 ? "text-destructive" : row.tasa_entrega >= 0.8 ? "text-green-600" : ""}`}>{pctEntregados}</TableCell>
                    <TableCell className="text-right">
                      {row.ventas > 0 ? `€${fmt(row.ventas)}` : "—"}
                    </TableCell>
                    <TableCell className={`text-right ${row.bruto > 0 ? "text-green-600" : row.bruto < 0 ? "text-destructive" : ""}`}>
                      {row.ventas > 0 ? `€${fmt(row.bruto)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.total_ads > 0 ? `€${fmt(row.total_ads)}` : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${row.pnl_teorico > 0 ? "text-green-600" : row.pnl_teorico < 0 ? "text-destructive" : ""}`}>
                      {row.ventas > 0 || row.total_ads > 0
                        ? `€${fmt(row.pnl_teorico)}`
                        : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${row.pnl_real > 0 ? "text-green-600" : row.pnl_real < 0 ? "text-destructive" : ""}`}>
                      {row.ventas > 0 || row.total_ads > 0
                        ? `€${fmt(row.pnl_real)}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {rows.length > 0 && !loading && (
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totPedidos}</TableCell>
                <TableCell className="text-right">{totEnviados}</TableCell>
                <TableCell className="text-right">
                  {totPedidos > 0 ? Math.round(totEnviados / totPedidos * 100) + "%" : "—"}
                </TableCell>
                <TableCell className="text-right">{totEntregados || ""}</TableCell>
                <TableCell className={`text-right ${tasaEntrega < 0.6 ? "text-destructive" : tasaEntrega >= 0.8 ? "text-green-600" : ""}`}>
                  {totEnviados > 0 ? (tasaEntrega * 100).toFixed(1) + "%" : "—"}
                </TableCell>
                <TableCell className="text-right">€{fmt(totVentas)}</TableCell>
                <TableCell className={`text-right ${totBruto >= 0 ? "text-green-600" : "text-destructive"}`}>
                  €{fmt(totBruto)}
                </TableCell>
                <TableCell className="text-right">€{fmt(totAds)}</TableCell>
                <TableCell className={`text-right ${totPnlTeorico >= 0 ? "text-green-600" : "text-destructive"}`}>
                  €{fmt(totPnlTeorico)}
                </TableCell>
                <TableCell className={`text-right ${totPnlReal >= 0 ? "text-green-600" : "text-destructive"}`}>
                  €{fmt(totPnlReal)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
          {rows.length > 5 && !loading && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={11} className="text-center py-1.5">
                  <button
                    onClick={() => setShowAll((s) => !s)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAll ? "▲ Ver menos" : `▼ Ver mes completo (${rows.length} días)`}
                  </button>
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <DropiAdsModal
        open={adsModal.open}
        onOpenChange={(open) => setAdsModal((s) => ({ ...s, open }))}
        fecha={adsModal.fecha}
        initialMetaAds={adsModal.meta}
        initialTiktokAds={adsModal.tiktok}
        initialMetaFeePct={adsModal.metaFee}
        initialTiktokFeePct={adsModal.tiktokFee}
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
