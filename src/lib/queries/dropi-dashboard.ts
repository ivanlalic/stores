import { createServiceClient } from "@/lib/insforge/server";

type InsforgeClient = ReturnType<typeof createServiceClient>;

export interface DropiDailyRow {
  fecha: string;
  pedidos: number;
  enviados: number;
  entregados: number;
  rechazados: number;
  cancelados: number;
  pendientes: number;
  tasa_entrega: number;
  ventas: number;
  bruto: number;       // neto_entregados + neto_rechazados (before ads)
  meta_ads: number;
  tiktok_ads: number;
  total_ads: number;
  pnl_real: number;   // bruto - total_ads
  pct_margin: number;
}

export async function getDropiDailyDashboard(
  insforge: InsforgeClient,
  userId: string,
  month: string
): Promise<DropiDailyRow[]> {
  const startDate = `${month}-01`;
  const [year, m] = month.split("-").map(Number);
  const endDate = new Date(year, m, 0).toISOString().split("T")[0];

  const PAGE_SIZE = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pedidos: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data } = await insforge.database
      .from("dropi_pedidos")
      .select("*")
      .eq("user_id", userId)
      .gte("fecha", startDate)
      .lte("fecha", endDate)
      .order("fecha", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    const rows = data || [];
    pedidos = pedidos.concat(rows);
    hasMore = rows.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  const { data: ads } = await insforge.database
    .from("dropi_ads_diario")
    .select("*")
    .eq("user_id", userId)
    .gte("fecha", startDate)
    .lte("fecha", endDate);

  const adsMap = new Map<string, { meta_ads: number; tiktok_ads: number }>();
  (ads || []).forEach((a) => {
    adsMap.set(a.fecha, {
      meta_ads: Number(a.meta_ads) || 0,
      tiktok_ads: Number(a.tiktok_ads) || 0,
    });
  });

  const dayMap = new Map<string, typeof pedidos>();
  pedidos.forEach((p) => {
    const day = p.fecha;
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(p);
  });

  const rows: DropiDailyRow[] = [];

  for (let d = 1; d <= new Date(year, m, 0).getDate(); d++) {
    const fecha = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayPedidos = dayMap.get(fecha) || [];
    const dayAds = adsMap.get(fecha) || { meta_ads: 0, tiktok_ads: 0 };

    if (dayPedidos.length === 0 && dayAds.meta_ads === 0 && dayAds.tiktok_ads === 0) {
      const dateObj = new Date(fecha);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateObj > today) continue;
    }

    const total = dayPedidos.length;
    const enviados = dayPedidos.filter((p) => p.es_enviado).length;
    const entregados = dayPedidos.filter((p) => p.es_entregado).length;
    const rechazados = dayPedidos.filter((p) => p.es_rechazado).length;
    const cancelados = dayPedidos.filter((p) => p.es_cancelado).length;
    const pendientes = Math.max(0, enviados - entregados - rechazados);

    // ventas: sum stored venta (already 0 for cancelado/pendiente/nuevo)
    const ventas = dayPedidos.reduce((sum, p) => sum + Number(p.venta), 0);

    const netoEntregados = dayPedidos
      .filter((p) => p.es_entregado)
      .reduce((sum, p) => sum + Number(p.neto), 0);
    const netoRechazados = dayPedidos
      .filter((p) => p.es_rechazado)
      .reduce((sum, p) => sum + Number(p.neto), 0);

    // bruto: realized gross before ads (entregados + rechazados neto)
    const bruto = netoEntregados + netoRechazados;

    const meta_ads = dayAds.meta_ads;
    const tiktok_ads = dayAds.tiktok_ads;
    const total_ads = meta_ads + tiktok_ads;
    const pnl_real = netoEntregados + netoRechazados - total_ads;
    const tasa_entrega = enviados > 0 ? entregados / enviados : 0;
    const pct_margin = ventas > 0 ? pnl_real / ventas : 0;

    rows.push({
      fecha,
      pedidos: total,
      enviados,
      entregados,
      rechazados,
      cancelados,
      pendientes,
      tasa_entrega,
      ventas: Math.round(ventas * 100) / 100,
      bruto: Math.round(bruto * 100) / 100,
      meta_ads,
      tiktok_ads,
      total_ads,
      pnl_real: Math.round(pnl_real * 100) / 100,
      pct_margin,
    });
  }

  return rows;
}
