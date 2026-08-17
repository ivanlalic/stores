"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdChannel, AdChannelConfig } from "@/lib/ads";
import { channelTotal } from "@/lib/ads";

export interface AdsInputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fecha: string;
  // Config de canales (nuevo modelo). Si se pasa, se renderiza un bloque por canal.
  channels?: AdChannelConfig[];
  // Valores existentes del día (para prellenar). Debe alinear nombre exacto con channels.
  initialChannels?: AdChannel[];
  // Modo legacy (2 canales fijos: label1/label2)
  initialMetaAds?: number;
  initialTiktokAds?: number;
  initialMetaFeePct?: number;
  initialTiktokFeePct?: number;
  onSave: () => void;
  storeId?: string;
  label1?: string;
  label2?: string;
  apiEndpoint?: string;
}

interface ChannelInput {
  name: string;
  base: string;
  fee: string;
}

export function AdsInputModal({
  open,
  onOpenChange,
  fecha,
  channels,
  initialChannels,
  initialMetaAds = 0,
  initialTiktokAds = 0,
  initialMetaFeePct = 0,
  initialTiktokFeePct = 0,
  onSave,
  storeId,
  label1 = "Meta Ads",
  label2 = "TikTok Ads",
  apiEndpoint = "/api/ads",
}: AdsInputModalProps) {
  const isChannelsMode = !!channels && channels.length > 0;

  const [channelInputs, setChannelInputs] = useState<ChannelInput[]>([]);
  // Legacy mode fields
  const [metaBase, setMetaBase] = useState("0");
  const [tiktokBase, setTiktokBase] = useState("0");
  const [metaFee, setMetaFee] = useState("0");
  const [tiktokFee, setTiktokFee] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isChannelsMode) {
      const mFee = initialMetaFeePct;
      const tFee = initialTiktokFeePct;
      setMetaFee(String(mFee));
      setTiktokFee(String(tFee));
      setMetaBase(mFee > 0 ? String(Math.round(initialMetaAds / (1 + mFee / 100) * 100) / 100) : String(initialMetaAds));
      setTiktokBase(tFee > 0 ? String(Math.round(initialTiktokAds / (1 + tFee / 100) * 100) / 100) : String(initialTiktokAds));
      return;
    }

    const byName = new Map<string, AdChannel>((initialChannels || []).map((c) => [c.name, c]));
    const next: ChannelInput[] = channels!.map((cfg) => {
      const existing = byName.get(cfg.name);
      const fee = existing != null ? existing.fee_pct : cfg.fee_pct || 0;
      const base = existing != null ? existing.base : 0;
      return {
        name: cfg.name,
        base: String(base),
        fee: String(fee),
      };
    });
    setChannelInputs(next);
  }, [isChannelsMode, channels, initialChannels, initialMetaAds, initialTiktokAds, initialMetaFeePct, initialTiktokFeePct]);

  function updateChannel(idx: number, patch: Partial<ChannelInput>) {
    setChannelInputs((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function handleSave() {
    setSaving(true);
    try {
      let body: Record<string, unknown> = {
        fecha,
        ...(storeId ? { store_id: storeId } : {}),
      };

      if (isChannelsMode) {
        body.channels = channelInputs.map((c) => {
          const base = parseFloat(c.base) || 0;
          const fee = parseFloat(c.fee) || 0;
          const total = channelTotal(base, fee);
          return { name: c.name, base, fee_pct: fee, total };
        });
      } else {
        const metaTotal = (parseFloat(metaBase) || 0) * (1 + (parseFloat(metaFee) || 0) / 100);
        const tiktokTotal = (parseFloat(tiktokBase) || 0) * (1 + (parseFloat(tiktokFee) || 0) / 100);
        body.meta_ads = Math.round(metaTotal * 100) / 100;
        body.tiktok_ads = Math.round(tiktokTotal * 100) / 100;
        body.meta_agency_fee_pct = parseFloat(metaFee) || 0;
        body.tiktok_agency_fee_pct = parseFloat(tiktokFee) || 0;
      }

      fetch(apiEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Error guardando");
          onSave();
          onOpenChange(false);
        })
        .catch(() => {
          // Error handled silently
        })
        .finally(() => setSaving(false));
    } catch {
      setSaving(false);
    }
  }

  const displayDate = fecha
    ? new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : fecha;

  function fmtEur(n: number) {
    return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  let metaTotal = (parseFloat(metaBase) || 0) * (1 + (parseFloat(metaFee) || 0) / 100);
  let tiktokTotal = (parseFloat(tiktokBase) || 0) * (1 + (parseFloat(tiktokFee) || 0) / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ads - {displayDate}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isChannelsMode ? (
            channelInputs.map((c, i) => {
              const total = (parseFloat(c.base) || 0) * (1 + (parseFloat(c.fee) || 0) / 100);
              return (
                <div key={c.name} className="space-y-2 rounded-md border p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c.name}</p>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Base (EUR)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={c.base}
                        onChange={(e) => updateChannel(i, { base: e.target.value })}
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs">Comisión (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={c.fee}
                        onChange={(e) => updateChannel(i, { fee: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total: <span className="font-semibold text-foreground">{fmtEur(total)} €</span>
                  </p>
                </div>
              );
            })
          ) : (
            <>
              {/* label1 platform */}
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label1}</p>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="meta-base" className="text-xs">Base (EUR)</Label>
                    <Input
                      id="meta-base"
                      type="number"
                      step="0.01"
                      min="0"
                      value={metaBase}
                      onChange={(e) => setMetaBase(e.target.value)}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label htmlFor="meta-fee" className="text-xs">Comisión (%)</Label>
                    <Input
                      id="meta-fee"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={metaFee}
                      onChange={(e) => setMetaFee(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{fmtEur(metaTotal)} €</span>
                </p>
              </div>

              {/* label2 platform */}
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label2}</p>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="tiktok-base" className="text-xs">Base (EUR)</Label>
                    <Input
                      id="tiktok-base"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tiktokBase}
                      onChange={(e) => setTiktokBase(e.target.value)}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label htmlFor="tiktok-fee" className="text-xs">Comisión (%)</Label>
                    <Input
                      id="tiktok-fee"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={tiktokFee}
                      onChange={(e) => setTiktokFee(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{fmtEur(tiktokTotal)} €</span>
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}