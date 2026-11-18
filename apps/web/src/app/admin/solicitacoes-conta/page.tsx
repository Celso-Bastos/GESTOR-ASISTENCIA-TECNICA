import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/queries";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/auth/actions";
import type { AccountRequest } from "@/lib/account-requests/types";
import { ReviewForm } from "./review-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";
const statuses = { pending: "Pendentes", approved: "Aprovadas", rejected: "Rejeitadas" } as const;
const statusLabels = { pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada" } as const;
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AccountRequestsPage({ searchParams }: {
  searchParams: Promise<{ status?: string; pagina?: string }>
}) {
  if (!(await getCurrentUser())) redirect("/login");
  if (!(await isPlatformAdmin())) {
    return <main className="mx-auto grid max-w-lg gap-4 px-4 py-12"><h1 className="text-2xl font-semibold">Acesso negado</h1><p>Somente administradores da plataforma podem acessar esta página.</p><Link className="inline-flex min-h-11 items-center text-accent" href="/">Voltar ao sistema</Link></main>;
  }
  const params = await searchParams;
  const status = params.status && Object.hasOwn(statuses, params.status) ? params.status as keyof typeof statuses : "pending";
  const rawPage = Number(params.pagina);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const pageSize = 30;
  const client = await createClient();
  // Consulta com a sessão do admin e RLS, sem usar chave secreta na página.
  const { data, error, count } = await client.from("account_requests")
    .select("*", { count: "exact" }).eq("status", status)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1).returns<AccountRequest[]>();

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl content-start gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium uppercase text-accent">Administração da plataforma</p><h1 className="mt-2 text-2xl font-semibold text-foreground">Solicitações de conta</h1></div>
        <div className="flex items-center gap-3"><ThemeToggle /><Link className="inline-flex min-h-11 items-center text-sm font-medium text-accent" href="/">Sistema</Link><form action={logoutAction}><button className="min-h-11 rounded-md border border-line-strong bg-surface px-4 text-sm" type="submit">Sair</button></form></div>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Status da solicitação">
        {Object.entries(statuses).map(([value, label]) => <Link key={value} href={`?status=${value}`} aria-current={status === value ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus ${status === value ? "border-accent-border-strong bg-teal-700 text-white" : "border-line-strong bg-surface text-body"}`}>{label}</Link>)}
      </nav>
      {error ? <p role="alert" className="rounded-md border border-danger-line bg-danger-soft p-4 text-sm text-danger">Não foi possível carregar as solicitações. Verifique a configuração e as migrations 0012/0013 e tente novamente.</p> : <>
        {!data?.length ? <p className="text-sm text-muted">Nenhuma solicitação nesta página.</p> : null}
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {data?.map((request) => <article className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5" key={request.id}>
            <h2 className="break-words text-lg font-semibold text-foreground">{request.full_name}</h2>
            <dl className="mt-3 grid gap-2 text-sm text-body">
              <div><dt className="font-medium">E-mail</dt><dd className="break-all">{request.email}</dd></div>
              <div><dt className="font-medium">Telefone</dt><dd>{request.phone || "Não informado"}</dd></div>
              <div><dt className="font-medium">Assistência</dt><dd className="break-words">{request.business_name || "Não informada"}</dd></div>
              <div><dt className="font-medium">Cidade de serviço</dt><dd className="break-words">{request.service_city || "Não informada"}</dd></div>
              <div><dt className="font-medium">Data da solicitação</dt><dd>{dateFormat.format(new Date(request.created_at))}</dd></div>
              <div><dt className="font-medium">Status</dt><dd>{statusLabels[request.status]}</dd></div>
              {request.reviewed_at ? <div><dt className="font-medium">Revisada em</dt><dd>{dateFormat.format(new Date(request.reviewed_at))}</dd></div> : null}
              {request.rejection_reason ? <div><dt className="font-medium">Motivo da rejeição</dt><dd className="whitespace-pre-wrap break-words">{request.rejection_reason}</dd></div> : null}
            </dl>
            {request.status === "pending" ? request.review_started_at
              ? <p role="status" className="mt-4 rounded-md bg-warning-soft p-3 text-sm text-warning-emphasis">Revisão em processamento desde {dateFormat.format(new Date(request.review_started_at))}. Se persistir, confira o Auth e os logs para conciliação antes de uma nova tentativa.</p>
              : <ReviewForm id={request.id} /> : null}
          </article>)}
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label="Paginação">
          {page > 1 ? <Link className="inline-flex min-h-11 items-center text-accent" href={`?status=${status}&pagina=${page - 1}`}>Anterior</Link> : null}
          <span>Página {page} · {count ?? 0} solicitações</span>
          {(count ?? 0) > page * pageSize ? <Link className="inline-flex min-h-11 items-center text-accent" href={`?status=${status}&pagina=${page + 1}`}>Próxima</Link> : null}
        </nav>
      </>}
    </main>
  );
}
