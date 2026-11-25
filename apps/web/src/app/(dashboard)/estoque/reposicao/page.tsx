import Link from "next/link";
import { getStockRestock } from "@/lib/products/inventory";
import { productCategories, productCategoryLabels } from "@/lib/products/format";
import { getInventorySupplierData } from "@/lib/inventory-suppliers/queries";
import { getSupplierRestock, getRestockIndicators, formatSupplierRestockList } from "@/lib/inventory-suppliers/restock";
import { getRestockWhatsAppLink } from "@/lib/products/restock-whatsapp";
import { replenishmentWhatsAppPhoneSchema } from "@/lib/validations/replenishment-whatsapp";
import { CopyRestockListButton } from "../../relatorios/reposicao/copy-restock-list-button";
import { RestockShareControls } from "./restock-share-controls";
import { getInventoryItems } from "../actions";
import { InventoryNavigation } from "../inventory-navigation";

type Params = Record<string, string | string[] | undefined>;
const field = "min-h-11 min-w-0 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-foreground";
export default async function InventoryRestockPage(props: { searchParams?: Promise<Params> }) {
  const params = await (props?.searchParams ?? Promise.resolve({} as Params));
  const value = (key: string) => typeof params[key] === "string" ? params[key].slice(0,120) : "";
  const view = ["categorias","fornecedores","sem-fornecedor"].includes(value("visao")) ? value("visao") : "todos";
  const category = value("categoria"), supplierId = value("fornecedor"), search = value("q");
  const inventory = await getInventoryItems();
  const data = inventory.error ? { suppliers: [], links: [], error: undefined } : await getInventorySupplierData({ productIds: getStockRestock(inventory.items).map(item => item.id) });
  const supplier = data.suppliers.find(s => s.id === supplierId && s.is_active);
  const invalidSupplier = Boolean(supplierId && !supplier);
  const all = getSupplierRestock(inventory.items,data.suppliers,data.links);
  const rows = invalidSupplier ? [] : getSupplierRestock(inventory.items,data.suppliers,data.links,{category,supplierId,search,withoutSupplier:view === "sem-fornecedor"});
  const indicators = getRestockIndicators(rows);
  const text = formatSupplierRestockList(rows);
  const phone = replenishmentWhatsAppPhoneSchema.safeParse(supplier?.whatsapp_phone ?? "");
  const link = getRestockWhatsAppLink(phone.success ? phone.data : null,text,rows.length > 0);
  const summaryView = !supplierId && ((view === "fornecedores") || (view === "categorias" && !category));
  const error = inventory.error || data.error;
  function url(filters: Record<string,string>) { const query = new URLSearchParams(filters); return `/estoque/reposicao?${query.toString()}`; }
  return <section className="grid min-w-0 gap-5 [overflow-wrap:anywhere]">
    <h1 className="text-2xl font-semibold text-foreground">Reposição por estoque</h1><InventoryNavigation />
    <p className="text-sm text-muted">Produtos ativos abaixo do mínimo. Repor = mínimo − saldo atual, inclusive saldo negativo. A lista é um retrato do carregamento; atualize a página após novas movimentações.</p>
    <nav aria-label="Visões de reposição" className="flex flex-wrap gap-2">{[["todos","Todos"],["categorias","Categorias"],["fornecedores","Fornecedores"],["sem-fornecedor","Sem fornecedor"]].map(([key,label]) => <Link key={key} href={url({visao:key})} aria-current={view===key && !supplierId ? "page" : undefined} className="min-h-11 rounded-md border border-line-strong bg-surface px-3 py-3 text-sm font-semibold text-body aria-[current=page]:bg-accent-soft">{label}</Link>)}</nav>
    <Link href="/relatorios/reposicao" className="min-h-11 py-3 text-accent underline">Consultar histórico mensal de saídas</Link>
    {error ? <p role="alert" className="rounded-md bg-danger-soft p-4 text-danger">{error} Não foi gerada uma lista parcial.</p> : <>
      <form method="get" className="grid min-w-0 gap-3 rounded-md border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="visao" value={view} />
        <label className="grid min-w-0 gap-2 text-sm text-body">Categoria<select className={field} name="categoria" defaultValue={category}><option value="">Todas as categorias</option>{productCategories.map(c=><option key={c} value={c}>{productCategoryLabels[c]}</option>)}</select></label>
        <label className="grid min-w-0 gap-2 text-sm text-body">Fornecedor<select className={field} name="fornecedor" defaultValue={supplierId}><option value="">Todos os fornecedores</option>{data.suppliers.filter(s=>s.is_active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="grid min-w-0 gap-2 text-sm text-body">Buscar modelo ou fornecedor<input className={field} name="q" maxLength={120} defaultValue={search} /></label>
        <button className="min-h-11 rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-body sm:self-end">Filtrar</button>
        <Link href="/estoque/reposicao" className="min-h-11 py-3 text-sm text-accent underline">Limpar filtros</Link>
      </form>
      {invalidSupplier ? <p role="alert" className="text-danger">Fornecedor não encontrado ou inativo nesta organização. Escolha um fornecedor ativo.</p> : null}
      {supplier ? <div className="grid min-w-0 gap-2"><h2 className="text-xl font-semibold text-foreground">{supplier.name}</h2><p className="text-sm text-muted">Um produto pode aparecer em outros fornecedores. A quantidade não é dividida. Confira onde comprar para evitar compras duplicadas.</p></div> : null}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Modelos para repor",indicators.models],["Unidades sugeridas",indicators.units],["Categorias afetadas",indicators.categories],["Sem fornecedor ativo",indicators.withoutSupplier]].map(([label,count])=><div key={label} className="min-w-0 rounded-md border border-line bg-surface p-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-xl font-semibold text-foreground">{count}</dd></div>)}</dl>
      {supplier && (!phone.success || !phone.data) ? <div className="grid gap-2 rounded-md border border-warning-line bg-warning-soft p-4 text-sm text-warning-strong"><p>WhatsApp não configurado para este fornecedor.</p><Link className="min-h-11 w-fit py-3 underline" href={`/estoque/fornecedores?editar=${supplier.id}#formulario`}>Editar fornecedor</Link><p>Somente owner ou admin pode alterar o cadastro.</p></div> : null}
      {supplier ? <RestockShareControls key={supplier.id} text={text} url={link.url} hasItems={rows.length>0} tooLong={link.tooLong} /> : !invalidSupplier ? <CopyRestockListButton text={rows.length ? text : ""} label="Copiar lista" secondary /> : null}
      {!all.length ? <p className="text-muted">Nenhum produto precisa de reposição no momento.</p> : !rows.length && !invalidSupplier ? <p className="text-muted">Nenhum produto precisa de reposição neste filtro.</p> : null}
      {view === "sem-fornecedor" ? <p className="text-sm text-muted">{rows.length} produtos precisam de fornecedor ativo. Vínculos com fornecedores inativos são preservados.</p> : null}
      {!supplierId && view === "fornecedores" ? <>
        <p className="text-sm text-muted">Os totais acima contam cada produto uma vez. Totais de fornecedores podem se sobrepor: escolha onde comprar antes de enviar.</p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">{data.suppliers.filter(s=>s.is_active).map(s=>{
          const group=rows.filter(item=>item.suppliers.some(available=>available.id===s.id));
          if(!group.length)return null;
          return <Link key={s.id} href={url({visao:"fornecedores",fornecedor:s.id,categoria:category,q:search})} className="grid min-w-0 gap-2 rounded-md border border-line bg-surface p-4 text-body"><strong className="text-foreground">{s.name}</strong><span>{group.length} modelos para reposição · {group.reduce((n,item)=>n+item.suggested,0)} unidades</span><span className="text-accent underline">Ver lista do fornecedor</span></Link>;
        })}</div><Link href={url({visao:"sem-fornecedor",categoria:category,q:search})} className="min-h-11 py-3 text-accent underline">Ver itens sem fornecedor ativo</Link>
      </> : null}
      {!supplierId && view === "categorias" && !category ? <div className="grid min-w-0 gap-3 sm:grid-cols-2">{productCategories.map(c=>{
        const group=rows.filter(item=>item.category===c);if(!group.length)return null;
        return <Link key={c} href={url({visao:"categorias",categoria:c,q:search})} className="grid min-w-0 gap-2 rounded-md border border-line bg-surface p-4 text-body"><strong>{productCategoryLabels[c]}</strong><span>Modelos: {group.length} · Unidades sugeridas: {group.reduce((n,item)=>n+item.suggested,0)}</span></Link>;
      })}</div> : null}
      {!summaryView && rows.length>0 ? <>
        {category && productCategories.some(c=>c===category) ? <h2 className="font-semibold text-foreground">{productCategoryLabels[category as keyof typeof productCategoryLabels]} — {rows.length} modelos</h2> : null}
        <pre className="min-w-0 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-4 text-sm text-body [overflow-wrap:anywhere]">{text}</pre>
        {rows.map(item=><article key={item.id} className="grid min-w-0 gap-3 rounded-md border border-line bg-surface p-4 text-body sm:grid-cols-2">
          <div className="min-w-0"><p className="text-xs text-muted">{productCategoryLabels[item.category]}</p><h2 className="font-semibold [overflow-wrap:anywhere]">{item.model_name}</h2></div>
          <p>Atual: {item.stock_quantity} · Mínimo: {item.minimum_stock} · Repor: <strong>{item.suggested}</strong></p>
          <div className="grid min-w-0 gap-2 text-sm sm:col-span-2">
            <p>{item.preferred ? `Preferencial: ${item.preferred.name}` : `${item.suppliers.length} fornecedores disponíveis`}</p>
            {supplier && item.preferred?.id===supplier.id ? <p className="text-accent">Fornecedor preferencial</p> : null}
            {item.suppliers.length ? <p>{supplier ? "Também disponível em: " : "Fornecedores: "}{item.suppliers.filter(s=>s.id!==supplier?.id).map(s=>s.name).join(", ") || "Nenhum outro fornecedor ativo"}</p> : <p className="text-warning-strong">Sem fornecedor ativo</p>}
            <Link className="min-h-11 w-fit py-3 text-accent underline" href={`/saidas/modelos/${item.id}/fornecedores`}>{item.suppliers.length ? "Configurar fornecedores" : "Configurar fornecedor"}</Link>
          </div>
          <Link className="min-h-11 py-3 text-accent underline" href={`/estoque/${item.id}?tipo=entry`}>Registrar entrada</Link>
        </article>)}
      </> : null}
    </>}
  </section>;
}
