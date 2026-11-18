"use client";

import { useActionState } from "react";
import { updateOrganizationServiceCity, type OrganizationActionState } from "@/lib/organization/actions";

const initialState: OrganizationActionState = {};

export function ServiceCityForm({ serviceCity }: { serviceCity: string | null }) {
  const [state, action, pending] = useActionState(updateOrganizationServiceCity, initialState);
  return (
    <form action={action} aria-busy={pending} className="grid max-w-2xl gap-4 rounded-md border border-line bg-surface p-4 shadow-sm">
      <label className="grid gap-2 text-sm font-medium text-body">
        Cidade de serviço
        <input className="h-11 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          name="service_city" autoComplete="address-level2" maxLength={120} placeholder="Ex.: Anajatuba - MA"
          defaultValue={state.values?.service_city ?? serviceCity ?? ""} aria-describedby="service-city-help" />
      </label>
      <p id="service-city-help" className="text-sm text-muted">Informe a cidade principal onde a assistência atende. Ela melhora a precisão da busca dos endereços no Maps. Sem cidade, a busca usa o endereço e Brasil.</p>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-accent">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="min-h-11 w-fit rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-disabled-bg">{pending ? "Salvando..." : "Salvar cidade"}</button>
    </form>
  );
}
