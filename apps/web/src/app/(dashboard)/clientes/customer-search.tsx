import Link from "next/link";

type CustomerSearchProps = {
  query?: string;
};

export function CustomerSearch({ query }: CustomerSearchProps) {
  return (
    <form action="/clientes" className="flex flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor="customer-search">
        Buscar clientes
      </label>
      <input
        className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        defaultValue={query}
        id="customer-search"
        name="q"
        placeholder="Buscar por nome ou telefone"
      />
      <div className="flex gap-2">
        <button
          className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          type="submit"
        >
          Buscar
        </button>
        {query ? (
          <Link
            className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            href="/clientes"
          >
            Limpar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
