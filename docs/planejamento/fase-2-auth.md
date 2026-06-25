# Fase 2 - Autenticacao e Dashboard

A Fase 2 implementa autenticacao com Supabase Auth, sessao SSR no Next.js App Router, middleware de protecao, onboarding da organizacao inicial e layout base do dashboard.

## Implementado

- Helpers Supabase em `apps/web/src/lib/supabase`:
  - `client.ts` para componentes client-side com `createBrowserClient`.
  - `server.ts` para server-side com cookies via `createServerClient`.
  - `middleware.ts` para refresh de sessao no middleware.
  - `admin.ts` para operacoes server-side com `SUPABASE_SECRET_KEY`.
- Middleware em `apps/web/src/middleware.ts`.
- Tela de login em `/login`.
- Server actions para login e logout.
- Layout protegido em `(dashboard)/layout.tsx`.
- Dashboard inicial em `/dashboard`.
- Onboarding de organizacao em `/onboarding/organizacao`.
- Pagina simples de configuracoes em `/configuracoes`.
- Placeholders protegidos para `/clientes`, `/manutencoes` e `/mensagens`.

## Rotas publicas

- `/`
- `/login`
- `/kiosk`
- `/kiosk/[slug]`
- `/api/kiosk` futuramente

## Rotas protegidas

- `/dashboard`
- `/clientes`
- `/manutencoes`
- `/mensagens`
- `/configuracoes`
- `/onboarding/organizacao`

## Fluxo de login

1. Usuario acessa `/login`.
2. Formulario valida email e senha com Zod.
3. Server action chama `supabase.auth.signInWithPassword`.
4. Em caso de erro, a tela mostra mensagem amigavel.
5. Em caso de sucesso, o usuario e redirecionado para `/dashboard`.
6. Usuario autenticado que acessa `/login` e redirecionado para `/dashboard` pelo middleware.

## Fluxo de onboarding

1. Usuario autenticado acessa `/dashboard`.
2. A aplicacao consulta `organization_members`.
3. Se houver organizacao vinculada, o dashboard abre normalmente.
4. Se nao houver organizacao, o usuario vai para `/onboarding/organizacao`.
5. O formulario valida nome, slug e telefone com Zod.
6. A server action cria `profiles`, `organizations` e `organization_members`.
7. O usuario e vinculado como `owner` e volta para `/dashboard`.

## Variaveis usadas

- `NEXT_PUBLIC_SUPABASE_URL`: URL publica do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave publica usada por browser, SSR e middleware.
- `SUPABASE_SECRET_KEY`: chave server-side usada apenas para criar organizacao inicial e vinculo de owner.
- `SUPABASE_JWKS_URL`: reservada para validacoes futuras de JWT, se necessario.
- `NEXT_PUBLIC_APP_URL`: URL publica do app para configuracao de redirects no Supabase Auth.

## Cuidados de seguranca

- `.env.local` nao deve ser lido, impresso ou commitado.
- `SUPABASE_SECRET_KEY` nao deve ser importada em componentes client-side.
- Login e onboarding usam server actions.
- O middleware chama `getUser()` para validar a sessao antes de liberar rotas protegidas.
- A criacao da organizacao inicial usa chave secreta no servidor porque as policies da Fase 1 ainda nao permitem criar `organizations` e `organization_members` antes do primeiro vinculo.
- Estoque, vendas, promocoes em massa, WhatsApp API oficial e financeiro seguem fora do MVP atual.
