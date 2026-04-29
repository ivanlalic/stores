"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type InviteState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "valid"; storeName: string; storeId: string }
  | { status: "accepting" }
  | { status: "error"; message: string };

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const [state, setState] = useState<InviteState>({ status: "loading" });

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setState({ status: "valid", storeName: d.storeName, storeId: d.storeId });
        } else {
          setState({ status: "invalid" });
        }
      })
      .catch(() => setState({ status: "invalid" }));
  }, [token]);

  async function handleAccept() {
    setState({ status: "accepting" });
    const res = await fetch(`/api/invites/${token}`, { method: "POST" });
    if (res.status === 401) {
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setState({ status: "error", message: d.error ?? "Error al aceptar invitación" });
      return;
    }
    const d = await res.json();
    router.push(`/dashboard?store=${d.storeId}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-center">Invitación a tienda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state.status === "loading" && (
            <p className="text-sm text-muted-foreground">Verificando invitación...</p>
          )}

          {state.status === "invalid" && (
            <p className="text-sm text-destructive">Invitación no válida o ya usada.</p>
          )}

          {state.status === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                Has sido invitado a la tienda <strong>{state.storeName}</strong>.
              </p>
              <Button className="w-full" onClick={handleAccept}>
                Aceptar invitación
              </Button>
            </>
          )}

          {state.status === "accepting" && (
            <p className="text-sm text-muted-foreground">Aceptando...</p>
          )}

          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
