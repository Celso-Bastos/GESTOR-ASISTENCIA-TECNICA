# Fase 3 - Checklist

## Rotas e acesso

- [ ] `/clientes` abre apenas com usuario logado.
- [ ] Usuario sem login e redirecionado para `/login`.
- [ ] Usuario logado sem organizacao e redirecionado para `/onboarding/organizacao`.
- [ ] `/clientes/novo` abre apenas com usuario logado e organizacao.
- [ ] `/clientes/[id]` nao mostra cliente removido ou de outra organizacao.
- [ ] `/clientes/[id]/editar` nao edita cliente removido ou de outra organizacao.

## Cadastro

- [ ] Cliente e criado com `organization_id` correto.
- [ ] Nome obrigatorio e validado.
- [ ] Telefone obrigatorio e validado.
- [ ] Telefone e normalizado em `phone_normalized`.
- [ ] `source` fica como `manual`.
- [ ] Consentimento marcado salva `whatsapp_opt_in = true`.
- [ ] Consentimento marcado preenche `whatsapp_opt_in_at`.
- [ ] Consentimento desmarcado salva `whatsapp_opt_in = false`.
- [ ] Consentimento desmarcado deixa `whatsapp_opt_in_at = null`.

## Listagem e busca

- [ ] Cliente aparece na listagem.
- [ ] Busca por nome funciona.
- [ ] Busca por telefone funciona.
- [ ] Lista vazia mostra estado amigavel.
- [ ] Erro de carregamento mostra mensagem amigavel.
- [ ] Clientes com `deleted_at` preenchido nao aparecem.

## Edicao e exclusao

- [ ] Edicao de nome funciona.
- [ ] Edicao de telefone funciona.
- [ ] Edicao de consentimento funciona.
- [ ] Edicao de observacoes funciona.
- [ ] Edicao nao permite trocar `organization_id`.
- [ ] Cliente ativo duplicado e bloqueado.
- [ ] Soft delete funciona.
- [ ] Soft delete preenche `deleted_at`.
- [ ] Cliente deletado nao aparece mais.

## Banco e seguranca

- [ ] Migration `0002_customers_active_phone_unique.sql` aplicada no Supabase.
- [ ] Supabase RLS continua ativo.
- [ ] Usuario so acessa clientes da propria organizacao.
- [ ] `.env.local` continua ignorado.
- [ ] Nenhuma chave sensivel foi exposta.
- [ ] `SUPABASE_SECRET_KEY` nao foi usada em componentes client-side.

## Comandos

- [ ] `pnpm lint` passa.
- [ ] `pnpm typecheck` passa.
- [ ] `pnpm build` passa.
- [ ] `git status` revisado.
- [ ] Commit pronto para ser feito manualmente.
