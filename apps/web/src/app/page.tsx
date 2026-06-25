import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-4">
        <p className="text-sm font-medium uppercase text-slate-500">
          Fase 2
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">
          Gerenciamento de Assistencia Tecnica
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-700">
          Base do MVP com autenticacao Supabase, rotas protegidas, onboarding de
          organizacao e dashboard inicial.
        </p>
        <div>
          <Link
            className="inline-flex h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
            href="/login"
          >
            Entrar
          </Link>
        </div>
      </section>
    </main>
  );
}
