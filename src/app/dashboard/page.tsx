"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SyncButton } from "@/components/sync-button";
import { KpiCards, KpiCardsSecondary } from "@/components/kpi-cards";
import { BreakevenCards } from "@/components/breakeven-cards";
import { SalesChart } from "@/components/sales-chart";
import { DailyTable } from "@/components/daily-table";
import { AdsInputModal } from "@/components/ads-input-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, MousePointerClick } from "lucide-react";
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
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setMonth(prevMonth(month))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="text-xl font-semibold min-w-[170px] text-center tracking-tight">
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
        </div>
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
          {/* KPI Cards - primary metrics */}
          <KpiCards rows={rows} />

          {/* Break-even cards */}
          <BreakevenCards metrics={beMetrics} />

          {/* Chart */}
          <SalesChart rows={rows} />

          {/* Secondary KPIs + Table */}
          <Tabs defaultValue="detalle" className="space-y-4">
            <TabsList>
              <TabsTrigger value="detalle">Detalle Diario</TabsTrigger>
              <TabsTrigger value="costos">Costos & CPA</TabsTrigger>
            </TabsList>

            <TabsContent value="detalle" className="space-y-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MousePointerClick className="size-3.5" />
                <span>Click en una fila para editar los Ads de ese día</span>
              </div>
              <DailyTable rows={rows} onRowClick={handleRowClick} />
            </TabsContent>

            <TabsContent value="costos" className="space-y-4">
              <KpiCardsSecondary rows={rows} />
            </TabsContent>
          </Tabs>
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
