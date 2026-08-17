"use client";

import { useState } from "react";
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { MonthlyRow } from "@/lib/queries/dashboard";

interface MonthlyChartProps {
  rows: MonthlyRow[];
}

type Metric = "ventas" | "enviados" | "gastos" | "pnl_real";

const metricConfig: Record<Metric, { label: string; color: string; format: (n: number) => string }> = {
  ventas:   { label: "Ventas",    color: "var(--chart-1)", format: (n) => `€${Math.round(n).toLocaleString("es-ES")}` },
  enviados: { label: "Enviados",  color: "var(--chart-2)", format: (n) => `${n}` },
  gastos:   { label: "Gastos",    color: "var(--chart-5)", format: (n) => `€${Math.round(n).toLocaleString("es-ES")}` },
  pnl_real: { label: "P&L Real",  color: "var(--chart-3)", format: (n) => `€${Math.round(n).toLocaleString("es-ES")}` },
};

const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function shortMonth(mes: string) {
  const [, m] = mes.split("-");
  return monthNames[parseInt(m) - 1];
}

export function MonthlyChart({ rows }: MonthlyChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [metric, setMetric] = useState<Metric>("ventas");

  const cfg = metricConfig[metric];

  const chartConfig = {
    value: { label: cfg.label, color: cfg.color },
  } satisfies ChartConfig;

  const chartData = rows.map((r) => ({
    mes: shortMonth(r.mes),
    value: metric === "enviados" ? r.enviados : r[metric],
    negative: metric === "pnl_real" && r.pnl_real < 0,
  }));

  return (
    <Card className="p-0 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Gráfico comparativo por mes
        </span>
        {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Metric selector */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {(Object.keys(metricConfig) as Metric[]).map((m) => (
              <Button
                key={m}
                variant={metric === m ? "default" : "outline"}
                size="sm"
                className="h-6 px-2.5 text-xs"
                onClick={() => setMetric(m)}
              >
                {metricConfig[m].label}
              </Button>
            ))}
          </div>

          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="mes"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(v) =>
                  metric === "enviados"
                    ? `${v}`
                    : `€${Math.abs(v) >= 1000 ? `${Math.round(Math.abs(v) / 1000)}k` : Math.round(v)}`
                }
                width={48}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => cfg.format(Number(value))}
                  />
                }
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.negative ? "var(--chart-5)" : cfg.color}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </Card>
  );
}
