import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPhoneBR } from "@/lib/phone";
import { deleteCustomerAction, getCustomerById } from "../actions";
import { ConfirmDeleteButton } from "../confirm-delete-button";

type ClienteDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

const sourceLabels = {
  manual: "Manual",
  tablet: "Tablet",
  future_import: "Importacao futura"
} as const;

function formatDate(value: string | null) {
  if (!value) {
    return "Nao informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function ClienteDetalhePage({
  params
}: ClienteDetalhePageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase text-teal-700">
            Cliente
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {customer.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Dados basicos do cliente na organizacao atual.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            href="/clientes"
          >
            Voltar
          </Link>
          <Link
            className="inline-flex h-9 items-center rounded-md bg-teal-700 px-3 text-sm font-medium text-white transition hover:bg-teal-800"
            href={`/clientes/${customer.id}/editar`}
          >
            Editar
          </Link>
          <ConfirmDeleteButton
            action={deleteCustomerAction.bind(null, customer.id)}
          />
        </div>
      </div>

      <dl className="grid max-w-3xl gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Nome</dt>
          <dd className="mt-1 text-sm text-slate-950">{customer.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">
            Telefone
          </dt>
          <dd className="mt-1 text-sm text-slate-950">
            {formatPhoneBR(customer.phone)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">
            Consentimento WhatsApp
          </dt>
          <dd className="mt-1 text-sm text-slate-950">
            {customer.whatsapp_opt_in
              ? `Autorizado em ${formatDate(customer.whatsapp_opt_in_at)}`
              : "Nao autorizado"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">
            Origem
          </dt>
          <dd className="mt-1 text-sm text-slate-950">
            {sourceLabels[customer.source]}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">
            Criado em
          </dt>
          <dd className="mt-1 text-sm text-slate-950">
            {formatDate(customer.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">
            Atualizado em
          </dt>
          <dd className="mt-1 text-sm text-slate-950">
            {formatDate(customer.updated_at)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase text-slate-500">
            Observacoes
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-950">
            {customer.notes || "Nenhuma observacao cadastrada."}
          </dd>
        </div>
      </dl>

      <p className="max-w-3xl rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        Historico de manutencoes deste cliente sera implementado em fase futura.
      </p>
    </section>
  );
}
