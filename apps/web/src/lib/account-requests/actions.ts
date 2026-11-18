"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformAdmin } from "@/lib/auth/platform-admin";
import { normalizePhoneBR } from "@/lib/phone";
import { accountRequestSchema, reviewAccountRequestSchema } from "@/lib/validations/account-request.schema";
import type { AccountRequest, AccountRequestActionState } from "./types";

const adminPath = "/admin/solicitacoes-conta";
const duplicateMessage = "Já existe uma solicitação pendente para este e-mail.";
const existingMessage = "Este e-mail já possui acesso. Faça login.";
const unexpectedMessage = "Não foi possível enviar sua solicitação agora. Tente novamente.";
const reconciliationMessage = "Esta conta precisa de verificação pelo administrador. Entre em contato para regularizar sua solicitação.";
const processingMessage = "Esta solicitação já foi revisada ou está em processamento. Atualize a lista; se persistir, verifique a conciliação no Supabase.";
type AdminClient = ReturnType<typeof createAdminClient>;

async function findAuthUser(client: AdminClient, email: string) {
  const { data, error } = await client.rpc("find_account_auth_user", { p_email: email });
  if (error) throw new Error("AUTH_LOOKUP_FAILED");
  return data as string | null;
}

async function existingAccountMessage(client: AdminClient, authUserId: string) {
  const { data, error } = await client.auth.admin.getUserById(authUserId);
  if (error || !data.user) throw new Error("AUTH_USER_LOOKUP_FAILED");
  const status = data.user.app_metadata.account_status;
  if (status === undefined) return existingMessage;
  // Pending já foi consultado antes do Auth. Reconsultar trata uma corrida de cadastro.
  const { data: request, error: requestError } = await client.from("account_requests")
    .select("id, status").eq("auth_user_id", authUserId).maybeSingle();
  if (requestError) throw new Error("REQUEST_LOOKUP_FAILED");
  if (request?.status === "pending") return duplicateMessage;
  if (request?.status === "approved" && status === "approved") return existingMessage;
  if (request?.status === "rejected" && status === "rejected") return "Sua solicitação de acesso não foi aprovada. Entre em contato com o administrador para reconsideração.";
  console.error("[account-requests] Auth e solicitação inconsistentes", { authUserId, code: "AUTH_REQUEST_INCONSISTENT" });
  return reconciliationMessage;
}

async function compensateCreatedUser(client: AdminClient, authUserId: string) {
  try {
    const { error } = await client.auth.admin.deleteUser(authUserId);
    if (!error) return;
  } catch { /* Registrar somente identificador e código fixo. */ }
  console.error("[account-requests] Falha na remoção compensatória", { authUserId, code: "AUTH_CLEANUP_FAILED" });
}

export async function createAccountRequestAction(
  _prevState: AccountRequestActionState, formData: FormData
): Promise<AccountRequestActionState> {
  // Lista explícita: nenhum estado de retorno ou log recebe credenciais.
  const values = {
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    business_name: String(formData.get("business_name") ?? ""),
    service_city: String(formData.get("service_city") ?? "")
  };
  const parsed = accountRequestSchema.safeParse({
    ...values, website: String(formData.get("website") ?? ""),
    password: formData.get("password"), confirm_password: formData.get("confirm_password")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? unexpectedMessage, values };

  try {
    const client = createAdminClient();
    const input = parsed.data;
    const { data: pending, error: pendingError } = await client.from("account_requests")
      .select("id").eq("email_normalized", input.email).eq("status", "pending").maybeSingle();
    if (pendingError) throw new Error("PENDING_LOOKUP_FAILED");
    if (pending) return { error: duplicateMessage, values };
    const existingId = await findAuthUser(client, input.email);
    if (existingId) return { error: await existingAccountMessage(client, existingId), values };

    const { data: created, error: authError } = await client.auth.admin.createUser({
      email: input.email, password: input.password, email_confirm: false,
      user_metadata: { full_name: input.full_name }, app_metadata: { account_status: "pending" }
    });
    if (authError || !created.user) {
      // Outra requisição pode ter criado o mesmo e-mail entre lookup e createUser.
      const concurrentId = await findAuthUser(client, input.email);
      if (concurrentId) return { error: await existingAccountMessage(client, concurrentId), values };
      throw new Error("AUTH_CREATE_FAILED");
    }

    let insertWasDuplicate = false;
    try {
      const { data, error } = await client.from("account_requests").insert({
        full_name: input.full_name, email: input.email, email_normalized: input.email,
        phone: input.phone || null, phone_normalized: input.phone ? normalizePhoneBR(input.phone) : null,
        business_name: input.business_name || null, service_city: input.service_city,
        status: "pending", auth_user_id: created.user.id
      }).select("*").single<AccountRequest>();
      insertWasDuplicate = error?.code === "23505";
      if (error || !data) throw new Error("REQUEST_INSERT_FAILED");
    } catch {
      console.error("[account-requests] Falha ao persistir solicitação", { authUserId: created.user.id, code: "REQUEST_INSERT_FAILED" });
      // Uma falha de transporte pode ocorrer depois do commit. Verificar o vínculo
      // antes de excluir evita remover um usuário com solicitação já persistida.
      try {
        const { data: persisted, error } = await client.from("account_requests")
          .select("*").eq("auth_user_id", created.user.id).maybeSingle<AccountRequest>();
        if (error) throw new Error("REQUEST_RECONCILIATION_FAILED");
        if (!persisted) {
          await compensateCreatedUser(client, created.user.id);
          return { error: insertWasDuplicate ? duplicateMessage : unexpectedMessage, values };
        }
      } catch {
        console.error("[account-requests] Persistência incerta; conciliação necessária", { authUserId: created.user.id, code: "REQUEST_RECONCILIATION_REQUIRED" });
        return { error: unexpectedMessage, values };
      }
    }
  } catch {
    console.error("[account-requests] Falha ao registrar solicitação", { code: "REQUEST_CREATE_FAILED" });
    return { error: unexpectedMessage, values };
  }
  redirect("/criar-conta/aguardando");
}

async function reviewRequest(formData: FormData, decision: "approved" | "rejected"): Promise<AccountRequestActionState> {
  const admin = await getPlatformAdmin();
  if (!admin) return { error: "Acesso negado. Somente administradores da plataforma podem revisar solicitações." };
  const parsed = reviewAccountRequestSchema.safeParse({
    id: formData.get("id"), rejection_reason: String(formData.get("rejection_reason") ?? "")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Solicitação inválida." };

  try {
    const client = createAdminClient();
    const startedAt = new Date().toISOString();
    const { data: request, error: claimError } = await client.from("account_requests")
      .update({ review_started_at: startedAt }).eq("id", parsed.data.id)
      .eq("status", "pending").is("review_started_at", null)
      .select("*").maybeSingle<AccountRequest>();
    if (claimError) throw new Error("REQUEST_CLAIM_FAILED");
    if (!request) return { error: processingMessage };

    // Até este ponto nenhuma mutação Auth ocorreu; liberar a reserva é seguro.
    const release = async () => {
      const { error } = await client.from("account_requests").update({ review_started_at: null })
        .eq("id", request.id).eq("status", "pending").eq("review_started_at", startedAt);
      if (error) throw new Error("REQUEST_RELEASE_FAILED");
    };
    if (!request.auth_user_id) {
      if (decision === "approved") {
        await release();
        return { error: "Solicitação do fluxo antigo sem usuário Auth. Regularize o cadastro com o titular antes de aprovar; nenhum convite será enviado." };
      }
      // Pedidos antigos sem usuário podem ser rejeitados mantendo o histórico.
    } else {
      let authUser;
      try {
        const { data, error } = await client.auth.admin.getUserById(request.auth_user_id);
        if (error || !data.user || data.user.email?.trim().toLowerCase() !== request.email_normalized) throw new Error("AUTH_USER_MISMATCH");
        authUser = data.user;
      } catch {
        await release();
        return { error: "Não foi possível conferir o usuário Auth associado. Verifique o vínculo antes de tentar novamente." };
      }
      const { error } = await client.auth.admin.updateUserById(authUser.id, {
        app_metadata: { ...authUser.app_metadata, account_status: decision },
        ...(decision === "approved" ? { email_confirm: true } : {})
      });
      // Em falhas ambíguas manter reserva. A RPC bloqueia acesso até ambas as
      // gravações concordarem; nunca liberar a reserva automaticamente aqui.
      if (error) throw new Error("AUTH_REVIEW_UPDATE_FAILED");
    }

    const { data: reviewed, error: reviewError } = await client.from("account_requests").update({
      status: decision, reviewed_at: new Date().toISOString(), reviewed_by: admin.id,
      rejection_reason: decision === "rejected" ? parsed.data.rejection_reason || null : null,
      review_started_at: null
    }).eq("id", request.id).eq("status", "pending").eq("review_started_at", startedAt)
      .select("*").maybeSingle<AccountRequest>();
    if (reviewError || !reviewed) throw new Error("REQUEST_FINALIZE_FAILED");
    revalidatePath(adminPath);
    return { success: decision === "rejected" ? "Solicitação rejeitada. O usuário permanece sem acesso."
      : "Solicitação aprovada. O usuário já pode entrar com o e-mail e a senha cadastrados." };
  } catch {
    console.error("[account-requests] Falha na revisão; verificar conciliação", { requestId: parsed.data.id, code: "REVIEW_RECONCILIATION_REQUIRED" });
    revalidatePath(adminPath);
    return { error: "Não foi possível concluir a revisão. Confira o Auth e a solicitação antes de liberar o processamento para nova tentativa." };
  }
}

export async function approveAccountRequestAction(_prevState: AccountRequestActionState, formData: FormData) {
  return reviewRequest(formData, "approved");
}

export async function rejectAccountRequestAction(_prevState: AccountRequestActionState, formData: FormData) {
  return reviewRequest(formData, "rejected");
}

