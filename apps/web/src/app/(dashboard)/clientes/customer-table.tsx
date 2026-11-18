import Link from "next/link";
import { formatPhoneBR } from "@/lib/phone";
import {
  deleteCustomerAction,
  type CustomerRow
} from "./actions";
import { ConfirmDeleteButton } from "./confirm-delete-button";

type CustomerTableProps = {
  customers: CustomerRow[];
};

const sourceLabels: Record<CustomerRow["source"], string> = {
  manual: "Manual",
  tablet: "Tablet",
  future_import: "Importacao futura"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function CustomerTable({ customers }: CustomerTableProps) {
  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {customers.map((customer) => (
          <article
            className="grid gap-4 rounded-md border border-line bg-surface p-4 shadow-sm"
            key={customer.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-base font-semibold text-foreground">
                  {customer.name}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {customer.phone ? formatPhoneBR(customer.phone) : "Nao informado"}
                </p>
              </div>
              <span
                className={
                  customer.whatsapp_opt_in
                    ? "shrink-0 rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent"
                    : "shrink-0 rounded-md bg-canvas px-2 py-1 text-xs font-semibold text-muted"
                }
              >
                {customer.whatsapp_opt_in ? "Autorizado" : "Nao autorizado"}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-subtle">
                  Origem
                </dt>
                <dd className="mt-1 text-content">
                  {sourceLabels[customer.source]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-subtle">
                  Criado em
                </dt>
                <dd className="mt-1 text-content">
                  {formatDate(customer.created_at)}
                </dd>
              </div>
            </dl>

            <div className="grid gap-2">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
                href={`/clientes/${customer.id}`}
              >
                Ver detalhes
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
                href={`/clientes/${customer.id}/editar`}
              >
                Editar
              </Link>
              <ConfirmDeleteButton
                action={deleteCustomerAction.bind(null, customer.id)}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-line bg-surface shadow-sm md:block">
        <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase text-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Telefone</th>
              <th className="px-4 py-3 font-semibold">WhatsApp/Promocoes</th>
              <th className="px-4 py-3 font-semibold">Origem</th>
              <th className="px-4 py-3 font-semibold">Criado em</th>
              <th className="px-4 py-3 font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-3 font-medium text-foreground">
                  {customer.name}
                </td>
                <td className="px-4 py-3 text-body">
                  {customer.phone ? formatPhoneBR(customer.phone) : "Nao informado"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      customer.whatsapp_opt_in
                        ? "rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent"
                        : "rounded-md bg-canvas px-2 py-1 text-xs font-semibold text-muted"
                    }
                  >
                    {customer.whatsapp_opt_in ? "Autorizado" : "Nao autorizado"}
                  </span>
                </td>
                <td className="px-4 py-3 text-body">
                  {sourceLabels[customer.source]}
                </td>
                <td className="px-4 py-3 text-body">
                  {formatDate(customer.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-body transition hover:bg-surface-muted"
                      href={`/clientes/${customer.id}`}
                    >
                      Ver
                    </Link>
                    <Link
                      className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-body transition hover:bg-surface-muted"
                      href={`/clientes/${customer.id}/editar`}
                    >
                      Editar
                    </Link>
                    <ConfirmDeleteButton
                      action={deleteCustomerAction.bind(null, customer.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
