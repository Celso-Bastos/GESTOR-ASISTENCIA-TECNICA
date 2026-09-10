import { notFound } from "next/navigation";
import { getProductOutflowById, getCustomersForOutflow, getProductModelTemplates } from "../../actions";
import { ProductOutflowForm } from "../../product-outflow-form";
export default async function EditarSaidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [outflow, customers, templates] = await Promise.all([
    getProductOutflowById(id), getCustomersForOutflow(), getProductModelTemplates({ includeInactive: true })
  ]);
  if (!outflow) notFound();
  return <section className="grid gap-6">
    <h1 className="text-2xl font-semibold">Editar venda/saída</h1>
    <ProductOutflowForm outflow={outflow} customers={customers} templates={templates} today={outflow.sold_at} />
  </section>;
}
