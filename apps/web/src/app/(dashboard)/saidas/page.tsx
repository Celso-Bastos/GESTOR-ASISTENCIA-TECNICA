import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { productCategories } from "@/lib/products/format";
import { getProductOutflows } from "./actions";
import { ProductOutflowFilters } from "./product-outflow-filters";
import { ProductOutflowTable } from "./product-outflow-table";
import { InventoryNavigation } from "../estoque/inventory-navigation";
import { getInventoryItems } from "../estoque/actions";

type SaidasPageProps = {
  searchParams?: Promise<{
    category?: string;
    q?: string;
    start?: string;
    end?: string;
    month?: string;
  }>;
};

function safeCategory(value?: string) {
  return productCategories.includes(value as never) ? value : undefined;
}

export default async function SaidasPage({ searchParams }: SaidasPageProps) {
  const params = await searchParams;
  const { items: inventory, error: inventoryError } = await getInventoryItems();
  const negativeCount = inventory.filter(item => item.stock_quantity < 0).length;
  const { outflows, filters, error } = await getProductOutflows({
    category: safeCategory(params?.category),
    q: params?.q?.trim() || undefined,
    start: params?.start || undefined,
    end: params?.end || undefined,
    month: params?.month || undefined
  });

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase text-accent">Estoque</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Saidas/Vendas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Registre vendas de acessórios e acompanhe as saídas integradas ao estoque.
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Link
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus sm:w-auto"
            href="/saidas/nova"
          >
            <PackagePlus className="size-4" aria-hidden="true" />
            Nova saida
          </Link>
          <Link
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus sm:w-auto"
            href="/saidas/modelos"
          >
            Produtos cadastrados
          </Link>
        </div>
      </div>

      <InventoryNavigation />
      {inventoryError ? <p role="alert" className="rounded-md bg-danger-soft p-4 text-danger">{inventoryError}</p> : negativeCount > 0 ? <p role="alert" className="rounded-md border border-danger-line bg-danger-soft p-4 text-danger">ESTOQUE NEGATIVO: {negativeCount} produto(s) precisam de conferência. <Link className="underline" href="/estoque">Conferir saldos no estoque</Link></p> : null}
      <ProductOutflowFilters filters={filters} />

      {error ? (
        <p className="rounded-md border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!error && outflows.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-strong bg-surface p-5 text-sm text-muted">
          Nenhuma saida encontrada para os filtros atuais.
        </div>
      ) : null}

      {outflows.length > 0 ? <ProductOutflowTable outflows={outflows} /> : null}
    </section>
  );
}
