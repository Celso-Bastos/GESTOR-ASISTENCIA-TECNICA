# Manutenção rápida: endereço e previsão ao lado do estimado

## Auditoria e escopo

O fluxo rápido existente identifica/reutiliza cliente pelo telefone ao salvar. Não tinha seletor de cliente nem endereço; a action envia um JSON à RPC `create_maintenance_intake`, responsável por criar/reutilizar/reativar o cliente e criar aparelho, OS e evento atomicamente. A última migration era `0015`.

Esta atualização mantém essa arquitetura, assinatura pública da RPC, numeração e UUID de tentativa. Não acrescenta endereço à OS, aniversário ao formulário ou cidade individual ao cliente. A manutenção normal e as regras de preço/entrega permanecem como estavam.

## Formulário e comportamento

- Em `/manutencoes/rapida`, endereço opcional fica na seção Cliente, abaixo de nome/telefone. É uma textarea curta com os tokens existentes, autocomplete de endereço e limite de 300 caracteres.
- Ao sair de um telefone válido, uma server action consulta somente `id` e `address` da organização da sessão. A busca é exata pelo telefone normalizado: cliente ativo primeiro; depois o arquivado mais recente, com desempate pelo ID, como na RPC.
- O endereço encontrado é preenchido e pode ser editado. A consulta é auxiliar: falha, ausência de resultado ou salvamento antes da resposta não bloqueiam a abertura da OS.
- Texto digitado durante a consulta não é substituído. Respostas de um telefone anterior são descartadas. Alterar o telefone depois de consultar limpa a associação/endereço do telefone anterior.
- Prefill sem edição não é reenviado como atualização do cadastro; uma alteração concorrente do endereço não é sobrescrita por uma cópia antiga exibida na tela.
- Campo vazio, omitido ou apagado pelo teclado preserva o endereço já cadastrado. Isso evita apagar dados por falha/ausência de carregamento.
- Para apagar o cadastro, o usuário precisa clicar **Remover endereço cadastrado**, disponível após encontrar o cliente. O botão pode desfazer essa escolha antes de salvar. A interface informa que a remoção ocorrerá ao salvar a manutenção.
- Cliente novo ou placeholder continua permitido sem nome, telefone ou endereço. Se houver endereço informado, ele é salvo no novo cliente.
- Cliente ativo reutilizado recebe o endereço editado, sem trocar seu nome e demais dados. Arquivado é reativado com o mesmo ID, aniversário, notas e histórico preservados; endereço muda somente quando solicitado.
- Previsão de entrega e valor estimado agora são irmãos em `grid gap-4 sm:grid-cols-2`: uma coluna abaixo de 640 px e duas colunas a partir de 640 px. Ordem: previsão, estimado. Observação rápida permanece abaixo do grupo.

## Validação e persistência

`customerAddressSchema` foi extraído da definição já existente em `customer.schema.ts` e é reutilizado pela rápida: string opcional/null, trim, máximo 300, vazio para null. Nome/telefone/modelo, moeda, previsão e garantia conservam suas validações existentes.

A action valida todos os valores no servidor e continua usando uma única chamada de escrita à RPC. A consulta de prefill é somente leitura e não participa da transação de gravação.

Contrato adicional dentro de `p_input`, somente quando há alteração explícita:

| Campo | Uso |
| --- | --- |
| `customer_address` | Texto validado ou null para remoção explícita |
| `customer_address_action` | `set` ou `clear`; modo `preserve` do formulário omite os campos de atualização na RPC |
| `customer_address_customer_id` | ID observado na consulta, quando disponível; obrigatório para remoção |

Se um cliente foi confirmado e o telefone passar a resolver outro ID, a RPC rejeita com `40001` e desfaz toda a tentativa. O ID enviado não autoriza acesso: organização vem da sessão e o SQL também exige organização/cliente correto sob RLS.

Chamadas antigas sem as novas chaves continuam funcionando. Na RPC, null/vazio sem remoção confirmada preservam o cadastro. O fluxo normal (`p_quick=false`) não atualiza endereço por esse mecanismo.

## Migration e aplicação no ambiente

Nova migration: **`supabase/migrations/0016_quick_maintenance_customer_address.sql`**.

Ela substitui o corpo da função existente mantendo:

- `create_maintenance_intake(uuid, uuid, uuid, text, text, jsonb, boolean)` e o mesmo retorno;
- `security invoker`, `search_path`, grants e RLS;
- busca de ativo/arquivado, retry de unicidade, histórico e ID do cliente;
- advisory lock, UUID idempotente, criação do aparelho/OS/evento e rollback.

A gravação em `customers.address` ocorre dentro da função, antes da criação da OS, na mesma transação. Falha posterior também desfaz a alteração de endereço e eventual reativação/criação do cliente. Não há coluna ou tabela nova.

**Antes de homologar ou publicar o código**, aplicar o arquivo completo `0016` no mesmo projeto Supabase utilizado pela aplicação, depois das migrations anteriores, especialmente `0014` que criou `customers.address`. A migration verifica essa dependência, é reaplicável e já inclui recarga do schema do PostgREST. Não reaplicar migrations antigas por substituição de seus arquivos. O deploy de código sozinho não instala a nova função; a versão antiga pode ignorar as novas chaves de endereço.

Nenhuma migration foi aplicada remotamente por esta execução. `.env.local`, migrations anteriores, Maps, cidade de serviço e dependências não foram alterados. Não foi feito commit ou push.

## Testes e limites

Os testes de aplicação cobrem schema compartilhado, trim/limite/null, payload validado, preservação, remoção confirmada, organização da sessão, consulta limitada por telefone e prioridade, sessão ausente, falha de consulta, respostas atrasadas, edição durante carregamento e estrutura do grid.

Os testes PostgreSQL/PGlite aplicam a nova função e exercitam também os cenários anteriores de intake. Cobrem cliente novo/placeholder, ativo, arquivado, endereço omitido/vazio, edição, remoção, ID divergente, outra organização, entrada inválida, idempotência, ausência da dependência 0014, reaplicação/grants, e rollback de endereço/criação/reativação por falha posterior. Usam banco descartável local; não acessam o Supabase remoto. Não simulam concorrência entre sessões reais, mas verificam rejeição de ID divergente e comportamento idempotente.

| Verificação | Resultado |
| --- | --- |
| `node --test --test-concurrency=1 tests/*.test.cjs` em `apps/web` | 82 testes aprovados, nenhum ignorado; inclui 9 testes novos de endereço/layout |
| `pnpm test:sql:maintenance` com PGlite local | 34 testes aprovados; inclui nova função e regressões de intake normal/rápida, reativação e RLS |
| `pnpm lint` | Aprovado |
| `pnpm typecheck` | Aprovado |
| `pnpm build` | Aprovado com Turbopack; compilação, TypeScript e geração das páginas concluídos, exit code 0 |
| `git diff --check` | Aprovado |
| Integridade | 19 arquivos protegidos mantidos, incluindo todas as migrations anteriores, `.env.local`, lockfile, formulário normal e helper de preço final |
| Edição/entrega/garantia | Implementações das actions a partir de `updateMaintenanceOrderAction` idênticas ao commit anterior; regressões automatizadas aprovadas |

As verificações usam limites de memória somente nos processos (`NODE_OPTIONS`), sem editar ambiente ou scripts do projeto. Os logs de falhas simuladas nos testes são esperados; não são falhas reais de conexão.

O tema usa os tokens já existentes no formulário. Nenhuma paleta foi acrescentada. Os testes de markup comprovam agrupamento/ordem e atributos; não equivalem a screenshots ou testes de interação em navegador real.

A tentativa de acessar o navegador retornou `The browser access host is unavailable`; a descoberta de aplicativos nativos também expirou (`computer-use request timed out: list_apps`). Portanto, **a conferência visual em desktop e 320/375/390/430 px, claro e escuro, permanece pendente**. Nenhum resultado visual foi presumido. Os únicos bloqueios para homologação integrada são disponibilizar a nova função no ambiente correto e executar a conferência manual; não foi identificado bloqueador nos testes de código/SQL.

## Checklist de homologação manual

- [ ] Aplicar `0016` no ambiente de homologação após as anteriores; conferir que é o mesmo Supabase da aplicação.
- [ ] Criar rápida só com modelo/defeito, sem endereço, nome ou telefone.
- [ ] Criar cliente novo com endereço; abrir detalhe do cliente e conferir trim/persistência.
- [ ] Informar telefone de cliente ativo com/sem endereço: conferir prefill e edição.
- [ ] Deixar o endereço carregado sem edição e salvar: preservar cadastro; vazio também deve preservar.
- [ ] Remover explicitamente o endereço, desfazer e depois confirmar remoção em nova tentativa.
- [ ] Usar telefone de arquivado: mesmo cliente e histórico/aniversário preservados.
- [ ] Digitar no endereço enquanto a consulta carrega e trocar telefone: não aproveitar resposta antiga.
- [ ] Endereço com mais de 300 caracteres via envio adulterado: erro amigável e sem OS parcial.
- [ ] Estimado zero/manual, previsão, rápida sem cliente, normal, garantia, status e entrega automática continuam corretos.
- [ ] 320/375/390/430 px: previsão acima do estimado, endereço e controles sem overflow.
- [ ] Tablet/desktop a partir de 640 px: previsão à esquerda e estimado à direita, alinhados.
- [ ] Conferir claro/escuro, foco, teclado, loading e avisos da consulta/remoção.

## Arquivos da atualização

- `apps/web/src/app/(dashboard)/manutencoes/rapida/quick-maintenance-form.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/actions.ts`
- `apps/web/src/lib/validations/customer.schema.ts`
- `apps/web/src/lib/validations/maintenance.schema.ts`
- `apps/web/tests/quick-maintenance-address.test.cjs`
- `supabase/migrations/0016_quick_maintenance_customer_address.sql`
- `supabase/tests/maintenance-intake.test.cjs`
- `docs/planejamento/manutencao-rapida-endereco.md`
- `docs/planejamento/fase-6-manutencao-rapida.md`
