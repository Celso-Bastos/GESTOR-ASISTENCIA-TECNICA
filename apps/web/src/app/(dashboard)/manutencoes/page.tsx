import Link from "next/link";
import { Plus, Zap } from "lucide-react";
import { getMaintenanceOrders } from "./actions";
import { MaintenanceFilters } from "./maintenance-filters";
import { MaintenanceTable } from "./maintenance-table";

type ManutencoesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

export default async function ManutencoesPage({
  searchParams
}: ManutencoesPageProps) {
  const params = await searchParams;
  const { orders, error, filters } = await getMaintenanceOrders({
    q: params?.q,
    status: params?.status
  });

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase text-accent">Fase 5</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Manutenções
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Controle ordens de serviço, aparelhos, prazos de entrega e
            histórico de status da organização atual.
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-accent-border-strong bg-surface px-4 text-sm font-semibold text-accent transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-focus"
            href="/manutencoes/rapida"
          >
            <Zap className="size-4" aria-hidden="true" />
            Manutenção rápida
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus"
            href="/manutencoes/nova"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nova manutenção completa
          </Link>
        </div>
      </div>

      <MaintenanceFilters query={filters.q} status={filters.status} />

      {error ? (
        <p className="rounded-md border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!error && orders.length === 0 ? (
        <div className="rounded-md border border-line bg-surface px-4 py-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            Nenhuma manutenção encontrada
          </p>
          <p className="mt-2 text-sm text-muted">
            Ajuste os filtros ou crie a primeira ordem de serviço.
          </p>
        </div>
      ) : null}

      {orders.length > 0 ? <MaintenanceTable orders={orders} /> : null}
    </section>
  );
}
