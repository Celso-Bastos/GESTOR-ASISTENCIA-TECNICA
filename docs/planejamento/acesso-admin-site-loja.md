# Acesso administrativo e Site da loja

## Auditoria anterior à implementação

- `/admin/solicitacoes-conta` já existe fora do layout do dashboard. A página verifica a sessão e `isPlatformAdmin()` no servidor antes de consultar pedidos. As actions repetem a autorização via `getPlatformAdmin()`.
- `apps/web/src/lib/auth/platform-admin.ts` consulta `public.platform_admins` com a sessão do usuário e exige conta aprovada. O papel `owner` ou `admin` da organização não concede acesso de plataforma.
- A navegação compartilhada desktop/mobile não tinha acesso às solicitações.
- `public.organizations.slug` é `text unique not null` desde `0001_initial_schema.sql`. Nenhuma alteração de schema é necessária.
- O campo era informado manualmente no onboarding, validado por Zod (3–60 caracteres, letras minúsculas, números e hífens entre segmentos) e exibido somente para leitura em Configurações. Não havia geração automática nem edição na configuração.
- Outros consumidores: consultas da organização, geração de links do quiosque, `/kiosk/[slug]` e `/api/kiosk/customers`. O quiosque exige token ativo e não representa um site público da loja.
- Não existe site público da loja em `/loja/[slug]` ou `/[slug]`. Não criar endereço, preview ou ações de copiar/abrir para uma página inexistente.

## Comportamento implementado

- O layout autenticado chama o helper existente `isPlatformAdmin()` no servidor e passa apenas o resultado booleano à navegação compartilhada.
- Sidebar e menu mobile mostram **Administração → Solicitações de conta**, com o ícone `ShieldCheck` da biblioteca já instalada. O destino real continua `/admin/solicitacoes-conta`.
- Usuários comuns e admins de organização não veem o item. O acesso manual continua bloqueado no servidor antes de consultar solicitações. Página, actions, RLS e helper de autorização de plataforma foram preservados.
- O nome técnico continua `organizations.slug`. A interface usa **Site da loja** no onboarding, nos dados da organização e no texto auxiliar do quiosque.
- No onboarding, a sugestão acompanha o nome até a primeira edição manual. A normalização aplica NFD, remove acentos, converte para minúsculas, substitui sequências de caracteres incompatíveis (incluindo espaços) por um hífen, remove hífens nas extremidades e limita a sugestão a 60 caracteres.
- Exemplos: `Celso Assistência` → `celso-assistencia`; `Assistência São José` → `assistencia-sao-jose`; `Tech & Cell` → `tech-cell`.
- Valores já configurados não são regenerados a partir do nome. A configuração recebe o valor salvo, sem vincular sua atualização ao nome da assistência.
- Em **Configurações → Dados da organização**, owners/admins editam o campo junto dos dados da empresa e da cidade de serviço. Empregados têm apenas leitura e a action também recusa alterações por esse papel.
- A action reutiliza o fluxo existente de configuração: `requireOrganization()` obtém organização/papel da sessão, valida com Zod e grava somente `slug` no ID obtido da sessão. IDs, nomes e papéis enviados no formulário não determinam a gravação.
- A validação server-side compartilhada exige 3–60 caracteres, letras ASCII minúsculas/números e hífens entre segmentos. Trim e conversão para minúsculas são mantidos; acentos e símbolos digitados manualmente produzem orientação amigável. A sugestão faz a remoção automática de acentos.
- A restrição UNIQUE existente arbitra duplicidades, inclusive em gravações concorrentes. Criação e edição convertem `23505` em **Este endereço já está sendo utilizado. Escolha outro.**, sem expor mensagens do PostgreSQL.
- Não foi criado site público. O texto explica **Identificador do site da loja** e a indisponibilidade do site público. Não há prévia de URL nem botões novos de copiar/abrir um site inexistente. Os links e o botão de copiar próprios do quiosque continuam no local existente.
- Alterar o campo muda `/kiosk/[slug]?token=...`: o formulário avisa para atualizar links e QR codes do atendimento. A action revalida Configurações, Quiosque e páginas de quiosque; tokens não são substituídos. Links antigos deixam de resolver a organização com o nome anterior.

## Arquivos desta melhoria

| Arquivo | Alteração |
| --- | --- |
| `apps/web/src/app/(dashboard)/layout.tsx` | Verificação de platform admin no servidor para os dois menus |
| `apps/web/src/components/dashboard-navigation.tsx` | Seção administrativa condicional e ícone existente |
| `apps/web/src/app/(dashboard)/onboarding/organizacao/organization-form.tsx` | Site da loja, sugestão automática e edição manual preservada |
| `apps/web/src/lib/organization/slug.ts` | Normalização da sugestão |
| `apps/web/src/lib/validations/organization.ts` | Schema compartilhado de criação/edição e mensagens amigáveis |
| `apps/web/src/lib/organization/actions.ts` | Edição autorizada e tratamento de duplicidade na criação/edição |
| `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | Configuração editável para owner/admin e leitura para empregado |
| `apps/web/src/app/(dashboard)/configuracoes/site-form.tsx` | Formulário, ajuda, feedback e aviso de links do quiosque |
| `apps/web/src/app/(dashboard)/configuracoes/quiosque/page.tsx` | Vocabulário da interface |
| `apps/web/tests/admin-site-loja.test.cjs` | Oito testes novos de acesso, validação e edição |
| `apps/web/tests/presentation.test.cjs` | Mock explícito da nova dependência do layout no teste existente |
| `README.md` | Documentação de acesso, nomenclatura e limitações |
| `docs/planejamento/acesso-admin-site-loja.md` | Auditoria, relatório e checklist |

Já havia alterações de manutenção rápida/endereço na working tree, incluindo `0016_quick_maintenance_customer_address.sql`; essa migration pertence ao trabalho anterior, não foi criada nem aplicada por esta melhoria. Não houve commit ou push. O build também regenera automaticamente `next-env.d.ts`.

## Schema e operações manuais

Nenhuma migration criada, coluna renomeada, constraint ou policy RLS alterada. Nenhum SQL adicional é necessário para esta melhoria, considerando o schema versionado já existente. A unicidade foi confirmada na migration inicial; não foi feita inspeção do schema remoto. O cadastro operacional de platform admins continua no fluxo existente, sem conceder acesso automaticamente a admins de organização.

`.env.local` não foi editado. Nenhuma migration foi aplicada remotamente e os testes SQL usaram PostgreSQL/PGlite descartável local.

## Verificação automatizada

| Verificação | Resultado |
| --- | --- |
| `node --test tests/*.test.cjs` em `apps/web` | 90 aprovados, zero falhas/ignorados; inclui oito testes novos |
| Testes SQL existentes de solicitações e cidade de serviço | 15 aprovados, zero falhas/ignorados |
| `pnpm lint` | Aprovado |
| `pnpm typecheck` | Aprovado |
| `pnpm build` | Aprovado: compilação, TypeScript e geração de páginas; rota administrativa presente |
| `git diff --check` | Aprovado |

Os comandos pnpm foram executados por `pnpm.cmd`, pois a política do PowerShell bloqueia o shim `pnpm.ps1`. Os testes SQL usaram `PGLITE_TEST_MODULE` apontando para a instalação local já disponível em `%TEMP%/assistencia-14a-sql-validation/node_modules/@electric-sql/pglite`. Uma execução paralela excedeu a memória do ambiente; a execução final usou `--test-concurrency=1` e `NODE_OPTIONS=--max-old-space-size=512`, somente no processo, e passou. Não foram alterados scripts, dependências, lockfile ou arquivos de ambiente.

Cobertura nova: decisão do helper no layout e propagação aos dois menus; anonimato e acesso direto negado; página permitida para plataforma; normalização/limites; gravação owner/admin e recusa employee; rejeição de IDs/papéis forjados; mensagens de duplicidade na criação/edição; erros genéricos sem vazamento; revalidação de quiosque; preservação de edição manual e de valor já salvo. Os testes existentes também exercitam o helper real e o isolamento por RLS em PostgreSQL local.

## Tema, mobile e bloqueadores

Os elementos novos usam os tokens existentes (`bg-surface`, `text-body`, `text-muted`, `border-line`, estados de foco/erro) e controles de ao menos 44 px. Formulários usam grid e `min-w-0`; a leitura do valor usa `break-all`. O acesso mobile usa o mesmo componente/resultado de autorização do desktop. Nenhuma URL longa foi acrescentada à configuração. Os testes existentes de tema/contraste passaram, e os testes de markup confirmam os dois menus.

Isso representa revisão de código e testes automatizados; **não representa aprovação visual de light/dark ou mobile**. Nesta sessão, a descoberta de navegadores retornou `The browser access host is unavailable`. A alternativa pelo Firefox nativo foi interrompida pela ferramenta: `browser URL policy enforcement is not yet supported for the current Windows browser`. Nenhuma interação adicional no navegador foi tentada depois desse bloqueio.

Pendente: homologação em sessão real de platform admin, admin de organização e usuário comum, incluindo desktop/mobile e ambos os temas. Não há bloqueador de código conhecido nos testes executados. O site público da loja ainda precisa ser desenvolvido em tarefa própria.

## Checklist manual antes de autorizar o commit

- [ ] Com platform admin aprovado, conferir o menu **Administração → Solicitações de conta** e abrir a página por ele, no desktop e no celular.
- [ ] Com usuário comum e admin somente de organização, conferir ausência do menu e acesso negado ao digitar `/admin/solicitacoes-conta`. Sem login, conferir redirecionamento para login.
- [ ] No onboarding, digitar `Celso Assistência`, `Assistência São José` e `Tech & Cell`, verificando as sugestões; editar o campo manualmente e mudar o nome da loja, conferindo preservação da escolha.
- [ ] Em Configurações, salvar um endereço válido como owner/admin; tentar um usado por outra organização e conferir a mensagem amigável. Não alterar dados reais apenas para testar duplicidade; usar organizações de homologação.
- [ ] Como empregado, conferir leitura e ausência do formulário de edição.
- [ ] Após alterar o campo em homologação, atualizar o link/QR code do Quiosque / Tablet e conferir o novo link com token ativo.
- [ ] Conferir foco, erro, sucesso, ajuda e menu em claro/escuro e larguras 320, 375, 390 e 430 px; verificar ausência de overflow horizontal.
- [ ] Confirmar que Cidade de serviço e os outros dados continuam independentes.

O commit só deve ocorrer após confirmação de que o usuário testou e deseja fazê-lo. Reexecutar `git status`, revisar o escopo, excluir artefatos temporários e alterações alheias à tarefa, e executar `git diff --check` antes de criar o commit. Não fazer push sem autorização explícita.
