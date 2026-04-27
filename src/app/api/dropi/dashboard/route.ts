import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { getDropiDailyDashboard } from "@/lib/queries/dropi-dashboard";
import { getDefaultStore, requireStore } from "@/lib/store-utils";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const storeParam = searchParams.get("store_id");

  const insforge = createServiceClient();

  let store;
  if (storeParam) {
    try {
      store = await requireStore(insforge, storeParam, user.id);
    } catch {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
  } else {
    store = await getDefaultStore(insforge, user.id, "dropi");
  }

  if (!store) return NextResponse.json({ rows: [] });

  const rows = await getDropiDailyDashboard(insforge, store.id, month);

  return NextResponse.json({ rows, storeName: store.name });
}
