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
      fee_gestion_eur: data.fee_gestion_pct ?? data.fee_gestion_eur ?? 0,
      has_api_key: !!data.dropea_api_key_encrypted,
      store_name: data.store_name || "Mi Tienda",
      costo_rechazo: data.costo_rechazo ?? 13,
      dias_rolling: data.dias_rolling ?? 30,
      dias_excluir: data.dias_excluir ?? 4,
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
  if (body.fee_gestion_eur !== undefined) {
    // Column may be fee_gestion_pct (pre-migration) or fee_gestion_eur (post-migration)
    updates.fee_gestion_pct = body.fee_gestion_eur;
  }
  if (body.store_name !== undefined) {
    updates.store_name = body.store_name;
  }
  if (body.costo_rechazo !== undefined) {
    updates.costo_rechazo = body.costo_rechazo;
  }
  if (body.dias_rolling !== undefined) {
    updates.dias_rolling = body.dias_rolling;
  }
  if (body.dias_excluir !== undefined) {
    updates.dias_excluir = body.dias_excluir;
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
