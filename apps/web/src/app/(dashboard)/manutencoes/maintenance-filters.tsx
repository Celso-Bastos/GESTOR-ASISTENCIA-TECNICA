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
    <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_auto] md:items-end">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Busca
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={query}
            name="q"
            placeholder="Cliente, telefone, modelo ou OS"
          />
        </div>
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Status
        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
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
        className="inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
        type="submit"
      >
        Filtrar
      </button>
    </form>
  );
}
