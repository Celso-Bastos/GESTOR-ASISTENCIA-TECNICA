import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";

async function getTabletCustomersToday(organizationId: string) {
  const supabase = await createClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("source", "tablet")
    .is("deleted_at", null)
    .gte("created_at", startOfToday.toISOString());

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export default async function DashboardPage() {
  const organization = await requireOrganization();
  const tabletCustomersToday = await getTabletCustomersToday(organization.id);
  const cards = [
    { label: "Manutencoes em aberto", value: 0 },
    { label: "Entregas de hoje", value: 0 },
    { label: "Aguardando peca", value: 0 },
    { label: "Clientes do tablet hoje", value: tabletCustomersToday }
  ];

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">
          {organization.name}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Visao inicial do atendimento. Os indicadores reais entram nas proximas
          fases, conforme clientes e manutencoes forem implementados.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            key={card.label}
          >
            <p className="text-sm font-medium text-slate-600">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {card.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
