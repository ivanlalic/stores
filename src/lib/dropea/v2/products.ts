import type { DropeaProductV2 } from "./client";
import { createServiceClient } from "@/lib/insforge/server";

export interface ProductRowV2 {
  store_id: string;
  dropea_product_id: number;
  dropea_variant_id: number;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  price: number;
  stock: number;
  product_status: string;
  synced_at: string;
}

export function mapProductV2(product: DropeaProductV2, storeId: string): ProductRowV2[] {
  const base = {
    store_id: storeId,
    dropea_product_id: product.id,
    product_name: product.name,
    product_status: product.status,
    synced_at: new Date().toISOString(),
  };

  if (!product.variants || product.variants.length === 0) {
    return [
      {
        ...base,
        dropea_variant_id: product.id,
        variant_name: null,
        sku: null,
        price: 0,
        stock: 0,
      },
    ];
  }

  return product.variants.map((v) => ({
    ...base,
    dropea_variant_id: v.variant_id,
    variant_name: v.name,
    sku: v.sku,
    price: v.price,
    stock: v.stock,
  }));
}

export async function upsertProducts(
  insforge: ReturnType<typeof createServiceClient>,
  storeId: string,
  rows: ProductRowV2[]
): Promise<{ added: number; updated: number }> {
  const batchSize = 100;
  let added = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const keys = batch.map((r) => r.dropea_variant_id);
    const { data: existing } = await insforge.database
      .from("productos")
      .select("dropea_variant_id")
      .eq("store_id", storeId)
      .in("dropea_variant_id", keys);

    const existingSet = new Set(existing?.map((e) => e.dropea_variant_id) || []);
    for (const row of batch) {
      if (existingSet.has(row.dropea_variant_id)) {
        updated++;
      } else {
        added++;
      }
    }

    const { error } = await insforge.database
      .from("productos")
      .upsert(batch, { onConflict: "store_id,dropea_variant_id" });

    if (error) {
      throw new Error(`Error guardando productos: ${error.message}`);
    }
  }

  return { added, updated };
}
