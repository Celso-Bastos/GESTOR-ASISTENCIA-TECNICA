import { requireOrganization } from "@/lib/organization/queries";

export default async function ManutencoesPage() {
  await requireOrganization();

  return (
    <section className="grid gap-3">
      <h1 className="text-2xl font-semibold text-slate-950">Manutencoes</h1>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">
        As ordens de manutencao serao implementadas em uma fase posterior.
      </p>
    </section>
  );
}
