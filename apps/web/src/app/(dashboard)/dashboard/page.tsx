import Link from "next/link";
import { MESSAGE_TYPES } from "@assistencia/shared/constants/message-types";
import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import {
  getMaintenanceDashboardAlerts,
  getMaintenanceDashboardMetrics
} from "../manutencoes/actions";
import { AlertMaintenanceList } from "./alert-maintenance-list";

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
  const maintenanceMetrics = await getMaintenanceDashboardMetrics(
    organization.id
  );
  const alerts = await getMaintenanceDashboardAlerts(organization.id);
  const cards = [
    { label: "Manutenções em aberto", value: maintenanceMetrics.open },
    { label: "Entregas de hoje", value: maintenanceMetrics.todayDeliveries },
    { label: "Aguardando peça", value: maintenanceMetrics.waitingParts },
    { label: "Prontos para entrega", value: maintenanceMetrics.ready },
    { label: "Atrasadas", value: maintenanceMetrics.overdue },
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
          Visão inicial do atendimento com indicadores da organização atual.
        </p>
        <div className="mt-4">
          <Link
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 sm:w-auto"
            href="/manutencoes/rapida"
          >
            Nova manutenção rápida
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

      <div className="grid gap-4 xl:grid-cols-2">
        <AlertMaintenanceList
          emptyMessage="Nenhuma entrega prevista para hoje."
          orders={alerts.todayDeliveries}
          title="Entregas de hoje"
          whatsappType={MESSAGE_TYPES.DELIVERY_TODAY}
        />
        <AlertMaintenanceList
          emptyMessage="Nenhuma ordem pronta para entrega."
          orders={alerts.ready}
          title="Prontas para entrega"
          whatsappType={MESSAGE_TYPES.MAINTENANCE_READY}
        />
      </div>
    </section>
  );
}
