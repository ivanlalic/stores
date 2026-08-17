export interface AdChannelConfig {
  name: string;
  fee_pct: number;
}

export interface AdChannel {
  name: string;
  base: number;
  fee_pct: number;
  total: number;
}

export function channelTotal(base: number, feePct: number): number {
  return Math.round(base * (1 + (feePct || 0) / 100) * 100) / 100;
}

export function channelBase(total: number, feePct: number): number {
  return feePct > 0 ? Math.round((total / (1 + feePct / 100)) * 100) / 100 : total;
}

export function channelCommission(base: number, feePct: number): number {
  return feePct > 0 ? Math.round(base * (feePct / 100) * 100) / 100 : 0;
}

export function sumAds(channels: AdChannel[]): { total_ads: number; total_commission: number } {
  const total_ads = channels.reduce((s, c) => s + c.total, 0);
  const total_commission = channels.reduce((s, c) => s + channelCommission(c.base, c.fee_pct), 0);
  return {
    total_ads: Math.round(total_ads * 100) / 100,
    total_commission: Math.round(total_commission * 100) / 100,
  };
}

// Construye canales desde el formato antiguo (meta_ads/tiktok_ads) para fallback.
export function buildChannelsFromLegacy(
  meta_ads: number,
  tiktok_ads: number,
  meta_fee: number,
  tiktok_fee: number,
  names: [string, string]
): AdChannel[] {
  const out: AdChannel[] = [];
  if ((meta_ads ?? 0) > 0 || (meta_fee ?? 0) > 0) {
    out.push({ name: names[0], base: channelBase(meta_ads || 0, meta_fee || 0), fee_pct: meta_fee || 0, total: meta_ads || 0 });
  }
  if ((tiktok_ads ?? 0) > 0 || (tiktok_fee ?? 0) > 0) {
    out.push({ name: names[1], base: channelBase(tiktok_ads || 0, tiktok_fee || 0), fee_pct: tiktok_fee || 0, total: tiktok_ads || 0 });
  }
  return out;
}
