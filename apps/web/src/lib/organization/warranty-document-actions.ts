"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrganization } from "./queries";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationWarrantyDocument } from "./warranty-document-queries";
import { canManageWarrantyDocument, sanitizeWarrantyDocumentName, validateWarrantyDocument, WARRANTY_DOCUMENT_BUCKET } from "./warranty-document";

export type WarrantyDocumentActionState = { error?: string; success?: string; warning?: string };

export async function uploadWarrantyDocumentAction(
  _previous: WarrantyDocumentActionState, formData: FormData
): Promise<WarrantyDocumentActionState> {
  const organization = await requireOrganization();
  if (!canManageWarrantyDocument(organization.role)) return { error: "Somente owner ou admin pode substituir o termo de garantia." };
  const file = formData.get("document");
  if (!(file instanceof File)) return { error: "Selecione um arquivo PDF." };
  const invalid = await validateWarrantyDocument(file);
  if (invalid) return { error: invalid };
  const current = await getOrganizationWarrantyDocument();
  if (current.error) return { error: current.error };
  const supabase = await createClient();
  const bucket = supabase.storage.from(WARRANTY_DOCUMENT_BUCKET);
  const path = `${organization.id}/warranty/${randomUUID()}.pdf`;
  const { error: uploadError } = await bucket.upload(path, file, { contentType: "application/pdf", upsert: false, cacheControl: "0" });
  if (uploadError) {
    // Também cobre upload concluído cuja resposta se perdeu na rede.
    const cleanup = await bucket.remove([path]);
    return { error: "Não foi possível salvar o PDF. Verifique o Storage da loja e tente novamente.",
      warning: cleanup.error ? "Não foi possível conferir a limpeza do upload. Solicite a conferência do Storage ao administrador." : undefined };
  }
  const { data, error } = await supabase.rpc("replace_organization_warranty_document", {
    p_organization_id: organization.id, p_expected_path: current.document?.path ?? null,
    p_new_path: path, p_name: sanitizeWarrantyDocumentName(file.name)
  });
  if (error || data !== true) {
    // A policy impede remover o termo vigente, inclusive se a resposta da RPC foi perdida.
    const cleanup = await bucket.remove([path]);
    return {
      error: data === false && !error
        ? "Outro usuário substituiu o termo. Atualize a página e tente novamente."
        : "Não foi possível confirmar a atualização. Atualize a página e confira o documento antes de repetir.",
      warning: cleanup.error ? "A limpeza do upload não foi concluída. Solicite a conferência do Storage ao administrador." : undefined
    };
  }
  let warning: string | undefined;
  if (current.document) {
    const cleanup = await bucket.remove([current.document.path]);
    if (cleanup.error || !cleanup.data?.length) warning = "O novo termo foi salvo, mas a remoção do arquivo anterior precisa ser conferida no Storage.";
  }
  revalidatePath("/configuracoes");
  revalidatePath("/manutencoes/[id]", "page");
  return { success: "Termo de garantia atualizado.", warning };
}
