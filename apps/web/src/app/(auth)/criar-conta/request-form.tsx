"use client";

import { useActionState, useRef, useState } from "react";
import { createAccountRequestAction } from "@/lib/account-requests/actions";
import type { AccountRequestActionState } from "@/lib/account-requests/types";

const initialState: AccountRequestActionState = {};
const inputClass = "h-11 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none focus:border-accent-border focus:ring-2 focus:ring-focus-soft";

export function AccountRequestForm() {
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(async (previous: AccountRequestActionState, data: FormData) => {
    // O FormData já capturou os valores. Limpar o DOM imediatamente e não
    // guardar senhas em estado React, storage ou no resultado da action.
    if (passwordRef.current) passwordRef.current.value = "";
    if (confirmationRef.current) confirmationRef.current.value = "";
    setShowPassword(false);
    try { return await createAccountRequestAction(previous, data); }
    finally {
      data.delete("password");
      data.delete("confirm_password");
    }
  }, initialState);
  return (
    <form action={action} className="grid gap-4" aria-busy={pending}>
      <label className="grid gap-2 text-sm font-medium text-body">
        Nome completo *
        <input className={inputClass} name="full_name" autoComplete="name" minLength={3} maxLength={160} required defaultValue={state.values?.full_name} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-body">
        E-mail *
        <input className={inputClass} name="email" type="email" autoComplete="email" maxLength={254} required defaultValue={state.values?.email} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-body">
        Telefone (opcional)
        <input className={inputClass} name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={state.values?.phone} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-body">
        Nome da assistência (opcional)
        <input className={inputClass} name="business_name" autoComplete="organization" maxLength={160} defaultValue={state.values?.business_name} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-body">
        Cidade de serviço *
        <input className={inputClass} name="service_city" autoComplete="address-level2" placeholder="Ex.: Anajatuba - MA" minLength={2} maxLength={120} required defaultValue={state.values?.service_city} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-body" htmlFor="request-password">
        Senha *
        <input id="request-password" ref={passwordRef} className={inputClass} name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required disabled={pending} aria-describedby="password-help" />
      </label>
      <label className="grid gap-2 text-sm font-medium text-body" htmlFor="request-confirm-password">
        Confirmar senha *
        <input id="request-confirm-password" ref={confirmationRef} className={inputClass} name="confirm_password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required disabled={pending} />
      </label>
      <button className="min-h-11 justify-self-start rounded-md px-3 text-sm font-medium text-accent focus:outline-none focus:ring-2 focus:ring-focus" type="button" aria-controls="request-password request-confirm-password" aria-pressed={showPassword} disabled={pending} onClick={() => setShowPassword(!showPassword)}>
        {showPassword ? "Ocultar senhas" : "Mostrar senhas"}
      </button>
      <p id="password-help" className="text-sm text-muted">Use de 8 a 128 caracteres.</p>
      <p className="text-sm leading-6 text-muted">Sua conta será criada como pendente e só poderá acessar o sistema após aprovação.</p>
      <div className="hidden" aria-hidden="true">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state.error ? <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <button className="min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-disabled-bg" disabled={pending} type="submit">
        {pending ? "Enviando..." : "Enviar solicitação"}
      </button>
    </form>
  );
}
