# Otimização de memória no desenvolvimento local

O perfil de pouca memória usa Webpack e limita a retenção de rotas no Next.js
16.2.9, preservando o comando de desenvolvimento normal e a configuração de
produção. O objetivo é dar mais margem ao Windows, VS Code e Firefox em uma
máquina com aproximadamente 4 GB de RAM. Isso não garante ausência de falhas de
alocação nem desempenho equivalente ao de uma máquina com mais memória.

## Como iniciar

```bash
pnpm --filter web dev:low-memory
```

No PowerShell, se a política de execução bloquear `pnpm.ps1`, use
`pnpm.cmd --filter web dev:low-memory`. Argumentos adicionais são repassados ao
Next, por exemplo `--hostname 127.0.0.1` ou `--port 3001`.

`apps/web/scripts/dev-low-memory.mjs` inicia o CLI do Next com `dev --webpack`,
define `LOW_MEMORY_DEV=1` somente no processo filho e acrescenta
`--max-old-space-size=1536` a `NODE_OPTIONS`. Opções não relacionadas são
preservadas. O script não grava variáveis no shell nem em `.env.local`.

1536 MiB é o limite do old space do V8 **por processo**, não um teto para a soma
dos processos do Next. Memória nativa, buffers, código e outras áreas do heap
consomem memória adicional. No Node 25.9.0 desta máquina, o CLI do Next sem limite
explícito usa aproximadamente metade da RAM para o old space do servidor, cerca
de 1987 MiB. O perfil reduz esse limite para reservar mais espaço ao restante do
ambiente. Um limite menor também pode aumentar a coleta de lixo ou provocar
esgotamento do heap se o projeto precisar de mais espaço.

`pnpm dev` continua chamando `next dev`, sem forçar o bundler ou o limite desse
perfil. `pnpm build` e `pnpm start` permanecem com seus comandos existentes.

## Configuração e efeitos no Next 16.2.9

O ponto de partida encontrado já continha um início deste perfil e as alterações
do termo de garantia ainda sem commit. A comparação abaixo usa os padrões do
Next para o desenvolvimento normal; `serverActions.bodySizeLimit: "5mb"`,
necessário ao upload de PDF, foi preservado.

| Opção | Desenvolvimento normal | Perfil de pouca memória | Efeito verificado no código instalado |
| --- | --- | --- | --- |
| Bundler | Padrão de `next dev`; Webpack quando informado manualmente | `--webpack` explícito | Evita usar Turbopack neste modo |
| Old space | Cerca de 1987 MiB no servidor desta máquina, salvo opção externa | 1536 MiB por processo que herda `NODE_OPTIONS` | Menor limite de heap; RSS total pode ultrapassá-lo |
| `onDemandEntries.maxInactiveAge` | 60000 ms | 25000 ms | Antecipação do descarte de entradas inativas |
| `onDemandEntries.pagesBufferLength` | 5 | 2 | Menor buffer de entradas recentes |
| `experimental.webpackMemoryOptimizations` | `false` | `true` | Aceita, mas nesta versão é consumida pelo build Webpack, não pelo servidor dev |
| `experimental.preloadEntriesOnStart` | `true` | `false` | Aceita, mas nesta versão o preload só acontece fora do modo dev |

As configurações adicionais dependem simultaneamente de
`PHASE_DEVELOPMENT_SERVER` e `LOW_MEMORY_DEV=1`. Mesmo que a variável chegue à
Vercel ou a um build, o perfil não é aplicado. Não foi adicionada função
`webpack(config)`.

`on-demand-entry-handler.js` da versão instalada trata pings do App Router e
exclui entradas antigas do buffer. Essa opção beneficia as entradas Webpack do
App Router, mas o próprio código ainda não descarta todas as entradas filhas
(`CHILD_ENTRY`). Portanto, não é uma limpeza completa de módulos ou uma garantia
de queda imediata da memória residente. Voltar a rotas inativas pode exigir nova
compilação. O buffer conta entradas internas, não necessariamente duas telas
completas.

As duas flags experimentais foram mantidas habilitada/desabilitada conforme o
pedido, com comentários sobre seu alcance real. Não devem ser tratadas como a
causa de uma redução de memória em `next dev`. Para um servidor de produção,
desabilitar preload também adiaria o trabalho da primeira visita, sem eliminar o
consumo depois de carregar todas as páginas; a produção deste projeto mantém o
padrão.

Os source maps de desenvolvimento permanecem disponíveis. Os padrões de
produção também foram preservados: não havia geração explícita de source maps
de navegador ou servidor para remover. Nenhum erro de TypeScript foi ignorado.

Referências oficiais: [memória no Next](https://nextjs.org/docs/app/guides/memory-usage),
[onDemandEntries](https://nextjs.org/docs/app/api-reference/config/next-config-js/onDemandEntries)
e [otimização de imports](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports).
A aplicação das opções foi conferida também em `next/dist/server/config-shared.js`,
`server/dev/on-demand-entry-handler.js`, `server/next-server.js`,
`build/webpack-build/impl.js` e `cli/next-dev.js` do Next 16.2.9 instalado.

## Auditoria dos imports e consultas

A causa provável da falha informada é a pressão de memória do ambiente inteiro,
somada aos grafos de compilação e módulos retidos conforme novas rotas são
visitadas. Não foi encontrado import de biblioteca de gráficos, PDF ou banco de
testes no layout que explique sozinho o problema. Uma confirmação da causa
exata exigiria um perfil de heap no momento da falha.

| Área | Resultado e decisão |
| --- | --- |
| PGlite | `@electric-sql/pglite@0.3.14` está apenas em `devDependencies` da raiz. Os imports estão em `supabase/tests/*.test.cjs`; não há referência em `apps/web/src` ou `packages/shared`. Nenhum caminho de import da aplicação leva ao PGlite. |
| Dashboard | A página e as métricas são Server Components/código de servidor. Os gráficos de ranking são HTML/CSS, sem Recharts, Chart.js ou biblioteca semelhante. Não há motivo para adicionar `next/dynamic` ou `ssr:false`. |
| Consultas do dashboard | As quatro consultas de manutenção, saídas dos períodos atual/anterior e clientes já usam `Promise.all`. Os períodos e limites foram mantidos para não alterar indicadores. Foi retirada a chamada de `requireAuth` imediatamente anterior a `requireOrganization`, que já valida sessão e aprovação. |
| Layout e navegação | O layout autenticado fica no servidor. Os clientes globais são tema e navegação; precisam de contexto/estado e `usePathname`. O menu importa links e ícones, sem importar as páginas correspondentes. Nenhum módulo administrativo completo é carregado pela sidebar. |
| Estoque | As quatro páginas usam imports diretos de helpers, navegação e formulários pertinentes. Não importam testes, PGlite ou todas as telas. `InventoryOverview` precisa de estado para filtros e o formulário usa estado/actions; foram mantidos como clientes. |
| Consultas do estoque | Retiradas as validações de Auth repetidas antes de `requireOrganization` nas duas funções de leitura e no detalhe do produto. O histórico já paraleliza leituras independentes. A paginação integral do estoque foi preservada; o detalhe mantém a consulta de abertura após confirmar a existência do produto. A mutação conserva suas verificações. |
| Configurações e garantia | Upload, visualização e compartilhamento aparecem em Configurações e no detalhe de OS. Usam APIs nativas de `File`, `Blob`, Web Share e Supabase Storage; não foi adicionada biblioteca de PDF/upload. O arquivo é preparado no clique, não globalmente. |
| Proxy | `updateSession` valida o usuário uma vez. A RPC de aprovação ocorre uma vez quando há usuário; membership só é consultada para decidir o destino em `/` e `/login`. Não havia duplicação interna clara para remover. Proxy, matcher, cookies, autenticação e RLS foram preservados. Validações entre proxy, layout e actions continuam independentes. |
| Barrels | O barrel de `packages/shared/index.ts` é pequeno e a aplicação já importa os subcaminhos de constantes diretamente. Nenhum barrel grande de telas foi encontrado. |
| Ícones | `lucide-react` já está no `optimizePackageImports` padrão do Next 16.2.9. Não foi adicionada configuração duplicada nem import interno dependente da estrutura da biblioteca. |

Não foi introduzido cache de dados, permissões, organização ou estoque. A cadeia
de proteção permanece `requireOrganization` → `getCurrentOrganization` →
`requireAuth` → sessão validada e aprovação da conta. Os testes de regressão
cobrem rejeição antes do acesso aos dados. Não houve alteração em migrations,
banco remoto, `.env.local`, funcionalidades ou apresentação visual nesta otimização.

## Dependências revisadas

| Grupo | Pacotes e uso |
| --- | --- |
| Runtime | Next, React, React DOM, Supabase SSR/JS, Zod e Lucide; todos possuem referências na aplicação |
| Pacote interno | `@assistencia/shared`, consumido por subcaminhos de constantes e tipos |
| Desenvolvimento e build | TypeScript, tipos, ESLint/configuração, Tailwind e PostCSS |
| Testes SQL | PGlite, isolado nas dependências de desenvolvimento da raiz |
| Garantia recente | Não adicionou pacote externo; reutiliza Supabase e APIs nativas |

Nenhuma dependência foi removida ou atualizada. Não foi encontrada dependência
de runtime claramente sem uso que justificasse remoção nesta mini atualização.

## Validação em 23 de novembro de 2026

Ambiente observado: Windows, Node 25.9.0, pnpm 11.8.0 e Next 16.2.9. O sistema
informou aproximadamente 3975 MiB de RAM total e 477 MiB livres na amostra
inicial. As verificações pesadas foram executadas em sequência.

| Verificação | Resultado |
| --- | --- |
| `pnpm lint` | Passou, inclusive após os novos testes |
| `pnpm typecheck` | Passou |
| `node --test --test-concurrency=1 apps/web/tests/*.test.cjs` | 126 testes passaram; inclui dashboard, estoque, autenticação, proxy, organização e garantia |
| `node --test --test-concurrency=1 supabase/tests/inventory.test.cjs supabase/tests/warranty-document.test.cjs` | 20 testes passaram em PGlite isolado; nenhum acesso ao banco remoto |
| Configuração do Next | Em processos separados, as configurações completas de build/start foram idênticas com `LOW_MEMORY_DEV=0` e `1`; dev normal conservou 60s/5 e o perfil aplicou 25s/2 e as flags esperadas |
| `pnpm build` | Falhou no Turbopack com erro Windows 1450, recursos de sistema insuficientes ao escrever artefato de `/kiosk/[slug]`. Houve também falha de inicialização de thread no ambiente. Build de produção não foi aprovado nesta execução |
| `git diff --check` | Passou |
| PGlite nos artefatos disponíveis | Nenhuma referência nos arquivos JS/JSON gerados de dev e do build parcial. Como o build falhou, não existe um novo bundle de produção completo validado |

O comando usado no teste local foi
`pnpm.cmd --filter web dev:low-memory --hostname 127.0.0.1`. O Next confirmou
Webpack, `webpackMemoryOptimizations` habilitado e `preloadEntriesOnStart`
desabilitado, sem alerta de configuração inválida. O servidor ficou pronto em
aproximadamente **2 segundos**.

As requisições HTTP do terminal não possuem sessão autenticada. Foram abertas
sequencialmente as rotas solicitadas, com os seguintes resultados:

| Rota | Resposta | Tempo aproximado |
| --- | --- | --- |
| `/dashboard` | 307 para `/login` | 2,25s na primeira passagem pelo proxy |
| `/clientes` | 307 para `/login` | 0,03s |
| `/manutencoes` | 307 para `/login` | 0,02s |
| `/estoque` | 307 para `/login` | 0,02s |
| `/estoque/movimentacoes` | 307 para `/login` | 0,03s |
| `/configuracoes` | 307 para `/login` | 0,03s |
| `/dashboard`, retorno | 307 para `/login` | 0,03s |
| `/login` | 200 | 30,2s: Next 29,4s, proxy 20ms e aplicação 790ms |
| `/dashboard`, verificação posterior | 307 para `/login` | 0,38s |
| `/login`, retorno | 200 | 0,15s |

O servidor permaneceu vivo durante esse teste, sem `ERR_MEMORY_ALLOCATION_FAILED`
ou `RangeError` de alocação no modo low-memory. As respostas 307 validam a
proteção e a continuidade do processo, **não a compilação ou navegação das
páginas autenticadas**. O controle de Firefox pela ferramenta foi interrompido
por falta de suporte à política de URLs nesse navegador Windows, e o usuário
informou que fará o teste autenticado depois. Fast Refresh no navegador também
permanece pendente de verificação.

Depois da primeira compilação de login, o processo principal do servidor chegou
a aproximadamente **641 MiB de working set** e **1621 MiB de memória privada
comprometida**. Em amostra posterior, após os retornos e um intervalo ocioso,
foram aproximadamente **241 MiB residentes** e **760 MiB privados comprometidos**.
São amostras pontuais do processo principal, não um pico medido nem a soma de
todos os processos. A memória comprometida pode incluir páginas fora da RAM.

O tempo anterior fornecido foi `/dashboard` 200 em 27,2s, dos quais Next 19s,
proxy 2,1s e aplicação 6,1s. Não há medição posterior equivalente de dashboard
autenticado; portanto, não se atribui ganho percentual nem se compara esse tempo
ao login ou aos redirecionamentos. Não foi necessário elevar o limite para
1792 MiB no teste executado, mas 1536 MiB ainda precisa ser validado com as
páginas internas efetivamente compiladas.

## Próxima validação local e homologação

No navegador autenticado, abrir `/dashboard` → `/clientes` → `/manutencoes` →
`/estoque` → `/estoque/movimentacoes` → `/configuracoes` → `/dashboard`.
Conferir renderização, tempo da primeira compilação, continuidade do processo e
Fast Refresh durante a edição normal de um componente. Se ocorrer esgotamento
do heap, reavaliar o limite de 1536 MiB antes de considerar 1792 MiB; isso não
altera o fato de que o total do ambiente pode exceder a RAM disponível.

A homologação local do termo de garantia pode continuar: os testes de upload,
download, compartilhamento, papéis e isolamento passaram. A navegação completa
em 4 GB e o build de produção continuam pendentes. Não há novo resultado de
CI/Vercel verificado para substituir o build local que falhou. A alteração não
inclui deploy, commit ou push; o commit aguarda a confirmação solicitada após o
teste no PC do usuário.
