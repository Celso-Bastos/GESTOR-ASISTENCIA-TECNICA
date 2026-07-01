"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAuth } from "@/lib/auth/queries";
import { normalizePhoneBR } from "@/lib/phone";
import {
  getCurrentOrganization,
  requireOrganization,
  type CurrentOrganization
} from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import {
  createCustomerSchema,
  customerSearchSchema,
  updateCustomerSchema
} from "@/lib/validations/customer.schema";

export type CustomerRow = {
  id: string;
  organization_id: string;
  name: string;
  phone: string;
  phone_normalized: string;
  whatsapp_opt_in: boolean;
  whatsapp_opt_in_at: string | null;
  source: "manual" | "tablet" | "future_import";
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type CustomerActionState = {
  error?: string;
  values?: {
    name?: string;
    phone?: string;
    whatsapp_opt_in?: boolean;
    notes?: string;
  };
};

function getCustomerFormValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    whatsapp_opt_in: formData.get("whatsapp_opt_in") === "on",
    notes: String(formData.get("notes") ?? "")
  };
}

function friendlyCustomerError(code?: string) {
  if (code === "23505") {
    return "Ja existe um cliente com esse telefone nesta organizacao.";
  }

  return "Nao foi possivel salvar o cliente. Tente novamente.";
}

async function getCustomerActionContext(): Promise<
  | {
      ok: true;
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
      error: "Sua sessao expirou. Entre novamente para salvar o cliente."
    };
  }

  const organization = await getCurrentOrganization();

  if (!organization) {
    return {
      ok: false,
      error: "Nenhuma organizacao ativa foi encontrada para este usuario."
    };
  }

  return { ok: true, organization };
}

async function getCustomerDuplicate(
  organizationId: string,
  phoneNormalized: string,
  ignoredCustomerId?: string
) {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("phone_normalized", phoneNormalized)
    .is("deleted_at", null)
    .limit(1);

  if (ignoredCustomerId) {
    query = query.neq("id", ignoredCustomerId);
  }

  const { data, error } = await query.maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Nao foi possivel verificar duplicidade de telefone." };
  }

  return { duplicateId: data?.id };
}

function sanitizeSearchTerm(value: string) {
  return value.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
}

export async function getCustomers(search?: string) {
  await requireAuth();
  const organization = await requireOrganization();

  const parsed = customerSearchSchema.safeParse({ q: search || undefined });

  if (!parsed.success) {
    return {
      customers: [] as CustomerRow[],
      error: parsed.error.issues[0]?.message ?? "Busca invalida."
    };
  }

  const q = parsed.data.q;
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select(
      "id, organization_id, name, phone, phone_normalized, whatsapp_opt_in, whatsapp_opt_in_at, source, notes, created_at, updated_at, deleted_at"
    )
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    const term = sanitizeSearchTerm(q);
    const normalized = normalizePhoneBR(q);

    if (normalized) {
      query = query.or(
        `name.ilike.%${term}%,phone.ilike.%${term}%,phone_normalized.ilike.%${normalized}%`
      );
    } else {
      query = query.ilike("name", `%${term}%`);
    }
  }

  const { data, error } = await query.returns<CustomerRow[]>();

  if (error) {
    return {
      customers: [] as CustomerRow[],
      error: "Nao foi possivel carregar os clientes."
    };
  }

  return { customers: data ?? [], error: undefined };
}

export async function getCustomerById(customerId: string) {
  await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, organization_id, name, phone, phone_normalized, whatsapp_opt_in, whatsapp_opt_in_at, source, notes, created_at, updated_at, deleted_at"
    )
    .eq("id", customerId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle<CustomerRow>();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function createCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const context = await getCustomerActionContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const { organization } = context;
  const values = getCustomerFormValues(formData);
  const parsed = createCustomerSchema.safeParse(values);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise os dados do cliente.",
      values
    };
  }

  const phoneNormalized = normalizePhoneBR(parsed.data.phone);
  const duplicate = await getCustomerDuplicate(organization.id, phoneNormalized);

  if (duplicate.error) {
    return { error: duplicate.error, values };
  }

  if (duplicate.duplicateId) {
    return {
      error: "Ja existe um cliente ativo com esse telefone.",
      values
    };
  }

  const supabase = await createClient();
  const whatsappOptInAt = parsed.data.whatsapp_opt_in
    ? new Date().toISOString()
    : null;

  const { error } = await supabase.from("customers").insert({
    organization_id: organization.id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    phone_normalized: phoneNormalized,
    whatsapp_opt_in: parsed.data.whatsapp_opt_in,
    whatsapp_opt_in_at: whatsappOptInAt,
    source: "manual",
    notes: parsed.data.notes || null
  });

  if (error) {
    return {
      error: friendlyCustomerError(error.code),
      values
    };
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function updateCustomerAction(
  customerId: string,
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const context = await getCustomerActionContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const { organization } = context;
  const values = getCustomerFormValues(formData);
  const parsed = updateCustomerSchema.safeParse(values);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise os dados do cliente.",
      values
    };
  }

  const phoneNormalized = normalizePhoneBR(parsed.data.phone);
  const duplicate = await getCustomerDuplicate(
    organization.id,
    phoneNormalized,
    customerId
  );

  if (duplicate.error) {
    return { error: duplicate.error, values };
  }

  if (duplicate.duplicateId) {
    return {
      error: "Ja existe um cliente ativo com esse telefone.",
      values
    };
  }

  const supabase = await createClient();
  const whatsappOptInAt = parsed.data.whatsapp_opt_in
    ? new Date().toISOString()
    : null;

  const { data, error } = await supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone,
      phone_normalized: phoneNormalized,
      whatsapp_opt_in: parsed.data.whatsapp_opt_in,
      whatsapp_opt_in_at: whatsappOptInAt,
      notes: parsed.data.notes || null
    })
    .eq("id", customerId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    return {
      error: friendlyCustomerError(error?.code),
      values
    };
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${customerId}`);
  redirect(`/clientes/${customerId}`);
}

export async function deleteCustomerAction(
  customerId: string,
  prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  void prevState;
  void formData;

  const context = await getCustomerActionContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const { organization } = context;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    return {
      error: "Nao foi possivel excluir o cliente."
    };
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}
