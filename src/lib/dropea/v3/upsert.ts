import type { createServiceClient } from "@/lib/insforge/server";
import type { MappedOrderV3 } from "./map";

// Columnas de negocio que comparamos para decidir si hace falta escribir la fila.
// `synced_at` y `dropea_updated_at` se excluyen a propósito (el guard de updated_at
// se maneja aparte).
const FIELDS = [
  "status",
  "sub_status",
  "es_enviado",
  "es_entregado",
  "es_rechazado",
  "es_cancelado",
  "venta",
  "neto",
  "orden",
  "fecha",
  "nombre",
  "telefono",
  "pedido",
] as const;

function signature(o: object): string {
  const rec = o as Record<string, unknown>;
  return FIELDS.map((f) => String(rec[f] ?? "")).join("\u0001");
}

export interface UpsertV3Result {
  added: number;
  updated: number;
  skipped: number;
}

export async function upsertOrdersV3(
  insforge: ReturnType<typeof createServiceClient>,
  store: { id: string },
  mappedOrders: MappedOrderV3[],
  send: (msg: string) => void
): Promise<UpsertV3Result> {
  const batchSize = 100;
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < mappedOrders.length; i += batchSize) {
    const batch = mappedOrders.slice(i, i + batchSize);

    const dropeaIds = batch.map((o) => o.dropea_id);
    const { data: existing } = await insforge.database
      .from("pedidos_v3")
      .select(
        "dropea_id,status,sub_status,es_enviado,es_entregado,es_rechazado,es_cancelado,venta,neto,orden,fecha,nombre,telefono,pedido,dropea_updated_at,enviado_at,entregado_at,rechazado_at,cancelado_at"
      )
      .eq("store_id", store.id)
      .in("dropea_id", dropeaIds);

    const existingBy = new Map<string, { sig: string; row: Record<string, unknown> }>(
      (existing || []).map((e) => [String(e.dropea_id), { sig: signature(e), row: e }])
    );

    const toWrite: MappedOrderV3[] = [];
    const events: Array<{
      store_id: string;
      dropea_id: string;
      status: string | null;
      sub_status: string | null;
      dropea_updated_at: string | null;
      payload: unknown;
    }> = [];

    const now = new Date().toISOString();

    for (const order of batch) {
      const key = String(order.dropea_id);
      const prev = existingBy.get(key);

      if (prev) {
        // Guard de eventos reordenados: solo aceptamos si el updated_at entrante
        // es >= al guardado, para que un evento encolado/antiguo nunca revierta
        // una transicion mas reciente.
        const incoming = order.dropea_updated_at;
        const stored = prev.row.dropea_updated_at as string | null;
        if (incoming != null && stored != null && new Date(incoming).getTime() < new Date(stored).getTime()) {
          skipped++;
          send(`Ignorado ${order.dropea_id} (updated_at obsoleto ${incoming} < ${stored})`);
          continue;
        }

        if (prev.sig === signature(order)) {
          // Sin cambios → saltamos la escritura.
          continue;
        }
        updated++;
        toWrite.push(applyTransitionTimestamps(order, prev.row, now));
        events.push(toEvent(store.id, order));
      } else {
        added++;
        toWrite.push(applyTransitionTimestamps(order, null, now));
        events.push(toEvent(store.id, order));
      }
    }

    if (toWrite.length > 0) {
      const { error } = await insforge.database
        .from("pedidos_v3")
        .upsert(toWrite, { onConflict: "store_id,dropea_id" });

      if (error) {
        send(`Error procesando batch: ${error.message}`);
      }
    }

    if (events.length > 0) {
      const { error } = await insforge.database.from("order_events").insert(events);
      if (error) {
        send(`Error insertando events: ${error.message}`);
      }
    }

    send(`Procesados ${Math.min(i + batchSize, mappedOrders.length)}/${mappedOrders.length}...`);
  }

  return { added, updated, skipped };
}

// Rellena los timestamps de transicion SOLO cuando ocurren: conserva los ya
// existentes y fija el actual en la primera vez que el flag pasa a true.
function applyTransitionTimestamps(
  order: MappedOrderV3,
  prev: Record<string, unknown> | null,
  now: string
): MappedOrderV3 {
  const out = { ...order } as MappedOrderV3 & Record<string, unknown>;
  const setAt = (flag: boolean, key: string) => {
    if (flag && !out[key]) out[key] = now;
  };
  // Conservar los existentes
  (["enviado_at", "entregado_at", "rechazado_at", "cancelado_at"] as const).forEach((k) => {
    if (prev?.[k]) out[k] = prev[k];
  });
  setAt(order.es_enviado, "enviado_at");
  setAt(order.es_entregado, "entregado_at");
  setAt(order.es_rechazado, "rechazado_at");
  setAt(order.es_cancelado, "cancelado_at");
  return out as MappedOrderV3;
}

function toEvent(storeId: string, order: MappedOrderV3) {
  return {
    store_id: storeId,
    dropea_id: order.dropea_id,
    status: order.status,
    sub_status: order.sub_status,
    dropea_updated_at: order.dropea_updated_at,
    payload: order.payload,
  };
}
