"use client";

import { useActionState } from "react";
import type { CustomerActionState } from "./actions";

type ConfirmDeleteButtonProps = {
  action: (
    prevState: CustomerActionState,
    formData: FormData
  ) => Promise<CustomerActionState>;
};

const initialState: CustomerActionState = {};

export function ConfirmDeleteButton({ action }: ConfirmDeleteButtonProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="grid gap-2"
      onSubmit={(event) => {
        if (!confirm("Excluir este cliente? Essa acao sera um soft delete.")) {
          event.preventDefault();
        }
      }}
    >
      <button
        className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Excluindo..." : "Excluir"}
      </button>
      {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
