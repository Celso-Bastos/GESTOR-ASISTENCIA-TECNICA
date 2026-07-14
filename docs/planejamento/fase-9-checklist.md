# Fase 9 - Checklist Final

- [x] `git status` revisado.
- [x] `.env.local` ignorado.
- [x] Nomes de variaveis revisados em `.env.example`, README e docs.
- [x] Rotas publicas revisadas.
- [x] Rotas protegidas revisadas.
- [x] Proxy do Next 16 atualizado.
- [x] `SUPABASE_SECRET_KEY` restrita a helper server-only.
- [x] Clientes revisado.
- [x] Quiosque revisado.
- [x] Manutencoes revisado.
- [x] Manutencao rapida revisada.
- [x] WhatsApp manual revisado.
- [x] Dashboard e alertas revisados.
- [x] Mobile basico revisado.
- [x] `pnpm lint` passa.
- [x] `pnpm typecheck` passa.
- [x] `pnpm build` passa.
- [ ] Vercel configurada.
- [ ] Variaveis na Vercel configuradas.
- [ ] Supabase URLs atualizadas.
- [ ] Usuario de teste criado.
- [ ] Cliente recebeu link de piloto.

## Rotas para validacao manual

- `/`
- `/login`
- `/dashboard`
- `/clientes`
- `/clientes/novo`
- `/manutencoes`
- `/manutencoes/nova`
- `/manutencoes/rapida`
- `/mensagens`
- `/configuracoes`
- `/configuracoes/quiosque`
- `/onboarding/organizacao`
- `/kiosk/[slug]?token=[token]`

## Resultado da auditoria

- Bugs criticos corrigidos: nomes antigos em `.env.example` e convencao `middleware` depreciada no Next 16.
- Bugs criticos nao confirmados na revisao estatica: soft delete apagando fisicamente, redirect para rota inexistente, exposicao de dados entre organizacoes.
- Pendencias manuais: validar login, criacao de dados e WhatsApp manual com Supabase real antes de entregar ao cliente.
