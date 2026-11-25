import Link from "next/link";
import { getInventorySupplierData } from "@/lib/inventory-suppliers/queries";
import { getInventoryItems } from "../../actions";
import { InventoryNavigation } from "../../inventory-navigation";
import { productCategoryLabels } from "@/lib/products/format";
import { supplierIdSchema } from "@/lib/inventory-suppliers/validation";

export default async function SupplierProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supplierIdSchema.safeParse(id).success) return <p role="alert" className="text-danger">Fornecedor inválido.</p>;
  const data = await getInventorySupplierData({ supplierId: id });
  const supplier = data.suppliers.find(s => s.id === id);
  if (data.error || !supplier) return <p role="alert" className="text-danger">{data.error ?? "Fornecedor não encontrado nesta organização."}</p>;
  const inventory = await getInventoryItems();
  const byProduct = new Map(data.links.map(link => [link.product_model_id,link]));
  const products = inventory.items.filter(item => byProduct.has(item.id));
  return <section className="grid min-w-0 gap-5 [overflow-wrap:anywhere]"><h1 className="text-2xl font-semibold text-foreground">Produtos de {supplier.name}</h1><InventoryNavigation />
    <p className="text-sm text-muted">{supplier.is_active ? "Fornecedor ativo" : "Fornecedor inativo: vínculos preservados, indisponível para novas compras."}</p>
    {supplier.is_active ? <Link className="min-h-11 py-3 text-accent underline" href={`/estoque/reposicao?fornecedor=${id}`}>Ver reposição deste fornecedor</Link> : null}
    {inventory.error ? <p role="alert" className="text-danger">{inventory.error}</p> : <>
      <p className="text-body">{products.length} produtos no catálogo atual</p>
      {!products.length ? <p className="text-muted">Nenhum produto vinculado no catálogo atual.</p> : null}
      {products.map(item => <article key={item.id} className="grid min-w-0 gap-2 rounded-md border border-line bg-surface p-4 text-body">
        <h2 className="font-semibold text-foreground">{item.model_name}</h2><p>{productCategoryLabels[item.category]} · {item.is_active ? "Produto ativo" : "Produto inativo"}{byProduct.get(item.id)?.is_preferred ? " · Preferencial" : ""}</p>
        <Link className="min-h-11 py-3 text-accent underline" href={`/saidas/modelos/${item.id}/fornecedores`}>Fornecedores deste produto</Link>
      </article>)}
    </>}
  </section>;
}
