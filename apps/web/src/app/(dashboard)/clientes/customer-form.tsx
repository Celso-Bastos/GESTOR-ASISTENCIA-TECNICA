"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { GoogleMapsAddressLink } from "@/components/google-maps-address-link";
import { getTodayCivilDate } from "@/lib/civil-date";
import type { CustomerActionState, CustomerRow } from "./actions";

type CustomerFormProps = {
  action: (
    prevState: CustomerActionState,
    formData: FormData
  ) => Promise<CustomerActionState>;
  customer?: CustomerRow;
  submitLabel: string;
  serviceCity?: string | null;
};

const initialState: CustomerActionState = {};

export function CustomerForm({
  action,
  customer,
  submitLabel,
  serviceCity
}: CustomerFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const name = state.values?.name ?? customer?.name;
  const phone = state.values?.phone ?? customer?.phone ?? "";
  const [address, setAddress] = useState(state.values?.address ?? customer?.address ?? "");
  const birthDate = state.values?.birth_date ?? customer?.birth_date ?? "";
  const notes = state.values?.notes ?? customer?.notes ?? "";
  const whatsappOptIn =
    state.values?.whatsapp_opt_in ?? customer?.whatsapp_opt_in ?? false;

  return (
    <form action={formAction} aria-busy={isPending} className="grid w-full max-w-2xl gap-5">
      <label className="grid gap-2 text-sm font-medium text-body">
        Nome
        <input
          className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          defaultValue={name}
          name="name"
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-body">
        Telefone (opcional)
        <input
          className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          defaultValue={phone}
          inputMode="tel"
          name="phone"
          placeholder="(11) 99999-9999"
          type="tel"
        />
      </label>

      <div className="grid min-w-0 gap-2">
        <label className="grid gap-2 text-sm font-medium text-body">
          Endereço (opcional)
          <textarea
            autoComplete="street-address"
            className="min-h-24 min-w-0 rounded-md border border-line-strong bg-surface px-3 py-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={300}
            name="address"
            rows={2}
          />
        </label>
        <GoogleMapsAddressLink address={address} serviceCity={serviceCity} />
      </div>

      <label className="grid gap-2 text-sm font-medium text-body">
        Data de aniversário (opcional)
        <input
          autoComplete="bday"
          className="h-12 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          defaultValue={birthDate}
          max={getTodayCivilDate()}
          min="0001-01-01"
          name="birth_date"
          type="date"
        />
      </label>

      <label className="flex gap-3 rounded-md border border-line bg-surface p-4 text-sm leading-6 text-body sm:p-5">
        <input
          className="mt-1 size-5 shrink-0 rounded border-line-strong text-accent"
          defaultChecked={whatsappOptIn}
          name="whatsapp_opt_in"
          type="checkbox"
        />
        <span>
          Cliente aceita receber mensagens da loja pelo WhatsApp sobre
          manutencao, entrega, produtos e promocoes.
        </span>
      </label>

      <label className="grid gap-2 text-sm font-medium text-body">
        Observacoes
        <textarea
          className="min-h-32 rounded-md border border-line-strong bg-surface px-3 py-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          defaultValue={notes}
          name="notes"
        />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <button
          className="h-12 rounded-md bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-disabled-bg"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Salvando..." : submitLabel}
        </button>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-md border border-line-strong bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
          href="/clientes"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
