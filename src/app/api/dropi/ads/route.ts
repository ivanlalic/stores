import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const startDate = `${month}-01`;
  const [year, m] = month.split("-").map(Number);
  const endDate = new Date(year, m, 0).toISOString().split("T")[0];

  const insforge = createServiceClient();
  const { data } = await insforge.database
    .from("dropi_ads_diario")
    .select("*")
    .eq("user_id", user.id)
    .gte("fecha", startDate)
    .lte("fecha", endDate);

  return NextResponse.json({ ads: data || [] });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { fecha, meta_ads, tiktok_ads } = body;

  if (!fecha) return NextResponse.json({ error: "Missing fecha" }, { status: 400 });

  const insforge = createServiceClient();
  const { error } = await insforge.database.from("dropi_ads_diario").upsert(
    {
      user_id: user.id,
      fecha,
      meta_ads: meta_ads ?? 0,
      tiktok_ads: tiktok_ads ?? 0,
    },
    { onConflict: "user_id,fecha" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
