import "server-only";

type AccessClient = {
  rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>;
};

export const accountAccessMessages = {
  pending: "Sua conta está aguardando aprovação.",
  rejected: "Sua solicitação de acesso não foi aprovada.",
  blocked: "Não foi possível confirmar a liberação da sua conta. Procure o administrador."
} as const;

export async function getAccountAccessStatus(client: AccessClient) {
  try {
    const { data, error } = await client.rpc("get_account_access_status");
    if (!error && (data === "approved" || data === "pending" || data === "rejected")) return data;
  } catch {
    // Falha fechada; não registrar resposta do Auth, sessão ou credenciais.
  }
  return "blocked" as const;
}
