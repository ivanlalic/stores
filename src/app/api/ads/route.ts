import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month"); // YYYY-MM format

  let query = supabase
    .from("ads_diario")
    .select("*")
    .eq("user_id", user.id)
    .order("fecha", { ascending: false });

  if (month) {
    const startDate = `${month}-01`;
    const [year, m] = month.split("-").map(Number);
    const endDate = new Date(year, m, 0).toISOString().split("T")[0]; // last day of month
    query = query.gte("fecha", startDate).lte("fecha", endDate);
  } else {
    query = query.limit(7);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ads: data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { fecha, meta_ads, tiktok_ads } = body;

  if (!fecha) {
    return NextResponse.json({ error: "fecha is required" }, { status: 400 });
  }

  const { error } = await supabase.from("ads_diario").upsert(
    {
      user_id: user.id,
      fecha,
      meta_ads: meta_ads || 0,
      tiktok_ads: tiktok_ads || 0,
    },
    { onConflict: "user_id,fecha" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
