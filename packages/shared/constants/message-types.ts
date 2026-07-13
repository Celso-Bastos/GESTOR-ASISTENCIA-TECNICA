export const MESSAGE_TYPES = {
  MAINTENANCE_RECEIVED: "maintenance_received",
  MAINTENANCE_READY: "maintenance_ready",
  MAINTENANCE_REMINDER: "maintenance_reminder",
  DELIVERY_TODAY: "delivery_today",
  PROMOTION_FUTURE: "promotion_future",
  SALES_FUTURE: "sales_future"
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export const OPERATIONAL_MESSAGE_TYPES = [
  MESSAGE_TYPES.MAINTENANCE_RECEIVED,
  MESSAGE_TYPES.MAINTENANCE_READY,
  MESSAGE_TYPES.MAINTENANCE_REMINDER,
  MESSAGE_TYPES.DELIVERY_TODAY
] as const;

export type OperationalMessageType =
  (typeof OPERATIONAL_MESSAGE_TYPES)[number];
