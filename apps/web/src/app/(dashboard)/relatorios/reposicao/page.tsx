import {
  productCategories,
  productCategoryLabels
} from "@/lib/products/format";
import { getMonthlyRestockReport } from "../../saidas/actions";
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

export default async function ReposicaoPage({
  searchParams
}: ReposicaoPageProps) {
  const params = await searchParams;
  const { report, error } = await getMonthlyRestockReport({
    month: params?.month || undefined,
    category: safeCategory(params?.category)
  });

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
      <RestockReportTable report={report} />
    </section>
  );
}
