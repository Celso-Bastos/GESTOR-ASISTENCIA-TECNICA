import { z } from "zod";
import {
  parseCurrencyInput,
  productCategories
} from "@/lib/products/format";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => value || undefined);

const requiredMoney = z.preprocess(
  (value) => parseCurrencyInput(value as string | number | null | undefined),
  z
    .number({ error: "Informe um valor valido." })
    .min(0, "Informe um valor maior ou igual a zero.")
    .max(99999999.99, "Informe um valor menor.")
);

const optionalMoney = z.preprocess(
  (value) => parseCurrencyInput(value as string | number | null | undefined),
  z
    .number({ error: "Informe um valor valido." })
    .min(0, "Informe um valor maior ou igual a zero.")
    .max(99999999.99, "Informe um valor menor.")
    .optional()
);

const optionalUuid = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => !value || z.string().uuid().safeParse(value).success, {
      message
    });

const requiredDate = z
  .string()
  .trim()
  .min(1, "Informe a data da venda.")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida.")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
    message: "Informe uma data valida."
  });

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Informe uma data valida."
  });

const monthFilter = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => !value || /^\d{4}-\d{2}$/.test(value), {
    message: "Informe um mes valido."
  });

export const createProductModelTemplateSchema = z.object({
  category: z.enum(productCategories, {
    error: "Selecione um produto base valido."
  }),
  model_name: z
    .string()
    .trim()
    .min(1, "Informe o modelo.")
    .max(120, "Use no maximo 120 caracteres no modelo."),
  default_price: optionalMoney,
  is_active: z.boolean().default(true)
});

export const updateProductModelTemplateSchema =
  createProductModelTemplateSchema.extend({
    id: z.string().uuid("Modelo invalido.")
  });

export const deleteProductModelTemplateSchema = z.object({
  id: z.string().uuid("Modelo invalido.")
});

const productOutflowBaseSchema = z.object({
  category: z.enum(productCategories, {
    error: "Selecione um produto base valido."
  }),
  model_template_id: optionalUuid("Modelo salvo invalido."),
  custom_model_name: optionalText(
    120,
    "Use no maximo 120 caracteres no modelo."
  ),
  quantity: z.preprocess(
    (value) => Number(String(value ?? "").trim()),
    z
      .number({ error: "Informe a quantidade." })
      .int("A quantidade deve ser inteira.")
      .positive("A quantidade deve ser maior que zero.")
      .max(99999, "Informe uma quantidade menor.")
  ),
  unit_price: requiredMoney,
  sold_at: requiredDate,
  customer_id: optionalUuid("Cliente invalido."),
  notes: optionalText(1000, "Use no maximo 1000 caracteres na observacao.")
});

function requireOutflowModel<
  T extends z.infer<typeof productOutflowBaseSchema>
>(value: T, ctx: z.RefinementCtx) {
    if (!value.model_template_id && !value.custom_model_name) {
      ctx.addIssue({
        code: "custom",
        path: ["custom_model_name"],
        message: "Escolha um modelo salvo ou informe o modelo vendido."
      });
    }
}

export const createProductOutflowSchema = productOutflowBaseSchema
  .extend({
    save_as_template: z.boolean().default(false)
  })
  .superRefine(requireOutflowModel);

export const updateProductOutflowSchema = productOutflowBaseSchema
  .extend({
    id: z.string().uuid("Saida invalida.")
  })
  .superRefine(requireOutflowModel);

export const deleteProductOutflowSchema = z.object({
  id: z.string().uuid("Saida invalida.")
});

export const outflowReportFilterSchema = z.object({
  month: monthFilter,
  category: z.enum(productCategories).optional(),
  q: z
    .string()
    .trim()
    .max(80, "Use no maximo 80 caracteres na busca.")
    .optional(),
  start: optionalDate,
  end: optionalDate
});

export type CreateProductModelTemplateInput = z.infer<
  typeof createProductModelTemplateSchema
>;
export type UpdateProductModelTemplateInput = z.infer<
  typeof updateProductModelTemplateSchema
>;
export type CreateProductOutflowInput = z.infer<
  typeof createProductOutflowSchema
>;
export type UpdateProductOutflowInput = z.infer<
  typeof updateProductOutflowSchema
>;
