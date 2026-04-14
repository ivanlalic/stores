"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncButton } from "@/components/sync-button";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { gooeyToast } from "goey-toast";

export default function SettingsPage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("Mi Tienda");
  const [newApiKey, setNewApiKey] = useState("");
  const [feeGestion, setFeeGestion] = useState("0");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [costoRechazo, setCostoRechazo] = useState("13");
  const [diasRolling, setDiasRolling] = useState("30");
  const [diasExcluir, setDiasExcluir] = useState("4");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.config) {
        setFeeGestion(String(data.config.fee_gestion_eur || 0));
        setHasApiKey(data.config.has_api_key);
        setStoreName(data.config.store_name || "Mi Tienda");
        setCostoRechazo(String(data.config.costo_rechazo ?? 13));
        setDiasRolling(String(data.config.dias_rolling ?? 30));
        setDiasExcluir(String(data.config.dias_excluir ?? 4));
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        fee_gestion_eur: parseFloat(feeGestion) || 0,
        store_name: storeName.trim() || "Mi Tienda",
        costo_rechazo: parseFloat(costoRechazo) || 13,
        dias_rolling: parseInt(diasRolling) || 30,
        dias_excluir: parseInt(diasExcluir) || 4,
      };
      if (newApiKey) {
        body.dropea_api_key = newApiKey;
      }
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error guardando");
      gooeyToast.success("Configuración guardada");
      if (newApiKey) {
        setHasApiKey(true);
        setNewApiKey("");
      }
    } catch {
      gooeyToast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-lg font-semibold">Configuracion</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tu tienda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre de la tienda</Label>
            <Input
              placeholder="Ej: IBericaStore"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se muestra en la barra de navegacion.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API de Dropea</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            {hasApiKey && (
              <p className="text-xs text-muted-foreground">
                API key configurada. Ingresa una nueva para reemplazarla.
              </p>
            )}
            <Input
              type="password"
              placeholder={hasApiKey ? "******* (dejar vacio para no cambiar)" : "AIza..."}
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Fee de gestion (EUR por pedido enviado)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={feeGestion}
              onChange={(e) => setFeeGestion(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Monto fijo en EUR cobrado por gestor externo por pedido enviado. 0 si no aplica.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="animate-spin size-4" />}
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Break-Even</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Costo por rechazo (EUR)</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={costoRechazo}
              onChange={(e) => setCostoRechazo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Costo fijo por cada pedido rechazado. Por defecto €13.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Días rolling para promedios</Label>
            <Input
              type="number"
              step="1"
              min="7"
              max="90"
              value={diasRolling}
              onChange={(e) => setDiasRolling(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ventana de días para calcular bruto/enviado y tasa de rechazo. Por defecto 30.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Días a excluir (rechazo)</Label>
            <Input
              type="number"
              step="1"
              min="0"
              max="14"
              value={diasExcluir}
              onChange={(e) => setDiasExcluir(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Últimos N días a excluir del cálculo de tasa de rechazo (pendientes en tránsito). Por defecto 4.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sincronizacion</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncButton />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" onClick={handleLogout} className="w-full">
            Cerrar sesion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
