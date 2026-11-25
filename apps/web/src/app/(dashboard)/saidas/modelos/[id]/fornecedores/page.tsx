import Link from "next/link";
import { requireOrganization } from "@/lib/organization/queries";
import { getInventorySupplierData, getSupplierProduct } from "@/lib/inventory-suppliers/queries";
import { canManageSuppliers } from "@/lib/inventory-suppliers/types";
import { ProductSupplierForm, ProductSupplierLinkActions } from "@/components/inventory-supplier-forms";

export default async function ProductSuppliersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organization = await requireOrganization();
  const { product, error } = await getSupplierProduct(id);
  if (error || !product) return <p role="alert" className="text-danger">{error ?? "Produto não encontrado nesta organização."}</p>;
  const data = await getInventorySupplierData({ productIds: [id] });
  const manage = canManageSuppliers(organization.role);
  const byId = new Map(data.suppliers.map(s => [s.id,s]));
  const available = data.suppliers.filter(s => s.is_active && !data.links.some(link => link.supplier_id === s.id)).map(s => ({ id:s.id,name:s.name }));
  return <section className="grid min-w-0 max-w-3xl gap-5 [overflow-wrap:anywhere]">
    <h1 className="text-2xl font-semibold text-foreground">Fornecedores deste produto</h1><p className="text-lg text-body">{product.model_name}</p>
    <Link href="/saidas/modelos" className="min-h-11 py-3 text-accent underline">Voltar aos produtos cadastrados</Link>
    <p className="text-sm text-muted">Vários fornecedores podem oferecer este produto. O preferencial é opcional e não exclui as outras opções. Remover vínculo não exclui o fornecedor.</p>
    {data.error ? <p role="alert" className="text-danger">{data.error}</p> : <>
      {!data.links.length ? <p className="text-muted">Nenhum fornecedor vinculado.</p> : null}
      {data.links.map(link => { const s=byId.get(link.supplier_id); return s ? <article key={link.id} className="grid min-w-0 gap-3 rounded-md border border-line bg-surface p-4">
        <h2 className="font-semibold text-foreground">{s.name}</h2><p className="text-sm text-body">{s.is_active ? "Ativo" : "Inativo — configure um fornecedor ativo"}{link.is_preferred ? " · Preferencial" : ""}</p>
        {manage ? <ProductSupplierLinkActions productId={id} supplierId={s.id} preferred={link.is_preferred} active={s.is_active} /> : null}
      </article> : null; })}
      {manage ? <><ProductSupplierForm productId={id} suppliers={available} /><Link href="/estoque/fornecedores?novo=1#formulario" className="min-h-11 py-3 text-accent underline">Cadastrar fornecedor</Link></> : <p className="text-sm text-muted">Solicite ao owner ou admin qualquer alteração nos vínculos.</p>}
    </>}
  </section>;
}
