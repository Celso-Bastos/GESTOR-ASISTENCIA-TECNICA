import { z } from "zod";

export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da loja.")
    .max(120, "Use no maximo 120 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use apenas letras minusculas, numeros e hifens."
    )
    .min(3, "Use ao menos 3 caracteres.")
    .max(60, "Use no maximo 60 caracteres."),
  phone: z.string().trim().max(30, "Use no maximo 30 caracteres.").optional()
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
