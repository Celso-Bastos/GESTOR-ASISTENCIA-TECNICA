import "server-only";
import { getCurrentUser } from "@/lib/auth/queries";
import { getCurrentOrganization } from "@/lib/organization/queries";

export async function getMessageContext() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false as const,
      error: "Sua sessao expirou. Entre novamente para continuar."
    };
  }

  const organization = await getCurrentOrganization();

  if (!organization) {
    return {
      ok: false as const,
      error: "Nenhuma organizacao ativa foi encontrada para este usuario."
    };
  }

  return { ok: true as const, user, organization };
}
