import { QuickMaintenanceForm } from "./quick-maintenance-form";

export default function ManutencaoRapidaPage() {
  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">
          Atendimento no balcão
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Manutenção rápida
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Abra uma OS com os dados mínimos do cliente, aparelho e defeito. A
          ordem pode ser completada depois na edição.
        </p>
      </div>

      <QuickMaintenanceForm />
    </section>
  );
}
