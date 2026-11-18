import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPhoneBR } from "@/lib/phone";
import { formatCivilDateBR } from "@/lib/civil-date";
import { deleteCustomerAction, getCustomerById } from "../actions";
import { ConfirmDeleteButton } from "../confirm-delete-button";
import { requireOrganization } from "@/lib/organization/queries";
import { GoogleMapsAddressLink } from "@/components/google-maps-address-link";

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
  const organization = await requireOrganization();
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase text-accent">
            Cliente
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold text-foreground">
            {customer.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Dados basicos do cliente na organizacao atual.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-11 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-body transition hover:bg-surface-muted sm:h-9"
            href="/clientes"
          >
            Voltar
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-md bg-teal-700 px-3 text-sm font-medium text-white transition hover:bg-teal-800 sm:h-9"
            href={`/clientes/${customer.id}/editar`}
          >
            Editar
          </Link>
          <ConfirmDeleteButton
            action={deleteCustomerAction.bind(null, customer.id)}
          />
        </div>
      </div>

      <dl className="grid min-w-0 max-w-3xl gap-4 break-words rounded-md border border-line bg-surface p-4 shadow-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">Nome</dt>
          <dd className="mt-1 min-w-0 text-sm text-foreground">{customer.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">
            Telefone
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {customer.phone ? formatPhoneBR(customer.phone) : "Nao informado"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase text-subtle">
            Endereço
          </dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
            {customer.address || "Não informado"}
          </dd>
          <dd className="mt-2"><GoogleMapsAddressLink address={customer.address} serviceCity={organization.service_city} /></dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">
            Aniversário
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {formatCivilDateBR(customer.birth_date)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">
            Consentimento WhatsApp
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {customer.whatsapp_opt_in
              ? `Autorizado em ${formatDate(customer.whatsapp_opt_in_at)}`
              : "Nao autorizado"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">
            Origem
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {sourceLabels[customer.source]}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">
            Criado em
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {formatDate(customer.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">
            Atualizado em
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {formatDate(customer.updated_at)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase text-subtle">
            Observacoes
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
            {customer.notes || "Nenhuma observacao cadastrada."}
          </dd>
        </div>
      </dl>

      <p className="max-w-3xl rounded-md border border-warning-line bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-emphasis">
        Historico de manutencoes deste cliente sera implementado em fase futura.
      </p>
    </section>
  );
}
