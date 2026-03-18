// Dropea API returns statuses in UPPERCASE
export const ENVIADO_STATUSES = [
  "PREPARING",
  "PREPARED",
  "CONFIRMED",
  "INCIDENCE",
  "DELIVERED",
  "TRANSIT",
  "CHARGED",
  "REJECTED",
];

export const ENTREGADO_STATUSES = ["DELIVERED", "CHARGED"];
export const RECHAZADO_STATUSES = ["REJECTED"];
export const CANCELADO_STATUSES = ["CANCELLED"];
export const ZERO_REVENUE_STATUSES = ["PENDING", "CANCELLED"];

export function isEnviado(status: string): boolean {
  return ENVIADO_STATUSES.includes(status);
}

export function isEntregado(status: string): boolean {
  return ENTREGADO_STATUSES.includes(status);
}

export function isRechazado(status: string): boolean {
  return RECHAZADO_STATUSES.includes(status);
}

export function isCancelado(status: string): boolean {
  return CANCELADO_STATUSES.includes(status);
}

export function shouldZeroRevenue(status: string): boolean {
  return ZERO_REVENUE_STATUSES.includes(status);
}
