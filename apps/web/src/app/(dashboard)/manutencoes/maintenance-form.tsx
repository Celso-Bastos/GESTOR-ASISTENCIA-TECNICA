"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CustomerOption, MaintenanceActionState } from "./actions";
import { CustomerSelect } from "./customer-select";
import { DeviceFormFields } from "./device-form-fields";

type MaintenanceFormProps = {
  action: (
    prevState: MaintenanceActionState,
    formData: FormData
  ) => Promise<MaintenanceActionState>;
  customers?: CustomerOption[];
  initialValues?: Record<string, string | undefined>;
  mode: "create" | "edit";
  submitLabel: string;
};

const initialState: MaintenanceActionState = {};
const inputClass =
  "h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const textareaClass =
  "min-h-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

function valueFrom(
  state: MaintenanceActionState,
  initialValues: Record<string, string | undefined> | undefined,
  key: string
) {
  return state.values?.[key] ?? initialValues?.[key] ?? "";
}

export function MaintenanceForm({
  action,
  customers = [],
  initialValues,
  mode,
  submitLabel
}: MaintenanceFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const values = {
    customer_id: valueFrom(state, initialValues, "customer_id"),
    brand: valueFrom(state, initialValues, "brand"),
    model: valueFrom(state, initialValues, "model"),
    color: valueFrom(state, initialValues, "color"),
    storage: valueFrom(state, initialValues, "storage"),
    imei: valueFrom(state, initialValues, "imei"),
    device_notes: valueFrom(state, initialValues, "device_notes"),
    reported_issue: valueFrom(state, initialValues, "reported_issue"),
    diagnosis: valueFrom(state, initialValues, "diagnosis"),
    expected_delivery_date: valueFrom(
      state,
      initialValues,
      "expected_delivery_date"
    ),
    estimated_price: valueFrom(state, initialValues, "estimated_price"),
    final_price: valueFrom(state, initialValues, "final_price"),
    internal_notes: valueFrom(state, initialValues, "internal_notes")
  };

  return (
    <form action={formAction} className="grid max-w-4xl gap-5">
      {mode === "create" ? (
        <fieldset className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-slate-950">
            Cliente
          </legend>
          <CustomerSelect
            customers={customers}
            defaultCustomerId={values.customer_id}
          />
        </fieldset>
      ) : null}

      <DeviceFormFields values={values} />

      <fieldset className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <legend className="px-1 text-sm font-semibold text-slate-950">
          Ordem de serviço
        </legend>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Defeito relatado
          <textarea
            className={textareaClass}
            defaultValue={values.reported_issue}
            name="reported_issue"
            required
          />
        </label>

        {mode === "edit" ? (
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Diagnóstico
            <textarea
              className={textareaClass}
              defaultValue={values.diagnosis}
              name="diagnosis"
            />
          </label>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Previsão de entrega
            <input
              className={inputClass}
              defaultValue={values.expected_delivery_date}
              name="expected_delivery_date"
              type="date"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Valor estimado
            <input
              className={inputClass}
              defaultValue={values.estimated_price}
              inputMode="decimal"
              min="0"
              name="estimated_price"
              step="0.01"
              type="number"
            />
          </label>

          {mode === "edit" ? (
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Valor final
              <input
                className={inputClass}
                defaultValue={values.final_price}
                inputMode="decimal"
                min="0"
                name="final_price"
                step="0.01"
                type="number"
              />
            </label>
          ) : null}
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Observações internas
          <textarea
            className={textareaClass}
            defaultValue={values.internal_notes}
            name="internal_notes"
          />
        </label>
      </fieldset>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          className="h-11 rounded-md bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Salvando..." : submitLabel}
        </button>
        <Link
          className="inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          href={mode === "create" ? "/manutencoes" : "../"}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
