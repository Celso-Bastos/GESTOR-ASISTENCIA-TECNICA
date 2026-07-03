import { createAdminClient } from "@/lib/supabase/admin";
import { KioskForm } from "./kiosk-form";

type KioskPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    token?: string;
  }>;
};

async function isValidKioskAccess(slug: string, token: string) {
  if (!slug || !token) {
    return false;
  }

  const admin = createAdminClient();
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<{ id: string }>();

  if (organizationError || !organization) {
    return false;
  }

  const { data: kioskToken, error: tokenError } = await admin
    .from("kiosk_tokens")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();

  return !tokenError && Boolean(kioskToken);
}

export default async function KioskPage({
  params,
  searchParams
}: KioskPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const token = query?.token ?? "";
  const validAccess = await isValidKioskAccess(slug, token);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl content-center gap-8">
        <div className="grid gap-3">
          <p className="text-sm font-bold uppercase tracking-wide text-teal-700">
            Quiosque / Tablet
          </p>
          <h1 className="text-4xl font-bold text-slate-950 sm:text-5xl">
            Cadastro para contato
          </h1>
          <p className="max-w-2xl text-xl leading-8 text-slate-600">
            Informe seu nome e WhatsApp para a loja entrar em contato sobre
            manutencao, entrega, produtos e promocoes.
          </p>
        </div>

        {validAccess ? (
          <KioskForm slug={slug} token={token} />
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-5 py-4 text-lg font-semibold leading-7 text-amber-900">
            Link de cadastro indisponivel. Solicite um novo link para a equipe
            da loja.
          </div>
        )}
      </section>
    </main>
  );
}
