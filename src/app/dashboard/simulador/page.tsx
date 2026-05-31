"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp, Trash2, Save, Sparkles, AlertCircle, Info, Percent, Edit2 } from "lucide-react";

interface Simulation {
  id: string;
  nombre: string;
  precio_venta: number;
  costo_unitario: number;
  unidades_por_venta: number;
  costo_envio_cod: number;
  cpa_promedio: number;
  tasa_entrega_manual: number | null;
  costo_rechazo: number;
}

function SimuladorContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") || "";

  // Simulations list
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  // Form Fields
  const [nombre, setNombre] = useState("CC Cream - Base de Maquillaje");
  const [precioVenta, setPrecioVenta] = useState(29.90);
  const [costoUnitario, setCostoUnitario] = useState(2.25);
  const [unidades, setUnidades] = useState(4);
  const [costoEnvioCod, setCostoEnvioCod] = useState(7.40);
  const [cpaPromedio, setCpaPromedio] = useState(5.00);
  const [tasaEntrega, setTasaEntrega] = useState(0.75); // 75%
  const [costoRechazo, setCostoRechazo] = useState(14.00);

  // Auto/Manual Rate Status
  const [isAutoTasa, setIsAutoTasa] = useState(false);
  const [autoTasaLoading, setAutoTasaLoading] = useState(false);
  const [realStats, setRealStats] = useState<{ total_pedidos: number; tasa_entrega: number | null } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Daily Scaling Volume Simulator states (individual per row)
  const [rowScaleSettings, setRowScaleSettings] = useState<Record<string, { mode: "pedidos" | "presupuesto"; value: number }>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Sync scale settings with localStorage
  useEffect(() => {
    const saved = localStorage.getItem("simulador_row_scale_settings");
    if (saved) {
      try {
        setRowScaleSettings(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  function updateRowScale(id: string, mode: "pedidos" | "presupuesto", value: number) {
    setRowScaleSettings((prev) => {
      const updated = { ...prev, [id]: { mode, value } };
      localStorage.setItem("simulador_row_scale_settings", JSON.stringify(updated));
      return updated;
    });
  }


  // 1. Fetch saved simulations & Store configuration (for default rejection cost)
  async function fetchSimulations() {
    if (!storeId) return;
    try {
      // Fetch simulations
      const res = await fetch(`/api/simulaciones?store_id=${storeId}`);
      const data = await res.json();
      setSimulations(data.simulations || []);

      // Fetch store config to pull dynamic rejection cost
      const storeRes = await fetch("/api/stores");
      const storeData = await storeRes.json();
      const foundStore = (storeData.stores || []).find((s: any) => s.id === storeId);
      if (foundStore && foundStore.costo_rechazo !== undefined) {
        const cost = Number(foundStore.costo_rechazo);
        setCostoRechazo(isNaN(cost) ? 14.00 : cost);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSimulations();
  }, [storeId]);

  // 2. Fetch real delivery stats from order history when auto-checkbox or name changes
  useEffect(() => {
    if (!isAutoTasa || !nombre.trim() || !storeId) {
      setRealStats(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setAutoTasaLoading(true);
      try {
        const res = await fetch(
          `/api/simulaciones?type=real-delivery-rate&store_id=${storeId}&nombre=${encodeURIComponent(nombre.trim())}`
        );
        const data = await res.json();
        setRealStats(data);
        if (data.tasa_entrega !== null) {
          setTasaEntrega(data.tasa_entrega);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setAutoTasaLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [isAutoTasa, nombre, storeId]);

  // Handle selecting a simulation from list
  function handleSelectChange(id: string) {
    setSelectedId(id);
    setIsFormOpen(true); // Automatically open the form when editing or creating!
    if (!id) {
      // Reset form to defaults
      setNombre("CC Cream - Base de Maquillaje");
      setPrecioVenta(29.90);
      setCostoUnitario(2.25);
      setUnidades(4);
      setCostoEnvioCod(7.40);
      setCpaPromedio(5.00);
      setTasaEntrega(0.75);
      setCostoRechazo(14.00);
      setIsAutoTasa(false);
      return;
    }

    const sim = simulations.find((s) => s.id === id);
    if (sim) {
      setNombre(sim.nombre);
      setPrecioVenta(Number(sim.precio_venta));
      setCostoUnitario(Number(sim.costo_unitario));
      setUnidades(Number(sim.unidades_por_venta));
      setCostoEnvioCod(Number(sim.costo_envio_cod));
      setCpaPromedio(Number(sim.cpa_promedio));
      setCostoRechazo(Number(sim.costo_rechazo));

      if (sim.tasa_entrega_manual !== null) {
        setIsAutoTasa(false);
        setTasaEntrega(Number(sim.tasa_entrega_manual));
      } else {
        setIsAutoTasa(true);
      }
    }
  }

  // 3. Save simulation
  async function handleSave() {
    if (!storeId) return;
    setSaveStatus("saving");
    setFeedbackMsg("");

    try {
      const res = await fetch("/api/simulaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          nombre,
          precio_venta: precioVenta,
          costo_unitario: costoUnitario,
          unidades_por_venta: unidades,
          costo_envio_cod: costoEnvioCod,
          cpa_promedio: cpaPromedio,
          tasa_entrega_manual: isAutoTasa ? null : tasaEntrega,
          costo_rechazo: costoRechazo,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSaveStatus("success");
        setFeedbackMsg("¡Guardado correctamente!");
        setIsFormOpen(false); // Automatically collapse form on success
        fetchSimulations();
        if (data.simulation) {
          setSelectedId(data.simulation.id);
        }
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        throw new Error(data.error || "Error al guardar");
      }
    } catch (e) {
      setSaveStatus("error");
      setFeedbackMsg(e instanceof Error ? e.message : "Error desconocido");
    }
  }

  // 4. Delete simulation by ID
  async function handleDeleteFromTable(id: string) {
    if (!id || !storeId) return;
    if (!confirm("¿Seguro que deseas eliminar esta simulación?")) return;

    try {
      const res = await fetch(`/api/simulaciones?id=${id}&store_id=${storeId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        if (selectedId === id) {
          setNombre("CC Cream - Base de Maquillaje");
          setPrecioVenta(29.90);
          setCostoUnitario(2.25);
          setUnidades(4);
          setCostoEnvioCod(7.40);
          setCpaPromedio(5.00);
          setTasaEntrega(0.75);
          setCostoRechazo(14.00);
          setIsAutoTasa(false);
          setSelectedId("");
          setIsFormOpen(false); // Close edit form on selection deletion
        }
        fetchSimulations();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete() {
    await handleDeleteFromTable(selectedId);
  }


  // Helper for rendering metrics on the comparative list
  function calculateSimStats(s: Simulation) {
    const precio = Number(s.precio_venta);
    const costoTotal = Number(s.costo_unitario) * Number(s.unidades_por_venta);
    const envio = Number(s.costo_envio_cod);
    const cpa = Number(s.cpa_promedio);
    const rechazo = Number(s.costo_rechazo);
    
    // Fallback to 75% for list rendering if the database rate is auto/null
    const tasa = s.tasa_entrega_manual !== null ? Number(s.tasa_entrega_manual) : 0.75;
    
    const profitDelivered = precio - costoTotal - envio - cpa;
    const lossRejected = rechazo + cpa;
    const expectedProfit = (tasa * profitDelivered) - ((1 - tasa) * lossRejected);
    const breakevenCpa = tasa * (precio - costoTotal - envio) - (1 - tasa) * rechazo;
    
    return {
      costoTotal,
      expectedProfit,
      breakevenCpa,
      tasaFormatted: s.tasa_entrega_manual !== null ? `${Math.round(tasa * 100)}%` : "Auto (75%) 🔄",
    };
  }

  // 5. Mathematical Calculations (useMemo)
  const stats = useMemo(() => {
    const costoProductoTotal = costoUnitario * unidades;
    const margenDelivered = precioVenta - costoProductoTotal - costoEnvioCod - cpaPromedio;
    const lossRejected = costoRechazo + cpaPromedio;

    // Mathematical Expected Profit of 1 sent order
    const expectedProfit = (tasaEntrega * margenDelivered) - ((1 - tasaEntrega) * lossRejected);

    // Breakeven CPA calculation
    const breakevenCpa = tasaEntrega * (precioVenta - costoProductoTotal - costoEnvioCod) - (1 - tasaEntrega) * costoRechazo;

    let marginStatus: "profitable" | "tight" | "loss" = "loss";
    if (expectedProfit > 1.50) {
      marginStatus = "profitable";
    } else if (expectedProfit >= 0.00) {
      marginStatus = "tight";
    }

    return {
      costoProductoTotal: Math.round(costoProductoTotal * 100) / 100,
      margenDelivered: Math.round(margenDelivered * 100) / 100,
      lossRejected: Math.round(lossRejected * 100) / 100,
      expectedProfit: Math.round(expectedProfit * 100) / 100,
      breakevenCpa: Math.round(breakevenCpa * 100) / 100,
      marginStatus,
    };
  }, [precioVenta, costoUnitario, unidades, costoEnvioCod, cpaPromedio, tasaEntrega, costoRechazo]);

  if (!storeId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <p className="text-sm">Por favor, selecciona una tienda primero.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Simulador COD</h2>
            <p className="text-xs text-muted-foreground">Analizador avanzado de rentabilidad y unit economics por envío</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Cargando simulaciones...</p>
        </div>
      ) : (
        <>
          {isFormOpen && (
            <div className="bg-card border rounded-xl p-5 shadow-sm relative overflow-hidden transition-all duration-300 mb-6">
              <div className="flex items-center justify-between border-b pb-3.5 mb-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4.5 text-primary" />
                  <h3 className="font-bold text-xs text-card-foreground">
                    {selectedId ? `⚙️ Editar Parámetros de: ${nombre}` : "➕ Nueva Simulación de Oferta"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setSelectedId("");
                  }}
                  className="text-xs font-semibold text-muted-foreground hover:text-card-foreground px-2 py-1 border rounded hover:bg-muted/40 transition-all shadow-sm"
                >
                  ✕ Colapsar Panel
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Column Left: Controls */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Inputs Block */}
                  <div className="space-y-4">
                    {/* Product Name */}
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Nombre del Producto o Oferta</label>
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="CC Cream - Oferta 4x"
                        className="w-full text-sm border rounded px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>

                    {/* Price & Cost Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Precio de Venta (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={precioVenta}
                          onChange={(e) => setPrecioVenta(Number(e.target.value))}
                          className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Costo Unitario Producto (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={costoUnitario}
                          onChange={(e) => setCostoUnitario(Number(e.target.value))}
                          className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Unidades en Oferta</label>
                        <input
                          type="number"
                          min="1"
                          value={unidades}
                          onChange={(e) => setUnidades(Number(e.target.value))}
                          className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Logistic Fees & Ads */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Costo Envío + COD (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={costoEnvioCod}
                          onChange={(e) => setCostoEnvioCod(Number(e.target.value))}
                          className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">CPA Promedio (Meta/TikTok) (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={cpaPromedio}
                          onChange={(e) => setCpaPromedio(Number(e.target.value))}
                          className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Costo si es Devuelto (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={costoRechazo}
                          onChange={(e) => setCostoRechazo(Number(e.target.value))}
                          className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Delivery Rate Block */}
                    <div className="border border-dashed rounded-xl p-4 bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Percent className="size-4 text-primary" />
                          <span className="text-xs font-bold text-card-foreground">Tasa de Entrega del Producto</span>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isAutoTasa}
                            onChange={(e) => setIsAutoTasa(e.target.checked)}
                            className="rounded border-gray-300 text-primary focus:ring-primary focus:ring-1"
                          />
                          Usar historial real de la DB
                        </label>
                      </div>

                      {isAutoTasa ? (
                        <div className="text-xs text-muted-foreground space-y-1.5">
                          {autoTasaLoading ? (
                            <div className="flex items-center gap-2">
                              <div className="size-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                              <span>Analizando pedidos en base de datos...</span>
                            </div>
                          ) : realStats && realStats.tasa_entrega !== null ? (
                            <div className="flex flex-col gap-1 bg-primary/5 border border-primary/10 rounded-lg p-2.5">
                              <span className="font-semibold text-primary">✓ ¡Tasa cargada automáticamente!</span>
                              <span>Se encontraron <strong>{realStats.total_pedidos}</strong> pedidos con el nombre <i>"{nombre}"</i>.</span>
                              <span>Tasa de entrega calculada: <strong>{(tasaEntrega * 100).toFixed(1)}%</strong></span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                              <AlertCircle className="size-4 shrink-0" />
                              <span>No se encontraron pedidos con el término <i>"{nombre}"</i> para calcular la tasa. Introdúcela a mano desactivando el check.</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                            <span>Ajustar Manualmente:</span>
                            <span className="text-primary font-bold">{(tasaEntrega * 100).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.10"
                            max="1.00"
                            step="0.01"
                            value={tasaEntrega}
                            onChange={(e) => setTasaEntrega(Number(e.target.value))}
                            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-xs font-medium">
                      {saveStatus === "success" && <span className="text-emerald-600 font-semibold">✓ {feedbackMsg}</span>}
                      {saveStatus === "error" && <span className="text-destructive font-semibold">❌ {feedbackMsg}</span>}
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={saveStatus === "saving" || !nombre.trim()}
                      className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4.5 py-2 text-xs rounded-lg hover:bg-primary/95 transition-all shadow-sm disabled:opacity-50"
                    >
                      <Save className="size-4" />
                      {saveStatus === "saving" ? "Guardando..." : "Guardar Simulación"}
                    </button>
                  </div>
                </div>

                {/* Column Right: Analyst Results */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  
                  {/* Main Verdict Card */}
                  <div className={`border rounded-xl p-6 shadow-sm relative overflow-hidden transition-all duration-300 bg-gradient-to-br ${
                    stats.marginStatus === "profitable"
                      ? "from-emerald-50/50 to-emerald-100/10 border-emerald-200"
                      : stats.marginStatus === "tight"
                      ? "from-amber-50/50 to-amber-100/10 border-amber-200"
                      : "from-destructive/5 to-destructive/10 border-destructive/20"
                  }`}>
                    <div className="absolute -top-12 -right-12 size-36 rounded-full opacity-10 bg-primary/20 blur-xl" />

                    <div className="flex items-center gap-1.5 mb-4">
                      <Sparkles className={`size-4 ${
                        stats.marginStatus === "profitable"
                          ? "text-emerald-600 animate-pulse"
                          : stats.marginStatus === "tight"
                          ? "text-amber-600 animate-pulse"
                          : "text-destructive"
                      }`} />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Análisis de Rentabilidad
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-card-foreground truncate mb-1">
                      {nombre || "Producto sin nombre"}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Simulación sobre 1 solo paquete enviado
                    </p>

                    <div className="mb-5">
                      <div className="text-xs text-muted-foreground font-medium">Beneficio Neto Esperado:</div>
                      <div className={`text-3xl font-black tracking-tight ${
                        stats.expectedProfit > 0 ? "text-emerald-600" : "text-destructive"
                      }`}>
                        {stats.expectedProfit > 0 ? "+" : ""}{stats.expectedProfit.toFixed(2)}€
                        <span className="text-xs font-semibold text-muted-foreground ml-1.5">/ envío</span>
                      </div>
                    </div>

                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                      stats.marginStatus === "profitable"
                        ? "bg-emerald-600 text-white"
                        : stats.marginStatus === "tight"
                        ? "bg-amber-500 text-white"
                        : "bg-destructive text-white"
                    }`}>
                      {stats.marginStatus === "profitable" && "🟢 PRODUCTO RENTABLE"}
                      {stats.marginStatus === "tight" && "🟡 MARGEN MUY AJUSTADO"}
                      {stats.marginStatus === "loss" && "🔴 PRODUCTO A PÉRDIDAS"}
                    </div>

                    <div className="mt-6 border-t pt-4.5 space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                        <span>Si se entrega ({(tasaEntrega * 100).toFixed(0)}% de probabilidad)</span>
                        <span className="text-emerald-600 font-bold">+{stats.margenDelivered.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                        <span>Si se devuelve o rechaza ({((1 - tasaEntrega) * 100).toFixed(0)}% de probabilidad)</span>
                        <span className="text-destructive font-bold">-{stats.lossRejected.toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>

                  {/* CPA and meta limits card */}
                  <div className="bg-card border rounded-xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <Info className="size-4.5 text-primary" />
                      <h4 className="text-xs font-bold text-card-foreground">Análisis de Publicidad (Meta Ads)</h4>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/30 border rounded-lg p-2.5 space-y-0.5">
                          <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">CPA Actual</span>
                          <span className="text-base font-extrabold text-card-foreground">{cpaPromedio.toFixed(2)}€</span>
                        </div>
                        <div className="bg-muted/30 border rounded-lg p-2.5 space-y-0.5">
                          <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">CPA de Equilibrio</span>
                          <span className="text-base font-extrabold text-card-foreground">{stats.breakevenCpa.toFixed(2)}€</span>
                        </div>
                      </div>

                      <div className={`rounded-xl p-3 border text-xs flex gap-2.5 items-start ${
                        stats.breakevenCpa > cpaPromedio
                          ? "bg-emerald-50/50 border-emerald-100 text-emerald-800"
                          : "bg-destructive/5 border-destructive/10 text-destructive"
                      }`}>
                        <AlertCircle className="size-4 shrink-0 mt-0.5" />
                        <div>
                          {stats.breakevenCpa > cpaPromedio ? (
                            <div>
                              <span className="font-bold block">✓ Colchón de CPA positivo (+{(stats.breakevenCpa - cpaPromedio).toFixed(2)}€)</span>
                              <span>Meta te permite aumentar el CPA hasta los <strong>{stats.breakevenCpa.toFixed(2)}€</strong> antes de empezar a perder dinero. Tienes un colchón saludable para escalar anuncios.</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold block">⚠️ Alerta: ¡CPA de Equilibrio Superado!</span>
                              <span>Estás pagando en Meta un CPA de <strong>{cpaPromedio.toFixed(2)}€</strong>, pero tu límite de rentabilidad es de <strong>{stats.breakevenCpa.toFixed(2)}€</strong>. Estás perdiendo dinero con este producto. ¡Debes bajar el CPA o subir la tasa de entrega!</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* Comparative Table */}
          {simulations.length > 0 && (
            <div className="bg-card border rounded-xl p-5 shadow-sm mt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5">
                <div>
                  <h3 className="font-bold text-xs text-card-foreground">📋 Comparativa de Productos Simulados</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Haz clic en una fila para editar sus variables base, o **escribe directamente** en las columnas "Simulado" de cada fila para proyectar diferentes volúmenes independientes.
                  </p>
                </div>
                {!isFormOpen && (
                  <button
                    onClick={() => handleSelectChange("")}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground font-semibold px-3.5 py-2 text-xs rounded-lg hover:bg-primary/95 transition-all shadow-sm shrink-0 self-start sm:self-center"
                  >
                    <Sparkles className="size-3.5 animate-pulse" />
                    ➕ Nueva Oferta / Simulación
                  </button>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <th className="py-2.5 px-3">Producto / Oferta</th>
                      <th className="py-2.5 px-3 text-right">Precio Venta</th>
                      <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                      <th className="py-2.5 px-3 text-center">Unidades</th>
                      <th className="py-2.5 px-3 text-right">Costo Total</th>
                      <th className="py-2.5 px-3 text-right">Costo Envío + COD</th>
                      <th className="py-2.5 px-3 text-right">CPA Promedio</th>
                      <th className="py-2.5 px-3 text-center">Tasa Entrega</th>
                      <th className="py-2.5 px-3 text-right">CPA Límite</th>
                      <th className="py-2.5 px-3 text-right text-emerald-600 font-semibold bg-emerald-50/5">Si se Entrega</th>
                      <th className="py-2.5 px-3 text-right text-destructive font-semibold bg-destructive/5">Si se Rechaza</th>
                      <th className="py-2.5 px-3 text-right border-r font-bold">Resultado / Envío</th>
                      
                      {/* Projection Headers */}
                      <th className="py-2.5 px-3 text-center bg-muted/20 text-primary font-bold">Simulado: Pedidos</th>
                      <th className="py-2.5 px-3 text-right bg-muted/20 text-primary font-bold">Simulado: Gasto Ads</th>
                      <th className="py-2.5 px-3 text-right bg-muted/20 text-primary font-bold">Ganancia Diaria</th>
                      <th className="py-2.5 px-3 text-right bg-muted/20 text-primary font-bold">Ganancia Mensual (30d)</th>
                      <th className="py-2.5 px-3 text-center bg-muted/20 text-primary font-bold">ROI Ads</th>
                      
                      <th className="py-2.5 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {simulations.map((s) => {
                      const rowStats = calculateSimStats(s);
                      const isSelected = s.id === selectedId;

                      // If this row is selected (being edited), use the live form state variables instead of DB values!
                      const precio = isSelected ? precioVenta : Number(s.precio_venta);
                      const costoUnit = isSelected ? costoUnitario : Number(s.costo_unitario);
                      const unitsNum = isSelected ? unidades : Number(s.unidades_por_venta);
                      const envCOD = isSelected ? costoEnvioCod : Number(s.costo_envio_cod);
                      const cpaVal = isSelected ? cpaPromedio : Number(s.cpa_promedio);
                      const rechazoCost = isSelected ? costoRechazo : Number(s.costo_rechazo);
                      
                      const tasa = isSelected 
                        ? tasaEntrega 
                        : s.tasa_entrega_manual !== null 
                        ? Number(s.tasa_entrega_manual) 
                        : 0.75;
                      
                      const costoTotal = costoUnit * unitsNum;
                      const profitDelivered = precio - costoTotal - envCOD - cpaVal;
                      const lossRejected = rechazoCost + cpaVal;
                      const expectedProfit = (tasa * profitDelivered) - ((1 - tasa) * lossRejected);
                      const breakevenCpa = tasa * (precio - costoTotal - envCOD) - (1 - tasa) * rechazoCost;

                      const tasaFormatted = isSelected
                        ? `${Math.round(tasa * 100)}%`
                        : s.tasa_entrega_manual !== null
                        ? `${Math.round(tasa * 100)}%`
                        : "Auto (75%) 🔄";

                      // Calculate Scaling Volume (individual per row)
                      const setting = rowScaleSettings[s.id] || { mode: "pedidos", value: 10 };
                      let projectedOrders = 0;
                      let projectedAdsSpend = 0;
                      
                      if (setting.mode === "pedidos") {
                        projectedOrders = setting.value;
                        projectedAdsSpend = setting.value * cpaVal;
                      } else {
                        projectedAdsSpend = setting.value;
                        projectedOrders = cpaVal > 0 ? setting.value / cpaVal : 0;
                      }
                      
                      const projectedDailyProfit = projectedOrders * expectedProfit;
                      const adsRoi = projectedAdsSpend > 0 ? (projectedDailyProfit / projectedAdsSpend) * 100 : 0;

                      return (
                        <tr
                          key={s.id}
                          onClick={() => handleSelectChange(s.id)}
                          className={`hover:bg-muted/40 cursor-pointer transition-colors ${
                            isSelected ? "bg-primary/5 font-semibold" : ""
                          }`}
                        >
                          <td className="py-3 px-3 text-card-foreground font-medium truncate max-w-[150px]">
                            {isSelected ? nombre : s.nombre}
                          </td>
                          <td className="py-3 px-3 text-right font-medium">{precio.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{costoUnit.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-center text-muted-foreground">{unitsNum}x</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{costoTotal.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{envCOD.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{cpaVal.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-center font-semibold text-primary">{tasaFormatted}</td>
                          <td className="py-3 px-3 text-right font-bold text-card-foreground">{breakevenCpa.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-semibold bg-emerald-50/5">+{profitDelivered.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-destructive font-semibold bg-destructive/5">-{lossRejected.toFixed(2)}€</td>
                          <td className={`py-3 px-3 text-right font-black border-r ${
                            expectedProfit > 0 ? "text-emerald-600 bg-emerald-50/5" : "text-destructive bg-destructive/5"
                          }`}>
                            {expectedProfit > 0 ? "+" : ""}{expectedProfit.toFixed(2)}€
                          </td>

                          {/* Projected scaling volume (with direct inputs per row) */}
                          <td className="py-2.5 px-3 bg-muted/5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={projectedOrders % 1 === 0 ? projectedOrders : Number(projectedOrders.toFixed(1))}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value));
                                  updateRowScale(s.id, "pedidos", val);
                                }}
                                className="w-16 text-center text-xs font-bold border rounded px-1.5 py-0.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                              <span className="text-[10px] text-muted-foreground font-semibold">/día</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 bg-muted/5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={projectedAdsSpend % 1 === 0 ? projectedAdsSpend : Number(projectedAdsSpend.toFixed(2))}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value));
                                  updateRowScale(s.id, "presupuesto", val);
                                }}
                                className="w-20 text-center text-xs font-bold border rounded px-1.5 py-0.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                              <span className="text-[10px] text-muted-foreground font-semibold">€</span>
                            </div>
                          </td>

                          <td className={`py-3 px-3 text-right font-bold bg-muted/5 ${
                            projectedDailyProfit > 0 ? "text-emerald-600 bg-emerald-50/5" : "text-destructive bg-destructive/5"
                          }`}>
                            {projectedDailyProfit > 0 ? "+" : ""}{projectedDailyProfit.toFixed(2)}€
                          </td>
                          <td className={`py-3 px-3 text-right font-black bg-muted/5 ${
                            projectedDailyProfit > 0 ? "text-emerald-600 bg-emerald-50/5" : "text-destructive bg-destructive/5"
                          }`}>
                            {projectedDailyProfit * 30 > 0 ? "+" : ""}{(projectedDailyProfit * 30).toFixed(2)}€
                          </td>
                          <td className="py-3 px-3 text-center bg-muted/5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              adsRoi > 0
                                ? "bg-emerald-100 text-emerald-800"
                                : adsRoi === 0
                                ? "bg-muted text-muted-foreground"
                                : "bg-destructive/10 text-destructive"
                            }`}>
                              {adsRoi > 0 ? "+" : ""}{adsRoi.toFixed(1)}% ROI
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                handleSelectChange(s.id);
                              }}
                              className="p-1 text-primary hover:bg-primary/10 rounded transition-all"
                              title="Editar variables base"
                            >
                              <Edit2 className="size-4" />
                            </button>
                            <button
                              onClick={() => {
                                handleDeleteFromTable(s.id);
                              }}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded border border-transparent hover:border-destructive/20 transition-all"
                              title="Eliminar simulación"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
      <SimuladorContent />
    </Suspense>
  );
}
