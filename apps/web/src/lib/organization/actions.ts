"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { organizationSchema } from "@/lib/validations/organization";

export type OrganizationActionState = {
  error?: string;
  values?: {
    name?: string;
    slug?: string;
    phone?: string;
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
    phone: String(formData.get("phone") ?? "")
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
      phone: parsed.data.phone || null
    })
    .select("id")
    .single();

  if (organizationError || !organization) {
    return {
      error:
        organizationError?.code === "23505"
          ? "Esse slug ja esta em uso."
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
