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
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        disabled={disabled || isPending}
        title="Desativar token"
        type="submit"
      >
        <PowerOff className="size-4" aria-hidden="true" />
        {isPending ? "Desativando..." : "Desativar"}
      </button>
      {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
