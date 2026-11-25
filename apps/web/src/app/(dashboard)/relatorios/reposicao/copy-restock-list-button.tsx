"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

type CopyRestockListButtonProps = {
  text: string;
  label?: string;
  secondary?: boolean;
};

export function CopyRestockListButton({ text, label = "Copiar lista para reposicao", secondary = false }: CopyRestockListButtonProps) {
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleCopy() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard indisponivel");
      }

      await navigator.clipboard.writeText(text);
      setCopied(true);
      setManualCopy(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setManualCopy(true);
      window.setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 0);
    }
  }

  return (
    <div className="grid gap-3">
      <button
        className={`inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-disabled-bg sm:w-auto ${secondary ? "border border-line-strong bg-surface text-body hover:bg-surface-muted" : "bg-teal-700 text-white hover:bg-teal-800"}`}
        disabled={!text.trim()}
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copied ? "Lista copiada!" : label}
      </button>

      {manualCopy ? (
        <div className="grid gap-2 rounded-md border border-warning-line bg-warning-soft p-3">
          <p className="text-sm font-medium text-warning-strong">
            Nao foi possivel copiar. Selecione e copie manualmente.
          </p>
          <textarea
            className="min-h-48 rounded-md border border-warning-line bg-surface p-3 font-mono text-xs text-foreground-strong outline-none focus:ring-2 focus:ring-warning-line"
            readOnly
            ref={textareaRef}
            value={text}
          />
        </div>
      ) : null}
    </div>
  );
}
