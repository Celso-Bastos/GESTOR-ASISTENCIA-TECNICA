"use client";

import { useActionState, useState } from "react";
import { inventoryMovementLabels } from "@/lib/products/inventory";
import { registerInventoryMovementAction, type InventoryActionState } from "./actions";

const inputClass = "h-12 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-focus";

export function InventoryMovementForm({ item, initialType, hasOpening }: {
  item: { id: string }; initialType: "entry" | "adjustment" | "opening_balance"; hasOpening: boolean;
}) {
  const [selectedType, setType] = useState(initialType);
  const type = selectedType === "opening_balance" && hasOpening ? "adjustment" : selectedType;
  const [state, action, pending] = useActionState(registerInventoryMovementAction, {} as InventoryActionState);
  return <form action={action} className="grid max-w-2xl gap-4 rounded-md border border-line bg-surface p-4 sm:p-5">
    <input type="hidden" name="model_id" value={item.id} />
    <label className="grid gap-2 text-sm text-body">Operação<select className={inputClass} name="movement_type" value={type} onChange={e => setType(e.target.value as typeof type)}>
      {!hasOpening && <option value="opening_balance">Definir estoque inicial</option>}<option value="entry">Registrar entrada</option><option value="adjustment">Ajustar estoque</option>
    </select></label>
    <p className="text-sm text-muted">{type === "entry" ? "Informe a quantidade que chegou. Ela será somada ao saldo atual." : "Informe a contagem física final. O banco calculará a diferença e preservará o histórico."}{hasOpening ? " Estoque inicial já definido; correções devem ser ajustes." : " As saídas antigas não foram usadas para reconstruir o saldo."}</p>
    <label className="grid gap-2 text-sm text-body">{type === "entry" ? "Quantidade de entrada" : "Quantidade real (contagem física)"}<input key={type} className={inputClass} name="quantity" type="number" min={type === "entry" ? 1 : 0} max={2147483647} step={1} required /></label>
    <label className="grid gap-2 text-sm text-body">Custo unitário de referência (opcional)<input className={inputClass} name="unit_cost" inputMode="decimal" placeholder="3,50" /></label>
    <p className="text-xs text-muted">Preencher o custo atualiza a referência do produto. Em branco, mantém o custo atual.</p>
    <label className="grid gap-2 text-sm text-body">Motivo {type === "adjustment" ? "(obrigatório)" : "(opcional)"}<input className={inputClass} name="reason" maxLength={200} required={type === "adjustment"} placeholder={type === "adjustment" ? "Contagem física" : "Reposição"} /></label>
    <label className="grid gap-2 text-sm text-body">Observação<textarea name="notes" maxLength={1000} className="min-h-24 rounded-md border border-line-strong bg-surface p-3 text-foreground focus:ring-2 focus:ring-focus" /></label>
    {state.error && <p role="alert" className="rounded-md bg-danger-soft p-3 text-danger">{state.error}</p>}
    {state.success && <p role="status" className="rounded-md bg-success-soft p-3 text-success">{state.success}</p>}
    <button type="submit" disabled={pending} className="min-h-12 rounded-md bg-teal-700 px-4 font-semibold text-white hover:bg-teal-800 focus:ring-2 focus:ring-focus disabled:opacity-50">{pending ? "Registrando..." : inventoryMovementLabels[type]}</button>
  </form>;
}
