"use client";

import { useActionState } from "react";
import {
  createInitialOrganization,
  type OrganizationActionState
} from "@/lib/organization/actions";

const initialState: OrganizationActionState = {};

export function OrganizationForm() {
  const [state, formAction, isPending] = useActionState(
    createInitialOrganization,
    initialState
  );

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Nome da loja
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={state.values?.name}
          name="name"
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Slug da loja
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base lowercase text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={state.values?.slug}
          name="slug"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Telefone da loja
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={state.values?.phone}
          name="phone"
          type="tel"
        />
      </label>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        className="h-11 w-fit rounded-md bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Salvando..." : "Criar organizacao"}
      </button>
    </form>
  );
}
