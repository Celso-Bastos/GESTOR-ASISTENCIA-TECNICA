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
4. Fase 3: clientes internos, busca, consentimento WhatsApp e soft delete.
5. Fase 4: quiosque/tablet publico para cadastro de clientes com token.
6. Fase 5: manutencoes e historico do atendimento.
7. Fase 6: manutencao rapida para atendimento no balcao.
8. Fase 7: alertas operacionais, mensagens prontas e ajustes finais.

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

## Fase 3 - Clientes

O modulo interno de clientes esta disponivel em `/clientes` para usuarios autenticados com organizacao.

Funcionalidades:

- listagem e busca por nome ou telefone;
- cadastro manual em `/clientes/novo`;
- detalhes em `/clientes/[id]`;
- edicao em `/clientes/[id]/editar`;
- bloqueio de telefone duplicado entre clientes ativos da mesma organizacao;
- consentimento de WhatsApp para mensagens futuras;
- soft delete com `deleted_at`.

A migration `supabase/migrations/0002_customers_active_phone_unique.sql` deve ser aplicada para que a unicidade de telefone considere apenas clientes ativos.

## Fase 4 - Quiosque / Tablet

Usuarios autenticados podem criar e desativar tokens em `/configuracoes/quiosque`. Cada token gera um link publico no formato:

```txt
NEXT_PUBLIC_APP_URL/kiosk/[slug]?token=[token]
```

A tela publica coleta apenas nome, WhatsApp e consentimento. O endpoint `/api/kiosk/customers` valida slug, token ativo e telefone, salva clientes novos com `source = tablet` e atualiza duplicidades sem revelar se o telefone ja existia.

Teste manual: crie um token, copie o link, abra em aba anonima, cadastre um cliente, valide em `/clientes`, desative o token e confirme que o link deixa de aceitar cadastro.

## Fase 5 - Manutencoes

O modulo de manutencoes esta disponivel em `/manutencoes` para usuarios autenticados com organizacao.

Funcionalidades:

- listagem com busca por cliente, telefone, modelo e numero da OS;
- filtros por status e atrasadas;
- abertura de OS em `/manutencoes/nova`;
- geracao automatica de `order_number` no formato `OS-000001`;
- criacao de aparelho em `devices`;
- status inicial `recebido`;
- detalhe em `/manutencoes/[id]`;
- edicao basica em `/manutencoes/[id]/editar`;
- mudanca de status com historico em `maintenance_events`;
- marcar como entregue preenchendo `delivered_at`;
- cards reais de manutencoes no dashboard.

A migration `supabase/migrations/0003_maintenance_order_rpc.sql` adiciona a RPC `create_maintenance_order` para criar aparelho, OS e evento inicial na mesma transacao do banco.

## Fase 6 - Manutencao Rapida

O fluxo rapido esta disponivel em `/manutencoes/rapida`.

Funcionalidades:

- formulario curto com nome, telefone, modelo e defeito;
- busca de cliente ativo pelo telefone normalizado;
- reaproveitamento de cliente existente sem alterar `source`;
- criacao de cliente novo com `source = manual` quando o telefone nao existe;
- criacao de aparelho, OS e evento inicial;
- redirecionamento para o detalhe da OS criada;
- atalho na listagem de manutencoes e no dashboard.

Nao houve migration na Fase 6. O fluxo usa as tabelas e policies ja existentes.

## Fase 7 - Alertas e WhatsApp Manual

O dashboard mostra cards reais de manutencoes em aberto, entregas de hoje, atrasadas, aguardando peca, prontas para entrega e clientes vindos do tablet no dia. Tambem exibe listas curtas de entregas de hoje e ordens prontas para retirada.

A rota `/mensagens` permite editar modelos operacionais da organizacao, restaurar modelos padrao e visualizar variaveis disponiveis. Os tipos implementados sao `maintenance_received`, `maintenance_ready`, `maintenance_reminder` e `delivery_today`.

No detalhe da OS, os botoes de WhatsApp geram a mensagem, registram o clique em `message_logs` e abrem uma URL do WhatsApp em nova aba. O envio e sempre manual; nao ha API oficial, automacao de disparo nem mensagens promocionais em massa nesta fase.

Nao houve migration na Fase 7. As tabelas `message_templates` e `message_logs` ja existem no schema inicial.
