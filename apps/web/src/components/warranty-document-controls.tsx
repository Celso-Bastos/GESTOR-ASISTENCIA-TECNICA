"use client";

import { useState } from "react";
import { WARRANTY_DOCUMENT_ENDPOINT } from "@/lib/organization/warranty-document";

type SharingHelpers = typeof import("@/lib/maintenance/warranty-document-sharing");
type PreparedDocument = { file: File; helpers: SharingHelpers };

const buttonClass = "inline-flex min-h-12 min-w-0 items-center justify-center rounded-md border border-line-strong bg-surface px-3 py-2 text-center text-sm font-semibold text-body hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50";

export function WarrantyDocumentControls({ name, message, phone }: { name: string; message: string; phone?: string | null }) {
  const [prepared, setPrepared] = useState<PreparedDocument | null>(null);
  const [pending, setPending] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const whatsapp = prepared?.helpers.warrantyDocumentWhatsAppUrl(phone, message);

  function showFallback(document: PreparedDocument) {
    setFallback(true);
    document.helpers.downloadPreparedWarrantyFile(document.file);
    setFeedback("PDF preparado para baixar. Se o download não começar, use Baixar termo.");
  }

  async function prepare() {
    setPending(true); setFeedback(""); setFallback(false);
    try {
      // O chunk e os helpers de File/Blob/WhatsApp só são solicitados no clique.
      const helpers = await import("@/lib/maintenance/warranty-document-sharing");
      const document = { file: await helpers.prepareWarrantyShareFile(name), helpers };
      setPrepared(document);
      if (!helpers.canShareWarrantyFile(navigator, document.file)) showFallback(document);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível preparar o termo.");
    } finally { setPending(false); }
  }

  // Segundo clique mantém a ativação do usuário exigida por navegadores móveis.
  async function share() {
    if (!prepared) return;
    const { file, helpers } = prepared;
    if (!helpers.canShareWarrantyFile(navigator, file)) { showFallback(prepared); return; }
    setPending(true);
    try {
      await navigator.share({ files: [file], title: "Termo de garantia", text: message });
      setFeedback("Compartilhamento encerrado. Confira o envio no aplicativo escolhido.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") setFeedback("Compartilhamento cancelado. Você pode tentar novamente.");
      else showFallback(prepared);
    } finally { setPending(false); }
  }

  return <div className="grid min-w-0 gap-3">
    <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap">
      <a href={WARRANTY_DOCUMENT_ENDPOINT} target="_blank" rel="noopener noreferrer" className={buttonClass}>Visualizar termo</a>
      <a href={`${WARRANTY_DOCUMENT_ENDPOINT}?download=1`} className={buttonClass}>Baixar termo</a>
      <button type="button" disabled={pending} onClick={prepare} className={buttonClass}>{pending ? "Preparando..." : "Compartilhar termo"}</button>
    </div>
    {prepared && !fallback && <div className="grid gap-2 rounded-md border border-success-line bg-success-soft p-3 text-sm text-success">
      <p>PDF pronto. Escolha o aplicativo e o cliente para enviar.</p>
      <button type="button" disabled={pending} onClick={share} className={buttonClass}>Escolher aplicativo</button>
      <button type="button" disabled={pending} onClick={() => showFallback(prepared)} className={buttonClass}>Baixar e usar WhatsApp</button>
    </div>}
    {fallback && <div className="grid gap-2 rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning-strong">
      <p>Abra o WhatsApp e anexe o PDF baixado à conversa. O arquivo não é anexado automaticamente.</p>
      {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass}>Abrir WhatsApp</a> : <p>Cliente sem telefone cadastrado.</p>}
    </div>}
    {feedback && <p role="status" aria-live="polite" className="break-words text-sm text-body">{feedback}</p>}
  </div>;
}
