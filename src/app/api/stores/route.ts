import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { encrypt } from "@/lib/encryption";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const insforge = createServiceClient();
  const { data, error } = await insforge.database
    .from("stores")
    .select("id, name, type, fee_gestion_eur, costo_rechazo, dias_rolling, dias_excluir, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stores = (data || []).map((s) => ({
    ...s,
    has_api_key: false,
    has_dropi_credentials: false,
  }));

  // Fetch credential presence separately
  const { data: full } = await insforge.database
    .from("stores")
    .select("id, dropea_api_key_encrypted, dropi_email_encrypted, dropi_pwd_encrypted")
    .eq("user_id", user.id);

  const credMap = new Map((full || []).map((r) => [r.id, r]));
  for (const s of stores) {
    const c = credMap.get(s.id);
    if (c) {
      (s as Record<string, unknown>).has_api_key = !!c.dropea_api_key_encrypted;
      (s as Record<string, unknown>).has_dropi_credentials = !!(c.dropi_email_encrypted && c.dropi_pwd_encrypted);
    }
  }

  return NextResponse.json({ stores });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, type, dropea_api_key, dropi_email, dropi_pwd,
    fee_gestion_eur = 0, costo_rechazo = 13.76, dias_rolling = 30, dias_excluir = 4 } = body;

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (type !== "dropea" && type !== "dropi") return NextResponse.json({ error: "type must be dropea or dropi" }, { status: 400 });

  const record: Record<string, unknown> = {
    user_id: user.id,
    name: name.trim(),
    type,
    fee_gestion_eur,
    costo_rechazo,
    dias_rolling,
    dias_excluir,
  };

  if (type === "dropea" && dropea_api_key) {
    record.dropea_api_key_encrypted = encrypt(dropea_api_key);
  }
  if (type === "dropi" && dropi_email && dropi_pwd) {
    record.dropi_email_encrypted = encrypt(dropi_email);
    record.dropi_pwd_encrypted = encrypt(dropi_pwd);
  }

  const insforge = createServiceClient();
  const { data, error } = await insforge.database
    .from("stores")
    .insert([record])
    .select("id, name, type")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ store: data }, { status: 201 });
}
