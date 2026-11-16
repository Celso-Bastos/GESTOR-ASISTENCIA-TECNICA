"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";
import { getPostLoginRedirectPath } from "@/lib/auth/redirect";
import { accountAccessMessages, getAccountAccessStatus } from "@/lib/auth/account-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type LoginActionState = {
  error?: string;
  email?: string;
};

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise os dados informados.",
      email: String(formData.get("email") ?? "")
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !user) {
    // O Auth pode recusar a sessão antes de retornar app_metadata. A mensagem
    // específica só é consultada após a recusa por e-mail não confirmado.
    if (error?.code === "email_not_confirmed") {
      try {
        const admin = createAdminClient();
        const { data: id, error: lookupError } = await admin.rpc("find_account_auth_user", { p_email: parsed.data.email.trim().toLowerCase() });
        if (!lookupError && typeof id === "string") {
          const { data, error: userError } = await admin.auth.admin.getUserById(id);
          const status: unknown = data.user?.app_metadata.account_status;
          if (!userError && (status === "pending" || status === "rejected")) {
            return { error: accountAccessMessages[status], email: parsed.data.email };
          }
        }
      } catch { /* Não registrar credenciais nem erro bruto do provedor. */ }
    }
    return {
      error: "Email ou senha invalidos.",
      email: parsed.data.email
    };
  }

  const status = await getAccountAccessStatus(supabase);
  if (status !== "approved") {
    await supabase.auth.signOut();
    return { error: accountAccessMessages[status], email: parsed.data.email };
  }

  redirect(await getPostLoginRedirectPath(supabase, user.id));
}

export async function logoutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  redirect("/login");
}
