import Link from "next/link";
import { requireOrganization } from "@/lib/organization/queries";
import { getInventorySupplierData } from "@/lib/inventory-suppliers/queries";
import { canManageSuppliers } from "@/lib/inventory-suppliers/types";
import { formatPhoneBR } from "@/lib/phone";
import { InventorySupplierForm, SupplierStatusForm } from "@/components/inventory-supplier-forms";
import { InventoryNavigation } from "../inventory-navigation";

export default async function InventorySuppliersPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<Record<string,string | string[] | undefined>> }) {
  const organization = await requireOrganization();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0,120) : "";
  const data = await getInventorySupplierData();
  const manage = canManageSuppliers(organization.role);
  const edit = typeof params.editar === "string" ? data.suppliers.find(s => s.id === params.editar) : undefined;
  const counts = new Map<string,number>();
  for (const link of data.links) counts.set(link.supplier_id,(counts.get(link.supplier_id) ?? 0)+1);
  const suppliers = data.suppliers.filter(s => s.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  return <section className="grid min-w-0 gap-5 [overflow-wrap:anywhere]">
    <h1 className="text-2xl font-semibold text-foreground">Fornecedores</h1><InventoryNavigation />
    <p className="text-sm text-muted">Um produto pode ter vários fornecedores. Desativar preserva os vínculos e retira o fornecedor das opções de compra.</p>
    {data.error ? <p role="alert" className="text-danger">{data.error}</p> : <>
      {manage ? <Link href="/estoque/fornecedores?novo=1#formulario" className="min-h-11 w-fit py-3 text-accent underline">Novo fornecedor</Link> : <p className="text-sm text-muted">Somente owner ou admin pode cadastrar, editar e configurar fornecedores.</p>}
      {manage && (params.novo === "1" || edit) ? <div id="formulario" className="min-w-0"><InventorySupplierForm key={edit?.id ?? "new"} supplier={edit} /></div> : null}
      {params.editar && !edit ? <p role="alert" className="text-danger">Fornecedor não encontrado nesta organização.</p> : null}
      <form method="get" className="grid min-w-0 gap-3 sm:flex"><label className="grid min-w-0 flex-1 gap-2 text-sm text-body">Buscar fornecedor<input name="q" maxLength={120} defaultValue={query} className="min-h-11 min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground" /></label><button className="min-h-11 rounded-md border border-line-strong bg-surface px-4 text-body sm:self-end">Buscar</button></form>
      {!suppliers.length ? <p className="text-muted">Nenhum fornecedor encontrado.</p> : null}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">{suppliers.map(s => <article key={s.id} className="grid min-w-0 gap-3 rounded-md border border-line bg-surface p-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 text-lg font-semibold text-foreground">{s.name}</h2><span className={`rounded-md border px-2 py-1 text-xs ${s.is_active ? "border-success-line bg-success-soft text-success" : "border-line bg-surface-muted text-muted"}`}>{s.is_active ? "Ativo" : "Inativo"}</span></div>
        <p className="text-sm text-body">WhatsApp: {s.whatsapp_phone ? formatPhoneBR(s.whatsapp_phone) : "Não configurado"}</p>
        <p className="text-sm text-body">{counts.get(s.id) ?? 0} produtos vinculados</p>
        {s.notes ? <p className="whitespace-pre-wrap text-sm text-muted">{s.notes}</p> : null}
        <div className="grid gap-2 sm:flex sm:flex-wrap"><Link href={`/estoque/fornecedores/${s.id}`} className="min-h-11 py-3 text-accent underline">Ver produtos</Link>
          {manage ? <Link href={`/estoque/fornecedores?editar=${s.id}#formulario`} className="min-h-11 py-3 text-accent underline">Editar</Link> : null}</div>
        {manage ? <SupplierStatusForm supplierId={s.id} active={s.is_active} /> : null}
      </article>)}</div>
    </>}
  </section>;
}
