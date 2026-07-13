import Link from "next/link";
import { MESSAGE_TYPES } from "@assistencia/shared/constants/message-types";
import type { MaintenanceOrderListItem } from "../manutencoes/actions";
import {
  getMaintenanceCustomer,
  getMaintenanceDevice
} from "../manutencoes/maintenance-relations";
import { MaintenanceStatusBadge } from "../manutencoes/maintenance-status-badge";
import { WhatsAppButton } from "../mensagens/whatsapp-button";

type AlertMaintenanceListProps = {
  title: string;
  emptyMessage: string;
  orders: MaintenanceOrderListItem[];
  whatsappType: typeof MESSAGE_TYPES.MAINTENANCE_READY | typeof MESSAGE_TYPES.DELIVERY_TODAY;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Nao informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short"
  }).format(new Date(`${value}T00:00:00`));
}

export function AlertMaintenanceList({
  title,
  emptyMessage,
  orders,
  whatsappType
}: AlertMaintenanceListProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <Link
          className="text-sm font-semibold text-teal-700 transition hover:text-teal-800"
          href="/manutencoes"
        >
          Ver todas
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {orders.map((order) => {
            const customer = getMaintenanceCustomer(order);
            const device = getMaintenanceDevice(order);

            return (
              <div
                className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_auto] md:items-center"
                key={order.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="font-semibold text-slate-950 transition hover:text-teal-700"
                      href={`/manutencoes/${order.id}`}
                    >
                      {order.order_number}
                    </Link>
                    <MaintenanceStatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {customer?.name ?? "Cliente nao encontrado"} -{" "}
                    {device?.model ?? "Aparelho nao encontrado"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Previsao: {formatDate(order.expected_delivery_date)}
                  </p>
                </div>

                <WhatsAppButton
                  disabled={!customer?.phone}
                  label="WhatsApp"
                  messageType={whatsappType}
                  orderId={order.id}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

