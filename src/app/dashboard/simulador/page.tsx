"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  TrendingUp,
  Save,
  Trash2,
  Sparkles,
  AlertCircle,
  Info,
  Percent,
} from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";

interface Product {
  id: string;
  nombre: string;
  precio: number;
  costoUnit: number;
  units: number;
  fulfillment: number;
  envio: number;
  cpa: number;
  rechazo: number;
  tasa: number;
  confirmRate: number;
  scaleMode: "pedidos" | "presupuesto";
  scaleValue: number;
}

function calcStats(p: Product) {
  const costoTotal = p.costoUnit * p.units + p.fulfillment;
  const profitDelivered = p.precio - costoTotal - p.envio - p.cpa;
  const lossRejected = p.rechazo + p.cpa;
  const lossNoConfirm = p.cpa;
  const pctDelivered = p.confirmRate * p.tasa;
  const pctRejected = p.confirmRate * (1 - p.tasa);
  const pctNoConfirm = 1 - p.confirmRate;
  const expectedProfit =
    pctDelivered * profitDelivered -
    pctRejected * lossRejected -
    pctNoConfirm * lossNoConfirm;
  const breakevenCpa =
    p.confirmRate *
    (p.tasa * (p.precio - costoTotal - p.envio) - (1 - p.tasa) * p.rechazo);
  const roas = p.cpa > 0 ? (pctDelivered * p.precio) / p.cpa : 0;
  const roi = p.cpa > 0 ? (expectedProfit / p.cpa) * 100 : 0;
  const projectedOrders = p.scaleValue || 5;
  const projectedAds = projectedOrders * p.cpa;
  const projectedProfit = projectedOrders * expectedProfit;
  return {
    costoTotal,
    profitDelivered,
    lossRejected,
    lossNoConfirm,
    pctDelivered,
    pctRejected,
    pctNoConfirm,
    expectedProfit,
    breakevenCpa,
    roas,
    roi,
    projectedOrders,
    projectedAds,
    projectedProfit,
  };
}

function SimuladorContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") || "";

  const [nombre, setNombre] = useState("Producto A");
  const [precioVenta, setPrecioVenta] = useState(29.9);
  const [costoUnitario, setCostoUnitario] = useState(2.5);
  const [unidades, setUnidades] = useState(2);
  const [costoFulfillment, setCostoFulfillment] = useState(1.0);
  const [costoEnvioCod, setCostoEnvioCod] = useState(7.08);
  const [cpaPromedio, setCpaPromedio] = useState(4.0);
  const [costoRechazo, setCostoRechazo] = useState(13.76);
  const [tasaEntrega, setTasaEntrega] = useState(0.8);
  const [tasaConfirmacion, setTasaConfirmacion] = useState(1.0);

  const [products, setProducts] = useState<Product[]>([]);
  const [activeProductId, setActiveProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("expectedProfit");
  const [budget, setBudget] = useState(200);
  const [strategy, setStrategy] = useState<"roi" | "diversified" | "volume">(
    "roi",
  );
  const [doubtDiscount, setDoubtDiscount] = useState(() => {
    const profitDelivered = 29.9 - (2.5 * 2 + 1.0) - 7.08 - 4.0;
    return Math.min(
      Math.floor((Math.max(0, profitDelivered) / 29.9) * 100),
      100,
    );
  });

  // Load products from DB
  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    fetch(`/api/simulaciones?store_id=${storeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.simulations) {
          setProducts(
            data.simulations.map((s: any) => ({
              id: s.id,
              nombre: s.nombre,
              precio: Number(s.precio_venta),
              costoUnit: Number(s.costo_unitario),
              units: Number(s.unidades_por_venta),
              fulfillment: Number(s.costo_fulfillment_proveedor) || 0,
              envio: Number(s.costo_envio_cod),
              cpa: Number(s.cpa_promedio),
              rechazo: Number(s.costo_rechazo),
              tasa:
                s.tasa_entrega_manual !== null
                  ? Number(s.tasa_entrega_manual)
                  : 0.8,
              confirmRate:
                s.tasa_confirmacion_manual !== null
                  ? Number(s.tasa_confirmacion_manual)
                  : 1.0,
              scaleMode: "pedidos",
              scaleValue: 5,
            })),
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storeId]);

  const currentStats = useMemo(() => {
    const costoTotal = costoUnitario * unidades + costoFulfillment;
    const profitDelivered =
      precioVenta - costoTotal - costoEnvioCod - cpaPromedio;
    const lossRejected = costoRechazo + cpaPromedio;
    const lossNoConfirm = cpaPromedio;
    const pctDelivered = tasaConfirmacion * tasaEntrega;
    const pctRejected = tasaConfirmacion * (1 - tasaEntrega);
    const pctNoConfirm = 1 - tasaConfirmacion;
    const expectedProfit =
      pctDelivered * profitDelivered -
      pctRejected * lossRejected -
      pctNoConfirm * lossNoConfirm;
    const breakevenCpa =
      tasaConfirmacion *
      (tasaEntrega * (precioVenta - costoTotal - costoEnvioCod) -
        (1 - tasaEntrega) * costoRechazo);
    const margenEntregado = precioVenta - costoTotal - costoEnvioCod;
    const denomEntrega = tasaConfirmacion * (margenEntregado + costoRechazo);
    const breakevenEntrega =
      denomEntrega > 0
        ? (cpaPromedio + tasaConfirmacion * costoRechazo) / denomEntrega
        : Infinity;
    const roas =
      cpaPromedio > 0 ? (pctDelivered * precioVenta) / cpaPromedio : 0;
    const roiAds = cpaPromedio > 0 ? (expectedProfit / cpaPromedio) * 100 : 0;
    const cpaCushion = breakevenCpa - cpaPromedio;

    let marginStatus: "profitable" | "tight" | "loss" = "loss";
    if (expectedProfit > 1.5) marginStatus = "profitable";
    else if (expectedProfit >= 0) marginStatus = "tight";

    return {
      costoTotal,
      profitDelivered,
      lossRejected,
      lossNoConfirm,
      pctDelivered,
      pctRejected,
      pctNoConfirm,
      expectedProfit,
      breakevenCpa,
      breakevenEntrega,
      roas,
      roiAds,
      cpaCushion,
      marginStatus,
    };
  }, [
    precioVenta,
    costoUnitario,
    unidades,
    costoFulfillment,
    costoEnvioCod,
    cpaPromedio,
    tasaEntrega,
    tasaConfirmacion,
    costoRechazo,
  ]);

  const sortedProducts = useMemo(() => {
    const computed = products.map((p) => ({ p, s: calcStats(p) }));
    return [...computed].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "nombre") {
        va = a.p.nombre.toLowerCase();
        vb = b.p.nombre.toLowerCase();
      } else if (sortBy === "roi") {
        va = a.s.roi;
        vb = b.s.roi;
      } else {
        va = a.s.expectedProfit;
        vb = b.s.expectedProfit;
      }
      if (va < vb) return 1;
      if (va > vb) return -1;
      return 0;
    });
  }, [products, sortBy]);

  const totals = useMemo(() => {
    let orders = 0,
      ads = 0,
      profit = 0;
    sortedProducts.forEach(({ s }) => {
      orders += s.projectedOrders;
      ads += s.projectedAds;
      profit += s.projectedProfit;
    });
    return {
      orders,
      ads,
      profit,
      monthly: profit * 30,
      roi: ads > 0 ? (profit / ads) * 100 : 0,
    };
  }, [sortedProducts]);

  // Save to DB
  const saveProduct = useCallback(
    async (p: Product) => {
      if (!storeId) return;
      const body = {
        store_id: storeId,
        nombre: p.nombre,
        precio_venta: p.precio,
        costo_unitario: p.costoUnit,
        unidades_por_venta: p.units,
        costo_envio_cod: p.envio,
        cpa_promedio: p.cpa,
        tasa_entrega_manual: p.tasa,
        tasa_confirmacion_manual: p.confirmRate,
        costo_rechazo: p.rechazo,
        costo_fulfillment_proveedor: p.fulfillment,
      };
      const res = await fetch("/api/simulaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const data = await res.json();
      return data.simulation;
    },
    [storeId],
  );

  const deleteProductFromDB = useCallback(
    async (id: string) => {
      if (!storeId || !id) return;
      await fetch(`/api/simulaciones?id=${id}&store_id=${storeId}`, {
        method: "DELETE",
      });
    },
    [storeId],
  );

  function getFormProduct(): Omit<Product, "id"> {
    return {
      nombre: nombre.trim() || "Producto sin nombre",
      precio: precioVenta,
      costoUnit: costoUnitario,
      units: unidades,
      fulfillment: costoFulfillment,
      envio: costoEnvioCod,
      cpa: cpaPromedio,
      rechazo: costoRechazo,
      tasa: tasaEntrega,
      confirmRate: tasaConfirmacion,
      scaleMode: "pedidos",
      scaleValue: 5,
    };
  }

  function loadProductIntoForm(p: Product) {
    setActiveProductId(p.id);
    setNombre(p.nombre);
    setPrecioVenta(p.precio);
    setCostoUnitario(p.costoUnit);
    setUnidades(p.units);
    setCostoFulfillment(p.fulfillment);
    setCostoEnvioCod(p.envio);
    setCpaPromedio(p.cpa);
    setCostoRechazo(p.rechazo);
    setTasaEntrega(p.tasa);
    setTasaConfirmacion(p.confirmRate);
    const profitDelivered =
      p.precio - (p.costoUnit * p.units + p.fulfillment) - p.envio - p.cpa;
    const pct =
      p.precio > 0
        ? Math.floor((Math.max(0, profitDelivered) / p.precio) * 100)
        : 0;
    setDoubtDiscount(Math.min(pct, 100));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addProduct() {
    const formData = getFormProduct();
    const tempId =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newProduct: Product = { ...formData, id: tempId };
    setActiveProductId("");
    setProducts((prev) => [...prev, newProduct]);

    try {
      const sim = await saveProduct(newProduct);
      if (sim?.id) {
        setProducts((prev) =>
          prev.map((p) => (p.id === tempId ? { ...p, id: sim.id } : p)),
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function syncProduct() {
    if (!activeProductId) return;
    const p = products.find((x) => x.id === activeProductId);
    if (!p) {
      setActiveProductId("");
      return;
    }
    const updated: Product = {
      ...getFormProduct(),
      id: activeProductId,
      scaleMode: p.scaleMode,
      scaleValue: p.scaleValue,
    };
    setProducts((prev) =>
      prev.map((x) => (x.id === activeProductId ? updated : x)),
    );
    try {
      const sim = await saveProduct(updated);
      if (sim?.id && sim.id !== activeProductId) {
        setProducts((prev) =>
          prev.map((x) =>
            x.id === activeProductId ? { ...updated, id: sim.id } : x,
          ),
        );
        setActiveProductId(sim.id);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteProduct(id: string) {
    if (activeProductId === id) setActiveProductId("");
    setProducts((prev) => prev.filter((p) => p.id !== id));
    await deleteProductFromDB(id);
  }

  async function clearAll() {
    if (!confirm("¿Eliminar todos los productos de la tabla?")) return;
    const ids = products.map((p) => p.id);
    setActiveProductId("");
    setProducts([]);
    await Promise.allSettled(ids.map((id) => deleteProductFromDB(id)));
  }

  function updateScale(
    id: string,
    mode: "pedidos" | "presupuesto",
    value: number,
  ) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, scaleMode: mode, scaleValue: Math.max(0, value) }
          : p,
      ),
    );
  }

  // Budget Optimizer
  const optimizerResult = useMemo(() => {
    const profitable = sortedProducts.filter(({ s }) => s.expectedProfit > 0);
    if (profitable.length === 0 || budget <= 0) return null;

    let allocations: Array<{
      nombre: string;
      roi: number;
      budget: number;
      orders: number;
      profit: number;
    }> = [];
    let totalSpent = 0;

    if (strategy === "roi") {
      const best = profitable.sort((a, b) => b.s.roi - a.s.roi)[0];
      const orders = best.p.cpa > 0 ? budget / best.p.cpa : 0;
      allocations.push({
        nombre: best.p.nombre,
        roi: best.s.roi,
        budget,
        orders,
        profit: orders * best.s.expectedProfit,
      });
      totalSpent = budget;
    } else if (strategy === "volume") {
      const vol = [...profitable].sort((a, b) => a.p.cpa - b.p.cpa)[0];
      const orders = vol.p.cpa > 0 ? budget / vol.p.cpa : 0;
      allocations.push({
        nombre: vol.p.nombre,
        roi: vol.s.roi,
        budget,
        orders,
        profit: orders * vol.s.expectedProfit,
      });
      totalSpent = budget;
    } else {
      const totalRoi = profitable.reduce((sum, { s }) => sum + s.roi, 0) || 1;
      profitable.forEach(({ p, s }) => {
        const weight = s.roi / totalRoi;
        const share = budget * weight;
        const orders = p.cpa > 0 ? share / p.cpa : 0;
        allocations.push({
          nombre: p.nombre,
          roi: s.roi,
          budget: share,
          orders,
          profit: orders * s.expectedProfit,
        });
      });
      totalSpent = budget;
    }

    const totalProfit = allocations.reduce((s, a) => s + a.profit, 0);
    const totalOrders = allocations.reduce((s, a) => s + a.orders, 0);
    const overallRoi = totalSpent > 0 ? (totalProfit / totalSpent) * 100 : 0;
    return { allocations, totalProfit, totalOrders, totalSpent, overallRoi };
  }, [sortedProducts, budget, strategy]);

  if (!storeId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/5">
          <TrendingUp className="size-6 text-primary/40" />
        </div>
        <p className="text-sm font-medium">Selecciona una tienda para empezar</p>
        <p className="text-xs text-muted-foreground/60">
          Usa el selector de tienda en la barra lateral.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 pb-2">
        <div className="flex items-center justify-center size-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm">
          <TrendingUp className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight">
            Simulador de Rentabilidad
          </h1>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            Unit Economics · CPA · ROI — Analiza la rentabilidad de tus productos
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Cargando productos..." />
      ) : (
        <>
          {/* Form + Results */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left: Form */}
            <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-1 border-b">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-xs font-bold text-card-foreground">
                  Parámetros del Producto
                </h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Nombre del Producto / Oferta
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full text-sm border rounded-lg px-3.5 py-2.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                  placeholder="Ej: Crema Antiage 2x"
                />
              </div>

              <div className="flex items-center gap-2 pb-1 border-b">
                <span className="text-sm">💰</span>
                <span className="text-xs font-bold text-card-foreground">Precio</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Precio de Venta (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(Number(e.target.value))}
                  className="w-full text-sm border rounded-lg px-3.5 py-2.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pb-1 border-b">
                <span className="text-sm">📦</span>
                <span className="text-xs font-bold text-card-foreground">Costos</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Coste Unitario (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoUnitario}
                    onChange={(e) => setCostoUnitario(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3.5 py-2.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Unidades por pedido
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={unidades}
                    onChange={(e) => setUnidades(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3.5 py-2.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Fulfillment Proveedor (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoFulfillment}
                    onChange={(e) =>
                      setCostoFulfillment(Number(e.target.value))
                    }
                    className="w-full text-sm border rounded-lg px-3.5 py-2.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Envío + COD (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoEnvioCod}
                    onChange={(e) => setCostoEnvioCod(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3.5 py-2.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    CPA Promedio (Meta/TikTok) (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cpaPromedio}
                    onChange={(e) => setCpaPromedio(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3.5 py-2.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Coste si Rechazan (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoRechazo}
                    onChange={(e) => setCostoRechazo(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3.5 py-2.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="bg-gradient-to-br from-muted/40 to-white border rounded-xl p-5 space-y-5">
                <div className="flex items-center gap-2 pb-2 border-b border-dashed">
                  <Percent className="size-4 text-primary" />
                  <span className="text-xs font-bold text-card-foreground">
                    Variables de Conversión
                  </span>
                </div>
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-2">
                    <span className="flex items-center gap-1.5">
                      <span>📱</span> Tasa de Confirmación
                    </span>
                    <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full text-[0.65rem]">
                      {Math.round(tasaConfirmacion * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.01"
                    value={tasaConfirmacion}
                    onChange={(e) =>
                      setTasaConfirmacion(Number(e.target.value))
                    }
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[0.5rem] text-muted-foreground/60 mt-0.5 px-0.5">
                    <span>10%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-2">
                    <span className="flex items-center gap-1.5">
                      <span>🚚</span> Tasa de Entrega
                    </span>
                    <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full text-[0.65rem]">
                      {Math.round(tasaEntrega * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.01"
                    value={tasaEntrega}
                    onChange={(e) => setTasaEntrega(Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[0.5rem] text-muted-foreground/60 mt-0.5 px-0.5">
                    <span>10%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <button
                  onClick={addProduct}
                  className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-semibold px-4 py-2 text-xs rounded-lg hover:opacity-90 transition-all shadow-sm"
                >
                  <Sparkles className="size-3.5" />Añadir a la Tabla
                </button>
                <button
                  onClick={syncProduct}
                  disabled={!activeProductId}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white font-semibold px-4 py-2 text-xs rounded-lg hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50"
                >
                  <Save className="size-3.5" />Sincronizar
                </button>
                <button
                  onClick={clearAll}
                  disabled={products.length === 0}
                  className="inline-flex items-center gap-1.5 border border-destructive/30 text-destructive font-semibold px-4 py-2 text-xs rounded-lg hover:bg-destructive/10 transition-all disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  Limpiar todo
                </button>
              </div>
            </div>

            {/* Right: Results */}
            <div>
              <div
                className={`border rounded-xl p-6 shadow-sm relative overflow-hidden transition-all bg-gradient-to-br ${currentStats.marginStatus === "profitable" ? "from-emerald-50/50 to-emerald-100/10 border-emerald-200" : currentStats.marginStatus === "tight" ? "from-amber-50/50 to-amber-100/10 border-amber-200" : "from-destructive/5 to-destructive/10 border-destructive/20"}`}
              >
                <div className="absolute -top-12 -right-12 size-36 rounded-full opacity-10 bg-primary/20 blur-xl" />
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-lg">
                    {currentStats.marginStatus === "profitable"
                      ? "🟢"
                      : currentStats.marginStatus === "tight"
                        ? "🟡"
                        : "🔴"}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.65rem] font-bold ${currentStats.marginStatus === "profitable" ? "bg-emerald-100 text-emerald-800" : currentStats.marginStatus === "tight" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}
                  >
                    {currentStats.marginStatus === "profitable"
                      ? "PRODUCTO RENTABLE"
                      : currentStats.marginStatus === "tight"
                        ? "MARGEN AJUSTADO"
                        : "PRODUCTO A PÉRDIDAS"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-medium mb-1">
                  Beneficio Neto Esperado (por pedido que entra)
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span
                    className={`text-3xl font-black tracking-tight ${currentStats.expectedProfit > 0 ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {currentStats.expectedProfit > 0 ? "+" : ""}
                    {currentStats.expectedProfit.toFixed(2)}€
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    / pedido
                  </span>
                  <span className="ml-2 text-sm font-bold text-primary">
                    {precioVenta > 0
                      ? (
                          (currentStats.expectedProfit / precioVenta) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                  </span>
                  <span className="text-[0.6rem] text-muted-foreground">
                    sobre ventas
                  </span>
                </div>

                <div className="bg-muted/20 border rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg px-3 py-2">
                    <div className="flex justify-between items-center font-semibold">
                      <span>
                        ✅ Si se entrega (
                        <span className="text-emerald-600 font-bold">
                          {(currentStats.pctDelivered * 100).toFixed(0)}%
                        </span>
                        )
                      </span>
                      <span className="text-emerald-600 font-bold">
                        +{currentStats.profitDelivered.toFixed(2)}€
                      </span>
                    </div>
                    <div className="text-[0.6rem] text-muted-foreground/70 text-right mt-0.5">
                      {precioVenta.toFixed(2)}€ − {currentStats.costoTotal.toFixed(2)}€ − {costoEnvioCod.toFixed(2)}€ − {cpaPromedio.toFixed(2)}€ ={" "}
                      {currentStats.profitDelivered.toFixed(2)}€
                    </div>
                  </div>
                  <div className="bg-red-50/50 border border-red-100 rounded-lg px-3 py-2">
                    <div className="flex justify-between items-center font-semibold">
                      <span>
                        ❌ Si se rechaza (
                        <span className="text-red-600 font-bold">
                          {(currentStats.pctRejected * 100).toFixed(0)}%
                        </span>
                        )
                      </span>
                      <span className="text-destructive font-bold">
                        -{currentStats.lossRejected.toFixed(2)}€
                      </span>
                    </div>
                    <div className="text-[0.6rem] text-muted-foreground/70 text-right mt-0.5">
                      {costoRechazo.toFixed(2)}€ + {cpaPromedio.toFixed(2)}€ ={" "}
                      {currentStats.lossRejected.toFixed(2)}€
                    </div>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-100 rounded-lg px-3 py-2">
                    <div className="flex justify-between items-center font-semibold">
                      <span>
                        📱 No confirma (
                        <span className="text-amber-600 font-bold">
                          {(currentStats.pctNoConfirm * 100).toFixed(0)}%
                        </span>
                        )
                      </span>
                      <span className="text-destructive font-bold">
                        -{currentStats.lossNoConfirm.toFixed(2)}€
                      </span>
                    </div>
                    <div className="text-[0.6rem] text-muted-foreground/70 text-right mt-0.5">
                      {cpaPromedio.toFixed(2)}€ ={" "}
                      {currentStats.lossNoConfirm.toFixed(2)}€
                    </div>
                  </div>
                  <div className="border-t border-dashed pt-2.5">
                    <div className="text-[0.6rem] text-muted-foreground leading-relaxed font-mono">
                      ✓ {(currentStats.pctDelivered * 100).toFixed(0)}% ×{" "}
                      {currentStats.profitDelivered.toFixed(2)}€ → +
                      {(
                        currentStats.pctDelivered * currentStats.profitDelivered
                      ).toFixed(2)}
                      €{"\n"}✗ {(currentStats.pctRejected * 100).toFixed(0)}% ×
                      (−{currentStats.lossRejected.toFixed(2)}€) → −
                      {(
                        currentStats.pctRejected * currentStats.lossRejected
                      ).toFixed(2)}
                      €{"\n"}
                      📱 {(currentStats.pctNoConfirm * 100).toFixed(0)}% × (−
                      {currentStats.lossNoConfirm.toFixed(2)}€) → −
                      {(
                        currentStats.pctNoConfirm * currentStats.lossNoConfirm
                      ).toFixed(2)}
                      €{"\n"}
                      <strong>
                        Total = {currentStats.expectedProfit > 0 ? "+" : ""}
                        {currentStats.expectedProfit.toFixed(2)}€/pedido
                      </strong>
                    </div>
                  </div>
                </div>

                {/* CPA + Delivery + ROAS Grid */}
                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-muted/40 to-white border rounded-xl p-3">
                      <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                        CPA Actual
                      </div>
                      <div className="text-lg font-extrabold mt-0.5">
                        {cpaPromedio.toFixed(2)}€
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/10 rounded-xl p-3">
                      <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                        CPA de Equilibrio
                      </div>
                      <div className="text-lg font-extrabold text-primary mt-0.5">
                        {currentStats.breakevenCpa.toFixed(2)}€
                      </div>
                      <div className="text-[0.5rem] text-muted-foreground/60 mt-0.5">
                        Máximo que puedes pagar sin perder dinero.
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-muted/40 to-white border rounded-xl p-3">
                      <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                        Tasa de Entrega
                      </div>
                      <div className="text-lg font-extrabold mt-0.5">
                        {(tasaEntrega * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-muted/40 to-white border rounded-xl p-3">
                      <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                        Entrega de Equilibrio
                      </div>
                      <div
                        className={`text-lg font-extrabold mt-0.5 ${currentStats.breakevenEntrega > 1 ? "text-destructive" : tasaEntrega >= currentStats.breakevenEntrega ? "text-emerald-600" : "text-destructive"}`}
                      >
                        {tasaConfirmacion <= 0 ||
                        precioVenta -
                          currentStats.costoTotal -
                          costoEnvioCod +
                          costoRechazo <=
                          0
                          ? "—"
                          : currentStats.breakevenEntrega > 1
                            ? ">100%"
                            : (currentStats.breakevenEntrega * 100).toFixed(0) +
                              "%"}
                      </div>
                      <div className="text-[0.5rem] text-muted-foreground/60 mt-0.5">
                        Tasa mínima para no perder dinero.
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-purple-50/50 to-white border border-purple-100/50 rounded-xl p-3">
                      <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                        ROAS
                      </div>
                      <div className="text-lg font-extrabold text-purple-700 mt-0.5">
                        {currentStats.roas.toFixed(1)}x
                      </div>
                      <div className="text-[0.5rem] text-muted-foreground/60 mt-0.5">
                        Ingresos brutos ÷ gasto en anuncios.
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-100/50 rounded-xl p-3">
                      <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                        ROI Ads
                      </div>
                      <div
                        className={`text-lg font-extrabold mt-0.5 ${currentStats.roiAds > 0 ? "text-emerald-700" : "text-destructive"}`}
                      >
                        {currentStats.roiAds > 0 ? "+" : ""}
                        {currentStats.roiAds.toFixed(0)}%
                      </div>
                      <div className="text-[0.5rem] text-muted-foreground/60 mt-0.5">
                        Beneficio neto ÷ gasto en anuncios.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl p-3.5 border text-xs flex gap-3 items-start transition-all ${
                      currentStats.breakevenCpa > cpaPromedio
                        ? "bg-gradient-to-r from-emerald-50 to-emerald-50/30 border-emerald-200 text-emerald-800"
                        : "bg-gradient-to-r from-amber-50 to-amber-50/30 border-amber-200 text-amber-800"
                    }`}
                  >
                    <AlertCircle className={`size-5 shrink-0 mt-0.5 ${currentStats.breakevenCpa > cpaPromedio ? "text-emerald-500" : "text-amber-500"}`} />
                    <div>
                      {currentStats.breakevenCpa > cpaPromedio ? (
                        <>
                          <strong className="block text-sm mb-0.5">
                            ✅ Colchón de CPA positivo
                          </strong>
                          <span className="text-[0.65rem]">
                            Tienes{" "}
                            <strong className="text-emerald-700">
                              +{currentStats.cpaCushion.toFixed(2)}€
                            </strong>{" "}
                            de margen antes de perder dinero. Puedes escalar anuncios con confianza.
                          </span>
                        </>
                      ) : (
                        <>
                          <strong className="block text-sm mb-0.5">
                            ⚠️ Alerta: CPA de Equilibrio Superado
                          </strong>
                          <span className="text-[0.65rem]">
                            Estás pagando{" "}
                            <strong className="text-destructive">{cpaPromedio.toFixed(2)}€</strong> de CPA,
                            pero tu límite es{" "}
                            <strong className="text-destructive">
                              {currentStats.breakevenCpa.toFixed(2)}€
                            </strong>
                            . ¡Necesitas bajar el CPA o subir las tasas!
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inline Doubt Calculator */}
              <div className="bg-gradient-to-br from-amber-50/60 to-white border border-amber-200/60 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center size-7 rounded-full bg-amber-100 text-sm">🤔</span>
                  <div>
                    <span className="text-xs font-bold text-card-foreground">
                      Pedido en duda — ¿qué descuento le ofreces?
                    </span>
                    <p className="text-[0.6rem] text-muted-foreground">
                      El cliente duda. ¿Cuánto puedes bajar sin perder más que si lo rechazara?
                    </p>
                  </div>
                </div>

                {(() => {
                  const profitDelivered =
                    precioVenta -
                    (costoUnitario * unidades + costoFulfillment) -
                    costoEnvioCod -
                    cpaPromedio;
                  const pctMax =
                    precioVenta > 0
                      ? Math.floor(
                          (Math.max(0, profitDelivered) / precioVenta) * 100,
                        )
                      : 0;
                  const minPrice =
                    costoUnitario * unidades +
                    costoFulfillment +
                    costoEnvioCod +
                    cpaPromedio;
                  return (
                    <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-emerald-100/60 border border-emerald-200 rounded-xl px-4 py-3">
                      <div>
                        <span className="text-[0.5rem] font-semibold text-muted-foreground uppercase tracking-wider">
                          Puedes ofrecer hasta
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-emerald-700">
                            {Math.max(0, profitDelivered).toFixed(2)}€
                          </span>
                          <span className="text-sm font-bold text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                            {pctMax}% dto.
                          </span>
                        </div>
                        <div className="text-[0.55rem] text-muted-foreground">
                          Precio mínimo: {minPrice.toFixed(2)}€
                        </div>
                      </div>
                      <button
                        onClick={() => setDoubtDiscount(pctMax)}
                        className="text-[0.6rem] font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-300 shadow-sm px-3 py-2 rounded-lg transition-all shrink-0"
                      >
                        Aplicar máximo
                      </button>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-3 bg-white/70 border rounded-lg px-3.5 py-2.5">
                  <span className="text-[0.65rem] font-semibold whitespace-nowrap text-muted-foreground">
                    Descuento:
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={doubtDiscount}
                    onChange={(e) => setDoubtDiscount(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-sm font-extrabold min-w-[55px] text-right text-primary">
                    {doubtDiscount}%
                  </span>
                </div>

                {(() => {
                  const costoTotal =
                    costoUnitario * unidades + costoFulfillment;
                  const profitDelivered =
                    precioVenta - costoTotal - costoEnvioCod - cpaPromedio;
                  const lossIfRejected = costoRechazo + cpaPromedio;
                  const discountAmt = precioVenta * (doubtDiscount / 100);
                  const finalPrice = precioVenta - discountAmt;
                  const profitIfAccepted = profitDelivered - discountAmt;
                  const minPrice = costoTotal + costoEnvioCod + cpaPromedio;
                  const costToDeliver = costoTotal + costoEnvioCod;
                  const breakevenDiscount = Math.max(0, profitDelivered);
                  return (
                    <>
                      <div className="flex justify-between items-center bg-white border rounded-lg px-4 py-2.5 text-xs shadow-sm">
                        <div className="flex flex-col items-center">
                          <span className="text-[0.5rem] text-muted-foreground uppercase tracking-wider">Original</span>
                          <strong>{precioVenta.toFixed(2)}€</strong>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex flex-col items-center">
                          <span className="text-[0.5rem] text-muted-foreground uppercase tracking-wider">Descuento</span>
                          <strong className="text-destructive">−{discountAmt.toFixed(2)}€</strong>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex flex-col items-center">
                          <span className="text-[0.5rem] text-muted-foreground uppercase tracking-wider">FINAL</span>
                          <strong className={`text-sm ${finalPrice >= minPrice ? "text-primary" : "text-destructive"}`}>
                            {finalPrice.toFixed(2)}€
                          </strong>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-3">
                          <div className="text-[0.5rem] font-semibold text-muted-foreground uppercase tracking-wider">
                            ✅ Acepta con descuento
                          </div>
                          <div
                            className={`text-lg font-extrabold mt-0.5 ${profitIfAccepted >= 0 ? "text-emerald-700" : "text-destructive"}`}
                          >
                            {profitIfAccepted >= 0 ? "+" : ""}
                            {profitIfAccepted.toFixed(2)}€
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-xl p-3">
                          <div className="text-[0.5rem] font-semibold text-muted-foreground uppercase tracking-wider">
                            ❌ Si rechaza
                          </div>
                          <div className="text-lg font-extrabold text-destructive mt-0.5">
                            -{lossIfRejected.toFixed(2)}€
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/80 border rounded-lg px-3.5 py-2.5 text-center shadow-sm">
                        <span className="text-[0.65rem] text-muted-foreground">Prefieres aceptar por </span>
                        <strong
                          className={`text-sm font-black ${
                            profitIfAccepted >= 0
                              ? "text-emerald-600"
                              : "text-destructive"
                          }`}
                        >
                          {profitIfAccepted >= 0 ? "+" : ""}
                          {profitIfAccepted.toFixed(2)}€
                        </strong>
                        <span className="text-[0.65rem] text-muted-foreground"> frente a perder </span>
                        <strong className="text-destructive text-sm font-black">
                          -{lossIfRejected.toFixed(2)}€
                        </strong>
                        <span className="text-[0.65rem] text-muted-foreground"> si rechaza.</span>
                      </div>
                      <div className="bg-gradient-to-br from-amber-50/50 to-white border border-amber-200 rounded-xl p-3.5 text-[0.65rem] space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center size-5 rounded-full bg-amber-100 text-[0.5rem]">💰</span>
                          <span className="font-medium text-muted-foreground">Salir a 0:</span>
                          <strong className="text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                            {breakevenDiscount.toFixed(2)}€
                          </strong>
                          <span className="text-[0.55rem] text-muted-foreground">
                            ({precioVenta > 0 ? ((breakevenDiscount / precioVenta) * 100).toFixed(0) : 0}%)
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <strong className="text-sm">{minPrice.toFixed(2)}€</strong>
                        </div>
                        <div className="border-t border-amber-100 pt-2">
                          {costToDeliver > costoRechazo ? (
                            (() => {
                              const crossDiscount =
                                precioVenta - costToDeliver + costoRechazo;
                              const crossPrice = costToDeliver - costoRechazo;
                              const pctCross =
                                precioVenta > 0
                                  ? (crossDiscount / precioVenta) * 100
                                  : 0;
                              const isPastCross =
                                doubtDiscount / 100 >
                                (precioVenta > 0
                                  ? (precioVenta - crossPrice) / precioVenta
                                  : 0);
                              return isPastCross ? (
                                <span className="text-amber-700 font-medium flex items-center gap-1.5">
                                  <span>⚠️</span>
                                  A partir de <strong>{pctCross.toFixed(0)}%</strong> de descuento (precio &lt; {crossPrice.toFixed(2)}€),{" "}
                                  <strong>te conviene más que lo rechacen</strong>.
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  <span>📌</span>
                                  Entregar cuesta <strong>{costToDeliver.toFixed(2)}€</strong>, devolver <strong>{costoRechazo.toFixed(2)}€</strong>. Punto de cruce: &gt;{pctCross.toFixed(0)}% → precio &lt; {crossPrice.toFixed(2)}€.
                                </span>
                              );
                            })()
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span>📌</span>
                              Devolver cuesta <strong>{costoRechazo.toFixed(2)}€</strong> más que entregar ({costToDeliver.toFixed(2)}€).{" "}
                              <strong>Incluso regalarlo es mejor que un rechazo</strong>.
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="text-[0.6rem] text-muted-foreground text-center mt-2">
                * Los cálculos se actualizan automáticamente al cambiar
                cualquier valor.
              </div>
            </div>
          </div>

          {/* Comparative Table */}
          {products.length > 0 && (
            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <h3 className="text-sm font-bold text-card-foreground">
                      Comparativa de Productos
                    </h3>
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground mt-0.5 ml-8">
                    Haz clic en una fila para cargar sus valores en el formulario.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.6rem] font-semibold text-muted-foreground">
                    Ordenar por:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs border rounded-lg px-2.5 py-1.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                  >
                    <option value="nombre">Nombre</option>
                    <option value="expectedProfit">Beneficio/Envío</option>
                    <option value="roi">ROI Ads</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 font-semibold text-muted-foreground sticky top-0">
                      <th className="py-2.5 px-3 text-[0.6rem] uppercase tracking-wider">Producto</th>
                      <th className="py-2.5 px-3 text-right text-[0.6rem] uppercase tracking-wider">Precio</th>
                      <th className="py-2.5 px-3 text-right text-[0.6rem] uppercase tracking-wider">Coste Total</th>
                      <th className="py-2.5 px-3 text-right text-[0.6rem] uppercase tracking-wider">Envío</th>
                      <th className="py-2.5 px-3 text-right text-[0.6rem] uppercase tracking-wider">CPA</th>
                      <th className="py-2.5 px-3 text-center text-[0.6rem] uppercase tracking-wider">Entrega</th>
                      <th className="py-2.5 px-3 text-center text-[0.6rem] uppercase tracking-wider">Confirma</th>
                      <th className="py-2.5 px-3 text-right text-[0.6rem] uppercase tracking-wider">CPA Límite</th>
                      <th className="py-2.5 px-3 text-right text-emerald-600 text-[0.6rem] uppercase tracking-wider">
                        Si Entrega
                      </th>
                      <th className="py-2.5 px-3 text-right text-destructive text-[0.6rem] uppercase tracking-wider">
                        Si Rechazo
                      </th>
                      <th className="py-2.5 px-3 text-right border-r text-primary font-bold text-[0.6rem] uppercase tracking-wider">
                        Resultado/Envío
                      </th>
                      <th className="py-2.5 px-3 text-center text-[0.6rem] uppercase tracking-wider">Pedidos/día</th>
                      <th className="py-2.5 px-3 text-right text-[0.6rem] uppercase tracking-wider">Gasto Ads</th>
                      <th className="py-2.5 px-3 text-right text-emerald-600 text-[0.6rem] uppercase tracking-wider">
                        Ganancia/día
                      </th>
                      <th className="py-2.5 px-3 text-right font-bold text-[0.6rem] uppercase tracking-wider">
                        Ganancia/30d
                      </th>
                      <th className="py-2.5 px-3 text-center text-[0.6rem] uppercase tracking-wider">ROI</th>
                      <th className="py-2.5 px-3 text-center text-[0.6rem] uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedProducts.map(({ p, s }) => (
                      <tr
                        key={p.id}
                        onClick={() => loadProductIntoForm(p)}
                        className={`hover:bg-muted/40 cursor-pointer transition-colors ${activeProductId === p.id ? "bg-primary/5 font-semibold" : ""}`}
                      >
                        <td className="py-3 px-3 font-medium truncate max-w-[140px]">
                          {p.nombre}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {p.precio.toFixed(2)}€
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground">
                          {s.costoTotal.toFixed(2)}€
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground">
                          {p.envio.toFixed(2)}€
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground">
                          {p.cpa.toFixed(2)}€
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[0.55rem] font-bold bg-primary/10 text-primary">
                            {(p.tasa * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[0.55rem] font-bold bg-primary/10 text-primary">
                            {(p.confirmRate * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          {s.breakevenCpa.toFixed(2)}€
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-600 font-semibold">
                          +{s.profitDelivered.toFixed(2)}€
                        </td>
                        <td className="py-3 px-3 text-right text-destructive font-semibold">
                          -{s.lossRejected.toFixed(2)}€
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-black border-r ${s.expectedProfit > 0 ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {s.expectedProfit > 0 ? "+" : ""}
                          {s.expectedProfit.toFixed(2)}€
                        </td>
                        <td
                          className="py-3 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              s.projectedOrders % 1 === 0
                                ? s.projectedOrders
                                : s.projectedOrders.toFixed(1)
                            }
                            onChange={(e) =>
                              updateScale(
                                p.id,
                                "pedidos",
                                Math.max(0, Number(e.target.value)),
                              )
                            }
                            className="w-14 text-center text-[0.65rem] font-bold border rounded px-1 py-0.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                          <span className="text-[0.5rem] text-muted-foreground">
                            /d
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground">
                          {s.projectedAds.toFixed(2)}€
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-bold ${s.projectedProfit > 0 ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {s.projectedProfit > 0 ? "+" : ""}
                          {s.projectedProfit.toFixed(2)}€
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-black ${s.projectedProfit > 0 ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {s.projectedProfit * 30 > 0 ? "+" : ""}
                          {(s.projectedProfit * 30).toFixed(2)}€
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[0.55rem] font-bold ${s.roi > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                          >
                            {s.roi > 0 ? "+" : ""}
                            {s.roi.toFixed(1)}%
                          </span>
                        </td>
                        <td
                          className="py-3 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => deleteProduct(p.id)}
                            className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-primary/5 font-extrabold border-t-2 border-double border-primary/20">
                      <td className="py-3 px-3 text-primary font-bold">
                        TOTAL
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-center text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-center text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-right border-r text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-3 text-center text-primary font-bold">
                        {totals.orders % 1 === 0
                          ? totals.orders
                          : totals.orders.toFixed(1)}
                        /d
                      </td>
                      <td className="py-3 px-3 text-right text-primary font-black">
                        {totals.ads.toFixed(2)}€
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-black ${totals.profit > 0 ? "text-emerald-600" : "text-destructive"}`}
                      >
                        {totals.profit > 0 ? "+" : ""}
                        {totals.profit.toFixed(2)}€
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-black ${totals.monthly > 0 ? "text-emerald-600" : "text-destructive"}`}
                      >
                        {totals.monthly > 0 ? "+" : ""}
                        {totals.monthly.toFixed(2)}€
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[0.6rem] font-bold ${totals.roi > 0 ? "bg-emerald-600 text-white" : "bg-destructive text-white"}`}
                        >
                          {totals.roi > 0 ? "+" : ""}
                          {totals.roi.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-muted-foreground">
                        —
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Budget Optimizer */}
          {products.length > 0 && (
            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center size-8 rounded-lg bg-primary/5 text-base">🚀</span>
                <div>
                  <h3 className="text-sm font-bold text-card-foreground">
                    Optimizador Estratégico de Presupuesto Ads
                  </h3>
                  <p className="text-[0.65rem] text-muted-foreground">
                    Distribuye tu presupuesto diario entre tus productos para maximizar la rentabilidad.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Presupuesto Diario Ads (€)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={budget}
                      onChange={(e) =>
                        setBudget(Math.max(1, Number(e.target.value)))
                      }
                      className="w-full text-sm border rounded-lg px-3.5 py-2.5 bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Estrategia
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["roi", "diversified", "volume"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStrategy(s)}
                          className={`text-[0.65rem] font-semibold border rounded-lg px-2.5 py-2 transition-all ${
                            strategy === s
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:bg-muted/30"
                          }`}
                        >
                          {s === "roi" && "📈 ROI"}
                          {s === "diversified" && "⚖️ Diverso"}
                          {s === "volume" && "🔥 Volumen"}
                        </button>
                      ))}
                    </div>
                    <p className="text-[0.55rem] text-muted-foreground mt-1.5">
                      {strategy === "roi"
                        ? "Centra todo el presupuesto en el producto con mejor ROI."
                        : strategy === "diversified"
                          ? "Distribuye el presupuesto proporcional al ROI de cada producto."
                          : "Prioriza el producto con el CPA más bajo para maximizar pedidos."}
                    </p>
                  </div>
                  <div className="text-[0.65rem] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-dashed">
                    💡 El optimizador excluye automáticamente los productos con
                    beneficio esperado negativo para proteger tu inversión.
                  </div>
                </div>
                {optimizerResult ? (
                  <div>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 rounded-xl p-3">
                        <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                          Presupuesto
                        </div>
                        <div className="text-lg font-extrabold">
                          {optimizerResult.totalSpent.toFixed(2)}€
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl p-3">
                        <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                          Ganancia /día
                        </div>
                        <div className="text-lg font-extrabold text-emerald-700">
                          +{optimizerResult.totalProfit.toFixed(2)}€
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl p-3">
                        <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                          Ganancia /mes
                        </div>
                        <div className="text-lg font-extrabold text-emerald-700">
                          +{(optimizerResult.totalProfit * 30).toFixed(2)}€
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 rounded-xl p-3">
                        <div className="text-[0.55rem] font-semibold text-muted-foreground uppercase tracking-wider">
                          ROI Ads
                        </div>
                        <div className="text-lg font-extrabold text-purple-700">
                          +{optimizerResult.overallRoi.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-muted/50 font-semibold text-muted-foreground">
                            <th className="py-2.5 px-3 text-[0.55rem] uppercase tracking-wider">Producto</th>
                            <th className="py-2.5 px-3 text-center text-[0.55rem] uppercase tracking-wider">ROI</th>
                            <th className="py-2.5 px-3 text-right text-[0.55rem] uppercase tracking-wider">
                              Presupuesto
                            </th>
                            <th className="py-2.5 px-3 text-right text-[0.55rem] uppercase tracking-wider">Pedidos</th>
                            <th className="py-2.5 px-3 text-right text-emerald-600 text-[0.55rem] uppercase tracking-wider">
                              Ganancia/día
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {optimizerResult.allocations.map((a, i) => (
                            <tr
                              key={i}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-medium truncate max-w-[140px]">
                                {a.nombre}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[0.55rem] font-bold bg-emerald-100 text-emerald-800">
                                  +{a.roi.toFixed(0)}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold">
                                {a.budget.toFixed(2)}€
                              </td>
                              <td className="py-2.5 px-3 text-right text-muted-foreground">
                                {a.orders.toFixed(1)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                                +{a.profit.toFixed(2)}€
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground border-2 border-dashed rounded-xl p-8 gap-2">
                    <span className="text-2xl">🎯</span>
                    <p className="font-medium">
                      Añade productos a la tabla para usar el optimizador
                    </p>
                    <p className="text-[0.6rem] text-muted-foreground/60">
                      Solo se consideran productos con beneficio esperado positivo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SimuladorPage() {
  return (
    <Suspense fallback={null}>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <SimuladorContent />
      </div>
    </Suspense>
  );
}
