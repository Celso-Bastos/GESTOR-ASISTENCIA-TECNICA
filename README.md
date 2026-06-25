# Gerenciamento Assistencia Tecnica

Base inicial de um sistema web para assistencia tecnica de celulares.

O MVP tera login, clientes, tela de tablet/quiosque para cadastro simples, manutencoes, alertas de entrega/manutencao e mensagens prontas para WhatsApp manual.

## Stack

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Supabase
- pnpm
- Monorepo simples com `apps/*` e `packages/*`

## Estrutura

```txt
apps/
  web/
packages/
  shared/
supabase/
  migrations/
  policies/
  seed.sql
docs/
  planejamento/
```

## Comandos

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

Para rodar somente o app web:

```bash
pnpm --filter web dev
```

## Fases do MVP

1. Fase 0: base do monorepo, documentacao, configuracoes e estrutura inicial.
2. Fase 1: Supabase, banco de dados, RLS e seeds minimos.
3. Fase 2: login, sessao, layout base, onboarding de organizacao e protecao de rotas.
4. Fase 3: clientes e cadastro em tablet/quiosque.
5. Fase 4: manutencoes e historico do atendimento.
6. Fase 5: alertas operacionais e mensagens prontas para WhatsApp manual.
7. Fase 6: ajustes finais, auditoria de seguranca e preparacao para piloto.

Fora do MVP inicial: estoque, vendas, promocoes em massa, API oficial do WhatsApp, financeiro e multi-loja avancado visual.

## Regras de seguranca

- Nunca commitar `.env`, `.env.local` ou arquivos com chaves reais.
- Usar somente variaveis publicas `NEXT_PUBLIC_*` no frontend.
- Manter `SUPABASE_SECRET_KEY` somente em ambiente servidor/seguro.
- Ativar RLS nas tabelas do Supabase antes de uso real.
- Registrar apenas dados necessarios para operacao e atendimento.
- Tratar nome e telefone de clientes como dados pessoais protegidos pela LGPD.

## Ambiente

Crie um arquivo `.env.local` em `apps/web` ou na raiz conforme a configuracao usada pelo deploy, copiando os nomes de `.env.example`.

Aviso importante: nunca commite `.env.local`.

Variaveis usadas pelo app web:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=
NEXT_PUBLIC_APP_URL=
```

## Testando autenticacao

1. No Supabase, crie um usuario de teste em Authentication.
2. Em Authentication > URL Configuration, configure a Site URL com o valor de `NEXT_PUBLIC_APP_URL`.
3. Adicione Redirect URLs para o ambiente local, por exemplo `http://localhost:3000`.
4. Rode `pnpm dev`.
5. Acesse `/login` e entre com o usuario criado.
6. No primeiro acesso, preencha `/onboarding/organizacao` para criar a loja inicial e entrar como `owner`.
