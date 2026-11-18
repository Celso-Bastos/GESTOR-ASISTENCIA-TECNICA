import {
  maintenanceStatusLabels,
  type MaintenanceStatus
} from "@/lib/maintenance/status";

type MaintenanceStatusBadgeProps = {
  status: MaintenanceStatus;
};

const statusClasses: Record<MaintenanceStatus, string> = {
  recebido: "bg-info-soft text-info",
  em_analise: "bg-indigo-soft text-indigo",
  aguardando_peca: "bg-warning-soft text-warning-strong",
  em_manutencao: "bg-orange-soft text-orange",
  pronto_para_entrega: "bg-success-soft text-success",
  entregue: "bg-canvas text-body",
  cancelado: "bg-danger-soft text-danger"
};

export function MaintenanceStatusBadge({ status }: MaintenanceStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {maintenanceStatusLabels[status]}
    </span>
  );
}
