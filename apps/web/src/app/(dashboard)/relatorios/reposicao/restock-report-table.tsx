import {
  formatCurrencyBRL,
  formatProductCategoryLabel
} from "@/lib/products/format";
import type { RestockReport } from "../../saidas/actions";
import { ProductCategoryBadge } from "../../saidas/product-category-badge";

type RestockReportTableProps = {
  report: RestockReport;
};

export function RestockReportTable({ report }: RestockReportTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Produto</th>
              <th className="px-4 py-3 font-semibold">Modelo</th>
              <th className="px-4 py-3 font-semibold">Quantidade que saiu</th>
              <th className="px-4 py-3 font-semibold">Valor total vendido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {report.rows.map((row) => (
              <tr key={`${row.category}-${row.model}`}>
                <td className="px-4 py-3">
                  <ProductCategoryBadge category={row.category} />
                </td>
                <td className="px-4 py-3 font-medium text-slate-950">
                  {row.model}
                </td>
                <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                <td className="px-4 py-3 font-semibold text-slate-950">
                  {formatCurrencyBRL(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.rows.length === 0 ? (
        <div className="border-t border-slate-200 p-5 text-sm text-slate-600">
          Nenhuma saida encontrada para este periodo.
        </div>
      ) : null}
    </div>
  );
}

export function RestockSummaryCards({ report }: RestockReportTableProps) {
  const cards = [
    { label: "Unidades vendidas", value: String(report.totalQuantity) },
    { label: "Total vendido", value: formatCurrencyBRL(report.totalSold) },
    {
      label: "Categoria mais vendida",
      value: report.topCategory
        ? formatProductCategoryLabel(report.topCategory)
        : "-"
    },
    { label: "Itens para repor", value: String(report.rows.length) }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
          key={card.label}
        >
          <p className="text-sm font-medium text-slate-600">{card.label}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {card.value}
          </p>
        </article>
      ))}
    </div>
  );
}
