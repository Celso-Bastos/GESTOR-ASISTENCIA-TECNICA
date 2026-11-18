import { Search } from "lucide-react";
import {
  maintenanceStatusFilterLabels,
  type MaintenanceStatusFilter
} from "@/lib/maintenance/status";

type MaintenanceFiltersProps = {
  query: string;
  status: MaintenanceStatusFilter;
};

const filterOptions: MaintenanceStatusFilter[] = [
  "todos",
  "recebido",
  "em_analise",
  "aguardando_peca",
  "em_manutencao",
  "pronto_para_entrega",
  "entregue",
  "cancelado",
  "atrasados"
];

export function MaintenanceFilters({ query, status }: MaintenanceFiltersProps) {
  return (
    <form className="grid gap-3 rounded-md border border-line bg-surface p-4 shadow-sm md:grid-cols-[1fr_220px_auto] md:items-end">
      <label className="grid gap-2 text-sm font-medium text-body">
        Busca
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-disabled"
            aria-hidden="true"
          />
          <input
            className="h-11 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft md:text-sm"
            defaultValue={query}
            name="q"
            placeholder="Cliente, telefone, modelo ou OS"
          />
        </div>
      </label>

      <label className="grid gap-2 text-sm font-medium text-body">
        Status
        <select
          className="h-11 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft md:text-sm"
          defaultValue={status}
          name="status"
        >
          {filterOptions.map((option) => (
            <option key={option} value={option}>
              {maintenanceStatusFilterLabels[option]}
            </option>
          ))}
        </select>
      </label>

      <button
        className="inline-flex h-11 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus"
        type="submit"
      >
        Filtrar
      </button>
    </form>
  );
}
