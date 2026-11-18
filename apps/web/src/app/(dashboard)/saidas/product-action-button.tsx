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
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-danger-line bg-surface px-3 text-sm font-medium text-danger transition hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-danger-focus disabled:cursor-not-allowed disabled:bg-canvas disabled:text-disabled sm:h-9 sm:w-auto"
        disabled={isPending}
        type="submit"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {isPending ? pendingLabel : idleLabel}
      </button>
      {state.error ? <p role="alert" className="text-xs text-danger">{state.error}</p> : null}
      {state.success ? (
        <p role="status" className="text-xs text-success">{state.success}</p>
      ) : null}
    </form>
  );
}
