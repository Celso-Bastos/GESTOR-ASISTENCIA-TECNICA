# Banco de Dados

A Fase 1 cria a base do Supabase Postgres para o MVP 1 do sistema de gerenciamento de assistencia tecnica de celulares. A migration versionada fica em `supabase/migrations/0001_initial_schema.sql` e deve ser aplicada manualmente apos revisao.

## Enums

- `user_role`: `owner`, `admin`, `employee`.
- `customer_source`: `manual`, `tablet`, `future_import`.
- `maintenance_status`: `recebido`, `em_analise`, `aguardando_peca`, `em_manutencao`, `pronto_para_entrega`, `entregue`, `cancelado`.
- `message_type`: `maintenance_received`, `maintenance_ready`, `maintenance_reminder`, `delivery_today`, `promotion_future`, `sales_future`.
- `message_channel`: `whatsapp_manual`, `whatsapp_api_future`, `sms_future`, `email_future`.

## Tabelas

- `organizations`: representa cada assistencia tecnica/empresa. O `slug` e unico e pode ser usado para rotas, identificacao interna e configuracoes futuras.
- `profiles`: dados complementares do usuario autenticado pelo Supabase Auth. O vinculo real com login fica em `user_id`, referenciando `auth.users`.
- `organization_members`: liga usuarios a organizacoes e define o papel operacional (`owner`, `admin` ou `employee`).
- `customers`: clientes da organizacao, com nome, telefone, telefone normalizado, consentimento para WhatsApp e origem do cadastro.
- `devices`: aparelhos vinculados a clientes, incluindo marca, modelo, cor, armazenamento, IMEI e observacoes.
- `maintenance_orders`: ordens de manutencao, status, diagnostico, previsao de entrega, valores estimados/finais e observacoes internas.
- `maintenance_events`: historico de eventos de cada ordem, incluindo mudancas de status e usuario que registrou o evento.
- `message_templates`: modelos de mensagens prontas para WhatsApp manual e canais futuros.
- `message_logs`: historico minimo das mensagens preparadas/abertas para envio manual, sem armazenar conversa completa.
- `kiosk_tokens`: tokens controlados para tablet/quiosque de cadastro.

## Relacionamentos

- `profiles.user_id` referencia `auth.users.id`.
- `organization_members.organization_id` referencia `organizations.id`.
- `organization_members.user_id` referencia `auth.users.id`.
- `customers.organization_id`, `devices.organization_id`, `maintenance_orders.organization_id`, `maintenance_events.organization_id`, `message_templates.organization_id`, `message_logs.organization_id` e `kiosk_tokens.organization_id` separam os dados por organizacao.
- `devices.customer_id` referencia `customers.id`.
- `maintenance_orders.customer_id` referencia `customers.id` com `on delete restrict`, preservando historico de ordens.
- `maintenance_orders.device_id` referencia `devices.id` com `on delete restrict`.
- `maintenance_events.maintenance_order_id` referencia `maintenance_orders.id`.
- `message_logs.customer_id` e `message_logs.maintenance_order_id` ligam a mensagem ao contexto operacional quando houver.

## Por que usar organization_id

O `organization_id` e o eixo de isolamento multiempresa. Ele permite que a mesma aplicacao atenda varias assistencias tecnicas sem misturar clientes, aparelhos, ordens, templates, logs ou tokens de quiosque. Tambem simplifica as policies de RLS: quase toda tabela operacional valida se `auth.uid()` pertence a organizacao informada.

## RLS

Todas as tabelas da Fase 1 tem Row Level Security ativado. A funcao `public.is_org_member(org_id uuid)` verifica se o usuario autenticado pertence a organizacao. As policies basicas permitem:

- visualizar organizacoes das quais o usuario e membro;
- visualizar, inserir e atualizar o proprio `profile`;
- visualizar membros da propria organizacao;
- ler, inserir e atualizar clientes, aparelhos e ordens da propria organizacao;
- ler e inserir eventos e logs de mensagem da propria organizacao;
- ler, inserir e atualizar templates da propria organizacao;
- gerenciar tokens de quiosque da propria organizacao.

## Escalabilidade futura

O schema reserva enums e campos para canais futuros (`whatsapp_api_future`, `sms_future`, `email_future`) e tipos promocionais/vendas futuras sem implementar esses modulos no MVP 1. A separacao por organizacao, os indices por status/data e o uso de historico de eventos deixam caminho aberto para alertas, relatorios, permissoes por papel, importacoes e automacoes sem remodelar a base principal.
