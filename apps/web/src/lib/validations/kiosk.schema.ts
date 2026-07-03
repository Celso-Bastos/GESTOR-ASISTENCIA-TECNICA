import { z } from "zod";
import { normalizePhoneBR } from "@/lib/phone";

const slugSchema = z
  .string()
  .trim()
  .min(1, "Informe a organizacao.")
  .max(120, "Organizacao invalida.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Organizacao invalida.");

const tokenSchema = z
  .string()
  .trim()
  .min(16, "Token invalido.")
  .max(160, "Token invalido.");

const kioskPhoneSchema = z
  .string()
  .trim()
  .min(1, "Informe o telefone.")
  .max(30, "Telefone invalido.")
  .refine((value) => {
    const normalized = normalizePhoneBR(value);
    return normalized.length === 10 || normalized.length === 11;
  }, "Informe um telefone com DDD valido.");

export const kioskCustomerSchema = z.object({
  slug: slugSchema,
  token: tokenSchema,
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome.")
    .max(120, "Use no maximo 120 caracteres."),
  phone: kioskPhoneSchema,
  consent: z.literal(true, {
    error: "Aceite o contato pelo WhatsApp para concluir."
  }),
  website: z.string().max(0, "Cadastro invalido.").optional().or(z.literal(""))
});

export const kioskTokenNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome para o token.")
    .max(80, "Use no maximo 80 caracteres.")
});

export const kioskTokenIdSchema = z.object({
  id: z.string().uuid("Token invalido.")
});

export type KioskCustomerInput = z.infer<typeof kioskCustomerSchema>;
