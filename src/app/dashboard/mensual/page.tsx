"use client";

import { useState, useEffect } from "react";
import { MonthlyTable } from "@/components/monthly-table";
import { SyncButton } from "@/components/sync-button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
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
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Dashboard Mensual</h2>
            <p className="text-xs text-muted-foreground">Resumen acumulado por mes</p>
          </div>
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
          <p className="text-sm">No hay datos.</p>
          <p className="text-xs">Sincroniza tus pedidos primero.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-normal">
              P&L Ajustado = P&L Real - (Pendientes x €13)
            </Badge>
          </div>
          <MonthlyTable rows={rows} />
        </>
      )}
    </div>
  );
}
