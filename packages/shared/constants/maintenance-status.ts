export const MAINTENANCE_STATUS = {
  RECEBIDO: "recebido",
  EM_ANALISE: "em_analise",
  AGUARDANDO_PECA: "aguardando_peca",
  EM_MANUTENCAO: "em_manutencao",
  PRONTO_PARA_ENTREGA: "pronto_para_entrega",
  ENTREGUE: "entregue",
  CANCELADO: "cancelado"
} as const;

export type MaintenanceStatus =
  (typeof MAINTENANCE_STATUS)[keyof typeof MAINTENANCE_STATUS];
