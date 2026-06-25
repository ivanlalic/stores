import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clearAuthCookies() {
  document.cookie = "insforge_token=; path=/; max-age=0";
  document.cookie = "insforge_uid=; path=/; max-age=0";
}

export function monthLabel(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 15);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}
