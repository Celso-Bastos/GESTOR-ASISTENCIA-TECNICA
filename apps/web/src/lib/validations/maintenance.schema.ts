import { z } from "zod";
import { normalizePhoneBR } from "@/lib/phone";
import {
  maintenanceStatuses,
  type MaintenanceStatusFilter
} from "@/lib/maintenance/status";
import { warrantyUnits } from "@/lib/maintenance/warranty";

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

const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine(
    (value) =>
      !value || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
    {
      message: "Informe uma data e hora validas."
    }
  )
  .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
    message: "Informe uma data e hora validas."
  })
  .transform((value) => (value ? new Date(value).toISOString() : undefined));

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

const optionalWarrantyAmount = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    return Number(trimmed);
  },
  z
    .number({ error: "Informe uma quantidade de garantia valida." })
    .int("A quantidade da garantia deve ser um numero inteiro.")
    .positive("A quantidade da garantia deve ser maior que zero.")
    .max(1200, "Informe uma quantidade de garantia menor.")
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

const warrantySchema = z
  .object({
    warranty_enabled: z.boolean().default(false),
    warranty_signed: z.boolean().default(false),
    warranty_amount: optionalWarrantyAmount,
    warranty_unit: z.enum(warrantyUnits).optional(),
    warranty_started_at: optionalDate,
    warranty_notes: optionalText(
      1000,
      "Use no maximo 1000 caracteres na observacao da garantia."
    )
  })
  .superRefine((value, ctx) => {
    if (!value.warranty_enabled) {
      return;
    }

    if (!value.warranty_amount) {
      ctx.addIssue({
        code: "custom",
        path: ["warranty_amount"],
        message: "Informe a quantidade da garantia."
      });
    }

    if (!value.warranty_unit) {
      ctx.addIssue({
        code: "custom",
        path: ["warranty_unit"],
        message: "Selecione a unidade da garantia."
      });
    }

    if (!value.warranty_started_at) {
      ctx.addIssue({
        code: "custom",
        path: ["warranty_started_at"],
        message: "Informe a data de inicio da garantia."
      });
    }
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
}).and(warrantySchema);

export const createQuickMaintenanceOrderSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, "Informe o nome do cliente.")
    .max(120, "Use no máximo 120 caracteres no nome."),
  phone: z
    .string()
    .trim()
    .min(8, "Informe o telefone do cliente.")
    .max(30, "Use no máximo 30 caracteres no telefone.")
    .refine((value) => {
      const normalized = normalizePhoneBR(value);

      return normalized.length >= 10 && normalized.length <= 11;
    }, "Informe um telefone válido com DDD."),
  device_model: z
    .string()
    .trim()
    .min(1, "Informe o modelo do aparelho.")
    .max(120, "Use no máximo 120 caracteres no modelo."),
  reported_issue: z
    .string()
    .trim()
    .min(3, "Informe o defeito relatado.")
    .max(2000, "Use no máximo 2000 caracteres no defeito relatado."),
  expected_delivery_date: optionalDate,
  quick_notes: optionalText(
    2000,
    "Use no máximo 2000 caracteres na observação rápida."
  )
});

export const updateMaintenanceOrderSchema = z.object({
  status: z.enum(maintenanceStatuses, {
    error: "Selecione um status valido."
  }),
  delivered_at: optionalDateTime,
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
}).and(warrantySchema);

export const updateMaintenanceStatusSchema = z.object({
  new_status: z.enum(maintenanceStatuses, {
    error: "Selecione um status válido."
  }),
  description: optionalText(1000, "Use no máximo 1000 caracteres na descrição.")
});

export const deleteMaintenanceOrderSchema = z.object({
  maintenance_order_id: z.string().uuid("Manutenção inválida.")
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
export type CreateQuickMaintenanceOrderInput = z.infer<
  typeof createQuickMaintenanceOrderSchema
>;
export type UpdateMaintenanceOrderInput = z.infer<
  typeof updateMaintenanceOrderSchema
>;
export type UpdateMaintenanceStatusInput = z.infer<
  typeof updateMaintenanceStatusSchema
>;
export type DeleteMaintenanceOrderInput = z.infer<
  typeof deleteMaintenanceOrderSchema
>;
export type MaintenanceSearchInput = z.infer<typeof maintenanceSearchSchema>;
