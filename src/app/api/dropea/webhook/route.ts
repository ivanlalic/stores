import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/insforge/server";
import { mapOrderV2 } from "@/lib/dropea/v2/status";
import type { DropeaOrderV2 } from "@/lib/dropea/v2/client";
import { upsertOrders } from "@/lib/dropea/v2/upsert";
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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secret = process.env.DROPEA_V2_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = request.headers.get("X-Dropea-Signature");
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

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

  const { data: storeList } = await insforge.database
    .from("stores")
    .select("*")
    .eq("type", "dropea")
    .eq("market", String(envelope.market || "").toUpperCase())
    .order("created_at", { ascending: true })
    .limit(1);

  const store = storeList?.[0] as (StoreRow & { market: string }) | undefined;

  if (!store) {
    return NextResponse.json({ ok: true, note: "sin tienda para market" });
  }

  const mapped = mapOrderV2(envelope.resource, store.user_id, store.id, store.market);

  const { added, updated } = await upsertOrders(insforge, store, [mapped], () => {});

  return NextResponse.json({ ok: true, added, updated });
}
