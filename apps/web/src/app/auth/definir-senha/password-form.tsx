"use client";

import { useActionState } from "react";
import { definePasswordAction } from "@/lib/auth/password-actions";

export function DefinePasswordForm() {
  const [state, action, pending] = useActionState(definePasswordAction, {});
  return (
    <form action={action} className="grid gap-4" aria-busy={pending}>
      {[{ name: "password", label: "Nova senha" }, { name: "confirm_password", label: "Confirmar senha" }].map((field) => <label className="grid gap-2 text-sm font-medium text-slate-700" key={field.name}>
        {field.label}
        <input className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" type="password" name={field.name} autoComplete="new-password" minLength={8} maxLength={128} required />
      </label>)}
      <p className="text-sm text-slate-600">Use pelo menos 8 caracteres e uma senha que você não utiliza em outros serviços.</p>
      {state.error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" className="min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-400" disabled={pending}>{pending ? "Salvando..." : "Definir senha e continuar"}</button>
    </form>
  );
}
