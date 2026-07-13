import {
  MESSAGE_TYPES,
  OPERATIONAL_MESSAGE_TYPES,
  type MessageType,
  type OperationalMessageType
} from "@assistencia/shared/constants/message-types";

export type MessageTemplate = {
  id: string;
  organization_id: string;
  type: MessageType;
  title: string;
  body: string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DefaultMessageTemplate = {
  type: OperationalMessageType;
  title: string;
  body: string;
};

export const AVAILABLE_MESSAGE_VARIABLES = [
  "cliente_nome",
  "cliente_telefone",
  "aparelho_modelo",
  "numero_ordem",
  "status",
  "data_entrega",
  "loja_nome"
] as const;

export const DEFAULT_MESSAGE_TEMPLATES: Record<
  OperationalMessageType,
  DefaultMessageTemplate
> = {
  [MESSAGE_TYPES.MAINTENANCE_RECEIVED]: {
    type: MESSAGE_TYPES.MAINTENANCE_RECEIVED,
    title: "Avisar recebimento",
    body: "Ola, {{cliente_nome}}! Recebemos seu aparelho {{aparelho_modelo}} para manutencao. Numero da ordem: {{numero_ordem}}. Entraremos em contato assim que houver atualizacao."
  },
  [MESSAGE_TYPES.MAINTENANCE_READY]: {
    type: MESSAGE_TYPES.MAINTENANCE_READY,
    title: "Avisar que esta pronto",
    body: "Ola, {{cliente_nome}}! Seu aparelho {{aparelho_modelo}} esta pronto para retirada. Ordem: {{numero_ordem}}. Pode passar na loja para buscar."
  },
  [MESSAGE_TYPES.MAINTENANCE_REMINDER]: {
    type: MESSAGE_TYPES.MAINTENANCE_REMINDER,
    title: "Lembrete de retirada",
    body: "Ola, {{cliente_nome}}! Passando para lembrar que seu aparelho {{aparelho_modelo}} ja esta disponivel para retirada. Ordem: {{numero_ordem}}."
  },
  [MESSAGE_TYPES.DELIVERY_TODAY]: {
    type: MESSAGE_TYPES.DELIVERY_TODAY,
    title: "Entrega hoje",
    body: "Ola, {{cliente_nome}}! A previsao de entrega do seu aparelho {{aparelho_modelo}} e hoje. Ordem: {{numero_ordem}}. Qualquer novidade avisaremos por aqui."
  }
};

export const FUTURE_MESSAGE_TEMPLATES = [
  {
    type: MESSAGE_TYPES.PROMOTION_FUTURE,
    title: "Promocoes",
    description: "Futuro: depende de opt-in do cliente para WhatsApp."
  },
  {
    type: MESSAGE_TYPES.SALES_FUTURE,
    title: "Vendas",
    description: "Futuro: comunicacoes comerciais ainda nao entram no MVP 1."
  }
] as const;

export function isOperationalMessageType(
  type: string
): type is OperationalMessageType {
  return OPERATIONAL_MESSAGE_TYPES.includes(type as OperationalMessageType);
}

