"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SyncButton } from "@/components/sync-button";
import { VentasCard, PnlCard, TasaEntregaCard, KpiCardsSecondary } from "@/components/kpi-cards";
import { PuntoEquilibrioCard, EstadoDiarioCard } from "@/components/breakeven-cards";
import { MiniSalesChart } from "@/components/sales-chart";
import { DailyTable } from "@/components/daily-table";
import { AdsInputModal } from "@/components/ads-input-modal";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

export default function DashboardPage() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [beMetrics, setBeMetrics] = useState<BreakevenMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const [adsModal, setAdsModal] = useState<{
    open: boolean;
    fecha: string;
    metaAds: number;
    tiktokAds: number;
  }>({ open: false, fecha: "", metaAds: 0, tiktokAds: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?type=daily&month=${month}`);
      const data = await res.json();
      setRows(data.rows || []);
      setBeMetrics(data.breakevenMetrics || null);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleRowClick(fecha: string, metaAds: number, tiktokAds: number) {
    setAdsModal({ open: true, fecha, metaAds, tiktokAds });
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
        <h2 className="text-base sm:text-lg font-semibold min-w-[140px] sm:min-w-[160px] text-center tracking-tight">
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
        <SyncButton onComplete={fetchData} />
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
          {/* KPI Row 1 — 5 primary cards */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <VentasCard rows={rows} />
            <PnlCard rows={rows} />
            <TasaEntregaCard rows={rows} />
            <PuntoEquilibrioCard metrics={beMetrics} />
            <EstadoDiarioCard metrics={beMetrics} />
          </div>

          {/* KPI Row 2 — secondary metrics + mini chart */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch">
            <div className="flex-1 min-w-0">
              <KpiCardsSecondary rows={rows} />
            </div>
            <div className="w-full lg:w-[280px] shrink-0">
              <MiniSalesChart rows={rows} />
            </div>
          </div>

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
        onSave={fetchData}
      />
    </div>
  );
}
