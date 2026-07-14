"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CustomerActionState, CustomerRow } from "./actions";

type CustomerFormProps = {
  action: (
    prevState: CustomerActionState,
    formData: FormData
  ) => Promise<CustomerActionState>;
  customer?: CustomerRow;
  submitLabel: string;
};

const initialState: CustomerActionState = {};

export function CustomerForm({
  action,
  customer,
  submitLabel
}: CustomerFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const name = state.values?.name ?? customer?.name;
  const phone = state.values?.phone ?? customer?.phone;
  const notes = state.values?.notes ?? customer?.notes ?? "";
  const whatsappOptIn =
    state.values?.whatsapp_opt_in ?? customer?.whatsapp_opt_in ?? false;

  return (
    <form action={formAction} className="grid w-full max-w-2xl gap-5">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Nome
        <input
          className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={name}
          name="name"
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Telefone
        <input
          className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={phone}
          inputMode="tel"
          name="phone"
          placeholder="(11) 99999-9999"
          required
          type="tel"
        />
      </label>

      <label className="flex gap-3 rounded-md border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 sm:p-5">
        <input
          className="mt-1 size-5 shrink-0 rounded border-slate-300 text-teal-700"
          defaultChecked={whatsappOptIn}
          name="whatsapp_opt_in"
          type="checkbox"
        />
        <span>
          Cliente aceita receber mensagens da loja pelo WhatsApp sobre
          manutencao, entrega, produtos e promocoes.
        </span>
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Observacoes
        <textarea
          className="min-h-32 rounded-md border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={notes}
          name="notes"
        />
      </label>

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
          href="/clientes"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
