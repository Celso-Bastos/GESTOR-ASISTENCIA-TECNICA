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
      className="grid gap-3 rounded-md border border-line bg-surface p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5"
      role="search"
    >
      <label className="grid gap-2 text-sm font-medium text-body">
        Categoria
        <select
          className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:h-11 sm:text-sm"
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

      <label className="grid gap-2 text-sm font-medium text-body">
        Modelo
        <input
          className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:h-11 sm:text-sm"
          defaultValue={filters.q}
          name="q"
          placeholder="Buscar modelo"
          type="search"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-body">
        Inicio
        <input
          className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:h-11 sm:text-sm"
          defaultValue={filters.start}
          name="start"
          type="date"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-body">
        Fim
        <input
          className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:h-11 sm:text-sm"
          defaultValue={filters.end}
          name="end"
          type="date"
        />
      </label>

      <div className="flex items-end">
        <button
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus sm:h-11"
          type="submit"
        >
          Filtrar
        </button>
      </div>
    </form>
  );
}
