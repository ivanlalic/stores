import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const insforge = createServiceClient();
  const { data, error } = await insforge.database
    .from("users_config")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ config: null });
  }

  return NextResponse.json({
    config: {
      fee_gestion_eur: data.fee_gestion_eur ?? 0,
      has_api_key: !!data.dropea_api_key_encrypted,
      store_name: data.store_name || "Mi Tienda",
      costo_rechazo: data.costo_rechazo ?? 13,
      dias_rolling: data.dias_rolling ?? 30,
      dias_excluir: data.dias_excluir ?? 4,
    },
  });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.dropea_api_key !== undefined) {
    updates.dropea_api_key_encrypted = body.dropea_api_key
      ? encrypt(body.dropea_api_key)
      : null;
  }
  if (body.fee_gestion_eur !== undefined) updates.fee_gestion_eur = body.fee_gestion_eur;
  if (body.store_name !== undefined) updates.store_name = body.store_name;
  if (body.costo_rechazo !== undefined) updates.costo_rechazo = body.costo_rechazo;
  if (body.dias_rolling !== undefined) updates.dias_rolling = body.dias_rolling;
  if (body.dias_excluir !== undefined) updates.dias_excluir = body.dias_excluir;

  const insforge = createServiceClient();

  // Check if config exists
  const { data: existing } = await insforge.database
    .from("users_config")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  let error;
  if (existing) {
    ({ error } = await insforge.database
      .from("users_config")
      .update(updates)
      .eq("id", user.id));
  } else {
    ({ error } = await insforge.database
      .from("users_config")
      .insert([{ id: user.id, ...updates }]));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
