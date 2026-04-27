import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ syncId: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { syncId } = await params;
  const insforge = createServiceClient();

  // Verify ownership: sync must belong to a store owned by this user
  const { data: sync } = await insforge.database
    .from("stock_syncs")
    .select("id, store_id, stores!inner(user_id)")
    .eq("id", syncId)
    .maybeSingle();

  if (!sync) return NextResponse.json({ error: "Sync no encontrado" }, { status: 404 });

  const storeOwner = (sync as { stores: { user_id: string } }).stores?.user_id;
  if (storeOwner !== user.id) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { error } = await insforge.database
    .from("stock_syncs")
    .delete()
    .eq("id", syncId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
