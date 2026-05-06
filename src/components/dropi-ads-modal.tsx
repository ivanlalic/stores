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

interface DropiAdsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fecha: string;
  initialMetaAds?: number;
  initialTiktokAds?: number;
  initialMetaFeePct?: number;
  initialTiktokFeePct?: number;
  onSave: () => void;
  storeId?: string;
}

export function DropiAdsModal({
  open,
  onOpenChange,
  fecha,
  initialMetaAds = 0,
  initialTiktokAds = 0,
  initialMetaFeePct = 0,
  initialTiktokFeePct = 0,
  onSave,
  storeId,
}: DropiAdsModalProps) {
  const [metaBase, setMetaBase] = useState("0");
  const [tiktokBase, setTiktokBase] = useState("0");
  const [metaFee, setMetaFee] = useState("0");
  const [tiktokFee, setTiktokFee] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const mFee = initialMetaFeePct;
    const tFee = initialTiktokFeePct;
    setMetaFee(String(mFee));
    setTiktokFee(String(tFee));
    setMetaBase(mFee > 0 ? String(Math.round(initialMetaAds / (1 + mFee / 100) * 100) / 100) : String(initialMetaAds));
    setTiktokBase(tFee > 0 ? String(Math.round(initialTiktokAds / (1 + tFee / 100) * 100) / 100) : String(initialTiktokAds));
  }, [initialMetaAds, initialTiktokAds, initialMetaFeePct, initialTiktokFeePct]);

  const metaTotal = (parseFloat(metaBase) || 0) * (1 + (parseFloat(metaFee) || 0) / 100);
  const tiktokTotal = (parseFloat(tiktokBase) || 0) * (1 + (parseFloat(tiktokFee) || 0) / 100);

  function fmtEur(n: number) {
    return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/dropi/ads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          meta_ads: Math.round(metaTotal * 100) / 100,
          tiktok_ads: Math.round(tiktokTotal * 100) / 100,
          meta_agency_fee_pct: parseFloat(metaFee) || 0,
          tiktok_agency_fee_pct: parseFloat(tiktokFee) || 0,
          ...(storeId ? { store_id: storeId } : {}),
        }),
      });
      onSave();
      onOpenChange(false);
    } finally {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ads - {displayDate}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Meta Ads */}
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meta Ads</p>
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

          {/* TikTok Ads */}
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TikTok Ads</p>
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
