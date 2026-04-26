"use client";

import { Area, AreaChart, XAxis } from "recharts";
import { Card } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DailyRow } from "@/lib/queries/dashboard";

interface SalesChartProps {
  rows: DailyRow[];
}

const chartConfig = {
  ventas: { label: "Ventas", color: "var(--chart-1)" },
  gastos: { label: "Gastos", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function MiniSalesChart({ rows }: SalesChartProps) {
  const chartData = rows
    .filter((r) => r.pedidos > 0 || r.total_ads > 0)
    .map((r) => ({
      dia: r.fecha.slice(8), // DD
      ventas: Math.round(r.ventas),
      gastos: Math.round(r.gastos),
    }));

  return (
    <Card className="h-full flex flex-col p-2 gap-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
        Tendencia del mes
      </p>
      <ChartContainer config={chartConfig} className="flex-1 w-full min-h-0">
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="dia"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
            interval="preserveStartEnd"
          />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <Area
            dataKey="ventas"
            type="monotone"
            fill="var(--color-ventas)"
            fillOpacity={0.2}
            stroke="var(--color-ventas)"
            strokeWidth={1.5}
          />
          <Area
            dataKey="gastos"
            type="monotone"
            fill="var(--color-gastos)"
            fillOpacity={0.1}
            stroke="var(--color-gastos)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ChartContainer>
    </Card>
  );
}

export { MiniSalesChart as SalesChart };

export function ChartStrip({ rows }: SalesChartProps) {
  const chartData = rows
    .filter((r) => r.pedidos > 0 || r.total_ads > 0)
    .map((r) => ({
      dia: r.fecha.slice(8),
      ventas: Math.round(r.ventas),
      gastos: Math.round(r.gastos),
    }));

  return (
    <div className="h-[70px] w-full overflow-hidden rounded-lg">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <Area
            dataKey="ventas"
            type="monotone"
            fill="var(--color-ventas)"
            fillOpacity={0.18}
            stroke="var(--color-ventas)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="gastos"
            type="monotone"
            fill="var(--color-gastos)"
            fillOpacity={0.1}
            stroke="var(--color-gastos)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
