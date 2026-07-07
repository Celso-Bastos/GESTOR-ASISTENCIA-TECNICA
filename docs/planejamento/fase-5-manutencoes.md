# Fase 5 - Manutencoes / Ordens de Servico

## Objetivo

Implementar o modulo de manutencoes do MVP 1, permitindo abrir OS para clientes existentes, registrar aparelhos, acompanhar status, editar dados basicos e consultar historico de eventos por organizacao.

## Rotas criadas

- `/manutencoes`: listagem com busca, filtro por status e filtro de atrasadas.
- `/manutencoes/nova`: criacao de manutencao.
- `/manutencoes/[id]`: detalhe da OS, dados do cliente/aparelho, status e historico.
- `/manutencoes/[id]/editar`: edicao basica da OS e do aparelho.

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

## Regra de atrasado

Uma OS esta atrasada quando:

- `expected_delivery_date < hoje`;
- `status` diferente de `entregue`;
- `status` diferente de `cancelado`;
- `deleted_at is null`.

O filtro `/manutencoes?status=atrasados` aplica essa regra.

## Dashboard

O dashboard passou a mostrar cards baseados em `maintenance_orders`:

- Manutencoes em aberto: status diferente de `entregue` e `cancelado`.
- Entregas de hoje: previsao igual a hoje e status aberto.
- Aguardando peca: status `aguardando_peca`.
- Prontos para entrega: status `pronto_para_entrega`.
- Atrasadas: previsao anterior a hoje e status aberto.

O card de clientes do tablet hoje foi mantido.

## Cuidados de seguranca

- Todas as actions exigem usuario autenticado.
- Todas as actions exigem organizacao atual.
- Consultas, inserts e updates usam `organization_id` da sessao.
- A action valida se o cliente pertence a organizacao atual antes de abrir OS.
- Detalhe e edicao retornam `notFound()` quando a OS nao existe ou nao pertence a organizacao atual.
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

## Migration

A Fase 5 adicionou `supabase/migrations/0003_maintenance_order_rpc.sql`.

Essa migration cria a funcao `public.create_maintenance_order`, usada para criar aparelho, ordem e evento inicial de forma atomica. As tabelas `devices`, `maintenance_orders` e `maintenance_events`, seus indices, enum de status e constraint unica de `order_number` por organizacao ja existiam em `0001_initial_schema.sql`.
