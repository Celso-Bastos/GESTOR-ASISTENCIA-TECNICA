"use client";

import { useActionState } from "react";
import { definePasswordAction } from "@/lib/auth/password-actions";

export function DefinePasswordForm() {
  const [state, action, pending] = useActionState(definePasswordAction, {});
  return (
    <form action={action} className="grid gap-4" aria-busy={pending}>
      {[{ name: "password", label: "Nova senha" }, { name: "confirm_password", label: "Confirmar senha" }].map((field) => <label className="grid gap-2 text-sm font-medium text-body" key={field.name}>
        {field.label}
        <input className="h-11 rounded-md border border-line-strong bg-surface px-3 text-base outline-none focus:border-accent-border focus:ring-2 focus:ring-focus-soft" type="password" name={field.name} autoComplete="new-password" minLength={8} maxLength={128} required />
      </label>)}
      <p className="text-sm text-muted">Use pelo menos 8 caracteres e uma senha que você não utiliza em outros serviços.</p>
      {state.error ? <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{state.error}</p> : null}
      <button type="submit" className="min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-disabled-bg" disabled={pending}>{pending ? "Salvando..." : "Definir senha e continuar"}</button>
    </form>
  );
}
