import type { MaintenanceStatus } from "./status";

export type MaintenanceCustomer = {
  id: string;
  name: string;
  phone: string | null;
  phone_normalized: string | null;
};

export type MaintenanceDevice = {
  id: string;
  brand: string | null;
  model: string;
  color: string | null;
  storage: string | null;
  imei: string | null;
  notes: string | null;
};

export type MaintenanceEvent = {
  id: string;
  event_type: string;
  old_status: MaintenanceStatus | null;
  new_status: MaintenanceStatus | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

export type MaintenanceOrderListItem = {
  id: string;
  order_number: string;
  status: MaintenanceStatus;
  expected_delivery_date: string | null;
  estimated_price: number | string | null;
  created_at: string;
  customers: MaintenanceCustomer | MaintenanceCustomer[] | null;
  devices: MaintenanceDevice | MaintenanceDevice[] | null;
};

export type MaintenanceOrderDetail = {
  id: string;
  organization_id: string;
  customer_id: string;
  device_id: string;
  order_number: string;
  reported_issue: string;
  diagnosis: string | null;
  status: MaintenanceStatus;
  expected_delivery_date: string | null;
  delivered_at: string | null;
  estimated_price: number | string | null;
  final_price: number | string | null;
  internal_notes: string | null;
  warranty_enabled: boolean;
  warranty_signed: boolean;
  warranty_amount: number | null;
  warranty_unit: "days" | "months" | null;
  warranty_started_at: string | null;
  warranty_expires_at: string | null;
  warranty_notes: string | null;
  warranty_message_sent_at: string | null;
  created_at: string;
  updated_at: string | null;
  customers: MaintenanceCustomer | MaintenanceCustomer[] | null;
  devices: MaintenanceDevice | MaintenanceDevice[] | null;
  events: MaintenanceEvent[];
};

export type CustomerOption = MaintenanceCustomer;

export type MaintenanceActionState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
};
