import { notFound } from "next/navigation";
import { getCustomerById, updateCustomerAction } from "../../actions";
import { CustomerForm } from "../../customer-form";

type EditarClientePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarClientePage({
  params
}: EditarClientePageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">Clientes</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Editar cliente
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Atualize os dados sem alterar a organizacao vinculada ao cadastro.
        </p>
      </div>

      <CustomerForm
        action={updateCustomerAction.bind(null, customer.id)}
        customer={customer}
        submitLabel="Salvar alteracoes"
      />
    </section>
  );
}
