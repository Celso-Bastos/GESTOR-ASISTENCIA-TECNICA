"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { definePasswordSchema } from "@/lib/validations/account-request.schema";
import { getPostLoginRedirectPath } from "@/lib/auth/redirect";
import { accountAccessMessages, getAccountAccessStatus } from "@/lib/auth/account-access";

export async function definePasswordAction(
  _prevState: { error?: string }, formData: FormData
): Promise<{ error?: string }> {
  const parsed = definePasswordSchema.safeParse({
    password: formData.get("password"), confirm_password: formData.get("confirm_password")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise sua senha." };

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Seu convite expirou ou é inválido. Solicite ajuda ao administrador." };
  const status = await getAccountAccessStatus(supabase);
  if (status !== "approved") return { error: accountAccessMessages[status] };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Não foi possível definir a senha. Use uma senha forte e tente novamente. Se o convite expirou, procure o administrador." };

  redirect(await getPostLoginRedirectPath(supabase, user.id));
}
