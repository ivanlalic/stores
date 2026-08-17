import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { getDefaultStore, requireStore } from "@/lib/store-utils";
import type { AdChannel } from "@/lib/ads";
import { channelTotal } from "@/lib/ads";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const storeParam = url.searchParams.get("store_id");

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
    const s = await getDefaultStore(insforge, user.id, "dropea");
    if (!s) return NextResponse.json({ ads: [] });
    storeId = s.id;
  }

  let query = insforge.database
    .from("ads_diario")
    .select("*")
    .eq("store_id", storeId)
    .order("fecha", { ascending: false });

  if (month) {
    const startDate = `${month}-01`;
    const [year, m] = month.split("-").map(Number);
    const endDate = new Date(year, m, 0).toISOString().split("T")[0];
    query = query.gte("fecha", startDate).lte("fecha", endDate);
  } else {
    query = query.limit(7);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ads: data });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { fecha, channels, store_id: storeParam } = body;

  if (!fecha) {
    return NextResponse.json({ error: "fecha is required" }, { status: 400 });
  }

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
    const s = await getDefaultStore(insforge, user.id, "dropea");
    if (!s) return NextResponse.json({ error: "No dropea store found" }, { status: 400 });
    storeId = s.id;
  }

  // Canales explícitos (nuevo modelo) o legacy (meta_ads/tiktok_ads).
  let normalized: AdChannel[];
  if (Array.isArray(channels)) {
    normalized = channels
      .filter((c) => c && String(c.name || "").trim())
      .map((c) => {
        const base = Number(c.base) || 0;
        const fee_pct = Number(c.fee_pct) || 0;
        return { name: String(c.name).trim(), base, fee_pct, total: Number(c.total) || channelTotal(base, fee_pct) };
      });
  } else {
    const metaFee = Number(body.meta_agency_fee_pct) || 0;
    const tiktokFee = Number(body.tiktok_agency_fee_pct) || 0;
    const metaBase = metaFee > 0 ? (Number(body.meta_ads) || 0) / (1 + metaFee / 100) : Number(body.meta_ads) || 0;
    const tiktokBase = tiktokFee > 0 ? (Number(body.tiktok_ads) || 0) / (1 + tiktokFee / 100) : Number(body.tiktok_ads) || 0;
    normalized = [
      { name: "Meta Ads", base: metaBase, fee_pct: metaFee, total: Number(body.meta_ads) || 0 },
      { name: "TikTok Ads", base: tiktokBase, fee_pct: tiktokFee, total: Number(body.tiktok_ads) || 0 },
    ];
  }

  const record: Record<string, unknown> = {
    store_id: storeId,
    user_id: user.id,
    fecha,
    channels: normalized,
  };

  const legacy = normalized.length > 0 ? normalized[0] : { base: 0, fee_pct: 0, total: 0 };
  const legacy2 = normalized.length > 1 ? normalized[1] : { base: 0, fee_pct: 0, total: 0 };
  record.meta_ads = legacy.total;
  record.meta_agency_fee_pct = legacy.fee_pct;
  record.tiktok_ads = legacy2.total;
  record.tiktok_agency_fee_pct = legacy2.fee_pct;

  const { error } = await insforge.database
    .from("ads_diario")
    .upsert(record, { onConflict: "store_id,fecha" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
