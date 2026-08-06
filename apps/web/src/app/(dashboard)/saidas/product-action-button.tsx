"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import type { ProductActionState } from "./actions";

type ProductActionButtonProps = {
  action: (
    prevState: ProductActionState,
    formData: FormData
  ) => Promise<ProductActionState>;
  confirmMessage: string;
  idleLabel: string;
  pendingLabel: string;
};

const initialState: ProductActionState = {};

export function ProductActionButton({
  action,
  confirmMessage,
  idleLabel,
  pendingLabel
}: ProductActionButtonProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="grid gap-1"
      onSubmit={(event) => {
        if (!confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <button
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
        disabled={isPending}
        type="submit"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {isPending ? pendingLabel : idleLabel}
      </button>
      {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-xs text-emerald-700">{state.success}</p>
      ) : null}
    </form>
  );
}
