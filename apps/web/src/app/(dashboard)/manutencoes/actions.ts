"use server";

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
  phone: string;
  phone_normalized: string;
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
    customer_id: String(formData.get("customer_id") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    model: String(formData.get("model") ?? ""),
    color: String(formData.get("color") ?? ""),
    storage: String(formData.get("storage") ?? ""),
    imei: String(formData.get("imei") ?? ""),
    device_notes: String(formData.get("device_notes") ?? ""),
    reported_issue: String(formData.get("reported_issue") ?? ""),
    diagnosis: String(formData.get("diagnosis") ?? ""),
    expected_delivery_date: String(formData.get("expected_delivery_date") ?? ""),
    estimated_price: String(formData.get("estimated_price") ?? ""),
    final_price: String(formData.get("final_price") ?? ""),
    internal_notes: String(formData.get("internal_notes") ?? "")
  };
}

function createInput(values: Record<string, string>) {
  return {
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
    internal_notes: values.internal_notes
  };
}

function quickFormValues(formData: FormData) {
  return {
    customer_name: String(formData.get("customer_name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    device_model: String(formData.get("device_model") ?? ""),
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
    expected_delivery_date: values.expected_delivery_date,
    estimated_price: values.estimated_price,
    final_price: values.final_price,
    internal_notes: values.internal_notes
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

function isMissingRpcError(code?: string) {
  return code === "PGRST202" || code === "42883";
}

function sanitizeSearchTerm(value: string) {
  return value.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
}

async function ensureCustomerFromOrganization(
  organizationId: string,
  customerId: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    return false;
  }

  return true;
}

async function generateNextOrderNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
) {
  const { data, error } = await supabase
    .from("maintenance_orders")
    .select("order_number")
    .eq("organization_id", organizationId)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ order_number: string }>();

  if (error) {
    console.error("Erro ao gerar order_number:", error);
    return null;
  }

  const current = data?.order_number?.match(/^OS-(\d+)$/)?.[1];
  const next = current ? Number(current) + 1 : 1;

  return `OS-${String(next).padStart(6, "0")}`;
}

async function createMaintenanceOrderWithDirectInserts({
  organization,
  userId,
  input,
  eventDescription
}: {
  organization: CurrentOrganization;
  userId: string;
  input: CreateMaintenanceOrderInput;
  eventDescription?: string;
}) {
  const supabase = await createClient();
  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .insert({
      organization_id: organization.id,
      customer_id: input.customer_id,
      brand: input.device.brand ?? null,
      model: input.device.model,
      color: input.device.color ?? null,
      storage: input.device.storage ?? null,
      imei: input.device.imei ?? null,
      notes: input.device.notes ?? null
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (deviceError || !device) {
    console.error("Erro ao criar device:", deviceError);
    return {
      order: null,
      error: "Não foi possível salvar os dados do aparelho."
    };
  }

  let order:
    | {
        id: string;
        order_number: string;
      }
    | null = null;
  let lastInsertCode: string | undefined;

  for (let attempt = 0; attempt < 3 && !order; attempt += 1) {
    const orderNumber = await generateNextOrderNumber(supabase, organization.id);

    if (!orderNumber) {
      return {
        order: null,
        error: friendlyMaintenanceError()
      };
    }

    const { data, error } = await supabase
      .from("maintenance_orders")
      .insert({
        organization_id: organization.id,
        customer_id: input.customer_id,
        device_id: device.id,
        order_number: orderNumber,
        reported_issue: input.reported_issue,
        status: "recebido",
        expected_delivery_date: input.expected_delivery_date ?? null,
        estimated_price: input.estimated_price ?? null,
        internal_notes: input.internal_notes ?? null
      })
      .select("id, order_number")
      .maybeSingle<{ id: string; order_number: string }>();

    if (data) {
      order = data;
    } else {
      lastInsertCode = error?.code;
      console.error("Erro ao criar maintenance_order:", error);

      if (error?.code !== "23505") {
        break;
      }
    }
  }

  if (!order) {
    return {
      order: null,
      error: friendlyMaintenanceError(lastInsertCode)
    };
  }

  const { error: eventError } = await supabase.from("maintenance_events").insert({
    organization_id: organization.id,
    maintenance_order_id: order.id,
    event_type: "created",
    old_status: null,
    new_status: "recebido",
    description:
      eventDescription ||
      `Ordem ${order.order_number} criada com status Recebido.`,
    created_by: userId
  });

  if (eventError) {
    console.error("Erro ao criar maintenance_event:", eventError);
    return {
      order: null,
      error: "A ordem foi criada, mas não foi possível registrar o histórico."
    };
  }

  return { order, error: null };
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

async function findOrCreateQuickCustomer({
  organizationId,
  name,
  phone,
  phoneNormalized
}: {
  organizationId: string;
  name: string;
  phone: string;
  phoneNormalized: string;
}) {
  const existing = await getExistingCustomerByPhone(
    organizationId,
    phoneNormalized
  );

  if (existing.error || existing.customer) {
    return existing;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      name,
      phone,
      phone_normalized: phoneNormalized,
      whatsapp_opt_in: false,
      whatsapp_opt_in_at: null,
      source: "manual",
      notes: null
    })
    .select("id, name")
    .maybeSingle<{ id: string; name: string }>();

  if (data) {
    return { customer: data, error: null };
  }

  console.error("Erro ao criar cliente da manutenção rápida:", error);

  if (error?.code === "23505") {
    return getExistingCustomerByPhone(organizationId, phoneNormalized);
  }

  return {
    customer: null,
    error: "Não foi possível criar o cliente para a manutenção rápida."
  };
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
      "id, organization_id, customer_id, device_id, order_number, reported_issue, diagnosis, status, expected_delivery_date, delivered_at, estimated_price, final_price, internal_notes, created_at, updated_at, customers(id, name, phone, phone_normalized), devices(id, brand, model, color, storage, imei, notes)"
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

export async function createMaintenanceOrderAction(
  _prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  const context = await getMaintenanceActionContext();
  const values = formValues(formData);

  if (!context.ok) {
    return { error: context.error, values };
  }

  const parsed = createMaintenanceOrderSchema.safeParse(createInput(values));

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Revise os dados da manutenção.",
      values
    };
  }

  const { organization, userId } = context;
  const customerOk = await ensureCustomerFromOrganization(
    organization.id,
    parsed.data.customer_id
  );

  if (!customerOk) {
    return {
      error: "Cliente não encontrado ou inválido.",
      values
    };
  }

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .rpc("create_maintenance_order", {
      p_organization_id: organization.id,
      p_customer_id: parsed.data.customer_id,
      p_created_by: userId,
      p_device_brand: parsed.data.device.brand ?? null,
      p_device_model: parsed.data.device.model,
      p_device_color: parsed.data.device.color ?? null,
      p_device_storage: parsed.data.device.storage ?? null,
      p_device_imei: parsed.data.device.imei ?? null,
      p_device_notes: parsed.data.device.notes ?? null,
      p_reported_issue: parsed.data.reported_issue,
      p_expected_delivery_date: parsed.data.expected_delivery_date ?? null,
      p_estimated_price: parsed.data.estimated_price ?? null,
      p_internal_notes: parsed.data.internal_notes ?? null
    })
    .maybeSingle<{ order_id: string; order_number: string }>();

  if (!order) {
    console.error("Erro ao criar maintenance_order:", error);

    if (isMissingRpcError(error?.code)) {
      const fallback = await createMaintenanceOrderWithDirectInserts({
        organization,
        userId,
        input: parsed.data
      });

      if (!fallback.order) {
        return {
          error: fallback.error ?? friendlyMaintenanceError(error?.code),
          values
        };
      }

      revalidatePath("/manutencoes");
      revalidatePath("/dashboard");
      redirect(`/manutencoes/${fallback.order.id}`);
    }

    return {
      error: friendlyMaintenanceError(error?.code),
      values
    };
  }

  revalidatePath("/manutencoes");
  revalidatePath("/dashboard");
  redirect(`/manutencoes/${order.order_id}`);
}

export async function createQuickMaintenanceOrderAction(
  _prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  const context = await getMaintenanceActionContext();
  const values = quickFormValues(formData);

  if (!context.ok) {
    return { error: context.error, values };
  }

  const parsed = createQuickMaintenanceOrderSchema.safeParse(values);

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Revise os dados da manutenção rápida.",
      values
    };
  }

  const { organization, userId } = context;
  const phoneNormalized = normalizePhoneBR(parsed.data.phone);
  const customerResult = await findOrCreateQuickCustomer({
    organizationId: organization.id,
    name: parsed.data.customer_name,
    phone: parsed.data.phone,
    phoneNormalized
  });

  if (customerResult.error || !customerResult.customer) {
    return {
      error: customerResult.error ?? "Cliente não encontrado ou inválido.",
      values
    };
  }

  const orderInput: CreateMaintenanceOrderInput = {
    customer_id: customerResult.customer.id,
    device: {
      brand: undefined,
      model: parsed.data.device_model,
      color: undefined,
      storage: undefined,
      imei: undefined,
      notes: "Criado pelo fluxo de manutenção rápida."
    },
    reported_issue: parsed.data.reported_issue,
    expected_delivery_date: parsed.data.expected_delivery_date,
    estimated_price: undefined,
    internal_notes: parsed.data.quick_notes
  };
  const result = await createMaintenanceOrderWithDirectInserts({
    organization,
    userId,
    input: orderInput,
    eventDescription: "Ordem criada pelo fluxo de manutenção rápida."
  });

  if (!result.order) {
    return {
      error: result.error ?? friendlyMaintenanceError(),
      values
    };
  }

  revalidatePath("/clientes");
  revalidatePath("/manutencoes");
  revalidatePath("/dashboard");
  redirect(`/manutencoes/${result.order.id}`);
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

  const { organization } = context;
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("maintenance_orders")
    .select("id, customer_id, device_id")
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; customer_id: string; device_id: string }>();

  if (orderError || !order) {
    return {
      error: "Manutenção não encontrada para esta organização.",
      values
    };
  }

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
    return {
      error: "Não foi possível atualizar os dados do aparelho.",
      values
    };
  }

  const { data: updated, error } = await supabase
    .from("maintenance_orders")
    .update({
      reported_issue: parsed.data.reported_issue,
      diagnosis: parsed.data.diagnosis ?? null,
      expected_delivery_date: parsed.data.expected_delivery_date ?? null,
      estimated_price: parsed.data.estimated_price ?? null,
      final_price: parsed.data.final_price ?? null,
      internal_notes: parsed.data.internal_notes ?? null
    })
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updated) {
    return {
      error: friendlyMaintenanceError(error?.code),
      values
    };
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
    .select("id, order_number, status, delivered_at")
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      order_number: string;
      status: MaintenanceStatus;
      delivered_at: string | null;
    }>();

  if (orderError || !order) {
    return { error: "Manutenção não encontrada para esta organização." };
  }

  if (order.status === newStatus) {
    return { success: "A manutenção já está neste status." };
  }

  const updatePayload: {
    status: MaintenanceStatus;
    delivered_at?: string | null;
  } = {
    status: newStatus
  };

  if (newStatus === "entregue") {
    updatePayload.delivered_at = new Date().toISOString();
  } else if (order.status === "entregue") {
    updatePayload.delivered_at = null;
  }

  const { data: updated, error } = await supabase
    .from("maintenance_orders")
    .update(updatePayload)
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updated) {
    return { error: "Não foi possível alterar o status da manutenção." };
  }

  const oldLabel = maintenanceStatusLabels[order.status];
  const newLabel = maintenanceStatusLabels[newStatus];

  const { error: eventError } = await supabase.from("maintenance_events").insert({
    organization_id: organization.id,
    maintenance_order_id: order.id,
    event_type: "status_changed",
    old_status: order.status,
    new_status: newStatus,
    description:
      description ||
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
