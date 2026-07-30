export const MESSAGE_TYPES = {
  MAINTENANCE_RECEIVED: "maintenance_received",
  MAINTENANCE_READY: "maintenance_ready",
  MAINTENANCE_REMINDER: "maintenance_reminder",
  DELIVERY_TODAY: "delivery_today",
  WARRANTY_NOTICE: "warranty_notice",
  PROMOTION_FUTURE: "promotion_future",
  SALES_FUTURE: "sales_future"
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export const OPERATIONAL_MESSAGE_TYPES = [
  MESSAGE_TYPES.MAINTENANCE_RECEIVED,
  MESSAGE_TYPES.MAINTENANCE_READY,
  MESSAGE_TYPES.MAINTENANCE_REMINDER,
  MESSAGE_TYPES.DELIVERY_TODAY,
  MESSAGE_TYPES.WARRANTY_NOTICE
] as const;

export type OperationalMessageType =
  (typeof OPERATIONAL_MESSAGE_TYPES)[number];
