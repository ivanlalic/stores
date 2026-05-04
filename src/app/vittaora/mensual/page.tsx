"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MonthlyTable } from "@/components/monthly-table";
import { MonthlyChart } from "@/components/monthly-chart";
import { ExportMonthlyButton } from "@/components/export-monthly-button";
import { CalendarDays } from "lucide-react";
import type { MonthlyRow } from "@/lib/queries/dashboard";

function MensualContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") || "";
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const storeParam = storeId ? `&store_id=${storeId}` : "";
      const res = await fetch(`/api/dropi/dashboard?type=monthly${storeParam}`);
      const data = await res.json();
      setRows(data.rows || []);
      setStoreName(data.storeName || "");
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Dashboard Mensual</h2>
            <p className="text-xs text-muted-foreground">Resumen acumulado por mes</p>
          </div>
        </div>
        <ExportMonthlyButton rows={rows} storeName={storeName} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Cargando datos...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <p className="text-sm">No hay datos.</p>
          <p className="text-xs">Sincroniza tus pedidos primero.</p>
        </div>
      ) : (
        <>
          <MonthlyChart rows={rows} />
          <MonthlyTable rows={rows} />
        </>
      )}
    </div>
  );
}

export default function MensualPage() {
  return (
    <Suspense fallback={null}>
      <MensualContent />
    </Suspense>
  );
}
