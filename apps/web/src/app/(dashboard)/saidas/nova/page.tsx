import {
  getCustomersForOutflow,
  getProductModelTemplates
} from "../actions";
import { ProductOutflowForm } from "../product-outflow-form";

export default async function NovaSaidaPage() {
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
        <p className="text-sm font-medium uppercase text-teal-700">
          Saidas/Vendas
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Nova saida
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Registre uma venda de pelicula, capinha, carregador, fone, cabo ou
          outro acessorio.
        </p>
      </div>

      <ProductOutflowForm
        customers={customers}
        templates={templates}
        today={today}
      />
    </section>
  );
}
