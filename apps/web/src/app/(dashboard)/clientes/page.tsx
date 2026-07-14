import Link from "next/link";
import { getCustomers } from "./actions";
import { CustomerSearch } from "./customer-search";
import { CustomerTable } from "./customer-table";
import { EmptyState } from "./empty-state";

type ClientesPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() || "";
  const { customers, error } = await getCustomers(query);

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase text-teal-700">Fase 3</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Clientes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Cadastre clientes da organizacao atual, controle consentimento de
            WhatsApp e mantenha o telefone normalizado para evitar duplicidade.
          </p>
        </div>

        <Link
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 sm:w-auto"
          href="/clientes/novo"
        >
          Novo cliente
        </Link>
      </div>

      <CustomerSearch query={query} />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!error && customers.length === 0 ? (
        <EmptyState
          title={query ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={
            query
              ? "Revise o nome ou telefone buscado e tente novamente."
              : "Crie o primeiro cliente para comecar a organizar os atendimentos."
          }
        />
      ) : null}

      {customers.length > 0 ? <CustomerTable customers={customers} /> : null}
    </section>
  );
}
