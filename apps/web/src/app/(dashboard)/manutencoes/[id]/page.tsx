import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MESSAGE_TYPES } from "@assistencia/shared/constants/message-types";
import { formatPhoneBR } from "@/lib/phone";
import { isOpenMaintenanceStatus } from "@/lib/maintenance/status";
import {
  formatWarrantyPeriod,
  isWarrantyExpired
} from "@/lib/maintenance/warranty";
import {
  deleteMaintenanceOrderAction,
  getMaintenanceOrderById
} from "../actions";
import { DeleteMaintenanceButton } from "../delete-maintenance-button";
import {
  getMaintenanceCustomer,
  getMaintenanceDevice
} from "../maintenance-relations";
import { MaintenanceStatusBadge } from "../maintenance-status-badge";
import { MaintenanceStatusControls } from "../maintenance-status-controls";
import { MaintenanceTimeline } from "../maintenance-timeline";
import { WhatsAppButton } from "../../mensagens/whatsapp-button";

type ManutencaoDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCurrency(value: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value));
}

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function formatBoolean(value: boolean) {
  return value ? "Sim" : "Nao";
}

function getWarrantyStatus(order: {
  warranty_enabled: boolean;
  warranty_signed: boolean;
  warranty_expires_at: string | null;
}) {
  if (!order.warranty_enabled) {
    return {
      label: "Sem garantia",
      className: "border-slate-200 bg-slate-50 text-slate-600"
    };
  }

  if (!order.warranty_signed) {
    return {
      label: "Garantia nao assinada",
      className: "border-amber-200 bg-amber-50 text-amber-800"
    };
  }

  if (isWarrantyExpired(order.warranty_expires_at)) {
    return {
      label: "Garantia vencida",
      className: "border-red-200 bg-red-50 text-red-700"
    };
  }

  return {
    label: "Garantia valida",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };
}

function getWarrantyBlockReason(order: {
  warranty_enabled: boolean;
  warranty_signed: boolean;
  warranty_amount: number | null;
  warranty_unit: string | null;
  warranty_expires_at: string | null;
}) {
  if (!order.warranty_enabled) {
    return "Esta OS nao possui garantia ativa.";
  }

  if (!order.warranty_signed) {
    return "A garantia so pode ser enviada apos o cliente assinar/aceitar.";
  }

  if (!order.warranty_amount || !order.warranty_unit || !order.warranty_expires_at) {
    return "Complete quantidade, unidade e validade da garantia antes de enviar.";
  }

  return null;
}

function Field({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-950">
        {value || "Não informado"}
      </dd>
    </div>
  );
}

export default async function ManutencaoDetalhePage({
  params
}: ManutencaoDetalhePageProps) {
  const { id } = await params;
  const order = await getMaintenanceOrderById(id);

  if (!order) {
    notFound();
  }

  const customer = getMaintenanceCustomer(order);
  const device = getMaintenanceDevice(order);
  const canUseWhatsApp = Boolean(customer?.phone) && isOpenMaintenanceStatus(order.status);
  const shouldShowDeliveryToday =
    canUseWhatsApp && order.expected_delivery_date === todayISO();
  const warrantyStatus = getWarrantyStatus(order);
  const warrantyBlockReason = getWarrantyBlockReason(order);
  const canUseWarrantyWhatsApp = Boolean(customer?.phone) && !warrantyBlockReason;
  const warrantyPeriod = formatWarrantyPeriod(
    order.warranty_amount,
    order.warranty_unit
  );

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase text-teal-700">
            Ordem de serviço
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-950">
              {order.order_number}
            </h1>
            <MaintenanceStatusBadge status={order.status} />
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Detalhes da manutenção, dados do cliente, aparelho e histórico de
            eventos.
          </p>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 sm:h-9"
            href="/manutencoes"
          >
            Voltar para listagem
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-medium text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 sm:h-9"
            href={`/manutencoes/${order.id}/editar`}
          >
            Editar dados básicos
          </Link>
          <DeleteMaintenanceButton
            action={deleteMaintenanceOrderAction.bind(null, order.id)}
          />
        </div>
      </div>

      <MaintenanceStatusControls
        currentStatus={order.status}
        orderId={order.id}
      />

      <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            WhatsApp manual
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Gere a mensagem pelo modelo da organizacao, registre o clique e abra
            o WhatsApp em nova aba para envio manual.
          </p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <WhatsAppButton
            disabled={!canUseWhatsApp}
            label="Avisar recebimento"
            messageType={MESSAGE_TYPES.MAINTENANCE_RECEIVED}
            orderId={order.id}
            variant="primary"
          />
          <WhatsAppButton
            disabled={!canUseWhatsApp}
            label="Avisar que esta pronto"
            messageType={MESSAGE_TYPES.MAINTENANCE_READY}
            orderId={order.id}
          />
          <WhatsAppButton
            disabled={!canUseWhatsApp}
            label="Lembrete de retirada"
            messageType={MESSAGE_TYPES.MAINTENANCE_REMINDER}
            orderId={order.id}
          />
          {shouldShowDeliveryToday ? (
            <WhatsAppButton
              label="Entrega hoje"
              messageType={MESSAGE_TYPES.DELIVERY_TODAY}
              orderId={order.id}
            />
          ) : null}
          <WhatsAppButton
            disabled={!canUseWarrantyWhatsApp}
            label="Enviar garantia no WhatsApp"
            messageType={MESSAGE_TYPES.WARRANTY_NOTICE}
            orderId={order.id}
          />
        </div>
        {!customer?.phone ? (
          <p className="text-xs leading-5 text-slate-500">
            Cliente sem telefone para WhatsApp.
          </p>
        ) : warrantyBlockReason ? (
          <p className="text-xs leading-5 text-amber-700">
            {warrantyBlockReason}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <dl className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
          <Field label="Cliente" value={customer?.name} />
          <Field
            label="Telefone"
            value={customer?.phone ? formatPhoneBR(customer.phone) : null}
          />
          <Field
            label="Aparelho"
            value={
              device
                ? [device.brand, device.model, device.color, device.storage]
                    .filter(Boolean)
                    .join(" - ")
                : null
            }
          />
          <Field label="IMEI" value={device?.imei} />
          <Field
            label="Status atual"
            value={<MaintenanceStatusBadge status={order.status} />}
          />
          <Field
            label="Previsão de entrega"
            value={formatDate(order.expected_delivery_date)}
          />
          <Field
            label="Valor estimado"
            value={formatCurrency(order.estimated_price)}
          />
          <Field label="Valor final" value={formatCurrency(order.final_price)} />
          <Field label="Entregue em" value={formatDateTime(order.delivered_at)} />
          <Field label="Criado em" value={formatDateTime(order.created_at)} />
          <Field
            label="Status da garantia"
            value={
              <span
                className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${warrantyStatus.className}`}
              >
                {warrantyStatus.label}
              </span>
            }
          />
          <Field
            label="Cliente assinou garantia"
            value={formatBoolean(order.warranty_signed)}
          />
          <Field
            label="Periodo da garantia"
            value={warrantyPeriod || "Nao informado"}
          />
          <Field
            label="Inicio da garantia"
            value={formatDate(order.warranty_started_at)}
          />
          <Field
            label="Fim da garantia"
            value={formatDate(order.warranty_expires_at)}
          />
          <Field
            label="Mensagem de garantia"
            value={formatDateTime(order.warranty_message_sent_at)}
          />
          <div className="sm:col-span-2">
            <Field label="Defeito informado" value={order.reported_issue} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Diagnóstico" value={order.diagnosis} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Observações do aparelho" value={device?.notes} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Observações internas" value={order.internal_notes} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Observacoes da garantia" value={order.warranty_notes} />
          </div>
        </dl>

        <div className="grid content-start gap-3">
          <h2 className="text-lg font-semibold text-slate-950">
            Histórico de eventos
          </h2>
          <MaintenanceTimeline events={order.events} />
        </div>
      </div>
    </section>
  );
}
