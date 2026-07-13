# Fase 7 - Alertas Operacionais e WhatsApp Manual

## Objetivo

Implementar alertas operacionais do MVP 1 e mensagens prontas para WhatsApp manual, sem envio automatico, sem API oficial do WhatsApp e sem mensagens promocionais em massa.

## Dashboard

O dashboard exibe cards reais da organizacao atual:

- manutencoes em aberto: status diferente de `entregue` e `cancelado`, com `deleted_at` vazio;
- entregas de hoje: `expected_delivery_date` igual a hoje, status diferente de `entregue` e `cancelado`, com `deleted_at` vazio;
- manutencoes atrasadas: `expected_delivery_date` anterior a hoje, status diferente de `entregue` e `cancelado`, com `deleted_at` vazio;
- aguardando peca: status `aguardando_peca`;
- prontas para entrega: status `pronto_para_entrega`;
- clientes cadastrados hoje pelo tablet.

Tambem ha listas curtas para entregas de hoje e prontas para entrega. Cada item permite abrir o detalhe da OS e, quando ha telefone, gerar WhatsApp manual.

## Tipos de alerta

Tipos operacionais implementados:

- `maintenance_received`;
- `maintenance_ready`;
- `maintenance_reminder`;
- `delivery_today`.

Tipos documentados para futuro:

- `promotion_future`;
- `sales_future`.

Os tipos futuros nao devem ser usados para envio em massa nesta fase.

## WhatsApp manual

O sistema monta a mensagem, grava o clique em `message_logs` e devolve uma URL `https://wa.me/...` com texto codificado por `encodeURIComponent`.

O envio continua manual. O usuario revisa a mensagem no WhatsApp e confirma o envio fora do sistema.

Helpers criados:

- `normalizePhoneForWhatsApp(phone: string)`;
- `buildWhatsAppUrl(phone: string, message: string)`.

Regras dos helpers:

- remover caracteres nao numericos;
- manter telefones que ja possuem DDI `55`;
- adicionar `55` em numeros brasileiros com 10 ou 11 digitos;
- codificar o texto da mensagem na URL.

## Modelos de mensagem

A pagina `/mensagens` lista os modelos da organizacao, cria modelos padrao quando faltarem, permite editar titulo e corpo, restaurar o padrao e visualizar as variaveis disponiveis.

Modelos padrao:

- recebimento da manutencao;
- aparelho pronto para retirada;
- lembrete de retirada;
- entrega prevista para hoje.

## Variaveis disponiveis

- `{{cliente_nome}}`
- `{{cliente_telefone}}`
- `{{aparelho_modelo}}`
- `{{numero_ordem}}`
- `{{status}}`
- `{{data_entrega}}`
- `{{loja_nome}}`

Variaveis ausentes sao substituidas por texto vazio para evitar vazamento de dados internos ou erro no envio manual.

## message_logs

Cada clique em WhatsApp grava:

- `organization_id`;
- `customer_id`;
- `maintenance_order_id`;
- `message_type`;
- `channel = whatsapp_manual`;
- `message_body`;
- `opened_whatsapp_at`;
- `created_by`.

A action nao aceita `organization_id`, `customer_id` ou `maintenance_order_id` como fonte de verdade do client. Ela recebe apenas a OS e o tipo de mensagem, reconsulta a ordem dentro da organizacao atual e deriva os IDs no servidor.

## Operacional x promocional

Mensagens sobre manutencao, retirada e entrega sao comunicacoes operacionais do servico solicitado pelo cliente.

Mensagens promocionais futuras devem depender de `whatsapp_opt_in = true`, ter finalidade clara e mecanismo de descadastro quando o modulo comercial existir. A Fase 7 nao implementa disparo promocional em massa.

## Testes manuais

1. Acessar `/dashboard` com usuario autenticado e organizacao ativa.
2. Confirmar cards de manutencao em aberto, entregas de hoje, atrasadas, aguardando peca e prontas para entrega.
3. Abrir `/mensagens` e confirmar que os quatro modelos operacionais aparecem.
4. Editar um modelo e salvar.
5. Restaurar o modelo padrao.
6. Abrir uma OS em `/manutencoes/[id]`.
7. Clicar em um botao de WhatsApp.
8. Confirmar abertura do WhatsApp em nova aba.
9. Confirmar registro em `message_logs` com `channel = whatsapp_manual`.
10. Tentar acessar uma OS de outra organizacao e confirmar bloqueio por query/RLS.

