import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/insforge/server";
import { mapOrderV2 } from "@/lib/dropea/v2/status";
import type { DropeaOrderV2 } from "@/lib/dropea/v2/client";
import { upsertOrders } from "@/lib/dropea/v2/upsert";
import { decrypt } from "@/lib/encryption";
import type { StoreRow } from "@/lib/store-utils";

const ORDER_TOPICS = new Set(["order.created", "order.status.changed", "order.cancelled"]);

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !signature.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function handleWebhook(request: NextRequest) {
  const rawBody = await request.text();

  let envelope: { topic?: string; market?: string; resource?: DropeaOrderV2 };
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!envelope.topic || !ORDER_TOPICS.has(envelope.topic)) {
    return NextResponse.json({ ok: true, note: "topic ignorado" });
  }

  if (!envelope.resource) {
    return NextResponse.json({ ok: true, note: "sin resource" });
  }

  const insforge = createServiceClient();

  const shopId = envelope.resource.store_id != null ? Number(envelope.resource.store_id) : null;

  let storeList: (StoreRow & { market: string })[] | null = null;
  if (shopId != null) {
    const res = await insforge.database
      .from("stores")
      .select("*")
      .eq("type", "dropea")
      .eq("dropea_shop_id", shopId)
      .limit(1);
    storeList = res.data as (StoreRow & { market: string })[] | null;
  }

  if (!storeList || storeList.length === 0) {
    const res = await insforge.database
      .from("stores")
      .select("*")
      .eq("type", "dropea")
      .eq("market", String(envelope.market || "").toUpperCase())
      .order("created_at", { ascending: true })
      .limit(1);
    storeList = res.data as (StoreRow & { market: string })[] | null;
  }

  const store = storeList?.[0];
  if (!store) {
    return NextResponse.json({ ok: true, note: "sin tienda para el pedido" });
  }

  const storeSecret = store.dropea_webhook_secret_encrypted
    ? decrypt(store.dropea_webhook_secret_encrypted)
    : process.env.DROPEA_V2_WEBHOOK_SECRET;

  if (!storeSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = request.headers.get("X-Dropea-Signature");
  if (!verifySignature(rawBody, signature, storeSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const mapped = mapOrderV2(envelope.resource, store.user_id, store.id, store.market);

  const { added, updated } = await upsertOrders(insforge, store, [mapped], () => {});

  return NextResponse.json({ ok: true, added, updated });
}
