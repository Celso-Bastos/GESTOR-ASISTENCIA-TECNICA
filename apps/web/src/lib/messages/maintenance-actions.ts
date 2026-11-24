"use server";

import { revalidatePath } from "next/cache";
import { MESSAGE_TYPES, type MessageType, type OperationalMessageType } from "@assistencia/shared/constants/message-types";
import type { maintenanceStatusLabels } from "@/lib/maintenance/status";
import { buildOrderMessageVariables } from "./order-variables";
import { DEFAULT_MESSAGE_TEMPLATES, isOperationalMessageType } from "./defaults";
import { interpolateMessageTemplate } from "./interpolation";
import { buildWhatsAppUrl, normalizePhoneForWhatsApp } from "./whatsapp";
import { getMessageContext } from "./action-context";
import { createClient } from "@/lib/supabase/server";
import { deleteCustomMessageTemplateSchema, type CustomMessageContext } from "@/lib/validations/custom-message-template.schema";
import type { WhatsAppMessageActionState } from "./whatsapp";

type MessageOrder = {
  id: string;
  customer_id: string;
  order_number: string;
  status: keyof typeof maintenanceStatusLabels;
  expected_delivery_date: string | null;
  warranty_enabled: boolean;
  warranty_signed: boolean;
  warranty_amount: number | null;
  warranty_unit: "days" | "months" | null;
  warranty_expires_at: string | null;
  customers:
    | {
        id: string;
        name: string;
        phone: string | null;
      }
    | {
        id: string;
        name: string;
        phone: string | null;
      }[]
    | null;
  devices:
    | {
        id: string;
        model: string;
      }
    | {
        id: string;
        model: string;
      }[]
    | null;
};

function singleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
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

function hasValidWhatsAppPhone(phone: string) {
  const normalized = normalizePhoneForWhatsApp(phone);

  return (
    normalized.startsWith("55") &&
    normalized.length >= 12 &&
    normalized.length <= 13
  );
}

async function getOrderForWhatsApp(organizationId: string, orderId: string) {
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("maintenance_orders")
    .select(
      "id, customer_id, order_number, status, expected_delivery_date, warranty_enabled, warranty_signed, warranty_amount, warranty_unit, warranty_expires_at, customers(id, name, phone), devices(id, model)"
    )
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<MessageOrder>();

  if (orderError) {
    console.error("Erro ao buscar OS para WhatsApp:", orderError);
  }

  return order ?? null;
}

async function getTemplateBody(
  organizationId: string,
  type: OperationalMessageType
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("message_templates")
    .select("body")
    .eq("organization_id", organizationId)
    .eq("type", type)
    .eq("is_active", true)
    .maybeSingle<{ body: string }>();

  if (error) {
    console.error("Erro ao buscar template:", error);
  }

  return data?.body ?? DEFAULT_MESSAGE_TEMPLATES[type].body;
}

export async function logWhatsAppMessageAction(
  orderId: string,
  type: OperationalMessageType,
  _prevState: WhatsAppMessageActionState,
  _formData: FormData
): Promise<WhatsAppMessageActionState> {
  void _prevState;
  void _formData;

  const context = await getMessageContext();

  if (!context.ok) {
    return { error: context.error };
  }

  if (!isOperationalMessageType(type)) {
    return { error: "Tipo de mensagem invalido para envio operacional." };
  }

  const supabase = await createClient();
  const order = await getOrderForWhatsApp(context.organization.id, orderId);

  if (!order) {
    return { error: "Manutencao nao encontrada para esta organizacao." };
  }

  if (type === MESSAGE_TYPES.DELIVERY_TODAY) {
    if (order.expected_delivery_date !== todayISO()) {
      return { error: "Este aviso fica disponivel apenas em entregas de hoje." };
    }
  }

  if (type === MESSAGE_TYPES.WARRANTY_NOTICE) {
    if (!order.warranty_enabled) {
      return { error: "Esta OS nao possui garantia ativa." };
    }

    if (!order.warranty_signed) {
      return {
        error: "A garantia so pode ser enviada apos o cliente assinar/aceitar."
      };
    }

    if (!order.warranty_amount || !order.warranty_unit || !order.warranty_expires_at) {
      return {
        error:
          "Complete a quantidade, unidade e validade da garantia antes de enviar."
      };
    }
  }

  const customer = singleRelation(order.customers);

  if (!customer?.phone) {
    return { error: "Informe um telefone do cliente para abrir o WhatsApp." };
  }

  if (!hasValidWhatsAppPhone(customer.phone)) {
    return { error: "Cliente sem telefone valido para WhatsApp." };
  }

  const templateBody = await getTemplateBody(context.organization.id, type);
  const messageBody = interpolateMessageTemplate(
    templateBody,
    buildOrderMessageVariables({
      order,
      organizationName: context.organization.name
    })
  );
  const openedAt = new Date().toISOString();
  const { error: logError } = await supabase.from("message_logs").insert({
    organization_id: context.organization.id,
    customer_id: customer.id,
    maintenance_order_id: order.id,
    message_type: type as MessageType,
    channel: "whatsapp_manual",
    message_body: messageBody,
    opened_whatsapp_at: openedAt,
    created_by: context.user.id
  });

  if (logError) {
    console.error("Erro ao registrar message_log:", logError);
    return { error: "Nao foi possivel registrar o clique no WhatsApp." };
  }

  if (type === MESSAGE_TYPES.WARRANTY_NOTICE) {
    const { error: updateError } = await supabase
      .from("maintenance_orders")
      .update({ warranty_message_sent_at: openedAt })
      .eq("id", order.id)
      .eq("organization_id", context.organization.id)
      .is("deleted_at", null);

    if (updateError) {
      console.error("Erro ao atualizar warranty_message_sent_at:", updateError);
      return {
        error:
          "O clique foi registrado, mas nao foi possivel atualizar a OS."
      };
    }

    const { error: eventError } = await supabase
      .from("maintenance_events")
      .insert({
        organization_id: context.organization.id,
        maintenance_order_id: order.id,
        event_type: "warranty_message_opened",
        old_status: null,
        new_status: order.status,
        description: "Mensagem de garantia aberta no WhatsApp.",
        created_by: context.user.id,
        created_at: openedAt
      });

    if (eventError) {
      console.error("Erro ao registrar evento de garantia:", eventError);
      return {
        error:
          "O clique foi registrado, mas nao foi possivel registrar o historico."
      };
    }
  }

  revalidatePath(`/manutencoes/${orderId}`);

  return {
    success: "Clique registrado. Abrindo WhatsApp...",
    messageBody,
    whatsappUrl: buildWhatsAppUrl(customer.phone, messageBody)
  };
}

export async function useCustomMessageTemplateAction(
  orderId: string,
  _prevState: WhatsAppMessageActionState,
  formData: FormData
): Promise<WhatsAppMessageActionState> {
  const context = await getMessageContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const parsed = deleteCustomMessageTemplateSchema.safeParse({
    id: String(formData.get("template_id") ?? "")
  });

  if (!parsed.success) {
    return { error: "Selecione uma mensagem personalizada valida." };
  }

  const supabase = await createClient();
  const { data: template, error: templateError } = await supabase
    .from("custom_message_templates")
    .select("id, title, body, context, is_active, deleted_at")
    .eq("id", parsed.data.id)
    .eq("organization_id", context.organization.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("context", ["maintenance", "warranty", "general"])
    .maybeSingle<{
      id: string;
      title: string;
      body: string;
      context: CustomMessageContext;
      is_active: boolean;
      deleted_at: string | null;
    }>();

  if (templateError || !template) {
    if (templateError) {
      console.error("Erro ao buscar mensagem personalizada:", templateError);
    }

    return {
      error:
        "Mensagem personalizada nao encontrada, inativa ou indisponivel para esta OS."
    };
  }

  const order = await getOrderForWhatsApp(context.organization.id, orderId);

  if (!order) {
    return { error: "Manutencao nao encontrada para esta organizacao." };
  }

  const customer = singleRelation(order.customers);

  if (!customer?.phone) {
    return { error: "Informe um telefone do cliente para abrir o WhatsApp." };
  }

  if (!hasValidWhatsAppPhone(customer.phone)) {
    return { error: "Cliente sem telefone valido para WhatsApp." };
  }

  const messageBody = interpolateMessageTemplate(
    template.body,
    buildOrderMessageVariables({
      order,
      organizationName: context.organization.name
    })
  );
  const openedAt = new Date().toISOString();
  const { error: logError } = await supabase.from("message_logs").insert({
    organization_id: context.organization.id,
    customer_id: customer.id,
    maintenance_order_id: order.id,
    message_type: MESSAGE_TYPES.CUSTOM_MESSAGE as MessageType,
    channel: "whatsapp_manual",
    message_body: messageBody,
    opened_whatsapp_at: openedAt,
    created_by: context.user.id
  });

  if (logError) {
    console.error("Erro ao registrar message_log personalizado:", logError);
    return { error: "Nao foi possivel registrar o clique no WhatsApp." };
  }

  revalidatePath(`/manutencoes/${orderId}`);

  return {
    success: "Clique registrado. Abrindo WhatsApp...",
    messageBody,
    whatsappUrl: buildWhatsAppUrl(customer.phone, messageBody)
  };
}
