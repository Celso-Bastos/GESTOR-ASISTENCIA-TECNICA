import { formatDateBR } from "@/lib/products/format";
import {
  deleteProductOutflowAction,
  type ProductOutflow
} from "./actions";
import { MoneyDisplay } from "./money-display";
import { ProductActionButton } from "./product-action-button";
import { ProductCategoryBadge } from "./product-category-badge";

type ProductOutflowTableProps = {
  outflows: ProductOutflow[];
};

function singleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getOutflowModel(outflow: ProductOutflow) {
  const template = singleRelation(outflow.product_model_templates);

  return template?.model_name ?? outflow.custom_model_name ?? "Sem modelo";
}

function getCustomerName(outflow: ProductOutflow) {
  const customer = singleRelation(outflow.customers);

  return customer?.name ?? "-";
}

export function ProductOutflowTable({ outflows }: ProductOutflowTableProps) {
  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {outflows.map((outflow) => (
          <article
            className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            key={outflow.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-base font-semibold text-slate-950">
                  {getOutflowModel(outflow)}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDateBR(outflow.sold_at)}
                </p>
              </div>
              <ProductCategoryBadge category={outflow.category} />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">
                  Quantidade
                </dt>
                <dd className="mt-1 text-slate-800">{outflow.quantity}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">
                  Total
                </dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  <MoneyDisplay value={outflow.total_price} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">
                  Unitario
                </dt>
                <dd className="mt-1 text-slate-800">
                  <MoneyDisplay value={outflow.unit_price} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">
                  Cliente
                </dt>
                <dd className="mt-1 text-slate-800">{getCustomerName(outflow)}</dd>
              </div>
            </dl>

            <ProductActionButton
              action={deleteProductOutflowAction.bind(null, outflow.id)}
              confirmMessage="Excluir esta saida? Essa acao sera um soft delete."
              idleLabel="Excluir"
              pendingLabel="Excluindo..."
            />
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 font-semibold">Modelo</th>
                <th className="px-4 py-3 font-semibold">Qtd.</th>
                <th className="px-4 py-3 font-semibold">Unitario</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {outflows.map((outflow) => (
                <tr key={outflow.id}>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDateBR(outflow.sold_at)}
                  </td>
                  <td className="px-4 py-3">
                    <ProductCategoryBadge category={outflow.category} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {getOutflowModel(outflow)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {outflow.quantity}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <MoneyDisplay value={outflow.unit_price} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-950">
                    <MoneyDisplay value={outflow.total_price} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {getCustomerName(outflow)}
                  </td>
                  <td className="px-4 py-3">
                    <ProductActionButton
                      action={deleteProductOutflowAction.bind(null, outflow.id)}
                      confirmMessage="Excluir esta saida? Essa acao sera um soft delete."
                      idleLabel="Excluir"
                      pendingLabel="Excluindo..."
                    />
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
