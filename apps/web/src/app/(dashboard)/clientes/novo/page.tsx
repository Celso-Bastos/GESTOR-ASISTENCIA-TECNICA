import { createCustomerAction } from "../actions";
import { CustomerForm } from "../customer-form";

export default function NovoClientePage() {
  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">Clientes</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Novo cliente
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Cadastre apenas os dados necessarios para atendimento e registre o
          consentimento de WhatsApp quando o cliente autorizar.
        </p>
      </div>

      <CustomerForm action={createCustomerAction} submitLabel="Criar cliente" />
    </section>
  );
}
