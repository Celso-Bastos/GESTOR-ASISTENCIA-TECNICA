# Fase 5 - Manutencoes / Ordens de Servico

## Objetivo

Implementar o modulo de manutencoes do MVP 1, permitindo abrir OS para clientes existentes, registrar aparelhos, acompanhar status, editar dados basicos e consultar historico de eventos por organizacao.

## Rotas criadas

- `/manutencoes`: listagem com busca, filtro por status e filtro de atrasadas.
- `/manutencoes/nova`: criacao de manutencao.
- `/manutencoes/[id]`: detalhe da OS, dados do cliente/aparelho, status e historico.
- `/manutencoes/[id]/editar`: edicao basica da OS e do aparelho.
- `/manutencoes/rapida`: fluxo curto criado na Fase 6 para abrir OS no balcao.

Todas as rotas ficam no grupo protegido do dashboard. Usuario sem login vai para `/login`; usuario sem organizacao vai para `/onboarding/organizacao`.

## Fluxo de criacao de OS

1. A equipe acessa `/manutencoes/nova`.
2. Seleciona um cliente ativo da organizacao atual.
3. Informa dados do aparelho, com modelo obrigatorio.
4. Informa defeito relatado, previsao de entrega, valor estimado e observacoes internas.
5. A action valida os dados com Zod.
6. A action chama a RPC `create_maintenance_order`.
7. O banco cria o registro em `devices`.
8. O banco gera `order_number` no formato `OS-000001`.
9. O banco cria `maintenance_orders` com status inicial `recebido`.
10. O banco cria `maintenance_events` com `event_type = created`.

Os passos 7 a 10 acontecem na mesma transacao do Postgres. Se qualquer insert falhar, nenhum registro parcial fica salvo.

`organization_id` e sempre obtido da organizacao atual da sessao. O formulario nao envia nem controla esse campo.

## Numero da OS

O numero e gerado no banco, por organizacao, buscando o maior `order_number` existente e incrementando o valor numerico. A funcao usa `pg_advisory_xact_lock` por organizacao para evitar corrida entre criacoes simultaneas. A constraint `unique (organization_id, order_number)` continua protegendo duplicidade.

## Mudanca de status

Status disponiveis:

- `recebido`
- `em_analise`
- `aguardando_peca`
- `em_manutencao`
- `pronto_para_entrega`
- `entregue`
- `cancelado`

Ao alterar status:

- `maintenance_orders.status` e atualizado.
- Se o novo status for `entregue`, `delivered_at` recebe a data/hora atual.
- Se uma OS sair de `entregue`, `delivered_at` e limpo para refletir que ela nao esta mais entregue.
- Um evento `status_changed` e criado em `maintenance_events` com status antigo, status novo, descricao e usuario atual.

## Historico de eventos

A pagina de detalhe exibe os eventos de `maintenance_events`, incluindo criacao da ordem e mudancas de status. O historico e sempre filtrado por `organization_id` e `maintenance_order_id`.

## Exclusao de OS

A exclusao de manutencao e sempre soft delete. A action `deleteMaintenanceOrderAction` valida o UUID da OS, exige usuario autenticado e organizacao atual, busca a ordem por `id` e `organization_id` e atualiza `maintenance_orders.deleted_at` com a data/hora atual. O campo `updated_at` tambem e atualizado.

Nao e usado hard delete nem `.delete()` no Supabase para manutencoes. O registro da OS permanece no banco, assim como cliente, aparelho, `maintenance_events` e `message_logs`.

Ao excluir, a action cria um evento em `maintenance_events` com `event_type = maintenance_deleted`, `old_status` com o status anterior, `new_status = null`, descricao `Ordem de servico excluida por soft delete.` e `created_by` com o usuario atual.

Consultas operacionais de listagem, busca, filtros, detalhe, dashboard, alertas e WhatsApp manual devem manter `deleted_at is null`. Como o detalhe tambem filtra `deleted_at is null`, acessar diretamente `/manutencoes/[id]` de uma OS excluida retorna `notFound()`.

## Regra de atrasado

Uma OS esta atrasada quando:

- `expected_delivery_date < hoje`;
- `status` diferente de `entregue`;
- `status` diferente de `cancelado`;
- `deleted_at is null`.

O filtro `/manutencoes?status=atrasados` aplica essa regra.

## Dashboard

O dashboard passou a mostrar cards baseados em `maintenance_orders`:

- Manutencoes em aberto: status em aberto e `deleted_at is null`.
- Entregas de hoje: previsao igual a hoje, status aberto e `deleted_at is null`.
- Aguardando peca: status `aguardando_peca` e `deleted_at is null`.
- Prontos para entrega: status `pronto_para_entrega` e `deleted_at is null`.
- Atrasadas: previsao anterior a hoje, status aberto e `deleted_at is null`.

O card de clientes do tablet hoje foi mantido.

## Cuidados de seguranca

- Todas as actions exigem usuario autenticado.
- Todas as actions exigem organizacao atual.
- Consultas, inserts e updates usam `organization_id` da sessao.
- A action valida se o cliente pertence a organizacao atual antes de abrir OS.
- Detalhe e edicao retornam `notFound()` quando a OS nao existe, nao pertence a organizacao atual ou foi excluida por soft delete.
- Exclusao de OS nao aceita `organization_id` vindo do client; a organizacao vem da sessao.
- `SUPABASE_SECRET_KEY` nao e usada em componentes client-side.
- Erros internos do banco nao sao expostos diretamente ao usuario.
- RLS continua sendo a barreira final de isolamento multiempresa.

## Testes manuais

1. Rodar `pnpm dev`.
2. Entrar com usuario autenticado e organizacao criada.
3. Criar um cliente em `/clientes/novo`.
4. Abrir `/manutencoes/nova`.
5. Selecionar o cliente, preencher aparelho e defeito.
6. Salvar e validar redirecionamento para `/manutencoes/[id]`.
7. Confirmar que o numero segue o formato `OS-000001`.
8. Conferir na listagem `/manutencoes`.
9. Testar busca por cliente, telefone, modelo e numero da OS.
10. Testar filtros de status e atrasadas.
11. Alterar status e confirmar evento no historico.
12. Marcar como entregue e confirmar `delivered_at`.
13. Editar dados basicos e confirmar persistencia.
14. Abrir `/dashboard` e conferir os cards.
15. Tentar acessar uma OS de outra organizacao e confirmar bloqueio/not found.
16. Excluir uma OS pelo detalhe e confirmar que ela some da listagem e do dashboard.
17. Consultar o banco e confirmar `maintenance_orders.deleted_at` preenchido e evento `maintenance_deleted`.

## Migration

A Fase 5 adicionou `supabase/migrations/0003_maintenance_order_rpc.sql`.

Essa migration cria a funcao `public.create_maintenance_order`, usada para criar aparelho, ordem e evento inicial de forma atomica. As tabelas `devices`, `maintenance_orders` e `maintenance_events`, seus indices, enum de status e constraint unica de `order_number` por organizacao ja existiam em `0001_initial_schema.sql`.
