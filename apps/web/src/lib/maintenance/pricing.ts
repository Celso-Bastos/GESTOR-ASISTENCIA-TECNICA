import type { MaintenanceStatus } from "./status";

type MaintenancePrice = number | string | null | undefined;

// Preços já validados pela action ou lidos do banco; zero nunca é ausência.
export function resolveMaintenanceFinalPrice(
  status: MaintenanceStatus,
  estimatedPrice: MaintenancePrice,
  finalPrice: MaintenancePrice
) {
  if (finalPrice != null) return finalPrice;
  return status === "entregue" ? estimatedPrice ?? null : null;
}
