import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/queries";
import { DefinePasswordForm } from "./password-form";
import { createClient } from "@/lib/supabase/server";
import { accountAccessMessages, getAccountAccessStatus } from "@/lib/auth/account-access";

export const dynamic = "force-dynamic";

export default async function DefinePasswordPage({ searchParams }: {
  searchParams: Promise<{ erro?: string }>
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const status = user ? await getAccountAccessStatus(await createClient()) : null;
  const valid = !!user && status === "approved" && params.erro !== "convite";
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Definir senha</h1>
        {valid ? <><p className="mb-6 mt-2 break-words text-sm leading-6 text-slate-600">Seu acesso foi aprovado. Defina sua senha para continuar com {user.email}.</p><DefinePasswordForm /></>
          : <p role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{status && status !== "approved" ? accountAccessMessages[status] : "Convite inválido ou expirado. Abra o link recebido por e-mail ou solicite ajuda ao administrador."}</p>}
        <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-teal-700" href="/login">Voltar para login</Link>
      </section>
    </main>
  );
}
