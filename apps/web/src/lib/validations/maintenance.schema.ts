import { z } from "zod";
import { updateMaintenanceStatusSchema, deleteMaintenanceOrderSchema } from "./maintenance-status.schema";
export { updateMaintenanceStatusSchema, deleteMaintenanceOrderSchema };
import { normalizePhoneBR } from "@/lib/phone";
import { customerAddressSchema } from "./customer.schema";
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

const optionalQuickCustomerName = z
  .string()
  .trim()
  .max(120, "Use no máximo 120 caracteres no nome.")
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => !value || value.length >= 2, {
    message: "Use pelo menos 2 caracteres no nome do cliente."
  });

const optionalQuickPhone = z
  .string()
  .trim()
  .max(30, "Use no máximo 30 caracteres no telefone.")
  .optional()
  .transform((value) => value || undefined)
  .refine(
    (value) => {
      if (!value) {
        return true;
      }

      const normalized = normalizePhoneBR(value);

      return normalized.length >= 10 && normalized.length <= 11;
    },
    {
      message: "Informe um telefone válido com DDD."
    }
  );

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

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    // Decimal simples ou moeda BR com milhares e vírgula. Não aceitar texto,
    // notação científica/hexadecimal ou mais casas que numeric(10,2).
    const valid = /^-?\d+(?:[.,]\d{1,2})?$/.test(trimmed)
      || /^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(trimmed);
    if (!valid) return Number.NaN;
    const normalized = trimmed.includes(",")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed;
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
  customer_mode: z.enum(["existing", "new"]).default("existing"),
  customer_id: z.string().uuid("Selecione um cliente válido.").optional().or(z.literal("")),
  customer_name: optionalQuickCustomerName,
  customer_phone: optionalQuickPhone,
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
}).superRefine((value, ctx) => {
  if (value.customer_mode === "existing" && !value.customer_id) {
    ctx.addIssue({ code: "custom", path: ["customer_id"], message: "Selecione um cliente existente." });
  }
  if (value.customer_mode === "new" && !value.customer_name) {
    ctx.addIssue({ code: "custom", path: ["customer_name"], message: "Informe o nome do novo cliente." });
  }
}).and(warrantySchema);

export const createQuickMaintenanceOrderSchema = z.object({
  customer_name: optionalQuickCustomerName,
  phone: optionalQuickPhone,
  customer_address: customerAddressSchema,
  customer_address_action: z.enum(["preserve", "set", "clear"]).default("preserve"),
  customer_address_customer_id: z.string().uuid("Confira o cliente pelo telefone antes de alterar o endereço.").optional().or(z.literal("")),
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
  estimated_price: optionalMoney,
  quick_notes: optionalText(
    2000,
    "Use no máximo 2000 caracteres na observação rápida."
  )
}).superRefine((value, ctx) => {
  if (value.customer_address_action === "set" && !value.customer_address) {
    ctx.addIssue({ code: "custom", path: ["customer_address"], message: "Informe o endereço ou mantenha o cadastro atual." });
  }
  if (value.customer_address_action === "clear" && (!value.customer_address_customer_id || value.customer_address)) {
    ctx.addIssue({ code: "custom", path: ["customer_address"], message: "Para remover o endereço, confirme o cliente pelo telefone e use a opção de remoção." });
  }
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
