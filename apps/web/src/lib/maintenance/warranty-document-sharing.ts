import { formatWarrantyPeriod } from "./warranty";
import { buildWhatsAppUrl } from "@/lib/messages/whatsapp";
import { sanitizeWarrantyDocumentName, WARRANTY_DOCUMENT_ENDPOINT, WARRANTY_DOCUMENT_MAX_BYTES } from "@/lib/organization/warranty-document";

export type WarrantyShareCustomer = { name: string | null; phone: string | null };
export type FileShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

export function canShareWarrantyFile(navigator: FileShareNavigator, file: File) {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function"
      && navigator.canShare({ files: [file] });
  } catch { return false; }
}

export function buildWarrantyDocumentMessage(input: {
  customerName?: string | null; orderNumber?: string; deviceModel?: string | null;
  warrantyAmount?: number | null; warrantyUnit?: string | null;
}) {
  const firstName = input.customerName?.trim().split(/\s+/)[0];
  const period = formatWarrantyPeriod(input.warrantyAmount, input.warrantyUnit);
  return [firstName ? `Olá, ${firstName}!` : "Olá!", "",
    `Segue o termo com as condições de garantia${input.orderNumber ? ` referente à OS ${input.orderNumber}` : " dos serviços realizados"}${input.deviceModel ? ` do seu ${input.deviceModel}` : ""}.`, "",
    ...(period ? [`Garantia registrada: ${period}.`, ""] : []), "Em caso de dúvidas, estamos à disposição."].join("\n");
}

export function warrantyDocumentWhatsAppUrl(phone: string | null | undefined, message: string) {
  return phone?.replace(/\D/g, "") ? buildWhatsAppUrl(phone, message) : null;
}

export async function prepareWarrantyShareFile(name: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${WARRANTY_DOCUMENT_ENDPOINT}?file=1`, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok || !response.headers.get("Content-Type")?.startsWith("application/pdf")) {
    throw new Error("Não foi possível preparar o PDF. Atualize a página e tente novamente.");
  }
  const blob = await response.blob();
  if (blob.size <= 0 || blob.size > WARRANTY_DOCUMENT_MAX_BYTES) throw new Error("O PDF está vazio ou excede o limite de 4 MB.");
  const currentName = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? name;
  return new File([blob], sanitizeWarrantyDocumentName(currentName), { type: "application/pdf" });
}

export function downloadPreparedWarrantyFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url; link.download = file.name;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
