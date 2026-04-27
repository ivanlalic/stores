import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { getDailyDashboard, getMonthlyDashboard, getBreakevenMetrics, getProductosDashboard } from "@/lib/queries/dashboard";
import { getDefaultStore, requireStore } from "@/lib/store-utils";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "daily";
  const month = url.searchParams.get("month");
  const storeParam = url.searchParams.get("store_id");

  const insforge = createServiceClient();

  let store;
  if (storeParam) {
    try {
      store = await requireStore(insforge, storeParam, user.id);
    } catch {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
  } else {
    store = await getDefaultStore(insforge, user.id, "dropea");
  }

  if (!store) return NextResponse.json({ rows: [], breakevenConfig: { fee_gestion_eur: 0, costo_rechazo: 13.76, dias_rolling: 30, dias_excluir: 4 } });

  const breakevenConfig = {
    fee_gestion_eur: Number(store.fee_gestion_eur) || 0,
    costo_rechazo: Number(store.costo_rechazo) || 13.76,
    dias_rolling: Number(store.dias_rolling) || 30,
    dias_excluir: Number(store.dias_excluir) || 4,
  };

  if (type === "monthly") {
    const rows = await getMonthlyDashboard(insforge, store.id, breakevenConfig.fee_gestion_eur);
    return NextResponse.json({ rows, breakevenConfig });
  }

  if (type === "productos") {
    const rows = await getProductosDashboard(insforge, store.id);
    return NextResponse.json({ rows });
  }

  const currentMonth =
    month ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const rows = await getDailyDashboard(insforge, store.id, currentMonth, breakevenConfig.fee_gestion_eur);
  const breakevenMetrics = await getBreakevenMetrics(insforge, store.id, rows, breakevenConfig);
  return NextResponse.json({ rows, month: currentMonth, breakevenConfig, breakevenMetrics });
}
