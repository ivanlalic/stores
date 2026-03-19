import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDailyDashboard, getMonthlyDashboard, getBreakevenMetrics } from "@/lib/queries/dashboard";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "daily";
  const month = url.searchParams.get("month");

  // Get user config for fee and break-even params
  const { data: config } = await supabase
    .from("users_config")
    .select("fee_gestion_pct, costo_rechazo, dias_rolling, dias_excluir")
    .eq("id", user.id)
    .single();

  const feeGestionEur = Number(config?.fee_gestion_pct) || 0;
  const breakevenConfig = {
    fee_gestion_eur: feeGestionEur,
    costo_rechazo: Number(config?.costo_rechazo) || 13,
    dias_rolling: Number(config?.dias_rolling) || 30,
    dias_excluir: Number(config?.dias_excluir) || 4,
  };

  if (type === "monthly") {
    const rows = await getMonthlyDashboard(user.id, feeGestionEur);
    return NextResponse.json({ rows, breakevenConfig });
  }

  // Daily - default to current month
  const currentMonth =
    month ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const rows = await getDailyDashboard(user.id, currentMonth, feeGestionEur);
  const breakevenMetrics = await getBreakevenMetrics(user.id, rows, breakevenConfig);
  return NextResponse.json({ rows, month: currentMonth, breakevenConfig, breakevenMetrics });
}
