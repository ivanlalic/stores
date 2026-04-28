import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import { requireStore, getDefaultStore } from "@/lib/store-utils";
import { loginDropipro, scrapeProductPage } from "@/lib/dropipro/scraper";

async function fetchAllSnapshots(
  insforge: Awaited<ReturnType<typeof createServiceClient>>,
  syncIds: string[]
) {
  const pageSize = 1000;
  let offset = 0;
  const all: { sync_id: string; dropea_id: string; name: string; image: string | null; stock: number }[] = [];
  while (true) {
    const { data } = await insforge.database
      .from("stock_snapshots")
      .select("sync_id, dropea_id, name, image, stock")
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
      : await getDefaultStore(insforge, user.id, "dropi");
  } catch {
    return NextResponse.json({ error: "Tienda no encontrada" }, { status: 403 });
  }
  if (!store) return NextResponse.json({ syncs: [], products: [] });

  const { data: syncs } = await insforge.database
    .from("stock_syncs")
    .select("id, synced_at, total")
    .eq("store_id", store.id)
    .order("synced_at", { ascending: false })
    .limit(3);

  if (!syncs || syncs.length === 0) return NextResponse.json({ syncs: [], products: [] });

  const syncIds = syncs.slice(0, 2).map((s: { id: string }) => s.id);
  const snapshots = await fetchAllSnapshots(insforge, syncIds);

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
      dropi_id: latest.dropea_id,
      name: latest.name,
      image: latest.image,
      stock: latest.stock,
      prevStock: prev != null ? prev.stock : null,
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
      : await getDefaultStore(insforge, user.id, "dropi");
  } catch {
    return NextResponse.json({ error: "Tienda no encontrada" }, { status: 403 });
  }
  if (!store) return NextResponse.json({ error: "No hay tienda configurada" }, { status: 400 });
  if (!store.dropi_email_encrypted || !store.dropi_pwd_encrypted) {
    return NextResponse.json({ error: "No hay credenciales de Dropipro configuradas" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({})) as {
    syncId?: string;
    page?: number;
    done?: number;
    sessionCookies?: string;
  };

  const page = body.page ?? 1;

  // First page: login + create sync record
  let syncId: string;
  let sessionCookies: string;

  if (page === 1) {
    const email = decrypt(store.dropi_email_encrypted);
    const pwd = decrypt(store.dropi_pwd_encrypted);
    sessionCookies = await loginDropipro(email, pwd);

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
    if (!body.syncId || !body.sessionCookies) {
      return NextResponse.json({ error: "syncId y sessionCookies requeridos" }, { status: 400 });
    }
    syncId = body.syncId;
    sessionCookies = body.sessionCookies;
  }

  const { products, hasMore } = await scrapeProductPage(sessionCookies, page);

  if (products.length > 0) {
    const rows = products.map((p) => ({
      sync_id: syncId,
      store_id: store.id,
      dropea_id: p.id,
      sku: null,
      name: p.name,
      image: p.image,
      stock: p.stock,
    }));
    const { error } = await insforge.database.from("stock_snapshots").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const done = (body.done ?? 0) + products.length;
  const nextPage = page + 1;

  if (!hasMore) {
    await insforge.database.from("stock_syncs").update({ total: done }).eq("id", syncId);

    // Keep only last 3 syncs
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

  return NextResponse.json({ syncId, sessionCookies, nextPage, done, hasMore });
}
