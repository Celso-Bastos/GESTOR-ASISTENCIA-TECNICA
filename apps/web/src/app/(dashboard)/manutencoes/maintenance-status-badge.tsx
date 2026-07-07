import {
  maintenanceStatusLabels,
  type MaintenanceStatus
} from "@/lib/maintenance/status";

type MaintenanceStatusBadgeProps = {
  status: MaintenanceStatus;
};

const statusClasses: Record<MaintenanceStatus, string> = {
  recebido: "bg-sky-50 text-sky-700",
  em_analise: "bg-indigo-50 text-indigo-700",
  aguardando_peca: "bg-amber-50 text-amber-800",
  em_manutencao: "bg-orange-50 text-orange-700",
  pronto_para_entrega: "bg-emerald-50 text-emerald-700",
  entregue: "bg-slate-100 text-slate-700",
  cancelado: "bg-red-50 text-red-700"
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
