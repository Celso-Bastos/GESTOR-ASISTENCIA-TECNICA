import { notFound } from "next/navigation";
import { getCustomerById, updateCustomerAction } from "../../actions";
import { CustomerForm } from "../../customer-form";
import { requireOrganization } from "@/lib/organization/queries";

type EditarClientePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarClientePage({
  params
}: EditarClientePageProps) {
  const { id } = await params;
  const organization = await requireOrganization();
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-accent">Clientes</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Editar cliente
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Atualize os dados sem alterar a organizacao vinculada ao cadastro.
        </p>
      </div>

      <CustomerForm
        action={updateCustomerAction.bind(null, customer.id)}
        customer={customer}
        submitLabel="Salvar alteracoes"
        serviceCity={organization.service_city}
      />
    </section>
  );
}
