"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SyncButton } from "@/components/sync-button";
import { KpiCards } from "@/components/kpi-cards";
import { DailyTable } from "@/components/daily-table";
import { AdsInputModal } from "@/components/ads-input-modal";
import type { DailyRow } from "@/lib/queries/dashboard";

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
  const [loading, setLoading] = useState(true);

  // Ads modal state
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth(prevMonth(month))}>
            &lt;
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {monthLabel(month)}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(nextMonth(month))}
            disabled={month >= getCurrentMonth()}
          >
            &gt;
          </Button>
        </div>
        <SyncButton onComplete={fetchData} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Cargando datos...
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No hay datos para este mes. Sincroniza tus pedidos primero.
        </div>
      ) : (
        <>
          <KpiCards rows={rows} />
          <p className="text-xs text-muted-foreground">
            Click en una fila para editar los Ads de ese dia
          </p>
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
