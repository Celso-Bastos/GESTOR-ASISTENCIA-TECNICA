export const CUSTOMER_SOURCE = {
  MANUAL: "manual",
  TABLET: "tablet",
  FUTURE_IMPORT: "future_import"
} as const;

export type CustomerSource =
  (typeof CUSTOMER_SOURCE)[keyof typeof CUSTOMER_SOURCE];
