# Fase 12 - Checklist

- [x] Dashboard tem filtro de periodo.
- [x] Dashboard usa `this_month` como periodo padrao.
- [x] Dashboard mostra faturamento total.
- [x] Dashboard mostra receita de manutencoes.
- [x] Dashboard mostra receita de vendas.
- [x] Dashboard mostra ticket medio de manutencao.
- [x] Dashboard mostra ticket medio de venda por registro de saida.
- [x] Dashboard mostra manutencoes abertas.
- [x] Dashboard mostra manutencoes atrasadas.
- [x] Dashboard mostra prontas para entrega.
- [x] Dashboard mostra aguardando peca.
- [x] Dashboard mostra garantias ativas.
- [x] Dashboard mostra garantias vencidas.
- [x] Dashboard mostra garantias vencendo.
- [x] Dashboard mostra produtos mais vendidos por quantidade.
- [x] Dashboard mostra produtos mais vendidos por faturamento.
- [x] Dashboard mostra itens para repor.
- [x] Dashboard mostra clientes novos.
- [x] Dashboard mostra total de clientes ativos.
- [x] Dashboard mostra clientes com WhatsApp autorizado.
- [x] Dashboard mostra clientes vindos do quiosque/tablet.
- [x] Dashboard mostra clientes recorrentes.
- [x] Layout e responsivo em cards e tabelas com overflow controlado.
- [x] Dados respeitam `organization_id` da organizacao atual.
- [x] `organization_id` nao vem do client.
- [x] `.env.local` continua ignorado e nao foi lido.
- [x] `pnpm lint` passa.
- [x] `pnpm typecheck` passa.
- [x] `pnpm build` passa.

## Validacao manual esperada

- [ ] Abrir `/dashboard` autenticado e com organizacao ativa.
- [ ] Conferir se nao ha dados mockados.
- [ ] Alterar periodo para hoje, semana atual, mes atual e mes passado.
- [ ] Validar receita de vendas contra SQL filtrado por periodo.
- [ ] Validar receita de manutencoes contra SQL filtrado por `delivered_at`.
- [ ] Validar top produtos por categoria/modelo.
- [ ] Testar em viewport mobile sem scroll horizontal ruim.
