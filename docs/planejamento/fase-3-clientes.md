# Fase 3 - Clientes

A Fase 3 implementa o modulo interno de clientes do MVP 1. O objetivo e permitir que a equipe autenticada cadastre, consulte, edite, visualize e remova logicamente clientes da organizacao atual.

## Rotas criadas

- `/clientes`: listagem, busca por nome ou telefone e acoes principais.
- `/clientes/novo`: cadastro de cliente manual.
- `/clientes/[id]`: detalhes basicos do cliente.
- `/clientes/[id]/editar`: edicao de cadastro.

Todas essas rotas ficam dentro do layout protegido do dashboard. Usuario sem login vai para `/login`; usuario logado sem organizacao vai para `/onboarding/organizacao`.

## Tabela usada

Tabela `public.customers`:

- `id`
- `organization_id`
- `name`
- `phone`
- `phone_normalized`
- `whatsapp_opt_in`
- `whatsapp_opt_in_at`
- `source`
- `notes`
- `created_at`
- `updated_at`
- `deleted_at`

## Regras de negocio

- Cliente sempre pertence a organizacao atual do usuario.
- `organization_id` nunca vem do formulario.
- Nome e telefone sao obrigatorios.
- Telefone e normalizado antes de salvar.
- Cliente ativo duplicado com mesmo `phone_normalized` e mesma `organization_id` e bloqueado.
- `source` e sempre `manual` nesta fase.
- `whatsapp_opt_in` so e verdadeiro quando o checkbox e marcado.
- `whatsapp_opt_in_at` recebe a data atual quando ha consentimento.
- `whatsapp_opt_in_at` fica `null` quando nao ha consentimento.
- Exclusao e soft delete: o sistema preenche `deleted_at`.
- Listagens e detalhes ignoram registros com `deleted_at` preenchido.
- Edicao nao permite trocar a organizacao do cliente.

## Validacoes

As validacoes ficam em `apps/web/src/lib/validations/customer.schema.ts`.

- `createCustomerSchema`: valida cadastro.
- `updateCustomerSchema`: valida edicao.
- `customerSearchSchema`: valida termo de busca.

O telefone e tratado por `apps/web/src/lib/phone.ts`:

- `normalizePhoneBR(phone)`: remove caracteres nao numericos e remove prefixo `55` quando aplicavel.
- `formatPhoneBR(phone)`: exibe telefones com DDD em formato legivel.

## Consentimento WhatsApp

O checkbox usado no cadastro e edicao registra se o cliente aceita receber mensagens da loja pelo WhatsApp sobre manutencao, entrega, produtos e promocoes.

Esse campo prepara o sistema para fases futuras. Mensagens promocionais devem considerar apenas clientes com `whatsapp_opt_in = true`.

## Soft delete

Clientes nao sao apagados fisicamente. A action `deleteCustomerAction` preenche `deleted_at` com a data atual.

A migration `0002_customers_active_phone_unique.sql` troca a unicidade antiga por um indice unico parcial, bloqueando telefone duplicado apenas entre clientes ativos.

## Seguranca e LGPD

- As actions chamam `requireAuth()` e `requireOrganization()`.
- O Supabase client server-side usa a sessao do usuario e respeita RLS.
- Nenhuma action aceita `organization_id` vindo do navegador.
- A chave `SUPABASE_SECRET_KEY` nao e usada no modulo de clientes.
- Nome, telefone e observacoes devem ser tratados como dados pessoais.
- Observacoes nao devem receber dados sensiveis desnecessarios.

## Testes manuais

1. Acessar `/clientes` sem login e confirmar redirecionamento para `/login`.
2. Fazer login com usuario valido.
3. Se necessario, criar a organizacao inicial.
4. Acessar `/clientes` e clicar em `Novo cliente`.
5. Criar cliente com nome, telefone e consentimento marcado.
6. Confirmar que o cliente aparece na listagem.
7. Buscar por parte do nome.
8. Buscar por parte do telefone.
9. Abrir detalhes do cliente.
10. Editar nome, telefone, consentimento e observacoes.
11. Tentar criar outro cliente ativo com o mesmo telefone e confirmar bloqueio.
12. Excluir o cliente e confirmar que ele desaparece da listagem.
13. Validar no Supabase que `deleted_at` foi preenchido.
