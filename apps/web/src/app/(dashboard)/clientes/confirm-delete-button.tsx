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
        className="inline-flex h-11 w-full items-center justify-center rounded-md border border-danger-line bg-surface px-3 text-sm font-medium text-danger transition hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-danger-focus disabled:cursor-not-allowed disabled:bg-canvas disabled:text-disabled sm:h-9 sm:w-auto"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Excluindo..." : "Excluir"}
      </button>
      {state.error ? <p role="alert" className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
