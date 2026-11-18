import Link from "next/link";
import { AccountRequestForm } from "./request-form";

export default function CreateAccountPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md">
        <p className="text-sm font-medium uppercase text-accent">Solicitação de acesso</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Criar conta</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-muted">
          Após o envio, sua solicitação será analisada antes da liberação do acesso.
        </p>
        <AccountRequestForm />
        <Link className="mt-4 inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-accent focus:outline-none focus:ring-2 focus:ring-focus" href="/login">Voltar para login</Link>
      </section>
    </main>
  );
}
