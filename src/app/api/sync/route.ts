import { NextRequest } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import { fetchAllOrders, getDateRange, getDateRangeUpdatedAt, type DropeaOrder } from "@/lib/dropea/client";
import {
  isEnviado,
  isEntregado,
  isRechazado,
  isCancelado,
  shouldZeroRevenue,
} from "@/lib/dropea/status";
import {
  fetchAllOrdersV2,
  getDateRangeV2,
  getDateRangeDaysV2,
  type DropeaOrderV2,
} from "@/lib/dropea/v2/client";
import { mapOrderV2 } from "@/lib/dropea/v2/status";
import { getDefaultStore, requireStore, type StoreRow } from "@/lib/store-utils";

function mapOrder(order: DropeaOrder, userId: string, storeId: string) {
  const customer = order.customer;
  const nombre =
    customer?.full_name ||
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    customer?.phone ||
    customer?.email ||
    "";

  let telefono = customer?.phone || "";
  if (telefono.startsWith("+")) telefono = telefono.substring(1);

  const pedido = order.items
    .map(
      (item) =>
        `${item.product?.name || "Producto sin nombre"} (x${item.quantity})`
    )
    .join(" | ");

  const status = order.status || "";
  const zeroRevenue = shouldZeroRevenue(status);

  const fecha = order.created_at
    ? new Date(order.created_at.replace(" ", "T") + "Z")
        .toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" })
    : null;

  return {
    user_id: userId,
    store_id: storeId,
    dropea_id: order.id,
    orden: order.external_order_id || null,
    fecha,
    nombre,
    telefono,
    pedido,
    venta: zeroRevenue ? 0 : order.total_amount || 0,
    neto: zeroRevenue ? 0 : order.order_profit || 0,
    status,
    es_enviado: isEnviado(status),
    es_entregado: isEntregado(status),
    es_rechazado: isRechazado(status),
    es_cancelado: isCancelado(status),
    synced_at: new Date().toISOString(),
  };
}

async function upsertOrders(
  insforge: ReturnType<typeof createServiceClient>,
  store: { id: string },
  mappedOrders: Record<string, unknown>[],
  send: (msg: string) => void
): Promise<{ added: number; updated: number }> {
  const batchSize = 100;
  let added = 0;
  let updated = 0;

  for (let i = 0; i < mappedOrders.length; i += batchSize) {
    const batch = mappedOrders.slice(i, i + batchSize);

    const dropeaIds = batch.map((o) => o.dropea_id);
    const { data: existing } = await insforge.database
      .from("pedidos")
      .select("dropea_id")
      .eq("store_id", store.id)
      .in("dropea_id", dropeaIds);

    const existingSet = new Set(existing?.map((e) => e.dropea_id) || []);
    for (const order of batch) {
      if (existingSet.has(order.dropea_id)) { updated++; } else { added++; }
    }

    const { error } = await insforge.database
      .from("pedidos")
      .upsert(batch, { onConflict: "store_id,dropea_id" });

    if (error) {
      send(`Error procesando batch: ${error.message}`);
    }

    send(`Procesados ${Math.min(i + batchSize, mappedOrders.length)}/${mappedOrders.length}...`);
  }

  return { added, updated };
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(msg: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: msg })}\n\n`));
      }

      try {
        send("Autenticando...");

        const user = await getUser();
        if (!user) {
          send("Error: No autenticado");
          controller.close();
          return;
        }

        send("Obteniendo configuracion...");

        const insforge = createServiceClient();
        const storeParam = request.nextUrl.searchParams.get("store_id");

        let store: StoreRow;
        if (storeParam) {
          try {
            store = await requireStore(insforge, storeParam, user.id);
          } catch {
            send("Error: Tienda no encontrada");
            controller.close();
            return;
          }
        } else {
          const defaultStore = await getDefaultStore(insforge, user.id, "dropea");
          if (!defaultStore) {
            send("Error: No hay tienda configurada");
            controller.close();
            return;
          }
          store = defaultStore;
        }

        if (!store?.dropea_api_key_encrypted) {
          send("Error: No hay API key configurada");
          controller.close();
          return;
        }

        const apiKey = decrypt(store.dropea_api_key_encrypted);

        const market = store.market;
        if (market) {
          const mode = request.nextUrl.searchParams.get("mode");
          const is48h = mode === "48h";
          const months = parseInt(request.nextUrl.searchParams.get("months") || "2", 10);

          const range = is48h ? getDateRangeDaysV2(15) : getDateRangeV2(months);
          const startDate = range.startDate;
          const endDate = range.endDate;

          send(`Sincronización v2 (${market}, creados: ${startDate} - ${endDate})...`);

          const orders = await fetchAllOrdersV2(apiKey, market, startDate, endDate, send);

          send(`${orders.length} pedidos obtenidos. Procesando...`);

          const mappedOrders = orders.map((o: DropeaOrderV2) =>
            mapOrderV2(o, user.id, store.id, market)
          );

          const { added, updated } = await upsertOrders(insforge, store, mappedOrders, send);

          send(`Sincronizacion v2 completa! Nuevos: ${added} | Actualizados: ${updated}`);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, added, updated })}\n\n`));
        } else {
          const mode = request.nextUrl.searchParams.get("mode");
          const is48h = mode === "48h";

          let startDate = request.nextUrl.searchParams.get("startDate") || "";
          let endDate = request.nextUrl.searchParams.get("endDate") || "";

          if (!startDate || !endDate) {
            const months = parseInt(request.nextUrl.searchParams.get("months") || "2", 10);
            const range = is48h ? getDateRangeUpdatedAt(15) : getDateRange(months);
            startDate = range.startDate;
            endDate = range.endDate;
          }

          const dateField = (request.nextUrl.searchParams.get("dateField") || (is48h ? "UPDATED_AT" : "CREATED_AT")) as "CREATED_AT" | "UPDATED_AT";

          send(`Sincronización (${dateField}): ${startDate} - ${endDate}...`);

          const orders = await fetchAllOrders(apiKey, startDate, endDate, send, dateField);

          send(`${orders.length} pedidos obtenidos. Procesando...`);

          const mappedOrders = orders.map((o) => mapOrder(o, user.id, store.id));

          const { added, updated } = await upsertOrders(insforge, store, mappedOrders, send);

          send(`Sincronizacion completa! Nuevos: ${added} | Actualizados: ${updated}`);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, added, updated })}\n\n`));
        }
      } catch (err) {
        send(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
