export type InventorySupplier = {
  id: string; name: string; whatsapp_phone: string | null; notes: string | null; is_active: boolean;
};
export type ProductSupplier = {
  id: string; product_model_id: string; supplier_id: string; is_preferred: boolean;
};
export function canManageSuppliers(role: string) { return role === "owner" || role === "admin"; }
