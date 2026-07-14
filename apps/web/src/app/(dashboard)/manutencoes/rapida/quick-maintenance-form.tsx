"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createQuickMaintenanceOrderAction,
  type MaintenanceActionState
} from "../actions";

const initialState: MaintenanceActionState = {};
const inputClass =
  "h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const textareaClass =
  "min-h-32 rounded-md border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

function valueFrom(state: MaintenanceActionState, key: string) {
  return state.values?.[key] ?? "";
}

export function QuickMaintenanceForm() {
  const [state, formAction, isPending] = useActionState(
    createQuickMaintenanceOrderAction,
    initialState
  );

  return (
    <form action={formAction} className="grid w-full max-w-3xl gap-5">
      <fieldset className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <legend className="px-1 text-sm font-semibold text-slate-950">
          Cliente
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Nome do cliente
            <input
              className={inputClass}
              defaultValue={valueFrom(state, "customer_name")}
              name="customer_name"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Telefone/WhatsApp
            <input
              className={inputClass}
              defaultValue={valueFrom(state, "phone")}
              inputMode="tel"
              name="phone"
              required
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <legend className="px-1 text-sm font-semibold text-slate-950">
          Atendimento
        </legend>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Modelo do aparelho
          <input
            className={inputClass}
            defaultValue={valueFrom(state, "device_model")}
            name="device_model"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Defeito informado
          <textarea
            className={textareaClass}
            defaultValue={valueFrom(state, "reported_issue")}
            name="reported_issue"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Previsão de entrega
            <input
              className={inputClass}
              defaultValue={valueFrom(state, "expected_delivery_date")}
              name="expected_delivery_date"
              type="date"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
            Observação rápida
            <textarea
              className={textareaClass}
              defaultValue={valueFrom(state, "quick_notes")}
              name="quick_notes"
            />
          </label>
        </div>
      </fieldset>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <button
          className="h-12 rounded-md bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Salvando..." : "Salvar manutenção"}
        </button>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200"
          href="/manutencoes/nova"
        >
          Usar cadastro completo
        </Link>
      </div>
    </form>
  );
}
