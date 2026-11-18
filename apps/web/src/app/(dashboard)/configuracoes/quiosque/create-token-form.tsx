"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import type { KioskTokenActionState } from "@/lib/kiosk/actions";

type CreateTokenFormProps = {
  action: (
    prevState: KioskTokenActionState,
    formData: FormData
  ) => Promise<KioskTokenActionState>;
};

const initialState: KioskTokenActionState = {};

export function CreateTokenForm({ action }: CreateTokenFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-md border border-line bg-surface p-4 shadow-sm sm:grid-cols-[1fr_auto]"
    >
      <label className="grid gap-2 text-sm font-medium text-body">
        Nome do token
        <input
          className="h-11 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          maxLength={80}
          name="name"
          placeholder="Tablet do balcao"
          required
        />
      </label>
      <button
        className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-disabled-bg"
        disabled={isPending}
        type="submit"
      >
        <Plus className="size-4" aria-hidden="true" />
        {isPending ? "Criando..." : "Criar token"}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm font-medium text-accent sm:col-span-2">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
