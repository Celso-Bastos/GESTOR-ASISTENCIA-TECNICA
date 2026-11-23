import Link from "next/link";
import { formatStockRestockList, getStockRestock } from "@/lib/products/inventory";
import { productCategoryLabels } from "@/lib/products/format";
import { CopyRestockListButton } from "../../relatorios/reposicao/copy-restock-list-button";
import { getInventoryItems } from "../actions";
import { InventoryNavigation } from "../inventory-navigation";

export default async function InventoryRestockPage() {
  const { items, error } = await getInventoryItems();
  const restock = getStockRestock(items);
  const text = formatStockRestockList(items);
  return <section className="grid gap-5"><h1 className="text-2xl font-semibold text-foreground">Reposição por estoque</h1><InventoryNavigation />
    <p className="text-sm text-muted">Produtos ativos abaixo do mínimo. Sugestão = mínimo − saldo atual, incluindo a correção de saldos negativos. O catálogo atual organiza produtos por categoria; não possui cadastro de marcas.</p>
    <Link href="/relatorios/reposicao" className="min-h-11 py-3 text-accent underline">Consultar histórico mensal de saídas</Link>
    {error ? <p role="alert" className="rounded-md bg-danger-soft p-4 text-danger">{error}</p> : <>
      <CopyRestockListButton text={text} />
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-4 text-sm text-body">{text}</pre>
      {restock.map(item => <article key={item.id} className="grid gap-2 rounded-md border border-line bg-surface p-4 text-body sm:grid-cols-2"><div><p className="text-xs text-muted">{productCategoryLabels[item.category]}</p><h2 className="break-words font-semibold">{item.model_name}</h2></div><p>Atual: {item.stock_quantity} · Mínimo: {item.minimum_stock} · Comprar: <strong>{item.suggested} un.</strong></p><Link className="min-h-11 py-3 text-accent underline" href={`/estoque/${item.id}?tipo=entry`}>Registrar entrada</Link></article>)}
    </>}
  </section>;
}
