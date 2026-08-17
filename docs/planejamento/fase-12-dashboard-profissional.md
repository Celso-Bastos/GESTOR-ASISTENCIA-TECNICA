# Fase 12 - Dashboard profissional

## Objetivo

Transformar `/dashboard` em uma visao profissional de desempenho da assistencia, com leitura financeira de faturamento, operacao de manutencoes, vendas/saidas, reposicao e clientes.

## Receita, nao lucro

Nesta fase o dashboard mostra receita/faturamento. Ele nao calcula lucro real porque o MVP ainda nao registra custo de peca, custo do produto, mao de obra, taxas, impostos ou despesas.

Fontes usadas:

- `maintenance_orders.final_price` para receita de manutencoes entregues no periodo;
- `product_outflows.total_price` para receita de saidas/vendas no periodo.

Termos corretos na interface:

- Faturamento total;
- Receita com manutencoes;
- Receita com vendas;
- Ticket medio.

## Filtros de periodo

O filtro padrao e `this_month`.

Periodos implementados:

- `today`;
- `this_week`;
- `this_month`;
- `last_month`;
- `custom`, com `start` e `end` simples via query string.

O periodo afeta receita, vendas, clientes novos, manutencoes entregues e produtos mais vendidos.

## Metricas financeiras

- Faturamento total: receita de manutencoes + receita de vendas/saidas.
- Receita com manutencoes: soma de `final_price` das ordens entregues no periodo, com `deleted_at is null`.
- Receita com vendas: soma de `total_price` de `product_outflows` no periodo, com `deleted_at is null`.
- Ticket medio de manutencao: receita de manutencoes dividida pela quantidade de manutencoes entregues com valor final.
- Ticket medio de venda: receita de vendas dividida pela quantidade de registros de saida. Esta escolha e intencional para o MVP; ticket por unidade pode ser adicionado depois.

## Metricas de manutencao

- Manutencoes abertas: status diferente de `entregue` e `cancelado`.
- Entregues no periodo: status `entregue` com `delivered_at` dentro do periodo.
- Manutencoes atrasadas: `expected_delivery_date` anterior a hoje e status ainda aberto.
- Prontas para entrega: status `pronto_para_entrega`.
- Aguardando peca: status `aguardando_peca`.
- Garantias ativas: garantia habilitada, assinada e com validade maior ou igual a hoje.
- Garantias vencidas: garantia habilitada, assinada e com validade anterior a hoje.
- Garantias vencendo: garantias ativas que vencem nos proximos 7 dias.

## Metricas de vendas

As vendas usam `product_outflows` com `organization_id` da organizacao atual, `deleted_at is null` e `sold_at` dentro do periodo.

Metricas exibidas:

- total de unidades vendidas;
- total de registros de saida;
- categoria mais vendida;
- produto/modelo mais vendido;
- top 5 produtos por quantidade;
- top 5 produtos por faturamento.

## Reposicao

A secao "Itens para repor" reutiliza o mesmo agrupamento do relatorio de reposicao: categoria + modelo salvo ou modelo digitado. No dashboard ela mostra os principais itens do periodo selecionado, com quantidade que saiu e total vendido.

## Metricas de clientes

- Clientes novos no periodo;
- Total de clientes ativos;
- Clientes com WhatsApp autorizado;
- Clientes vindos do quiosque/tablet no periodo;
- Clientes recorrentes, definidos no MVP como clientes com mais de uma manutencao.

## Comparacao com periodo anterior

O dashboard mostra comparacao percentual para:

- faturamento total;
- receita de vendas;
- manutencoes entregues.

Quando nao ha base no periodo anterior, a interface mostra que nao existe base anterior em vez de dividir por zero.

## Seguranca

- A funcao `getDashboardMetrics` exige usuario autenticado.
- A organizacao e obtida no servidor por `requireOrganization`.
- `organization_id` nunca vem do client.
- Todas as consultas filtram por `organization_id` da organizacao atual.
- As consultas respeitam RLS e ignoram registros com `deleted_at`.
- Nenhum valor de `.env.local` e lido, impresso ou exposto.
- O dashboard nao cria WhatsApp API, automacao de envio, campanha em massa, estoque fixo ou financeiro complexo.

## Limitacoes do MVP

- Lucro real fica para fase futura com registro de custos.
- Ticket medio de venda e por registro de saida, nao por unidade.
- Manutencoes entregues dependem de `delivered_at` preenchido.
- Os agrupamentos sao calculados no servidor da aplicacao para manter clareza; agregacoes SQL/RPC podem ser criadas no futuro se o volume exigir.
- Graficos complexos nao foram adicionados para evitar dependencia pesada.
