"use server";

import { revalidatePath } from "next/cache";
import { getMessageContext } from "@/lib/messages/action-context";
import { getActiveCustomMessageTemplatesForMaintenance as queryMaintenanceTemplates } from "@/lib/messages/maintenance-queries";
import {
  logWhatsAppMessageAction as logMaintenanceWhatsApp,
  useCustomMessageTemplateAction as sendMaintenanceMessage
} from "@/lib/messages/maintenance-actions";
import type { WhatsAppMessageActionState } from "@/lib/messages/whatsapp";
import {
  type OperationalMessageType
} from "@assistencia/shared/constants/message-types";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  isOperationalMessageType,
  type MessageTemplate
} from "@/lib/messages/defaults";
import {
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

export type { WhatsAppMessageActionState } from "@/lib/messages/whatsapp";

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

const CUSTOM_MESSAGE_TEMPLATE_SELECT =
  "id, organization_id, title, body, context, is_active, created_by, created_at, updated_at, deleted_at";

function customTemplateFormInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    context: String(formData.get("context") ?? ""),
    is_active: formData.get("is_active") === "on"
  };
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
  return queryMaintenanceTemplates();
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

export async function logWhatsAppMessageAction(
  orderId: string, type: OperationalMessageType,
  prevState: WhatsAppMessageActionState, formData: FormData
): Promise<WhatsAppMessageActionState> {
  return logMaintenanceWhatsApp(orderId, type, prevState, formData);
}

export async function useCustomMessageTemplateAction(
  orderId: string, prevState: WhatsAppMessageActionState, formData: FormData
): Promise<WhatsAppMessageActionState> {
  return sendMaintenanceMessage(orderId, prevState, formData);
}
