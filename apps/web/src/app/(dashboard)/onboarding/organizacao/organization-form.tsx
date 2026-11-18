"use client";

import { useActionState, useState } from "react";
import { suggestOrganizationSlug } from "@/lib/organization/slug";
import {
  createInitialOrganization,
  type OrganizationActionState
} from "@/lib/organization/actions";

const initialState: OrganizationActionState = {};

export function OrganizationForm({ serviceCity }: { serviceCity: string | null }) {
  const [state, formAction, isPending] = useActionState(
    createInitialOrganization,
    initialState
  );
  const [site, setSite] = useState({ value: "", manuallyEdited: false });

  return (
    <form action={formAction} aria-busy={isPending} className="grid min-w-0 max-w-xl gap-4">
      <label className="grid gap-2 text-sm font-medium text-body">
        Nome da loja
        <input
          className="h-11 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          defaultValue={state.values?.name}
          name="name"
          onChange={(event) => {
            const name = event.target.value;
            setSite((current) => current.manuallyEdited
              ? current
              : { value: suggestOrganizationSlug(name), manuallyEdited: false });
          }}
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-body">
        Site da loja
        <input
          className="h-11 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          value={site.value}
          onChange={(event) => setSite({ value: event.target.value, manuallyEdited: true })}
          name="slug"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          minLength={3}
          maxLength={60}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="minha-loja"
          aria-describedby="organization-site-help"
          required
        />
        <span id="organization-site-help" className="text-sm font-normal text-muted">
          Identificador do site da loja. Sugerimos um nome automaticamente; você pode ajustá-lo usando letras minúsculas sem acentos, números e hífens. O site público da loja ainda não está disponível.
        </span>
      </label>

      <label className="grid gap-2 text-sm font-medium text-body">
        Telefone da loja
        <input
          className="h-11 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          defaultValue={state.values?.phone}
          name="phone"
          type="tel"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-body">
        Cidade de serviço *
        <input
          className="h-11 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          name="service_city"
          defaultValue={state.values?.service_city ?? serviceCity ?? ""}
          placeholder="Ex.: Anajatuba - MA"
          autoComplete="address-level2"
          minLength={2}
          maxLength={120}
          required
        />
        <span className="text-sm font-normal text-muted">Confira a cidade principal onde a assistência atende.</span>
      </label>

      {state.error ? (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        className="h-11 w-fit rounded-md bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-disabled-bg"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Salvando..." : "Criar organizacao"}
      </button>
    </form>
  );
}
