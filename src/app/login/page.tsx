"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/insforge/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function setAuthCookies(token: string, uid: string) {
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `insforge_token=${token}; path=/; SameSite=Lax; max-age=${maxAge}`;
  document.cookie = `insforge_uid=${uid}; path=/; SameSite=Lax; max-age=${maxAge}`;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otp, setOtp] = useState("");
  const insforge = useMemo(() => createClient(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        const { data, error } = await insforge.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.requireEmailVerification) {
          setVerifying(true);
          setLoading(false);
          return;
        }
        if (data?.accessToken && data.user) {
          setAuthCookies(data.accessToken, data.user.id);
          window.location.href = "/dashboard";
        }
      } else {
        const { data, error } = await insforge.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data?.accessToken && data.user) {
          setAuthCookies(data.accessToken, data.user.id);
          window.location.href = "/dashboard";
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error } = await insforge.auth.verifyEmail({ email, otp });
      if (error) throw error;
      if (data?.accessToken && data.user) {
        setAuthCookies(data.accessToken, data.user.id);
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Codigo invalido");
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Verificar email</CardTitle>
            <p className="text-sm text-muted-foreground text-center">
              Ingresa el codigo de 6 digitos enviado a {email}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Codigo de verificacion</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="553234"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Verificar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Dropea Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            {isRegister ? "Crear cuenta" : "Iniciar sesion"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Cargando..." : isRegister ? "Crear cuenta" : "Entrar"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-sm text-muted-foreground hover:underline"
            >
              {isRegister ? "Ya tengo cuenta" : "No tengo cuenta"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
