"use client";

import { useActionState } from "react";
import type { MaintenanceActionState } from "./actions";

type DeleteMaintenanceButtonProps = {
  action: (
    prevState: MaintenanceActionState,
    formData: FormData
  ) => Promise<MaintenanceActionState>;
};

const initialState: MaintenanceActionState = {};

export function DeleteMaintenanceButton({
  action
}: DeleteMaintenanceButtonProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="grid gap-2"
      onSubmit={(event) => {
        if (
          !confirm(
            "Tem certeza que deseja excluir esta manutenção? Ela será removida das listas, mas o histórico será mantido."
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <button
        className="inline-flex h-11 items-center justify-center rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:h-9"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Excluindo..." : "Excluir manutenção"}
      </button>
      {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
