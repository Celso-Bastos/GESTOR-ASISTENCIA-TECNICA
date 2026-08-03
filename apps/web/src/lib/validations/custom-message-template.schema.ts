import { z } from "zod";

export const customMessageContexts = [
  "maintenance",
  "warranty",
  "customer",
  "sales",
  "general"
] as const;

export type CustomMessageContext = (typeof customMessageContexts)[number];

export const customMessageContextLabels: Record<CustomMessageContext, string> = {
  maintenance: "Manutencao",
  warranty: "Garantia",
  customer: "Cliente",
  sales: "Venda",
  general: "Geral"
};

export const createCustomMessageTemplateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Informe um titulo com pelo menos 2 caracteres.")
    .max(100, "Use no maximo 100 caracteres no titulo."),
  body: z
    .string()
    .trim()
    .min(1, "Informe o corpo da mensagem.")
    .max(2000, "Use no maximo 2000 caracteres no corpo da mensagem."),
  context: z.enum(customMessageContexts, {
    error: "Selecione um contexto valido."
  }),
  is_active: z.boolean().default(true)
});

export const updateCustomMessageTemplateSchema =
  createCustomMessageTemplateSchema.extend({
    id: z.string().uuid("Mensagem personalizada invalida.")
  });

export const deleteCustomMessageTemplateSchema = z.object({
  id: z.string().uuid("Mensagem personalizada invalida.")
});

export type CreateCustomMessageTemplateInput = z.infer<
  typeof createCustomMessageTemplateSchema
>;
export type UpdateCustomMessageTemplateInput = z.infer<
  typeof updateCustomMessageTemplateSchema
>;
export type DeleteCustomMessageTemplateInput = z.infer<
  typeof deleteCustomMessageTemplateSchema
>;
