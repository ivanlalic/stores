import { createServiceClient } from "@/lib/insforge/server";

type InsforgeClient = ReturnType<typeof createServiceClient>;

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
  pnl_teorico: number;
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
  insforge: InsforgeClient,
  storeId: string,
  month: string,
  feeGestionEur: number
): Promise<DailyRow[]> {
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
      .from("pedidos")
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
    .from("ads_diario")
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
  (pedidos || []).forEach((p) => {
    const day = p.fecha;
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(p);
  });

  const rows: DailyRow[] = [];

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
    const pendientes = enviados - entregados - rechazados;

    const ventas = dayPedidos
      .filter((p) => p.es_enviado)
      .reduce((sum, p) => sum + Number(p.venta), 0);

    const bruto = dayPedidos
      .filter((p) => p.es_enviado)
      .reduce((sum, p) => sum + Number(p.neto), 0);

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

export async function getBreakevenMetrics(
  insforge: InsforgeClient,
  storeId: string,
  currentMonthRows: DailyRow[],
  config: { fee_gestion_eur: number; costo_rechazo: number; dias_rolling: number; dias_excluir: number }
): Promise<BreakevenMetrics | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - config.dias_rolling);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const excluir = new Date(today);
  excluir.setDate(excluir.getDate() - config.dias_excluir);
  const excluirStr = excluir.toISOString().split("T")[0];

  let allRows: DailyRow[] = [...currentMonthRows];

  const currentMonth = currentMonthRows[0]?.fecha?.substring(0, 7);
  if (currentMonth) {
    const [cy, cm] = currentMonth.split("-").map(Number);

    for (let i = 1; i <= 2; i++) {
      const prevDate = new Date(cy, cm - 1 - i, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
      const prevMonthEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0);
      if (prevMonthEnd.toISOString().split("T")[0] >= cutoffStr) {
        const prevRows = await getDailyDashboard(insforge, storeId, prevMonth, config.fee_gestion_eur);
        allRows = [...prevRows, ...allRows];
      }
    }
  }

  const rollingRows = allRows.filter((r) => r.fecha >= cutoffStr && r.fecha < excluirStr && r.enviados > 0);

  if (rollingRows.length === 0) return null;

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

  const margenVariable = brutoPorEnviado - config.fee_gestion_eur;

  const mesRows = currentMonthRows.filter((r) => r.enviados > 0 || r.total_ads > 0);
  const diasActivos = mesRows.length || 1;
  const adsMes = mesRows.reduce((s, r) => s + r.total_ads, 0);
  const enviadosMes = mesRows.reduce((s, r) => s + r.enviados, 0);
  const adsPromedioDiario = adsMes / diasActivos;
  const enviadosPromedioDiario = enviadosMes / diasActivos;

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

export interface ProductoRow {
  nombre: string;
  pedidos: number;
  unidades: number;
  enviados: number;
  entregados: number;
  rechazados: number;
  pendientes: number;
  cancelados: number;
  tasa_entrega: number;
  tasa_rechazo: number;
  ventas: number;
  neto: number;
  neto_por_unidad: number;
}

function parsePedidoItems(pedido: string): Array<{ name: string; qty: number }> {
  return pedido.split(" | ").map((item) => {
    const match = item.match(/^(.+?)\s*\(x(\d+)\)$/);
    if (match) return { name: match[1].trim(), qty: parseInt(match[2]) };
    return { name: item.trim(), qty: 1 };
  });
}

export async function getProductosDashboard(
  insforge: InsforgeClient,
  storeId: string
): Promise<ProductoRow[]> {
  const pedidos = await fetchAllByStore(insforge, "pedidos", storeId, "fecha");

  const map = new Map<string, {
    pedidos: number; unidades: number; enviados: number;
    entregados: number; rechazados: number; pendientes: number; cancelados: number;
    ventas: number; neto: number; ventasOrders: number;
  }>();

  for (const p of pedidos) {
    const items = parsePedidoItems(p.pedido || "");
    const isSingle = items.length === 1;

    for (const item of items) {
      const existing = map.get(item.name) || {
        pedidos: 0, unidades: 0, enviados: 0, entregados: 0,
        rechazados: 0, pendientes: 0, cancelados: 0,
        ventas: 0, neto: 0, ventasOrders: 0,
      };

      existing.pedidos += 1;
      existing.unidades += item.qty;
      if (p.es_enviado) existing.enviados += 1;
      if (p.es_entregado) existing.entregados += 1;
      if (p.es_rechazado) existing.rechazados += 1;
      if (p.es_cancelado) existing.cancelados += 1;
      if (p.es_enviado) existing.pendientes = Math.max(0, existing.enviados - existing.entregados - existing.rechazados);

      if (isSingle && p.es_enviado) {
        existing.ventas += Number(p.venta) || 0;
        existing.neto += Number(p.neto) || 0;
        existing.ventasOrders += 1;
      }

      map.set(item.name, existing);
    }
  }

  const rows: ProductoRow[] = [];
  for (const [nombre, s] of map.entries()) {
    const pendientes = s.enviados - s.entregados - s.rechazados;
    rows.push({
      nombre,
      pedidos: s.pedidos,
      unidades: s.unidades,
      enviados: s.enviados,
      entregados: s.entregados,
      rechazados: s.rechazados,
      pendientes: Math.max(0, pendientes),
      cancelados: s.cancelados,
      tasa_entrega: s.enviados > 0 ? s.entregados / s.enviados : 0,
      tasa_rechazo: s.enviados > 0 ? s.rechazados / s.enviados : 0,
      ventas: Math.round(s.ventas * 100) / 100,
      neto: Math.round(s.neto * 100) / 100,
      neto_por_unidad: s.ventasOrders > 0 ? Math.round((s.neto / s.ventasOrders) * 100) / 100 : 0,
    });
  }

  return rows.sort((a, b) => b.pedidos - a.pedidos);
}

async function fetchAllByStore(
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
  insforge: InsforgeClient,
  storeId: string,
  feeGestionEur: number
): Promise<MonthlyRow[]> {
  const pedidos = await fetchAllByStore(insforge, "pedidos", storeId, "fecha");
  const ads = await fetchAllByStore(insforge, "ads_diario", storeId);

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
    const pendientes = enviados - entregados - rechazados;

    const ventas = mp
      .filter((p) => p.es_enviado)
      .reduce((sum, p) => sum + Number(p.venta), 0);

    const bruto = mp
      .filter((p) => p.es_enviado)
      .reduce((sum, p) => sum + Number(p.neto), 0);

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
    const pnl_teorico = bruto - gastos;

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
      pnl_teorico: Math.round(pnl_teorico * 100) / 100,
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
