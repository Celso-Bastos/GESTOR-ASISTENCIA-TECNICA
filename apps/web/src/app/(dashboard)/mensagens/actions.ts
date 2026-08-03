"use server";

import { revalidatePath } from "next/cache";
import {
  MESSAGE_TYPES,
  type MessageType,
  type OperationalMessageType
} from "@assistencia/shared/constants/message-types";
import { getCurrentUser } from "@/lib/auth/queries";
import { maintenanceStatusLabels } from "@/lib/maintenance/status";
import { formatWarrantyPeriod } from "@/lib/maintenance/warranty";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  isOperationalMessageType,
  type MessageTemplate
} from "@/lib/messages/defaults";
import {
  interpolateMessageTemplate,
  type MessageVariables
} from "@/lib/messages/interpolation";
import {
  buildWhatsAppUrl,
  normalizePhoneForWhatsApp
} from "@/lib/messages/whatsapp";
import {
  getCurrentOrganization,
  requireOrganization
} from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import {
  createCustomMessageTemplateSchema,
  customMessageContexts,
  deleteCustomMessageTemplateSchema,
  type CustomMessageContext,
  updateCustomMessageTemplateSchema
} from "@/lib/validations/custom-message-template.schema";

export type MessageTemplateActionState = {
  error?: string;
  success?: string;
};

export type WhatsAppMessageActionState = {
  error?: string;
  success?: string;
  whatsappUrl?: string;
};

export type CustomMessageTemplateActionState = {
  error?: string;
  success?: string;
};

export type CustomMessageTemplate = {
  id: string;
  organization_id: string;
  title: string;
  body: string;
  context: CustomMessageContext;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

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

const CUSTOM_MESSAGE_TEMPLATE_SELECT =
  "id, organization_id, title, body, context, is_active, created_by, created_at, updated_at, deleted_at";

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

function hasValidWhatsAppPhone(phone: string) {
  const normalized = normalizePhoneForWhatsApp(phone);

  return (
    normalized.startsWith("55") &&
    normalized.length >= 12 &&
    normalized.length <= 13
  );
}

function customTemplateFormInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    context: String(formData.get("context") ?? ""),
    is_active: formData.get("is_active") === "on"
  };
}

function buildOrderMessageVariables({
  order,
  organizationName
}: {
  order: MessageOrder;
  organizationName: string;
}): MessageVariables {
  const customer = singleRelation(order.customers);
  const device = singleRelation(order.devices);
  const warrantyPeriod = formatWarrantyPeriod(
    order.warranty_amount,
    order.warranty_unit
  );

  return {
    cliente_nome: customer?.name,
    cliente_telefone: customer?.phone,
    aparelho_modelo: device?.model,
    numero_ordem: order.order_number,
    status: maintenanceStatusLabels[order.status],
    data_entrega: formatDate(order.expected_delivery_date),
    loja_nome: organizationName,
    garantia_periodo: warrantyPeriod,
    garantia_validade: formatDate(order.warranty_expires_at)
  };
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

export async function getCustomMessageTemplates(context?: CustomMessageContext) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("custom_message_templates")
    .select(CUSTOM_MESSAGE_TEMPLATE_SELECT)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (context && customMessageContexts.includes(context)) {
    query = query.eq("context", context);
  }

  const { data, error } = await query.returns<CustomMessageTemplate[]>();

  if (error) {
    console.error("Erro ao carregar mensagens personalizadas:", error);
    return [];
  }

  return data ?? [];
}

export async function getActiveCustomMessageTemplatesForMaintenance() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_message_templates")
    .select(CUSTOM_MESSAGE_TEMPLATE_SELECT)
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("context", ["maintenance", "warranty", "general"])
    .order("title", { ascending: true })
    .returns<CustomMessageTemplate[]>();

  if (error) {
    console.error("Erro ao carregar mensagens personalizadas da OS:", error);
    return [];
  }

  return data ?? [];
}

export async function createCustomMessageTemplateAction(
  _prevState: CustomMessageTemplateActionState,
  formData: FormData
): Promise<CustomMessageTemplateActionState> {
  const context = await getMessageContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const parsed = createCustomMessageTemplateSchema.safeParse(
    customTemplateFormInput(formData)
  );

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise a mensagem personalizada."
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("custom_message_templates").insert({
    organization_id: context.organization.id,
    title: parsed.data.title,
    body: parsed.data.body,
    context: parsed.data.context,
    is_active: parsed.data.is_active,
    created_by: context.user.id
  });

  if (error) {
    console.error("Erro ao criar mensagem personalizada:", error);
    return { error: "Nao foi possivel criar a mensagem personalizada." };
  }

  revalidatePath("/mensagens");

  return { success: "Mensagem personalizada criada." };
}

export async function updateCustomMessageTemplateAction(
  templateId: string,
  _prevState: CustomMessageTemplateActionState,
  formData: FormData
): Promise<CustomMessageTemplateActionState> {
  const context = await getMessageContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const parsed = updateCustomMessageTemplateSchema.safeParse({
    id: templateId,
    ...customTemplateFormInput(formData)
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise a mensagem personalizada."
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_message_templates")
    .update({
      title: parsed.data.title,
      body: parsed.data.body,
      context: parsed.data.context,
      is_active: parsed.data.is_active
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    console.error("Erro ao atualizar mensagem personalizada:", error);
    return { error: "Nao foi possivel atualizar a mensagem personalizada." };
  }

  revalidatePath("/mensagens");
  revalidatePath("/manutencoes");

  return { success: "Mensagem personalizada atualizada." };
}

export async function disableCustomMessageTemplateAction(
  templateId: string,
  _prevState: CustomMessageTemplateActionState,
  _formData: FormData
): Promise<CustomMessageTemplateActionState> {
  void _prevState;
  void _formData;

  const context = await getMessageContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const parsed = deleteCustomMessageTemplateSchema.safeParse({ id: templateId });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Mensagem personalizada invalida."
    };
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_message_templates")
    .update({
      is_active: false,
      deleted_at: now
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    console.error("Erro ao desativar mensagem personalizada:", error);
    return { error: "Nao foi possivel desativar a mensagem personalizada." };
  }

  revalidatePath("/mensagens");
  revalidatePath("/manutencoes");

  return { success: "Mensagem personalizada desativada." };
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
    return { error: "Cliente sem telefone para WhatsApp." };
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
    return { error: "Cliente sem telefone para WhatsApp." };
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
    whatsappUrl: buildWhatsAppUrl(customer.phone, messageBody)
  };
}
