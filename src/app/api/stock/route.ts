import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import { fetchProductPagesBatch } from "@/lib/dropea/client";
import { fetchAllProductsV2 } from "@/lib/dropea/v2/client";
import { getDefaultStore, requireStore } from "@/lib/store-utils";

async function fetchAllSnapshots(
  insforge: Awaited<ReturnType<typeof createServiceClient>>,
  syncIds: string[]
) {
  const pageSize = 1000;
  let offset = 0;
  const all: { sync_id: string; dropea_id: string; sku: string | null; name: string; image: string | null; stock: number }[] = [];
  while (true) {
    const { data } = await insforge.database
      .from("stock_snapshots")
      .select("sync_id, dropea_id, sku, name, image, stock")
      .in("sync_id", syncIds)
      .range(offset, offset + pageSize - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const insforge = createServiceClient();
  const storeParam = request.nextUrl.searchParams.get("store_id");

  let store;
  try {
    store = storeParam
      ? await requireStore(insforge, storeParam, user.id)
      : await getDefaultStore(insforge, user.id, "dropea");
  } catch {
    return NextResponse.json({ error: "Tienda no encontrada" }, { status: 403 });
  }
  if (!store) return NextResponse.json({ syncs: [], products: [] });

  // Load last 3 syncs for display; use only first 2 for variation computation
  const { data: syncs } = await insforge.database
    .from("stock_syncs")
    .select("id, synced_at, total")
    .eq("store_id", store.id)
    .order("synced_at", { ascending: false })
    .limit(3);

  if (!syncs || syncs.length === 0) {
    return NextResponse.json({ syncs: [], products: [] });
  }

  // Only fetch snapshots for the 2 most recent syncs (needed for variation)
  const syncIds = syncs.slice(0, 2).map((s: { id: string }) => s.id);

  // Load snapshots with server-side pagination (PostgREST max may be 1000)
  const snapshots = await fetchAllSnapshots(insforge, syncIds);

  // Build per-product map keyed by dropea_id
  // syncs[0] = latest, syncs[1] = previous
  const latestId = syncs[0].id;
  const prevId = syncs.length > 1 ? syncs[1].id : null;

  const latestMap = new Map<string, typeof snapshots[0]>();
  const prevMap = new Map<string, typeof snapshots[0]>();

  for (const snap of snapshots) {
    if (snap.sync_id === latestId) latestMap.set(snap.dropea_id, snap);
    else if (snap.sync_id === prevId) prevMap.set(snap.dropea_id, snap);
  }

  const products = Array.from(latestMap.values()).map((latest) => {
    const prev = prevMap.get(latest.dropea_id);
    return {
      dropea_id: latest.dropea_id,
      sku: latest.sku,
      name: latest.name,
      image: latest.image,
      stock: latest.stock,
      prevStock: prev != null ? prev.stock : null,
      variacion: prev != null ? latest.stock - prev.stock : null,
    };
  });

  return NextResponse.json({ syncs, products });
}

// POST /api/stock — paginated sync (one Dropea page per request, fits Vercel hobby 10s limit)
// Body: {} for page 1 (creates sync), or { syncId, page, done } for subsequent pages
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const insforge = createServiceClient();
  const storeParam = request.nextUrl.searchParams.get("store_id");

  let store;
  try {
    store = storeParam
      ? await requireStore(insforge, storeParam, user.id)
      : await getDefaultStore(insforge, user.id, "dropea");
  } catch {
    return NextResponse.json({ error: "Tienda no encontrada" }, { status: 403 });
  }
  if (!store) return NextResponse.json({ error: "No hay tienda configurada" }, { status: 400 });
  if (!store.dropea_api_key_encrypted) {
    return NextResponse.json({ error: "No hay API key configurada" }, { status: 400 });
  }

  const apiKey = decrypt(store.dropea_api_key_encrypted!);
  const body = await request.json().catch(() => ({})) as { syncId?: string; startPage?: number; done?: number };

  // v2: full catalog in a single pass, one row per product (stock = sum of variants)
  if (store.market) {
    return syncCatalogV2(insforge, store, apiKey, body.syncId);
  }

  const BATCH = 10;
  const startPage = body.startPage ?? 1;

  // First batch: create the sync record
  let syncId: string;
  if (startPage === 1) {
    const { data: syncRow, error: syncErr } = await insforge.database
      .from("stock_syncs")
      .insert({ store_id: store.id, total: 0 })
      .select("id")
      .single();
    if (syncErr || !syncRow) {
      return NextResponse.json({ error: syncErr?.message || "Error al crear sync" }, { status: 500 });
    }
    syncId = syncRow.id;
  } else {
    if (!body.syncId) return NextResponse.json({ error: "syncId requerido" }, { status: 400 });
    syncId = body.syncId;
  }

  // Fetch batch of pages in parallel from Dropea
  const { products, hasMore, total, errors } = await fetchProductPagesBatch(apiKey, startPage, BATCH);

  // Insert this page's snapshots
  if (products.length > 0) {
    const rows = products.map((p) => ({
      sync_id: syncId,
      store_id: store.id,
      dropea_id: p.id,
      sku: p.sku,
      name: p.name,
      image: p.image || null,
      stock: p.stock_available,
    }));
    const { error } = await insforge.database.from("stock_snapshots").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const done = (body.done ?? 0) + products.length;
  const nextPage = startPage + BATCH;

  // If there were errors mid-batch, continue from after the last successful page
  // rather than skipping pages. But since we retry each page individually,
  // nextPage should still be correct. If hasMore is false due to error,
  // the sync is incomplete - log it for visibility.
  const isIncomplete = !hasMore && done < total && total > 0;

  // Last page: update sync total and trim to keep only last 2 syncs
  if (!hasMore) {
    await insforge.database
      .from("stock_syncs")
      .update({ total: done })
      .eq("id", syncId);

    // Delete syncs beyond the 2 most recent
    const { data: allSyncs } = await insforge.database
      .from("stock_syncs")
      .select("id")
      .eq("store_id", store.id)
      .order("synced_at", { ascending: false });

    if (allSyncs && allSyncs.length > 3) {
      const toDelete = allSyncs.slice(3).map((s: { id: string }) => s.id);
      await insforge.database.from("stock_syncs").delete().in("id", toDelete);
    }
  }

  return NextResponse.json({ syncId, nextPage, done, total, hasMore, errors, isIncomplete });
}

async function syncCatalogV2(
  insforge: Awaited<ReturnType<typeof createServiceClient>>,
  store: { id: string; market: string | null },
  apiKey: string,
  existingSyncId?: string
) {
  // Create the sync record
  let syncId: string;
  if (!existingSyncId) {
    const { data: syncRow, error: syncErr } = await insforge.database
      .from("stock_syncs")
      .insert({ store_id: store.id, total: 0 })
      .select("id")
      .single();
    if (syncErr || !syncRow) {
      return NextResponse.json({ error: syncErr?.message || "Error al crear sync" }, { status: 500 });
    }
    syncId = syncRow.id;
  } else {
    syncId = existingSyncId;
  }

  const products = await fetchAllProductsV2(apiKey, store.market!);

  const rows: { sync_id: string; store_id: string; dropea_id: string; sku: string | null; name: string; image: string | null; stock: number }[] =
    products.map((p) => ({
      sync_id: syncId,
      store_id: store.id,
      dropea_id: String(p.id),
      sku: p.variants?.find((v) => v.sku)?.sku ?? null,
      name: p.name,
      image: null,
      stock: (p.variants ?? []).reduce((acc, v) => acc + v.stock, 0),
    }));

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await insforge.database
      .from("stock_snapshots")
      .insert(rows.slice(i, i + batchSize));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const done = rows.length;
  await insforge.database.from("stock_syncs").update({ total: done }).eq("id", syncId);

  // Trim to keep only the 2 most recent syncs
  const { data: allSyncs } = await insforge.database
    .from("stock_syncs")
    .select("id")
    .eq("store_id", store.id)
    .order("synced_at", { ascending: false });

  if (allSyncs && allSyncs.length > 3) {
    const toDelete = allSyncs.slice(3).map((s: { id: string }) => s.id);
    await insforge.database.from("stock_syncs").delete().in("id", toDelete);
  }

  return NextResponse.json({ syncId, nextPage: 1, done, total: done, hasMore: false, errors: 0, isIncomplete: false });
}
