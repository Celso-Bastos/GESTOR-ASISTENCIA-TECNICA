# Atualização 3.1 — Reposição por categoria e múltiplos fornecedores

## Decisão sobre a 0019

A antiga `0019_organization_replenishment_whatsapp.sql` não foi aplicada no Supabase remoto nem commitada, conforme informação do responsável. Por isso foi substituída por **`0019_inventory_suppliers.sql`**. Não há 0020 nem coluna `organizations.replenishment_whatsapp_phone` nesta entrega. O formulário/consulta/action globais foram removidos; Configurações voltou ao comportamento anterior. Migrations 0001–0018 permanecem intactas.

Aplicar manualmente somente a nova 0019 após 0018, no ambiente correto. Não executar a antiga 0019 nem reaplicar migrations anteriores. Nenhum SQL remoto foi executado nesta implementação. Se outro ambiente já tiver aplicado a versão antiga, esta entrega não é um upgrade automático dele: será necessário auditar seu estado e preparar uma migration posterior específica. Bancos descartáveis usados nos testes não exigem conversão.

## Modelo e banco

Organização → vários fornecedores; produto ↔ fornecedores em relação muitos-para-muitos.

| Tabela | Colunas |
| --- | --- |
| `inventory_suppliers` | `id`, `organization_id`, `name`, `whatsapp_phone`, `notes`, `is_active`, `created_by`, `created_at`, `updated_at` |
| `inventory_product_suppliers` | `id`, `organization_id`, `product_model_id`, `supplier_id`, `is_preferred`, `supplier_unit_cost`, `created_at`, `updated_at` |

Nome obrigatório (1–120 caracteres), WhatsApp brasileiro opcional, observações opcionais até 2000 caracteres, ativo por padrão. Telefones são normalizados usando `normalizePhoneBR`/`normalizePhoneForWhatsApp`, persistidos como 55 + DDD + número, apenas dígitos, e validados no servidor e por CHECK SQL. Vazio vira NULL. Formato válido não garante que exista uma conta WhatsApp.

`supplier_unit_cost` é nullable com CHECK de 0 a 99999999,99, reservado à evolução futura. Não tem interface de preço/comparação nesta versão. Não é preenchido a partir de `default_price` nem usado em total financeiro.

Chaves e índices:

- UNIQUE `(organization_id, id)` nos produtos e fornecedores para permitir FKs compostas na relação.
- FKs `(organization_id, product_model_id)` e `(organization_id, supplier_id)` impedem relacionar organizações diferentes até em acesso privilegiado.
- UNIQUE `(organization_id, product_model_id, supplier_id)` impede vínculo duplicado.
- Índice único parcial `(organization_id, product_model_id) WHERE is_preferred` permite zero ou um preferencial.
- Índice `(organization_id, is_active, name, id)` em fornecedores e `(organization_id, supplier_id, product_model_id)` nos vínculos; o UNIQUE também atende consultas por organização/produto.
- Triggers existentes de `set_updated_at` atualizam timestamps.

Não existe DELETE de fornecedor na API: desativar/reativar preserva o cadastro e os vínculos. Não se adicionou um segundo mecanismo de exclusão por `deleted_at`; a única ação de retirada é `is_active=false`. Remover um vínculo é permitido e não apaga o fornecedor. Os vínculos atuais não constituem um histórico de pedidos/compras.

## Permissões e isolamento

RLS habilitada nas duas tabelas: membros leem somente sua organização; owner/admin cadastram/editam fornecedores e alteram vínculos. Employee visualiza listas, copia e abre WhatsApp. Sem novos papéis.

`can_manage_inventory_suppliers` consulta o membership real, com SECURITY DEFINER e search_path fixo. Policies/grants restringem colunas editáveis, impedindo trocar IDs/organização/autoria por DML. Fornecedor não recebe grant DELETE. Links permitem DELETE autorizado. Novos vínculos exigem fornecedor ativo e produto não arquivado.

Server actions derivam organização/papel da sessão, ignoram IDs de organização/papéis enviados pelo navegador, validam IDs/dados e usam **cliente autenticado com RLS**, sem cliente administrativo. Leituras têm filtro explícito por organização além da RLS. Usuários autenticados sem membership e anônimos não acessam cadastros ou RPC.

`set_inventory_product_supplier` executa `add`, `remove`, `prefer` ou `unprefer` de forma transacional. Verifica owner/admin e a organização dos dois registros, bloqueia o produto e o fornecedor enquanto altera o vínculo. Trocar preferencial desmarca o anterior e marca o novo dentro da mesma transação; o índice parcial também protege DML direto. Repetir `add` não duplica vínculo nem apaga uma preferência já escolhida. `unprefer` é explícito e não cria um vínculo ausente. Falha mantém o estado anterior.

## Como configurar

1. Aplicar a nova 0019 manualmente.
2. Abrir **Estoque → Fornecedores** (`/estoque/fornecedores`). Owner/admin usam **Novo fornecedor**, informam nome/WhatsApp/observações e salvam. Cadastro permite editar, desativar e reativar; todos podem **Ver produtos**.
3. Em **Produtos cadastrados** (`/saidas/modelos`), abrir **Fornecedores deste produto**. A rota `/saidas/modelos/[id]/fornecedores` permite adicionar fornecedores ativos, remover vínculo, definir/trocar/remover preferência. Não é obrigatório ter fornecedor nem preferencial.
4. Abrir **Reposição**, escolher uma visão, combinar categoria/fornecedor e buscar por modelo/nome do fornecedor. A lista contém apenas necessidades atuais.
5. Na lista de um fornecedor específico, conferir alternativas/preferencial, copiar ou abrir WhatsApp. O funcionário escolhe onde comprar e confirma o envio dentro do WhatsApp.

Fornecedores têm lista com nome, telefone, quantidade total de vínculos e ativo/inativo. A contagem de vínculos pode incluir produtos arquivados; **Ver produtos** exibe os produtos do catálogo atual, inclusive inativos, com a situação do cadastro. O vínculo de produto arquivado permanece no banco. Uma empresa pode ter fornecedores de mesmo nome; não se impôs unicidade de nome.

## Reposição e filtros

`getStockRestock` continua inalterado e é a fonte do déficit: produto ativo com `stock_quantity < minimum_stock`; sugerido = mínimo − saldo atual. Igual/acima do mínimo e inativos ficam fora. Preserva a regra consolidada de corrigir saldo negativo com mínimo zero. Exemplo: atual -2 / mínimo 5 → repor 7.

`getSupplierRestock` adiciona os fornecedores ativos a cada linha calculada e aplica filtros, sem dividir quantidades nem criar movimentos.

- **Todos**: cada produto aparece uma vez, independentemente do número de vínculos. Mostra preferencial, alternativas e quantidades internas.
- **Categorias**: categorias/labels de `productCategories`/`productCategoryLabels`; cards com subtotais e lista da categoria selecionada.
- **Fornecedores**: cards com modelos/unidades por fornecedor ativo; abrir um card restringe a lista ao fornecedor. Os totais dos cards podem se sobrepor e não devem ser somados para comprar tudo duas vezes.
- **Sem fornecedor**: produtos sem fornecedor ativo, incluindo os ligados apenas a inativos. Oferece configurar fornecedor.
- Categoria + fornecedor são combináveis; busca por modelo ou fornecedor usa normalização de acentos na reposição. Busca do cadastro de fornecedores procura nome sem diferenciar maiúsculas/minúsculas.
- Indicadores refletem o recorte atual: modelos, unidades sugeridas, categorias afetadas e sem fornecedor ativo. Na visão geral, contam produtos uma vez.

Um produto associado a A e B pode aparecer nas duas listas específicas com a mesma necessidade integral; a interface avisa da sobreposição e mostra **Também disponível em**. Preferencial é apenas informação para decisão humana. Fornecedor inativo não aparece nos filtros de compra/WhatsApp; pode continuar marcado historicamente como preferencial, mas não é apresentado como preferência disponível para comprar até ser reativado.

## Mensagem, WhatsApp e cópia

Há um único gerador: `formatStockRestockList`, reaproveitado como `formatSupplierRestockList`. Recebe somente as linhas do filtro atual, reaplica a regra central de reposição e usa categorias reais. Mensagem curta externa:

```text
Olá! Segue a lista de reposição:

Case
• A05 — repor 7

Película
• A16 — repor 2

Total de modelos: 2
Total de unidades: 9
```

Saldo/mínimo continuam visíveis internamente e não entram na mensagem externa. Copiar lista funciona em Todos, categoria, fornecedor e Sem fornecedor, sempre respeitando os filtros. No sumário de fornecedores, a cópia representa o conjunto filtrado sem duplicar produtos.

**Enviar pelo WhatsApp existe apenas em um fornecedor ativo específico** (`?fornecedor=UUID`), usando seu telefone e só os produtos vinculados a ele no recorte atual. Todos/categoria/sem fornecedor não têm envio para um destinatário arbitrário. UUID estrangeiro, inexistente ou fornecedor inativo gera aviso e nunca retorna lista geral como fallback.

Usa `buildWhatsAppUrl` existente (`wa.me`, `encodeURIComponent`, nova aba com noopener/noreferrer). Desktop pode usar Web/app; no celular depende do app/navegador/SO. O funcionário revisa e confirma Enviar, sem Meta API/automação.

- Sem telefone: “WhatsApp não configurado para este fornecedor.”, ação Editar fornecedor e cópia preservada. Só owner/admin pode editar.
- Lista vazia: mensagem de vazio e ações desabilitadas; nunca abre WhatsApp vazio.
- URL codificado acima de 8000 caracteres: limite conservador da aplicação; bloqueia abertura, informa, mantém texto integral e oferece Web Share de texto quando suportado. Não é um limite universal garantido do WhatsApp. No compartilhamento nativo, o usuário escolhe o destinatário.
- Clipboard indisponível: seleção manual preservada. Cancelar Web Share não é erro; falha orienta usar cópia.
- Não trunca nomes/itens nem divide envios automaticamente.

Nenhum envio/cópia cria pedido ou movimentação. A lista é um retrato do carregamento: atualizar a página após novas movimentações e antes de decidir a compra. `/relatorios/reposicao` continua sendo histórico mensal de saídas, separado desta necessidade por mínimo.

## Performance e interface

Sem novas dependências. Páginas de listagem/filtros são Server Components; formulários, Clipboard e Web Share são componentes client pequenos. Os vínculos completos não são serializados para o client da reposição: apenas texto/link/flags. A configuração de um produto recebe somente suas relações e opções de fornecedores ativos necessárias ao seletor.

Consultas de fornecedores/vínculos são paginadas em lotes de 500, ordenadas por ID, sem N+1. Reposição restringe relações aos produtos atuais para repor em grupos de até 200 IDs. Qualquer falha numa página descarta os dados parciais e bloqueia geração/envio da lista incompleta. Não há cache entre organizações. O cadastro consulta vínculos em lote para contadores.

Design System e componentes existentes, botões em largura disponível no mobile, nomes longos quebram e temas claro/escuro. Nenhuma mudança no script/configuração `pnpm --filter web dev:low-memory`.

## Testes automatizados e checklist manual

Comandos: `pnpm test:inventory-suppliers` (alias `test:replenishment-whatsapp`), `pnpm test:sql:replenishment-whatsapp`, suites web/SQL completas, lint, typecheck e build. SQL roda em PGlite descartável, nunca remoto. Cobertura inclui N:N nas duas direções, preferencial opcional/único/troca/reenvio, duplicidade, inativos, sem fornecedor, Todos sem duplicação, categorias/combinação/busca, mensagem/totais/Unicode, telefone, URL/tamanho, cópia, roles/RLS, FKs cross-tenant e preservação do estoque.

Homologar depois de aplicar SQL:

1. Como owner/admin, criar A e B; nome obrigatório, telefone com máscara e vazio, edição, desativação e reativação.
2. Vincular o mesmo produto a A/B e vários produtos/categorias a A. Conferir contadores, produto inativo/arquivado e lista Ver produtos.
3. Definir A como preferencial, trocar para B, remover preferência; vários fornecedores sem preferencial continuam válidos. Repetir adição não apaga preferência. Remover vínculo preserva fornecedor.
4. Comparar Todos/categoria/fornecedor/categoria+fornecedor, busca e subtotais; mesmo produto aparece uma vez em Todos e nas duas listas específicas com quantidade integral.
5. Desativar o único fornecedor ativo de um produto: ele aparece em Sem fornecedor, com ação de configuração; vínculo permanece.
6. Conferir -2/5 → 7, mínimo zero, estoque igual/acima, inativo, lista vazia e sem resultado.
7. Abrir WhatsApp real de A com somente itens de A; testar fornecedor sem telefone. Conferir encoding, mensagem curta, escolha humana e ausência de movimentos gerados.
8. Conferir Copiar em todos os recortes, Clipboard indisponível, lista longa, Web Share suportado/indisponível/cancelado/erro no aparelho real.
9. Employee pode visualizar/copiar/abrir WhatsApp, mas não cadastrar/editar/vincular nem por action/RPC. Organização B não lê/edita/vincula produtos/fornecedores de A.
10. Em aparelhos físicos e desktop, conferir 375/390/430 px, claro/escuro, teclado/foco, filtros/badges e estados vazios. Conferir também estoque inicial, entrada, ajuste, saída, cancelamento, histórico, catálogo, clientes, manutenção, garantia, termo e dashboard.

Não implementados: pedidos de compra, recebimento por fornecedor, financeiro, pagamentos, nota fiscal, API de fornecedor, comparação/escolha/divisão automática, Meta Cloud API ou envio automático.

## Resultados desta implementação — 24/11/2026

- Suíte web completa: 149/149 passaram. Após refinamento final da RPC para preservar preferência ao repetir `add`, a suíte específica foi repetida: 19/19 passaram.
- Suíte SQL completa final: 80/80 passaram, incluindo 11 testes/cenários da nova 0019 e a regressão existente de estoque, manutenção, RLS e garantia.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `git diff --check`: aprovados. TypeScript também concluído no build, que incluiu as três novas rotas e a reposição.
- 78 combinações de 13 telas/estados × 375/390/430 px × claro/escuro verificadas em navegador com componentes reais e CSS Tailwind do projeto, dados fictícios e sem backend. Sem overflow. Desktop a 1280 px também conferido, com WhatsApp/Copiar lado a lado. Isso verifica layout/SSR, não envio real ou persistência remota.
- Limitação física observada: tentativas de SQL durante pressão de memória falharam com `Fatal process out of memory: Zone`; uma tentativa concorrente de typecheck encerrou com código nativo 3221226505. O Windows reportava cerca de 0,8 GB de memória virtual livre e um servidor dev com cerca de 2,1 GB de memória privada. O servidor local foi interrompido temporariamente, e as execuções finais isoladas de typecheck, SQL e build passaram. Depois ele foi reiniciado na porta 3000 pelo mesmo script `dev-low-memory.mjs`, sem mudança no script/configuração do projeto.
- Low-memory retomado com Webpack/limite de heap 1536 MiB, pronto em localhost:3000. HTTP local verifica login e proteção das rotas sem sessão. Não houve homologação autenticada completa nesse modo; a migration remota ainda depende de aplicação manual.
- Sem SQL remoto, envio real, commit ou push. Cadastro/persistência de fornecedores e vínculos foi validado por actions simuladas e PostgreSQL descartável. Homologação remota, compositor real do WhatsApp, envio e Web Share no aparelho ficam para o responsável.
