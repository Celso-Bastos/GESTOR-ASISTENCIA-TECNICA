"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

export type LoginActionState = {
  error?: string;
  email?: string;
};

async function getPostLoginRedirectPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  return data ? "/dashboard" : "/onboarding/organizacao";
}

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
    return {
      error: "Email ou senha invalidos.",
      email: parsed.data.email
    };
  }

  redirect(await getPostLoginRedirectPath(supabase, user.id));
}

export async function logoutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  redirect("/login");
}
