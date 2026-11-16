# Fase 14A — Confiabilidade e usabilidade

## Escopo implementado

1. Manutenção rápida continua exigindo apenas modelo e defeito. Nome e telefone são opcionais; telefone informado é validado. A estrutura mantém cliente obrigatório no banco, com cliente exclusivo sem telefone por OS quando necessário.
2. Criação rápida e completa usam `create_maintenance_intake`: cliente, aparelho, OS e evento são gravados na mesma transação. O código não recorre a inserts separados quando a RPC está ausente.
3. Um UUID de tentativa é gerado no servidor e preservado no formulário após erros. A RPC serializa a criação por organização e retorna a OS existente no reenvio do mesmo identificador. O UUID fica em `maintenance_orders.intake_request_id`, com índice único por organização.
4. Nova manutenção oferece Cliente existente / Novo cliente. A alternância mantém os campos da OS montados. O cliente é resolvido junto com a OS; telefone já existente reaproveita o cadastro ativo sem sobrescrever nome ou reativa o arquivado da mesma organização, preservando ID e histórico.
5. WhatsApp abre uma janela durante a ação do usuário, prepara a mensagem e direciona essa janela. A mesma mensagem pode ser aberta novamente. Há link alternativo, cópia e seleção manual do texto se o clipboard falhar. Bloqueio ou fechamento da janela gera orientação.
6. Prévia personalizada e envio compartilham o mesmo gerador de variáveis com dados reais da OS e da organização. Datas de calendário são formatadas sem deslocamento de fuso.
7. Dashboard apresenta indisponibilidade por bloco afetado. Não renderiza os números substitutos de uma consulta com erro. Reposição com erro não renderiza totais nem lista copiável.
8. Garantia mensal mantém o dia quando possível; caso contrário usa o último dia do mês de destino, incluindo ano bissexto.
9. Vendas possuem edição em `/saidas/[id]/editar`, acessível nos cards e na tabela. Quantidade, preço, cliente, observação, modelo e data podem ser corrigidos. O total é mostrado antes de salvar e recalculado no servidor. Preços decimais vindos do banco mantêm os centavos.

## Banco e publicação — correção do PGRST202 (10/09/2026)

Diagnóstico: a migration `0010_atomic_maintenance_intake.sql` já existe e declara os sete argumentos usados pela action. O erro da Vercel informa que o PostgREST não encontra essa RPC/assinatura no cache. A confirmação fornecida de `is_nullable = NO` para ambos os telefones comprova também que o banco ainda não possui o efeito da migration 0009. O estado remoto não foi consultado por esta execução.

Não foi criada outra migration nem alterada a chamada do aplicativo. Corrigidos os arquivos existentes para instalação/reaplicação neste banco pendente:

- `0009`: alteração de nulabilidade e reconstrução do índice único agora estão em uma única transação; notifica recarga do cache ao confirmar.
- `0010`: preserva assinatura e retorno; verifica a RPC dependente da 0004 antes da instalação; rejeita payload nulo/inválido; não confirma criação se a RPC interna não retornar OS ou se a tentativa não puder ser registrada; mantém grants e notifica recarga do cache.
- As constraints de produtos/película privativa não são alteradas.

### Assinatura final e retorno

```sql
public.create_maintenance_intake(
  p_organization_id uuid,
  p_request_id uuid,
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_input jsonb,
  p_quick boolean default false
)
returns table (order_id uuid, order_number text)
```

As sete chaves do objeto passado à RPC correspondem aos nomes acima. A ordem alfabética exibida no erro não é a ordem posicional de SQL: o PostgREST associa as chaves JSON pelos nomes. Não criar uma segunda sobrecarga reordenando os tipos dos argumentos.

Foi mantido `TABLE(order_id uuid, order_number text)` porque a action usa `.maybeSingle()` e redireciona com `order.order_id`. O retorno jsonb sugerido não é necessário para resolver o incidente e mudaria o contrato já publicado. Uma linha indica a OS confirmada; erro SQL aborta a operação inteira. IDs de cliente e aparelho permanecem na própria OS.

Grant correspondente, já incluído na 0010:

```sql
grant execute on function public.create_maintenance_intake(
  uuid, uuid, uuid, text, text, jsonb, boolean
) to authenticated;
```

A função usa `security invoker`, verifica autenticação e participação na organização e deriva o criador de `auth.uid()`. A execução não é concedida a `anon`/PUBLIC. As policies existentes continuam valendo.

### Sequência para o Supabase de produção

1. Abrir o SQL Editor do mesmo projeto Supabase configurado no ambiente Production da Vercel. Conferir o projeto no painel, sem compartilhar variáveis ou chaves.
2. Executar o conteúdo COMPLETO de `supabase/migrations/0009_allow_customers_without_phone.sql` e confirmar sucesso.
3. Executar o conteúdo COMPLETO de `supabase/migrations/0010_atomic_maintenance_intake.sql` e confirmar sucesso. A 0010 depende das migrations anteriores, especialmente da RPC com garantia criada na 0004. Se a verificação inicial acusar ausência da 0004, aplicar a migration indicada e repetir a 0010; não ignorar o erro nem reaplicar o schema inicial sobre tabelas existentes.
4. Executar a recarga explícita abaixo após as migrations concluídas. Ela também já está incluída nos arquivos e não cria funções ausentes por si só.
5. Conferir nulabilidade, assinatura e grant com as consultas abaixo.
6. Fazer os testes autenticados na URL de produção da Vercel.

Não foi aplicado SQL remotamente. Estas instruções corrigem o banco; um novo build da Vercel não executa as migrations por conta própria.

### Consultas para conferir a aplicação

Verificar telefone opcional (esperado: duas linhas com `YES`):

```sql
select
  column_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customers'
  and column_name in ('phone', 'phone_normalized');
```

Verificar RPC (esperado: a assinatura acima e retorno `TABLE(order_id uuid, order_number text)`):

```sql
select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_maintenance_intake';
```

Conferir permissão (esperado: `authenticated_execute = true`):

```sql
select has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
where p.oid = to_regprocedure(
  'public.create_maintenance_intake(uuid,uuid,uuid,text,text,jsonb,boolean)'
);
```

Recarregar cache:

```sql
notify pgrst, 'reload schema';
```

Se a RPC existir mas o PGRST202 continuar, conferir os sete nomes/tipos, a conclusão do COMMIT e o projeto Supabase realmente usado pela Vercel. O teste SQL Editor como administrador não substitui o teste pelo usuário autenticado do app.

### Redeploy

Não é necessário redeploy se a Vercel já executa a chamada acima e aponta para o projeto Supabase corrigido. A correção é nas migrations/cache. Fazer redeploy se for preciso alterar as variáveis de ambiente da Vercel ou se o código publicado ainda não corresponder à Fase 14A.

Referências oficiais: [argumentos nomeados de RPC](https://postgrest.org/en/stable/references/api/functions.html) e [recarga do cache](https://postgrest.org/en/stable/references/schema_cache.html).

## Limites da proteção contra duplicação

A mesma tentativa retorna a primeira OS confirmada, mesmo se a resposta anterior tiver sido perdida. Uma falha SQL dentro da RPC desfaz também cliente/aparelho/evento criados nessa transação. Cadastros anteriores permanecem intactos.

A proteção usa o identificador do formulário: abrir outro formulário ou recarregar a página inicia outra tentativa. Não é uma detecção geral de atendimentos semelhantes. Se perder a página após um envio incerto, conferir a listagem antes de abrir outro atendimento.

## Testes automatizados executados

Comando: `pnpm --filter web test:14a`.

Dez testes agrupados cobrem: schemas dos modos de cliente; actions rápidas e completas; envio de UUID e organização confiável à RPC; orientação sobre migration ausente; WhatsApp com/sem telefone; reabertura e bloqueio simulado; variáveis reais da prévia; calendário mensal; dashboard vazio versus falha com verificação do HTML; reposição sem lista em erro; edição de venda e cálculo de centavos.

As fronteiras de Supabase, navegador e sessão são simuladas. Esses testes NÃO comprovam execução da migration, rollback e concorrência em PostgreSQL, abertura no WhatsApp real nem comportamento visual dos formulários. Logs com `SIMULATED_FAILURE` e `PGRST202` durante os testes são falhas intencionais.

Verificações executadas: `pnpm lint`, `pnpm typecheck`, `pnpm build` — aprovadas.

## Roteiro obrigatório no ambiente de teste

| Nº | Ação | Resultado esperado |
|---|---|---|
| 1 | Rápida com Samsung A14 e Não carrega | Uma OS, cliente sem telefone, aparelho e evento; abre detalhe |
| 2 | Rápida com João e sem telefone | Nome preservado, telefone nulo, WhatsApp bloqueado |
| 3 | Rápida com telefone e sem nome | Reaproveita cliente ativo ou usa Cliente sem nome |
| 4 | Completa com cliente existente | Mantém vínculo correto e abre uma OS |
| 5 | Completa: preencher aparelho, alternar Novo cliente, informar nome e salvar | Dados da OS preservados; cliente e atendimento criados juntos |
| 6 | OS com telefone: abrir mensagem | WhatsApp abre e permite envio manual |
| 7 | OS sem telefone | Botões bloqueados e aviso para completar telefone |
| 8 | Abrir a mesma mensagem duas vezes, bloquear popups e testar cópia | Duas aberturas possíveis; alternativa e feedback funcionam |
| 9 | Selecionar mensagem personalizada | Prévia corresponde ao cliente, aparelho, loja, número e datas reais |
| 10 | Garantia 31/01/2026 + 1 mês e 31/08/2026 + 1 mês | 28/02/2026 e 30/09/2026 |
| 11 | Simular falha de consulta em ambiente isolado | Bloco indisponível; nenhum falso zero ou lista vazia copiável |
| 12 | Editar venda: 3 unidades a 25,50, modelo, cliente e observação | Total 76,50, mesmo registro atualizado e relatórios atualizados |

Complementos de confiabilidade: repetir requisição com o mesmo UUID; executar duas solicitações concorrentes; provocar falha na inserção do evento em banco descartável e confirmar rollback; confirmar que usuário de outra organização não acessa a OS. Não provocar falhas deliberadas no banco de produção.

## Pendências fora desta entrega

- Executar roteiro autenticado no Supabase após aplicar migrations; verificar RLS, rollback e concorrência.
- Validar desktop/celular, clipboard e WhatsApp real.
- Vinculação posterior de um cliente temporário a outro cliente existente.
- Edição transacional dos dados de uma OS já existente (esta fase torna transacional a criação).
- Paginação/aggregação completa de relatórios e listas; os limites anteriores continuam existentes.
- Identificação estruturada de clientes temporários e ajuste dos indicadores de clientes.
- Uniformização das regras de mensagens personalizadas de garantia com o botão operacional.
- Histórico do cliente, rascunhos e atalhos de atendimento.

## Passagem para Fase 14B — Deploy

Código implementado e verificações locais aprovadas. Pode iniciar preparação do deploy, mas a liberação do piloto depende de migrations aplicadas e aprovação do roteiro real. Não houve commit nem envio ao GitHub.

## Arquivos alterados

- `apps/web/package.json`
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/actions.ts`
- `apps/web/src/app/(dashboard)/manutencoes/customer-select.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-form.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/nova/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/rapida/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/rapida/quick-maintenance-form.tsx`
- `apps/web/src/app/(dashboard)/mensagens/actions.ts`
- `apps/web/src/app/(dashboard)/mensagens/custom-whatsapp-message-form.tsx`
- `apps/web/src/app/(dashboard)/mensagens/whatsapp-button.tsx`
- `apps/web/src/app/(dashboard)/relatorios/reposicao/page.tsx`
- `apps/web/src/app/(dashboard)/saidas/actions.ts`
- `apps/web/src/app/(dashboard)/saidas/product-outflow-form.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-outflow-table.tsx`
- `apps/web/src/lib/dashboard/metrics.ts`
- `apps/web/src/lib/maintenance/warranty.ts`
- `apps/web/src/lib/products/format.ts`
- `apps/web/src/lib/validations/maintenance.schema.ts`

## Arquivos criados

- `supabase/migrations/0010_atomic_maintenance_intake.sql`
- `apps/web/src/lib/messages/order-variables.ts`
- `apps/web/src/app/(dashboard)/mensagens/whatsapp-controls.tsx`
- `apps/web/src/app/(dashboard)/saidas/[id]/editar/page.tsx`
- `apps/web/tests/fase-14a.test.cjs`
- `docs/planejamento/fase-14a-confiabilidade-usabilidade.md`
- `docs/planejamento/fase-14a-checklist.md`

## Validação da correção das migrations

Arquivo: `supabase/tests/maintenance-intake.test.cjs`.

O teste usa PostgreSQL descartável via PGlite e lê as migrations do repositório. Substitui somente o provedor `auth` por uma sessão de teste e usa `gen_random_uuid()` nativo em vez da extensão pgcrypto. Não lê `.env`, não usa dados reais e não acessa o Supabase. Exercita telefone nulo, assinatura/retorno/grants, cenários A/B/C, completa, reenvio, isolamento de organização, dependência ausente e rollback por falha forçada no evento e no registro da tentativa. Não valida o cache PostgREST nem concorrência entre sessões remotas.

Para executar sem adicionar dependência ao aplicativo (PowerShell):

```powershell
npm.cmd install --prefix "$env:TEMP\assistencia-14a-sql-validation" --cache "$env:TEMP\assistencia-14a-sql-validation\npm-cache" --no-save --ignore-scripts --no-package-lock @electric-sql/pglite@0.5.8
$env:PGLITE_TEST_MODULE = "$env:TEMP\assistencia-14a-sql-validation\node_modules\@electric-sql\pglite"
node --wasm-num-compilation-tasks=1 --wasm-lazy-compilation --test --test-isolation=none supabase/tests/maintenance-intake.test.cjs
pnpm.cmd --filter web test:14a
```

Resultado em 10/09/2026: os 11 cenários SQL passaram (o executor Node informa 12 testes ao incluir o teste pai). Os 10 testes existentes da aplicação também passaram. A primeira tentativa do executor SQL excedeu memória; a execução acima limita compilação WebAssembly e passou. Foi usado PGlite 0.5.8 apenas na pasta temporária, sem alterar dependências do projeto. As alterações desta correção são restritas a SQL, testes SQL e documentação; não houve novo build do aplicativo nem commit.

## Arquivos desta correção de produção

- `supabase/migrations/0009_allow_customers_without_phone.sql`
- `supabase/migrations/0010_atomic_maintenance_intake.sql`
- `supabase/tests/maintenance-intake.test.cjs` (novo)
- `docs/planejamento/fase-14a-confiabilidade-usabilidade.md`
- `docs/planejamento/fase-14a-checklist.md`

## Reativação de cliente arquivado pelo telefone — 03/11/2026

### Causa e auditoria de unicidade

A RPC da 0010 procurava somente `deleted_at is null`, tanto na busca inicial quanto após `unique_violation`. Um telefone arquivado era tratado como novo. O schema inicial (0001) tem a constraint `customers_organization_id_phone_normalized_key`, única por `(organization_id, phone_normalized)` para todos os cadastros; nesse estado, a inserção falha. A 0002 remove essa constraint e cria unicidade só entre ativos. A 0009 recria o índice `customers_active_phone_normalized_unique` com predicado `deleted_at is null and phone_normalized is not null`. Com esse índice parcial, o mesmo erro de lógica permite duplicar um cadastro arquivado em vez de reativá-lo.

A auditoria acima foi feita no código e nas migrations; o estado do Supabase remoto não foi consultado. A 0011 não remove nem altera constraints/índices e funciona também quando a constraint original ainda existe, desde que os demais pré-requisitos da 0010 estejam instalados. Para conferir o estado real, executar no SQL Editor:

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.customers'::regclass;

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'customers';
```

### Comportamento e concorrência

Manutenção rápida (`/manutencoes/rapida`) e normal (`/manutencoes/nova`, modo Novo cliente) continuam usando uma única `create_maintenance_intake`. A migration nova `0011_restore_archived_customer_on_intake.sql` substitui essa função, mantendo sete parâmetros, retorno `TABLE(order_id uuid, order_number text)`, grants, `security invoker`, RLS, validação de organização, bloqueio por organização e UUID de tentativa.

Depois de normalizar o telefone, a RPC procura e bloqueia o cliente ativo da organização; se houver, reutiliza sem sobrescrever dados. Caso contrário, procura e bloqueia o arquivado. Ao reativar, define explicitamente `deleted_at = null`, conserva o ID, atualiza `phone` e `phone_normalized`, usa o nome preenchido no formulário ou preserva o anterior. Nome anterior com menos de 2 ou mais de 120 caracteres após trim recebe `Cliente sem nome` quando o formulário não informa nome. `organization_id`, `notes`, origem, consentimento WhatsApp, data de consentimento, criação e histórico não são sobrescritos. O `updated_at` segue o trigger já existente.

Somente quando não existe nenhum cadastro correspondente a RPC insere outro cliente. Sem telefone, permanece a regra anterior de cliente exclusivo. Se o índice parcial tiver permitido vários arquivados no passado, o mais recentemente arquivado tem prioridade (desempate por ID); os demais não são alterados ou mesclados. Um ativo sempre tem prioridade sobre todos os arquivados.

O tratamento de `unique_violation` engloba inserção e reativação. A busca por ativos e arquivados é repetida em até três tentativas, para reutilizar inclusive um cliente reativado por outra operação. Conflito persistente é propagado com seus detalhes e desfaz a transação. Falha posterior ao reativar, por exemplo no evento da OS, desfaz também a reativação e as mudanças de nome/telefone. A action registra o erro técnico no servidor e, para `23505` identificado como conflito de telefone, mostra: “Este telefone já pertence a outro cadastro. Não foi possível vincular automaticamente o cliente.” Outros erros mantêm o tratamento anterior.

### SQL a aplicar e publicação

Executar o conteúdo **completo** de `supabase/migrations/0011_restore_archived_customer_on_intake.sql` no SQL Editor do projeto Supabase utilizado pelo aplicativo. Não executar somente `notify` e não reaplicar migrations antigas já instaladas. Se o banco estiver atrasado, aplicar primeiro as migrations faltantes na ordem numérica até 0010. A 0011 já inclui `begin`, `create or replace function`, grants, `notify pgrst, 'reload schema';` e `commit`.

Não foi aplicado SQL remoto. Não foram lidas ou expostas chaves/`.env.local`. Não houve commit. A reativação passa a valer após aplicar a 0011 no banco; publicar o código atualizado na Vercel também disponibiliza a mensagem específica de conflito. Um build/redeploy da Vercel não aplica SQL automaticamente.

### Validação e roteiro local/Vercel

O teste SQL `supabase/tests/maintenance-intake.test.cjs` aplica a 0011 duas vezes e verifica assinatura, grants e índices intactos. Exercita novos/ativos/arquivados nos modos rápido e normal, histórico com três OS, nome e telefone atuais, preservação de notas/origem/consentimento verdadeiro, falso e nulo, fallback de nome legado, vários arquivados, prioridade do ativo, constraint global antiga, isolamento RLS entre organizações, reenvio do UUID, retry controlado de `unique_violation`, conflito persistente e rollback da reativação ao falhar evento. O retry é injetado por trigger em banco descartável; não comprova concorrência real entre sessões.

Os testes da aplicação cobrem ambas as actions, os argumentos da RPC e a mensagem de conflito com preservação do UUID e log técnico. Os comandos SQL/PGlite estão na seção de validação acima. Verificações de qualidade: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm --filter web test:14a`.

Para validar no aplicativo local, aplicar as migrations no banco de desenvolvimento e executar `pnpm dev`. Repetir o roteiro abaixo em **cada** uma das rotas `/manutencoes/rapida` e `/manutencoes/nova` (Novo cliente). Na normal, informar nome; na rápida, testar também sem nome.

| Cenário | Ação e resultado esperado |
|---|---|
| Telefone novo | Informar telefone nunca usado: um cliente e uma OS são criados. |
| Cliente ativo | Repetir o telefone com nova tentativa: nova OS no mesmo cliente, sem alteração do nome ativo. |
| Arquivado com histórico | Anotar ID, OS antigas, notas e consentimento; arquivar o cliente e abrir OS com telefone formatado, inclusive +55: mesmo ID reativado, `deleted_at = null`, nova OS e antigas no mesmo cliente, notas/consentimento preservados. |
| Nome na reativação | Nome atual preenchido substitui o antigo; rápida sem nome mantém nome válido anterior. |
| Outra organização | Usar telefone presente só em outra loja: criar/reutilizar cliente da loja atual, sem reativar ou alterar o externo. |
| Reenvio | Repetir a mesma tentativa/UUID: retornar a mesma OS, sem novas gravações. |
| Concorrência real | Em banco de teste, enviar duas solicitações com o mesmo telefone (novo e arquivado) e UUIDs distintos: duas OS, um cliente; com mesmo UUID: uma OS. Testar também cadastro/reativação externo concorrente. |

Na Vercel, depois de aplicar a 0011 no projeto correto e publicar a action atualizada, repetir o mesmo roteiro autenticado. Conferir ausência do erro genérico/conflito para arquivados e inspecionar os logs do servidor se houver falha. Não provocar falhas de evento em produção.

### Limites e pendências

Não são criadas duplicatas por uma abertura normal desta RPC ao encontrar arquivado. Duplicatas históricas não são mescladas. O índice parcial existente continua permitindo que outros fluxos de cadastro criem um cliente usando telefone de arquivado, e operações externas não compartilham necessariamente o bloqueio da RPC; não há garantia global de unicidade entre ativos e arquivados. A constraint/índice existente continua protegendo o escopo que já protegia. Alterar globalmente esse modelo exigiria tratar os dados e fluxos de cadastro fora desta correção. Permanecem pendentes a aplicação remota da migration, os testes autenticados no navegador e a concorrência real entre sessões em banco de teste.
