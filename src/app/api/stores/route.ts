import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { encrypt } from "@/lib/encryption";

const STORE_COLUMNS = "id, name, type, fee_gestion_eur, costo_rechazo, dias_rolling, dias_excluir, market, ads_label_1, ads_label_2, ads_channels, created_at";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const insforge = createServiceClient();

  // Owned stores
  const { data: owned, error: ownedError } = await insforge.database
    .from("stores")
    .select(STORE_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 });

  // Shared stores via store_members
  const { data: memberships } = await insforge.database
    .from("store_members")
    .select("store_id")
    .eq("user_id", user.id);

  const memberStoreIds = (memberships || []).map((m: { store_id: string }) => m.store_id);

  const { data: shared } = memberStoreIds.length
    ? await insforge.database
        .from("stores")
        .select(STORE_COLUMNS)
        .in("id", memberStoreIds)
        .neq("user_id", user.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const allStores = [
    ...(owned || []).map((s) => ({ ...s, is_owner: true })),
    ...(shared || []).map((s) => ({ ...s, is_owner: false })),
  ];

  // Fetch credential presence for ALL stores (owned + shared)
  const allIds = allStores.map((s) => s.id);
  const { data: full } = allIds.length
    ? await insforge.database
        .from("stores")
        .select("id, dropea_api_key_encrypted, dropea_email_encrypted, dropea_pwd_encrypted, dropea_webhook_secret_encrypted, dropi_email_encrypted, dropi_pwd_encrypted")
        .in("id", allIds)
    : { data: [] };

  const credMap = new Map((full || []).map((r) => [r.id, r]));
  const stores = allStores.map((s) => {
    const c = credMap.get(s.id);
    return {
      ...s,
      has_api_key: !!(c?.dropea_api_key_encrypted),
      has_webhook_secret: !!(c?.dropea_webhook_secret_encrypted),
      has_dropea_credentials: !!(c?.dropea_email_encrypted && c?.dropea_pwd_encrypted),
      has_dropi_credentials: !!(c?.dropi_email_encrypted && c?.dropi_pwd_encrypted),
    };
  });

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
