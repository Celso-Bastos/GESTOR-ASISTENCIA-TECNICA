import "server-only";
import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import type { InventorySupplier, ProductSupplier } from "./types";
import type { InventoryItem } from "@/lib/products/inventory";
import { supplierIdSchema } from "./validation";

// Sem N+1. Paginação explícita e lotes de IDs evitam limite de 1000 linhas/URLs grandes.
export async function getInventorySupplierData(filters: { productIds?: string[]; supplierId?: string } = {}) {
  const organization = await requireOrganization();
  const client = await createClient();
  const suppliers: InventorySupplier[] = [];
  const links: ProductSupplier[] = [];
  const failure = { suppliers: [] as InventorySupplier[], links: [] as ProductSupplier[],
    error: "Não foi possível carregar os fornecedores. Solicite ao administrador que confira a atualização do banco e tente novamente." };
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("inventory_suppliers")
      .select("id,name,whatsapp_phone,notes,is_active").eq("organization_id", organization.id)
      .order("id").range(offset, offset + 499).returns<InventorySupplier[]>();
    if (error) return failure;
    suppliers.push(...data ?? []);
    if (!data || data.length < 500) break;
  }
  const batches: (string[] | undefined)[] = [];
  if (filters.productIds) {
    const ids = [...new Set(filters.productIds)];
    for (let index = 0; index < ids.length; index += 200) batches.push(ids.slice(index, index + 200));
  } else batches.push(undefined);
  for (const batch of batches) for (let offset = 0; ; offset += 500) {
    let query = client.from("inventory_product_suppliers")
      .select("id,product_model_id,supplier_id,is_preferred").eq("organization_id", organization.id);
    if (batch) query = query.in("product_model_id", batch);
    if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
    const { data, error } = await query.order("id").range(offset, offset + 499).returns<ProductSupplier[]>();
    if (error) return failure;
    links.push(...data ?? []);
    if (!data || data.length < 500) break;
  }
  suppliers.sort((a,b) => a.name.localeCompare(b.name,"pt-BR") || a.id.localeCompare(b.id));
  return { suppliers, links, error: undefined };
}

export async function getSupplierProduct(productId: string) {
  const organization = await requireOrganization();
  if (!supplierIdSchema.safeParse(productId).success) return { product: null, error: "Produto inválido." };
  const client = await createClient();
  const { data, error } = await client.from("product_model_templates")
    .select("id,category,model_name,stock_quantity,minimum_stock,unit_cost,default_price,is_active")
    .eq("organization_id", organization.id).eq("id", productId).is("deleted_at", null).maybeSingle<InventoryItem>();
  return { product: data, error: error ? "Não foi possível carregar o produto." : undefined };
}
