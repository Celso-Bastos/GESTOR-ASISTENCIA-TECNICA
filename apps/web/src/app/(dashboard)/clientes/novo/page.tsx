import { createCustomerAction } from "../actions";
import { CustomerForm } from "../customer-form";
import { requireOrganization } from "@/lib/organization/queries";

export default async function NovoClientePage() {
  const organization = await requireOrganization();
  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-accent">Clientes</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Novo cliente
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Cadastre apenas os dados necessarios para atendimento e registre o
          consentimento de WhatsApp quando o cliente autorizar.
        </p>
      </div>

      <CustomerForm action={createCustomerAction} submitLabel="Criar cliente" serviceCity={organization.service_city} />
    </section>
  );
}
