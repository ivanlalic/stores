import { createServiceClient } from "@/lib/insforge/server";

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
      .select("dropea_id")
      .eq("store_id", store.id)
      .in("dropea_id", dropeaIds);

    const existingSet = new Set(existing?.map((e) => e.dropea_id) || []);
    for (const order of batch) {
      if (existingSet.has(order.dropea_id)) {
        updated++;
      } else {
        added++;
      }
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
