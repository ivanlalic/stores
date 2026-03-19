"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ventas: {
    label: "Ventas",
    color: "var(--chart-1)",
  },
  gastos: {
    label: "Gastos",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

export function SalesChart({ rows }: SalesChartProps) {
  const [open, setOpen] = useState(false);

  const chartData = rows
    .filter((r) => r.pedidos > 0 || r.total_ads > 0)
    .map((r) => ({
      fecha: r.fecha.substring(5), // MM-DD
      ventas: Math.round(r.ventas),
      gastos: Math.round(r.gastos),
      pnl: Math.round(r.pnl_real),
    }));

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Evolución de Ventas</CardTitle>
            <CardDescription>
              Ventas vs Gastos diarios del mes
            </CardDescription>
          </div>
          <ChevronRight
            className={`size-5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          />
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="fecha"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  const [m, d] = value.split("-");
                  return `${d}/${m}`;
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `€${value}`}
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Area
                dataKey="ventas"
                type="monotone"
                fill="var(--color-ventas)"
                fillOpacity={0.2}
                stroke="var(--color-ventas)"
                strokeWidth={2}
              />
              <Area
                dataKey="gastos"
                type="monotone"
                fill="var(--color-gastos)"
                fillOpacity={0.1}
                stroke="var(--color-gastos)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      )}
    </Card>
  );
}
