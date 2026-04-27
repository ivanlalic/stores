import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
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
  if (!store) return NextResponse.json({ error: "No hay tienda configurada" }, { status: 400 });

  // Get all syncs for this store
  const { data: syncs, error: syncsError } = await insforge.database
    .from("stock_syncs")
    .select("id, synced_at, total")
    .eq("store_id", store.id)
    .order("synced_at", { ascending: false });

  if (syncsError) {
    return NextResponse.json({ error: syncsError.message }, { status: 500 });
  }

  if (!syncs || syncs.length === 0) {
    return NextResponse.json({
      storeId: store.id,
      storeName: store.name,
      totalSyncs: 0,
      syncs: [],
      latestCatalogSize: null,
      incompleteSymptoms: [],
    });
  }

  // Count snapshots per sync
  const syncIds = syncs.map((s) => s.id);
  const { data: snapshotCounts, error: countError } = await insforge.database
    .from("stock_snapshots")
    .select("sync_id", { count: "exact" })
    .in("sync_id", syncIds);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  // Get actual per-sync counts via rpc or manual aggregation
  const { data: rows, error: rowsError } = await insforge.database
    .from("stock_snapshots")
    .select("sync_id, stock")
    .in("sync_id", syncIds);

  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 });
  }

  const countBySync = new Map<string, { total: number; zeroStock: number }>();
  for (const r of rows || []) {
    const curr = countBySync.get(r.sync_id) || { total: 0, zeroStock: 0 };
    curr.total++;
    if (r.stock === 0) curr.zeroStock++;
    countBySync.set(r.sync_id, curr);
  }

  // Build enriched sync list
  const enrichedSyncs = syncs.map((s) => {
    const counts = countBySync.get(s.id) || { total: 0, zeroStock: 0 };
    const declared = s.total ?? 0;
    const actual = counts.total;
    const discrepancy = declared > 0 ? declared - actual : 0;
    return {
      ...s,
      declaredTotal: declared,
      actualSnapshotCount: actual,
      zeroStockCount: counts.zeroStock,
      discrepancy,
      isIncomplete: declared > 0 && actual < declared,
      zeroStockRatio: actual > 0 ? counts.zeroStock / actual : 0,
    };
  });

  // Detect symptoms:
  // 1. Syncs where declared total > actual snapshots (pages dropped)
  // 2. Syncs with >80% products at 0 stock (likely a partial early-page scrape)
  const incompleteSymptoms = enrichedSyncs
    .filter((s) => s.isIncomplete || s.zeroStockRatio > 0.8)
    .map((s) => ({
      syncId: s.id,
      syncedAt: s.synced_at,
      declaredTotal: s.declaredTotal,
      actualSnapshotCount: s.actualSnapshotCount,
      zeroStockCount: s.zeroStockCount,
      discrepancy: s.discrepancy,
      symptom: s.isIncomplete
        ? "INCOMPLETE_PAGES"
        : "HIGH_ZERO_STOCK",
      severity: s.discrepancy > 50 ? "high" : s.discrepancy > 10 ? "medium" : "low",
    }));

  // Latest catalog size = count of unique dropea_id in most recent sync
  const latestSyncId = syncs[0].id;
  const { count: latestCatalogSize } = await insforge.database
    .from("stock_snapshots")
    .select("dropea_id", { count: "exact", head: true })
    .eq("sync_id", latestSyncId);

  return NextResponse.json({
    storeId: store.id,
    storeName: store.name,
    totalSyncs: syncs.length,
    syncs: enrichedSyncs.map((s) => ({
      id: s.id,
      syncedAt: s.synced_at,
      declaredTotal: s.declaredTotal,
      actualSnapshotCount: s.actualSnapshotCount,
      zeroStockCount: s.zeroStockCount,
      discrepancy: s.discrepancy,
      isIncomplete: s.isIncomplete,
      zeroStockRatio: Math.round(s.zeroStockRatio * 100) / 100,
    })),
    latestCatalogSize,
    incompleteSymptoms,
  });
}
