# Fase 4 - Quiosque / Tablet

## Objetivo

Implementar uma tela publica para tablet de balcao em que o proprio cliente informa nome, telefone/WhatsApp e consentimento de contato.

## Fluxo do tablet

1. Usuario logado cria um token em `/configuracoes/quiosque`.
2. O sistema gera o link `/kiosk/[slug]?token=[token]`.
3. O link e aberto no tablet ou em aba anonima.
4. O cliente informa nome, WhatsApp e aceita o contato.
5. A rota `/api/kiosk/customers` valida os dados e grava o cliente.
6. A equipe confere o cadastro em `/clientes`.

## Rota publica

`/kiosk/[slug]` abre sem login, mas exige query string `token`. A pagina valida o slug da organizacao, token pertencente a ela e `is_active = true`. Se o token estiver invalido ou desativado, a tela mostra erro amigavel sem listar dados internos.

## Token

Tokens ficam em `kiosk_tokens`, sao criados por usuarios autenticados da organizacao atual e podem ser desativados. O link completo usa `NEXT_PUBLIC_APP_URL`; em desenvolvimento sem essa variavel, usa `http://localhost:3000`.

## Seguranca

- A tela publica nao lista clientes, manutencoes, organizacao ou dados internos.
- O endpoint aceita apenas `POST`.
- O payload tem limite simples de tamanho.
- Nome e telefone tem tamanho maximo.
- Telefone precisa ter DDD valido apos normalizacao.
- Campo honeypot opcional bloqueia envios automatizados simples.
- Erros do banco nao sao retornados ao publico.
- `SUPABASE_SECRET_KEY` fica somente em server-side.

## Consentimento WhatsApp

O cadastro publico exige aceite explicito do texto de contato por WhatsApp. Quando aceito, `whatsapp_opt_in = true` e `whatsapp_opt_in_at` recebe a data do envio.

## Duplicidade

Se ja existir cliente ativo com o mesmo `phone_normalized` na mesma organizacao, o endpoint nao cria duplicado. Ele atualiza nome, telefone e consentimento e retorna sucesso generico. A origem original do cliente existente e preservada para manter a primeira fonte do cadastro; novos cadastros do tablet entram com `source = tablet`.

## Como testar

1. Rode `pnpm dev`.
2. Entre no painel com usuario autenticado.
3. Acesse `/configuracoes/quiosque`.
4. Crie um token.
5. Copie o link gerado.
6. Abra o link em aba anonima.
7. Cadastre um cliente.
8. Valide o cliente em `/clientes` e no Supabase.
9. Cadastre novamente o mesmo telefone e confirme que nao duplica.
10. Desative o token.
11. Abra o link novamente e confirme que o cadastro fica bloqueado.
