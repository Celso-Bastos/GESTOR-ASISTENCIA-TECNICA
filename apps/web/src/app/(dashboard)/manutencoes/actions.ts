"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth, getCurrentUser } from "@/lib/auth/queries";
import {
  getCurrentOrganization,
  requireOrganization,
  type CurrentOrganization
} from "@/lib/organization/queries";
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
  deleteMaintenanceOrderSchema,
  type CreateMaintenanceOrderInput,
  maintenanceSearchSchema,
  updateMaintenanceOrderSchema,
  updateMaintenanceStatusSchema
} from "@/lib/validations/maintenance.schema";

export type MaintenanceCustomer = {
  id: string;
  name: string;
  phone: string | null;
  phone_normalized: string | null;
};

export type MaintenanceDevice = {
  id: string;
  brand: string | null;
  model: string;
  color: string | null;
  storage: string | null;
  imei: string | null;
  notes: string | null;
};

export type MaintenanceEvent = {
  id: string;
  event_type: string;
  old_status: MaintenanceStatus | null;
  new_status: MaintenanceStatus | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

export type MaintenanceOrderListItem = {
  id: string;
  order_number: string;
  status: MaintenanceStatus;
  expected_delivery_date: string | null;
  estimated_price: number | string | null;
  created_at: string;
  customers: MaintenanceCustomer | MaintenanceCustomer[] | null;
  devices: MaintenanceDevice | MaintenanceDevice[] | null;
};

export type MaintenanceOrderDetail = {
  id: string;
  organization_id: string;
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
  warranty_message_sent_at: string | null;
  created_at: string;
  updated_at: string | null;
  customers: MaintenanceCustomer | MaintenanceCustomer[] | null;
  devices: MaintenanceDevice | MaintenanceDevice[] | null;
  events: MaintenanceEvent[];
};

export type CustomerOption = MaintenanceCustomer;

export type MaintenanceActionState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
};

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
  return {
    request_id: String(formData.get("request_id") ?? ""),
    customer_name: String(formData.get("customer_name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
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

async function getMaintenanceActionContext(): Promise<
  | {
      ok: true;
      userId: string;
      organization: CurrentOrganization;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      error: "Sua sessao expirou. Entre novamente para continuar."
    };
  }

  const organization = await getCurrentOrganization();

  if (!organization) {
    return {
      ok: false,
      error: "Nenhuma organização ativa foi encontrada para este usuário."
    };
  }

  return { ok: true, userId: user.id, organization };
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
  await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("maintenance_orders")
    .select(
      "id, organization_id, customer_id, device_id, order_number, reported_issue, diagnosis, status, expected_delivery_date, delivered_at, estimated_price, final_price, internal_notes, warranty_enabled, warranty_signed, warranty_amount, warranty_unit, warranty_started_at, warranty_expires_at, warranty_notes, warranty_message_sent_at, created_at, updated_at, customers(id, name, phone, phone_normalized), devices(id, brand, model, color, storage, imei, notes)"
    )
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle<Omit<MaintenanceOrderDetail, "events">>();

  if (error || !data) {
    return null;
  }

  const { data: events } = await supabase
    .from("maintenance_events")
    .select(
      "id, event_type, old_status, new_status, description, created_by, created_at"
    )
    .eq("organization_id", organization.id)
    .eq("maintenance_order_id", orderId)
    .order("created_at", { ascending: false })
    .returns<MaintenanceEvent[]>();

  return {
    ...data,
    events: events ?? []
  } satisfies MaintenanceOrderDetail;
}

async function createOrderTransaction(
  context: { organization: CurrentOrganization },
  values: Record<string, string>,
  input: CreateMaintenanceOrderInput,
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
      error: isMissingRpcError(error?.code) || error?.code === "23502"
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

async function changeMaintenanceStatus(
  orderId: string,
  newStatus: MaintenanceStatus,
  description?: string
): Promise<MaintenanceActionState> {
  const context = await getMaintenanceActionContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const { organization, userId } = context;
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("maintenance_orders")
    .select("id, order_number, status, delivered_at, estimated_price, final_price")
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      order_number: string;
      status: MaintenanceStatus;
      delivered_at: string | null;
      estimated_price: number | string | null;
      final_price: number | string | null;
    }>();

  if (orderError || !order) {
    return { error: "Manutenção não encontrada para esta organização." };
  }

  const finalPrice = resolveMaintenanceFinalPrice(newStatus, order.estimated_price, order.final_price);
  const fillsFinalPrice = newStatus === "entregue" && order.final_price == null && finalPrice != null;
  if (order.status === newStatus && !fillsFinalPrice) {
    return { success: "A manutenção já está neste status." };
  }

  const updatePayload: {
    status: MaintenanceStatus;
    delivered_at?: string | null;
    final_price?: number | string | null;
  } = {
    status: newStatus
  };

  if (newStatus === "entregue") {
    updatePayload.delivered_at = order.status === "entregue"
      ? order.delivered_at ?? new Date().toISOString() : new Date().toISOString();
    if (fillsFinalPrice) updatePayload.final_price = finalPrice;
  } else if (order.status === "entregue") {
    updatePayload.delivered_at = null;
  }

  let statusUpdate = supabase
    .from("maintenance_orders")
    .update(updatePayload)
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .eq("status", order.status);
  if (fillsFinalPrice) {
    statusUpdate = statusUpdate.is("final_price", null)
      .eq("estimated_price", order.estimated_price!);
  }
  const { data: updated, error } = await statusUpdate.select("id").maybeSingle<{ id: string }>();

  if (error || !updated) {
    return { error: "Não foi possível alterar o status da manutenção." };
  }

  const oldLabel = maintenanceStatusLabels[order.status];
  const newLabel = maintenanceStatusLabels[newStatus];

  const { error: eventError } = await supabase.from("maintenance_events").insert({
    organization_id: organization.id,
    maintenance_order_id: order.id,
    event_type: order.status === newStatus ? "maintenance_updated" : "status_changed",
    old_status: order.status,
    new_status: newStatus,
    description: order.status === newStatus
      ? `Valor final da ordem ${order.order_number} preenchido com o valor estimado.`
      : description ||
      `Status da ordem ${order.order_number} alterado de ${oldLabel} para ${newLabel}.`,
    created_by: userId
  });

  if (eventError) {
    return {
      error: "Status atualizado, mas não foi possível registrar o histórico."
    };
  }

  revalidatePath("/manutencoes");
  revalidatePath(`/manutencoes/${orderId}`);
  revalidatePath("/dashboard");

  return { success: "Status atualizado." };
}

export async function updateMaintenanceStatusAction(
  orderId: string,
  _prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  const parsed = updateMaintenanceStatusSchema.safeParse({
    new_status: String(formData.get("new_status") ?? ""),
    description: String(formData.get("description") ?? "")
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Selecione um status válido."
    };
  }

  return changeMaintenanceStatus(
    orderId,
    parsed.data.new_status,
    parsed.data.description
  );
}

export async function markMaintenanceAsDeliveredAction(
  orderId: string,
  prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  void prevState;
  void formData;

  return changeMaintenanceStatus(
    orderId,
    "entregue",
    "Ordem marcada como entregue."
  );
}

export async function cancelMaintenanceOrderAction(
  orderId: string,
  prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  void prevState;
  void formData;

  return changeMaintenanceStatus(
    orderId,
    "cancelado",
    "Ordem cancelada pela equipe."
  );
}

export async function deleteMaintenanceOrderAction(
  orderId: string,
  prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  void prevState;
  void formData;

  const parsed = deleteMaintenanceOrderSchema.safeParse({
    maintenance_order_id: orderId
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Manutenção inválida."
    };
  }

  const user = await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("maintenance_orders")
    .select("id, order_number, status, deleted_at")
    .eq("id", parsed.data.maintenance_order_id)
    .eq("organization_id", organization.id)
    .maybeSingle<{
      id: string;
      order_number: string;
      status: MaintenanceStatus;
      deleted_at: string | null;
    }>();

  if (orderError) {
    console.error("Erro ao buscar manutenção para exclusão:", orderError);
    return { error: "Não foi possível localizar a manutenção." };
  }

  if (!order) {
    return { error: "Manutenção não encontrada para esta organização." };
  }

  if (order.deleted_at) {
    revalidatePath("/manutencoes");
    revalidatePath("/dashboard");
    redirect("/manutencoes");
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("maintenance_orders")
    .update({
      deleted_at: now,
      updated_at: now
    })
    .eq("id", order.id)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (updateError || !updated) {
    console.error("Erro ao excluir manutenção por soft delete:", updateError);
    return { error: "Não foi possível excluir a manutenção." };
  }

  const { error: eventError } = await supabase.from("maintenance_events").insert({
    organization_id: organization.id,
    maintenance_order_id: order.id,
    event_type: "maintenance_deleted",
    old_status: order.status,
    new_status: null,
    description: "Ordem de serviço excluída por soft delete.",
    created_by: user.id,
    created_at: now
  });

  if (eventError) {
    console.error("Erro ao registrar evento de exclusão da manutenção:", eventError);
    return {
      error:
        "A manutenção foi removida das listas, mas não foi possível registrar o histórico."
    };
  }

  revalidatePath("/manutencoes");
  revalidatePath(`/manutencoes/${order.id}`);
  revalidatePath("/dashboard");
  redirect("/manutencoes");
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
