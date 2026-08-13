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
- [x] Criar produto/modelo funciona.
- [x] Editar produto/modelo funciona.
- [x] Categoria tem valor base em constante.
- [x] Produto/modelo pode ter valor proprio opcional.
- [x] Busca por nome em `/saidas/modelos` funciona.
- [x] Filtro por categoria em `/saidas/modelos` funciona.
- [x] Categoria `privacy_screen_protector` (Película privativa) disponivel em modelos, saidas e relatorio.
- [x] Registrar saida com modelo salvo funciona.
- [x] Valor base da categoria preenche o input da saida sem modelo salvo.
- [x] Valor proprio do modelo tem prioridade na saida.
- [x] Valor unitario pode ser editado na saida.
- [x] Editar valor na saida nao muda o valor base da categoria nem o valor do modelo.
- [x] Registrar saida esporadica funciona.
- [x] Salvar modelo a partir da saida funciona.
- [x] `total_price` calculado no servidor.
- [x] Relatorio mensal agrupa por categoria e modelo.
- [x] Copiar lista de reposicao funciona.
- [x] Lista copiada respeita filtros de mes e categoria.
- [x] Fallback de copia manual documentado e implementado.
- [x] Soft delete de saida funciona.
- [x] `.env.local` continua ignorado.
- [x] `pnpm lint` passa.
- [x] `pnpm typecheck` passa.
- [x] `pnpm build` passa.

## Testes manuais esperados

1. Criar saida escolhendo categoria `Película` sem modelo e confirmar valor unitario `10`.
2. Criar saida escolhendo categoria `Película privativa` sem modelo e confirmar valor unitario `20`.
3. Criar saida escolhendo categoria `Case` sem modelo e confirmar valor unitario `20`.
4. Criar produto/modelo `Película | iPhone 11 | 15`.
5. Registrar saida com esse modelo e confirmar valor unitario `15`.
6. Alterar valor unitario da saida para `12` antes de salvar e confirmar que `total_price` usa `12 * quantidade`.
7. Confirmar que o modelo continua com `15` e a categoria `Película` continua com base `10`.
8. Acessar `/relatorios/reposicao` e conferir agrupamento do mes atual.
9. Clicar "Copiar lista para reposicao" e colar no bloco de notas.
10. Confirmar que a lista copiada usa `Case` e `Película privativa`.
11. Simular navegador sem Clipboard API e confirmar textarea selecionavel para copia manual.
