import { z } from "zod";
import { replenishmentWhatsAppPhoneSchema } from "@/lib/validations/replenishment-whatsapp";

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do fornecedor.").max(120, "Use até 120 caracteres no nome."),
  whatsapp_phone: replenishmentWhatsAppPhoneSchema,
  notes: z.string().trim().max(2000, "Use até 2000 caracteres nas observações.").transform(value => value || null),
  is_active: z.boolean()
});
export const supplierIdSchema = z.uuid("Fornecedor ou produto inválido.");
export const productSupplierSchema = z.object({
  product_model_id: supplierIdSchema, supplier_id: supplierIdSchema,
  operation: z.enum(["add", "remove", "prefer", "unprefer"])
});
