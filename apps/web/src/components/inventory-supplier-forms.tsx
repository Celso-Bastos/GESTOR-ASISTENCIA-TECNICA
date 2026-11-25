"use client";

import { useActionState } from "react";
import { formatPhoneBR } from "@/lib/phone";
import { saveInventorySupplier, setInventorySupplierStatus, updateProductSupplier, type SupplierActionState } from "@/lib/inventory-suppliers/actions";
import type { InventorySupplier } from "@/lib/inventory-suppliers/types";

const input = "min-h-11 min-w-0 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-focus";
const button = "min-h-11 w-full rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";
const initial: SupplierActionState = {};
function Message({ state }: { state: SupplierActionState }) {
  return state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p>
    : state.success ? <p role="status" className="text-sm text-accent">{state.success}</p> : null;
}

export function InventorySupplierForm({ supplier }: { supplier?: InventorySupplier }) {
  const [state, action, pending] = useActionState(saveInventorySupplier.bind(null, supplier?.id ?? null), initial);
  const values = state.values ?? { name: supplier?.name ?? "", whatsapp_phone: supplier?.whatsapp_phone ? formatPhoneBR(supplier.whatsapp_phone) : "", notes: supplier?.notes ?? "", is_active: supplier?.is_active ?? true };
  return <form action={action} aria-busy={pending} className="grid min-w-0 gap-4 rounded-md border border-line bg-surface p-4">
    <h2 className="text-lg font-semibold text-foreground">{supplier ? "Editar fornecedor" : "Novo fornecedor"}</h2>
    <label className="grid min-w-0 gap-2 text-sm text-body">Nome do fornecedor *<input className={input} name="name" required maxLength={120} defaultValue={values.name} /></label>
    <label className="grid min-w-0 gap-2 text-sm text-body">WhatsApp<input className={input} name="whatsapp_phone" type="tel" inputMode="tel" maxLength={30} placeholder="(98) 99999-9999" defaultValue={values.whatsapp_phone} /></label>
    <p className="text-sm text-muted">Opcional. O funcionário revisa e confirma o envio da lista dentro do WhatsApp.</p>
    <label className="grid min-w-0 gap-2 text-sm text-body">Observações<textarea className={`${input} min-h-24`} name="notes" maxLength={2000} defaultValue={values.notes} /></label>
    <label className="flex min-h-11 items-center gap-3 text-sm text-body"><input name="is_active" type="checkbox" defaultChecked={values.is_active} />Ativo</label>
    <Message state={state} />
    <button disabled={pending} type="submit" className="min-h-11 w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 sm:w-fit">{pending ? "Salvando..." : "Salvar fornecedor"}</button>
  </form>;
}

export function SupplierStatusForm({ supplierId, active }: { supplierId: string; active: boolean }) {
  const [state, action, pending] = useActionState(setInventorySupplierStatus.bind(null,supplierId), initial);
  return <form action={action} className="grid min-w-0 gap-2"><input type="hidden" name="is_active" value={active ? "false" : "true"} />
    <button type="submit" className={button} disabled={pending}>{pending ? "Salvando..." : active ? "Desativar" : "Ativar"}</button><Message state={state} />
  </form>;
}

export function ProductSupplierForm({ productId, suppliers }: { productId: string; suppliers: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(updateProductSupplier.bind(null,productId), initial);
  return <form action={action} className="grid min-w-0 gap-3 rounded-md border border-line p-3 sm:grid-cols-2">
    <label className="grid min-w-0 gap-2 text-sm text-body">Adicionar fornecedor<select name="supplier_id" required className={input} defaultValue=""><option value="" disabled>Selecione um fornecedor ativo</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <button type="submit" name="operation" value="add" disabled={pending || !suppliers.length} className={`${button} self-end`}>{pending ? "Salvando..." : "Adicionar fornecedor"}</button>
    <div className="sm:col-span-2"><Message state={state} /></div>
  </form>;
}

export function ProductSupplierLinkActions({ productId, supplierId, preferred, active }: { productId: string; supplierId: string; preferred: boolean; active: boolean }) {
  const [state, action, pending] = useActionState(updateProductSupplier.bind(null,productId), initial);
  return <form action={action} className="grid min-w-0 gap-2"><input type="hidden" name="supplier_id" value={supplierId} />
    <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap">
      {active ? <button type="submit" className={button} disabled={pending} name="operation" value={preferred ? "unprefer" : "prefer"}>{preferred ? "Remover preferência" : "Definir preferencial"}</button> : null}
      <button type="submit" className={button} disabled={pending} name="operation" value="remove">Remover vínculo</button>
    </div><Message state={state} />
  </form>;
}
