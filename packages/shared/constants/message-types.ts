export const MESSAGE_TYPES = {
  WELCOME: "welcome",
  MAINTENANCE_RECEIVED: "maintenance_received",
  QUOTE_APPROVAL: "quote_approval",
  STATUS_UPDATE: "status_update",
  READY_FOR_PICKUP: "ready_for_pickup",
  PICKUP_REMINDER: "pickup_reminder",
  THANK_YOU: "thank_you"
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];
