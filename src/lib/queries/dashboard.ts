import { createServiceClient } from "@/lib/supabase/server";

export interface DailyRow {
  fecha: string;
  pedidos: number;
  enviados: number;
  entregados: number;
  rechazados: number;
  cancelados: number;
  pendientes: number;
  tasa_entrega: number;
  ventas: number;
  bruto: number;
  meta_ads: number;
  tiktok_ads: number;
  total_ads: number;
  gestion: number;
  gastos: number;
  pnl_teorico: number;
  pnl_real: number;
  pct_margin: number;
  cpa_enviado: number;
  cpa_real: number;
}

export interface MonthlyRow {
  mes: string;
  ventas: number;
  pedidos: number;
  enviados: number;
  entregados: number;
  rechazados: number;
  cancelados: number;
  pendientes: number;
  tasa_entrega: number;
  ticket_promedio: number;
  bruto: number;
  total_ads: number;
  gestion: number;
  gastos: number;
  pnl_real: number;
  pnl_ajustado: number;
  cpa_enviado: number;
  cpa_real: number;
  pct_gastos: number;
  pct_pnl: number;
  pct_pnl_ajustado: number;
  reserva: number;
}

export async function getDailyDashboard(
  userId: string,
  month: string, // YYYY-MM
  feeGestionEur: number
): Promise<DailyRow[]> {
  const supabase = await createServiceClient();

  const startDate = `${month}-01`;
  const [year, m] = month.split("-").map(Number);
  const endDate = new Date(year, m, 0).toISOString().split("T")[0];

  // Get pedidos grouped by day
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("*")
    .eq("user_id", userId)
    .gte("fecha", startDate)
    .lte("fecha", endDate)
    .order("fecha", { ascending: true });

  // Get ads for this month
  const { data: ads } = await supabase
    .from("ads_diario")
    .select("*")
    .eq("user_id", userId)
    .gte("fecha", startDate)
    .lte("fecha", endDate);

  // Build ads map
  const adsMap = new Map<string, { meta_ads: number; tiktok_ads: number }>();
  (ads || []).forEach((a) => {
    adsMap.set(a.fecha, {
      meta_ads: Number(a.meta_ads) || 0,
      tiktok_ads: Number(a.tiktok_ads) || 0,
    });
  });

  // Group pedidos by day
  const dayMap = new Map<string, typeof pedidos>();
  (pedidos || []).forEach((p) => {
    const day = p.fecha;
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(p);
  });

  const rows: DailyRow[] = [];

  // Generate all days of the month
  for (let d = 1; d <= new Date(year, m, 0).getDate(); d++) {
    const fecha = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayPedidos = dayMap.get(fecha) || [];
    const dayAds = adsMap.get(fecha) || { meta_ads: 0, tiktok_ads: 0 };

    if (dayPedidos.length === 0 && dayAds.meta_ads === 0 && dayAds.tiktok_ads === 0) {
      // Only include days with data
      // But still include if today or past
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
    const pendientes = enviados - entregados - rechazados;

    // Ventas y bruto = sobre todos los enviados (igual que el Excel)
    const ventas = dayPedidos
      .filter((p) => p.es_enviado)
      .reduce((sum, p) => sum + Number(p.venta), 0);

    const bruto = dayPedidos
      .filter((p) => p.es_enviado)
      .reduce((sum, p) => sum + Number(p.neto), 0);

    // Neto solo de pedidos con estado final (entregados + rechazados)
    const netoEntregados = dayPedidos
      .filter((p) => p.es_entregado)
      .reduce((sum, p) => sum + Number(p.neto), 0);
    const netoRechazados = dayPedidos
      .filter((p) => p.es_rechazado)
      .reduce((sum, p) => sum + Number(p.neto), 0);

    const meta_ads = dayAds.meta_ads;
    const tiktok_ads = dayAds.tiktok_ads;
    const total_ads = meta_ads + tiktok_ads;
    const gestion = enviados * feeGestionEur;
    const gastos = total_ads + gestion;
    const pnl_teorico = bruto - gastos;
    const pnl_real = netoEntregados + netoRechazados - gastos;
    const tasa_entrega = enviados > 0 ? entregados / enviados : 0;
    const pct_margin = ventas > 0 ? pnl_real / ventas : 0;
    const cpa_enviado = enviados > 0 ? total_ads / enviados : 0;
    const cpa_real = entregados > 0 ? total_ads / entregados : 0;

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
      gestion: Math.round(gestion * 100) / 100,
      gastos: Math.round(gastos * 100) / 100,
      pnl_teorico: Math.round(pnl_teorico * 100) / 100,
      pnl_real: Math.round(pnl_real * 100) / 100,
      pct_margin,
      cpa_enviado: Math.round(cpa_enviado * 100) / 100,
      cpa_real: Math.round(cpa_real * 100) / 100,
    });
  }

  return rows;
}

export async function getMonthlyDashboard(
  userId: string,
  feeGestionEur: number
): Promise<MonthlyRow[]> {
  const supabase = await createServiceClient();

  // Get all pedidos
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("*")
    .eq("user_id", userId)
    .order("fecha", { ascending: true });

  // Get all ads
  const { data: ads } = await supabase
    .from("ads_diario")
    .select("*")
    .eq("user_id", userId);

  // Group by month
  const monthPedidos = new Map<string, typeof pedidos>();
  const monthAds = new Map<string, { meta: number; tiktok: number }>();

  (pedidos || []).forEach((p) => {
    const mes = p.fecha.substring(0, 7); // YYYY-MM
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

  // Get all unique months
  const allMonths = new Set([...monthPedidos.keys(), ...monthAds.keys()]);
  const sortedMonths = Array.from(allMonths).sort();

  const rows: MonthlyRow[] = [];

  for (const mes of sortedMonths) {
    const mp = monthPedidos.get(mes) || [];
    const ma = monthAds.get(mes) || { meta: 0, tiktok: 0 };

    const total = mp.length;
    const enviados = mp.filter((p) => p.es_enviado).length;
    const entregados = mp.filter((p) => p.es_entregado).length;
    const rechazados = mp.filter((p) => p.es_rechazado).length;
    const cancelados = mp.filter((p) => p.es_cancelado).length;
    const pendientes = enviados - entregados - rechazados;

    // Ventas y bruto = sobre todos los enviados (igual que el Excel)
    const ventas = mp
      .filter((p) => p.es_enviado)
      .reduce((sum, p) => sum + Number(p.venta), 0);

    const bruto = mp
      .filter((p) => p.es_enviado)
      .reduce((sum, p) => sum + Number(p.neto), 0);

    // Neto solo de pedidos con estado final (entregados + rechazados)
    const netoEntregados = mp
      .filter((p) => p.es_entregado)
      .reduce((sum, p) => sum + Number(p.neto), 0);
    const netoRechazados = mp
      .filter((p) => p.es_rechazado)
      .reduce((sum, p) => sum + Number(p.neto), 0);

    const total_ads = ma.meta + ma.tiktok;
    const gestion = enviados * feeGestionEur;
    const gastos = total_ads + gestion;
    const pnl_real = netoEntregados + netoRechazados - gastos;

    // P&L ajustado: subtract €13 per pending order
    const COSTO_PENDIENTE = 13;
    const reserva = pendientes * COSTO_PENDIENTE;
    const pnl_ajustado = pnl_real - reserva;

    const tasa_entrega = enviados > 0 ? entregados / enviados : 0;
    const ticket_promedio = enviados > 0 ? ventas / enviados : 0;
    const cpa_enviado = enviados > 0 ? total_ads / enviados : 0;
    const cpa_real = entregados > 0 ? total_ads / entregados : 0;
    const pct_gastos = ventas > 0 ? gastos / ventas : 0;
    const pct_pnl = ventas > 0 ? pnl_real / ventas : 0;

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
      gestion: Math.round(gestion * 100) / 100,
      gastos: Math.round(gastos * 100) / 100,
      pnl_real: Math.round(pnl_real * 100) / 100,
      pnl_ajustado: Math.round(pnl_ajustado * 100) / 100,
      cpa_enviado: Math.round(cpa_enviado * 100) / 100,
      cpa_real: Math.round(cpa_real * 100) / 100,
      pct_gastos,
      pct_pnl,
      pct_pnl_ajustado: ventas > 0 ? pnl_ajustado / ventas : 0,
      reserva: Math.round(reserva * 100) / 100,
    });
  }

  return rows;
}
