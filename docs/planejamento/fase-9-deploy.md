# Fase 9 - Deploy do Piloto MVP 1

## Objetivo

Finalizar a auditoria tecnica, validar rotas principais, preparar o deploy na Vercel e deixar o MVP 1 pronto para validacao com cliente piloto.

## Pre-requisitos

- Migrations do Supabase aplicadas.
- RLS ativo nas tabelas do projeto.
- Usuario de teste criado no Supabase Auth.
- Variaveis de ambiente configuradas localmente e depois na Vercel.
- Branch revisada sem segredos versionados.

## Rotas auditadas

Publicas:

- `/`
- `/login`
- `/kiosk/[slug]`
- `/api/kiosk/customers`

Protegidas:

- `/dashboard`
- `/clientes`
- `/clientes/novo`
- `/clientes/[id]`
- `/clientes/[id]/editar`
- `/manutencoes`
- `/manutencoes/nova`
- `/manutencoes/rapida`
- `/manutencoes/[id]`
- `/manutencoes/[id]/editar`
- `/mensagens`
- `/configuracoes`
- `/configuracoes/quiosque`
- `/onboarding/organizacao`

## Como rodar build local

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
```

Para desenvolvimento local:

```bash
pnpm dev
```

Para testar em celular na mesma rede:

```bash
pnpm --dir apps/web dev --hostname 0.0.0.0
```

## Configuracao na Vercel

- Framework Preset: Next.js.
- Root Directory recomendado: `apps/web`.
- Install Command: deixar padrao ou usar `pnpm install`.
- Build Command: `pnpm build`.
- Output Directory: padrao do Next.js.

Se a Vercel detectar o monorepo automaticamente, confirme que o deploy esta apontando para `apps/web`.

## Variaveis de ambiente na Vercel

Configure em Project Settings > Environment Variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=
NEXT_PUBLIC_APP_URL=
```

Depois do primeiro deploy, atualize `NEXT_PUBLIC_APP_URL` para a URL final do projeto, por exemplo:

```txt
https://seu-projeto.vercel.app
```

Republique o deploy apos alterar essa variavel.

## Configuracao no Supabase

Em Authentication > URL Configuration:

- Site URL: usar o valor final de `NEXT_PUBLIC_APP_URL`.
- Redirect URLs: incluir a URL final da Vercel e, para desenvolvimento, `http://localhost:3000`.

Exemplos:

```txt
https://seu-projeto.vercel.app
http://localhost:3000
```

## Health check seguro

Nao foi criado endpoint publico de health check para evitar exposicao de estado interno ou segredos.

Validacao recomendada:

1. Abrir `/login` e confirmar renderizacao.
2. Entrar com usuario de teste.
3. Confirmar redirecionamento para `/dashboard` ou `/onboarding/organizacao`.
4. Abrir `/dashboard` e conferir dados reais da organizacao.
5. Criar token em `/configuracoes/quiosque`.
6. Abrir o link publico do quiosque em aba anonima.
7. Cadastrar cliente pelo quiosque.
8. Confirmar cliente em `/clientes`.
9. Criar manutencao rapida e verificar detalhe da OS.
10. Clicar em WhatsApp manual e confirmar abertura da URL do WhatsApp.

## Usuario de teste para cliente

1. No Supabase Auth, crie um usuario com email controlado para piloto.
2. Envie a senha inicial por canal seguro.
3. No primeiro login, preencha o onboarding da organizacao.
4. Crie um cliente, um token de quiosque e uma OS de teste antes de entregar o link.

## Checklist pos-deploy

- Deploy Vercel concluiu sem erro.
- Variaveis configuradas em Production.
- `NEXT_PUBLIC_APP_URL` aponta para a URL final.
- Supabase Site URL atualizado.
- Supabase Redirect URLs atualizadas.
- Usuario de teste consegue login.
- Dashboard abre sem 404.
- Rotas protegidas redirecionam anonimos para `/login`.
- Quiosque publico aceita token ativo e rejeita token invalido.
- WhatsApp manual abre em nova aba e registra clique.
- Cliente piloto recebeu URL final e credenciais.

## Pendencias nao criticas

- Avaliar migracao visual futura para um drawer client-side no menu mobile se a navegacao crescer.
- Revisar textos com acentuacao corrompida em arquivos antigos quando houver tempo editorial.
- Criar monitoramento externo de disponibilidade apos o piloto.
