import Link from "next/link";

export function InventoryNavigation() {
  return <nav aria-label="Estoque" className="flex flex-wrap gap-2">
    {[["/estoque", "Visão geral"], ["/estoque/movimentacoes", "Movimentações"], ["/saidas", "Saídas"], ["/estoque/reposicao", "Reposição"], ["/saidas/modelos", "Produtos cadastrados"], ["/estoque/fornecedores", "Fornecedores"]].map(([href, label]) =>
      <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-body hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus">{label}</Link>)}
  </nav>;
}
