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
  costo_fulfillment_proveedor: number;
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
  const [costoFulfillment, setCostoFulfillment] = useState(0.00);
  // Budget Optimizer
  const [budget, setBudget] = useState(100.00);
  const [strategy, setStrategy] = useState<"roi" | "diversified" | "volume" | "portfolio">("roi");
  const [numProducts, setNumProducts] = useState(5);
  const [minBudgetMode, setMinBudgetMode] = useState<"none" | "cpa_1.5" | "cpa_2.0" | "custom">("cpa_1.5");
  const [minBudgetCustomVal, setMinBudgetCustomVal] = useState(15.00);
  const [excessDistribution, setExcessDistribution] = useState<"best_roi" | "proportional">("best_roi");
  const [excludedProductIds, setExcludedProductIds] = useState<Record<string, boolean>>({});

  function toggleProductExclusion(id: string) {
    setExcludedProductIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

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

  // Sorting state
  const [sortBy, setSortBy] = useState<"nombre" | "expectedProfit" | "roi" | "dailyProfit">("nombre");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  function handleSort(field: "nombre" | "expectedProfit" | "roi" | "dailyProfit") {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc"); // Default to descending because users want higher values first!
    }
  }

  function getSortIcon(field: "nombre" | "expectedProfit" | "roi" | "dailyProfit") {
    if (sortBy !== field) return " ↕️";
    return sortOrder === "asc" ? " ▲" : " ▼";
  }

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
      setCostoFulfillment(0.00);
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
      setCostoFulfillment(Number(sim.costo_fulfillment_proveedor) || 0.00);

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
          costo_fulfillment_proveedor: costoFulfillment,
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
          setCostoFulfillment(0.00);
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
    const costoTotal = (Number(s.costo_unitario) * Number(s.unidades_por_venta)) + (Number(s.costo_fulfillment_proveedor) || 0);
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
    const costoProductoTotal = (costoUnitario * unidades) + costoFulfillment;
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
  }, [precioVenta, costoUnitario, unidades, costoFulfillment, costoEnvioCod, cpaPromedio, tasaEntrega, costoRechazo]);

  // Sorted and calculated simulations list for rendering and sorting
  const sortedSimulations = useMemo(() => {
    const computed = simulations.map((s) => {
      const isSelected = s.id === selectedId;
      const precio = isSelected ? precioVenta : Number(s.precio_venta);
      const costoUnit = isSelected ? costoUnitario : Number(s.costo_unitario);
      const unitsNum = isSelected ? unidades : Number(s.unidades_por_venta);
      const envCOD = isSelected ? costoEnvioCod : Number(s.costo_envio_cod);
      const cpaVal = isSelected ? cpaPromedio : Number(s.cpa_promedio);
      const rechazoCost = isSelected ? costoRechazo : Number(s.costo_rechazo);
      const fulfillmentCost = isSelected ? costoFulfillment : (Number(s.costo_fulfillment_proveedor) || 0);
      
      const tasa = isSelected 
        ? tasaEntrega 
        : s.tasa_entrega_manual !== null 
        ? Number(s.tasa_entrega_manual) 
        : 0.75;
      
      const costoTotal = (costoUnit * unitsNum) + fulfillmentCost;
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

      return {
        simulation: s,
        id: s.id,
        nombre: isSelected ? nombre : s.nombre,
        precio,
        costoUnit,
        unitsNum,
        envCOD,
        cpaVal,
        rechazoCost,
        tasa,
        costoTotal,
        profitDelivered,
        lossRejected,
        expectedProfit,
        breakevenCpa,
        tasaFormatted,
        projectedOrders,
        projectedAdsSpend,
        projectedDailyProfit,
        adsRoi,
      };
    });

    return [...computed].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortBy === "nombre") {
        valA = a.nombre.toLowerCase();
        valB = b.nombre.toLowerCase();
      } else if (sortBy === "expectedProfit") {
        valA = a.expectedProfit;
        valB = b.expectedProfit;
      } else if (sortBy === "roi") {
        valA = a.adsRoi;
        valB = b.adsRoi;
      } else if (sortBy === "dailyProfit") {
        valA = a.projectedDailyProfit;
        valB = b.projectedDailyProfit;
      } else {
        return 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    simulations,
    selectedId,
    precioVenta,
    costoUnitario,
    unidades,
    costoFulfillment,
    costoEnvioCod,
    cpaPromedio,
    tasaEntrega,
    costoRechazo,
    nombre,
    rowScaleSettings,
    sortBy,
    sortOrder,
  ]);

  // 6. Deterministic Budget Optimization Logic
  const optimizedAllocation = useMemo(() => {
    // Filter out excluded products or those with non-positive expected profit
    const profitable = sortedSimulations.filter(
      (item) => item.expectedProfit > 0 && !excludedProductIds[item.id]
    );
    
    if (profitable.length === 0 || budget <= 0) {
      return {
        allocations: [],
        totalDailyProfit: 0,
        overallRoi: 0,
        totalOrders: 0,
        totalSpent: 0,
        isBudgetInsufficient: false,
        activeCount: 0,
        targetCount: 0,
      };
    }

    let allocations: Array<{
      id: string;
      nombre: string;
      cpa: number;
      expectedProfit: number;
      roi: number;
      budgetAllocated: number;
      ordersProjected: number;
      profitProjected: number;
      isAtMinBudget: boolean;
    }> = [];

    let totalSpent = 0;
    let isBudgetInsufficient = false;
    let activeCount = 0;
    let targetCount = 0;

    if (strategy === "roi") {
      const best = [...profitable].sort((a, b) => b.adsRoi - a.adsRoi)[0];
      const orders = best.cpaVal > 0 ? budget / best.cpaVal : 0;
      allocations.push({
        id: best.id,
        nombre: best.nombre,
        cpa: best.cpaVal,
        expectedProfit: best.expectedProfit,
        roi: best.adsRoi,
        budgetAllocated: budget,
        ordersProjected: orders,
        profitProjected: orders * best.expectedProfit,
        isAtMinBudget: false,
      });
      totalSpent = budget;
      activeCount = 1;
      targetCount = 1;
    } else if (strategy === "volume") {
      const sortedByCpa = [...profitable].sort((a, b) => a.cpaVal - b.cpaVal);
      const bestVolume = sortedByCpa[0];
      const orders = bestVolume.cpaVal > 0 ? budget / bestVolume.cpaVal : 0;
      allocations.push({
        id: bestVolume.id,
        nombre: bestVolume.nombre,
        cpa: bestVolume.cpaVal,
        expectedProfit: bestVolume.expectedProfit,
        roi: bestVolume.adsRoi,
        budgetAllocated: budget,
        ordersProjected: orders,
        profitProjected: orders * bestVolume.expectedProfit,
        isAtMinBudget: false,
      });
      totalSpent = budget;
      activeCount = 1;
      targetCount = 1;
    } else if (strategy === "diversified") {
      const totalRoi = profitable.reduce((sum, item) => sum + item.adsRoi, 0);
      profitable.forEach((item) => {
        const weight = totalRoi > 0 ? item.adsRoi / totalRoi : 0;
        const budgetShare = budget * weight;
        const orders = item.cpaVal > 0 ? budgetShare / item.cpaVal : 0;
        allocations.push({
          id: item.id,
          nombre: item.nombre,
          cpa: item.cpaVal,
          expectedProfit: item.expectedProfit,
          roi: item.adsRoi,
          budgetAllocated: budgetShare,
          ordersProjected: orders,
          profitProjected: orders * item.expectedProfit,
          isAtMinBudget: false,
        });
      });
      totalSpent = budget;
      activeCount = profitable.length;
      targetCount = profitable.length;
    } else if (strategy === "portfolio") {
      // Sort by ROI descending
      const candidates = [...profitable].sort((a, b) => b.adsRoi - a.adsRoi);
      targetCount = Math.min(numProducts, candidates.length);
      const selectedCandidates = candidates.slice(0, targetCount);

      // Determine min budgets for each
      const minBudgets: Record<string, number> = {};
      selectedCandidates.forEach((item) => {
        let minB = 0;
        if (minBudgetMode === "cpa_1.5") {
          minB = 1.5 * item.cpaVal;
        } else if (minBudgetMode === "cpa_2.0") {
          minB = 2.0 * item.cpaVal;
        } else if (minBudgetMode === "custom") {
          minB = minBudgetCustomVal;
        }
        minBudgets[item.id] = minB;
      });

      // Greedily allocate minimum budgets
      let allocatedMinBudgets: Record<string, number> = {};
      let totalMinAllocated = 0;
      let supportedCandidates: typeof selectedCandidates = [];

      for (let i = 0; i < selectedCandidates.length; i++) {
        const item = selectedCandidates[i];
        const minB = minBudgets[item.id];
        if (totalMinAllocated + minB <= budget) {
          allocatedMinBudgets[item.id] = minB;
          totalMinAllocated += minB;
          supportedCandidates.push(item);
        } else {
          isBudgetInsufficient = true;
          if (i === 0) {
            // Allocate whatever is left to the first one
            allocatedMinBudgets[item.id] = budget;
            totalMinAllocated = budget;
            supportedCandidates.push(item);
          }
          break;
        }
      }

      activeCount = supportedCandidates.length;
      if (activeCount < targetCount) {
        isBudgetInsufficient = true;
      }

      // Calculate excess budget
      const excess = budget - totalMinAllocated;

      // Distribute excess
      let finalBudgets: Record<string, { amount: number; isAtMin: boolean }> = {};
      supportedCandidates.forEach((item) => {
        finalBudgets[item.id] = {
          amount: allocatedMinBudgets[item.id] || 0,
          isAtMin: true,
        };
      });

      if (excess > 0 && supportedCandidates.length > 0) {
        if (excessDistribution === "best_roi") {
          const bestId = supportedCandidates[0].id;
          finalBudgets[bestId].amount += excess;
          finalBudgets[bestId].isAtMin = false;
        } else {
          const totalRoiOfSupported = supportedCandidates.reduce((sum, item) => sum + item.adsRoi, 0);
          supportedCandidates.forEach((item) => {
            const weight = totalRoiOfSupported > 0 ? item.adsRoi / totalRoiOfSupported : 0;
            const share = excess * weight;
            finalBudgets[item.id].amount += share;
            if (share > 0.01) {
              finalBudgets[item.id].isAtMin = false;
            }
          });
        }
      }

      // Build allocations
      supportedCandidates.forEach((item) => {
        const budgetAllocated = finalBudgets[item.id]?.amount || 0;
        const orders = item.cpaVal > 0 ? budgetAllocated / item.cpaVal : 0;
        allocations.push({
          id: item.id,
          nombre: item.nombre,
          cpa: item.cpaVal,
          expectedProfit: item.expectedProfit,
          roi: item.adsRoi,
          budgetAllocated,
          ordersProjected: orders,
          profitProjected: orders * item.expectedProfit,
          isAtMinBudget: finalBudgets[item.id]?.isAtMin || false,
        });
      });

      totalSpent = budget;
    }

    const totalDailyProfit = allocations.reduce((sum, item) => sum + item.profitProjected, 0);
    const totalOrders = allocations.reduce((sum, item) => sum + item.ordersProjected, 0);
    const overallRoi = totalSpent > 0 ? (totalDailyProfit / totalSpent) * 100 : 0;

    return {
      allocations,
      totalDailyProfit,
      overallRoi,
      totalOrders,
      totalSpent,
      isBudgetInsufficient,
      activeCount,
      targetCount,
    };
  }, [
    sortedSimulations,
    budget,
    strategy,
    numProducts,
    minBudgetMode,
    minBudgetCustomVal,
    excessDistribution,
    excludedProductIds,
  ]);




  // Aggregated totals of projected volumes
  const totals = useMemo(() => {
    let totalAdsSpend = 0;
    let totalDailyProfit = 0;
    let totalOrders = 0;

    sortedSimulations.forEach((item) => {
      totalAdsSpend += item.projectedAdsSpend;
      totalDailyProfit += item.projectedDailyProfit;
      totalOrders += item.projectedOrders;
    });

    const totalMonthlyProfit = totalDailyProfit * 30;
    const overallRoi = totalAdsSpend > 0 ? (totalDailyProfit / totalAdsSpend) * 100 : 0;

    return {
      totalAdsSpend,
      totalDailyProfit,
      totalMonthlyProfit,
      totalOrders,
      overallRoi,
    };
  }, [sortedSimulations]);

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
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] sm:text-xs font-semibold text-muted-foreground mb-1">Precio de Venta (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={precioVenta}
                          onChange={(e) => setPrecioVenta(Number(e.target.value))}
                          className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-semibold text-muted-foreground mb-1">Costo Unitario (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={costoUnitario}
                          onChange={(e) => setCostoUnitario(Number(e.target.value))}
                          className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-semibold text-muted-foreground mb-1">Unidades</label>
                        <input
                          type="number"
                          min="1"
                          value={unidades}
                          onChange={(e) => setUnidades(Number(e.target.value))}
                          className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-semibold text-muted-foreground mb-1">Fulfillment Prov. (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={costoFulfillment}
                          onChange={(e) => setCostoFulfillment(Number(e.target.value))}
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
                    Haz clic en una fila para editar sus variables base, marca/desmarca el checkbox del nombre para incluir/excluir en la optimización automática de anuncios, o **escribe directamente** en las columnas "Simulado" de cada fila para proyectar diferentes volúmenes independientes.
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
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground select-none">
                      <th 
                        className="py-2.5 px-3 cursor-pointer hover:bg-muted/60 transition-all font-bold"
                        onClick={() => handleSort("nombre")}
                        title="Ordenar por Nombre"
                      >
                        <div className="flex items-center gap-1">
                          Producto / Oferta{getSortIcon("nombre")}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-right">Precio Venta</th>
                      <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                      <th className="py-2.5 px-3 text-center">Unidades</th>
                      <th className="py-2.5 px-3 text-right">Fulfillment Prov.</th>
                      <th className="py-2.5 px-3 text-right">Costo Total</th>
                      <th className="py-2.5 px-3 text-right">Costo Envío + COD</th>
                      <th className="py-2.5 px-3 text-right">CPA Promedio</th>
                      <th className="py-2.5 px-3 text-center">Tasa Entrega</th>
                      <th className="py-2.5 px-3 text-right">CPA Límite</th>
                      <th className="py-2.5 px-3 text-right text-emerald-600 font-semibold bg-emerald-50/5">Si se Entrega</th>
                      <th className="py-2.5 px-3 text-right text-destructive font-semibold bg-destructive/5">Si se Rechaza</th>
                      <th 
                        className="py-2.5 px-3 text-right border-r font-black cursor-pointer hover:bg-muted/60 transition-all"
                        onClick={() => handleSort("expectedProfit")}
                        title="Ordenar por Resultado / Envío"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Resultado / Envío{getSortIcon("expectedProfit")}
                        </div>
                      </th>
                      
                      {/* Projection Headers */}
                      <th className="py-2.5 px-3 text-center bg-muted/20 text-primary font-bold">Simulado: Pedidos</th>
                      <th className="py-2.5 px-3 text-right bg-muted/20 text-primary font-bold">Simulado: Gasto Ads</th>
                      <th 
                        className="py-2.5 px-3 text-right bg-muted/20 text-primary font-black cursor-pointer hover:bg-muted/30 transition-all"
                        onClick={() => handleSort("dailyProfit")}
                        title="Ordenar por Ganancia Diaria"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Ganancia Diaria{getSortIcon("dailyProfit")}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-right bg-muted/20 text-primary font-bold">Ganancia Mensual (30d)</th>
                      <th 
                        className="py-2.5 px-3 text-center bg-muted/20 text-primary font-black cursor-pointer hover:bg-muted/30 transition-all"
                        onClick={() => handleSort("roi")}
                        title="Ordenar por ROI de Ads"
                      >
                        <div className="flex items-center justify-center gap-1">
                          ROI Ads{getSortIcon("roi")}
                        </div>
                      </th>
                      
                      <th className="py-2.5 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedSimulations.map((item) => {
                      const s = item.simulation;
                      const isSelected = s.id === selectedId;

                      return (
                        <tr
                          key={s.id}
                          onClick={() => handleSelectChange(s.id)}
                          className={`hover:bg-muted/40 cursor-pointer transition-colors ${
                            isSelected ? "bg-primary/5 font-semibold" : ""
                          }`}
                        >
                          <td className="py-3 px-3 text-card-foreground font-medium truncate max-w-[150px]" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!excludedProductIds[s.id]}
                                onChange={() => toggleProductExclusion(s.id)}
                                className="rounded border-gray-300 text-primary focus:ring-primary/50 focus:ring-1 cursor-pointer size-3.5 shrink-0"
                                title={excludedProductIds[s.id] ? "Incluir en optimizador" : "Excluir de optimizador"}
                              />
                              <span 
                                onClick={() => handleSelectChange(s.id)}
                                className={`cursor-pointer hover:underline ${
                                  excludedProductIds[s.id] ? "line-through text-muted-foreground/50 font-normal" : ""
                                }`}
                              >
                                {item.nombre}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-medium">{item.precio.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{item.costoUnit.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-center text-muted-foreground">{item.unitsNum}x</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{(isSelected ? costoFulfillment : (Number(s.costo_fulfillment_proveedor) || 0)).toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{item.costoTotal.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{item.envCOD.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{item.cpaVal.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-center font-semibold text-primary">{item.tasaFormatted}</td>
                          <td className="py-3 px-3 text-right font-bold text-card-foreground">{item.breakevenCpa.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-semibold bg-emerald-50/5">+{item.profitDelivered.toFixed(2)}€</td>
                          <td className="py-3 px-3 text-right text-destructive font-semibold bg-destructive/5">-{item.lossRejected.toFixed(2)}€</td>
                          <td className={`py-3 px-3 text-right font-black border-r ${
                            item.expectedProfit > 0 ? "text-emerald-600 bg-emerald-50/5" : "text-destructive bg-destructive/5"
                          }`}>
                            {item.expectedProfit > 0 ? "+" : ""}{item.expectedProfit.toFixed(2)}€
                          </td>

                          {/* Projected scaling volume (with direct inputs per row) */}
                          <td className="py-2.5 px-3 bg-muted/5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.projectedOrders % 1 === 0 ? item.projectedOrders : Number(item.projectedOrders.toFixed(1))}
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
                                value={item.projectedAdsSpend % 1 === 0 ? item.projectedAdsSpend : Number(item.projectedAdsSpend.toFixed(2))}
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
                            item.projectedDailyProfit > 0 ? "text-emerald-600 bg-emerald-50/5" : "text-destructive bg-destructive/5"
                          }`}>
                            {item.projectedDailyProfit > 0 ? "+" : ""}{item.projectedDailyProfit.toFixed(2)}€
                          </td>
                          <td className={`py-3 px-3 text-right font-black bg-muted/5 ${
                            item.projectedDailyProfit > 0 ? "text-emerald-600 bg-emerald-50/5" : "text-destructive bg-destructive/5"
                          }`}>
                            {item.projectedDailyProfit * 30 > 0 ? "+" : ""}{(item.projectedDailyProfit * 30).toFixed(2)}€
                          </td>
                          <td className="py-3 px-3 text-center bg-muted/5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.adsRoi > 0
                                ? "bg-emerald-100 text-emerald-800"
                                : item.adsRoi === 0
                                ? "bg-muted text-muted-foreground"
                                : "bg-destructive/10 text-destructive"
                            }`}>
                              {item.adsRoi > 0 ? "+" : ""}{item.adsRoi.toFixed(1)}% ROI
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

                    {/* Sum/Totals Row */}
                    <tr className="bg-primary/5 font-extrabold border-t-2 border-double border-primary/20">
                      <td className="py-3 px-3 text-primary font-bold text-xs">TOTAL SIMULADO</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-center text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-center text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">-</td>
                      <td className="py-3 px-3 text-right text-muted-foreground border-r font-medium">-</td>
                      
                      {/* Projected scaling totals */}
                      <td className="py-3 px-3 text-center text-primary bg-primary/10 font-bold">
                        {totals.totalOrders % 1 === 0 ? totals.totalOrders : totals.totalOrders.toFixed(1)} /día
                      </td>
                      <td className="py-3 px-3 text-right text-primary font-black bg-primary/10">
                        {totals.totalAdsSpend.toFixed(2)}€
                      </td>
                      <td className={`py-3 px-3 text-right font-black bg-primary/10 ${
                        totals.totalDailyProfit > 0 ? "text-emerald-600" : "text-destructive"
                      }`}>
                        {totals.totalDailyProfit > 0 ? "+" : ""}{totals.totalDailyProfit.toFixed(2)}€
                      </td>
                      <td className={`py-3 px-3 text-right font-black bg-primary/10 ${
                        totals.totalMonthlyProfit > 0 ? "text-emerald-600" : "text-destructive"
                      }`}>
                        {totals.totalMonthlyProfit > 0 ? "+" : ""}{totals.totalMonthlyProfit.toFixed(2)}€
                      </td>
                      <td className="py-3 px-3 text-center bg-primary/10">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                          totals.overallRoi > 0
                            ? "bg-emerald-600 text-white"
                            : totals.overallRoi === 0
                            ? "bg-muted text-muted-foreground"
                            : "bg-destructive text-white"
                        }`}>
                          {totals.overallRoi > 0 ? "+" : ""}{totals.overallRoi.toFixed(1)}% ROI
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-muted-foreground">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Ads Budget Optimizer Panel */}
            {simulations.length > 0 && (
              <div className="bg-card border rounded-xl p-6 shadow-sm mt-6 space-y-6 bg-gradient-to-br from-card to-secondary/5 relative overflow-hidden">
                <div className="absolute -top-24 -left-24 size-48 rounded-full opacity-5 bg-primary/30 blur-2xl pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
                      <TrendingUp className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-card-foreground">🚀 Optimizador Estratégico de Presupuesto Ads</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Distribuye tu presupuesto diario de publicidad de manera óptima entre tus ofertas ganadoras.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Inputs block */}
                  <div className="md:col-span-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Presupuesto Diario Ads (€)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          value={budget}
                          onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
                          className="w-full text-sm border rounded px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none pl-8 font-bold"
                        />
                        <span className="absolute left-3 top-2 text-muted-foreground text-sm font-semibold">€</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Estrategia de Crecimiento
                      </label>
                      <select
                        value={strategy}
                        onChange={(e) => setStrategy(e.target.value as any)}
                        className="w-full text-sm border rounded px-3 py-2 bg-background focus:ring-1 focus:ring-primary focus:outline-none font-medium cursor-pointer"
                      >
                        <option value="roi">📈 Rentabilidad Máxima (Best ROI)</option>
                        <option value="portfolio">💼 Cartera Optimizada (Top N)</option>
                        <option value="diversified">⚖️ Diversificación Equilibrada</option>
                        <option value="volume">🔥 Volumen Máximo de Pedidos</option>
                      </select>
                    </div>

                    {strategy === "portfolio" && (
                      <div className="space-y-3 pt-3 border-t border-dashed">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                            Nº de Productos a Activar (Top N)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="15"
                            value={numProducts}
                            onChange={(e) => setNumProducts(Math.max(1, Number(e.target.value)))}
                            className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                            Presupuesto Mínimo por Campaña
                          </label>
                          <select
                            value={minBudgetMode}
                            onChange={(e) => setMinBudgetMode(e.target.value as any)}
                            className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none font-medium cursor-pointer"
                          >
                            <option value="cpa_1.5">⚡ Automático (1.5x CPA)</option>
                            <option value="cpa_2.0">🔥 Automático (2.0x CPA)</option>
                            <option value="custom">⚙️ Fijo Personalizado</option>
                            <option value="none">❌ Ninguno (Sin mínimo)</option>
                          </select>
                        </div>

                        {minBudgetMode === "custom" && (
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                              Monto Mínimo por Campaña (€/día)
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="0.5"
                              value={minBudgetCustomVal}
                              onChange={(e) => setMinBudgetCustomVal(Math.max(0, Number(e.target.value)))}
                              className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none font-medium"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                            Distribución de Excedente
                          </label>
                          <select
                            value={excessDistribution}
                            onChange={(e) => setExcessDistribution(e.target.value as any)}
                            className="w-full text-sm border rounded px-3 py-1.5 bg-background focus:ring-1 focus:ring-primary focus:outline-none font-medium cursor-pointer"
                          >
                            <option value="best_roi">⭐ Concentrar en Mejor ROI</option>
                            <option value="proportional">⚖️ Proporcional al ROI</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t">
                      <div className="text-[10px] text-muted-foreground leading-relaxed">
                        * El optimizador matemático **excluye** automáticamente los productos a pérdidas o con ROI negativo para proteger tu capital de anuncios.
                      </div>
                    </div>
                  </div>

                  {/* Results/Metrics display */}
                  <div className="md:col-span-8 space-y-6">
                    {/* Aggregated Totals Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-muted/30 border rounded-xl p-3.5 space-y-1">
                        <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Presupuesto Ads</span>
                        <span className="text-lg font-extrabold text-card-foreground">{optimizedAllocation.totalSpent.toFixed(2)}€</span>
                      </div>
                      <div className="bg-muted/30 border rounded-xl p-3.5 space-y-1">
                        <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ganancia Diaria Net</span>
                        <span className={`text-lg font-black ${
                          optimizedAllocation.totalDailyProfit > 0 ? "text-emerald-600" : "text-card-foreground"
                        }`}>
                          +{optimizedAllocation.totalDailyProfit.toFixed(2)}€
                        </span>
                      </div>
                      <div className="bg-muted/30 border rounded-xl p-3.5 space-y-1">
                        <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ganancia Mensual</span>
                        <span className={`text-lg font-black ${
                          optimizedAllocation.totalDailyProfit > 0 ? "text-emerald-600" : "text-card-foreground"
                        }`}>
                          +{(optimizedAllocation.totalDailyProfit * 30).toFixed(0)}€
                        </span>
                      </div>
                      <div className="bg-muted/30 border rounded-xl p-3.5 space-y-1">
                        <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ROI de Ads</span>
                        <span className="text-lg font-black text-primary">
                          +{optimizedAllocation.overallRoi.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Allocations Breakdown */}
                    <div className="space-y-3">
                      {optimizedAllocation.isBudgetInsufficient && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex gap-2.5 items-start mb-4">
                          <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600 animate-pulse" />
                          <div>
                            <span className="font-bold block text-amber-900 mb-0.5">⚠️ Presupuesto Ajustado / Insuficiente</span>
                            <span>
                              Tu presupuesto diario de <strong>{budget.toFixed(2)}€</strong> no es suficiente para cubrir el presupuesto mínimo viable de los <strong>{optimizedAllocation.targetCount}</strong> productos solicitados. 
                              Hemos priorizado y activado únicamente los <strong>{optimizedAllocation.activeCount}</strong> productos de mayor ROI. 
                              Sube el presupuesto diario o reduce el mínimo por campaña para activar más productos.
                            </span>
                          </div>
                        </div>
                      )}

                      <h4 className="text-xs font-bold text-card-foreground uppercase tracking-wider">Distribución Recomendada de Ads</h4>
                      {optimizedAllocation.allocations.length === 0 ? (
                        <div className="border border-dashed rounded-xl p-6 text-center text-muted-foreground">
                          <AlertCircle className="size-6 text-muted-foreground mx-auto mb-2" />
                          <span className="text-xs">No tienes productos con rentabilidad esperada positiva en tu catálogo. ¡Ajusta tus precios, cpa o tasas de entrega!</span>
                        </div>
                      ) : (
                        <div className="overflow-x-auto border rounded-xl bg-background shadow-sm">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b bg-muted/40 font-semibold text-muted-foreground select-none">
                                <th className="py-2.5 px-3.5 font-bold">Producto / Oferta</th>
                                <th className="py-2.5 px-3 text-center font-bold">ROI Ads</th>
                                <th className="py-2.5 px-3 text-right font-bold">Presupuesto Ads</th>
                                <th className="py-2.5 px-3 text-right font-bold">Pedidos Est.</th>
                                <th className="py-2.5 px-3.5 text-right text-emerald-600 font-bold">Ganancia Diaria Net</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {optimizedAllocation.allocations.map((item) => (
                                <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                                  <td className="py-3 px-3.5 text-card-foreground font-bold truncate max-w-[180px]">
                                    {item.nombre}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      +{item.roi.toFixed(0)}% ROI
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-right font-semibold text-card-foreground">
                                    <div className="flex flex-col items-end">
                                      <span>{item.budgetAllocated.toFixed(2)}€<span className="text-[10px] text-muted-foreground font-normal"> /día</span></span>
                                      {strategy === "portfolio" && (
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                          item.isAtMinBudget 
                                            ? "text-muted-foreground/60" 
                                            : "text-emerald-600"
                                        }`}>
                                          {item.isAtMinBudget ? "Mín. Viable" : "Optimizado 🔥"}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                                    {item.ordersProjected.toFixed(1)}<span className="text-[10px] text-muted-foreground font-normal"> ped/día</span>
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-black text-emerald-600">
                                    +{item.profitProjected.toFixed(2)}€<span className="text-[10px] font-normal text-emerald-600/70"> /día</span>
                                  </td>
                                </tr>
                              ))}
                              
                              {/* Totals row inside allocator */}
                              <tr className="bg-primary/5 font-extrabold border-t-2 border-double border-primary/20">
                                <td className="py-2.5 px-3.5 text-primary font-bold">TOTAL OPTIMIZADO</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-primary text-primary-foreground">
                                    +{optimizedAllocation.overallRoi.toFixed(1)}% ROI
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right text-primary font-black">
                                  {optimizedAllocation.totalSpent.toFixed(2)}€<span className="text-[10px] font-normal"> /d</span>
                                </td>
                                <td className="py-2.5 px-3 text-right text-primary font-bold">
                                  {optimizedAllocation.totalOrders.toFixed(1)}<span className="text-[10px] font-normal"> /d</span>
                                </td>
                                <td className="py-2.5 px-3.5 text-right text-emerald-600 font-black">
                                  +{optimizedAllocation.totalDailyProfit.toFixed(2)}€<span className="text-[10px] font-normal"> /día</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
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
