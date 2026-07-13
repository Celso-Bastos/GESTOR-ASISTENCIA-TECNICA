"use server";

import { revalidatePath } from "next/cache";
import {
  MESSAGE_TYPES,
  type MessageType,
  type OperationalMessageType
} from "@assistencia/shared/constants/message-types";
import { getCurrentUser } from "@/lib/auth/queries";
import { maintenanceStatusLabels } from "@/lib/maintenance/status";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  isOperationalMessageType,
  type MessageTemplate
} from "@/lib/messages/defaults";
import { interpolateMessageTemplate } from "@/lib/messages/interpolation";
import { buildWhatsAppUrl } from "@/lib/messages/whatsapp";
import {
  getCurrentOrganization,
  requireOrganization
} from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";

export type MessageTemplateActionState = {
  error?: string;
  success?: string;
};

export type WhatsAppMessageActionState = {
  error?: string;
  success?: string;
  whatsappUrl?: string;
};

type MessageOrder = {
  id: string;
  customer_id: string;
  order_number: string;
  status: keyof typeof maintenanceStatusLabels;
  expected_delivery_date: string | null;
  customers:
    | {
        id: string;
        name: string;
        phone: string;
      }
    | {
        id: string;
        name: string;
        phone: string;
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

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(`${value}T00:00:00`));
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

async function getMessageContext() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false as const,
      error: "Sua sessao expirou. Entre novamente para continuar."
    };
  }

  const organization = await getCurrentOrganization();

  if (!organization) {
    return {
      ok: false as const,
      error: "Nenhuma organizacao ativa foi encontrada para este usuario."
    };
  }

  return { ok: true as const, user, organization };
}

export async function ensureDefaultMessageTemplates(organizationId: string) {
  const supabase = await createClient();
  const rows = Object.values(DEFAULT_MESSAGE_TEMPLATES).map((template) => ({
    organization_id: organizationId,
    type: template.type,
    title: template.title,
    body: template.body,
    is_active: true
  }));

  const { error } = await supabase
    .from("message_templates")
    .upsert(rows, {
      onConflict: "organization_id,type",
      ignoreDuplicates: true
    });

  if (error) {
    console.error("Erro ao criar templates padrao:", error);
  }
}

export async function getMessageTemplatesForCurrentOrganization() {
  const organization = await requireOrganization();
  await ensureDefaultMessageTemplates(organization.id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("message_templates")
    .select(
      "id, organization_id, type, title, body, is_active, created_at, updated_at"
    )
    .eq("organization_id", organization.id)
    .order("type", { ascending: true })
    .returns<MessageTemplate[]>();

  if (error) {
    console.error("Erro ao carregar templates:", error);
    return [];
  }

  const order = Object.keys(DEFAULT_MESSAGE_TEMPLATES);

  return (data ?? []).filter((template) => isOperationalMessageType(template.type)).sort(
    (left, right) => order.indexOf(left.type) - order.indexOf(right.type)
  );
}

export async function updateMessageTemplateAction(
  type: OperationalMessageType,
  _prevState: MessageTemplateActionState,
  formData: FormData
): Promise<MessageTemplateActionState> {
  const context = await getMessageContext();

  if (!context.ok) {
    return { error: context.error };
  }

  if (!isOperationalMessageType(type)) {
    return { error: "Tipo de mensagem invalido para o MVP 1." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title || !body) {
    return { error: "Informe titulo e mensagem do modelo." };
  }

  if (body.length > 1200) {
    return { error: "A mensagem deve ter no maximo 1200 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").upsert(
    {
      organization_id: context.organization.id,
      type,
      title,
      body,
      is_active: true
    },
    { onConflict: "organization_id,type" }
  );

  if (error) {
    console.error("Erro ao salvar template:", error);
    return { error: "Nao foi possivel salvar o modelo de mensagem." };
  }

  revalidatePath("/mensagens");

  return { success: "Modelo salvo." };
}

export async function restoreDefaultMessageTemplateAction(
  type: OperationalMessageType,
  _prevState: MessageTemplateActionState,
  _formData: FormData
): Promise<MessageTemplateActionState> {
  void _prevState;
  void _formData;

  const context = await getMessageContext();

  if (!context.ok) {
    return { error: context.error };
  }

  if (!isOperationalMessageType(type)) {
    return { error: "Tipo de mensagem invalido para o MVP 1." };
  }

  const template = DEFAULT_MESSAGE_TEMPLATES[type];
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").upsert(
    {
      organization_id: context.organization.id,
      type,
      title: template.title,
      body: template.body,
      is_active: true
    },
    { onConflict: "organization_id,type" }
  );

  if (error) {
    console.error("Erro ao restaurar template:", error);
    return { error: "Nao foi possivel restaurar o modelo padrao." };
  }

  revalidatePath("/mensagens");

  return { success: "Modelo padrao restaurado." };
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
  const { data: order, error: orderError } = await supabase
    .from("maintenance_orders")
    .select(
      "id, customer_id, order_number, status, expected_delivery_date, customers(id, name, phone), devices(id, model)"
    )
    .eq("id", orderId)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .maybeSingle<MessageOrder>();

  if (orderError || !order) {
    return { error: "Manutencao nao encontrada para esta organizacao." };
  }

  if (type === MESSAGE_TYPES.DELIVERY_TODAY) {
    if (order.expected_delivery_date !== todayISO()) {
      return { error: "Este aviso fica disponivel apenas em entregas de hoje." };
    }
  }

  const customer = singleRelation(order.customers);
  const device = singleRelation(order.devices);

  if (!customer?.phone) {
    return { error: "Cliente sem telefone para WhatsApp." };
  }

  const templateBody = await getTemplateBody(context.organization.id, type);
  const messageBody = interpolateMessageTemplate(templateBody, {
    cliente_nome: customer.name,
    cliente_telefone: customer.phone,
    aparelho_modelo: device?.model,
    numero_ordem: order.order_number,
    status: maintenanceStatusLabels[order.status],
    data_entrega: formatDate(order.expected_delivery_date),
    loja_nome: context.organization.name
  });
  const { error: logError } = await supabase.from("message_logs").insert({
    organization_id: context.organization.id,
    customer_id: customer.id,
    maintenance_order_id: order.id,
    message_type: type as MessageType,
    channel: "whatsapp_manual",
    message_body: messageBody,
    opened_whatsapp_at: new Date().toISOString(),
    created_by: context.user.id
  });

  if (logError) {
    console.error("Erro ao registrar message_log:", logError);
    return { error: "Nao foi possivel registrar o clique no WhatsApp." };
  }

  revalidatePath(`/manutencoes/${orderId}`);

  return {
    success: "Clique registrado. Abrindo WhatsApp...",
    whatsappUrl: buildWhatsAppUrl(customer.phone, messageBody)
  };
}
