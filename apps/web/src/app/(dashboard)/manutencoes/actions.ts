"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/queries";
import {
  requireOrganization,
  type CurrentOrganization
} from "@/lib/organization/queries";
import { getMaintenanceActionContext } from "@/lib/maintenance/action-context";
import { getMaintenanceOrderById as queryMaintenanceOrderById } from "@/lib/maintenance/detail-queries";
import {
  updateMaintenanceStatusAction as updateDetailStatus,
  markMaintenanceAsDeliveredAction as deliverDetailOrder,
  cancelMaintenanceOrderAction as cancelDetailOrder,
  deleteMaintenanceOrderAction as deleteDetailOrder
} from "@/lib/maintenance/detail-actions";
import { normalizePhoneBR } from "@/lib/phone";
import {
  maintenanceStatusLabels,
  type MaintenanceStatus,
  type MaintenanceStatusFilter
} from "@/lib/maintenance/status";
import { calculateWarrantyExpiration } from "@/lib/maintenance/warranty";
import { resolveMaintenanceFinalPrice } from "@/lib/maintenance/pricing";
import { createClient } from "@/lib/supabase/server";
import {
  createMaintenanceOrderSchema,
  createQuickMaintenanceOrderSchema,
  type CreateMaintenanceOrderInput,
  maintenanceSearchSchema,
  updateMaintenanceOrderSchema
} from "@/lib/validations/maintenance.schema";

export type { MaintenanceCustomer, MaintenanceDevice, MaintenanceEvent, MaintenanceOrderListItem, MaintenanceOrderDetail, CustomerOption, MaintenanceActionState } from "@/lib/maintenance/types";
import type { MaintenanceOrderListItem, CustomerOption, MaintenanceActionState } from "@/lib/maintenance/types";

type EditableMaintenanceOrderSnapshot = {
  id: string;
  customer_id: string;
  device_id: string;
  order_number: string;
  reported_issue: string;
  diagnosis: string | null;
  status: MaintenanceStatus;
  expected_delivery_date: string | null;
  delivered_at: string | null;
  estimated_price: number | string | null;
  final_price: number | string | null;
  internal_notes: string | null;
  warranty_enabled: boolean;
  warranty_signed: boolean;
  warranty_amount: number | null;
  warranty_unit: "days" | "months" | null;
  warranty_started_at: string | null;
  warranty_expires_at: string | null;
  warranty_notes: string | null;
};

const MAINTENANCE_ORDER_LIST_SELECT =
  "id, order_number, status, expected_delivery_date, estimated_price, created_at, customers(id, name, phone, phone_normalized), devices(id, brand, model, color, storage, imei, notes)";

const OPEN_STATUSES: MaintenanceStatus[] = [
  "recebido",
  "em_analise",
  "aguardando_peca",
  "em_manutencao",
  "pronto_para_entrega"
];

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

function formValues(formData: FormData) {
  return {
    request_id: String(formData.get("request_id") ?? ""),
    customer_mode: String(formData.get("customer_mode") ?? "existing"),
    customer_id: String(formData.get("customer_id") ?? ""),
    customer_name: String(formData.get("customer_name") ?? ""),
    customer_phone: String(formData.get("customer_phone") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    model: String(formData.get("model") ?? ""),
    color: String(formData.get("color") ?? ""),
    storage: String(formData.get("storage") ?? ""),
    imei: String(formData.get("imei") ?? ""),
    device_notes: String(formData.get("device_notes") ?? ""),
    reported_issue: String(formData.get("reported_issue") ?? ""),
    diagnosis: String(formData.get("diagnosis") ?? ""),
    status: String(formData.get("status") ?? ""),
    expected_delivery_date: String(formData.get("expected_delivery_date") ?? ""),
    delivered_at: String(formData.get("delivered_at") ?? ""),
    estimated_price: String(formData.get("estimated_price") ?? ""),
    final_price: String(formData.get("final_price") ?? ""),
    internal_notes: String(formData.get("internal_notes") ?? ""),
    warranty_enabled: formData.get("warranty_enabled") ? "on" : "",
    warranty_signed: formData.get("warranty_signed") ? "on" : "",
    warranty_amount: String(formData.get("warranty_amount") ?? ""),
    warranty_unit: String(formData.get("warranty_unit") ?? ""),
    warranty_started_at: String(formData.get("warranty_started_at") ?? ""),
    warranty_notes: String(formData.get("warranty_notes") ?? "")
  };
}

function createInput(values: Record<string, string>) {
  return {
    customer_mode: values.customer_mode,
    customer_name: values.customer_name,
    customer_phone: values.customer_phone,
    customer_id: values.customer_id,
    device: {
      brand: values.brand,
      model: values.model,
      color: values.color,
      storage: values.storage,
      imei: values.imei,
      notes: values.device_notes
    },
    reported_issue: values.reported_issue,
    expected_delivery_date: values.expected_delivery_date,
    estimated_price: values.estimated_price,
    internal_notes: values.internal_notes,
    warranty_enabled: values.warranty_enabled === "on",
    warranty_signed: values.warranty_signed === "on",
    warranty_amount: values.warranty_amount,
    warranty_unit: values.warranty_unit || undefined,
    warranty_started_at: values.warranty_started_at,
    warranty_notes: values.warranty_notes
  };
}

function quickFormValues(formData: FormData) {
  const address = String(formData.get("customer_address") ?? "");
  return {
    request_id: String(formData.get("request_id") ?? ""),
    customer_name: String(formData.get("customer_name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    customer_address: address,
    customer_address_action: String(formData.get("customer_address_action") ?? (address.trim() ? "set" : "preserve")),
    customer_address_customer_id: String(formData.get("customer_address_customer_id") ?? ""),
    device_model: String(formData.get("device_model") ?? ""),
    estimated_price: String(formData.get("estimated_price") ?? ""),
    reported_issue: String(formData.get("reported_issue") ?? ""),
    expected_delivery_date: String(formData.get("expected_delivery_date") ?? ""),
    quick_notes: String(formData.get("quick_notes") ?? "")
  };
}

function updateInput(values: Record<string, string>) {
  return {
    device: {
      brand: values.brand,
      model: values.model,
      color: values.color,
      storage: values.storage,
      imei: values.imei,
      notes: values.device_notes
    },
    reported_issue: values.reported_issue,
    diagnosis: values.diagnosis,
    status: values.status,
    expected_delivery_date: values.expected_delivery_date,
    delivered_at: values.delivered_at,
    estimated_price: values.estimated_price,
    final_price: values.final_price,
    internal_notes: values.internal_notes,
    warranty_enabled: values.warranty_enabled === "on",
    warranty_signed: values.warranty_signed === "on",
    warranty_amount: values.warranty_amount,
    warranty_unit: values.warranty_unit || undefined,
    warranty_started_at: values.warranty_started_at,
    warranty_notes: values.warranty_notes
  };
}

function friendlyMaintenanceError(code?: string) {
  if (code === "23505") {
    return "Não foi possível gerar um número de OS único. Tente novamente.";
  }

  return "Não foi possível salvar a manutenção. Tente novamente.";
}

function buildWarrantyPayload(
  input: Pick<
    CreateMaintenanceOrderInput,
    | "warranty_enabled"
    | "warranty_signed"
    | "warranty_amount"
    | "warranty_unit"
    | "warranty_started_at"
    | "warranty_notes"
  >
) {
  if (!input.warranty_enabled) {
    return {
      warranty_enabled: false,
      warranty_signed: false,
      warranty_amount: null,
      warranty_unit: null,
      warranty_started_at: null,
      warranty_expires_at: null,
      warranty_notes: null
    };
  }

  return {
    warranty_enabled: true,
    warranty_signed: input.warranty_signed,
    warranty_amount: input.warranty_amount ?? null,
    warranty_unit: input.warranty_unit ?? null,
    warranty_started_at: input.warranty_started_at ?? null,
    warranty_expires_at: calculateWarrantyExpiration(
      input.warranty_started_at ?? "",
      input.warranty_amount ?? 0,
      input.warranty_unit ?? "days"
    ),
    warranty_notes: input.warranty_notes ?? null
  };
}

function sameValue(a: unknown, b: unknown) {
  return String(a ?? "") === String(b ?? "");
}

function didWarrantyChange(
  order: EditableMaintenanceOrderSnapshot,
  warrantyPayload: ReturnType<typeof buildWarrantyPayload>
) {
  return (
    order.warranty_enabled !== warrantyPayload.warranty_enabled ||
    order.warranty_signed !== warrantyPayload.warranty_signed ||
    !sameValue(order.warranty_amount, warrantyPayload.warranty_amount) ||
    !sameValue(order.warranty_unit, warrantyPayload.warranty_unit) ||
    !sameValue(order.warranty_started_at, warrantyPayload.warranty_started_at) ||
    !sameValue(order.warranty_expires_at, warrantyPayload.warranty_expires_at) ||
    !sameValue(order.warranty_notes, warrantyPayload.warranty_notes)
  );
}

function isMissingRpcError(code?: string) {
  return code === "PGRST202" || code === "42883";
}

function isCustomerPhoneConflict(error: { code?: string; message?: string; details?: string } | null) {
  return error?.code === "23505" && /phone|telefone/i.test(`${error.message ?? ""} ${error.details ?? ""}`);
}

function sanitizeSearchTerm(value: string) {
  return value.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
}

async function getExistingCustomerByPhone(
  organizationId: string,
  phoneNormalized: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("phone_normalized", phoneNormalized)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ id: string; name: string }>();

  if (error) {
    console.error("Erro ao buscar cliente da manutenção rápida:", error);
    return { customer: null, error: "Não foi possível verificar o cliente." };
  }

  return { customer: data ?? null, error: null };
}

async function findSearchRelationIds(organizationId: string, search: string) {
  const supabase = await createClient();
  const term = sanitizeSearchTerm(search);
  const phone = normalizePhoneBR(search);
  const textPattern = `%${term}%`;
  const phonePattern = phone ? `%${phone}%` : textPattern;

  const [{ data: customers }, { data: devices }] = await Promise.all([
    supabase
      .from("customers")
      .select("id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .or(
        `name.ilike.${textPattern},phone.ilike.${textPattern},phone_normalized.ilike.${phonePattern}`
      )
      .limit(1000)
      .returns<Array<{ id: string }>>(),
    supabase
      .from("devices")
      .select("id")
      .eq("organization_id", organizationId)
      .or(`brand.ilike.${textPattern},model.ilike.${textPattern},imei.ilike.${textPattern}`)
      .limit(1000)
      .returns<Array<{ id: string }>>()
  ]);

  return {
    customerIds: (customers ?? []).map((customer) => customer.id),
    deviceIds: (devices ?? []).map((device) => device.id),
    orderPattern: textPattern
  };
}

export async function getCustomersForMaintenance() {
  await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, phone_normalized")
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500)
    .returns<CustomerOption[]>();

  if (error) {
    return [] as CustomerOption[];
  }

  return data ?? [];
}

export type QuickCustomerAddressResult = {
  customer: { id: string; address: string | null } | null;
  error?: string;
};

export async function getQuickCustomerAddress(phone: string): Promise<QuickCustomerAddressResult> {
  const context = await getMaintenanceActionContext();
  if (!context.ok) return { customer: null, error: context.error };
  const parsed = createQuickMaintenanceOrderSchema.shape.phone.safeParse(phone);
  if (!parsed.success || !parsed.data) return { customer: null };
  const supabase = await createClient();
  // Mesma prioridade da RPC: ativo primeiro; depois arquivado mais recente.
  const { data, error } = await supabase.from("customers")
    .select("id, address")
    .eq("organization_id", context.organization.id)
    .eq("phone_normalized", normalizePhoneBR(parsed.data))
    .order("deleted_at", { ascending: false, nullsFirst: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; address: string | null }>();
  if (error) return { customer: null, error: "Não foi possível consultar o endereço. Sem uma alteração explícita, o cadastro será preservado." };
  return { customer: data ?? null };
}

export async function getMaintenanceOrders(input?: {
  q?: string;
  status?: string;
}) {
  await requireAuth();
  const organization = await requireOrganization();
  const parsed = maintenanceSearchSchema.safeParse(input ?? {});

  if (!parsed.success) {
    return {
      orders: [] as MaintenanceOrderListItem[],
      error: parsed.error.issues[0]?.message ?? "Filtros inválidos.",
      filters: { q: "", status: "todos" as MaintenanceStatusFilter }
    };
  }

  const filters = {
    q: parsed.data.q ?? "",
    status: parsed.data.status
  };
  const supabase = await createClient();
  let query = supabase
    .from("maintenance_orders")
    .select(MAINTENANCE_ORDER_LIST_SELECT)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.status === "atrasados") {
    query = query
      .lt("expected_delivery_date", todayISO())
      .not("status", "in", "(entregue,cancelado)");
  } else if (filters.status !== "todos") {
    query = query.eq("status", filters.status);
  }

  if (filters.q) {
    const { customerIds, deviceIds, orderPattern } = await findSearchRelationIds(
      organization.id,
      filters.q
    );
    const searchClauses = [`order_number.ilike.${orderPattern}`];

    if (customerIds.length > 0) {
      searchClauses.push(`customer_id.in.(${customerIds.join(",")})`);
    }

    if (deviceIds.length > 0) {
      searchClauses.push(`device_id.in.(${deviceIds.join(",")})`);
    }

    query = query.or(searchClauses.join(","));
  }

  query = query.limit(500);

  const { data, error } = await query.returns<MaintenanceOrderListItem[]>();

  if (error) {
    return {
      orders: [] as MaintenanceOrderListItem[],
      error: "Não foi possível carregar as manutenções.",
      filters
    };
  }

  return { orders: data ?? [], error: undefined, filters };
}

export async function getMaintenanceOrderById(orderId: string) {
  return queryMaintenanceOrderById(orderId);
}

async function createOrderTransaction(
  context: { organization: CurrentOrganization },
  values: Record<string, string>,
  input: CreateMaintenanceOrderInput & {
    customer_address?: string | null;
    customer_address_action?: "set" | "clear";
    customer_address_customer_id?: string;
  },
  quick = false
): Promise<MaintenanceActionState> {
  if (!z.string().uuid().safeParse(values.request_id).success) {
    return { error: "Reabra o formulário para iniciar uma nova tentativa de cadastro.", values };
  }
  let warranty: ReturnType<typeof buildWarrantyPayload>;
  try { warranty = buildWarrantyPayload(input); }
  catch (error) {
    return { error: error instanceof Error ? error.message : "Revise a garantia.", values };
  }
  const supabase = await createClient();
  const { data: order, error } = await supabase.rpc("create_maintenance_intake", {
    p_organization_id: context.organization.id,
    p_request_id: values.request_id,
    p_customer_id: input.customer_mode === "existing" ? input.customer_id : null,
    p_customer_name: input.customer_name ?? null,
    p_customer_phone: input.customer_phone ?? null,
    p_input: { ...input, ...warranty },
    p_quick: quick
  }).maybeSingle<{ order_id: string; order_number: string }>();
  if (error || !order) {
    console.error("Erro na transacao de abertura da OS:", error);
    return {
      error: quick && error?.code === "40001"
        ? "O cliente vinculado ao telefone mudou. Confira o telefone e o endereço antes de tentar novamente."
        : isMissingRpcError(error?.code) || error?.code === "23502"
        ? "O banco precisa da atualização da Fase 14A. Solicite ao responsável a aplicação das migrations 0009 e 0010."
        : isCustomerPhoneConflict(error)
        ? "Este telefone já pertence a outro cadastro. Não foi possível vincular automaticamente o cliente."
        : "Não foi possível confirmar a abertura. Tente novamente neste formulário: a mesma tentativa não criará outra OS.",
      values
    };
  }
  revalidatePath("/clientes");
  revalidatePath("/manutencoes");
  revalidatePath("/dashboard");
  redirect(`/manutencoes/${order.order_id}`);
}

export async function createMaintenanceOrderAction(
  _prevState: MaintenanceActionState, formData: FormData
): Promise<MaintenanceActionState> {
  const context = await getMaintenanceActionContext();
  const values = formValues(formData);
  if (!context.ok) return { error: context.error, values };
  const parsed = createMaintenanceOrderSchema.safeParse(createInput(values));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados da manutenção.", values };
  return createOrderTransaction(context, values, parsed.data);
}

export async function createQuickMaintenanceOrderAction(
  _prevState: MaintenanceActionState, formData: FormData
): Promise<MaintenanceActionState> {
  const context = await getMaintenanceActionContext();
  const values = quickFormValues(formData);
  if (!context.ok) return { error: context.error, values };
  const parsed = createQuickMaintenanceOrderSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados da manutenção rápida.", values };
  return createOrderTransaction(context, values, {
    customer_mode: "new",
    customer_name: parsed.data.customer_name,
    customer_phone: parsed.data.phone,
    ...(parsed.data.customer_address_action === "preserve" ? {} : {
      customer_address: parsed.data.customer_address,
      customer_address_action: parsed.data.customer_address_action,
      ...(parsed.data.customer_address_customer_id ? { customer_address_customer_id: parsed.data.customer_address_customer_id } : {})
    }),
    device: { model: parsed.data.device_model, brand: undefined, color: undefined, storage: undefined, imei: undefined, notes: undefined },
    reported_issue: parsed.data.reported_issue,
    expected_delivery_date: parsed.data.expected_delivery_date,
    internal_notes: [parsed.data.quick_notes, !parsed.data.customer_name && !parsed.data.phone
      ? "Criada sem dados de cliente. Completar cadastro posteriormente." : ""].filter(Boolean).join("\n\n"),
    estimated_price: parsed.data.estimated_price,
    warranty_enabled: false,
    warranty_signed: false,
    warranty_amount: undefined, warranty_unit: undefined, warranty_started_at: undefined, warranty_notes: undefined
  }, true);
}

export async function updateMaintenanceOrderAction(
  orderId: string,
  _prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  const context = await getMaintenanceActionContext();
  const values = formValues(formData);

  if (!context.ok) {
    return { error: context.error, values };
  }

  const parsed = updateMaintenanceOrderSchema.safeParse(updateInput(values));

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Revise os dados da manutenção.",
      values
    };
  }

  const { organization, userId } = context;
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("maintenance_orders")
    .select(
      "id, customer_id, device_id, order_number, reported_issue, diagnosis, status, expected_delivery_date, delivered_at, estimated_price, final_price, internal_notes, warranty_enabled, warranty_signed, warranty_amount, warranty_unit, warranty_started_at, warranty_expires_at, warranty_notes"
    )
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle<EditableMaintenanceOrderSnapshot>();

  if (orderError || !order) {
    if (orderError) {
      console.error("Erro ao buscar maintenance_order para edicao:", orderError);
    }

    return {
      error: "Manutenção não encontrada para esta organização.",
      values
    };
  }

  const customerName = values.customer_name.trim() || "Cliente não informado";
  const customerPhone = values.customer_phone.trim();
  const customerPhoneNormalized = customerPhone
    ? normalizePhoneBR(customerPhone)
    : null;

  if (
    customerPhone &&
    (!customerPhoneNormalized || customerPhoneNormalized.length < 10 || customerPhoneNormalized.length > 11)
  ) {
    return {
      error: "Informe um telefone válido com DDD.",
      values
    };
  }

  if (customerPhoneNormalized) {
    const duplicate = await getExistingCustomerByPhone(
      organization.id,
      customerPhoneNormalized
    );

    if (duplicate.error) {
      return {
        error: duplicate.error,
        values
      };
    }

    if (duplicate.customer && duplicate.customer.id !== order.customer_id) {
      return {
        error: "Ja existe um cliente ativo com esse telefone.",
        values
      };
    }
  }

  const { error: customerError } = await supabase
    .from("customers")
    .update({
      name: customerName,
      phone: customerPhone || null,
      phone_normalized: customerPhoneNormalized
    })
    .eq("id", order.customer_id)
    .eq("organization_id", organization.id)
    .is("deleted_at", null);

  if (customerError) {
    console.error("Erro ao atualizar cliente da maintenance_order:", customerError);

    return {
      error:
        customerError.code === "23505"
          ? "Ja existe um cliente ativo com esse telefone."
          : "Não foi possível atualizar os dados do cliente.",
      values
    };
  }

  let warrantyPayload: ReturnType<typeof buildWarrantyPayload>;

  try {
    warrantyPayload = buildWarrantyPayload(parsed.data);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel calcular a validade da garantia.",
      values
    };
  }

  const deliveredAt =
    parsed.data.status === "entregue"
      ? parsed.data.delivered_at ?? new Date().toISOString()
      : null;
  const estimatedPrice = formData.has("estimated_price")
    ? parsed.data.estimated_price ?? null : order.estimated_price;
  const submittedFinalPrice = formData.has("final_price")
    ? parsed.data.final_price ?? null : order.final_price;
  const finalPrice = resolveMaintenanceFinalPrice(parsed.data.status, estimatedPrice, submittedFinalPrice);
  const fillsFinalPrice = parsed.data.status === "entregue"
    && submittedFinalPrice == null && finalPrice != null;

  const { error: deviceError } = await supabase
    .from("devices")
    .update({
      brand: parsed.data.device.brand ?? null,
      model: parsed.data.device.model,
      color: parsed.data.device.color ?? null,
      storage: parsed.data.device.storage ?? null,
      imei: parsed.data.device.imei ?? null,
      notes: parsed.data.device.notes ?? null
    })
    .eq("id", order.device_id)
    .eq("customer_id", order.customer_id)
    .eq("organization_id", organization.id);

  if (deviceError) {
    console.error("Erro ao atualizar device da maintenance_order:", deviceError);

    return {
      error: "Não foi possível atualizar os dados do aparelho.",
      values
    };
  }

  let orderUpdate = supabase
    .from("maintenance_orders")
    .update({
      reported_issue: parsed.data.reported_issue,
      diagnosis: parsed.data.diagnosis ?? null,
      status: parsed.data.status,
      expected_delivery_date: parsed.data.expected_delivery_date ?? null,
      delivered_at: deliveredAt,
      estimated_price: estimatedPrice,
      final_price: finalPrice,
      internal_notes: parsed.data.internal_notes ?? null,
      ...warrantyPayload
    })
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null);
  if (fillsFinalPrice || !formData.has("final_price")) {
    // Não substituir um valor final informado por outra sessão após a leitura.
    orderUpdate = order.final_price == null
      ? orderUpdate.is("final_price", null)
      : orderUpdate.eq("final_price", order.final_price);
  }
  const { data: updated, error } = await orderUpdate.select("id").maybeSingle<{ id: string }>();

  if (error || !updated) {
    console.error("Erro ao atualizar maintenance_order:", error);

    return {
      error: friendlyMaintenanceError(error?.code),
      values
    };
  }

  const warrantyChanged = didWarrantyChange(order, warrantyPayload);
  const statusChanged = order.status !== parsed.data.status;
  const detailsChanged = [
    !sameValue(order.reported_issue, parsed.data.reported_issue),
    !sameValue(order.diagnosis, parsed.data.diagnosis),
    !sameValue(order.expected_delivery_date, parsed.data.expected_delivery_date),
    !sameValue(order.delivered_at, deliveredAt),
    !sameValue(order.estimated_price, estimatedPrice),
    !sameValue(order.final_price, finalPrice),
    !sameValue(order.internal_notes, parsed.data.internal_notes)
  ].some(Boolean);
  const eventRows: Array<{
    organization_id: string;
    maintenance_order_id: string;
    event_type: string;
    old_status: MaintenanceStatus | null;
    new_status: MaintenanceStatus | null;
    description: string;
    created_by: string;
  }> = [];

  if (statusChanged) {
    eventRows.push({
      organization_id: organization.id,
      maintenance_order_id: order.id,
      event_type: "status_changed",
      old_status: order.status,
      new_status: parsed.data.status,
      description: `Status da ordem ${order.order_number} alterado de ${maintenanceStatusLabels[order.status]} para ${maintenanceStatusLabels[parsed.data.status]}.`,
      created_by: userId
    });
  }

  if (warrantyChanged) {
    eventRows.push({
      organization_id: organization.id,
      maintenance_order_id: order.id,
      event_type: "warranty_updated",
      old_status: order.status,
      new_status: parsed.data.status,
      description: `Garantia da ordem ${order.order_number} atualizada pela edicao da OS.`,
      created_by: userId
    });
  }

  if (detailsChanged && !statusChanged && !warrantyChanged) {
    eventRows.push({
      organization_id: organization.id,
      maintenance_order_id: order.id,
      event_type: "maintenance_updated",
      old_status: order.status,
      new_status: parsed.data.status,
      description: `Dados da ordem ${order.order_number} atualizados.`,
      created_by: userId
    });
  }

  if (eventRows.length > 0) {
    const { error: eventError } = await supabase
      .from("maintenance_events")
      .insert(eventRows);

    if (eventError) {
      console.error("Erro ao registrar maintenance_event de edicao:", eventError);
      return {
        error:
          "A manutencao foi atualizada, mas nao foi possivel registrar o historico.",
        values
      };
    }
  }

  revalidatePath("/manutencoes");
  revalidatePath(`/manutencoes/${orderId}`);
  revalidatePath("/dashboard");
  redirect(`/manutencoes/${orderId}`);
}

// O compilador de Server Actions exige exports async explícitos neste módulo.
// As telas antigas preservam seus imports; o detalhe usa os módulos específicos.
export async function updateMaintenanceStatusAction(
  orderId: string, prevState: MaintenanceActionState, formData: FormData
): Promise<MaintenanceActionState> {
  return updateDetailStatus(orderId, prevState, formData);
}

export async function markMaintenanceAsDeliveredAction(
  orderId: string, prevState: MaintenanceActionState, formData: FormData
): Promise<MaintenanceActionState> {
  return deliverDetailOrder(orderId, prevState, formData);
}

export async function cancelMaintenanceOrderAction(
  orderId: string, prevState: MaintenanceActionState, formData: FormData
): Promise<MaintenanceActionState> {
  return cancelDetailOrder(orderId, prevState, formData);
}

export async function deleteMaintenanceOrderAction(
  orderId: string, prevState: MaintenanceActionState, formData: FormData
): Promise<MaintenanceActionState> {
  return deleteDetailOrder(orderId, prevState, formData);
}

export async function getMaintenanceDashboardMetrics(organizationId: string) {
  const supabase = await createClient();
  const today = todayISO();

  const open = await supabase
    .from("maintenance_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", OPEN_STATUSES);

  const todayDeliveries = await supabase
    .from("maintenance_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("expected_delivery_date", today)
    .not("status", "in", "(entregue,cancelado)");

  const waitingParts = await supabase
    .from("maintenance_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("status", "aguardando_peca");

  const ready = await supabase
    .from("maintenance_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("status", "pronto_para_entrega");

  const overdue = await supabase
    .from("maintenance_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .lt("expected_delivery_date", today)
    .not("status", "in", "(entregue,cancelado)");

  return {
    open: open.count ?? 0,
    todayDeliveries: todayDeliveries.count ?? 0,
    waitingParts: waitingParts.count ?? 0,
    ready: ready.count ?? 0,
    overdue: overdue.count ?? 0
  };
}

export async function getMaintenanceDashboardAlerts(organizationId: string) {
  const supabase = await createClient();
  const today = todayISO();

  const todayDeliveries = await supabase
    .from("maintenance_orders")
    .select(MAINTENANCE_ORDER_LIST_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("expected_delivery_date", today)
    .not("status", "in", "(entregue,cancelado)")
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<MaintenanceOrderListItem[]>();

  const ready = await supabase
    .from("maintenance_orders")
    .select(MAINTENANCE_ORDER_LIST_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("status", "pronto_para_entrega")
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<MaintenanceOrderListItem[]>();

  return {
    todayDeliveries: todayDeliveries.data ?? [],
    ready: ready.data ?? []
  };
}
