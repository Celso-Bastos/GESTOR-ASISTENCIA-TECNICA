export const MAINTENANCE_STATUS = {
  RECEIVED: "received",
  DIAGNOSING: "diagnosing",
  WAITING_APPROVAL: "waiting_approval",
  IN_PROGRESS: "in_progress",
  WAITING_PARTS: "waiting_parts",
  READY_FOR_PICKUP: "ready_for_pickup",
  DELIVERED: "delivered",
  CANCELED: "canceled"
} as const;

export type MaintenanceStatus =
  (typeof MAINTENANCE_STATUS)[keyof typeof MAINTENANCE_STATUS];
