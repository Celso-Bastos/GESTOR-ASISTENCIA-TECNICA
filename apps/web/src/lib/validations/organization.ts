import { z } from "zod";
import { serviceCitySchema } from "./service-city";

export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "O Site da loja deve ter ao menos 3 caracteres.")
  .max(60, "O Site da loja deve ter no máximo 60 caracteres.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "No Site da loja, use apenas letras sem acentos, números e hífens entre palavras."
  );

export const organizationSiteSchema = z.object({ slug: organizationSlugSchema });

export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da loja.")
    .max(120, "Use no maximo 120 caracteres."),
  slug: organizationSlugSchema,
  phone: z.string().trim().max(30, "Use no maximo 30 caracteres.").optional(),
  service_city: serviceCitySchema
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
