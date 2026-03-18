import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { fetchAllOrders, getDateRange, getDateRange48h, type DropeaOrder } from "@/lib/dropea/client";
import {
  isEnviado,
  isEntregado,
  isRechazado,
  isCancelado,
  shouldZeroRevenue,
} from "@/lib/dropea/status";

function mapOrder(order: DropeaOrder, userId: string) {
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

  // Parse date from "2025-11-27 20:03:21" format
  const fecha = order.created_at ? order.created_at.split(" ")[0] : null;

  return {
    user_id: userId,
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

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(msg: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: msg })}\n\n`));
      }

      try {
        send("Autenticando...");

        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          send("Error: No autenticado");
          controller.close();
          return;
        }

        send("Obteniendo configuracion...");

        const { data: config } = await supabase
          .from("users_config")
          .select("dropea_api_key_encrypted")
          .eq("id", user.id)
          .single();

        if (!config?.dropea_api_key_encrypted) {
          send("Error: No hay API key configurada");
          controller.close();
          return;
        }

        const apiKey = decrypt(config.dropea_api_key_encrypted);

        const mode = request.nextUrl.searchParams.get("mode");
        const is48h = mode === "48h";
        const { startDate, endDate } = is48h ? getDateRange48h() : getDateRange(2);

        send(`${is48h ? "Sync rápido (48h)" : "Sync completo"}: ${startDate} - ${endDate}...`);

        const orders = await fetchAllOrders(apiKey, startDate, endDate, send);

        send(`${orders.length} pedidos obtenidos. Procesando...`);

        // Map orders to DB format
        const mappedOrders = orders.map((o) => mapOrder(o, user.id));

        // Upsert in batches of 100
        const serviceClient = await createServiceClient();
        const batchSize = 100;
        let added = 0;
        let updated = 0;

        for (let i = 0; i < mappedOrders.length; i += batchSize) {
          const batch = mappedOrders.slice(i, i + batchSize);

          // Check which exist
          const dropeaIds = batch.map((o) => o.dropea_id);
          const { data: existing } = await serviceClient
            .from("pedidos")
            .select("dropea_id")
            .eq("user_id", user.id)
            .in("dropea_id", dropeaIds);

          const existingSet = new Set(existing?.map((e) => e.dropea_id) || []);

          for (const order of batch) {
            if (existingSet.has(order.dropea_id)) {
              updated++;
            } else {
              added++;
            }
          }

          const { error } = await serviceClient.from("pedidos").upsert(batch, {
            onConflict: "user_id,dropea_id",
          });

          if (error) {
            send(`Error procesando batch: ${error.message}`);
          }

          send(`Procesados ${Math.min(i + batchSize, mappedOrders.length)}/${mappedOrders.length}...`);
        }

        send(`Sincronizacion completa! Nuevos: ${added} | Actualizados: ${updated}`);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, added, updated })}\n\n`));
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
