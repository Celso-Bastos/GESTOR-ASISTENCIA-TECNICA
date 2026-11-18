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
    <div>
      <div className="grid gap-3 md:hidden">
        {report.rows.map((row) => (
          <article
            className="grid gap-3 rounded-md border border-line bg-surface p-4 shadow-sm"
            key={`${row.category}-${row.model}`}
          >
            <div className="flex flex-col gap-2">
              <ProductCategoryBadge category={row.category} />
              <h3 className="break-words text-base font-semibold text-foreground">
                {row.model}
              </h3>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-subtle">
                  Quantidade que saiu
                </dt>
                <dd className="mt-1 text-content">{row.quantity}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-subtle">
                  Valor vendido
                </dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {formatCurrencyBRL(row.total)}
                </dd>
              </div>
            </dl>
          </article>
        ))}

        {report.rows.length === 0 ? (
          <div className="rounded-md border border-line bg-surface p-5 text-sm text-muted shadow-sm">
            Nenhuma saida encontrada para este periodo.
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-line bg-surface shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-subtle">
              <tr>
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 font-semibold">Modelo</th>
                <th className="px-4 py-3 font-semibold">Quantidade que saiu</th>
                <th className="px-4 py-3 font-semibold">Valor total vendido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {report.rows.map((row) => (
                <tr key={`${row.category}-${row.model}`}>
                  <td className="px-4 py-3">
                    <ProductCategoryBadge category={row.category} />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.model}
                  </td>
                  <td className="px-4 py-3 text-body">{row.quantity}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatCurrencyBRL(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {report.rows.length === 0 ? (
          <div className="border-t border-line p-5 text-sm text-muted">
            Nenhuma saida encontrada para este periodo.
          </div>
        ) : null}
      </div>
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
          className="rounded-md border border-line bg-surface p-4 shadow-sm"
          key={card.label}
        >
          <p className="text-sm font-medium text-muted">{card.label}</p>
          <p className="mt-3 text-2xl font-semibold text-foreground">
            {card.value}
          </p>
        </article>
      ))}
    </div>
  );
}
