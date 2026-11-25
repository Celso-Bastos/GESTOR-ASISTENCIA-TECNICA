import { buildWhatsAppUrl } from "@/lib/messages/whatsapp";

// Limite conservador do fluxo, não uma garantia/universal do WhatsApp ou navegador.
export const RESTOCK_WHATSAPP_MAX_URL_LENGTH = 8000;

export function getRestockWhatsAppLink(phone: string | null, text: string, hasItems: boolean) {
  if (!phone || !hasItems || !text.trim()) return { url: null, tooLong: false };
  const url = buildWhatsAppUrl(phone, text);
  return url.length > RESTOCK_WHATSAPP_MAX_URL_LENGTH
    ? { url: null, tooLong: true } : { url, tooLong: false };
}

export function canShareRestock(navigator: Pick<Navigator, "share" | "canShare">, text: string) {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function"
      && navigator.canShare({ text });
  } catch { return false; }
}
