"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncButton } from "@/components/sync-button";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("Mi Tienda");
  const [newApiKey, setNewApiKey] = useState("");
  const [feeGestion, setFeeGestion] = useState("0");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.config) {
        setFeeGestion(String(data.config.fee_gestion_eur || 0));
        setHasApiKey(data.config.has_api_key);
        setStoreName(data.config.store_name || "Mi Tienda");
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        fee_gestion_eur: parseFloat(feeGestion) || 0,
        store_name: storeName.trim() || "Mi Tienda",
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
      setMessage("Configuracion guardada");
      if (newApiKey) {
        setHasApiKey(true);
        setNewApiKey("");
      }
    } catch {
      setMessage("Error al guardar");
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
          {message && (
            <p className={`text-sm ${message.includes("Error") ? "text-destructive" : "text-green-600"}`}>
              {message}
            </p>
          )}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
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
