# Fase 11 - Checklist

- [x] Migration criada.
- [x] Tabelas `product_model_templates` e `product_outflows` criadas.
- [x] RLS ativa nas duas tabelas.
- [x] Policies criadas por organizacao.
- [x] `/saidas` abre.
- [x] `/saidas/nova` funciona.
- [x] `/saidas/modelos` funciona.
- [x] `/relatorios/reposicao` funciona.
- [x] Criar modelo salvo funciona.
- [x] Registrar saida com modelo salvo funciona.
- [x] Registrar saida esporadica funciona.
- [x] Salvar modelo a partir da saida funciona.
- [x] `total_price` calculado no servidor.
- [x] Relatorio mensal agrupa por categoria e modelo.
- [x] Soft delete de saida funciona.
- [x] `.env.local` continua ignorado.
- [x] `pnpm lint` passa.
- [x] `pnpm typecheck` passa.
- [x] `pnpm build` passa.

## Testes manuais esperados

1. Criar modelo salvo `Pelicula | iPhone 11 | 25`.
2. Registrar saida com modelo salvo `Pelicula iPhone 11 | qtd 2 | unitario 25`.
3. Confirmar `total_price = 50` na lista.
4. Registrar saida esporadica `Capinha | Motorola Edge 40 Neo | qtd 1 | unitario 35` sem salvar modelo.
5. Confirmar que a saida aparece em `/saidas` e nao aparece em `/saidas/modelos`.
6. Registrar saida `Carregador | Turbo USB-C | unitario 50` salvando como modelo.
7. Confirmar saida criada e modelo salvo criado.
8. Acessar `/relatorios/reposicao` e conferir agrupamento do mes atual.
