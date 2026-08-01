import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import { fetchAllProductsV2 } from "@/lib/dropea/v2/client";
import { mapProductV2, upsertProducts } from "@/lib/dropea/v2/products";
import { getDefaultStore, requireStore, type StoreRow } from "@/lib/store-utils";

type StoreResult = StoreRow & { isOwner?: boolean };

async function resolveStore(
  request: NextRequest,
  user: { id: string }
): Promise<StoreResult> {
  const insforge = createServiceClient();
  const storeParam = request.nextUrl.searchParams.get("store_id");
  if (storeParam) {
    return await requireStore(insforge, storeParam, user.id);
  }
  const defaultStore = await getDefaultStore(insforge, user.id, "dropea");
  if (!defaultStore) {
    throw new Error("No hay tienda configurada");
  }
  return defaultStore;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const insforge = createServiceClient();
    const store = await resolveStore(request, user);
    const { data, error } = await insforge.database
      .from("productos")
      .select("*")
      .eq("store_id", store.id)
      .order("product_name", { ascending: true })
      .order("dropea_variant_id", { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json({ rows: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const insforge = createServiceClient();
    const store = await resolveStore(request, user);

    if (!store.market) {
      return NextResponse.json({
        message: "Catálogo v2 no disponible para esta tienda (market no configurado)",
      });
    }

    if (!store.dropea_api_key_encrypted) {
      return NextResponse.json({ error: "No hay API key configurada" }, { status: 400 });
    }

    const apiKey = decrypt(store.dropea_api_key_encrypted);
    const products = await fetchAllProductsV2(apiKey, store.market);
    const rows = products.flatMap((p) => mapProductV2(p, store.id));

    const { added, updated } = await upsertProducts(insforge, store.id, rows);

    return NextResponse.json({
      added,
      updated,
      message: `Catálogo actualizado: ${added} nuevos, ${updated} actualizados`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
