import "server-only";
import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import type { MaintenanceMessageTemplate } from "./custom-template";

export async function getActiveCustomMessageTemplatesForMaintenance() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_message_templates")
    .select("id, title, body, context")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("context", ["maintenance", "warranty", "general"])
    .order("title", { ascending: true })
    .returns<MaintenanceMessageTemplate[]>();

  if (error) {
    console.error("Erro ao carregar mensagens personalizadas da OS:", error);
    return [];
  }

  return data ?? [];
}
