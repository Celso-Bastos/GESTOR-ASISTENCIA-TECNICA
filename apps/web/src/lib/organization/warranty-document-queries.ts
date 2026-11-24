import "server-only";
import { requireOrganization } from "./queries";
import { createClient } from "@/lib/supabase/server";
import { isWarrantyDocumentPath, type WarrantyDocument } from "./warranty-document";

export async function getOrganizationWarrantyDocument(): Promise<{ document: WarrantyDocument | null; error?: string }> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations")
    .select("warranty_document_path, warranty_document_name, warranty_document_updated_at")
    .eq("id", organization.id).maybeSingle<{
      warranty_document_path: string | null; warranty_document_name: string | null; warranty_document_updated_at: string | null;
    }>();
  if (error || !data) return { document: null, error: "Não foi possível consultar o termo de garantia. Verifique a configuração da loja e tente novamente." };
  if (!data.warranty_document_path) return { document: null };
  if (!isWarrantyDocumentPath(data.warranty_document_path, organization.id)
    || !data.warranty_document_name || !data.warranty_document_updated_at) {
    return { document: null, error: "A configuração do termo está incompleta. Solicite a substituição do documento." };
  }
  return { document: { path: data.warranty_document_path, name: data.warranty_document_name, updatedAt: data.warranty_document_updated_at } };
}
