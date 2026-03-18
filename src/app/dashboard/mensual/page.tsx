"use client";

import { useState, useEffect } from "react";
import { MonthlyTable } from "@/components/monthly-table";
import { SyncButton } from "@/components/sync-button";
import type { MonthlyRow } from "@/lib/queries/dashboard";

export default function MensualPage() {
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard?type=monthly");
      const data = await res.json();
      setRows(data.rows || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dashboard Mensual</h2>
        <SyncButton onComplete={fetchData} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Cargando datos...
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No hay datos. Sincroniza tus pedidos primero.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            P&L Ajustado = P&L Real - (Pendientes x Costo promedio rechazo del mes)
          </p>
          <MonthlyTable rows={rows} />
        </>
      )}
    </div>
  );
}
