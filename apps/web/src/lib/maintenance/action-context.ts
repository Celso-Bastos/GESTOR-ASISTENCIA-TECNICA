import "server-only";
import { getCurrentUser } from "@/lib/auth/queries";
import { getCurrentOrganization, type CurrentOrganization } from "@/lib/organization/queries";

export async function getMaintenanceActionContext(): Promise<
  | {
      ok: true;
      userId: string;
      organization: CurrentOrganization;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      error: "Sua sessao expirou. Entre novamente para continuar."
    };
  }

  const organization = await getCurrentOrganization();

  if (!organization) {
    return {
      ok: false,
      error: "Nenhuma organização ativa foi encontrada para este usuário."
    };
  }

  return { ok: true, userId: user.id, organization };
}
