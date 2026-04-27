"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncButton } from "@/components/sync-button";
import { createClient } from "@/lib/insforge/client";
import { Plus } from "lucide-react";

function clearAuthCookies() {
  document.cookie = "insforge_token=; path=/; max-age=0";
  document.cookie = "insforge_uid=; path=/; max-age=0";
}

export default function SettingsPage() {
  const router = useRouter();

  // IBericaStore (Dropea)
  const [storeName, setStoreName] = useState("IBericaStore");
  const [newApiKey, setNewApiKey] = useState("");
  const [feeGestion, setFeeGestion] = useState("0");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [costoRechazo, setCostoRechazo] = useState("13.76");
  const [diasRolling, setDiasRolling] = useState("30");
  const [diasExcluir, setDiasExcluir] = useState("4");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // VittaOra (Dropi)
  const [dropiEmail, setDropiEmail] = useState("");
  const [dropiPwd, setDropiPwd] = useState("");
  const [hasDropiCredentials, setHasDropiCredentials] = useState(false);
  const [dropiMessage, setDropiMessage] = useState("");
  const [savingDropi, setSavingDropi] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.config) {
        setFeeGestion(String(data.config.fee_gestion_eur || 0));
        setHasApiKey(data.config.has_api_key);
        setStoreName(data.config.store_name || "IBericaStore");
        setCostoRechazo(String(data.config.costo_rechazo ?? 13.76));
        setDiasRolling(String(data.config.dias_rolling ?? 30));
        setDiasExcluir(String(data.config.dias_excluir ?? 4));
        setHasDropiCredentials(!!data.config.has_dropi_credentials);
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
        store_name: storeName.trim() || "IBericaStore",
        costo_rechazo: parseFloat(costoRechazo) || 13.76,
        dias_rolling: parseInt(diasRolling) || 30,
        dias_excluir: parseInt(diasExcluir) || 4,
      };
      if (newApiKey) body.dropea_api_key = newApiKey;
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error guardando");
      setMessage("Guardado");
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mis tiendas</h2>
        <Button variant="outline" size="sm" disabled title="Próximamente: multi-tienda">
          <Plus className="size-4 mr-1" />
          Agregar tienda
        </Button>
      </div>

      {/* IBericaStore — Dropea */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{storeName}</CardTitle>
            <Badge variant="secondary">Dropea</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre de la tienda</Label>
            <Input
              placeholder="IBericaStore"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Se muestra en el menú lateral.</p>
          </div>

          <div className="space-y-2">
            <Label>API Key Dropea</Label>
            {hasApiKey && (
              <p className="text-xs text-muted-foreground">Configurada. Deja vacío para no cambiar.</p>
            )}
            <Input
              type="password"
              placeholder={hasApiKey ? "******* (sin cambios)" : "AIza..."}
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Fee de gestión (€ / pedido enviado)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={feeGestion}
              onChange={(e) => setFeeGestion(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Cobro fijo de gestor externo por pedido enviado. 0 si no aplica.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Costo por rechazo (€)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={costoRechazo}
              onChange={(e) => setCostoRechazo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Lo que cobra Dropea por cada pedido rechazado/devuelto. Por defecto €13.76.
              Se usa para estimar el peor caso de P&L en el dashboard.
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
              Ventana de días para calcular bruto/enviado y tasa de rechazo promedio (break-even). Por defecto 30.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Días a excluir del rechazo</Label>
            <Input
              type="number"
              step="1"
              min="0"
              max="14"
              value={diasExcluir}
              onChange={(e) => setDiasExcluir(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Los últimos N días se excluyen del cálculo de tasa de rechazo: los pedidos recientes
              aún pueden devolverse, incluirlos haría la tasa parecer artificialmente baja. Por defecto 4.
            </p>
          </div>

          {message && (
            <p className={`text-sm ${message.includes("Error") ? "text-destructive" : "text-green-600"}`}>
              {message}
            </p>
          )}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Guardando..." : "Guardar IBericaStore"}
          </Button>
        </CardContent>
      </Card>

      {/* VittaOra — Dropi */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">VittaOra</CardTitle>
            <Badge variant="secondary">Dropi</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {hasDropiCredentials
              ? "Credenciales configuradas. Ingresa email + contraseña nuevos para actualizarlas."
              : "Ingresa las credenciales de dropipro.com para sincronizar automáticamente."}
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
            {savingDropi ? "Guardando..." : "Guardar credenciales VittaOra"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Webhook:{" "}
            <code className="bg-muted px-1 rounded text-xs">
              https://stores-steel.vercel.app/api/dropi/webhook
            </code>
          </p>
        </CardContent>
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sincronización</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncButton />
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" onClick={handleLogout} className="w-full">
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
