import { requireOrganization } from "@/lib/organization/queries";

export default async function ClientesPage() {
  await requireOrganization();

  return (
    <section className="grid gap-3">
      <h1 className="text-2xl font-semibold text-slate-950">Clientes</h1>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">
        O CRUD de clientes sera implementado em uma fase posterior.
      </p>
    </section>
  );
}
