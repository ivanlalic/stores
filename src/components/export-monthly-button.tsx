"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportMonthlyToExcel } from "@/lib/export-monthly";
import type { MonthlyRow } from "@/lib/queries/dashboard";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function monthLabel(mes: string) {
  const [y, m] = mes.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

interface ExportMonthlyButtonProps {
  rows: MonthlyRow[];
  storeName: string;
}

export function ExportMonthlyButton({ rows, storeName }: ExportMonthlyButtonProps) {
  const [selected, setSelected] = useState("all");

  if (rows.length === 0) return null;

  function handleExport() {
    if (selected === "all") {
      exportMonthlyToExcel(rows, storeName, "todos");
    } else {
      const row = rows.find((r) => r.mes === selected);
      if (row) exportMonthlyToExcel([row], storeName, selected);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="all">Todos los meses</option>
        {rows.map((r) => (
          <option key={r.mes} value={r.mes}>
            {monthLabel(r.mes)}
          </option>
        ))}
      </select>
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="size-4 mr-1.5" />
        Exportar
      </Button>
    </div>
  );
}
