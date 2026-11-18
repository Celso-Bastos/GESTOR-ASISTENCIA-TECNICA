"use client";

import { useActionState, useState } from "react";
import { Check, Copy, PowerOff } from "lucide-react";
import type { KioskTokenActionState } from "@/lib/kiosk/actions";

type CopyButtonProps = {
  link: string;
};

type DisableTokenFormProps = {
  action: (
    prevState: KioskTokenActionState,
    formData: FormData
  ) => Promise<KioskTokenActionState>;
  disabled?: boolean;
};

const initialState: KioskTokenActionState = {};

export function CopyButton({ link }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-body transition hover:bg-surface-muted sm:h-9"
      onClick={handleCopy}
      title="Copiar link do tablet"
      type="button"
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export function DisableTokenForm({
  action,
  disabled = false
}: DisableTokenFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-2">
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-danger-line bg-surface px-3 text-sm font-semibold text-danger transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:border-line disabled:text-disabled sm:h-9"
        disabled={disabled || isPending}
        title="Desativar token"
        type="submit"
      >
        <PowerOff className="size-4" aria-hidden="true" />
        {isPending ? "Desativando..." : "Desativar"}
      </button>
      {state.error ? <p role="alert" className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
