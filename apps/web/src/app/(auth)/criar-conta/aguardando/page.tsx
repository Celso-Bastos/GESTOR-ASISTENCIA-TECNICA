import Link from "next/link";

export default function WaitingForApprovalPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-950">Solicitação enviada</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">Sua conta está aguardando aprovação.</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">Após a liberação, você poderá entrar utilizando o e-mail e a senha cadastrados.</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">Entre em contato com o responsável pelo sistema caso precise verificar o status da solicitação.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200" href="/login">Voltar para login</Link>
      </section>
    </main>
  );
}
