import { createClient as createInsforgeClient } from "@insforge/sdk";
import { cookies } from "next/headers";

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;
const API_KEY = process.env.INSFORGE_API_KEY!;

export async function createClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get("insforge_token")?.value;
  return createInsforgeClient({
    baseUrl: BASE_URL,
    anonKey: token || ANON_KEY,
  });
}

export function createServiceClient() {
  return createInsforgeClient({
    baseUrl: BASE_URL,
    anonKey: API_KEY,
  });
}

export async function getUser(): Promise<{ id: string } | null> {
  const cookieStore = await cookies();
  const uid = cookieStore.get("insforge_uid")?.value;
  const token = cookieStore.get("insforge_token")?.value;
  if (!uid || !token) return null;
  return { id: uid };
}
