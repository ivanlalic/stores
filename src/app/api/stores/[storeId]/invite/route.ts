import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { requireStoreOwner } from "@/lib/store-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId } = await params;
  const insforge = createServiceClient();

  try {
    await requireStoreOwner(insforge, storeId, user.id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 403 });
  }

  const { data, error } = await insforge.database
    .from("store_invites")
    .insert([{ store_id: storeId, created_by: user.id, role: "editor" }])
    .select("token")
    .single();

  if (error || !data) return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });

  const origin = request.headers.get("origin") ?? "https://stores-steel.vercel.app";
  return NextResponse.json({ inviteUrl: `${origin}/invite/${data.token}` });
}
