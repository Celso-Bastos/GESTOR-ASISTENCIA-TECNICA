"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  maintenanceStatusLabels,
  maintenanceStatuses
} from "@/lib/maintenance/status";
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
  requestId?: string;
};

const initialState: MaintenanceActionState = {};
const inputClass =
  "h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const textareaClass =
  "min-h-32 rounded-md border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

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
  submitLabel,
  requestId
}: MaintenanceFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [customerMode, setCustomerMode] = useState("existing");

  const values = {
    customer_id: valueFrom(state, initialValues, "customer_id"),
    customer_name: valueFrom(state, initialValues, "customer_name"),
    customer_phone: valueFrom(state, initialValues, "customer_phone"),
    brand: valueFrom(state, initialValues, "brand"),
    model: valueFrom(state, initialValues, "model"),
    color: valueFrom(state, initialValues, "color"),
    storage: valueFrom(state, initialValues, "storage"),
    imei: valueFrom(state, initialValues, "imei"),
    device_notes: valueFrom(state, initialValues, "device_notes"),
    reported_issue: valueFrom(state, initialValues, "reported_issue"),
    diagnosis: valueFrom(state, initialValues, "diagnosis"),
    status: valueFrom(state, initialValues, "status"),
    expected_delivery_date: valueFrom(
      state,
      initialValues,
      "expected_delivery_date"
    ),
    delivered_at: valueFrom(state, initialValues, "delivered_at"),
    estimated_price: valueFrom(state, initialValues, "estimated_price"),
    final_price: valueFrom(state, initialValues, "final_price"),
    internal_notes: valueFrom(state, initialValues, "internal_notes"),
    warranty_enabled: valueFrom(state, initialValues, "warranty_enabled"),
    warranty_signed: valueFrom(state, initialValues, "warranty_signed"),
    warranty_amount: valueFrom(state, initialValues, "warranty_amount"),
    warranty_unit: valueFrom(state, initialValues, "warranty_unit"),
    warranty_started_at: valueFrom(state, initialValues, "warranty_started_at"),
    warranty_notes: valueFrom(state, initialValues, "warranty_notes")
  };

  return (
    <form action={formAction} className="grid w-full max-w-4xl gap-5">
      {mode === "create" ? <input type="hidden" name="request_id" value={state.values?.request_id ?? requestId} /> : null}
      {mode === "create" ? (
        <fieldset className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <legend className="px-1 text-sm font-semibold text-slate-950">
            Cliente
          </legend>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Como identificar o cliente
            <select name="customer_mode" className={inputClass} value={customerMode} onChange={(event) => setCustomerMode(event.target.value)}>
              <option value="existing">Cliente existente</option>
              <option value="new">Novo cliente</option>
            </select>
          </label>
          <div hidden={customerMode !== "existing"}>
            <CustomerSelect customers={customers} defaultCustomerId={values.customer_id} disabled={customerMode !== "existing"} />
          </div>
          <fieldset disabled={customerMode !== "new"} className={customerMode === "new" ? "grid gap-3" : "hidden"}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">Nome do novo cliente
              <input className={inputClass} name="customer_name" defaultValue={values.customer_name} required minLength={2} maxLength={120} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">Telefone/WhatsApp (opcional)
              <input className={inputClass} name="customer_phone" defaultValue={values.customer_phone} type="tel" inputMode="tel" />
            </label>
            <p className="text-sm text-slate-600">O cliente será cadastrado ao salvar a OS. Se o telefone já existir, o cadastro existente será utilizado.</p>
          </fieldset>
        </fieldset>
      ) : null}

      {mode === "edit" ? (
        <fieldset className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <legend className="px-1 text-sm font-semibold text-slate-950">
            Cliente
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Nome do cliente
              <input
                className={inputClass}
                defaultValue={values.customer_name}
                name="customer_name"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Telefone/WhatsApp
              <input
                className={inputClass}
                defaultValue={values.customer_phone}
                inputMode="tel"
                name="customer_phone"
                type="tel"
              />
            </label>
          </div>
        </fieldset>
      ) : null}

      <DeviceFormFields values={values} />

      <fieldset className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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

        {mode === "edit" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Status
              <select
                className={inputClass}
                defaultValue={values.status}
                name="status"
                required
              >
                {maintenanceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {maintenanceStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Entregue em
              <input
                className={inputClass}
                defaultValue={values.delivered_at}
                name="delivered_at"
                type="datetime-local"
              />
            </label>
          </div>
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

      <fieldset className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <legend className="px-1 text-sm font-semibold text-slate-950">
          Garantia
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
            <input
              className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-200"
              defaultChecked={values.warranty_enabled === "on"}
              name="warranty_enabled"
              type="checkbox"
            />
            Ativar garantia
          </label>

          <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
            <input
              className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-200"
              defaultChecked={values.warranty_signed === "on"}
              name="warranty_signed"
              type="checkbox"
            />
            Cliente assinou/aceitou garantia
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Quantidade
            <input
              className={inputClass}
              defaultValue={values.warranty_amount}
              inputMode="numeric"
              min="1"
              name="warranty_amount"
              step="1"
              type="number"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Unidade
            <select
              className={inputClass}
              defaultValue={values.warranty_unit}
              name="warranty_unit"
            >
              <option value="">Selecione</option>
              <option value="days">Dias</option>
              <option value="months">Meses</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Data de inicio
            <input
              className={inputClass}
              defaultValue={values.warranty_started_at}
              name="warranty_started_at"
              type="date"
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Observacao da garantia
          <textarea
            className={textareaClass}
            defaultValue={values.warranty_notes}
            name="warranty_notes"
          />
        </label>
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
          {isPending ? "Salvando..." : submitLabel}
        </button>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200"
          href={mode === "create" ? "/manutencoes" : "../"}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
