import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccessStatus } from "@/lib/auth/account-access";

// React descarta esta memoização ao terminar cada renderização/requisição RSC.
// Actions e proxy continuam validando a sessão em suas próprias requisições.
export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

export const getCurrentAccountAccessStatus = cache(async function getCurrentAccountAccessStatus() {
  return getAccountAccessStatus(await createClient());
});

export const requireAuth = cache(async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const status = await getCurrentAccountAccessStatus();
  if (status !== "approved") redirect(`/login?conta=${status}`);

  return user;
});
