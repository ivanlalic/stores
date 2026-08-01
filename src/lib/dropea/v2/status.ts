import type { DropeaOrderV2 } from "./client";

const MARKET_COSTS: Record<string, { envio: number; cod_fee: number }> = {
  PT: { envio: 3.5, cod_fee: 1.0 },
};

export function getMarketCosts(market: string): { envio: number; cod_fee: number } {
  const costs = MARKET_COSTS[market.toUpperCase()];
  if (!costs) {
    throw new Error(`Costes de mercado no definidos para market=${market}`);
  }
  return costs;
}

export function isEnviadoV2(status: string): boolean {
  return ["CONFIRMED", "PROCESSING", "SHIPPING", "DELIVERED", "FINISH", "ERROR"].includes(
    status
  );
}

export function isEntregadoV2(status: string, subStatus: string | null): boolean {
  if (status === "DELIVERED") return true;
  return status === "FINISH" && (subStatus === "DELIVERED" || subStatus === "PAID");
}

export function isRechazadoV2(status: string, subStatus: string | null): boolean {
  return (
    status === "FINISH" &&
    (subStatus === "REFUSED" ||
      subStatus === "REFUSED_LOST_DAMAGED" ||
      subStatus === "LOST_DAMAGED")
  );
}

export function isCanceladoV2(_status: string, subStatus: string | null): boolean {
  return subStatus === "CANCELLED";
}

export function shouldZeroRevenueV2(status: string, subStatus: string | null): boolean {
  if (status === "DRAFT" || status === "PENDING") return true;
  return isCanceladoV2(status, subStatus);
}

export function computeNetoV2(
  order: DropeaOrderV2,
  costs: { envio: number; cod_fee: number }
): number {
  const wholesale = order.line_items.reduce(
    (sum, li) => sum + (li.wholesale_price ?? 0) * li.quantity,
    0
  );
  const oc = order.order_costs ?? {
    tax_rate_provider: 0,
    fulfillment_outbound: 0,
    fulfillment_quantity_cost: 0,
    fulfillment_return: 0,
  };
  const fulfillment = (oc.fulfillment_outbound ?? 0) + (oc.fulfillment_quantity_cost ?? 0);
  const raw = order.total_amount - wholesale - fulfillment - costs.envio - costs.cod_fee;
  return Math.round(raw * 100) / 100;
}

export function mapOrderV2(
  order: DropeaOrderV2,
  userId: string,
  storeId: string,
  market: string
) {
  const costs = getMarketCosts(market);
  const addr = order.shipping_address;
  const nombre =
    addr?.full_name ||
    [addr?.first_name, addr?.last_name].filter(Boolean).join(" ") ||
    addr?.phone_number ||
    addr?.email ||
    "";

  let telefono = addr?.phone_number || "";
  if (telefono.startsWith("+")) telefono = telefono.substring(1);

  const pedido = order.line_items
    .map((li) => `${li.product_name || "Producto sin nombre"} (x${li.quantity})`)
    .join(" | ");

  const status = order.status;
  const zeroRevenue = shouldZeroRevenueV2(status, order.sub_status);

  const fecha = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-CA", {
        timeZone: "Europe/Madrid",
      })
    : null;

  return {
    user_id: userId,
    store_id: storeId,
    dropea_id: String(order.id),
    orden: order.external_order_id || null,
    fecha,
    nombre,
    telefono,
    pedido,
    venta: zeroRevenue ? 0 : order.total_amount || 0,
    neto: zeroRevenue ? 0 : computeNetoV2(order, costs),
    status,
    es_enviado: isEnviadoV2(status),
    es_entregado: isEntregadoV2(status, order.sub_status),
    es_rechazado: isRechazadoV2(status, order.sub_status),
    es_cancelado: isCanceladoV2(status, order.sub_status),
    synced_at: new Date().toISOString(),
  };
}
