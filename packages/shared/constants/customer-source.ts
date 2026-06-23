export const CUSTOMER_SOURCE = {
  COUNTER: "counter",
  TABLET_KIOSK: "tablet_kiosk",
  WHATSAPP: "whatsapp",
  REFERRAL: "referral",
  INSTAGRAM: "instagram",
  OTHER: "other"
} as const;

export type CustomerSource =
  (typeof CUSTOMER_SOURCE)[keyof typeof CUSTOMER_SOURCE];
