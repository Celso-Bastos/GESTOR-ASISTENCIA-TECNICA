"use client";

import { useActionState } from "react";
import { approveAccountRequestAction, rejectAccountRequestAction } from "@/lib/account-requests/actions";
import type { AccountRequestActionState } from "@/lib/account-requests/types";

const initialState: AccountRequestActionState = {};

export function ReviewForm({ id }: { id: string }) {
  // Um único formulário compartilha pending entre os dois botões.
  const [state, action, pending] = useActionState(async (previous: AccountRequestActionState, form: FormData) => {
    return form.get("decision") === "reject"
      ? rejectAccountRequestAction(previous, form)
      : approveAccountRequestAction(previous, form);
  }, initialState);

  return (
    <form action={action} className="mt-4 grid gap-3 border-t border-line pt-4" aria-busy={pending}>
      <input name="id" type="hidden" value={id} />
      <label className="grid gap-2 text-sm font-medium text-body">
        Motivo da rejeição (opcional)
        <textarea className="min-h-20 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base outline-none focus:border-accent-border focus:ring-2 focus:ring-focus-soft" name="rejection_reason" maxLength={1000} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button className="min-h-11 flex-1 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus disabled:bg-disabled-bg" type="submit" name="decision" value="approve" disabled={pending || !!state.success}>{pending ? "Processando..." : "Aprovar"}</button>
        <button className="min-h-11 flex-1 rounded-md border border-danger-line-strong bg-surface px-4 py-2 text-sm font-semibold text-danger hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-danger-line disabled:opacity-50" type="submit" name="decision" value="reject" disabled={pending || !!state.success}>Rejeitar</button>
      </div>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-accent-strong">{state.success}</p> : null}
    </form>
  );
}
