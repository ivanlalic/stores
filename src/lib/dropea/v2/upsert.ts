import type { createServiceClient } from "@/lib/insforge/server";

// Columnas de negocio que comparamos para decidir si hace falta escribir la fila.
// `synced_at` se excluye a propósito (siempre cambia y no afecta al desenlace).
const FIELDS = [
  "status",
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

// Normaliza el valor a string para que booleans y números/seats sean comparables
// (PostgREST puede devolver numeric como string: 29.9 → "29.9").
function signature(o: Record<string, unknown>): string {
  return FIELDS.map((f) => String(o[f] ?? "")).join("\u0001");
}

export async function upsertOrders(
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
      .select("dropea_id,status,es_enviado,es_entregado,es_rechazado,es_cancelado,venta,neto,orden,fecha,nombre,telefono,pedido")
      .eq("store_id", store.id)
      .in("dropea_id", dropeaIds);

    const existingBy = new Map<string, string>(
      (existing || []).map((e) => [String(e.dropea_id), signature(e)])
    );

    const toWrite: Record<string, unknown>[] = [];
    for (const order of batch) {
      const key = String(order.dropea_id);
      const prev = existingBy.get(key);
      if (prev === undefined) {
        added++;
        toWrite.push(order);
      } else if (prev === signature(order)) {
        // Sin cambios → saltamos la escritura (sync de miles de pedidos en vuelo).
        continue;
      } else {
        updated++;
        toWrite.push(order);
      }
    }

    if (toWrite.length > 0) {
      const { error } = await insforge.database
        .from("pedidos")
        .upsert(toWrite, { onConflict: "store_id,dropea_id" });

      if (error) {
        send(`Error procesando batch: ${error.message}`);
      }
    }

    send(`Procesados ${Math.min(i + batchSize, mappedOrders.length)}/${mappedOrders.length}...`);
  }

  return { added, updated };
}