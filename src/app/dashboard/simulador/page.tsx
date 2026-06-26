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
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <p className="text-sm">Por favor, selecciona una tienda primero.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
          <TrendingUp className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            Simulador de Rentabilidad Ecommerce
          </h2>
          <p className="text-xs text-muted-foreground">
            Unit Economics · CPA · ROI — Analiza la rentabilidad de tus
            productos
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Cargando productos..." />
      ) : (
        <>
          {/* Form + Results */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: Form */}
            <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                🔧 Parámetros del Producto
              </h3>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Nombre del Producto / Oferta
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Precio de Venta (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Coste Unitario (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoUnitario}
                    onChange={(e) => setCostoUnitario(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Unidades por pedido
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={unidades}
                    onChange={(e) => setUnidades(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Fulfillment Prov. (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoFulfillment}
                    onChange={(e) =>
                      setCostoFulfillment(Number(e.target.value))
                    }
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Envío + COD (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoEnvioCod}
                    onChange={(e) => setCostoEnvioCod(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    CPA Promedio (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cpaPromedio}
                    onChange={(e) => setCpaPromedio(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Coste si Rechazan (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoRechazo}
                    onChange={(e) => setCostoRechazo(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-muted/20 border border-dashed rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Percent className="size-4 text-primary" />
                  <span className="text-xs font-bold text-card-foreground">
                    Variables
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1">
                    <span>📱 Tasa de Confirmación</span>
                    <span className="text-primary font-bold">
                      {(tasaConfirmacion * 100).toFixed(0)}%
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
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1">
                    <span>🚚 Tasa de Entrega</span>
                    <span className="text-primary font-bold">
                      {(tasaEntrega * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.01"
                    value={tasaEntrega}
                    onChange={(e) => setTasaEntrega(Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <button
                  onClick={addProduct}
                  className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-semibold px-4 py-2 text-xs rounded-lg hover:opacity-90 transition-all shadow-sm"
                >
                  <Sparkles className="size-3.5" />➕ Añadir a la Tabla
                </button>
                <button
                  onClick={syncProduct}
                  disabled={!activeProductId}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white font-semibold px-4 py-2 text-xs rounded-lg hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
                >
                  <Save className="size-3.5" />↻ Sincronizar
                </button>
                <button
                  onClick={clearAll}
                  disabled={products.length === 0}
                  className="inline-flex items-center gap-1.5 border border-destructive/30 text-destructive font-semibold px-4 py-2 text-xs rounded-lg hover:bg-destructive/5 transition-all disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  🗑️ Limpiar todo
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

                <div className="bg-muted/20 border rounded-xl p-3 space-y-2.5 text-xs">
                  <div>
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
                      Precio ({precioVenta.toFixed(2)}€) − Coste Total (
                      {currentStats.costoTotal.toFixed(2)}€) − Envío (
                      {costoEnvioCod.toFixed(2)}€) − CPA (
                      {cpaPromedio.toFixed(2)}€) ={" "}
                      {currentStats.profitDelivered.toFixed(2)}€
                    </div>
                  </div>
                  <div className="border-t border-dashed pt-2.5">
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
                      Coste Rechazo ({costoRechazo.toFixed(2)}€) + CPA (
                      {cpaPromedio.toFixed(2)}€) ={" "}
                      {currentStats.lossRejected.toFixed(2)}€
                    </div>
                  </div>
                  <div className="border-t border-dashed pt-2.5">
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
                      CPA ({cpaPromedio.toFixed(2)}€) ={" "}
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
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 border rounded-lg p-2.5">
                      <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                        CPA Actual
                      </div>
                      <div className="text-base font-extrabold">
                        {cpaPromedio.toFixed(2)}€
                      </div>
                    </div>
                    <div className="bg-muted/30 border rounded-lg p-2.5">
                      <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                        CPA de Equilibrio
                      </div>
                      <div className="text-base font-extrabold text-primary">
                        {currentStats.breakevenCpa.toFixed(2)}€
                      </div>
                      <div className="text-[0.55rem] text-muted-foreground/70">
                        CPA máximo que puedes pagar sin perder dinero.
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 border rounded-lg p-2.5">
                      <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                        Tasa de Entrega
                      </div>
                      <div className="text-base font-extrabold">
                        {(tasaEntrega * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-muted/30 border rounded-lg p-2.5">
                      <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                        Entrega de Equilibrio
                      </div>
                      <div
                        className={`text-base font-extrabold ${currentStats.breakevenEntrega > 1 ? "text-destructive" : tasaEntrega >= currentStats.breakevenEntrega ? "text-emerald-600" : "text-destructive"}`}
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
                      <div className="text-[0.55rem] text-muted-foreground/70">
                        Tasa mínima para no perder dinero.
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 border rounded-lg p-2.5">
                      <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                        ROAS
                      </div>
                      <div className="text-base font-extrabold text-primary">
                        {currentStats.roas.toFixed(1)}x
                      </div>
                      <div className="text-[0.55rem] text-muted-foreground/70">
                        Retorno en anuncios: ingresos brutos ÷ gasto ads.
                      </div>
                    </div>
                    <div className="bg-muted/30 border rounded-lg p-2.5">
                      <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                        ROI Ads
                      </div>
                      <div
                        className={`text-base font-extrabold ${currentStats.roiAds > 0 ? "text-emerald-600" : "text-destructive"}`}
                      >
                        {currentStats.roiAds > 0 ? "+" : ""}
                        {currentStats.roiAds.toFixed(0)}%
                      </div>
                      <div className="text-[0.55rem] text-muted-foreground/70">
                        Retorno total: beneficio ÷ gasto ads.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl p-3 border text-xs flex gap-2.5 items-start ${currentStats.breakevenCpa > cpaPromedio ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-amber-50/50 border-amber-100 text-amber-800"}`}
                  >
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      {currentStats.breakevenCpa > cpaPromedio ? (
                        <>
                          <strong className="block">
                            ✅ Colchón de CPA positivo
                          </strong>
                          <span>
                            Tienes{" "}
                            <strong>
                              +{currentStats.cpaCushion.toFixed(2)}€
                            </strong>{" "}
                            de margen antes de perder dinero. Puedes escalar
                            anuncios.
                          </span>
                        </>
                      ) : (
                        <>
                          <strong className="block">
                            ⚠️ Alerta: CPA de Equilibrio Superado
                          </strong>
                          <span>
                            Estás pagando{" "}
                            <strong>{cpaPromedio.toFixed(2)}€</strong> de CPA,
                            pero tu límite es{" "}
                            <strong>
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
              <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🤔</span>
                  <span className="text-xs font-bold text-card-foreground">
                    Pedido en duda — ¿qué descuento le ofreces?
                  </span>
                </div>
                <p className="text-[0.65rem] text-muted-foreground">
                  El cliente duda. ¿Cuánto puedes bajar sin perder más que si lo
                  rechazara?
                </p>

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
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                      <div>
                        <span className="text-[0.5rem] font-semibold text-muted-foreground uppercase tracking-wider">
                          Puedes ofrecer hasta
                        </span>
                        <div className="text-base font-black text-emerald-700">
                          {Math.max(0, profitDelivered).toFixed(2)}€
                          <span className="text-[0.65rem] font-bold text-emerald-600 ml-1">
                            ({pctMax}% de descuento)
                          </span>
                        </div>
                        <div className="text-[0.55rem] text-muted-foreground">
                          Precio mínimo: {minPrice.toFixed(2)}€
                        </div>
                      </div>
                      <button
                        onClick={() => setDoubtDiscount(pctMax)}
                        className="text-[0.55rem] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        Aplicar máximo
                      </button>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-3">
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
                      <div className="flex justify-between items-center bg-white/70 border rounded-lg px-3 py-2 text-xs">
                        <span>
                          Precio original:{" "}
                          <strong>{precioVenta.toFixed(2)}€</strong>
                        </span>
                        <span>
                          −{" "}
                          <strong className="text-destructive">
                            {discountAmt.toFixed(2)}€
                          </strong>
                        </span>
                        <span>
                          <span className="text-[0.55rem] text-muted-foreground">
                            PRECIO FINAL{" "}
                          </span>
                          <strong
                            className={`text-sm ${finalPrice >= minPrice ? "text-primary" : "text-destructive"}`}
                          >
                            {finalPrice.toFixed(2)}€
                          </strong>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/70 border rounded-lg p-2.5">
                          <div className="text-[0.55rem] font-semibold text-muted-foreground mb-0.5">
                            ✅ Si acepta con descuento
                          </div>
                          <div
                            className={`text-base font-black ${profitIfAccepted >= 0 ? "text-emerald-600" : "text-destructive"}`}
                          >
                            {profitIfAccepted >= 0 ? "+" : ""}
                            {profitIfAccepted.toFixed(2)}€
                          </div>
                        </div>
                        <div className="bg-white/70 border rounded-lg p-2.5">
                          <div className="text-[0.55rem] font-semibold text-muted-foreground mb-0.5">
                            ❌ Si rechaza
                          </div>
                          <div className="text-base font-black text-destructive">
                            -{lossIfRejected.toFixed(2)}€
                          </div>
                        </div>
                      </div>
                      <div className="text-[0.65rem] text-muted-foreground text-center">
                        Prefieres aceptar por{" "}
                        <strong
                          className={
                            profitIfAccepted >= 0
                              ? "text-emerald-600"
                              : "text-destructive"
                          }
                        >
                          {profitIfAccepted >= 0 ? "+" : ""}
                          {profitIfAccepted.toFixed(2)}€
                        </strong>{" "}
                        frente a perder{" "}
                        <strong className="text-destructive">
                          -{lossIfRejected.toFixed(2)}€
                        </strong>{" "}
                        si rechaza.
                      </div>
                      <div className="bg-white/70 border border-amber-100 rounded-lg p-2.5 text-[0.65rem] space-y-1">
                        <div>
                          <strong>💰 Salir a 0:</strong> descuento de{" "}
                          <strong className="text-primary">
                            {breakevenDiscount.toFixed(2)}€
                          </strong>{" "}
                          <span className="text-[0.55rem] text-muted-foreground">
                            (
                            {precioVenta > 0
                              ? (
                                  (breakevenDiscount / precioVenta) *
                                  100
                                ).toFixed(0)
                              : 0}
                            %)
                          </span>{" "}
                          → precio final <strong>{minPrice.toFixed(2)}€</strong>
                        </div>
                        <div className="border-t border-amber-100 pt-1 mt-1">
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
                                <span className="text-amber-700 font-medium">
                                  ⚠️ A partir de {pctCross.toFixed(0)}% de
                                  descuento (precio &lt; {crossPrice.toFixed(2)}
                                  €),{" "}
                                  <strong>
                                    te conviene más que lo rechacen
                                  </strong>
                                  .
                                </span>
                              ) : (
                                <>
                                  📌 El producto cuesta{" "}
                                  <strong>{costToDeliver.toFixed(2)}€</strong>{" "}
                                  entregarlo y{" "}
                                  <strong>{costoRechazo.toFixed(2)}€</strong>{" "}
                                  devolverlo. Punto de cruce: &gt;
                                  {pctCross.toFixed(0)}% → precio &lt;{" "}
                                  {crossPrice.toFixed(2)}€.
                                </>
                              );
                            })()
                          ) : (
                            <>
                              📌 Devolver cuesta{" "}
                              <strong>{costoRechazo.toFixed(2)}€</strong> más
                              que entregar ({costToDeliver.toFixed(2)}€).{" "}
                              <strong>
                                Incluso regalarlo es mejor que un rechazo
                              </strong>
                              .
                            </>
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
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-bold text-card-foreground">
                    📊 Comparativa de Productos
                  </h3>
                  <p className="text-[0.65rem] text-muted-foreground mt-0.5">
                    Haz clic en una fila para cargar sus valores en el
                    formulario.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.6rem] font-semibold text-muted-foreground">
                    Ordenar por:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs border rounded-lg px-2 py-1 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="nombre">Nombre</option>
                    <option value="expectedProfit">Beneficio/Envío</option>
                    <option value="roi">ROI Ads</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3 text-right">Precio</th>
                      <th className="py-2.5 px-3 text-right">Coste Total</th>
                      <th className="py-2.5 px-3 text-right">Envío</th>
                      <th className="py-2.5 px-3 text-right">CPA</th>
                      <th className="py-2.5 px-3 text-center">Entrega</th>
                      <th className="py-2.5 px-3 text-center">Confirma</th>
                      <th className="py-2.5 px-3 text-right">CPA Límite</th>
                      <th className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                        Si Entrega
                      </th>
                      <th className="py-2.5 px-3 text-right text-destructive font-semibold">
                        Si Rechazo
                      </th>
                      <th className="py-2.5 px-3 text-right border-r text-primary font-bold">
                        Resultado/Envío
                      </th>
                      <th className="py-2.5 px-3 text-center">Pedidos/día</th>
                      <th className="py-2.5 px-3 text-right">Gasto Ads</th>
                      <th className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                        Ganancia/día
                      </th>
                      <th className="py-2.5 px-3 text-right font-bold">
                        Ganancia/30d
                      </th>
                      <th className="py-2.5 px-3 text-center">ROI</th>
                      <th className="py-2.5 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
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
                            className="p-1 text-destructive hover:bg-destructive/10 rounded transition-all"
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
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-card-foreground mb-1">
                🚀 Optimizador Estratégico de Presupuesto Ads
              </h3>
              <p className="text-[0.65rem] text-muted-foreground mb-4">
                Distribuye tu presupuesto diario entre tus productos para
                maximizar la rentabilidad.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Presupuesto Diario Ads (€)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={budget}
                      onChange={(e) =>
                        setBudget(Math.max(1, Number(e.target.value)))
                      }
                      className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Estrategia
                    </label>
                    <select
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value as any)}
                      className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="roi">
                        📈 Rentabilidad Máxima (Mejor ROI)
                      </option>
                      <option value="diversified">
                        ⚖️ Diversificación Equilibrada
                      </option>
                      <option value="volume">
                        🔥 Volumen Máximo de Pedidos
                      </option>
                    </select>
                  </div>
                  <div className="text-[0.65rem] text-muted-foreground border-t pt-3">
                    💡 El optimizador excluye automáticamente los productos con
                    beneficio esperado negativo para proteger tu inversión.
                  </div>
                </div>
                {optimizerResult ? (
                  <div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-muted/30 border rounded-lg p-2.5">
                        <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                          Presupuesto
                        </div>
                        <div className="text-base font-extrabold">
                          {optimizerResult.totalSpent.toFixed(2)}€
                        </div>
                      </div>
                      <div className="bg-muted/30 border rounded-lg p-2.5">
                        <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                          Ganancia Diaria
                        </div>
                        <div className="text-base font-extrabold text-emerald-600">
                          +{optimizerResult.totalProfit.toFixed(2)}€
                        </div>
                      </div>
                      <div className="bg-muted/30 border rounded-lg p-2.5">
                        <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                          Ganancia Mensual
                        </div>
                        <div className="text-base font-extrabold text-emerald-600">
                          +{(optimizerResult.totalProfit * 30).toFixed(2)}€
                        </div>
                      </div>
                      <div className="bg-muted/30 border rounded-lg p-2.5">
                        <div className="text-[0.6rem] font-semibold text-muted-foreground uppercase">
                          ROI Ads
                        </div>
                        <div className="text-base font-extrabold text-primary">
                          +{optimizerResult.overallRoi.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                            <th className="py-2 px-3">Producto</th>
                            <th className="py-2 px-3 text-center">ROI</th>
                            <th className="py-2 px-3 text-right">
                              Presupuesto
                            </th>
                            <th className="py-2 px-3 text-right">Pedidos</th>
                            <th className="py-2 px-3 text-right text-emerald-600 font-semibold">
                              Ganancia/día
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {optimizerResult.allocations.map((a, i) => (
                            <tr
                              key={i}
                              className="hover:bg-muted/40 transition-colors"
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
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground border border-dashed rounded-xl p-6">
                    <p>
                      Añade productos rentables a la tabla para usar el
                      optimizador.
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
      <div className="p-6 max-w-7xl mx-auto">
        <SimuladorContent />
      </div>
    </Suspense>
  );
}
