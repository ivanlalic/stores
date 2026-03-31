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

  // Get pedidos grouped by day (paginated to avoid 1000-row limit)
  const PAGE_SIZE = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pedidos: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data } = await supabase
      .from("pedidos")
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

export interface BreakevenMetrics {
  margen_variable: number;
  bruto_por_enviado: number;
  tasa_rechazo: number;
  ads_promedio_diario: number;
  ticket_promedio: number;
  enviados_promedio_diario: number;
  breakeven_enviados_diario: number;
  breakeven_facturacion_diario: number;
  dias_resueltos: number;
}

/**
 * Computes break-even metrics using "resolved days" from a 60-day rolling window.
 *
 * A day is "resolved" when pendientes < 10% of enviados for that day.
 * This avoids distortion from recent days where shipments haven't been
 * delivered or rejected yet.
 *
 * Uses DailyRow data (already paginated correctly) instead of raw pedidos
 * queries to avoid Supabase's 1000-row default limit.
 *
 * - tasa_rechazo, bruto/enviado, ticket: from resolved days (60d rolling)
 * - ads promedio, enviados promedio: from current month active days
 */
export async function getBreakevenMetrics(
  userId: string,
  currentMonthRows: DailyRow[],
  config: { fee_gestion_eur: number; costo_rechazo: number; dias_rolling: number; dias_excluir: number }
): Promise<BreakevenMetrics | null> {
  // Build rolling 60 days of DailyRow data
  // Current month rows are passed in; fetch previous months if needed
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Collect all DailyRow data for the rolling window
  let allRows: DailyRow[] = [...currentMonthRows];

  // Determine which previous months we need
  const currentMonth = currentMonthRows[0]?.fecha?.substring(0, 7);
  if (currentMonth) {
    const [cy, cm] = currentMonth.split("-").map(Number);

    // Fetch up to 2 previous months to cover 60 days
    for (let i = 1; i <= 2; i++) {
      const prevDate = new Date(cy, cm - 1 - i, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
      const prevMonthEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0);
      // Only fetch if this month overlaps with our 60-day window
      if (prevMonthEnd.toISOString().split("T")[0] >= cutoffStr) {
        const prevRows = await getDailyDashboard(userId, prevMonth, config.fee_gestion_eur);
        allRows = [...prevRows, ...allRows];
      }
    }
  }

  // Filter to rolling 60-day window and only days with shipments
  const rollingRows = allRows.filter((r) => r.fecha >= cutoffStr && r.enviados > 0);

  if (rollingRows.length === 0) return null;

  // Filter for resolved days: pendientes < 10% of enviados
  const resolvedDays = rollingRows.filter(
    (r) => (r.pendientes / r.enviados) < 0.10
  );

  if (resolvedDays.length === 0) return null;

  const totalEnviadosResueltos = resolvedDays.reduce((s, r) => s + r.enviados, 0);
  const totalRechazados = resolvedDays.reduce((s, r) => s + r.rechazados, 0);
  const totalBruto = resolvedDays.reduce((s, r) => s + r.bruto, 0);
  const totalVentas = resolvedDays.reduce((s, r) => s + r.ventas, 0);

  if (totalEnviadosResueltos === 0) return null;

  const tasaRechazo = totalRechazados / totalEnviadosResueltos;
  const brutoPorEnviado = totalBruto / totalEnviadosResueltos;
  const ticketPromedio = totalVentas / totalEnviadosResueltos;

  // Margen variable
  const margenVariable = brutoPorEnviado - config.fee_gestion_eur - (tasaRechazo * config.costo_rechazo);

  // Promedios diarios del mes en curso (solo días con actividad)
  const mesRows = currentMonthRows.filter((r) => r.enviados > 0 || r.total_ads > 0);
  const diasActivos = mesRows.length || 1;
  const adsMes = mesRows.reduce((s, r) => s + r.total_ads, 0);
  const enviadosMes = mesRows.reduce((s, r) => s + r.enviados, 0);
  const adsPromedioDiario = adsMes / diasActivos;
  const enviadosPromedioDiario = enviadosMes / diasActivos;

  // Break-even diario
  const breakevenEnviadosDiario = margenVariable > 0 ? adsPromedioDiario / margenVariable : Infinity;
  const breakevenFacturacionDiario = isFinite(breakevenEnviadosDiario)
    ? breakevenEnviadosDiario * ticketPromedio
    : Infinity;

  return {
    margen_variable: Math.round(margenVariable * 100) / 100,
    bruto_por_enviado: Math.round(brutoPorEnviado * 100) / 100,
    tasa_rechazo: Math.round(tasaRechazo * 1000) / 1000,
    ads_promedio_diario: Math.round(adsPromedioDiario * 100) / 100,
    ticket_promedio: Math.round(ticketPromedio * 100) / 100,
    enviados_promedio_diario: Math.round(enviadosPromedioDiario * 10) / 10,
    breakeven_enviados_diario: Math.round(breakevenEnviadosDiario * 10) / 10,
    breakeven_facturacion_diario: Math.round(breakevenFacturacionDiario * 100) / 100,
    dias_resueltos: resolvedDays.length,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  table: string,
  userId: string,
  orderBy?: string
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .range(from, from + PAGE_SIZE - 1);

    if (orderBy) {
      query = query.order(orderBy, { ascending: true });
    }

    const { data } = await query;
    const rows = data || [];
    allData = allData.concat(rows);
    hasMore = rows.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allData;
}

export async function getMonthlyDashboard(
  userId: string,
  feeGestionEur: number
): Promise<MonthlyRow[]> {
  const supabase = await createServiceClient();

  // Get all pedidos (paginated to avoid 1000 row limit)
  const pedidos = await fetchAll(supabase, "pedidos", userId, "fecha");

  // Get all ads
  const ads = await fetchAll(supabase, "ads_diario", userId);

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
