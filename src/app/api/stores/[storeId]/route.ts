import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { encrypt } from "@/lib/encryption";
import { requireStore, requireStoreOwner } from "@/lib/store-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId } = await params;
  const insforge = createServiceClient();

  try {
    const store = await requireStore(insforge, storeId, user.id);
    return NextResponse.json({
      store: {
        id: store.id,
        name: store.name,
        type: store.type,
        fee_gestion_eur: store.fee_gestion_eur,
        costo_rechazo: store.costo_rechazo,
        dias_rolling: store.dias_rolling,
        dias_excluir: store.dias_excluir,
        market: store.market,
        ads_label_1: store.ads_label_1,
        ads_label_2: store.ads_label_2,
        ads_channels: store.ads_channels,
        has_api_key: !!store.dropea_api_key_encrypted,
        has_webhook_secret: !!store.dropea_webhook_secret_encrypted,
        has_dropea_credentials: !!(store.dropea_email_encrypted && store.dropea_pwd_encrypted),
        has_dropi_credentials: !!(store.dropi_email_encrypted && store.dropi_pwd_encrypted),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId } = await params;
  const insforge = createServiceClient();

  try {
    await requireStoreOwner(insforge, storeId, user.id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.dropea_api_key) updates.dropea_api_key_encrypted = encrypt(body.dropea_api_key);
  if (body.dropea_webhook_secret) updates.dropea_webhook_secret_encrypted = encrypt(body.dropea_webhook_secret);
  if (body.market) updates.market = body.market.toUpperCase();
  if (body.dropea_email) updates.dropea_email_encrypted = encrypt(body.dropea_email);
  if (body.dropea_pwd) updates.dropea_pwd_encrypted = encrypt(body.dropea_pwd);
  if (body.dropi_email) updates.dropi_email_encrypted = encrypt(body.dropi_email);
  if (body.dropi_pwd) updates.dropi_pwd_encrypted = encrypt(body.dropi_pwd);
  if (body.fee_gestion_eur !== undefined) updates.fee_gestion_eur = body.fee_gestion_eur;
  if (body.costo_rechazo !== undefined) updates.costo_rechazo = body.costo_rechazo;
  if (body.dias_rolling !== undefined) updates.dias_rolling = body.dias_rolling;
  if (body.dias_excluir !== undefined) updates.dias_excluir = body.dias_excluir;
  if (Array.isArray(body.ads_channels)) {
    updates.ads_channels = body.ads_channels
      .filter((c: { name?: string } | null) => c && String(c.name || "").trim())
      .map((c: { name?: string; fee_pct?: number }) => ({
        name: String(c.name).trim(),
        fee_pct: Number(c.fee_pct) || 0,
      }));
  }

  const { error } = await insforge.database
    .from("stores")
    .update(updates)
    .eq("id", storeId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId } = await params;
  const insforge = createServiceClient();

  try {
    await requireStoreOwner(insforge, storeId, user.id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await insforge.database
    .from("stores")
    .delete()
    .eq("id", storeId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
