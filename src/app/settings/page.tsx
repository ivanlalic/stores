"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncButton } from "@/components/sync-button";
import { createClient } from "@/lib/insforge/client";

function clearAuthCookies() {
  document.cookie = "insforge_token=; path=/; max-age=0";
  document.cookie = "insforge_uid=; path=/; max-age=0";
}

export default function SettingsPage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("Mi Tienda");
  const [newApiKey, setNewApiKey] = useState("");
  const [feeGestion, setFeeGestion] = useState("0");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [costoRechazo, setCostoRechazo] = useState("13");
  const [diasRolling, setDiasRolling] = useState("30");
  const [diasExcluir, setDiasExcluir] = useState("4");
  const [dropiEmail, setDropiEmail] = useState("");
  const [dropiPwd, setDropiPwd] = useState("");
  const [hasDropiCredentials, setHasDropiCredentials] = useState(false);
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
        setCostoRechazo(String(data.config.costo_rechazo ?? 13));
        setDiasRolling(String(data.config.dias_rolling ?? 30));
        setDiasExcluir(String(data.config.dias_excluir ?? 4));
        setHasDropiCredentials(!!data.config.has_dropi_credentials);
      }
    }
    load();
  }, []);

  const [dropiMessage, setDropiMessage] = useState("");
  const [savingDropi, setSavingDropi] = useState(false);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        fee_gestion_eur: parseFloat(feeGestion) || 0,
        store_name: storeName.trim() || "Mi Tienda",
        costo_rechazo: parseFloat(costoRechazo) || 13,
        dias_rolling: parseInt(diasRolling) || 30,
        dias_excluir: parseInt(diasExcluir) || 4,
      };
      if (newApiKey) body.dropea_api_key = newApiKey;
      // Never touch dropi credentials here
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error guardando");
      setMessage("Configuracion guardada");
      if (newApiKey) { setHasApiKey(true); setNewApiKey(""); }
    } catch {
      setMessage("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDropi() {
    if (!dropiEmail.trim() || !dropiPwd.trim()) {
      setDropiMessage("Ingresa email Y contraseña para actualizar");
      return;
    }
    setSavingDropi(true);
    setDropiMessage("");
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropi_email: dropiEmail.trim(), dropi_pwd: dropiPwd.trim() }),
      });
      if (!res.ok) throw new Error("Error guardando");
      setDropiMessage("Credenciales guardadas");
      setHasDropiCredentials(true);
      setDropiEmail("");
      setDropiPwd("");
    } catch {
      setDropiMessage("Error al guardar");
    } finally {
      setSavingDropi(false);
    }
  }

  async function handleLogout() {
    const insforge = createClient();
    await insforge.auth.signOut();
    clearAuthCookies();
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
          <CardTitle className="text-base">Vittaora · Dropi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {hasDropiCredentials
              ? "Credenciales configuradas. Para cambiarlas, ingresa email Y contraseña nuevos."
              : "Ingresa las credenciales de dropipro.com para sincronizar automaticamente."}
          </p>
          <div className="space-y-2">
            <Label>Email Dropi</Label>
            <Input
              type="text"
              autoComplete="off"
              placeholder="vittaora@gmail.com"
              value={dropiEmail}
              onChange={(e) => setDropiEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Contraseña Dropi</Label>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Contraseña de dropipro.com"
              value={dropiPwd}
              onChange={(e) => setDropiPwd(e.target.value)}
            />
          </div>
          {dropiMessage && (
            <p className={`text-sm ${dropiMessage.includes("Error") || dropiMessage.includes("Ingresa") ? "text-destructive" : "text-green-600"}`}>
              {dropiMessage}
            </p>
          )}
          <Button onClick={handleSaveDropi} disabled={savingDropi} className="w-full">
            {savingDropi ? "Guardando..." : "Guardar credenciales Dropi"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Webhook URL: <code className="bg-muted px-1 rounded text-xs">https://stores-steel.vercel.app/api/dropi/webhook</code>
          </p>
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
