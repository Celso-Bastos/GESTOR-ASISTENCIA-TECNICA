"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import { canManageSuppliers } from "./types";
import { supplierSchema, supplierIdSchema, productSupplierSchema } from "./validation";

export type SupplierActionState = { error?: string; success?: string; values?: { name: string; whatsapp_phone: string; notes: string; is_active: boolean } };
function refreshSuppliers() {
  for (const route of ["/estoque/fornecedores", "/estoque/reposicao", "/saidas/modelos"]) revalidatePath(route);
  revalidatePath("/estoque/fornecedores/[id]", "page");
  revalidatePath("/saidas/modelos/[id]/fornecedores", "page");
}
const forbidden = { error: "Somente owner ou admin pode configurar fornecedores e vínculos." };

export async function saveInventorySupplier(id: string | null, _previous: SupplierActionState, form: FormData): Promise<SupplierActionState> {
  const organization = await requireOrganization();
  if (!canManageSuppliers(organization.role)) return forbidden;
  const values = { name: String(form.get("name") ?? ""), whatsapp_phone: String(form.get("whatsapp_phone") ?? ""),
    notes: String(form.get("notes") ?? ""), is_active: form.get("is_active") === "on" };
  if (id !== null && !supplierIdSchema.safeParse(id).success) return { error: "Fornecedor inválido.", values };
  const parsed = supplierSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  const client = await createClient();
  const result = id
    ? await client.from("inventory_suppliers").update(parsed.data).eq("organization_id", organization.id).eq("id", id).select("id").maybeSingle()
    : await client.from("inventory_suppliers").insert({ ...parsed.data, organization_id: organization.id }).select("id").single();
  if (result.error || !result.data) return { error: "Não foi possível salvar o fornecedor. Confira a atualização do banco e tente novamente.", values };
  refreshSuppliers();
  return { success: "Fornecedor salvo.", values: { ...values, whatsapp_phone: parsed.data.whatsapp_phone ?? "" } };
}

export async function setInventorySupplierStatus(id: string, _previous: SupplierActionState, form: FormData): Promise<SupplierActionState> {
  const organization = await requireOrganization();
  if (!canManageSuppliers(organization.role)) return forbidden;
  const active = form.get("is_active");
  if (!supplierIdSchema.safeParse(id).success || (active !== "true" && active !== "false")) return { error: "Fornecedor ou estado inválido." };
  const client = await createClient();
  const { data, error } = await client.from("inventory_suppliers").update({ is_active: active === "true" })
    .eq("organization_id", organization.id).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { error: "Não foi possível alterar o fornecedor." };
  refreshSuppliers();
  return { success: active === "true" ? "Fornecedor ativado." : "Fornecedor desativado. Os vínculos foram preservados." };
}

export async function updateProductSupplier(productId: string, _previous: SupplierActionState, form: FormData): Promise<SupplierActionState> {
  const organization = await requireOrganization();
  if (!canManageSuppliers(organization.role)) return forbidden;
  const parsed = productSupplierSchema.safeParse({ product_model_id: productId,
    supplier_id: form.get("supplier_id"), operation: form.get("operation") });
  if (!parsed.success) return { error: "Selecione um fornecedor e uma operação válidos." };
  const client = await createClient();
  const { error } = await client.rpc("set_inventory_product_supplier", {
    p_organization_id: organization.id, p_product_model_id: parsed.data.product_model_id,
    p_supplier_id: parsed.data.supplier_id, p_operation: parsed.data.operation
  });
  if (error) return { error: "Não foi possível atualizar o vínculo. Confira se produto e fornecedor estão disponíveis nesta organização e tente novamente." };
  refreshSuppliers();
  return { success: "Fornecedores do produto atualizados." };
}
