"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { organizationSchema, organizationSiteSchema } from "@/lib/validations/organization";
import { organizationServiceCitySchema } from "@/lib/validations/service-city";
import { requireOrganization } from "./queries";

export type OrganizationActionState = {
  error?: string;
  success?: string;
  values?: {
    name?: string;
    slug?: string;
    phone?: string;
    service_city?: string;
  };
};

export async function createInitialOrganization(
  _prevState: OrganizationActionState,
  formData: FormData
): Promise<OrganizationActionState> {
  const user = await requireAuth();
  const values = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    service_city: String(formData.get("service_city") ?? "")
  };

  const parsed = organizationSchema.safeParse({
    ...values,
    phone: values.phone || undefined
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise os dados da loja.",
      values
    };
  }

  const admin = createAdminClient();

  const { data: existingMembership, error: membershipCheckError } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipCheckError) {
    return {
      error: "Nao foi possivel verificar a organizacao do usuario.",
      values
    };
  }

  if (existingMembership) {
    redirect("/dashboard");
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      user_id: user.id,
      full_name: user.email ?? null
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    return {
      error: "Nao foi possivel preparar o perfil do usuario.",
      values
    };
  }

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      phone: parsed.data.phone || null,
      service_city: parsed.data.service_city
    })
    .select("id")
    .single();

  if (organizationError || !organization) {
    return {
      error:
        organizationError?.code === "23505"
          ? "Este endereço já está sendo utilizado. Escolha outro."
          : "Nao foi possivel criar a organizacao.",
      values
    };
  }

  const { error: memberError } = await admin.from("organization_members").insert({
    organization_id: organization.id,
    user_id: user.id,
    role: "owner"
  });

  if (memberError) {
    return {
      error: "A organizacao foi criada, mas o vinculo do usuario falhou.",
      values
    };
  }

  redirect("/dashboard");
}

export async function updateOrganizationSite(
  _prevState: OrganizationActionState, formData: FormData
): Promise<OrganizationActionState> {
  const organization = await requireOrganization();
  if (organization.role !== "owner" && organization.role !== "admin") {
    return { error: "Somente owner ou admin pode alterar o Site da loja." };
  }
  const values = { slug: String(formData.get("slug") ?? "") };
  const parsed = organizationSiteSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };

  // O ID e o papel vêm da sessão, seguindo o fluxo de configuração da cidade.
  const { data, error } = await createAdminClient().from("organizations")
    .update({ slug: parsed.data.slug })
    .eq("id", organization.id).select("id").maybeSingle();
  if (error || !data) {
    return {
      error: error?.code === "23505"
        ? "Este endereço já está sendo utilizado. Escolha outro."
        : "Não foi possível salvar o Site da loja. Tente novamente.",
      values
    };
  }
  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/quiosque");
  revalidatePath("/kiosk/[slug]", "page");
  return { success: "Site da loja atualizado.", values: { slug: parsed.data.slug } };
}

export async function updateOrganizationServiceCity(
  _prevState: OrganizationActionState, formData: FormData
): Promise<OrganizationActionState> {
  const organization = await requireOrganization();
  if (organization.role !== "owner" && organization.role !== "admin") {
    return { error: "Somente owner ou admin pode alterar a cidade de serviço." };
  }
  const values = { service_city: String(formData.get("service_city") ?? "") };
  const parsed = organizationServiceCitySchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  // A organização e o papel vêm da sessão. Não aceitar IDs do formulário.
  const { data, error } = await createAdminClient().from("organizations")
    .update({ service_city: parsed.data.service_city })
    .eq("id", organization.id).select("id").maybeSingle();
  if (error || !data) return { error: "Não foi possível salvar a cidade de serviço.", values };
  revalidatePath("/configuracoes");
  revalidatePath("/clientes", "layout");
  return { success: "Cidade de serviço atualizada.", values: { service_city: parsed.data.service_city ?? "" } };
}
