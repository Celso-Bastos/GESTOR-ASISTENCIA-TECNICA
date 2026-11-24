"use client";

import type { MaintenanceActionState } from "@/lib/maintenance/types";
import { useActionState } from "react";
import {
  maintenanceStatusLabels,
  maintenanceStatuses,
  type MaintenanceStatus
} from "@/lib/maintenance/status";
import {
  cancelMaintenanceOrderAction,
  markMaintenanceAsDeliveredAction,
  updateMaintenanceStatusAction
} from "@/lib/maintenance/detail-actions";

type MaintenanceStatusControlsProps = {
  orderId: string;
  currentStatus: MaintenanceStatus;
};

const initialState: MaintenanceActionState = {};

export function MaintenanceStatusControls({
  orderId,
  currentStatus
}: MaintenanceStatusControlsProps) {
  const [statusState, statusAction, isStatusPending] = useActionState(
    updateMaintenanceStatusAction.bind(null, orderId),
    initialState
  );
  const [deliveredState, deliveredAction, isDelivering] = useActionState(
    markMaintenanceAsDeliveredAction.bind(null, orderId),
    initialState
  );
  const [cancelState, cancelAction, isCanceling] = useActionState(
    cancelMaintenanceOrderAction.bind(null, orderId),
    initialState
  );
  const message =
    statusState.error ||
    statusState.success ||
    deliveredState.error ||
    deliveredState.success ||
    cancelState.error ||
    cancelState.success;
  const isError =
    !!statusState.error || !!deliveredState.error || !!cancelState.error;

  return (
    <div className="grid gap-3 rounded-md border border-line bg-surface p-4 shadow-sm sm:p-5">
      <form action={statusAction} className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-medium text-body">
          Alterar status
          <select
            className="h-11 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft md:text-sm"
            defaultValue={currentStatus}
            name="new_status"
          >
            {maintenanceStatuses.map((status) => (
              <option key={status} value={status}>
                {maintenanceStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Descrição
          <input
            className="h-11 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft md:text-sm"
            name="description"
            placeholder="Opcional"
          />
        </label>

        <button
          className="h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-disabled-bg"
          disabled={isStatusPending}
          type="submit"
        >
          Salvar status
        </button>
      </form>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <form action={deliveredAction} className="grid">
          <button
            className="h-11 rounded-md border border-success-line bg-success-soft px-3 text-sm font-semibold text-success transition hover:bg-success-muted focus:outline-none focus:ring-2 focus:ring-success-focus disabled:cursor-not-allowed disabled:bg-canvas disabled:text-disabled sm:h-9"
            disabled={isDelivering || currentStatus === "entregue"}
            type="submit"
          >
            Marcar como entregue
          </button>
        </form>

        <form action={cancelAction} className="grid">
          <button
            className="h-11 rounded-md border border-danger-line bg-danger-soft px-3 text-sm font-semibold text-danger transition hover:bg-danger-muted focus:outline-none focus:ring-2 focus:ring-danger-focus disabled:cursor-not-allowed disabled:bg-canvas disabled:text-disabled sm:h-9"
            disabled={isCanceling || currentStatus === "cancelado"}
            type="submit"
          >
            Cancelar ordem
          </button>
        </form>
      </div>

      {message ? (
        <p
          role={isError ? "alert" : "status"}
          className={
            isError
              ? "rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
              : "rounded-md border border-success-line bg-success-soft px-3 py-2 text-sm text-success"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
