"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SyncButton } from "@/components/sync-button";
import { VentasCard, PnlCard, TasaEntregaCard, GastosCard, CpaCard } from "@/components/kpi-cards";
import { EquilibrioCard } from "@/components/breakeven-cards";
import { ChartStrip } from "@/components/sales-chart";
import { DailyTable } from "@/components/daily-table";
import { AdsInputModal } from "@/components/ads-input-modal";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyRow, BreakevenMetrics } from "@/lib/queries/dashboard";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function prevMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") || "";

  const [month, setMonth] = useState(getCurrentMonth);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [beMetrics, setBeMetrics] = useState<BreakevenMetrics | null>(null);
  const [beConfig, setBeConfig] = useState<{ costo_rechazo: number; dias_rolling: number; ads_label_1: string; ads_label_2: string }>({ costo_rechazo: 13.76, dias_rolling: 30, ads_label_1: "Meta Ads", ads_label_2: "TikTok Ads" });
  const [loading, setLoading] = useState(true);

  const [wallet, setWallet] = useState<{
    balance: number;
    fondos_disponibles: number;
    total_pendientes: number;
    costo_rechazo: number;
    retirable: number;
  } | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const storeParam = storeId ? `?store_id=${storeId}` : "";
      const res = await fetch(`/api/dropea/wallet${storeParam}`);
      if (!res.ok) return;
      const d = await res.json();
      setWallet(d);
    } catch {
      // no-op
    } finally {
      setWalletLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const [adsModal, setAdsModal] = useState<{
    open: boolean;
    fecha: string;
    metaAds: number;
    tiktokAds: number;
    metaFee: number;
    tiktokFee: number;
  }>({ open: false, fecha: "", metaAds: 0, tiktokAds: 0, metaFee: 0, tiktokFee: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const storeParam = storeId ? `&store_id=${storeId}` : "";
      const res = await fetch(`/api/dashboard?type=daily&month=${month}${storeParam}`);
      const data = await res.json();
      setRows(data.rows || []);
      setBeMetrics(data.breakevenMetrics || null);
      if (data.breakevenConfig) setBeConfig(data.breakevenConfig);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [month, storeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleRowClick(fecha: string, metaAds: number, tiktokAds: number, metaFee: number, tiktokFee: number) {
    setAdsModal({ open: true, fecha, metaAds, tiktokAds, metaFee, tiktokFee });
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header bar */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="size-8 shrink-0" />
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setMonth(prevMonth(month))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="text-base sm:text-lg font-semibold min-w-[100px] sm:min-w-[130px] text-center tracking-tight">
          {monthLabel(month)}
        </h2>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setMonth(nextMonth(month))}
          disabled={month >= getCurrentMonth()}
        >
          <ChevronRight className="size-4" />
        </Button>
        <div className="flex-1" />
        <SyncButton onComplete={fetchData} storeId={storeId || undefined} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Cargando datos...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <p className="text-sm">No hay datos para este mes.</p>
          <p className="text-xs">Sincroniza tus pedidos primero.</p>
        </div>
      ) : (
        <>
          {/* All KPI cards — 5+2, single row on 2xl ultrawide */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <VentasCard rows={rows} />
            <PnlCard rows={rows} costoRechazo={beConfig.costo_rechazo} />
            <TasaEntregaCard rows={rows} />
            <EquilibrioCard metrics={beMetrics} diasRolling={beConfig.dias_rolling} />
            <GastosCard rows={rows} />
            <CpaCard rows={rows} />
            {wallet !== null && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs text-muted-foreground">Wallet</CardTitle>
                    <button
                      onClick={fetchWallet}
                      disabled={walletLoading}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCw className={`size-3 ${walletLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-2xl font-bold">
                    €{wallet.fondos_disponibles.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className={`text-xs font-medium ${wallet.retirable >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    Retirable: €{wallet.retirable.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {wallet.total_pendientes > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {wallet.total_pendientes} pend. × €{wallet.costo_rechazo}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chart strip — thin full-width trend, decoupled from grid */}
          <ChartStrip rows={rows} />

          {/* Table */}
          <DailyTable rows={rows} onRowClick={handleRowClick} />
        </>
      )}

      <AdsInputModal
        open={adsModal.open}
        onOpenChange={(open) => setAdsModal((m) => ({ ...m, open }))}
        fecha={adsModal.fecha}
        initialMetaAds={adsModal.metaAds}
        initialTiktokAds={adsModal.tiktokAds}
        initialMetaFeePct={adsModal.metaFee}
        initialTiktokFeePct={adsModal.tiktokFee}
        onSave={fetchData}
        storeId={storeId || undefined}
        label1={beConfig.ads_label_1}
        label2={beConfig.ads_label_2}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
