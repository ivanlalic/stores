import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const insforge = createServiceClient();

  const { data } = await insforge.database
    .from("store_invites")
    .select("id, store_id, used_at, stores(name)")
    .eq("token", token)
    .maybeSingle();

  if (!data || data.used_at) {
    return NextResponse.json({ valid: false });
  }

  const storeData = Array.isArray(data.stores) ? data.stores[0] : data.stores;
  const storeName = (storeData as { name: string } | null)?.name ?? "";
  return NextResponse.json({ valid: true, storeName, storeId: data.store_id });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;
  const insforge = createServiceClient();

  const { data: invite } = await insforge.database
    .from("store_invites")
    .select("*")
    .eq("token", token)
    .is("used_at", null)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "Invite invalid or already used" }, { status: 410 });

  // Check not already owner
  const { data: store } = await insforge.database
    .from("stores")
    .select("user_id")
    .eq("id", invite.store_id)
    .single();

  if (store?.user_id === user.id) {
    return NextResponse.json({ error: "Already owner" }, { status: 409 });
  }

  // Check not already member
  const { data: existing } = await insforge.database
    .from("store_members")
    .select("user_id")
    .eq("store_id", invite.store_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Already member" }, { status: 409 });

  const { error: insertError } = await insforge.database
    .from("store_members")
    .insert([{ store_id: invite.store_id, user_id: user.id, role: invite.role }]);

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await insforge.database
    .from("store_invites")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ success: true, storeId: invite.store_id });
}
