"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCurrencyBRL, productCategories, productCategoryLabels } from "@/lib/products/format";
import { getInventorySummary, getStockStatus, type InventoryItem } from "@/lib/products/inventory";
import { StockStatusBadge } from "./stock-status-badge";

const linkStyle = "inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-body hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus";

export function InventoryOverview({ items }: { items: InventoryItem[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const summary = getInventorySummary(items);
  const filtered = items.filter(item => (!category || item.category === category)
    && (!status || getStockStatus(item.stock_quantity, item.minimum_stock) === status)
    && item.model_name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[["Quantidade total de unidades", summary.units], ["Produtos abaixo do mínimo", summary.belowMinimum], ["Produtos zerados", summary.empty], ["Produtos negativos", summary.negative], ["Valor estimado do estoque", formatCurrencyBRL(summary.value)]].map(([label, value]) =>
        <article key={label} className="min-w-0 rounded-md border border-line bg-surface p-4"><p className="text-sm text-muted">{label}</p><p className="mt-2 break-words text-2xl font-semibold text-foreground">{value}</p></article>)}
    </div>
    <p className="text-sm text-muted">Valor estimado considera apenas quantidades positivas com custo informado. O total de unidades inclui divergências negativas. Produtos inativos também aparecem para conferência.</p>
    {summary.negative > 0 && <p role="alert" className="rounded-md border border-danger-line bg-danger-soft p-4 text-danger">Há {summary.negative} produto(s) com ESTOQUE NEGATIVO. Confira a contagem física e registre um ajuste.</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-2 text-sm text-body">Buscar produto<input value={search} onChange={e => setSearch(e.target.value)} className="h-12 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-foreground" placeholder="Ex.: A05" /></label>
      <label className="grid gap-2 text-sm text-body">Categoria<select value={category} onChange={e => setCategory(e.target.value)} className="h-12 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-foreground"><option value="">Todas</option>{productCategories.map(c => <option key={c} value={c}>{productCategoryLabels[c]}</option>)}</select></label>
      <label className="grid gap-2 text-sm text-body">Status<select value={status} onChange={e => setStatus(e.target.value)} className="h-12 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-foreground"><option value="">Todos</option>{["OK", "BAIXO", "ESGOTADO", "NEGATIVO"].map(s => <option key={s}>{s}</option>)}</select></label>
    </div>
    <div className="grid gap-3">
      {filtered.map(item => <article key={item.id} className="grid min-w-0 gap-4 rounded-md border border-line bg-surface p-4 xl:grid-cols-[minmax(0,1fr)_1fr_auto] xl:items-center">
        <div className="min-w-0"><p className="text-xs text-muted">{productCategoryLabels[item.category]}{!item.is_active ? " · Inativo" : ""}</p><h2 className="mt-1 break-words text-lg font-semibold text-foreground">{item.model_name}</h2><StockStatusBadge quantity={item.stock_quantity} minimum={item.minimum_stock} /></div>
        <dl className="grid grid-cols-2 gap-3 text-sm text-body"><div><dt className="text-muted">Atual / Mínimo</dt><dd className="font-semibold">{item.stock_quantity} / {item.minimum_stock} un.</dd></div><div><dt className="text-muted">Custo / Preço de venda</dt><dd>{item.unit_cost === null ? "Não informado" : formatCurrencyBRL(item.unit_cost)} / {item.default_price === null ? "Não informado" : formatCurrencyBRL(item.default_price)}</dd></div></dl>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:max-w-72">
          <Link className={linkStyle} href={`/estoque/${item.id}?tipo=entry`}>Entrada</Link>
          {item.is_active && <Link className={linkStyle} href={`/saidas/nova?modelo=${item.id}`}>Saída</Link>}
          <Link className={linkStyle} href={`/estoque/${item.id}?tipo=adjustment`}>Ajustar</Link>
          <Link className={linkStyle} href={`/estoque/movimentacoes?modelo=${item.id}`}>Histórico</Link>
          <Link className={linkStyle} href={`/estoque/${item.id}?tipo=opening_balance`}>Definir estoque inicial</Link>
        </div>
      </article>)}
      {!filtered.length && <p className="rounded-md border border-dashed border-line-strong p-5 text-muted">Nenhum produto encontrado. Cadastre produtos em Produtos cadastrados.</p>}
    </div>
  </>;
}
