import { NextRequest } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import {
  fetchAllOrdersV2,
  fetchInFlightOrdersV2,
  IN_FLIGHT_STATUSES,
  IN_FLIGHT_LIGHT_STATUSES,
  getDateRangeV2,
  getDateRangeDaysV2,
  type DropeaOrderV2,
} from "@/lib/dropea/v2/client";
import { getConfigsV3, resolveCostsV3 } from "@/lib/dropea/v3/status";
import { mapOrderV3 } from "@/lib/dropea/v3/map";
import { upsertOrdersV3 } from "@/lib/dropea/v3/upsert";
import { getDefaultStore, requireStore, type StoreRow } from "@/lib/store-utils";

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

        if (!market) {
          send("Error: Tienda sin market configurado");
          controller.close();
          return;
        }

        const mode = request.nextUrl.searchParams.get("mode");
        const is48h = mode === "48h";
        const months = parseInt(request.nextUrl.searchParams.get("months") || "2", 10);

        const range = is48h ? getDateRangeDaysV2(15) : getDateRangeV2(months);
        const startDate = range.startDate;
        const endDate = range.endDate;

        send(`Sync v3 (${market}, creados: ${startDate} - ${endDate})...`);

        const windowOrders = await fetchAllOrdersV2(apiKey, market, startDate, endDate, send);

        send("Actualizando pedidos en vuelo (estados abiertos)...");
        const inFlightStatuses = is48h ? IN_FLIGHT_LIGHT_STATUSES : IN_FLIGHT_STATUSES;
        const inFlight = await fetchInFlightOrdersV2(apiKey, market, send, inFlightStatuses);

        const seen = new Set<string>();
        const orders = windowOrders.concat(inFlight).filter((o) => {
          const k = String(o.id);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        send(`${orders.length} pedidos obtenidos (${windowOrders.length} por fecha + ${inFlight.length} en vuelo). Procesando...`);

        const configs = await getConfigsV3(insforge);

        const mappedOrders: ReturnType<typeof mapOrderV3>[] = orders.map((o: DropeaOrderV2) => {
          const costs = resolveCostsV3(configs, market, getFechaV3(o));
          return mapOrderV3(o, user.id, store.id, market, costs);
        });

        const { added, updated, skipped } = await upsertOrdersV3(insforge, store, mappedOrders, send);

        await insforge.database.from("sync_state").upsert(
          [
            {
              store_id: store.id,
              last_synced_at: new Date().toISOString(),
              last_full_sync_at: is48h ? null : new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "store_id" }
        );

        send(`Sync v3 completa! Nuevos: ${added} | Actualizados: ${updated} | Ignorados: ${skipped}`);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, added, updated, skipped })}\n\n`)
        );
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

function getFechaV3(order: DropeaOrderV2): string | null {
  return order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-CA", {
        timeZone: "Europe/Madrid",
      })
    : null;
}
