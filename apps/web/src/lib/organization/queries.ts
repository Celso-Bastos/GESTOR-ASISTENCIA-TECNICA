import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  role: "owner" | "admin" | "employee";
};

type OrganizationMemberRow = {
  role: CurrentOrganization["role"];
  organizations:
    | {
        id: string;
        name: string;
        slug: string;
        phone: string | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        phone: string | null;
      }[]
    | null;
};

export async function getCurrentOrganization() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug, phone)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<OrganizationMemberRow>();

  if (error || !data?.organizations) {
    return null;
  }

  const organization = Array.isArray(data.organizations)
    ? data.organizations[0]
    : data.organizations;

  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    phone: organization.phone,
    role: data.role
  } satisfies CurrentOrganization;
}

export async function requireOrganization() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    redirect("/onboarding/organizacao");
  }

  return organization;
}
