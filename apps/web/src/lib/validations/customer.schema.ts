import { z } from "zod";
import { normalizePhoneBR } from "@/lib/phone";

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Informe o telefone do cliente.")
  .refine((value) => {
    const normalized = normalizePhoneBR(value);
    return normalized.length === 10 || normalized.length === 11;
  }, "Informe um telefone com DDD valido.");

const customerBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome do cliente.")
    .max(120, "Use no maximo 120 caracteres."),
  phone: phoneSchema,
  whatsapp_opt_in: z.boolean(),
  notes: z
    .string()
    .trim()
    .max(1000, "Use no maximo 1000 caracteres.")
    .optional()
});

export const createCustomerSchema = customerBaseSchema;

export const updateCustomerSchema = customerBaseSchema;

export const customerSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(80, "Use no maximo 80 caracteres na busca.")
    .optional()
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
