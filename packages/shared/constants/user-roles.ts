export const USER_ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  TECHNICIAN: "technician",
  ATTENDANT: "attendant"
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
