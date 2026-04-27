import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import { fetchAllProducts } from "@/lib/dropea/client";
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

  // Load last 2 syncs
  const { data: syncs } = await insforge.database
    .from("stock_syncs")
    .select("id, synced_at, total")
    .eq("store_id", store.id)
    .order("synced_at", { ascending: false })
    .limit(2);

  if (!syncs || syncs.length === 0) {
    return NextResponse.json({ syncs: [], products: [] });
  }

  const syncIds = syncs.map((s: { id: string }) => s.id);

  // Load snapshots for both syncs
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

  const apiKey = decrypt(store.dropea_api_key_encrypted);
  const products = await fetchAllProducts(apiKey);

  // Insert sync session
  const { data: syncRow, error: syncErr } = await insforge.database
    .from("stock_syncs")
    .insert({ store_id: store.id, total: products.length })
    .select("id, synced_at")
    .single();

  if (syncErr || !syncRow) {
    return NextResponse.json({ error: syncErr?.message || "Error al crear sync" }, { status: 500 });
  }

  // Batch insert snapshots
  const CHUNK = 500;
  for (let i = 0; i < products.length; i += CHUNK) {
    const chunk = products.slice(i, i + CHUNK).map((p) => ({
      sync_id: syncRow.id,
      store_id: store.id,
      dropea_id: p.id,
      sku: p.sku,
      name: p.name,
      image: p.image,
      stock: p.stock_available,
    }));
    const { error } = await insforge.database.from("stock_snapshots").insert(chunk);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ sync_id: syncRow.id, total: products.length, synced_at: syncRow.synced_at });
}
