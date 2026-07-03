"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import {
  kioskTokenIdSchema,
  kioskTokenNameSchema
} from "@/lib/validations/kiosk.schema";

export type KioskTokenRow = {
  id: string;
  organization_id: string;
  token: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

export type KioskTokenActionState = {
  error?: string;
  success?: string;
};

function createTokenValue() {
  return randomBytes(32).toString("base64url");
}

export async function getKioskTokens() {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kiosk_tokens")
    .select("id, organization_id, token, name, is_active, created_at, last_used_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .returns<KioskTokenRow[]>();

  if (error) {
    return {
      organization,
      tokens: [] as KioskTokenRow[],
      error: "Nao foi possivel carregar os tokens de quiosque."
    };
  }

  return { organization, tokens: data ?? [], error: undefined };
}

export async function createKioskTokenAction(
  _prevState: KioskTokenActionState,
  formData: FormData
): Promise<KioskTokenActionState> {
  const organization = await requireOrganization();
  const parsed = kioskTokenNameSchema.safeParse({
    name: String(formData.get("name") ?? "")
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revise o nome do token."
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("kiosk_tokens").insert({
    organization_id: organization.id,
    token: createTokenValue(),
    name: parsed.data.name,
    is_active: true
  });

  if (error) {
    return { error: "Nao foi possivel criar o token. Tente novamente." };
  }

  revalidatePath("/configuracoes/quiosque");

  return { success: "Token criado com sucesso." };
}

export async function disableKioskTokenAction(
  tokenId: string,
  prevState: KioskTokenActionState,
  formData: FormData
): Promise<KioskTokenActionState> {
  void prevState;
  void formData;

  const organization = await requireOrganization();
  const parsed = kioskTokenIdSchema.safeParse({ id: tokenId });

  if (!parsed.success) {
    return { error: "Token invalido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kiosk_tokens")
    .update({ is_active: false })
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    return { error: "Nao foi possivel desativar o token." };
  }

  revalidatePath("/configuracoes/quiosque");

  return { success: "Token desativado." };
}
