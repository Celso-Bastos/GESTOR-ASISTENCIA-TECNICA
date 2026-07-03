import { CalendarClock, Link2, ShieldCheck } from "lucide-react";
import {
  createKioskTokenAction,
  disableKioskTokenAction,
  getKioskTokens
} from "@/lib/kiosk/actions";
import { buildKioskLink } from "@/lib/kiosk/links";
import { CreateTokenForm } from "./create-token-form";
import { CopyButton, DisableTokenForm } from "./token-actions";

function formatDate(value: string | null) {
  if (!value) {
    return "Nunca usado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function QuiosquePage() {
  const { organization, tokens, error } = await getKioskTokens();

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase text-teal-700">
            Configuracoes
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Quiosque / Tablet
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Gere links publicos controlados para o tablet de balcao cadastrar
            clientes sem login e sem expor dados internos.
          </p>
        </div>
      </div>

      <CreateTokenForm action={createKioskTokenAction} />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4">
        {tokens.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
            Nenhum token criado ainda. Crie um token para liberar o link do
            tablet.
          </div>
        ) : null}

        {tokens.map((token) => {
          const link = buildKioskLink(organization.slug, token.token);

          return (
            <article
              className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
              key={token.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-950">
                      {token.name}
                    </h2>
                    <span
                      className={
                        token.is_active
                          ? "rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700"
                          : "rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
                      }
                    >
                      {token.is_active ? "Ativo" : "Desativado"}
                    </span>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <CalendarClock className="size-4" aria-hidden="true" />
                    Ultimo uso: {formatDate(token.last_used_at)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <CopyButton link={link} />
                  <DisableTokenForm
                    action={disableKioskTokenAction.bind(null, token.id)}
                    disabled={!token.is_active}
                  />
                </div>
              </div>

              <div className="grid gap-2 rounded-md bg-slate-50 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                  <Link2 className="size-4" aria-hidden="true" />
                  Link do tablet
                </p>
                <p className="break-all text-sm font-medium text-slate-800">
                  {link}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <p className="flex max-w-3xl gap-3 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-900">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        A tela publica valida slug e token ativo antes de aceitar cadastro. Ela
        envia somente nome, telefone e consentimento.
      </p>
    </section>
  );
}
