import { getProductModelTemplates } from "../actions";
import { ProductModelTemplateManager } from "../product-model-template-manager";

export default async function ModelosSaidaPage() {
  const templates = await getProductModelTemplates({ includeInactive: true });

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-accent">
          Saidas/Vendas
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Produtos cadastrados
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Cadastre modelos recorrentes para preencher categoria e valor base
          nas proximas vendas.
        </p>
      </div>

      <ProductModelTemplateManager templates={templates} />
    </section>
  );
}
