import { createClient as createInsforgeClient } from "@insforge/sdk";

export function createClient() {
  return createInsforgeClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });
}
