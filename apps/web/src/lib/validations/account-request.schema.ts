import { z } from "zod";
import { normalizePhoneBR } from "@/lib/phone";
import { serviceCitySchema } from "./service-city";

export const accountRequestSchema = z.object({
  full_name: z.string().trim().min(3, "Informe seu nome completo (mínimo de 3 caracteres).").max(160),
  email: z.string().trim().toLowerCase().max(254).email("Informe um e-mail válido."),
  phone: z.string().trim().max(40).optional().default("").refine(
    (value) => !value || /^\d{10,11}$/.test(normalizePhoneBR(value)),
    "Informe um telefone válido com DDD, ou deixe o campo vazio."
  ),
  business_name: z.string().trim().max(160, "Use até 160 caracteres para a assistência.").optional().default(""),
  service_city: serviceCitySchema,
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128, "Use até 128 caracteres para a senha."),
  confirm_password: z.string().min(1, "Confirme sua senha.").max(128, "Use até 128 caracteres para a confirmação."),
  website: z.string().max(0, "Não foi possível enviar sua solicitação agora. Tente novamente.").optional().default("")
}).refine((data) => data.password === data.confirm_password, {
  path: ["confirm_password"], message: "As senhas não coincidem."
});

export const reviewAccountRequestSchema = z.object({
  id: z.uuid("Solicitação inválida."),
  rejection_reason: z.string().trim().max(1000, "Use até 1000 caracteres para o motivo.").optional().default("")
});

export const definePasswordSchema = z.object({
  password: z.string().min(8, "Use uma senha com pelo menos 8 caracteres.").max(128),
  confirm_password: z.string()
}).refine((data) => data.password === data.confirm_password, {
  path: ["confirm_password"], message: "As senhas devem ser iguais."
});
