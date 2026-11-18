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
        className="inline-flex h-11 items-center justify-center rounded-md border border-danger-line bg-surface px-3 text-sm font-medium text-danger transition hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-danger-focus disabled:cursor-not-allowed disabled:bg-canvas disabled:text-disabled sm:h-9"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Excluindo..." : "Excluir manutenção"}
      </button>
      {state.error ? <p role="alert" className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
