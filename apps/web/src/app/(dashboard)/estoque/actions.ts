"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/queries";
import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import { inventoryMovementSchema } from "@/lib/validations/inventory.schema";
import type { InventoryItem, InventoryMovementType } from "@/lib/products/inventory";
import { getInventoryErrorMessage } from "@/lib/products/inventory-errors";

export type InventoryActionState = { error?: string; success?: string };
export type InventoryMovement = {
  id: string;
  product_model_template_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: number | string | null;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  product_outflow_id: string | null;
  product_model_templates: { model_name: string } | { model_name: string }[] | null;
};

export async function getInventoryItems() {
  // requireOrganization already validates the session and account approval.
  const organization = await requireOrganization();
  const supabase = await createClient();
  const items: InventoryItem[] = [];
  // Paginação explícita evita indicadores parciais pelo limite padrão do Supabase.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("product_model_templates")
      .select("id, category, model_name, stock_quantity, minimum_stock, unit_cost, default_price, is_active")
      .eq("organization_id", organization.id).is("deleted_at", null)
      .order("id").range(offset, offset + 499).returns<InventoryItem[]>();
    if (error) {
      console.error("Erro ao carregar estoque:", error);
      return { items: [] as InventoryItem[], error: getInventoryErrorMessage(error, "Não foi possível carregar o estoque. Tente novamente.") };
    }
    items.push(...data ?? []);
    if (!data || data.length < 500) break;
  }
  items.sort((a, b) => a.category.localeCompare(b.category) || a.model_name.localeCompare(b.model_name, "pt-BR"));
  return { items, error: undefined };
}

export async function getInventoryMovements(modelId?: string, page = 1) {
  // Keep the same organization/auth guard without a duplicate Auth round trip.
  const organization = await requireOrganization();
  const supabase = await createClient();
  const offset = (Math.max(1, Math.trunc(page)) - 1) * 50;
  let query = supabase.from("inventory_movements")
    .select("id, product_model_template_id, movement_type, quantity, quantity_before, quantity_after, unit_cost, reason, notes, created_by, created_by_name, created_at, product_outflow_id, product_model_templates(model_name)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + 50);
  if (modelId) query = query.eq("product_model_template_id", modelId);
  const { data, error } = await query.returns<InventoryMovement[]>();
  if (error) return { movements: [] as InventoryMovement[], hasMore: false, error: getInventoryErrorMessage(error, "Não foi possível carregar o histórico de estoque.") };
  return { movements: (data ?? []).slice(0, 50), hasMore: (data?.length ?? 0) > 50, error: undefined };
}

export async function registerInventoryMovementAction(
  _previous: InventoryActionState, formData: FormData
): Promise<InventoryActionState> {
  await requireAuth();
  const organization = await requireOrganization();
  const parsed = inventoryMovementSchema.safeParse(Object.fromEntries(
    ["model_id", "movement_type", "quantity", "unit_cost", "reason", "notes"].map(key => [key, String(formData.get(key) ?? "")])
  ));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados." };
  const input = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_inventory_movement", {
    p_organization_id: organization.id, p_model_id: input.model_id,
    p_movement_type: input.movement_type, p_quantity: input.quantity,
    p_unit_cost: input.unit_cost ?? null, p_reason: input.reason || null, p_notes: input.notes || null
  });
  if (error) {
    console.error("Erro ao movimentar estoque:", error);
    return { error: error.message?.includes("Estoque inicial já definido")
      ? "Estoque inicial já definido. Utilize Ajustar estoque."
      : getInventoryErrorMessage(error, "Não foi possível registrar a movimentação. Atualize o estoque e tente novamente.") };
  }
  for (const path of ["/estoque", "/estoque/movimentacoes", "/estoque/reposicao", "/saidas", "/saidas/nova", "/saidas/modelos", "/relatorios/reposicao", "/dashboard"]) revalidatePath(path);
  revalidatePath(`/estoque/${input.model_id}`);
  return { success: `Movimentação registrada. Saldo atual: ${data} un.` };
}
