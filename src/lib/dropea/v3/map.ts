import type { DropeaOrderV2 } from "@/lib/dropea/v2/client";
import {
  isCanceladoV2,
  isEntregadoV2,
  isEnviadoV2,
  isRechazadoV2,
  isRejectedV2,
  shouldZeroRevenueV2,
  computeNetoV2,
  computeRejectedNetoV2,
} from "@/lib/dropea/v2/status";

export interface MappedOrderV3 {
  user_id: string;
  store_id: string;
  dropea_id: string;
  orden: string | null;
  fecha: string | null;
  nombre: string;
  telefono: string;
  pedido: string;
  venta: number;
  neto: number;
  status: string;
  sub_status: string | null;
  es_enviado: boolean;
  es_entregado: boolean;
  es_rechazado: boolean;
  es_cancelado: boolean;
  dropea_updated_at: string | null;
  payload: DropeaOrderV2;
  synced_at: string;
}

export function mapOrderV3(
  order: DropeaOrderV2,
  userId: string,
  storeId: string,
  market: string,
  costs: { envio: number; cod_fee: number }
): MappedOrderV3 {
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
  const rejected = isRejectedV2(status, order.sub_status);
  const venta = zeroRevenue ? 0 : order.total_amount || 0;
  const neto = zeroRevenue
    ? 0
    : rejected
      ? computeRejectedNetoV2(order, costs)
      : computeNetoV2(order, costs);

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
    venta,
    neto,
    status,
    sub_status: order.sub_status,
    es_enviado: isEnviadoV2(status, order.sub_status),
    es_entregado: isEntregadoV2(status, order.sub_status),
    es_rechazado: isRechazadoV2(status, order.sub_status),
    es_cancelado: isCanceladoV2(status, order.sub_status),
    dropea_updated_at: order.updated_at ?? null,
    payload: order,
    synced_at: new Date().toISOString(),
  };
}
