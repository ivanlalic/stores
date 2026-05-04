import { createServiceClient } from "@/lib/insforge/server";
import type { MonthlyRow } from "@/lib/queries/dashboard";

type InsforgeClient = ReturnType<typeof createServiceClient>;

async function fetchAllDropiByStore(
  insforge: InsforgeClient,
  table: string,
  storeId: string,
  orderBy?: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    let query = insforge.database
      .from(table)
      .select("*")
      .eq("store_id", storeId)
      .range(from, from + PAGE_SIZE - 1);
    if (orderBy) query = query.order(orderBy, { ascending: true });
    const { data } = await query;
    const rows = data || [];
    allData = allData.concat(rows);
    hasMore = rows.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return allData;
}

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
  bruto: number;       // margin on venta orders + return costs from rechazados
  meta_ads: number;
  tiktok_ads: number;
  total_ads: number;
  pnl_teorico: number; // bruto (all venta orders + return costs) - ads
  pnl_real: number;    // only entregados + return costs - ads
  pct_margin: number;
}

export async function getDropiDailyDashboard(
  insforge: InsforgeClient,
  storeId: string,
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
      .eq("store_id", storeId)
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
    .eq("store_id", storeId)
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

    // ventas = all confirmed orders except rechazados (rehusado/devuelto)
    // nuevo/duplicado/no-confirmable already have venta=0 stored from sync
    const ventaOrders = dayPedidos.filter((p) => !p.es_rechazado);
    const ventas = ventaOrders.reduce((sum, p) => sum + Number(p.venta), 0);

    // bruto = margin on venta orders + return costs from rechazados (neto = -6.20 each)
    const bruto =
      ventaOrders.filter((p) => Number(p.venta) > 0).reduce((sum, p) => sum + Number(p.neto), 0) +
      dayPedidos.filter((p) => p.es_rechazado).reduce((sum, p) => sum + Number(p.neto), 0);

    const meta_ads = dayAds.meta_ads;
    const tiktok_ads = dayAds.tiktok_ads;
    const total_ads = meta_ads + tiktok_ads;
    const pnl_teorico = bruto - total_ads;
    const pnl_real =
      dayPedidos.filter((p) => p.es_entregado).reduce((sum, p) => sum + Number(p.neto), 0) +
      dayPedidos.filter((p) => p.es_rechazado).reduce((sum, p) => sum + Number(p.neto), 0) -
      total_ads;
    const tasa_entrega = enviados > 0 ? entregados / enviados : 0;
    const pct_margin = ventas > 0 ? pnl_teorico / ventas : 0;

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
      pnl_teorico: Math.round(pnl_teorico * 100) / 100,
      pnl_real: Math.round(pnl_real * 100) / 100,
      pct_margin,
    });
  }

  return rows;
}

export async function getDropiMonthlyDashboard(
  insforge: InsforgeClient,
  storeId: string
): Promise<MonthlyRow[]> {
  const pedidos = await fetchAllDropiByStore(insforge, "dropi_pedidos", storeId, "fecha");
  const ads = await fetchAllDropiByStore(insforge, "dropi_ads_diario", storeId);

  const monthPedidos = new Map<string, typeof pedidos>();
  const monthAds = new Map<string, { meta: number; tiktok: number }>();

  (pedidos || []).forEach((p) => {
    const mes = p.fecha.substring(0, 7);
    if (!monthPedidos.has(mes)) monthPedidos.set(mes, []);
    monthPedidos.get(mes)!.push(p);
  });

  (ads || []).forEach((a) => {
    const mes = a.fecha.substring(0, 7);
    const current = monthAds.get(mes) || { meta: 0, tiktok: 0 };
    current.meta += Number(a.meta_ads) || 0;
    current.tiktok += Number(a.tiktok_ads) || 0;
    monthAds.set(mes, current);
  });

  const allMonths = new Set([...monthPedidos.keys(), ...monthAds.keys()]);
  const sortedMonths = Array.from(allMonths).sort();

  const rows: MonthlyRow[] = [];

  for (const mes of sortedMonths) {
    const mp = monthPedidos.get(mes) || [];
    const ma = monthAds.get(mes) || { meta: 0, tiktok: 0 };

    const enviados = mp.filter((p) => p.es_enviado).length;
    const entregados = mp.filter((p) => p.es_entregado).length;
    const rechazados = mp.filter((p) => p.es_rechazado).length;
    const cancelados = mp.filter((p) => p.es_cancelado).length;
    const pendientes = Math.max(0, enviados - entregados - rechazados);

    const ventaOrders = mp.filter((p) => !p.es_rechazado);
    const ventas = ventaOrders.reduce((sum, p) => sum + Number(p.venta), 0);

    const bruto =
      ventaOrders.filter((p) => Number(p.venta) > 0).reduce((sum, p) => sum + Number(p.neto), 0) +
      mp.filter((p) => p.es_rechazado).reduce((sum, p) => sum + Number(p.neto), 0);

    const netoEntregados = mp.filter((p) => p.es_entregado).reduce((sum, p) => sum + Number(p.neto), 0);
    const netoRechazados = mp.filter((p) => p.es_rechazado).reduce((sum, p) => sum + Number(p.neto), 0);

    const total_ads = ma.meta + ma.tiktok;
    const gestion = 0;
    const gastos = total_ads;
    const pnl_real = netoEntregados + netoRechazados - gastos;
    const pnl_teorico = bruto - gastos;

    const COSTO_PENDIENTE = 13;
    const reserva = pendientes * COSTO_PENDIENTE;
    const pnl_ajustado = pnl_real - reserva;

    const tasa_entrega = enviados > 0 ? entregados / enviados : 0;
    const ticket_promedio = enviados > 0 ? ventas / enviados : 0;
    const cpa_enviado = enviados > 0 ? total_ads / enviados : 0;
    const cpa_real = entregados > 0 ? total_ads / entregados : 0;
    const pct_gastos = ventas > 0 ? gastos / ventas : 0;
    const pnl_real_ventas = ventas > 0 ? pnl_real / ventas : 0;

    rows.push({
      mes,
      ventas: Math.round(ventas * 100) / 100,
      pedidos: enviados,
      enviados,
      entregados,
      rechazados,
      cancelados,
      pendientes,
      tasa_entrega,
      ticket_promedio: Math.round(ticket_promedio * 100) / 100,
      bruto: Math.round(bruto * 100) / 100,
      total_ads,
      gestion,
      gastos: Math.round(gastos * 100) / 100,
      pnl_teorico: Math.round(pnl_teorico * 100) / 100,
      pnl_real: Math.round(pnl_real * 100) / 100,
      pnl_ajustado: Math.round(pnl_ajustado * 100) / 100,
      cpa_enviado: Math.round(cpa_enviado * 100) / 100,
      cpa_real: Math.round(cpa_real * 100) / 100,
      pct_gastos,
      pct_pnl: pnl_real_ventas,
      pct_pnl_ajustado: ventas > 0 ? pnl_ajustado / ventas : 0,
      reserva: Math.round(reserva * 100) / 100,
    });
  }

  return rows;
}
