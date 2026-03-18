import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDailyDashboard, getMonthlyDashboard } from "@/lib/queries/dashboard";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "daily";
  const month = url.searchParams.get("month");

  // Get user config for fee
  const { data: config } = await supabase
    .from("users_config")
    .select("fee_gestion_eur")
    .eq("id", user.id)
    .single();

  const feeGestionEur = Number(config?.fee_gestion_eur) || 0;

  if (type === "monthly") {
    const rows = await getMonthlyDashboard(user.id, feeGestionEur);
    return NextResponse.json({ rows });
  }

  // Daily - default to current month
  const currentMonth =
    month ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const rows = await getDailyDashboard(user.id, currentMonth, feeGestionEur);
  return NextResponse.json({ rows, month: currentMonth });
}
