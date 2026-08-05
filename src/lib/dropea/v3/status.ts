import type { createServiceClient } from "@/lib/insforge/server";

export interface CostConfig {
  market: string;
  envio: number;
  cod_fee: number;
  valid_from: string | null;
}

export async function getConfigsV3(
  insforge: ReturnType<typeof createServiceClient>
): Promise<CostConfig[]> {
  const { data } = await insforge.database
    .from("config_v3")
    .select("market, envio, cod_fee, valid_from")
    .order("valid_from", { ascending: true });
  return (data || []) as CostConfig[];
}

// Elige la config vigente para un mercado en una fecha: la ultima con
// valid_from <= fecha; si ninguna, la mas antigua (fallback).
export function resolveCostsV3(
  configs: CostConfig[],
  market: string,
  fecha?: string | null
): { envio: number; cod_fee: number } {
  const rows = configs.filter((c) => c.market.toUpperCase() === market.toUpperCase());
  if (rows.length === 0) {
    throw new Error(`Costes de mercado no definidos para market=${market} en config_v3`);
  }
  const date = fecha ? new Date(fecha + "T00:00:00") : null;
  const valid = rows.filter(
    (c) => !c.valid_from || !date || new Date(c.valid_from + "T00:00:00") <= date
  );
  const chosen = valid.length > 0 ? valid[valid.length - 1] : rows[0];
  return { envio: Number(chosen.envio) || 0, cod_fee: Number(chosen.cod_fee) || 0 };
}
