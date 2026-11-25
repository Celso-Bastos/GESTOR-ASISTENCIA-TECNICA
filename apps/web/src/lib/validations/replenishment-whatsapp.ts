import { z } from "zod";
import { normalizePhoneBR } from "@/lib/phone";
import { normalizePhoneForWhatsApp } from "@/lib/messages/whatsapp";

export const replenishmentWhatsAppPhoneSchema = z.string().trim().max(30)
  .refine(value => !value || (/^\+?[\d\s().-]+$/.test(value)
    && /^[1-9]\d[2-9]\d{7,8}$/.test(normalizePhoneBR(value))),
  "Informe um telefone brasileiro válido com DDD.")
  .transform(value => value ? normalizePhoneForWhatsApp(value) : null);
