"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import type { WhatsAppMessageActionState } from "@/lib/messages/whatsapp";

type Action = (state: WhatsAppMessageActionState, data: FormData) => Promise<WhatsAppMessageActionState>;

export function useWhatsAppAction(action: Action) {
  const popup = useRef<Window | null>(null);
  const busy = useRef(false);
  const [feedback, setFeedback] = useState("");
  const [state, formAction, isPending] = useActionState(async (previous: WhatsAppMessageActionState, data: FormData) => {
    try {
      const result = await action(previous, data);
      if (result.whatsappUrl) {
        if (popup.current && !popup.current.closed) {
          popup.current.location.href = result.whatsappUrl;
          setFeedback("Mensagem preparada. Confira e envie no WhatsApp.");
        } else {
          setFeedback("A abertura foi bloqueada ou a janela foi fechada. Use Abrir WhatsApp novamente ou Copiar mensagem.");
        }
      } else {
        popup.current?.close();
      }
      return result;
    } catch {
      popup.current?.close();
      return { error: "Não foi possível preparar a mensagem. Tente novamente." };
    } finally {
      popup.current = null;
      busy.current = false;
    }
  }, {});

  function prepare(event: FormEvent<HTMLFormElement>) {
    if (busy.current) { event.preventDefault(); return; }
    busy.current = true;
    setFeedback("");
    // Abre durante o gesto do usuário e rompe o acesso à janela de origem.
    try {
      popup.current = window.open("about:blank", "_blank");
      if (popup.current) popup.current.opener = null;
    } catch { popup.current = null; }
  }
  return { state, formAction, isPending, prepare, feedback };
}

export function WhatsAppAlternatives({ state, feedback }: { state: WhatsAppMessageActionState; feedback: string }) {
  const [copyFeedback, setCopyFeedback] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  if (!state.whatsappUrl) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(state.messageBody ?? "");
      setCopyFeedback("Mensagem copiada.");
      setManualCopy(false);
    } catch {
      setCopyFeedback("Selecione e copie o texto abaixo.");
      setManualCopy(true);
    }
  }
  return <div className="grid gap-2 text-sm">
    <p role="status">{feedback}</p>
    <a className="inline-flex min-h-11 items-center rounded-md border border-success-line-strong bg-surface px-3 font-medium text-success-strong transition hover:bg-success-soft" href={state.whatsappUrl} target="_blank" rel="noopener noreferrer">Abrir WhatsApp novamente</a>
    <button className="min-h-11 rounded-md border border-line-strong bg-surface px-3 font-medium text-body transition hover:bg-surface-muted" type="button" onClick={copy}>Copiar mensagem</button>
    {copyFeedback ? <p role="status">{copyFeedback}</p> : null}
    {manualCopy ? <textarea aria-label="Mensagem para copiar" className="min-h-32 w-full rounded-md border border-line-strong bg-surface p-3 text-base text-foreground outline-none focus:border-accent-border focus:ring-2 focus:ring-focus-soft" readOnly value={state.messageBody ?? ""} onFocus={(event) => event.target.select()} /> : null}
  </div>;
}
