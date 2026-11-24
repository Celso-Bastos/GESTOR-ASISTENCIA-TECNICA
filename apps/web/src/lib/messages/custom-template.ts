export const customMessageContexts = [
  "maintenance",
  "warranty",
  "customer",
  "sales",
  "general"
] as const;

export type CustomMessageContext = (typeof customMessageContexts)[number];

export const customMessageContextLabels: Record<CustomMessageContext, string> = {
  maintenance: "Manutencao",
  warranty: "Garantia",
  customer: "Cliente",
  sales: "Venda",
  general: "Geral"
};

// DTO usado pela OS: sem metadados administrativos ou identificador de organização.
export type MaintenanceMessageTemplate = {
  id: string;
  title: string;
  body: string;
  context: CustomMessageContext;
};
