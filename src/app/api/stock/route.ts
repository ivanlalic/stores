import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import { fetchProductPage } from "@/lib/dropea/client";
import { getDefaultStore, requireStore } from "@/lib/store-utils";

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

  // Load snapshots for top 2 syncs
  const { data: snapshots } = await insforge.database
    .from("stock_snapshots")
    .select("sync_id, dropea_id, sku, name, image, stock")
    .in("sync_id", syncIds);

  if (!snapshots) return NextResponse.json({ syncs, products: [] });

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
  const body = await request.json().catch(() => ({})) as { syncId?: string; page?: number; done?: number };
  const page = body.page ?? 1;

  // Page 1: create the sync record
  let syncId: string;
  if (page === 1) {
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

  // Fetch one page from Dropea
  const { products, hasMore, total } = await fetchProductPage(apiKey, page);

  // Insert this page's snapshots
  if (products.length > 0) {
    const rows = products.map((p) => ({
      sync_id: syncId,
      store_id: store.id,
      dropea_id: p.id,
      sku: p.sku,
      name: p.name,
      image: p.image,
      stock: p.stock_available,
    }));
    const { error } = await insforge.database.from("stock_snapshots").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const done = (body.done ?? 0) + products.length;

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

  return NextResponse.json({ syncId, page, done, total, hasMore });
}
