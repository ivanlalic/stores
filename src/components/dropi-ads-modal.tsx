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
  onSave: () => void;
}

export function DropiAdsModal({
  open,
  onOpenChange,
  fecha,
  initialMetaAds = 0,
  initialTiktokAds = 0,
  onSave,
}: DropiAdsModalProps) {
  const [metaAds, setMetaAds] = useState(String(initialMetaAds));
  const [tiktokAds, setTiktokAds] = useState(String(initialTiktokAds));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMetaAds(String(initialMetaAds));
    setTiktokAds(String(initialTiktokAds));
  }, [initialMetaAds, initialTiktokAds]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/dropi/ads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          meta_ads: parseFloat(metaAds) || 0,
          tiktok_ads: parseFloat(tiktokAds) || 0,
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
          <div className="space-y-2">
            <Label>Meta Ads (EUR)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={metaAds}
              onChange={(e) => setMetaAds(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>TikTok Ads (EUR)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={tiktokAds}
              onChange={(e) => setTiktokAds(e.target.value)}
            />
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
