"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  Package,
  Settings,
  TrendingUp,
  LogOut,
  ShoppingBag,
  Store,
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

const iberItems = [
  { title: "Dashboard Diario", href: "/dashboard", icon: BarChart3 },
  { title: "Resumen Mensual", href: "/dashboard/mensual", icon: CalendarDays },
  { title: "Productos", href: "/dashboard/productos", icon: Package },
];

const vittaoraItems = [
  { title: "Dashboard Vittaora", href: "/vittaora", icon: ShoppingBag },
];

function clearAuthCookies() {
  document.cookie = "insforge_token=; path=/; max-age=0";
  document.cookie = "insforge_uid=; path=/; max-age=0";
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const activeStore = pathname.startsWith("/vittaora") ? "vittaora" : "ibericastore";
  const activeItems = activeStore === "vittaora" ? vittaoraItems : iberItems;

  async function handleLogout() {
    const insforge = createClient();
    await insforge.auth.signOut();
    clearAuthCookies();
    router.push("/login");
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/dashboard" />}
                  isActive={activeStore === "ibericastore"}
                >
                  <TrendingUp className="size-4" />
                  <span>IBericaStore</span>
                  <span className="text-xs text-muted-foreground ml-auto">Dropea</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/vittaora" />}
                  isActive={activeStore === "vittaora"}
                >
                  <ShoppingBag className="size-4" />
                  <span>VittaOra</span>
                  <span className="text-xs text-muted-foreground ml-auto">Dropi</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            {activeStore === "vittaora" ? "Vittaora · Dropi" : "Análisis"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {activeItems.map((item) => (
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
