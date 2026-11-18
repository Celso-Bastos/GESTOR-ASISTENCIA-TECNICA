import Link from "next/link";
import { LoginForm } from "./login-form";
import { accountAccessMessages } from "@/lib/auth/account-access";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ conta?: string }> }) {
  const { conta } = await searchParams;
  const message = conta === "pending" || conta === "rejected" || conta === "blocked" ? accountAccessMessages[conta] : null;
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase text-accent">
            Acesso interno
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Entrar no sistema
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Entre com o e-mail e a senha cadastrados após a aprovação do seu acesso.
          </p>
        </div>

        {message ? <p role="alert" className="mb-4 rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning-emphasis">{message}</p> : null}
        <LoginForm />
        <div className="mt-6 border-t border-line pt-6 text-center text-sm text-muted">
          <p>Não possui acesso?</p>
          <Link className="mt-2 inline-flex min-h-11 items-center rounded-md px-4 font-semibold text-accent hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-focus" href="/criar-conta">
            Criar conta
          </Link>
        </div>
      </section>
    </main>
  );
}
