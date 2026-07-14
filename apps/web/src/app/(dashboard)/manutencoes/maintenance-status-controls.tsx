"use client";

import { useActionState } from "react";
import {
  maintenanceStatusLabels,
  maintenanceStatuses,
  type MaintenanceStatus
} from "@/lib/maintenance/status";
import {
  cancelMaintenanceOrderAction,
  markMaintenanceAsDeliveredAction,
  updateMaintenanceStatusAction,
  type MaintenanceActionState
} from "./actions";

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
    <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <form action={statusAction} className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Alterar status
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 md:text-sm"
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

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Descrição
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 md:text-sm"
            name="description"
            placeholder="Opcional"
          />
        </label>

        <button
          className="h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isStatusPending}
          type="submit"
        >
          Salvar status
        </button>
      </form>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <form action={deliveredAction} className="grid">
          <button
            className="h-11 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:h-9"
            disabled={isDelivering || currentStatus === "entregue"}
            type="submit"
          >
            Marcar como entregue
          </button>
        </form>

        <form action={cancelAction} className="grid">
          <button
            className="h-11 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:h-9"
            disabled={isCanceling || currentStatus === "cancelado"}
            type="submit"
          >
            Cancelar ordem
          </button>
        </form>
      </div>

      {message ? (
        <p
          className={
            isError
              ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
