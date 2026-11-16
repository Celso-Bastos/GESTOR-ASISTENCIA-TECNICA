import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { getAccountAccessStatus } from "@/lib/auth/account-access";

export async function getPostLoginRedirectPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const status = await getAccountAccessStatus(supabase);
  if (status !== "approved") return `/login?conta=${status}`;
  const { data } = await supabase.from("organization_members")
    .select("id").eq("user_id", userId).limit(1).maybeSingle<{ id: string }>();
  return data ? "/dashboard" : "/onboarding/organizacao";
}
