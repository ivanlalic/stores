"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  Package,
  Settings,
  TrendingUp,
  LogOut,
  ShoppingBag,
  Store,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/insforge/client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface StoreItem {
  id: string;
  name: string;
  type: "dropea" | "dropi";
}

function clearAuthCookies() {
  document.cookie = "insforge_token=; path=/; max-age=0";
  document.cookie = "insforge_uid=; path=/; max-age=0";
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stores, setStores] = useState<StoreItem[]>([]);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => setStores(d.stores || []))
      .catch(() => {});
  }, []);

  const currentStoreId = searchParams.get("store");

  // Find the active store to determine nav items
  const activeStore = stores.find((s) => s.id === currentStoreId) ||
    (pathname.startsWith("/vittaora")
      ? stores.find((s) => s.type === "dropi")
      : stores.find((s) => s.type === "dropea"));

  const activeType = activeStore?.type || (pathname.startsWith("/vittaora") ? "dropi" : "dropea");

  const navItems = activeType === "dropi"
    ? [
        { title: "Dashboard Diario", href: `/vittaora${currentStoreId ? `?store=${currentStoreId}` : ""}`, icon: ShoppingBag },
        { title: "Stock · Catálogo", href: `/vittaora/stock${currentStoreId ? `?store=${currentStoreId}` : ""}`, icon: Boxes },
      ]
    : [
        { title: "Dashboard Diario", href: `/dashboard${currentStoreId ? `?store=${currentStoreId}` : ""}`, icon: BarChart3 },
        { title: "Resumen Mensual", href: `/dashboard/mensual${currentStoreId ? `?store=${currentStoreId}` : ""}`, icon: CalendarDays },
        { title: "Productos", href: `/dashboard/productos${currentStoreId ? `?store=${currentStoreId}` : ""}`, icon: Package },
        { title: "Stock · Catálogo", href: `/dashboard/stock${currentStoreId ? `?store=${currentStoreId}` : ""}`, icon: Boxes },
      ];

  async function handleLogout() {
    const insforge = createClient();
    await insforge.auth.signOut();
    clearAuthCookies();
    router.push("/login");
  }

  function isActive(href: string) {
    const hrefPath = href.split("?")[0];
    if (hrefPath === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(hrefPath);
  }

  function storeHref(s: StoreItem) {
    const base = s.type === "dropi" ? "/vittaora" : "/dashboard";
    return `${base}?store=${s.id}`;
  }

  function isStoreActive(s: StoreItem) {
    if (currentStoreId) return currentStoreId === s.id;
    // fallback: match by page type
    if (s.type === "dropi") return pathname.startsWith("/vittaora");
    return pathname.startsWith("/dashboard");
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex items-center justify-center size-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
            <Store className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold text-sm">Mis Tiendas</span>
            <span className="text-xs text-muted-foreground">Panel de control</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {stores.map((s) => (
                <SidebarMenuItem key={s.id}>
                  <SidebarMenuButton
                    render={<Link href={storeHref(s)} />}
                    isActive={isStoreActive(s)}
                  >
                    {s.type === "dropi"
                      ? <ShoppingBag className="size-4" />
                      : <TrendingUp className="size-4" />
                    }
                    <span>{s.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto capitalize">{s.type}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {stores.length === 0 && (
                <SidebarMenuItem>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Cargando...</div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            {activeStore ? activeStore.name : "Análisis"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item.href)}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings" />}
                  isActive={pathname.startsWith("/settings")}
                >
                  <Settings className="size-4" />
                  <span>Configuración</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings#add-store" />}
              className="text-muted-foreground"
            >
              <Plus className="size-4" />
              <span>Agregar tienda</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="size-4" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
