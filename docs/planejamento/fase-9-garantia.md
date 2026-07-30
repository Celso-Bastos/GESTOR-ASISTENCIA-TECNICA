# Fase 9 - Garantia em Manutencoes

## Objetivo

Adicionar garantia dentro da ordem de servico e permitir uma mensagem manual de WhatsApp apenas como lembrete da garantia aceita pelo cliente.

## Campos adicionados

Migration: `supabase/migrations/0004_add_warranty_to_maintenance_orders.sql`.

Campos em `maintenance_orders`:

- `warranty_enabled boolean default false not null`
- `warranty_signed boolean default false not null`
- `warranty_amount integer null`
- `warranty_unit text null`
- `warranty_started_at date null`
- `warranty_expires_at date null`
- `warranty_notes text null`
- `warranty_message_sent_at timestamptz null`

Checks simples:

- `warranty_amount` deve ser maior que zero quando informado.
- `warranty_unit` deve ser `days`, `months` ou `null`.

Esses checks sao seguros para banco existente porque os campos novos entram como `null` ou `false` em OS antigas.

## Assinatura ou aceite

A mensagem de garantia so pode ser aberta no WhatsApp quando:

- a OS possui `warranty_enabled = true`;
- o cliente aceitou ou assinou a garantia (`warranty_signed = true`);
- quantidade, unidade e validade calculada estao preenchidas;
- a OS pertence a organizacao atual;
- a OS nao foi excluida por soft delete.

Assinatura digital desenhada, PDF e comprovante formal ficam para fase futura.

## Calculo da validade

O formulario nao envia `warranty_expires_at` como fonte de verdade. A validade e calculada no servidor com `calculateWarrantyExpiration(startDate, amount, unit)`:

- `days`: soma a quantidade em dias;
- `months`: soma a quantidade em meses;
- datas invalidas retornam erro amigavel.

O calculo e usado nas actions de criar e editar manutencao.

## WhatsApp manual

Tipo de mensagem: `warranty_notice`.

Template padrao:

```txt
Ola, {{cliente_nome}}! Sua manutencao do aparelho {{aparelho_modelo}} possui garantia de {{garantia_periodo}}, valida ate {{garantia_validade}}. Ordem: {{numero_ordem}}.
```

Novas variaveis:

- `{{garantia_periodo}}`
- `{{garantia_validade}}`

Variaveis mantidas:

- `{{cliente_nome}}`
- `{{cliente_telefone}}`
- `{{aparelho_modelo}}`
- `{{numero_ordem}}`
- `{{status}}`
- `{{data_entrega}}`
- `{{loja_nome}}`

O sistema apenas registra o clique e abre `wa.me`. Nao existe API oficial, envio automatico, campanha em massa ou promocao.

## Logs e historico

Ao abrir a mensagem de garantia:

- cria `message_logs` com `message_type = warranty_notice`, `channel = whatsapp_manual`, corpo da mensagem, usuario atual e horario de abertura;
- atualiza `maintenance_orders.warranty_message_sent_at`;
- cria evento `maintenance_events.event_type = warranty_message_opened` com a descricao `Mensagem de garantia aberta no WhatsApp.`

## Limites do MVP

- Nao ha assinatura digital desenhada.
- Nao ha PDF de garantia.
- Nao ha envio automatico.
- Nao ha WhatsApp API oficial.
- Nao ha estoque, vendas ou campanhas.
- A garantia e operacional e vinculada a OS da organizacao atual.
