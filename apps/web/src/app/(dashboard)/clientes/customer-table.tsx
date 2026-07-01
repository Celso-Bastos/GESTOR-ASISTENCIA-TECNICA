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
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Telefone</th>
              <th className="px-4 py-3 font-semibold">WhatsApp/Promocoes</th>
              <th className="px-4 py-3 font-semibold">Origem</th>
              <th className="px-4 py-3 font-semibold">Criado em</th>
              <th className="px-4 py-3 font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-3 font-medium text-slate-950">
                  {customer.name}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatPhoneBR(customer.phone)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      customer.whatsapp_opt_in
                        ? "rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700"
                        : "rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
                    }
                  >
                    {customer.whatsapp_opt_in ? "Autorizado" : "Nao autorizado"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {sourceLabels[customer.source]}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatDate(customer.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      href={`/clientes/${customer.id}`}
                    >
                      Ver
                    </Link>
                    <Link
                      className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
  );
}
