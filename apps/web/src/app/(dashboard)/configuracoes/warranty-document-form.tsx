"use client";

import { useActionState, useState } from "react";
import { uploadWarrantyDocumentAction, type WarrantyDocumentActionState } from "@/lib/organization/warranty-document-actions";
import { WARRANTY_DOCUMENT_MAX_BYTES } from "@/lib/organization/warranty-document";

export function WarrantyDocumentForm({ hasDocument }: { hasDocument: boolean }) {
  const [state, action, pending] = useActionState(uploadWarrantyDocumentAction, {} as WarrantyDocumentActionState);
  const [selectionError, setSelectionError] = useState("");
  return <form action={action} aria-busy={pending} className="grid min-w-0 gap-3">
    <label className="grid min-w-0 gap-2 text-sm font-medium text-body">
      {hasDocument ? "Novo documento PDF" : "Documento PDF"}
      <input name="document" type="file" accept="application/pdf,.pdf" required aria-describedby="warranty-upload-help"
        onChange={event => {
          const file = event.target.files?.[0];
          setSelectionError(file && (file.size > WARRANTY_DOCUMENT_MAX_BYTES || file.size === 0)
            ? "Selecione um PDF não vazio de até 4 MB."
            : file && (file.type !== "application/pdf" || !/\.pdf$/i.test(file.name)) ? "Selecione um arquivo PDF (.pdf)." : "");
        }}
        className="min-h-12 w-full min-w-0 max-w-full rounded-md border border-line-strong bg-surface p-2 text-sm text-foreground file:mr-2 file:rounded file:border-0 file:bg-surface-muted file:p-2 file:text-body focus:outline-none focus:ring-2 focus:ring-focus" />
    </label>
    <p id="warranty-upload-help" className="text-sm text-muted">Somente PDF, até 4 MB. A substituição muda o termo padrão para todas as OS; os dados de garantia e a assinatura física permanecem registrados.</p>
    {selectionError && <p role="alert" className="text-sm text-danger">{selectionError}</p>}
    {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-success">{state.success}</p>}
    {state.warning && <p role="alert" className="text-sm text-warning-strong">{state.warning}</p>}
    <button type="submit" disabled={pending || Boolean(selectionError)} className="min-h-12 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 sm:w-fit">
      {pending ? "Salvando..." : hasDocument ? "Substituir documento" : "Adicionar documento"}
    </button>
  </form>;
}
