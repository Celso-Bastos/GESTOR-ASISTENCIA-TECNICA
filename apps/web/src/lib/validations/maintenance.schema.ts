import { z } from "zod";
import {
  maintenanceStatuses,
  type MaintenanceStatusFilter
} from "@/lib/maintenance/status";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => value || undefined);

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Informe uma data válida."
  });

const optionalMoney = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim().replace(",", ".");

    if (!normalized) {
      return undefined;
    }

    return Number(normalized);
  },
  z
    .number({ error: "Informe um valor válido." })
    .min(0, "Informe um valor maior ou igual a zero.")
    .max(99999999.99, "Informe um valor menor.")
    .optional()
);

export const deviceSchema = z.object({
  brand: optionalText(80, "Use no máximo 80 caracteres na marca."),
  model: z
    .string()
    .trim()
    .min(1, "Informe o modelo do aparelho.")
    .max(120, "Use no máximo 120 caracteres no modelo."),
  color: optionalText(60, "Use no máximo 60 caracteres na cor."),
  storage: optionalText(60, "Use no máximo 60 caracteres no armazenamento."),
  imei: optionalText(40, "Use no máximo 40 caracteres no IMEI."),
  notes: optionalText(1000, "Use no máximo 1000 caracteres nas observações.")
});

export const createMaintenanceOrderSchema = z.object({
  customer_id: z.string().uuid("Selecione um cliente válido."),
  device: deviceSchema,
  reported_issue: z
    .string()
    .trim()
    .min(3, "Informe o defeito relatado.")
    .max(2000, "Use no máximo 2000 caracteres no defeito relatado."),
  expected_delivery_date: optionalDate,
  estimated_price: optionalMoney,
  internal_notes: optionalText(
    2000,
    "Use no máximo 2000 caracteres nas observações internas."
  )
});

export const updateMaintenanceOrderSchema = z.object({
  device: deviceSchema,
  reported_issue: z
    .string()
    .trim()
    .min(3, "Informe o defeito relatado.")
    .max(2000, "Use no máximo 2000 caracteres no defeito relatado."),
  diagnosis: optionalText(2000, "Use no máximo 2000 caracteres no diagnóstico."),
  expected_delivery_date: optionalDate,
  estimated_price: optionalMoney,
  final_price: optionalMoney,
  internal_notes: optionalText(
    2000,
    "Use no máximo 2000 caracteres nas observações internas."
  )
});

export const updateMaintenanceStatusSchema = z.object({
  new_status: z.enum(maintenanceStatuses, {
    error: "Selecione um status válido."
  }),
  description: optionalText(1000, "Use no máximo 1000 caracteres na descrição.")
});

export const maintenanceSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(80, "Use no máximo 80 caracteres na busca.")
    .optional(),
  status: z
    .union([
      z.enum(maintenanceStatuses),
      z.literal("todos"),
      z.literal("atrasados")
    ])
    .optional()
    .transform((value): MaintenanceStatusFilter => value || "todos")
});

export type CreateMaintenanceOrderInput = z.infer<
  typeof createMaintenanceOrderSchema
>;
export type UpdateMaintenanceOrderInput = z.infer<
  typeof updateMaintenanceOrderSchema
>;
export type UpdateMaintenanceStatusInput = z.infer<
  typeof updateMaintenanceStatusSchema
>;
export type MaintenanceSearchInput = z.infer<typeof maintenanceSearchSchema>;
