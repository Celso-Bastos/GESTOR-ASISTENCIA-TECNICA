import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccessStatus } from "@/lib/auth/account-access";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const status = await getAccountAccessStatus(await createClient());
  if (status !== "approved") redirect(`/login?conta=${status}`);

  return user;
}
