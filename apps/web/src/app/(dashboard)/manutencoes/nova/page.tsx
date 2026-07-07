import {
  createMaintenanceOrderAction,
  getCustomersForMaintenance
} from "../actions";
import { MaintenanceForm } from "../maintenance-form";

export default async function NovaManutencaoPage() {
  const customers = await getCustomersForMaintenance();

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">
          Manutenções
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Nova manutenção
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Selecione um cliente existente, registre o aparelho e informe o
          defeito relatado para abrir a OS.
        </p>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Cadastre um cliente antes de abrir uma manutenção.
        </p>
      ) : null}

      <MaintenanceForm
        action={createMaintenanceOrderAction}
        customers={customers}
        mode="create"
        submitLabel="Criar manutenção"
      />
    </section>
  );
}
