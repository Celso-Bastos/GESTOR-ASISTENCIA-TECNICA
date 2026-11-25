"use client";

import { useState, useSyncExternalStore } from "react";
import { CopyRestockListButton } from "../../relatorios/reposicao/copy-restock-list-button";
import { canShareRestock } from "@/lib/products/restock-whatsapp";

const subscribeToCapabilities = () => () => {};

export function RestockShareControls({ text, url, hasItems, tooLong }: {
  text: string; url: string | null; hasItems: boolean; tooLong: boolean;
}) {
  const shareSupported = useSyncExternalStore(subscribeToCapabilities,
    () => hasItems && canShareRestock(navigator, text), () => false);
  const [error, setError] = useState("");
  const primary = "inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus sm:w-auto";
  async function share() {
    setError("");
    try { await navigator.share({ title: "Reposição por estoque", text }); }
    catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError")) setError("Não foi possível compartilhar. Use Copiar lista para preservar todos os itens.");
    }
  }
  return <div className="grid min-w-0 gap-3">
    {tooLong ? <p role="status" className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning-strong">A lista completa excede o limite seguro de abertura por link. Use Copiar lista{shareSupported ? " ou Compartilhar" : ""}. Nenhum item foi removido. Ao compartilhar, escolha o destinatário no aplicativo.</p> : null}
    <div className="grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-start">
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className={primary}>Enviar pelo WhatsApp</a>
        : <button type="button" disabled className={`${primary} cursor-not-allowed disabled:bg-disabled-bg disabled:text-muted`}>Enviar pelo WhatsApp</button>}
      <CopyRestockListButton text={hasItems ? text : ""} label="Copiar lista" secondary />
      {tooLong && shareSupported ? <button type="button" onClick={share} className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-4 py-3 text-sm font-semibold text-body sm:w-auto">Compartilhar</button> : null}
    </div>
    {url ? <p className="text-sm text-muted">Revise a mensagem e pressione Enviar dentro do WhatsApp. A lista representa o estoque carregado nesta página; atualize a página para conferir alterações recentes.</p> : null}
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
  </div>;
}
