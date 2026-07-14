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
              className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
              key={order.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-teal-700">
                    Numero da OS
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">
                    {order.order_number}
                  </h2>
                </div>
                <MaintenanceStatusBadge status={order.status} />
              </div>

              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Cliente
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {customer?.name ?? "Cliente nao encontrado"}
                  </dd>
                  {customer?.phone ? (
                    <dd className="text-slate-600">
                      {formatPhoneBR(customer.phone)}
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Aparelho/modelo
                  </dt>
                  <dd className="mt-1 text-slate-800">{deviceLabel}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">
                      Previsao
                    </dt>
                    <dd className="mt-1 text-slate-800">
                      {formatDate(order.expected_delivery_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">
                      Valor
                    </dt>
                    <dd className="mt-1 text-slate-800">
                      {formatCurrency(order.estimated_price)}
                    </dd>
                  </div>
                </div>
              </dl>

              <div className="grid gap-2">
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  href={`/manutencoes/${order.id}`}
                >
                  Ver detalhes
                </Link>
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  href={`/manutencoes/${order.id}/editar`}
                >
                  Editar
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
          <tbody className="divide-y divide-slate-200">
            {orders.map((order) => {
              const customer = getMaintenanceCustomer(order);
              const device = getMaintenanceDevice(order);

              return (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-semibold text-slate-950">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="block font-medium text-slate-950">
                      {customer?.name ?? "Cliente não encontrado"}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {customer?.phone ? formatPhoneBR(customer.phone) : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {device
                      ? [device.brand, device.model].filter(Boolean).join(" ")
                      : "Aparelho não encontrado"}
                  </td>
                  <td className="px-4 py-3">
                    <MaintenanceStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDate(order.expected_delivery_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatCurrency(order.estimated_price)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDateTime(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        href={`/manutencoes/${order.id}`}
                      >
                        Ver
                      </Link>
                      <Link
                        className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
