# Fase 10 - Mensagens Personalizadas

## Objetivo

Permitir que cada organizacao crie, edite, desative e use mensagens proprias no WhatsApp manual, alem dos modelos padrao do sistema.

## Modelos padrao x mensagens personalizadas

Modelos padrao ficam em `message_templates` e representam tipos operacionais fixos do sistema, como recebimento, pronto para retirada, lembrete, entrega hoje e garantia.

Mensagens personalizadas ficam em `custom_message_templates`. Elas pertencem sempre a organizacao atual, podem ter titulos e corpos livres, e sao separadas por contexto.

## Contextos

- `maintenance`: manutencao.
- `warranty`: garantia.
- `customer`: cliente.
- `sales`: venda futura.
- `general`: uso geral.

No detalhe da OS, o MVP usa mensagens ativas com contexto `maintenance`, `warranty` ou `general`.

## Variaveis disponiveis

- `{{cliente_nome}}`
- `{{cliente_telefone}}`
- `{{aparelho_modelo}}`
- `{{numero_ordem}}`
- `{{status}}`
- `{{data_entrega}}`
- `{{garantia_periodo}}`
- `{{garantia_validade}}`
- `{{loja_nome}}`

Quando nao ha OS real na tela de configuracao, o preview usa dados ficticios seguros.

## WhatsApp manual

O sistema nao envia mensagens automaticamente. A action server-side valida usuario, organizacao, OS e telefone, interpola a mensagem, registra `message_logs` e devolve uma URL `wa.me` para abrir em nova aba.

## message_logs

Mensagens personalizadas usadas na OS registram:

- `organization_id` da organizacao atual;
- `customer_id` derivado da OS;
- `maintenance_order_id` derivado da OS;
- `message_type = custom_message`;
- `channel = whatsapp_manual`;
- `message_body` interpolado;
- `opened_whatsapp_at = now()`;
- `created_by` com o usuario atual.

## RLS

A tabela `custom_message_templates` usa RLS com `public.is_org_member(organization_id)`. Usuario autenticado so pode selecionar, inserir e atualizar mensagens da propria organizacao. Desativacao usa update com `is_active = false` e `deleted_at` preenchido; nao ha hard delete no fluxo.

## Limitacoes do MVP

- Nao ha API oficial do WhatsApp.
- Nao ha envio automatico.
- Nao ha campanhas em massa.
- Mensagens promocionais futuras devem respeitar opt-in e regras de descadastro.
- O conteudo das mensagens personalizadas e responsabilidade da organizacao usuaria.

## Fase futura

A API oficial do WhatsApp, campanhas, opt-in promocional detalhado e metricas avancadas ficam para fases futuras.
