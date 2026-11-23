import {
  getCustomersForOutflow,
  getProductModelTemplates
} from "../actions";
import { ProductOutflowForm } from "../product-outflow-form";

export default async function NovaSaidaPage({ searchParams }: { searchParams?: Promise<{ modelo?: string }> }) {
  const params = await searchParams;
  const [templates, customers] = await Promise.all([
    getProductModelTemplates(),
    getCustomersForOutflow()
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-accent">
          Saidas/Vendas
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Nova saida
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Registre uma venda de película, case, carregador, fone, cabo ou
          outro acessorio.
        </p>
      </div>

      <ProductOutflowForm
        initialTemplateId={params?.modelo}
        customers={customers}
        templates={templates}
        today={today}
      />
    </section>
  );
}
