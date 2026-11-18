import { z } from "zod";
import { getTodayCivilDate, isValidCivilDate } from "@/lib/civil-date";
import { normalizePhoneBR } from "@/lib/phone";

const phoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => {
    if (!value) {
      return true;
    }

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
  address: z
    .string()
    .trim()
    .max(300, "Use no máximo 300 caracteres no endereço.")
    .nullish()
    .transform((value) => value || null),
  birth_date: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value || null)
    .refine(
      (value) => !value || isValidCivilDate(value),
      "Informe uma data de aniversário válida."
    )
    .refine(
      (value) => !value || value <= getTodayCivilDate(),
      "A data de aniversário não pode estar no futuro."
    ),
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
