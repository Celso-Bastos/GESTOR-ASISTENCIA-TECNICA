import "server-only";
import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import type { MaintenanceOrderDetail, MaintenanceEvent } from "./types";

export const MAINTENANCE_EVENT_PAGE_SIZE = 50;

export function parseMaintenanceEventPage(value?: string | string[]) {
  const page = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(page) && page > 0 &&
    page <= Math.floor(Number.MAX_SAFE_INTEGER / MAINTENANCE_EVENT_PAGE_SIZE)
    ? page : 1;
}

export async function getMaintenanceOrderById(orderId: string, requestedPage = 1) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const eventPage = parseMaintenanceEventPage(String(requestedPage));
  const offset = (eventPage - 1) * MAINTENANCE_EVENT_PAGE_SIZE;

  // Ambas as leituras dependem apenas do ID e da organização já autenticada.
  const [{ data, error }, { data: events }] = await Promise.all([supabase
    .from("maintenance_orders")
    .select(
      "id, organization_id, customer_id, device_id, order_number, reported_issue, diagnosis, status, expected_delivery_date, delivered_at, estimated_price, final_price, internal_notes, warranty_enabled, warranty_signed, warranty_amount, warranty_unit, warranty_started_at, warranty_expires_at, warranty_notes, warranty_message_sent_at, created_at, updated_at, customers(id, name, phone, phone_normalized), devices(id, brand, model, color, storage, imei, notes)"
    )
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle<Omit<MaintenanceOrderDetail, "events">>(),
    supabase
    .from("maintenance_events")
    .select(
      "id, event_type, old_status, new_status, description, created_by, created_at"
    )
    .eq("organization_id", organization.id)
    .eq("maintenance_order_id", orderId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    // Um registro adicional detecta a próxima página sem COUNT de todo o histórico.
    .range(offset, offset + MAINTENANCE_EVENT_PAGE_SIZE)
    .returns<MaintenanceEvent[]>()]);

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    events: (events ?? []).slice(0, MAINTENANCE_EVENT_PAGE_SIZE),
    eventPage,
    hasMoreEvents: (events?.length ?? 0) > MAINTENANCE_EVENT_PAGE_SIZE
  } satisfies MaintenanceOrderDetail & { eventPage: number; hasMoreEvents: boolean };
}
