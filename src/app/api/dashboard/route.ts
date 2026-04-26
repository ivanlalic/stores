import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { getDailyDashboard, getMonthlyDashboard, getBreakevenMetrics, getProductosDashboard } from "@/lib/queries/dashboard";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "daily";
  const month = url.searchParams.get("month");

  const insforge = createServiceClient();

  const { data: config } = await insforge.database
    .from("users_config")
    .select("fee_gestion_eur, costo_rechazo, dias_rolling, dias_excluir")
    .eq("id", user.id)
    .maybeSingle();

  const feeGestionEur = Number(config?.fee_gestion_eur) || 0;
  const breakevenConfig = {
    fee_gestion_eur: feeGestionEur,
    costo_rechazo: Number(config?.costo_rechazo) || 13,
    dias_rolling: Number(config?.dias_rolling) || 30,
    dias_excluir: Number(config?.dias_excluir) || 4,
  };

  if (type === "monthly") {
    const rows = await getMonthlyDashboard(insforge, user.id, feeGestionEur);
    return NextResponse.json({ rows, breakevenConfig });
  }

  if (type === "productos") {
    const rows = await getProductosDashboard(insforge, user.id);
    return NextResponse.json({ rows });
  }

  const currentMonth =
    month ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const rows = await getDailyDashboard(insforge, user.id, currentMonth, feeGestionEur);
  const breakevenMetrics = await getBreakevenMetrics(insforge, user.id, rows, breakevenConfig);
  return NextResponse.json({ rows, month: currentMonth, breakevenConfig, breakevenMetrics });
}
