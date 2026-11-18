import Link from "next/link";
import { formatPhoneBR } from "@/lib/phone";
import type { MaintenanceOrderListItem } from "./actions";
import {
  getMaintenanceCustomer,
  getMaintenanceDevice
} from "./maintenance-relations";
import { MaintenanceStatusBadge } from "./maintenance-status-badge";

type MaintenanceTableProps = {
  orders: MaintenanceOrderListItem[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCurrency(value: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value));
}

export function MaintenanceTable({ orders }: MaintenanceTableProps) {
  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {orders.map((order) => {
          const customer = getMaintenanceCustomer(order);
          const device = getMaintenanceDevice(order);
          const deviceLabel = device
            ? [device.brand, device.model].filter(Boolean).join(" ")
            : "Aparelho nao encontrado";

          return (
            <article
              className="grid gap-4 rounded-md border border-line bg-surface p-4 shadow-sm"
              key={order.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-accent">
                    Numero da OS
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">
                    {order.order_number}
                  </h2>
                </div>
                <MaintenanceStatusBadge status={order.status} />
              </div>

              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase text-subtle">
                    Cliente
                  </dt>
                  <dd className="mt-1 text-foreground">
                    {customer?.name ?? "Cliente nao informado"}
                  </dd>
                  {customer?.phone ? (
                    <dd className="text-muted">
                      {formatPhoneBR(customer.phone)}
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-subtle">
                    Aparelho/modelo
                  </dt>
                  <dd className="mt-1 text-content">{deviceLabel}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs font-medium uppercase text-subtle">
                      Previsao
                    </dt>
                    <dd className="mt-1 text-content">
                      {formatDate(order.expected_delivery_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-subtle">
                      Valor
                    </dt>
                    <dd className="mt-1 text-content">
                      {formatCurrency(order.estimated_price)}
                    </dd>
                  </div>
                </div>
              </dl>

              <div className="grid gap-2">
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus"
                  href={`/manutencoes/${order.id}`}
                >
                  Ver detalhes
                </Link>
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
                  href={`/manutencoes/${order.id}/editar`}
                >
                  Editar
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-line bg-surface shadow-sm md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase text-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold">Número da OS</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Aparelho</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Previsão</th>
              <th className="px-4 py-3 font-semibold">Valor estimado</th>
              <th className="px-4 py-3 font-semibold">Criado em</th>
              <th className="px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((order) => {
              const customer = getMaintenanceCustomer(order);
              const device = getMaintenanceDevice(order);

              return (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-3 text-body">
                    <span className="block font-medium text-foreground">
                      {customer?.name ?? "Cliente não informado"}
                    </span>
                    <span className="block text-xs text-subtle">
                      {customer?.phone ? formatPhoneBR(customer.phone) : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body">
                    {device
                      ? [device.brand, device.model].filter(Boolean).join(" ")
                      : "Aparelho não encontrado"}
                  </td>
                  <td className="px-4 py-3">
                    <MaintenanceStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-body">
                    {formatDate(order.expected_delivery_date)}
                  </td>
                  <td className="px-4 py-3 text-body">
                    {formatCurrency(order.estimated_price)}
                  </td>
                  <td className="px-4 py-3 text-body">
                    {formatDateTime(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-body transition hover:bg-surface-muted"
                        href={`/manutencoes/${order.id}`}
                      >
                        Ver
                      </Link>
                      <Link
                        className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-body transition hover:bg-surface-muted"
                        href={`/manutencoes/${order.id}/editar`}
                      >
                        Editar
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
