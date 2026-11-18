import { randomUUID } from "node:crypto";
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
        <p className="text-sm font-medium uppercase text-accent">
          Manutenções
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Nova manutenção
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Selecione ou cadastre um cliente nesta tela, registre o aparelho e informe o
          defeito relatado para abrir a OS.
        </p>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-md border border-warning-line bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-emphasis">
          Use a opção Novo cliente para cadastrar junto com a manutenção.
        </p>
      ) : null}

      <MaintenanceForm
        requestId={randomUUID()}
        action={createMaintenanceOrderAction}
        customers={customers}
        mode="create"
        submitLabel="Criar manutenção"
      />
    </section>
  );
}
