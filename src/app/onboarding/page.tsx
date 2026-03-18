"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncButton } from "@/components/sync-button";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState("");
  const [feeGestion, setFeeGestion] = useState("0");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleTestKey() {
    setError("");
    setLoading(true);
    setTestResult(null);

    try {
      // Save key first
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropea_api_key: apiKey }),
      });
      if (!res.ok) throw new Error("Error guardando la API key");

      // Test connection via sync test
      const syncRes = await fetch("/api/sync", { method: "POST" });
      if (!syncRes.body) throw new Error("No se pudo conectar");

      const reader = syncRes.body.getReader();
      const decoder = new TextDecoder();
      let lastMsg = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) lastMsg = data.message;
            } catch { /* skip */ }
          }
        }
      }

      if (lastMsg.includes("Error")) {
        throw new Error(lastMsg);
      }

      setTestResult("Conexion exitosa! " + lastMsg);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveFee() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fee_gestion_pct: parseFloat(feeGestion) || 0 }),
      });
      if (!res.ok) throw new Error("Error guardando configuracion");

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Configuracion inicial</CardTitle>
          <p className="text-sm text-muted-foreground">Paso {step} de 3</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key de Dropea</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="AIza..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Encontrala en tu panel de Dropea &gt; Integraciones
                </p>
              </div>
              {testResult && (
                <p className="text-sm text-green-600">{testResult}</p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleTestKey} disabled={!apiKey || loading} className="w-full">
                {loading ? "Verificando..." : "Verificar y conectar"}
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fee">Fee de gestion (%)</Label>
                <Input
                  id="fee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={feeGestion}
                  onChange={(e) => setFeeGestion(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si trabajas con un gestor externo, ingresa el % que cobra sobre ventas. Si no, deja en 0.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleSaveFee} disabled={loading} className="w-full">
                {loading ? "Guardando..." : "Continuar"}
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm">
                Tu primera sincronizacion ya se realizo. Podes ir al dashboard.
              </p>
              <Button onClick={() => router.push("/dashboard")} className="w-full">
                Ir al Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
