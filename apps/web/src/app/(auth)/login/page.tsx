import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase text-teal-700">
            Acesso interno
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Entrar no sistema
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use o usuario criado no Supabase Auth para acessar o dashboard.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
