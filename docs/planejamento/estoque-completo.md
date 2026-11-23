# Atualização 1 — Estoque Completo

## Auditoria do estado anterior

O catálogo e as saídas foram introduzidos em `0006_add_product_outflows.sql`. As migrations `0007` e `0008` sincronizam as nove categorias existentes. O último número encontrado antes desta atualização era **0016**. Nenhuma migration anterior foi alterada.

`product_model_templates` já tinha `id`, `organization_id`, `category`, `model_name`, `default_price numeric(10,2)` nullable, `is_active`, `created_by`, `created_at`, `updated_at` e `deleted_at`. Não havia saldo, mínimo, custo nem campo de marca. A unicidade dos modelos ativos é por organização, categoria e nome normalizado; inativos/excluídos ficam fora desse índice.

`product_outflows` já tinha `id`, `organization_id`, `category`, `model_template_id` nullable, `custom_model_name` nullable, `quantity integer > 0`, `unit_price numeric(10,2)`, `total_price numeric(10,2)`, `sold_at date`, `customer_id` opcional, `notes`, `created_by`, timestamps e `deleted_at`. Uma saída podia usar um modelo salvo ou um nome digitado.

As actions em `saidas/actions.ts` já criavam vendas por INSERT, editavam quantidade/produto/preços por UPDATE e cancelavam por UPDATE de `deleted_at`. A interface já tinha formulário de edição e exclusão lógica. Não existia RPC de saída nem transação de estoque. O catálogo tinha criação, edição, desativação e soft delete. Havia helpers BRL e categorias que foram reutilizados.

Rotas preservadas: `/saidas`, `/saidas/nova`, `/saidas/[id]/editar`, `/saidas/modelos` e `/relatorios/reposicao`. O relatório antigo agrupa vendas por mês/categoria/modelo e permite copiar lista. O dashboard lê essas vendas. RLS usa membership através de `public.is_org_member(organization_id)`.

## Arquitetura implementada

Migration: **`supabase/migrations/0017_complete_inventory.sql`**, em transação `BEGIN/COMMIT`.

| Estrutura | Alteração |
| --- | --- |
| `product_model_templates.stock_quantity` | `integer NOT NULL DEFAULT 0`; negativos permitidos após movimentações |
| `product_model_templates.minimum_stock` | `integer NOT NULL DEFAULT 0`, não negativo |
| `product_model_templates.unit_cost` | `numeric(10,2) NULL`, entre 0 e 99999999,99 |
| `product_outflows.inventory_tracked` | `boolean NOT NULL DEFAULT false`; trigger marca novos INSERTs como true |
| `inventory_movements` | Nova tabela permanente de auditoria |

Cada movimentação guarda organização, produto, tipo, delta inteiro assinado, saldo anterior/posterior, custo de referência, motivo, observação, saída relacionada, usuário e nome disponível, data/hora. A constraint garante `quantity_before + quantity = quantity_after`. O custo de venda continua em `default_price`/`unit_price`; `unit_cost` é uma referência de custo separada.

Índices: organização/data/id, produto/data/id, saída vinculada (parcial), estoque inicial único por produto (parcial). Não foi adicionado índice isolado de tipo: a leitura principal é temporal ou por produto.

### Funções e atomicidade

RPC pública de escrita: `register_inventory_movement(p_organization_id uuid, p_model_id uuid, p_movement_type text, p_quantity integer, p_unit_cost numeric DEFAULT NULL, p_reason text DEFAULT NULL, p_notes text DEFAULT NULL) RETURNS integer`.

Tipos aceitos pela RPC: `opening_balance`, `entry`, `adjustment`. O retorno é o saldo final. Entradas/contagens/custos são validados no servidor e no PostgreSQL. A linha do produto é bloqueada com `SELECT ... FOR UPDATE` antes de calcular o delta. Custo informado atualiza a referência; custo em branco mantém o atual. Não há FIFO/LIFO nem média ponderada.

Funções privadas de escrita, sem EXECUTE para usuários: `apply_inventory_delta`, `initialize_product_inventory`, `prepare_inventory_outflow`, `sync_outflow_inventory`, `inventory_immutable`. A função de leitura `inventory_outflow_links_valid` é usada nas policies de saída; só confirma vínculos dentro de uma organização da qual o usuário participa. Ela é VOLATILE para enxergar modelos criados pelo trigger dentro da mesma instrução de venda.

As vendas usam os **INSERT/UPDATE existentes em `product_outflows`**, protegidos por triggers. Não foi criada uma segunda action de venda nem é necessário chamar uma RPC de saída separada. O AFTER trigger escreve auditoria e atualiza saldo dentro da transação da própria venda. Falhar qualquer parte reverte tudo, inclusive o cadastro automático de um modelo digitado. Esse desenho também cobre clientes antigos que ainda escrevam na tabela pela API autenticada.

Ao trocar o produto de uma venda, as linhas envolvidas são bloqueadas em ordem de ID antes de compensar o produto antigo e debitar o novo. Edições concorrentes da mesma venda são serializadas pelo lock do UPDATE dessa venda; movimentos do mesmo produto usam o lock do produto.

### Operações

- **Estoque inicial:** usuário informa a contagem final; grava `opening_balance`, sem compra fictícia. Pode ser definido uma vez por produto, mesmo que já existam vendas novas com saldo negativo. Exemplo: saldo −2, contagem 25, delta +27, final 25. Contagem zero é aceita. Produtos criados com estoque inicial positivo geram abertura na mesma transação do cadastro. Cadastro com zero não gera movimentação automática; o usuário pode marcar a abertura depois.
- **Entrada:** recebe quantidade inteira > 0, soma ao saldo bloqueado, registra `entry`. Custo é opcional. Exemplo: 20 + 10 = 30.
- **Saída:** recebe quantidade inteira > 0, calcula o total no banco, registra venda e `outflow` negativo. Exemplo: 30 − 4 = 26. Modelos digitados são automaticamente vinculados ao catálogo existente ou cadastrados na categoria correspondente. Isso substitui o antigo checkbox opcional de salvar modelo, pois toda nova saída deve ter um produto para movimentar.
- **Ajuste:** recebe contagem física final inteira >= 0 e motivo obrigatório. Calcula a diferença no banco e registra `adjustment`, inclusive se a contagem for zero ou a diferença for zero. Exemplo: 12 → 10, delta −2.
- **Edição de saída nova:** quantidade 2 → 3 gera ajuste −1; trocar o produto compensa o anterior e debita o novo. Alterar só observação, data ou preço não gera movimento. O total é recalculado no PostgreSQL.
- **Cancelamento:** continua sendo soft delete. Saída nova devolve o saldo com `adjustment` positivo e motivo `Cancelamento de saída`; o movimento original permanece. Repetir o cancelamento não devolve duas vezes. O banco também compensa restauração de `deleted_at` (não há nova tela para restaurar). Cancelamentos funcionam após arquivar produto/cliente relacionado. DELETE físico de saídas é bloqueado.
- **Saídas antigas:** mantêm `inventory_tracked=false`. Edição/cancelamento desses registros não toca o saldo nem inventa histórico de estoque. O formulário informa essa condição.

### Negativos, mínimo e valor

Saída sem saldo é permitida: 2 − 3 = −1. Há alerta no formulário, na lista de saídas e na visão geral do estoque, com badge **ESTOQUE NEGATIVO**. Não há bloqueio de operação. Uma futura opção **Bloquear saída sem estoque** poderá mudar essa regra.

Helper único de status:

| Regra | Status |
| --- | --- |
| quantidade < 0 | NEGATIVO |
| quantidade = 0 | ESGOTADO |
| quantidade positiva <= mínimo | BAIXO |
| quantidade > mínimo | OK |

O indicador “abaixo do mínimo” e a reposição usam estritamente `< mínimo`; um produto exatamente no mínimo exibe BAIXO, mas tem sugestão zero e não entra na lista de compra. Sugestão de compra: `minimum_stock - stock_quantity`. Negativos entram pelo déficit completo. Produtos inativos permanecem visíveis para conferência/valoração, mas não geram sugestão de reposição.

Valor estimado = soma de `max(stock_quantity, 0) × unit_cost`, apenas com custo informado. Custo nulo não é erro. O total de unidades é a soma dos saldos, incluindo negativos; as divergências possuem indicador próprio.

### Interface e navegação

O menu principal agora concentra **Estoque**; os links antigos continuam funcionando e destacam esse mesmo item. A navegação interna oferece visão geral, movimentações, saídas, reposição e catálogo. O proxy inclui `/estoque` nas áreas protegidas.

- `/estoque`: cinco indicadores, busca, categoria/status e cards com saldo, mínimo, custo, preço, status e ações. Cards se adaptam ao celular e evitam tabela larga em 375px.
- `/estoque/[id]`: entrada, ajuste e abertura; consulta abertura existente para orientar usar ajuste.
- `/estoque/movimentacoes`: histórico por produto, 50 registros por página, saldo anterior/posterior, autor, motivo/observação, vínculo com a saída. Sem edição/exclusão de movimentos.
- `/estoque/reposicao`: déficit atual agrupado pelas categorias reais do catálogo, com **Copiar lista** e entrada de reposição.
- `/relatorios/reposicao`: relatório mensal anterior preservado, apresentado como histórico de saídas, com filtros, preços e copiar lista.
- `/saidas/modelos`: seção Estoque no cadastro/edição. Cadastro oferece saldo inicial opcional; edição permite mínimo e custo, mas não edita saldo.

Novos componentes usam tokens semânticos existentes de light/dark para superfície, texto, borda, inputs, sucesso, aviso e erro. O catálogo atual não possui marca estruturada; não foram inventadas marcas nem novas categorias.

### RLS, permissões e auditoria

`inventory_movements` tem RLS e somente SELECT para `authenticated` com membership na organização. INSERT/UPDATE/DELETE diretos não são concedidos. Triggers também rejeitam alteração/exclusão do histórico, inclusive por operações administrativas acidentais.

RPCs usam `SECURITY DEFINER`, `search_path` fixo, verificam `auth.uid()` e membership explicitamente e validam o produto na mesma organização. EXECUTE é revogado de PUBLIC/anônimo; o helper que aplica deltas só pode ser chamado internamente. O nome do responsável é um snapshot do perfil disponível no momento da operação, sem abrir o acesso geral a perfis de outros usuários.

O grant geral de UPDATE dos modelos foi substituído por grants de colunas de metadados. Usuários não podem alterar `stock_quantity` ou mover o modelo para outra organização pela API. Nas saídas, UPDATE só permite os campos de edição existentes; organização e marco `inventory_tracked` são protegidos. As policies de INSERT/UPDATE mantêm membership e validam os vínculos via helper. O trigger rejeita novos vínculos arquivados, mas aceita manter vínculos antigos para compensações.

## Aplicação do SQL e implantação

1. Aplicar as migrations anteriores até `0016` conforme o histórico real do ambiente.
2. No ambiente de homologação, executar **todo o arquivo `supabase/migrations/0017_complete_inventory.sql`** no SQL Editor do Supabase, uma vez. Não copiar trechos isolados. Não é necessário seed ou backfill de vendas antigas.
3. Publicar esta versão do código depois da migration. Uma janela curta de manutenção evita que clientes com código antigo encontrem a mudança de comportamento durante a implantação.
4. Conferir produtos existentes, categorias, preços e saídas antigas. Todos os produtos existentes começam com saldo zero, mínimo zero e custo nulo.
5. Definir o estoque inicial por contagem física de cada produto e preencher mínimo/custo conforme a loja.

**A migration `0017_complete_inventory.sql` foi aplicada no Supabase pelo usuário e confirmada na homologação.** Não reaplicar nem alterar essa migration após iniciar movimentações. Uma reversão de código deve preservar banco e histórico; remover triggers/colunas depois do uso exigiria conciliação de estoque.

## Testes automatizados

Dependência de desenvolvimento reproduzível: `@electric-sql/pglite@0.3.14`. Testes SQL usam PostgreSQL descartável em diretório temporário, nunca `.env` ou banco real. Esse executor usa uma conexão; não equivale a um teste de contenção entre conexões independentes.

```sh
pnpm test:inventory
pnpm test:sql:inventory
pnpm --filter web exec node --test --test-concurrency=1 tests/*.test.cjs
node --test --test-concurrency=1 supabase/tests/*.test.cjs
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

A suíte específica cobre abertura 0→20, entrada 20+10=30, saída 30−4=26, saldo 2−3=−1, ajuste 12→10, contagem zero, autoria/custo, cancelamento repetido, restauração, edição/troca de produto, histórico antigo, modelos digitados, rollback após falha de auditoria, tentativa de escrita direta no saldo/histórico, validação de dados, chamadas concorrentes enfileiradas, organização diferente, usuário sem membership e anônimo. A suíte web cobre status, valoração, reposição, schema, RPC da action, formulário de metadados e apresentação responsiva. A suíte de navegação foi atualizada para o agrupamento em Estoque.

Resultados da validação inicial em 19/11/2026: **99 testes web passaram**, incluindo **9 testes específicos de estoque** e as regressões de produtos/saídas, clientes, manutenção, dashboard, organização, autenticação, navegação e tema. Lint, typecheck e build de produção passaram; o build incluiu as quatro novas rotas de estoque. `git diff --check` passou; arquivos novos também foram verificados quanto a espaços no fim das linhas.

Resultados SQL da validação inicial em 19/11/2026: **59 testes passaram**, incluindo a suíte de estoque com **10 testes** (grupo e seus cenários), rollback de entrada/ajuste/cancelamento, RLS e regressões SQL existentes. Nenhum teste foi ignorado nessas execuções. O checklist abaixo preserva os cenários de referência, incluindo verificações adicionais de dispositivo e contenção entre conexões independentes.

No ambiente local, os comandos pnpm foram executados com `--config.verify-deps-before-run=false` para evitar uma reinstalação automática sem TTY detectada pelo pnpm após a inclusão da dependência de testes. Essa opção apenas desliga essa verificação prévia do gerenciador; ESLint, TypeScript, Next build e o runner de testes executaram normalmente. As dependências foram instaladas e o lockfile atualizado. A tentativa inicial com PGlite 0.5.17 encontrou falta de memória; foi substituída por 0.3.14, que executou os testes SQL. Os testes identificaram e permitiram corrigir o snapshot de RLS dos modelos digitados; a expectativa antiga de navegação foi atualizada para o novo agrupamento. Logs de falha simulada nos testes de regressão são esperados e não são erros do runner.

## Homologação manual e checklist de referência

Em 23/11/2026, o usuário confirmou a homologação manual com sucesso: abertura de `/estoque` e `/estoque/[id]`, estoque inicial, entrada, ajuste, saída, atualização do saldo e histórico de movimentações. Também confirmou a aplicação da migration `0017_complete_inventory.sql`, a tabela `inventory_movements` e os campos `stock_quantity`, `minimum_stock` e `unit_cost` disponíveis no Supabase. A revisão final, o commit e o push foram explicitamente autorizados. As caixas abaixo são cenários de referência; não representam bloqueio da homologação concluída nem confirmação individual de verificações adicionais não relatadas pelo usuário.

Revisão final em 23/11/2026: `test:inventory` passou com 15 testes e `test:sql:inventory` com 12 testes (grupo e cenários). A regressão completa passou com 105 testes web e 61 testes SQL, sem falhas ou testes ignorados. Lint, typecheck, build de produção com Turbopack e `git diff --check` passaram. No PowerShell, os comandos foram executados por `pnpm.cmd` porque a política local bloqueia o atalho `pnpm.ps1`; nenhuma política do sistema foi alterada. O build normalizou automaticamente `next-env.d.ts`, sem diferença final para incluir no commit. A migration aplicada foi preservada sem alterações nesta revisão.

- [ ] Aplicar a migration inteira em homologação e abrir todas as rotas antigas/nova área.
- [ ] Confirmar modelos, categorias, preços e vendas antigas preservados, sem débitos retroativos.
- [ ] Definir estoque inicial 20; conferir movimento 0→20. Tentar nova abertura e confirmar orientação para ajuste.
- [ ] Registrar entrada 10 com custo R$ 3,50; conferir saldo 30 e preço de venda preservado.
- [ ] Registrar saída 4 pelo formulário antigo e pelo atalho Estoque; conferir saldo 26 e vínculo no histórico.
- [ ] Com saldo 2, vender 3; conferir −1 e alertas no formulário, saídas e estoque.
- [ ] Ajustar 12→10 com motivo; conferir delta −2, autor e observação. Ajustar para zero.
- [ ] Cadastrar produto com inicial/mínimo/custo; verificar abertura automática. Editar custo/mínimo sem alterar saldo.
- [ ] Testar custo em branco, zero, inválido/negativo; quantidades vazias/fracionárias e entrada zero.
- [ ] Editar venda nova de 2 para 3, trocar produto e cancelar; conferir deltas e retorno completo. Repetir cancelamento sem devolver em dobro.
- [ ] Cancelar uma venda nova após arquivar produto e cliente; confirmar compensação. Editar/cancelar uma venda antiga sem mudar estoque.
- [ ] Digitar um modelo não cadastrado na venda; confirmar produto único, saída e movimento. Repetir o mesmo nome com espaços/caixa diferentes.
- [ ] Conferir BAIXO no limite do mínimo, ESGOTADO no zero, NEGATIVO abaixo de zero e valor estimado sem somar negativos como ativo.
- [ ] Conferir reposição por déficit, categorias e Copiar lista, incluindo fallback manual do clipboard. Comparar com histórico mensal de saídas.
- [ ] Conferir histórico por produto e paginação com mais de 50 movimentos, incluindo vendas canceladas.
- [ ] Usar duas sessões/conexões independentes para vender simultaneamente o mesmo produto: saldo deve refletir ambas. Repetir trocas de produtos e entradas concorrentes.
- [ ] Com usuários de duas organizações, tentar ler/movimentar IDs da outra via API autenticada; confirmar isolamento. Sem login, confirmar bloqueio de páginas/RPC/histórico.
- [ ] Conferir desktop e celular de 375px, light/dark, teclado, foco e mensagens de validação.
- [ ] Conferir clientes, manutenção rápida/completa, dashboard, relatórios e configuração da organização.

## Limites e decisões

Não há fornecedores/pedidos de compra, notas, lotes, validade, depósitos, transferências, devoluções dedicadas, financeiro automático ou WhatsApp de reposição. Compensações usam `adjustment`; os quatro tipos atuais podem ser ampliados por uma migration futura. Não há reconstrução retroativa nem garantia de execução única para entrada/venda reenviada após perda de resposta de rede: conferir o histórico antes de repetir uma operação de resultado incerto. O formulário desabilita envio enquanto há operação pendente.

Homologação funcional concluída pelo usuário. Contenção entre conexões independentes e verificações adicionais do checklist não foram confirmadas individualmente no relato de homologação.

## Arquivos entregues

Novos arquivos:

```text
supabase/migrations/0017_complete_inventory.sql
supabase/tests/inventory.test.cjs
supabase/diagnostics/0017_inventory_check.sql
apps/web/src/lib/products/inventory.ts
apps/web/src/lib/products/inventory-errors.ts
apps/web/src/lib/validations/inventory.schema.ts
apps/web/src/app/(dashboard)/estoque/actions.ts
apps/web/src/app/(dashboard)/estoque/page.tsx
apps/web/src/app/(dashboard)/estoque/[id]/page.tsx
apps/web/src/app/(dashboard)/estoque/movimentacoes/page.tsx
apps/web/src/app/(dashboard)/estoque/reposicao/page.tsx
apps/web/src/app/(dashboard)/estoque/inventory-navigation.tsx
apps/web/src/app/(dashboard)/estoque/inventory-overview.tsx
apps/web/src/app/(dashboard)/estoque/inventory-movement-form.tsx
apps/web/src/app/(dashboard)/estoque/stock-status-badge.tsx
apps/web/tests/inventory.test.cjs
docs/planejamento/estoque-completo.md
```

Arquivos existentes alterados:

```text
README.md
package.json
pnpm-lock.yaml
apps/web/package.json
apps/web/src/proxy.ts
apps/web/src/components/dashboard-navigation.tsx
apps/web/src/lib/validations/product.schema.ts
apps/web/src/app/(dashboard)/saidas/actions.ts
apps/web/src/app/(dashboard)/saidas/page.tsx
apps/web/src/app/(dashboard)/saidas/nova/page.tsx
apps/web/src/app/(dashboard)/saidas/modelos/page.tsx
apps/web/src/app/(dashboard)/saidas/product-model-template-manager.tsx
apps/web/src/app/(dashboard)/saidas/product-outflow-form.tsx
apps/web/src/app/(dashboard)/relatorios/reposicao/page.tsx
apps/web/tests/presentation.test.cjs
apps/web/tests/fase-14a2.test.cjs
```

A entrega inclui os arquivos novos/modificados listados acima. Migrations anteriores e credenciais não foram alteradas; a aplicação da migration nova e a homologação no banco real foram realizadas pelo usuário.
