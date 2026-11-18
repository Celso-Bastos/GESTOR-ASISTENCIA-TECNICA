"use client";

import { useActionState } from "react";
import { updateOrganizationSite, type OrganizationActionState } from "@/lib/organization/actions";

const initialState: OrganizationActionState = {};

export function OrganizationSiteForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(updateOrganizationSite, initialState);
  return (
    <form action={action} aria-busy={pending} className="grid min-w-0 max-w-2xl gap-4 rounded-md border border-line bg-surface p-4 shadow-sm">
      <label className="grid min-w-0 gap-2 text-sm font-medium text-body">
        Site da loja
        <input className="h-11 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          name="slug" defaultValue={state.values?.slug ?? slug} required
          minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*"
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          aria-describedby="site-help site-kiosk-warning" />
      </label>
      <p id="site-help" className="text-sm text-muted">Identificador do site da loja. Use letras minúsculas sem acentos, números e hífens entre palavras. O site público da loja ainda não está disponível.</p>
      <p id="site-kiosk-warning" className="text-sm text-muted">Alterar este nome muda os links do Quiosque / Tablet. Depois de salvar, gere novamente os links e QR codes usados no atendimento. Alterar o nome da assistência não muda este campo automaticamente.</p>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-accent">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="min-h-11 w-fit rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-disabled-bg">{pending ? "Salvando..." : "Salvar Site da loja"}</button>
    </form>
  );
}
