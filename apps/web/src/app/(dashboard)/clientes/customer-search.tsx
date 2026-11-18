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
        className="h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
        defaultValue={query}
        id="customer-search"
        name="q"
        placeholder="Buscar por nome ou telefone"
      />
      <div className="grid gap-2 sm:flex">
        <button
          className="h-11 rounded-md bg-neutral-action px-4 text-sm font-semibold text-white transition hover:bg-neutral-action-hover focus:outline-none focus:ring-2 focus:ring-line-strong"
          type="submit"
        >
          Buscar
        </button>
        {query ? (
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
            href="/clientes"
          >
            Limpar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
