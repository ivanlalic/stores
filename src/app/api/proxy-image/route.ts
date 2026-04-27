import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import { getDefaultStore, requireStore } from "@/lib/store-utils";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new Response("url required", { status: 400 });

  const insforge = createServiceClient();
  const storeParam = request.nextUrl.searchParams.get("store_id");

  let store;
  try {
    store = storeParam
      ? await requireStore(insforge, storeParam, user.id)
      : await getDefaultStore(insforge, user.id, "dropea");
  } catch {
    return new Response("Store not found", { status: 403 });
  }
  if (!store?.dropea_api_key_encrypted) {
    return new Response("No API key", { status: 400 });
  }

  const apiKey = decrypt(store.dropea_api_key_encrypted);

  try {
    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!res.ok) return new Response(`Dropea ${res.status}`, { status: res.status });
    const blob = await res.blob();
    return new Response(blob, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
