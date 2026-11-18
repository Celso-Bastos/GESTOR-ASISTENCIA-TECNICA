# Tema global claro e escuro

## Escopo e arquitetura

Atualização exclusivamente de apresentação e preferência do navegador. A auditoria inicial encontrou Tailwind 4, duas variáveis globais de cor e cores de apresentação diretamente nas classes. Não havia provider, `next-themes`, variante escura em uso ou preferência persistida. Foi adotado um provider pequeno, próprio, sem dependências novas.

- `lib/theme.ts` concentra leitura, aplicação, persistência, eventos e bootstrap.
- `ThemeProvider` está no layout raiz, abrangendo telas públicas e autenticadas.
- A classe `dark` no elemento `html` seleciona os tokens. O padrão é claro, inclusive quando o sistema operacional usa tema escuro.
- Chave local: `assistencia-theme`; valores aceitos: `light` e `dark`. Valor inválido ou ausente resulta em claro. Não há cookie, consulta ao Supabase ou preferência por conta.
- O script estático no `head` aplica a preferência antes da pintura, sem esperar o React. Não interpola conteúdo do armazenamento em código ou HTML.
- `useSyncExternalStore` usa um snapshot claro estável no servidor e na primeira hidratação. Depois atualiza o ícone conforme a classe atual. `suppressHydrationWarning` fica somente no `html`, cuja classe é alterada pelo bootstrap.
- A troca atualiza a classe imediatamente. Eventos sincronizam o provider e outras abas da mesma origem. Remover a chave ou limpar o armazenamento restaura o claro nas outras abas.
- Se o navegador bloquear armazenamento, a troca continua funcionando na página atual; persistência após recarregar depende da disponibilidade do armazenamento.

## Controle e acessibilidade

Botão compacto de 44 × 44 px com sol/lua, rótulo de ação, `aria-pressed`, texto de estado para leitores de tela e foco visível. É um `button` nativo, com suporte nativo a Enter e Espaço.

Localização: topbar do painel, ao lado do menu mobile e saída; cabeçalho das telas públicas de login/cadastro/aguardando/definição de senha; cabeçalho da administração de solicitações. O quiosque herda a paleta global sem introduzir novos controles no fluxo de autoatendimento.

O grupo de controles do painel não encolhe, e o título permite truncamento em larguras pequenas. O menu mobile conserva as dimensões e o comportamento existentes.

## Paleta e componentes

Os tokens de `globals.css` centralizam fundos, superfícies, textos, bordas, foco, ações neutras e estados semânticos. As cores claras reutilizam os valores originais do Tailwind. O escuro usa fundo azul acinzentado, cards mais claros, campos próprios e texto suave de alto contraste. Ações sólidas teal/emerald mantêm a identidade e o texto branco. Ações neutras recebem contraste próprio no escuro.

Foram adequados cards, tabelas, divisórias, hover, sidebar, topbar, menus `details`, badges, alertas, formulários e estados vazios/erro/carregamento. Texto, telefone, data, número, moeda, select, textarea, checkbox e radio usam a paleta correspondente. `color-scheme` também sinaliza o tema aos controles nativos. Não há modal customizado nesta versão; confirmações nativas continuam sob controle do navegador. O gráfico de barras mantém teal, com trilha adaptada.

Endereço, aniversário, Maps, cidade de serviço, preços estimado/final, garantias, status e cálculos conservam seus contratos. A alteração de classe no Maps afeta apenas a aparência do link externo.

## Cobertura da revisão de código

| Área | Rotas e componentes revisados |
| --- | --- |
| Acesso público | `/login`, `/criar-conta`, `/criar-conta/aguardando`, `/auth/definir-senha` |
| Organização | `/onboarding/organizacao`, `/configuracoes`, cidade de serviço |
| Painel | `/dashboard`, indicadores, períodos, filtros, barras e estados vazios/erro |
| Clientes | `/clientes`, `/clientes/novo`, `/clientes/[id]`, `/clientes/[id]/editar`, tabelas, endereço, aniversário, Maps e histórico |
| Manutenções | `/manutencoes`, `/manutencoes/nova`, `/manutencoes/rapida`, `/manutencoes/[id]`, `/manutencoes/[id]/editar`, filtros, status, timeline e formulários |
| Mensagens | `/mensagens`, modelos, edição e controles WhatsApp |
| Vendas e produtos | `/saidas`, `/saidas/nova`, `/saidas/modelos`, categorias, filtros e tabelas |
| Reposição | `/relatorios/reposicao`, tabela e cópia da lista |
| Administração | `/admin/solicitacoes-conta`, filtros, cards e revisão |
| Quiosque | `/configuracoes/quiosque`, `/kiosk/[slug]`, criação de token e formulário |

Esta tabela registra revisão de código e cobertura dos tokens; não representa navegação visual autenticada.

## Arquivos desta atualização

Criados:

- `apps/web/src/lib/theme.ts`
- `apps/web/src/components/theme-provider.tsx`
- `apps/web/src/components/theme-toggle.tsx`
- `apps/web/src/components/public-theme-shell.tsx`
- `apps/web/src/app/(auth)/layout.tsx`
- `apps/web/src/app/auth/layout.tsx`
- `apps/web/tests/theme.test.cjs`
- `docs/planejamento/tema-claro-escuro.md`

Alterados: layout raiz, `globals.css`, layout do painel, páginas e componentes de apresentação das áreas listadas acima; `apps/web/package.json` (script `test:theme`); harnesses `fase-14a2.test.cjs` e `service-city.test.cjs` (mock explícito do controle visual nos testes isolados do admin). O teste de tema utiliza o provider e o controle reais.

O workspace já continha alterações de funcionalidades anteriores. Elas foram preservadas. Não houve nova dependência, alteração de lockfile, `.env.local`, banco, migrations, autenticação, actions ou regras de negócio nesta atualização. Não foi feito commit nem push.

## Verificação automatizada

O teste de tema cobre bootstrap antes da pintura, padrão claro, preferência inválida, persistência, alternância nos dois sentidos, armazenamento bloqueado, sincronização entre abas, limpeza de listeners, presença do provider no layout raiz, renderização SSR estável com preferência escura, rótulos/estado do botão e contraste AA dos pares principais do tema escuro. Não simula um navegador nem substitui a inspeção do console durante hidratação real.

Os testes existentes exercitam clientes, Maps/cidade de serviço, manutenção rápida/preços/entrega, dashboard, vendas, mensagens e controle de acesso com fronteiras externas simuladas; nenhum grava no banco real.

Resultados finais dos comandos e da conferência de integridade estão registrados ao final deste documento.

## Conferência visual pendente

A automação de navegador informou `The browser access host is unavailable`. A tentativa pelo Firefox nativo retornou `Computer Use app approval timed out`. Assim, não foi possível obter capturas nem verificar visualmente desktop ou as larguras **320, 375, 390 e 430 px**. Isso não é um resultado aprovado de mobile. Não foram utilizadas credenciais nem contornadas restrições de autenticação.

Checklist de homologação em navegador, para ambos os temas:

- [ ] Login, criar conta e aguardando: legibilidade, foco e botão acessível.
- [ ] Dashboard: indicadores, valores, auxiliares, gráfico, filtros e estados vazios/erro.
- [ ] Clientes: listagem, cadastro, detalhe e edição; data, endereço e Maps.
- [ ] Manutenções: normal, rápida, detalhe e edição; valores estimado/final, garantia e todos os status.
- [ ] Mensagens, vendas, modelos, reposição, configurações, quiosque e administração.
- [ ] Inputs de texto, telefone, data, número/moeda; select, textarea, checkbox; menus e tabelas com scroll.
- [ ] Claro → escuro → claro por clique, Enter e Espaço, com foco visível.
- [ ] Recarregar diretamente em escuro e observar primeira pintura e console, sem aviso de hidratação.
- [ ] Navegar entre rotas, sair/entrar e fechar/reabrir navegador: escolha preservada.
- [ ] Segunda aba acompanha a escolha; armazenamento bloqueado não interrompe a página.
- [ ] 320 px: controle visível, header sem overflow, título acomodado e menu utilizável.
- [ ] 375 px: mesmos critérios.
- [ ] 390 px: mesmos critérios.
- [ ] 430 px: mesmos critérios.

O recurso pode seguir para homologação com os resultados automatizados registrados; a aprovação visual e mobile depende da execução deste checklist.

## Resultados finais — 17/11/2026

| Verificação | Resultado |
| --- | --- |
| `node --test --test-concurrency=1 tests/*.test.cjs` em `apps/web` | 70 testes aprovados, nenhum ignorado |
| `pnpm --filter web test:theme` após ajustes finais de apresentação | 6 testes aprovados |
| `pnpm lint` | Aprovado; primeira tentativa interrompida por falta de memória, repetição com heap limitado aprovada |
| `pnpm typecheck` | Aprovado |
| `pnpm build` | Aprovado com Turbopack; compilação, TypeScript, geração e otimização concluídos |
| Artefatos de produção | Todos os tokens semânticos e as cores claras referenciadas permanecem no CSS; páginas públicas geradas contêm bootstrap no head e controle de tema |
| `git diff --check` | Aprovado |
| Inspeção visual e console de hidratação em navegador | Pendente pelo bloqueio da ferramenta descrito acima |
| Mobile 320/375/390/430 px | Revisão estrutural realizada; validação visual pendente |

Para reduzir o consumo de memória, lint e typecheck foram executados com `NODE_OPTIONS=--max-old-space-size=384 --max-semi-space-size=4`, e o build com heap de 512 MB e o mesmo limite de semi-space. Essas opções foram aplicadas somente aos processos de verificação; não alteram os scripts nem arquivos de ambiente do projeto.

Tema claro: mantém a paleta original através dos tokens, confirmados também no CSS de produção. Tema escuro: tokens aplicados às áreas revisadas e contraste dos pares principais aprovado nos testes. A aparência final de ambos aguarda conferência em navegador. A estabilidade SSR foi testada; o console de hidratação real integra o checklist pendente.


## Inventário dos arquivos de apresentação adequados

Além dos layouts e arquivos novos listados anteriormente, receberam tokens de cor:

- `apps/web/src/app/(auth)/criar-conta/aguardando/page.tsx`
- `apps/web/src/app/(auth)/criar-conta/page.tsx`
- `apps/web/src/app/(auth)/criar-conta/request-form.tsx`
- `apps/web/src/app/(auth)/login/login-form.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(dashboard)/clientes/confirm-delete-button.tsx`
- `apps/web/src/app/(dashboard)/clientes/customer-form.tsx`
- `apps/web/src/app/(dashboard)/clientes/customer-search.tsx`
- `apps/web/src/app/(dashboard)/clientes/customer-table.tsx`
- `apps/web/src/app/(dashboard)/clientes/empty-state.tsx`
- `apps/web/src/app/(dashboard)/clientes/loading.tsx`
- `apps/web/src/app/(dashboard)/clientes/novo/page.tsx`
- `apps/web/src/app/(dashboard)/clientes/page.tsx`
- `apps/web/src/app/(dashboard)/clientes/[id]/editar/page.tsx`
- `apps/web/src/app/(dashboard)/clientes/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/page.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/quiosque/create-token-form.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/quiosque/page.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/quiosque/token-actions.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/service-city-form.tsx`
- `apps/web/src/app/(dashboard)/dashboard/alert-maintenance-list.tsx`
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- `apps/web/src/app/(dashboard)/layout.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/customer-select.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/delete-maintenance-button.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/device-form-fields.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-filters.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-form.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-status-badge.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-status-controls.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-table.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-timeline.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/nova/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/rapida/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/rapida/quick-maintenance-form.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/[id]/editar/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/mensagens/custom-message-template-manager.tsx`
- `apps/web/src/app/(dashboard)/mensagens/custom-whatsapp-message-form.tsx`
- `apps/web/src/app/(dashboard)/mensagens/message-template-form.tsx`
- `apps/web/src/app/(dashboard)/mensagens/page.tsx`
- `apps/web/src/app/(dashboard)/mensagens/whatsapp-button.tsx`
- `apps/web/src/app/(dashboard)/mensagens/whatsapp-controls.tsx`
- `apps/web/src/app/(dashboard)/onboarding/organizacao/organization-form.tsx`
- `apps/web/src/app/(dashboard)/onboarding/organizacao/page.tsx`
- `apps/web/src/app/(dashboard)/relatorios/reposicao/copy-restock-list-button.tsx`
- `apps/web/src/app/(dashboard)/relatorios/reposicao/page.tsx`
- `apps/web/src/app/(dashboard)/relatorios/reposicao/restock-report-table.tsx`
- `apps/web/src/app/(dashboard)/saidas/modelos/page.tsx`
- `apps/web/src/app/(dashboard)/saidas/nova/page.tsx`
- `apps/web/src/app/(dashboard)/saidas/page.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-action-button.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-category-badge.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-model-template-manager.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-outflow-filters.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-outflow-form.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-outflow-table.tsx`
- `apps/web/src/app/admin/solicitacoes-conta/page.tsx`
- `apps/web/src/app/admin/solicitacoes-conta/review-form.tsx`
- `apps/web/src/app/auth/definir-senha/page.tsx`
- `apps/web/src/app/auth/definir-senha/password-form.tsx`
- `apps/web/src/app/kiosk/[slug]/kiosk-form.tsx`
- `apps/web/src/app/kiosk/[slug]/page.tsx`
