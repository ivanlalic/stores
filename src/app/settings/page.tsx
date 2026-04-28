"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SyncButton } from "@/components/sync-button";
import { createClient } from "@/lib/insforge/client";
import { Plus, Trash2 } from "lucide-react";

function clearAuthCookies() {
  document.cookie = "insforge_token=; path=/; max-age=0";
  document.cookie = "insforge_uid=; path=/; max-age=0";
}

interface StoreData {
  id: string;
  name: string;
  type: "dropea" | "dropi";
  fee_gestion_eur: number;
  costo_rechazo: number;
  dias_rolling: number;
  dias_excluir: number;
  has_api_key: boolean;
  has_dropea_credentials: boolean;
  has_dropi_credentials: boolean;
}

interface StoreFormState {
  name: string;
  newApiKey: string;
  dropeaEmail: string;
  dropeaPassword: string;
  feeGestion: string;
  costoRechazo: string;
  diasRolling: string;
  diasExcluir: string;
  dropiEmail: string;
  dropiPwd: string;
  saving: boolean;
  message: string;
}

function useStoreForm(store: StoreData): [StoreFormState, (patch: Partial<StoreFormState>) => void] {
  const [state, setState] = useState<StoreFormState>({
    name: store.name,
    newApiKey: "",
    dropeaEmail: "",
    dropeaPassword: "",
    feeGestion: String(store.fee_gestion_eur ?? 0),
    costoRechazo: String(store.costo_rechazo ?? 13.76),
    diasRolling: String(store.dias_rolling ?? 30),
    diasExcluir: String(store.dias_excluir ?? 4),
    dropiEmail: "",
    dropiPwd: "",
    saving: false,
    message: "",
  });
  return [state, (patch) => setState((s) => ({ ...s, ...patch }))];
}

function DropeaStoreCard({
  store,
  onSaved,
  onDeleted,
}: {
  store: StoreData;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [f, setF] = useStoreForm(store);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    setF({ saving: true, message: "" });
    try {
      const body: Record<string, unknown> = {
        name: f.name.trim() || store.name,
        fee_gestion_eur: parseFloat(f.feeGestion) || 0,
        costo_rechazo: parseFloat(f.costoRechazo) || 13.76,
        dias_rolling: parseInt(f.diasRolling) || 30,
        dias_excluir: parseInt(f.diasExcluir) || 4,
      };
      if (f.newApiKey) body.dropea_api_key = f.newApiKey;
      if (f.dropeaEmail) body.dropea_email = f.dropeaEmail;
      if (f.dropeaPassword) body.dropea_pwd = f.dropeaPassword;
      const res = await fetch(`/api/stores/${store.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error guardando");
      setF({ message: "Guardado", newApiKey: "", dropeaEmail: "", dropeaPassword: "" });
      onSaved();
    } catch {
      setF({ message: "Error al guardar" });
    } finally {
      setF({ saving: false });
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/stores/${store.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{store.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Dropea</Badge>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nombre de la tienda</Label>
          <Input value={f.name} onChange={(e) => setF({ name: e.target.value })} />
          <p className="text-xs text-muted-foreground">Se muestra en el menú lateral.</p>
        </div>

        <div className="space-y-2">
          <Label>API Key Dropea</Label>
          {store.has_api_key && (
            <p className="text-xs text-muted-foreground">Configurada. Deja vacío para no cambiar.</p>
          )}
          <Input
            type="password"
            placeholder={store.has_api_key ? "******* (sin cambios)" : "AIza..."}
            value={f.newApiKey}
            onChange={(e) => setF({ newApiKey: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Email Dropea (wallet)</Label>
          {store.has_dropea_credentials && (
            <p className="text-xs text-muted-foreground">Configurado. Deja vacío para no cambiar.</p>
          )}
          <Input
            type="email"
            autoComplete="off"
            placeholder="correo@dropea.com"
            value={f.dropeaEmail}
            onChange={(e) => setF({ dropeaEmail: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Contraseña Dropea (wallet)</Label>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={store.has_dropea_credentials ? "******* (sin cambios)" : "Contraseña de app.dropea.com"}
            value={f.dropeaPassword}
            onChange={(e) => setF({ dropeaPassword: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Fee de gestión (€ / pedido enviado)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={f.feeGestion}
            onChange={(e) => setF({ feeGestion: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Cobro fijo de gestor externo por pedido enviado. 0 si no aplica.</p>
        </div>

        <div className="space-y-2">
          <Label>Costo por rechazo (€)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={f.costoRechazo}
            onChange={(e) => setF({ costoRechazo: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Lo que cobra Dropea por cada pedido rechazado/devuelto. Por defecto €13.76.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Días rolling para promedios</Label>
          <Input
            type="number" step="1" min="7" max="90"
            value={f.diasRolling}
            onChange={(e) => setF({ diasRolling: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Ventana de días para calcular bruto/enviado y tasa de rechazo promedio (break-even). Por defecto 30.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Días a excluir del rechazo</Label>
          <Input
            type="number" step="1" min="0" max="14"
            value={f.diasExcluir}
            onChange={(e) => setF({ diasExcluir: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Los últimos N días se excluyen del cálculo de tasa de rechazo. Por defecto 4.
          </p>
        </div>

        {f.message && (
          <p className={`text-sm ${f.message.includes("Error") ? "text-destructive" : "text-green-600"}`}>
            {f.message}
          </p>
        )}
        <Button onClick={handleSave} disabled={f.saving} className="w-full">
          {f.saving ? "Guardando..." : `Guardar ${store.name}`}
        </Button>
      </CardContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar tienda</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <strong>{store.name}</strong>? Esta acción no se puede deshacer. Los pedidos sincronizados se perderán.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DropiStoreCard({
  store,
  onSaved,
  onDeleted,
}: {
  store: StoreData;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [f, setF] = useStoreForm(store);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    if (!f.dropiEmail.trim() || !f.dropiPwd.trim()) {
      setF({ message: "Ingresa email Y contraseña para actualizar credenciales" });
      return;
    }
    setF({ saving: true, message: "" });
    try {
      const body: Record<string, unknown> = { name: f.name.trim() || store.name };
      if (f.dropiEmail) body.dropi_email = f.dropiEmail.trim();
      if (f.dropiPwd) body.dropi_pwd = f.dropiPwd.trim();
      const res = await fetch(`/api/stores/${store.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error guardando");
      setF({ message: "Credenciales guardadas", dropiEmail: "", dropiPwd: "" });
      onSaved();
    } catch {
      setF({ message: "Error al guardar" });
    } finally {
      setF({ saving: false });
    }
  }

  async function handleSaveName() {
    if (!f.name.trim()) return;
    setF({ saving: true, message: "" });
    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.name.trim() }),
      });
      if (!res.ok) throw new Error();
      setF({ message: "Nombre guardado" });
      onSaved();
    } catch {
      setF({ message: "Error al guardar" });
    } finally {
      setF({ saving: false });
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/stores/${store.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  }

  const webhookUrl = `https://stores-steel.vercel.app/api/dropi/webhook`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{store.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Dropi</Badge>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nombre de la tienda</Label>
          <div className="flex gap-2">
            <Input value={f.name} onChange={(e) => setF({ name: e.target.value })} />
            <Button variant="outline" onClick={handleSaveName} disabled={f.saving}>Guardar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Se muestra en el menú lateral.</p>
        </div>

        <p className="text-xs text-muted-foreground">
          {store.has_dropi_credentials
            ? "Credenciales configuradas. Ingresa email + contraseña nuevos para actualizarlas."
            : "Ingresa las credenciales de dropipro.com para sincronizar automáticamente."}
        </p>

        <div className="space-y-2">
          <Label>Email Dropi</Label>
          <Input
            type="text"
            autoComplete="off"
            placeholder="email@ejemplo.com"
            value={f.dropiEmail}
            onChange={(e) => setF({ dropiEmail: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Contraseña Dropi</Label>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Contraseña de dropipro.com"
            value={f.dropiPwd}
            onChange={(e) => setF({ dropiPwd: e.target.value })}
          />
        </div>

        {f.message && (
          <p className={`text-sm ${f.message.includes("Error") || f.message.includes("Ingresa") ? "text-destructive" : "text-green-600"}`}>
            {f.message}
          </p>
        )}
        <Button onClick={handleSave} disabled={f.saving} className="w-full">
          {f.saving ? "Guardando..." : `Guardar credenciales ${store.name}`}
        </Button>

        <p className="text-xs text-muted-foreground">
          Webhook:{" "}
          <code className="bg-muted px-1 rounded text-xs">{webhookUrl}</code>
        </p>
      </CardContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar tienda</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <strong>{store.name}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AddStoreModal({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"dropea" | "dropi">("dropea");
  const [apiKey, setApiKey] = useState("");
  const [dropiEmail, setDropiEmail] = useState("");
  const [dropiPwd, setDropiPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { name: name.trim(), type };
      if (type === "dropea" && apiKey) body.dropea_api_key = apiKey;
      if (type === "dropi" && dropiEmail) body.dropi_email = dropiEmail;
      if (type === "dropi" && dropiPwd) body.dropi_pwd = dropiPwd;

      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error");
      }
      setName(""); setApiKey(""); setDropiEmail(""); setDropiPwd("");
      onCreated();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar tienda</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input placeholder="Mi Nueva Tienda" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <div className="flex gap-2">
              <Button
                variant={type === "dropea" ? "default" : "outline"}
                size="sm"
                onClick={() => setType("dropea")}
              >Dropea</Button>
              <Button
                variant={type === "dropi" ? "default" : "outline"}
                size="sm"
                onClick={() => setType("dropi")}
              >Dropi</Button>
            </div>
          </div>
          {type === "dropea" && (
            <div className="space-y-2">
              <Label>API Key (opcional)</Label>
              <Input type="password" placeholder="AIza..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
          )}
          {type === "dropi" && (
            <>
              <div className="space-y-2">
                <Label>Email Dropi</Label>
                <Input type="text" autoComplete="off" value={dropiEmail} onChange={(e) => setDropiEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contraseña Dropi</Label>
                <Input type="password" autoComplete="new-password" value={dropiPwd} onChange={(e) => setDropiPwd(e.target.value)} />
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creando..." : "Crear tienda"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreData[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  async function loadStores() {
    const res = await fetch("/api/stores");
    const data = await res.json();
    setStores(data.stores || []);
  }

  useEffect(() => {
    loadStores();
  }, []);

  async function handleLogout() {
    const insforge = createClient();
    await insforge.auth.signOut();
    clearAuthCookies();
    router.push("/login");
  }

  return (
    <div className="max-w-lg mx-auto space-y-6" id="settings">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mis tiendas</h2>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4 mr-1" />
          Agregar tienda
        </Button>
      </div>

      {stores.map((store) =>
        store.type === "dropea" ? (
          <DropeaStoreCard
            key={store.id}
            store={store}
            onSaved={loadStores}
            onDeleted={loadStores}
          />
        ) : (
          <DropiStoreCard
            key={store.id}
            store={store}
            onSaved={loadStores}
            onDeleted={loadStores}
          />
        )
      )}

      {stores.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay tiendas configuradas.
        </p>
      )}

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

      <AddStoreModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={loadStores}
      />
    </div>
  );
}
