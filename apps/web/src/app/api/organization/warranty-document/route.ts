import { createClient } from "@/lib/supabase/server";
import { getOrganizationWarrantyDocument } from "@/lib/organization/warranty-document-queries";
import { sanitizeWarrantyDocumentName, WARRANTY_DOCUMENT_BUCKET, WARRANTY_DOCUMENT_URL_SECONDS } from "@/lib/organization/warranty-document";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  // A consulta exige autenticação/aprovação e obtém a organização da sessão.
  // Nenhum organization_id ou path fornecido na URL é utilizado.
  const { document, error } = await getOrganizationWarrantyDocument();
  if (error) return Response.json({ error }, { status: 503, headers: privateHeaders });
  if (!document) return Response.json({ error: "Nenhum termo de garantia configurado para esta loja." }, { status: 404, headers: privateHeaders });
  const supabase = await createClient();
  const bucket = supabase.storage.from(WARRANTY_DOCUMENT_BUCKET);
  const params = new URL(request.url).searchParams;
  if (params.get("file") === "1") {
    // Mesma origem para preparar o File do Web Share; não depende de CORS externo.
    const { data, error: downloadError } = await bucket.download(document.path);
    if (downloadError || !data) return Response.json({ error: "Não foi possível preparar o PDF. Tente novamente." }, { status: 503, headers: privateHeaders });
    return new Response(data, { headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${sanitizeWarrantyDocumentName(document.name)}"` } });
  }
  const { data, error: signingError } = await bucket.createSignedUrl(document.path, WARRANTY_DOCUMENT_URL_SECONDS,
    params.get("download") === "1" ? { download: sanitizeWarrantyDocumentName(document.name) } : undefined);
  if (signingError || !data) return Response.json({ error: "Não foi possível abrir o PDF. Tente novamente." }, { status: 503, headers: privateHeaders });
  return new Response(null, { status: 302, headers: { ...privateHeaders, Location: data.signedUrl } });
}
