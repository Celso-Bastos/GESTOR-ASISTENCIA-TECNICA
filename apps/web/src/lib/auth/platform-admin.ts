import "server-only";

import { getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccessStatus } from "@/lib/auth/account-access";

export async function isPlatformAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  if (await getAccountAccessStatus(supabase) !== "approved") return false;
  const { data, error } = await supabase.from("platform_admins")
    .select("user_id").eq("user_id", user.id).maybeSingle<{ user_id: string }>();

  return !error && !!data;
}

// Retorna a identidade validada novamente para cada mutação, nunca vinda do formulário.
export async function getPlatformAdmin() {
  const user = await getCurrentUser();
  if (!user || !(await isPlatformAdmin())) return null;
  return user;
}
