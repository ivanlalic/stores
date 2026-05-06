import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { getDefaultStore, requireStore } from "@/lib/store-utils";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const storeParam = searchParams.get("store_id");
  const startDate = `${month}-01`;
  const [year, m] = month.split("-").map(Number);
  const endDate = new Date(year, m, 0).toISOString().split("T")[0];

  const insforge = createServiceClient();

  let storeId: string;
  if (storeParam) {
    try {
      const s = await requireStore(insforge, storeParam, user.id);
      storeId = s.id;
    } catch {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
  } else {
    const s = await getDefaultStore(insforge, user.id, "dropi");
    if (!s) return NextResponse.json({ ads: [] });
    storeId = s.id;
  }

  const { data } = await insforge.database
    .from("dropi_ads_diario")
    .select("*")
    .eq("store_id", storeId)
    .gte("fecha", startDate)
    .lte("fecha", endDate);

  return NextResponse.json({ ads: data || [] });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { fecha, meta_ads, tiktok_ads, meta_agency_fee_pct, tiktok_agency_fee_pct, store_id: storeParam } = body;

  if (!fecha) return NextResponse.json({ error: "Missing fecha" }, { status: 400 });

  const insforge = createServiceClient();

  let storeId: string;
  if (storeParam) {
    try {
      const s = await requireStore(insforge, storeParam, user.id);
      storeId = s.id;
    } catch {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
  } else {
    const s = await getDefaultStore(insforge, user.id, "dropi");
    if (!s) return NextResponse.json({ error: "No dropi store found" }, { status: 400 });
    storeId = s.id;
  }

  const { error } = await insforge.database.from("dropi_ads_diario").upsert(
    {
      store_id: storeId,
      user_id: user.id,
      fecha,
      meta_ads: meta_ads ?? 0,
      tiktok_ads: tiktok_ads ?? 0,
      meta_agency_fee_pct: meta_agency_fee_pct ?? 0,
      tiktok_agency_fee_pct: tiktok_agency_fee_pct ?? 0,
    },
    { onConflict: "store_id,fecha" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
