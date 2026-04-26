import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/insforge/server";

function mapWebhookStatus(statusName: string) {
  const s = (statusName || "").toLowerCase();
  const es_entregado = s.includes("entregado") || s.includes("cobrado");
  const es_rechazado = s.includes("rechazado");
  const es_cancelado = s.includes("cancelado");
  const es_enviado = s.includes("enviado") || es_entregado || es_rechazado;
  return { es_enviado, es_entregado, es_rechazado, es_cancelado };
}

export async function POST(request: NextRequest) {
  let body: {
    order_id?: number;
    shopify_order_id?: number | null;
    status_name?: string;
    tracking_code?: string;
    tracking_url?: string | null;
    shipping_company?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { order_id, shopify_order_id, status_name, tracking_code, tracking_url, shipping_company } = body;

  if (!order_id && !shopify_order_id) {
    return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
  }

  const insforge = createServiceClient();

  const statusFlags = mapWebhookStatus(status_name || "");

  const updates = {
    status: status_name || null,
    ...statusFlags,
    tracking_code: tracking_code || null,
    tracking_url: tracking_url || null,
    shipping_company: shipping_company || null,
    updated_at: new Date().toISOString(),
  };

  let query = insforge.database.from("dropi_pedidos").update(updates);

  if (order_id) {
    query = query.eq("order_id", String(order_id));
  } else {
    query = query.eq("shopify_order_id", shopify_order_id!);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
