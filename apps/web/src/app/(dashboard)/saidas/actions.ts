"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAuth } from "@/lib/auth/queries";
import {
  getCurrentOrganization,
  requireOrganization,
  type CurrentOrganization
} from "@/lib/organization/queries";
import {
  currentMonthRange,
  type ProductCategory
} from "@/lib/products/format";
import { groupRestockOutflows } from "@/lib/products/restock";
import { createClient } from "@/lib/supabase/server";
import {
  createProductModelTemplateSchema,
  createProductOutflowSchema,
  deleteProductModelTemplateSchema,
  deleteProductOutflowSchema,
  outflowReportFilterSchema,
  updateProductModelTemplateSchema,
  updateProductOutflowSchema
} from "@/lib/validations/product.schema";

export type ProductActionState = {
  error?: string;
  success?: string;
  values?: Record<string, string | boolean>;
};

export type ProductModelTemplate = {
  id: string;
  organization_id: string;
  category: ProductCategory;
  model_name: string;
  default_price: number | string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type ProductOutflow = {
  id: string;
  organization_id: string;
  category: ProductCategory;
  model_template_id: string | null;
  custom_model_name: string | null;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  sold_at: string;
  customer_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  product_model_templates:
    | Pick<ProductModelTemplate, "id" | "model_name">
    | Array<Pick<ProductModelTemplate, "id" | "model_name">>
    | null;
  customers:
    | {
        id: string;
        name: string;
      }
    | Array<{
        id: string;
        name: string;
      }>
    | null;
};

export type CustomerOption = {
  id: string;
  name: string;
  phone: string;
  phone_normalized: string;
};

export type RestockReportRow = {
  category: ProductCategory;
  model: string;
  quantity: number;
  total: number;
};

export type RestockReport = {
  month: string;
  rows: RestockReportRow[];
  totalQuantity: number;
  totalSold: number;
  topCategory: ProductCategory | null;
};

const MODEL_TEMPLATE_SELECT =
  "id, organization_id, category, model_name, default_price, is_active, created_by, created_at, updated_at, deleted_at";

const OUTFLOW_SELECT =
  "id, organization_id, category, model_template_id, custom_model_name, quantity, unit_price, total_price, sold_at, customer_id, notes, created_by, created_at, updated_at, deleted_at, product_model_templates(id, model_name), customers(id, name)";

function singleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function modelTemplateFormValues(formData: FormData) {
  return {
    category: String(formData.get("category") ?? ""),
    model_name: String(formData.get("model_name") ?? ""),
    default_price: String(formData.get("default_price") ?? ""),
    is_active: formData.get("is_active") === "on"
  };
}

function outflowFormValues(formData: FormData) {
  return {
    category: String(formData.get("category") ?? ""),
    model_template_id: String(formData.get("model_template_id") ?? ""),
    custom_model_name: String(formData.get("custom_model_name") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    unit_price: String(formData.get("unit_price") ?? ""),
    sold_at: String(formData.get("sold_at") ?? ""),
    customer_id: String(formData.get("customer_id") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    save_as_template: formData.get("save_as_template") === "on"
  };
}

function getMonthBounds(month?: string) {
  const current = currentMonthRange();
  const safeMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : current.month;
  const [yearText, monthText] = safeMonth.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const start = `${safeMonth}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 0));
  const end = `${safeMonth}-${String(endDate.getUTCDate()).padStart(2, "0")}`;

  return { start, end, month: safeMonth };
}

function friendlyModelError(code?: string) {
  if (code === "23505") {
    return "Ja existe um modelo ativo com esse nome nesta categoria.";
  }

  return "Nao foi possivel salvar o modelo. Tente novamente.";
}

async function getProductActionContext(): Promise<
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
      error: "Nenhuma organizacao ativa foi encontrada para este usuario."
    };
  }

  return { ok: true, userId: user.id, organization };
}

async function findActiveTemplateDuplicate({
  organizationId,
  category,
  modelName,
  ignoredId
}: {
  organizationId: string;
  category: ProductCategory;
  modelName: string;
  ignoredId?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("product_model_templates")
    .select("id, category, model_name, default_price")
    .eq("organization_id", organizationId)
    .eq("category", category)
    .eq("is_active", true)
    .is("deleted_at", null)
    .ilike("model_name", modelName)
    .limit(1);

  if (ignoredId) {
    query = query.neq("id", ignoredId);
  }

  const { data, error } = await query.maybeSingle<{
    id: string;
    category: ProductCategory;
    model_name: string;
    default_price: number | string | null;
  }>();

  if (error) {
    console.error("Erro ao verificar duplicidade de modelo:", error);
    return { error: "Nao foi possivel verificar se o modelo ja existe." };
  }

  return { template: data ?? null };
}

async function getTemplateForOrganization(
  organizationId: string,
  templateId: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_model_templates")
    .select("id, category, model_name, default_price, is_active, deleted_at")
    .eq("id", templateId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      category: ProductCategory;
      model_name: string;
      default_price: number | string | null;
      is_active: boolean;
      deleted_at: string | null;
    }>();

  if (error) {
    console.error("Erro ao buscar modelo salvo:", error);
  }

  return data ?? null;
}

async function ensureCustomerFromOrganization(
  organizationId: string,
  customerId?: string
) {
  if (!customerId) {
    return true;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("Erro ao validar cliente da venda:", error);
  }

  return Boolean(data);
}

async function createTemplateFromOutflow({
  organizationId,
  userId,
  category,
  modelName,
  unitPrice
}: {
  organizationId: string;
  userId: string;
  category: ProductCategory;
  modelName: string;
  unitPrice: number;
}) {
  const duplicate = await findActiveTemplateDuplicate({
    organizationId,
    category,
    modelName
  });

  if (duplicate.error) {
    return { templateId: null, error: duplicate.error };
  }

  if (duplicate.template) {
    return { templateId: duplicate.template.id, error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_model_templates")
    .insert({
      organization_id: organizationId,
      category,
      model_name: modelName,
      default_price: unitPrice,
      is_active: true,
      created_by: userId
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    console.error("Erro ao criar modelo a partir da saida:", error);
    return { templateId: null, error: friendlyModelError(error?.code) };
  }

  return { templateId: data.id, error: null };
}

function filterText(value: string) {
  return value.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
}

export async function getCustomersForOutflow() {
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
    console.error("Erro ao carregar clientes para saida:", error);
    return [] as CustomerOption[];
  }

  return data ?? [];
}

export async function getProductModelTemplates(input?: {
  category?: string;
  includeInactive?: boolean;
}) {
  await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("product_model_templates")
    .select(MODEL_TEMPLATE_SELECT)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("model_name", { ascending: true });

  if (!input?.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (input?.category) {
    query = query.eq("category", input.category);
  }

  const { data, error } = await query.returns<ProductModelTemplate[]>();

  if (error) {
    console.error("Erro ao carregar modelos de produtos:", error);
    return [];
  }

  return data ?? [];
}

export async function createProductModelTemplateAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const context = await getProductActionContext();
  const values = modelTemplateFormValues(formData);

  if (!context.ok) {
    return { error: context.error, values };
  }

  const parsed = createProductModelTemplateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise os dados do modelo.",
      values
    };
  }

  const duplicate = await findActiveTemplateDuplicate({
    organizationId: context.organization.id,
    category: parsed.data.category,
    modelName: parsed.data.model_name
  });

  if (duplicate.error) {
    return { error: duplicate.error, values };
  }

  if (duplicate.template) {
    return {
      error: "Ja existe um modelo ativo com esse nome nesta categoria.",
      values
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("product_model_templates").insert({
    organization_id: context.organization.id,
    category: parsed.data.category,
    model_name: parsed.data.model_name,
    default_price: parsed.data.default_price ?? null,
    is_active: parsed.data.is_active,
    created_by: context.userId
  });

  if (error) {
    console.error("Erro ao criar modelo de produto:", error);
    return { error: friendlyModelError(error.code), values };
  }

  revalidatePath("/saidas");
  revalidatePath("/saidas/nova");
  revalidatePath("/saidas/modelos");

  return { success: "Modelo criado." };
}

export async function updateProductModelTemplateAction(
  templateId: string,
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const context = await getProductActionContext();
  const values = modelTemplateFormValues(formData);

  if (!context.ok) {
    return { error: context.error, values };
  }

  const parsed = updateProductModelTemplateSchema.safeParse({
    id: templateId,
    ...values
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise os dados do modelo.",
      values
    };
  }

  if (parsed.data.is_active) {
    const duplicate = await findActiveTemplateDuplicate({
      organizationId: context.organization.id,
      category: parsed.data.category,
      modelName: parsed.data.model_name,
      ignoredId: parsed.data.id
    });

    if (duplicate.error) {
      return { error: duplicate.error, values };
    }

    if (duplicate.template) {
      return {
        error: "Ja existe um modelo ativo com esse nome nesta categoria.",
        values
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_model_templates")
    .update({
      category: parsed.data.category,
      model_name: parsed.data.model_name,
      default_price: parsed.data.default_price ?? null,
      is_active: parsed.data.is_active
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    console.error("Erro ao atualizar modelo de produto:", error);
    return { error: friendlyModelError(error?.code), values };
  }

  revalidatePath("/saidas");
  revalidatePath("/saidas/nova");
  revalidatePath("/saidas/modelos");
  revalidatePath("/relatorios/reposicao");

  return { success: "Modelo atualizado." };
}

export async function disableProductModelTemplateAction(
  templateId: string,
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  void prevState;
  void formData;

  const context = await getProductActionContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const parsed = deleteProductModelTemplateSchema.safeParse({ id: templateId });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Modelo invalido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_model_templates")
    .update({ is_active: false })
    .eq("id", parsed.data.id)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    console.error("Erro ao desativar modelo de produto:", error);
    return { error: "Nao foi possivel desativar o modelo." };
  }

  revalidatePath("/saidas/nova");
  revalidatePath("/saidas/modelos");

  return { success: "Modelo desativado." };
}

export async function deleteProductModelTemplateAction(
  templateId: string,
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  void prevState;
  void formData;

  const context = await getProductActionContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const parsed = deleteProductModelTemplateSchema.safeParse({ id: templateId });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Modelo invalido." };
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_model_templates")
    .update({ is_active: false, deleted_at: now })
    .eq("id", parsed.data.id)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    console.error("Erro ao excluir modelo de produto:", error);
    return { error: "Nao foi possivel excluir o modelo." };
  }

  revalidatePath("/saidas/nova");
  revalidatePath("/saidas/modelos");

  return { success: "Modelo excluido." };
}

export async function getProductOutflows(input?: {
  category?: string;
  q?: string;
  month?: string;
  start?: string;
  end?: string;
}) {
  await requireAuth();
  const organization = await requireOrganization();
  const parsed = outflowReportFilterSchema.safeParse(input ?? {});
  const monthBounds = getMonthBounds(input?.month);

  if (!parsed.success) {
    return {
      outflows: [] as ProductOutflow[],
      filters: {
        category: "",
        q: "",
        start: monthBounds.start,
        end: monthBounds.end,
        month: monthBounds.month
      },
      error: parsed.error.issues[0]?.message ?? "Filtros invalidos."
    };
  }

  const start = parsed.data.start ?? monthBounds.start;
  const end = parsed.data.end ?? monthBounds.end;
  const supabase = await createClient();
  let query = supabase
    .from("product_outflows")
    .select(OUTFLOW_SELECT)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .gte("sold_at", start)
    .lte("sold_at", end)
    .order("sold_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (parsed.data.category) {
    query = query.eq("category", parsed.data.category);
  }

  const { data, error } = await query.returns<ProductOutflow[]>();

  if (error) {
    console.error("Erro ao carregar saidas de produtos:", error);
    return {
      outflows: [] as ProductOutflow[],
      filters: {
        category: parsed.data.category ?? "",
        q: parsed.data.q ?? "",
        start,
        end,
        month: monthBounds.month
      },
      error: "Nao foi possivel carregar as saidas."
    };
  }

  const q = parsed.data.q ? filterText(parsed.data.q).toLowerCase() : "";
  const outflows = q
    ? (data ?? []).filter((outflow) => {
        const template = singleRelation(outflow.product_model_templates);
        const model = template?.model_name ?? outflow.custom_model_name ?? "";

        return model.toLowerCase().includes(q);
      })
    : data ?? [];

  return {
    outflows,
    filters: {
      category: parsed.data.category ?? "",
      q: parsed.data.q ?? "",
      start,
      end,
      month: monthBounds.month
    },
    error: undefined
  };
}

export async function createProductOutflowAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const context = await getProductActionContext();
  const values = outflowFormValues(formData);

  if (!context.ok) {
    return { error: context.error, values };
  }

  const parsed = createProductOutflowSchema.safeParse(values);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise os dados da saida.",
      values
    };
  }

  const customerOk = await ensureCustomerFromOrganization(
    context.organization.id,
    parsed.data.customer_id
  );

  if (!customerOk) {
    return { error: "Cliente nao encontrado nesta organizacao.", values };
  }

  let category = parsed.data.category;
  let modelTemplateId = parsed.data.model_template_id ?? null;
  let customModelName = parsed.data.custom_model_name ?? null;

  if (modelTemplateId) {
    const template = await getTemplateForOrganization(
      context.organization.id,
      modelTemplateId
    );

    if (!template || !template.is_active) {
      return {
        error: "Modelo salvo nao encontrado ou inativo nesta organizacao.",
        values
      };
    }

    category = template.category;
    customModelName = null;
  } else if (parsed.data.save_as_template && customModelName) {
    const created = await createTemplateFromOutflow({
      organizationId: context.organization.id,
      userId: context.userId,
      category,
      modelName: customModelName,
      unitPrice: parsed.data.unit_price
    });

    if (created.error) {
      return { error: created.error, values };
    }

    modelTemplateId = created.templateId;
    customModelName = null;
  }

  const totalPrice = parsed.data.quantity * parsed.data.unit_price;
  const supabase = await createClient();
  const { error } = await supabase.from("product_outflows").insert({
    organization_id: context.organization.id,
    category,
    model_template_id: modelTemplateId,
    custom_model_name: customModelName,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    total_price: totalPrice,
    sold_at: parsed.data.sold_at,
    customer_id: parsed.data.customer_id ?? null,
    notes: parsed.data.notes ?? null,
    created_by: context.userId
  });

  if (error) {
    console.error("Erro ao criar saida de produto:", error);
    return {
      error: "Nao foi possivel registrar a saida. Tente novamente.",
      values
    };
  }

  revalidatePath("/saidas");
  revalidatePath("/saidas/nova");
  revalidatePath("/saidas/modelos");
  revalidatePath("/relatorios/reposicao");
  revalidatePath("/dashboard");
  redirect("/saidas");
}

export async function updateProductOutflowAction(
  outflowId: string,
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const context = await getProductActionContext();
  const values = outflowFormValues(formData);

  if (!context.ok) {
    return { error: context.error, values };
  }

  const parsed = updateProductOutflowSchema.safeParse({
    id: outflowId,
    ...values
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise os dados da saida.",
      values
    };
  }

  const customerOk = await ensureCustomerFromOrganization(
    context.organization.id,
    parsed.data.customer_id
  );

  if (!customerOk) {
    return { error: "Cliente nao encontrado nesta organizacao.", values };
  }

  let category = parsed.data.category;
  const modelTemplateId = parsed.data.model_template_id ?? null;
  let customModelName = parsed.data.custom_model_name ?? null;

  if (modelTemplateId) {
    const template = await getTemplateForOrganization(
      context.organization.id,
      modelTemplateId
    );

    if (!template) {
      return { error: "Modelo salvo nao encontrado nesta organizacao.", values };
    }

    category = template.category;
    customModelName = null;
  }

  const totalPrice = parsed.data.quantity * parsed.data.unit_price;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_outflows")
    .update({
      category,
      model_template_id: modelTemplateId,
      custom_model_name: customModelName,
      quantity: parsed.data.quantity,
      unit_price: parsed.data.unit_price,
      total_price: totalPrice,
      sold_at: parsed.data.sold_at,
      customer_id: parsed.data.customer_id ?? null,
      notes: parsed.data.notes ?? null
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    console.error("Erro ao atualizar saida de produto:", error);
    return { error: "Nao foi possivel atualizar a saida.", values };
  }

  revalidatePath("/saidas");
  revalidatePath("/relatorios/reposicao");
  revalidatePath("/dashboard");

  return { success: "Saida atualizada." };
}

export async function deleteProductOutflowAction(
  outflowId: string,
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  void prevState;
  void formData;

  const context = await getProductActionContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const parsed = deleteProductOutflowSchema.safeParse({ id: outflowId });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saida invalida." };
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_outflows")
    .update({ deleted_at: now })
    .eq("id", parsed.data.id)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    console.error("Erro ao excluir saida de produto:", error);
    return { error: "Nao foi possivel excluir a saida." };
  }

  revalidatePath("/saidas");
  revalidatePath("/relatorios/reposicao");
  revalidatePath("/dashboard");

  return { success: "Saida excluida." };
}

export async function getMonthlyRestockReport(input?: {
  month?: string;
  category?: string;
}) {
  await requireAuth();
  const organization = await requireOrganization();
  const parsed = outflowReportFilterSchema.safeParse(input ?? {});
  const bounds = getMonthBounds(input?.month);

  if (!parsed.success) {
    return {
      report: {
        month: bounds.month,
        rows: [] as RestockReportRow[],
        totalQuantity: 0,
        totalSold: 0,
        topCategory: null
      } satisfies RestockReport,
      error: parsed.error.issues[0]?.message ?? "Filtros invalidos."
    };
  }

  const supabase = await createClient();
  let query = supabase
    .from("product_outflows")
    .select(OUTFLOW_SELECT)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .gte("sold_at", bounds.start)
    .lte("sold_at", bounds.end)
    .limit(2000);

  if (parsed.data.category) {
    query = query.eq("category", parsed.data.category);
  }

  const { data, error } = await query.returns<ProductOutflow[]>();

  if (error) {
    console.error("Erro ao gerar relatorio de reposicao:", error);
    return {
      report: {
        month: bounds.month,
        rows: [] as RestockReportRow[],
        totalQuantity: 0,
        totalSold: 0,
        topCategory: null
      } satisfies RestockReport,
      error: "Nao foi possivel gerar o relatorio."
    };
  }

  const rows = groupRestockOutflows(data ?? []).map(
    ({ category, model, quantity, total }) =>
      ({
        category,
        model,
        quantity,
        total
      }) satisfies RestockReportRow
  );
  const categoryTotals = new Map<ProductCategory, number>();

  for (const row of rows) {
    categoryTotals.set(
      row.category,
      (categoryTotals.get(row.category) ?? 0) + row.quantity
    );
  }

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalSold = rows.reduce((sum, row) => sum + row.total, 0);
  const topCategory =
    Array.from(categoryTotals.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    null;

  return {
    report: {
      month: bounds.month,
      rows,
      totalQuantity,
      totalSold,
      topCategory
    } satisfies RestockReport,
    error: undefined
  };
}

export async function getSalesSummaryByPeriod(input?: {
  month?: string;
  category?: string;
}) {
  const { report } = await getMonthlyRestockReport(input);

  return {
    totalQuantity: report.totalQuantity,
    totalSold: report.totalSold,
    topCategory: report.topCategory,
    restockItems: report.rows.length
  };
}
