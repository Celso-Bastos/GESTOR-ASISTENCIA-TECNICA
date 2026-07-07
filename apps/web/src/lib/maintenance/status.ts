export const maintenanceStatuses = [
  "recebido",
  "em_analise",
  "aguardando_peca",
  "em_manutencao",
  "pronto_para_entrega",
  "entregue",
  "cancelado"
] as const;

export type MaintenanceStatus = (typeof maintenanceStatuses)[number];

export type MaintenanceStatusFilter = MaintenanceStatus | "todos" | "atrasados";

export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  recebido: "Recebido",
  em_analise: "Em análise",
  aguardando_peca: "Aguardando peça",
  em_manutencao: "Em manutenção",
  pronto_para_entrega: "Pronto para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado"
};

export const maintenanceStatusFilterLabels: Record<
  MaintenanceStatusFilter,
  string
> = {
  todos: "Todos",
  ...maintenanceStatusLabels,
  atrasados: "Atrasados"
};

export function isOpenMaintenanceStatus(status: MaintenanceStatus) {
  return status !== "entregue" && status !== "cancelado";
}
