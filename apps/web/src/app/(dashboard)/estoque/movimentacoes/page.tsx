import Link from "next/link";
import { z } from "zod";
import { formatCurrencyBRL } from "@/lib/products/format";
import { inventoryMovementLabels } from "@/lib/products/inventory";
import { getInventoryItems, getInventoryMovements } from "../actions";
import { InventoryNavigation } from "../inventory-navigation";

export default async function InventoryHistoryPage({ searchParams }: {
  searchParams: Promise<{ modelo?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const model = z.string().uuid().safeParse(params.modelo).success ? params.modelo : undefined;
  const page = Math.min(1000000, Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1));
  const [{ movements, hasMore, error }, { items, error: itemsError }] = await Promise.all([getInventoryMovements(model, page), getInventoryItems()]);
  const names = new Map(items.map(item => [item.id, item.model_name]));
  for (const movement of movements) {
    const product = Array.isArray(movement.product_model_templates) ? movement.product_model_templates[0] : movement.product_model_templates;
    if (product) names.set(movement.product_model_template_id, product.model_name);
  }
  const url = (number: number) => `/estoque/movimentacoes?pagina=${number}${model ? `&modelo=${model}` : ""}`;
  return <section className="grid gap-5"><h1 className="text-2xl font-semibold text-foreground">Histórico do estoque</h1><InventoryNavigation />
    <p className="text-sm text-muted">Movimentações são permanentes. Corrija erros com um novo ajuste. Vendas anteriores à atualização continuam no histórico de Saídas.</p>
    <form className="flex flex-wrap gap-3"><label className="grid min-w-0 flex-1 gap-2 text-sm text-body">Produto<select name="modelo" defaultValue={model ?? ""} className="h-12 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-foreground"><option value="">Todos os produtos</option>{items.map(item => <option key={item.id} value={item.id}>{item.model_name}</option>)}</select></label><button className="mt-auto min-h-12 rounded-md bg-teal-700 px-4 font-medium text-white">Filtrar</button></form>
    {error || itemsError ? <p role="alert" className="rounded-md bg-danger-soft p-4 text-danger">{error || itemsError}</p> : <>
      {movements.map(m => <article key={m.id} className="grid min-w-0 gap-2 rounded-md border border-line bg-surface p-4 text-sm text-body">
        <div className="flex flex-wrap justify-between gap-2"><strong className="break-words">{names.get(m.product_model_template_id) ?? "Produto arquivado"}</strong><time dateTime={m.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(m.created_at))}</time></div>
        <p>{inventoryMovementLabels[m.movement_type]}: <strong>{m.quantity > 0 ? "+" : ""}{m.quantity}</strong> un. · {m.quantity_before} → {m.quantity_after}</p>
        <p>Por {m.created_by_name || (m.created_by ? `usuário ${m.created_by.slice(0, 8)}` : "usuário não informado")}{m.unit_cost !== null ? ` · Custo de referência: ${formatCurrencyBRL(m.unit_cost)}` : ""}</p>
        {m.reason && <p className="break-words">Motivo: {m.reason}</p>}{m.notes && <p className="whitespace-pre-wrap break-words">{m.notes}</p>}
        {m.product_outflow_id && <p className="break-all text-xs text-muted">Saída vinculada: {m.product_outflow_id}</p>}
      </article>)}
      {!movements.length && <p className="text-muted">Nenhuma movimentação encontrada.</p>}
      <nav aria-label="Páginas do histórico" className="flex flex-wrap items-center gap-4">{page > 1 && <Link className="min-h-11 py-3 text-accent" href={url(page - 1)}>Anterior</Link>}<span className="text-sm text-muted">Página {page}</span>{hasMore && <Link className="min-h-11 py-3 text-accent" href={url(page + 1)}>Próxima</Link>}</nav>
    </>}
  </section>;
}
