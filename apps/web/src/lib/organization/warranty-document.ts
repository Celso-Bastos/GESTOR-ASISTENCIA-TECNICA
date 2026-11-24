export const WARRANTY_DOCUMENT_BUCKET = "organization-documents";
export const WARRANTY_DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
export const WARRANTY_DOCUMENT_URL_SECONDS = 300;
export const WARRANTY_DOCUMENT_ENDPOINT = "/api/organization/warranty-document";

export type WarrantyDocument = { path: string; name: string; updatedAt: string };

export function canManageWarrantyDocument(role: string) {
  return role === "owner" || role === "admin";
}

export function sanitizeWarrantyDocumentName(name: string) {
  const base = name.split(/[\\/]/).pop()!.replace(/\.pdf$/i, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[^a-zA-Z0-9]+/, "")
    .slice(0, 100).replace(/[._-]+$/, "");
  return `${base || "termo-de-garantia"}.pdf`;
}

export function isWarrantyDocumentPath(path: string, organizationId: string) {
  return path.startsWith(`${organizationId}/warranty/`)
    && /^[0-9a-f-]{36}\/warranty\/[0-9a-f-]{36}\.pdf$/.test(path);
}

export async function validateWarrantyDocument(file: File) {
  if (file.type !== "application/pdf" || !/\.pdf$/i.test(file.name)) return "Selecione um arquivo PDF (.pdf).";
  if (file.size <= 0) return "O PDF está vazio.";
  if (file.size > WARRANTY_DOCUMENT_MAX_BYTES) return "O PDF deve ter no máximo 4 MB.";
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...header) !== "%PDF-") return "O arquivo não possui um cabeçalho PDF válido.";
  return null;
}
