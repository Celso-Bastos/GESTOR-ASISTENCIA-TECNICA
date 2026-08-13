import {
  formatCurrencyBRL,
  productCategories,
  productCategoryLabels
} from "@/lib/products/format";
import {
  getMonthlyRestockReport,
  type RestockReport
} from "../../saidas/actions";
import { CopyRestockListButton } from "./copy-restock-list-button";
import {
  RestockReportTable,
  RestockSummaryCards
} from "./restock-report-table";

type ReposicaoPageProps = {
  searchParams?: Promise<{
    month?: string;
    category?: string;
  }>;
};

function safeCategory(value?: string) {
  return productCategories.includes(value as never) ? value : undefined;
}

function formatRestockMonth(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return month;
  }

  const monthName = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, monthIndex, 1)));

  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}/${year}`;
}

function formatRestockList(report: RestockReport) {
  const lines = [`Lista para reposicao - ${formatRestockMonth(report.month)}`];
  let currentCategory = "";

  for (const row of report.rows) {
    if (row.category !== currentCategory) {
      currentCategory = row.category;
      lines.push("", productCategoryLabels[row.category]);
    }

    const unitLabel = row.quantity === 1 ? "unidade" : "unidades";
    lines.push(`* ${row.model}: ${row.quantity} ${unitLabel}`);
  }

  if (report.rows.length === 0) {
    lines.push("", "Nenhum item vendido no periodo filtrado.");
  }

  const unitLabel = report.totalQuantity === 1 ? "unidade" : "unidades";
  lines.push(
    "",
    `Total de unidades: ${report.totalQuantity} ${unitLabel}`,
    `Total vendido: ${formatCurrencyBRL(report.totalSold)}`
  );

  return lines.join("\n");
}

export default async function ReposicaoPage({
  searchParams
}: ReposicaoPageProps) {
  const params = await searchParams;
  const { report, error } = await getMonthlyRestockReport({
    month: params?.month || undefined,
    category: safeCategory(params?.category)
  });
  const restockListText = formatRestockList(report);

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">
          Relatorios
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Reposicao mensal
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Agrupamento do que saiu por produto e modelo para orientar a compra
          do fim do mes.
        </p>
      </div>

      <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Mes
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={report.month}
            name="month"
            type="month"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Categoria
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={params?.category ?? ""}
            name="category"
          >
            <option value="">Todas</option>
            {productCategories.map((category) => (
              <option key={category} value={category}>
                {productCategoryLabels[category]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200"
            type="submit"
          >
            Filtrar
          </button>
        </div>
      </form>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <RestockSummaryCards report={report} />

      <section className="grid gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Lista para reposicao
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Texto agrupado pelos filtros atuais.
            </p>
          </div>

          <CopyRestockListButton text={restockListText} />
        </div>

        <pre className="max-h-80 overflow-auto rounded-md border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 shadow-sm">
          {restockListText}
        </pre>
      </section>

      <RestockReportTable report={report} />
    </section>
  );
}
