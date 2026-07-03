import { NextResponse, type NextRequest } from "next/server";
import { normalizePhoneBR } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { kioskCustomerSchema } from "@/lib/validations/kiosk.schema";

const SUCCESS_MESSAGE = "Cadastro recebido com sucesso.";
const ERROR_MESSAGE =
  "Nao foi possivel concluir o cadastro. Verifique os dados e tente novamente.";
const MAX_PAYLOAD_BYTES = 8192;

type OrganizationLookup = {
  id: string;
};

type KioskTokenLookup = {
  id: string;
};

type CustomerLookup = {
  id: string;
};

function genericError(status = 400) {
  return NextResponse.json({ ok: false, message: ERROR_MESSAGE }, { status });
}

function isPayloadTooLarge(request: NextRequest) {
  const contentLength = request.headers.get("content-length");

  if (!contentLength) {
    return false;
  }

  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > MAX_PAYLOAD_BYTES;
}

export async function POST(request: NextRequest) {
  if (isPayloadTooLarge(request)) {
    return genericError(413);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return genericError();
  }

  const parsed = kioskCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return genericError();
  }

  const input = parsed.data;
  const phoneNormalized = normalizePhoneBR(input.phone);
  const now = new Date().toISOString();
  const admin = createAdminClient();

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle<OrganizationLookup>();

  if (organizationError || !organization) {
    return genericError();
  }

  const { data: kioskToken, error: tokenError } = await admin
    .from("kiosk_tokens")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("token", input.token)
    .eq("is_active", true)
    .maybeSingle<KioskTokenLookup>();

  if (tokenError || !kioskToken) {
    return genericError();
  }

  const { data: existingCustomer, error: duplicateError } = await admin
    .from("customers")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("phone_normalized", phoneNormalized)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<CustomerLookup>();

  if (duplicateError) {
    return genericError();
  }

  if (existingCustomer) {
    const { error: updateError } = await admin
      .from("customers")
      .update({
        name: input.name,
        phone: input.phone,
        whatsapp_opt_in: true,
        whatsapp_opt_in_at: now
      })
      .eq("id", existingCustomer.id)
      .eq("organization_id", organization.id)
      .is("deleted_at", null);

    if (updateError) {
      return genericError();
    }
  } else {
    const { error: insertError } = await admin.from("customers").insert({
      organization_id: organization.id,
      name: input.name,
      phone: input.phone,
      phone_normalized: phoneNormalized,
      whatsapp_opt_in: true,
      whatsapp_opt_in_at: now,
      source: "tablet",
      notes: null
    });

    if (insertError) {
      return genericError();
    }
  }

  await admin
    .from("kiosk_tokens")
    .update({ last_used_at: now })
    .eq("id", kioskToken.id)
    .eq("organization_id", organization.id);

  return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
}
