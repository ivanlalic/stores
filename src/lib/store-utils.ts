import { createServiceClient } from "@/lib/insforge/server";

type InsforgeClient = ReturnType<typeof createServiceClient>;

export interface StoreRow {
  id: string;
  user_id: string;
  name: string;
  type: "dropea" | "dropi";
  dropea_api_key_encrypted: string | null;
  fee_gestion_eur: number;
  costo_rechazo: number;
  dias_rolling: number;
  dias_excluir: number;
  dropi_email_encrypted: string | null;
  dropi_pwd_encrypted: string | null;
  created_at: string;
  updated_at: string;
}

export async function requireStore(
  insforge: InsforgeClient,
  storeId: string,
  userId: string
): Promise<StoreRow> {
  const { data, error } = await insforge.database
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw Object.assign(new Error("Store not found or access denied"), { status: 403 });
  }
  return data as StoreRow;
}

export async function getDefaultStore(
  insforge: InsforgeClient,
  userId: string,
  type: "dropea" | "dropi"
): Promise<StoreRow | null> {
  const { data } = await insforge.database
    .from("stores")
    .select("*")
    .eq("user_id", userId)
    .eq("type", type)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as StoreRow) || null;
}
