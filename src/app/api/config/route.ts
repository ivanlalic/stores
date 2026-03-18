import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("users_config")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ config: null });
  }

  return NextResponse.json({
    config: {
      fee_gestion_pct: data.fee_gestion_pct,
      has_api_key: !!data.dropea_api_key_encrypted,
    },
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.dropea_api_key !== undefined) {
    updates.dropea_api_key_encrypted = body.dropea_api_key
      ? encrypt(body.dropea_api_key)
      : null;
  }
  if (body.fee_gestion_pct !== undefined) {
    updates.fee_gestion_pct = body.fee_gestion_pct;
  }

  const { error } = await supabase
    .from("users_config")
    .upsert({ id: user.id, ...updates })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
