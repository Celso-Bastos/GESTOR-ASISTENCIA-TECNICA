import { getStockRestock, type InventoryItem } from "@/lib/products/inventory";
import type { InventorySupplier, ProductSupplier } from "./types";

export type RestockFilters = { category?: string; supplierId?: string; withoutSupplier?: boolean; search?: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function getSupplierRestock(items: InventoryItem[], suppliers: InventorySupplier[], links: ProductSupplier[], filters: RestockFilters = {}) {
  const byId = new Map(suppliers.map(s => [s.id,s]));
  const byProduct = new Map<string, ProductSupplier[]>();
  for (const link of links) {
    const group = byProduct.get(link.product_model_id) ?? [];
    group.push(link); byProduct.set(link.product_model_id, group);
  }
  const search = normalize(filters.search?.trim() ?? "");
  return getStockRestock(items).map(item => {
    const available = (byProduct.get(item.id) ?? []).flatMap(link => {
      const supplier = byId.get(link.supplier_id);
      return supplier?.is_active ? [{ ...supplier, is_preferred: link.is_preferred }] : [];
    });
    return { ...item, suppliers: available, preferred: available.find(s => s.is_preferred) ?? null };
  }).filter(item => (!filters.category || item.category === filters.category)
    && (!filters.supplierId || item.suppliers.some(s => s.id === filters.supplierId))
    && (!filters.withoutSupplier || item.suppliers.length === 0)
    && (!search || normalize(item.model_name).includes(search) || item.suppliers.some(s => normalize(s.name).includes(search))));
}

export function getRestockIndicators(rows: ReturnType<typeof getSupplierRestock>) {
  return { models: rows.length, units: rows.reduce((n,item) => n+item.suggested,0),
    categories: new Set(rows.map(item => item.category)).size, withoutSupplier: rows.filter(item => !item.suppliers.length).length };
}

// Um único gerador da lista, compartilhado com o estoque e todos os filtros.
export { formatStockRestockList as formatSupplierRestockList } from "@/lib/products/inventory";
