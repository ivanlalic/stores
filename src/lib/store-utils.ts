import { createServiceClient } from "@/lib/insforge/server";
import type { AdChannelConfig } from "@/lib/ads";

type InsforgeClient = ReturnType<typeof createServiceClient>;

export interface StoreRow {
  id: string;
  user_id: string;
  name: string;
  type: "dropea" | "dropi";
  dropea_api_key_encrypted: string | null;
  dropea_email_encrypted: string | null;
  dropea_pwd_encrypted: string | null;
  dropea_shop_id: number | null;
  dropea_webhook_secret_encrypted: string | null;
  market: string | null;
  fee_gestion_eur: number;
  costo_rechazo: number;
  dias_rolling: number;
  dias_excluir: number;
  dropi_email_encrypted: string | null;
  dropi_pwd_encrypted: string | null;
  ads_label_1: string | null;
  ads_label_2: string | null;
  ads_channels: AdChannelConfig[] | null;
  created_at: string;
  updated_at: string;
}

export interface StoreAccess extends StoreRow {
  isOwner: boolean;
}

// Owner only — throws 403 if not owner
export async function requireStoreOwner(
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

// Owner OR member — throws 403 if neither
export async function requireStore(
  insforge: InsforgeClient,
  storeId: string,
  userId: string
): Promise<StoreAccess> {
  const { data: store } = await insforge.database
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .maybeSingle();

  if (!store) {
    throw Object.assign(new Error("Store not found or access denied"), { status: 403 });
  }
  if (store.user_id === userId) {
    return { ...(store as StoreRow), isOwner: true };
  }
  const { data: member } = await insforge.database
    .from("store_members")
    .select("user_id")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    throw Object.assign(new Error("Store not found or access denied"), { status: 403 });
  }
  return { ...(store as StoreRow), isOwner: false };
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
