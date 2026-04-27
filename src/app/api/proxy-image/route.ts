import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import { getDefaultStore, requireStore } from "@/lib/store-utils";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url requerida" }, { status: 400 });

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
  if (!store?.dropea_api_key_encrypted) {
    return NextResponse.json({ error: "No hay API key" }, { status: 400 });
  }

  const apiKey = decrypt(store.dropea_api_key_encrypted);

  try {
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Dropea error ${res.status}` },
        { status: res.status }
      );
    }

    const blob = await res.blob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Error descargando imagen" }, { status: 500 });
  }
}
