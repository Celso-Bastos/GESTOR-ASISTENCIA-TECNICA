"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

type CopyRestockListButtonProps = {
  text: string;
};

export function CopyRestockListButton({ text }: CopyRestockListButtonProps) {
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
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-disabled-bg sm:w-auto"
        disabled={!text.trim()}
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copied ? "Lista copiada!" : "Copiar lista para reposicao"}
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
