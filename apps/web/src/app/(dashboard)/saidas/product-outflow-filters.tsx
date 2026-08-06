import {
  productCategories,
  productCategoryLabels
} from "@/lib/products/format";

type ProductOutflowFiltersProps = {
  filters: {
    category: string;
    q: string;
    start: string;
    end: string;
  };
};

export function ProductOutflowFilters({ filters }: ProductOutflowFiltersProps) {
  return (
    <form
      className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
      role="search"
    >
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Categoria
        <select
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={filters.category}
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

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Modelo
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={filters.q}
          name="q"
          placeholder="Buscar modelo"
          type="search"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Inicio
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={filters.start}
          name="start"
          type="date"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Fim
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={filters.end}
          name="end"
          type="date"
        />
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
  );
}
