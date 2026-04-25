import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month");

  const insforge = createServiceClient();
  let query = insforge.database
    .from("ads_diario")
    .select("*")
    .eq("user_id", user.id)
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
  const { fecha, meta_ads, tiktok_ads } = body;

  if (!fecha) {
    return NextResponse.json({ error: "fecha is required" }, { status: 400 });
  }

  const insforge = createServiceClient();
  const { error } = await insforge.database.rpc("upsert_ads_diario", {
    p_user_id: user.id,
    p_fecha: fecha,
    p_meta_ads: meta_ads || 0,
    p_tiktok_ads: tiktok_ads || 0,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
