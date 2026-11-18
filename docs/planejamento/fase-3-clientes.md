# Fase 3 - Clientes

A Fase 3 implementa o modulo interno de clientes do MVP 1. O objetivo e permitir que a equipe autenticada cadastre, consulte, edite, visualize e remova logicamente clientes da organizacao atual.

## Rotas criadas

- `/clientes`: listagem, busca por nome ou telefone e acoes principais.
- `/clientes/novo`: cadastro de cliente manual.
- `/clientes/[id]`: detalhes basicos do cliente.
- `/clientes/[id]/editar`: edicao de cadastro.

Todas essas rotas ficam dentro do layout protegido do dashboard. Usuario sem login vai para `/login`; usuario logado sem organizacao vai para `/onboarding/organizacao`.

## Tabela usada

Tabela `public.customers`:

- `id`
- `organization_id`
- `name`
- `phone`
- `phone_normalized`
- `address` (texto opcional, `null` quando vazio)
- `birth_date` (data civil opcional, `null` quando vazia)
- `whatsapp_opt_in`
- `whatsapp_opt_in_at`
- `source`
- `notes`
- `created_at`
- `updated_at`
- `deleted_at`

## Regras de negocio

- Cliente sempre pertence a organizacao atual do usuario.
- `organization_id` nunca vem do formulario.
- Nome e obrigatorio. Telefone e opcional desde a migration `0009`.
- Endereço e data de aniversário são opcionais no cadastro e na edição.
- Telefone e normalizado antes de salvar.
- Cliente ativo duplicado com mesmo `phone_normalized` e mesma `organization_id` e bloqueado.
- `source` e sempre `manual` nesta fase.
- `whatsapp_opt_in` so e verdadeiro quando o checkbox e marcado.
- `whatsapp_opt_in_at` recebe a data atual quando ha consentimento.
- `whatsapp_opt_in_at` fica `null` quando nao ha consentimento.
- Exclusao e soft delete: o sistema preenche `deleted_at`.
- Listagens e detalhes ignoram registros com `deleted_at` preenchido.
- Edicao nao permite trocar a organizacao do cliente.

## Validacoes

As validacoes ficam em `apps/web/src/lib/validations/customer.schema.ts`.

- `createCustomerSchema`: valida cadastro.
- `updateCustomerSchema`: valida edicao.
- `customerSearchSchema`: valida termo de busca.

Endereço recebe trim e aceita até 300 caracteres. Aniversário aceita somente uma
data civil válida no formato `YYYY-MM-DD`, incluindo validação de anos bissextos,
e não permite data futura. Valores omitidos, vazios ou nulos viram `null` nos dois
campos. A validação também acontece nas actions do servidor.

O helper `apps/web/src/lib/civil-date.ts` exibe aniversário em `dd/MM/yyyy` sem
converter a data em timestamp ou aplicar fuso. Apenas o cálculo do dia atual,
usado para bloquear datas futuras, considera `America/Sao_Paulo` tanto na tela
quanto no servidor.

## Endereço e aniversário

Os formulários e o detalhe do cliente também oferecem `Abrir no Maps` usando o
endereço e `organizations.service_city`. Endereço vazio não gera botão; cidade
ausente usa o fallback com Brasil. Não há consulta automática nem API key.
Veja [Cidade de serviço e Google Maps](cidade-de-servico-maps.md) para implantação,
configuração, privacidade e testes.

- `/clientes/novo` e `/clientes/[id]/editar` usam o mesmo formulário, com os novos
  campos entre telefone e consentimento WhatsApp. Valores nulos aparecem vazios;
  apagar os valores e salvar volta a gravar `null`.
- `/clientes/[id]` mostra endereço e aniversário, ou `Não informado` quando ausentes.
- Listagem, cards mobile e busca continuam simples, por nome ou telefone.
  Busca por endereço fica como melhoria futura.
- Manutenção rápida e cadastro inline na manutenção completa continuam mínimos.
  A RPC `create_maintenance_intake` omite as novas colunas: novos clientes recebem
  `null`. Clientes ativos reutilizados ou arquivados reativados preservam os dados.
  Os campos podem ser completados depois em `/clientes/[id]/editar`.
- Tipos completos de cliente e de formulário incluem os novos campos. Projeções
  de manutenção, mensagens e lookup do quiosque mantêm somente os dados usados
  nesses fluxos, sem transportar endereço e aniversário desnecessariamente.
- `birth_date` prepara um futuro relacionamento com o cliente. Lembretes,
  mensagens automáticas e campanhas de aniversário não foram implementados.

### Migration e aplicação manual

Aplicar `supabase/migrations/0014_customer_address_birth_date.sql` no Supabase
antes de executar a versão atualizada do módulo. Nenhuma migration remota é
aplicada automaticamente por esta alteração.

```sql
alter table public.customers
  add column if not exists address text null,
  add column if not exists birth_date date null;
```

A migration é reaplicável, não altera dados existentes nem policies RLS e não
adiciona obrigatoriedade, default ou tabela. Clientes antigos recebem os novos
campos nulos.

O telefone e tratado por `apps/web/src/lib/phone.ts`:

- `normalizePhoneBR(phone)`: remove caracteres nao numericos e remove prefixo `55` quando aplicavel.
- `formatPhoneBR(phone)`: exibe telefones com DDD em formato legivel.

## Consentimento WhatsApp

O checkbox usado no cadastro e edicao registra se o cliente aceita receber mensagens da loja pelo WhatsApp sobre manutencao, entrega, produtos e promocoes.

Esse campo prepara o sistema para fases futuras. Mensagens promocionais devem considerar apenas clientes com `whatsapp_opt_in = true`.

## Soft delete

Clientes nao sao apagados fisicamente. A action `deleteCustomerAction` preenche `deleted_at` com a data atual.

A migration `0002_customers_active_phone_unique.sql` troca a unicidade antiga por um indice unico parcial, bloqueando telefone duplicado apenas entre clientes ativos.

## Seguranca e LGPD

- As actions chamam `requireAuth()` e `requireOrganization()`.
- O Supabase client server-side usa a sessao do usuario e respeita RLS.
- Nenhuma action aceita `organization_id` vindo do navegador.
- A chave `SUPABASE_SECRET_KEY` nao e usada no modulo de clientes.
- Nome, telefone, endereço, aniversário e observacoes devem ser tratados como dados pessoais.
- Observacoes nao devem receber dados sensiveis desnecessarios.
- As policies existentes de `customers` protegem também as novas colunas por
  associação à organização. Criação e edição usam a sessão e a organização atual,
  nunca o `organization_id` enviado pelo formulário.
- Os campos aparecem apenas nas telas autenticadas de clientes. O quiosque público
  consulta somente `id` e retorna confirmação genérica, sem expor esses dados.
- Não existe acompanhamento público de OS nesta versão. Uma implementação futura
  deve usar uma lista explícita de campos públicos que exclua endereço e aniversário.

## Testes manuais

1. Acessar `/clientes` sem login e confirmar redirecionamento para `/login`.
2. Fazer login com usuario valido.
3. Se necessario, criar a organizacao inicial.
4. Acessar `/clientes` e clicar em `Novo cliente`.
5. Criar cliente com nome, telefone e consentimento marcado.
6. Confirmar que o cliente aparece na listagem.
7. Buscar por parte do nome.
8. Buscar por parte do telefone.
9. Abrir detalhes do cliente.
10. Editar nome, telefone, consentimento e observacoes.
11. Tentar criar outro cliente ativo com o mesmo telefone e confirmar bloqueio.
12. Excluir o cliente e confirmar que ele desaparece da listagem.
13. Validar no Supabase que `deleted_at` foi preenchido.

### Verificação dos novos campos

Após aplicar a migration em um ambiente de testes:

1. Criar cliente somente com nome. Conferir `address = null` e `birth_date = null`.
2. Criar cliente com endereço e aniversário. Reabrir a edição e confirmar os valores;
   no detalhe, conferir a data em `dd/MM/yyyy`.
3. Editar somente endereço, salvar e reabrir; repetir alterando só aniversário.
4. Apagar ambos, salvar e conferir os dois campos nulos no banco e `Não informado`
   no detalhe.
5. Tentar uma data futura; confirmar bloqueio na tela e na action. Tentar uma data
   impossível, como `2025-02-29`, diretamente no schema/action; confirmar rejeição.
6. Abrir e editar cliente anterior à migration, mantendo os campos vazios.
7. Criar manutenção rápida sem nome ou telefone e manutenção completa com novo
   cliente inline. Confirmar a OS e os campos nulos nos clientes criados.
8. Reutilizar/reativar cliente com os dois campos preenchidos pela manutenção;
   confirmar que os valores continuam preservados.
9. Verificar com usuário de outra organização e acesso anônimo que os dados não
   são retornados. Conferir que o quiosque não retorna endereço ou aniversário.

Testes automatizados de schema, actions e renderização dos componentes:

```sh
pnpm --filter web test:customers
pnpm --filter web test:14a
```

O teste `supabase/tests/maintenance-intake.test.cjs` cobre a migration reaplicável,
preservação de clientes antigos, isolamento RLS, acesso anônimo e os dois fluxos de
manutenção em PostgreSQL descartável, sem conexão com o Supabase remoto. Executar
na raiz do repositório com Node.js e a versão compatível `@electric-sql/pglite@0.5.16`.
O comando oficial desta suíte é `pnpm test:sql:maintenance`.

Para incorporar a suíte ao fluxo habitual da equipe/CI, PGlite deve ser uma
`devDependency` da raiz, com versão exata. A instalação é uma decisão explícita;
esta correção não instala pacotes nem altera o lockfile. Para adotá-la:

```sh
pnpm add -Dw --save-exact @electric-sql/pglite@0.5.16
pnpm test:sql:maintenance
```

Também é suportado manter a dependência fora do repositório. `PGLITE_TEST_MODULE`
deve apontar para o caminho absoluto do pacote instalado (ou seu entrypoint
CommonJS), não para um banco ou URL. Exemplo reproduzível em PowerShell, que
instala somente em uma pasta temporária e não altera as dependências do projeto:

```powershell
$pgliteTestDir = Join-Path ([System.IO.Path]::GetTempPath()) 'assistencia-pglite-0.5.16'
npm install --prefix "$pgliteTestDir" --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.16
$env:PGLITE_TEST_MODULE = Join-Path $pgliteTestDir 'node_modules/@electric-sql/pglite'
pnpm.cmd test:sql:maintenance
Remove-Item Env:PGLITE_TEST_MODULE
```

Com uma instalação externa já disponível, basta configurar `PGLITE_TEST_MODULE`
e executar o comando. Sem essa variável, o teste resolve o pacote normalmente
pelas dependências do projeto. A suíte mantém 23 subtestes SQL; o Node também
contabiliza o teste agrupador, totalizando 24 resultados.

O helper `toCivilDate` normaliza `birth_date` na leitura das linhas pelo teste.
Aceita string civil, `Date` válido devolvido pelo driver e `null`. Para `Date`,
usa somente componentes UTC, preservando o dia independentemente do fuso local.
Assim, asserções isoladas e snapshots comparam datas por valor. O parser padrão
do PGlite, a migration e o armazenamento PostgreSQL `date` permanecem intactos.

Verificações de qualidade:

```sh
pnpm lint
pnpm typecheck
pnpm build
```

`apps/web/next-env.d.ts` é gerado pelo Next.js: `next dev` pode referenciar
`.next/dev/types/routes.d.ts`, enquanto `next build` normaliza a referência para
`.next/types/routes.d.ts`. Manter o arquivo versionado conforme o repositório,
sem incluir no commit apenas a troca gerada pelo modo de desenvolvimento.

No PowerShell com scripts bloqueados, usar `pnpm.cmd` no lugar de `pnpm`.
