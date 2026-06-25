# Fase 2 - Checklist

## Supabase Auth

- [ ] Usuario de teste criado no Supabase Auth.
- [ ] Site URL configurada para `NEXT_PUBLIC_APP_URL`.
- [ ] Redirect URLs configuradas para o dominio local e futuro dominio de deploy.
- [ ] Email/senha habilitado no Supabase Auth, se esse for o metodo usado no piloto.

## Ambiente

- [ ] `apps/web/.env.local` continua ignorado pelo Git.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada.
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configurada.
- [ ] `SUPABASE_SECRET_KEY` configurada somente no servidor/local seguro.
- [ ] Nenhuma chave real foi colocada em arquivo versionado.

## Testes manuais

- [ ] `/dashboard` bloqueia usuario sem login e redireciona para `/login`.
- [ ] Login com usuario valido funciona.
- [ ] Login com senha incorreta mostra erro amigavel.
- [ ] `/login` redireciona usuario logado para `/dashboard`.
- [ ] Logout encerra sessao e redireciona para `/login`.
- [ ] Usuario autenticado sem organizacao vai para `/onboarding/organizacao`.
- [ ] `/onboarding/organizacao` cria organizacao inicial.
- [ ] Usuario entra em `organization_members` com role `owner`.
- [ ] `/configuracoes` mostra dados basicos da organizacao e role do usuario.
- [ ] `/kiosk` e `/kiosk/[slug]` permanecem publicos.

## Comandos

- [ ] `pnpm install` executado se as dependencias nao estiverem instaladas.
- [ ] `pnpm lint` passa.
- [ ] `pnpm typecheck` passa.
- [ ] `pnpm build` passa.

## Seguranca

- [ ] `SUPABASE_SECRET_KEY` nao aparece em bundle client-side.
- [ ] `SUPABASE_SECRET_KEY` nao foi usada em componentes com `"use client"`.
- [ ] Rotas internas usam middleware e verificacao server-side.
- [ ] Nenhum modulo fora do escopo foi criado: estoque, vendas, WhatsApp API oficial, financeiro ou tablet final.
