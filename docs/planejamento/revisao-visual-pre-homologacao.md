# Revisão de estilo e consistência antes da homologação

Data: 18/11/2026. Escopo: apresentação, responsividade e acessibilidade do projeto existente. Foram preservadas as alterações anteriores do workspace. Não houve redesenho, nova identidade, alteração de regras de negócio, Auth, actions, Supabase, migrations ou `.env.local`. Não houve commit ou push.

## Método e limite da revisão

Foi feita leitura dos estilos globais, configuração do Tailwind/PostCSS, layouts, componentes compartilhados e implementações de formulários, listagens, detalhes, estados e controles nas áreas abaixo. Um inventário de classes confirmou o padrão predominante: `rounded-md`, `shadow-sm`, textos `text-sm`, `gap-2` nos campos e controles `h-11`/`h-12`.

A conferência visual foi tentada com a habilidade de computer-use. O inventário retornou `The browser access host is unavailable`; ao selecionar o Firefox, a ferramenta encerrou a sessão com: `browser URL policy enforcement is not yet supported for the current Windows browser`. Nenhuma ação posterior de UI foi executada. Não foi possível obter screenshots, navegar autenticado ou aprovar aparência/overflow por observação real.

As conclusões abaixo distinguem evidência de código e testes de uma validação visual em navegador. Não houve tentativa de contornar a restrição da ferramenta ou a autenticação da aplicação.

## Design System identificado e preservado

| Elemento | Padrão real |
| --- | --- |
| Tecnologia | Tailwind 4 via PostCSS e tokens em `globals.css`; sem framework adicional de UI |
| Tema | Provider global próprio, classe `dark` no `html`, preferência local `assistencia-theme`, claro como padrão |
| Fundo | `--background`: claro `#f8fafc`, escuro `#0c1422`; `bg-canvas` nos espaços do painel |
| Superfície | `bg-surface`: branco no claro, `#131f30` no escuro; `surface-muted` e `surface-strong` para hover/trilhas/skeleton |
| Texto | `foreground` principal; `body` para conteúdo/labels; `muted` e `subtle` para apoio; sem trocar a família Arial/Helvetica |
| Ação principal | Teal 700 com texto branco; hover teal 800. WhatsApp conserva emerald; ações neutras usam os tokens existentes |
| Semântica | Sucesso emerald, perigo red, atenção amber, informativo sky; manutenção também usa indigo/orange e neutro para distinguir status |
| Bordas | `border-line`, `border-line-strong`, tokens de estados; padrão de 1 px |
| Raio e sombra | `rounded-md` e `shadow-sm`; `rounded-lg` em alguns cards públicos existentes não foi tratado como defeito |
| Tipografia | Página: `text-2xl font-semibold`; seção: `text-lg`/`text-xl` conforme hierarquia; label: `text-sm font-medium`; controles: `text-base` no mobile; apoio: `text-xs`/`text-sm` |
| Espaçamento | Label/controle: `gap-2`; grupos: `gap-4`; formulários operacionais: `gap-5`; seções: `gap-6`; cards: `p-4`, frequentemente `sm:p-5` |
| Alturas | 44 px em auth/filtros/header; 48 px em formulários operacionais; 36 px em ações compactas desktop; quiosque tem controles maiores por contexto |
| Botão secundário | Superfície neutra, borda forte e texto `body`; hover `surface-muted` |
| Destrutivo | Borda/texto danger com hover suave; preserva o mesmo padrão de excluir/rejeitar/cancelar |
| Ícones | Lucide, usualmente 16 px em ações e 20 px no tema/menu; sem nova biblioteca ou alteração de stroke |
| Tabelas | Cabeçalho suave, texto pequeno, `px-4 py-3`, divisórias `line`; cards alternativos abaixo de `md` nas listagens principais |
| Estados | Alertas leves com borda e cor semântica; vazio com orientação textual; envio com botão desabilitado e rótulo existente |

As variações de espaçamento/altura com motivo de contexto foram mantidas. Não foi criada uma segunda paleta ou uma abstração geral de componentes para substituir a aplicação nesta fase.

## Achados e tratamento

P0 significa quebra grave; P1, inconsistência importante/usabilidade; P2, consistência simples e segura; P3, cosmético. Não foi identificado P0 por leitura de código. Isso não substitui a inspeção visual pendente.

| ID | Nível | Evidência e impacto | Tratamento |
| --- | --- | --- | --- |
| V01 | P1 | Menu mobile usava `right-0` relativo ao `details`, antes do botão Sair. Sua largura próxima à viewport podia deslocar a borda esquerda para fora da tela em 320/375 px | Grupo de controles passou a ser o bloco relativo; menu alinha à borda direita do grupo completo |
| V02 | P1 | No mobile o texto Sair tinha `display:none`, com ícone oculto da árvore acessível e nenhum nome alternativo | `aria-label="Sair do sistema"` e largura mínima de 44 px |
| V03 | P1 | Foco de teclado dependia de classes locais; vários controles não tinham o tratamento equivalente aos demais | Regra central de `:focus-visible` com contorno de 2 px e offset, preservando os rings existentes |
| V04 | P1 | Campos/fieldsets nativos sem limites de largura podiam impor largura intrínseca maior que cards estreitos | Base CSS limita largura de controles, permite encolhimento e remove o mínimo intrínseco de form/label/fieldset; checkbox/radio/hidden preservados |
| V05 | P1 | Filtros de produtos combinavam duas trilhas de mínimo 14 rem dentro de header em linha a partir de `sm`; mensagens tinham coluna lateral fixa já em 1024 px, junto à sidebar | Header de produtos em coluna até `xl`, filtros flexíveis; coluna lateral de mensagens adiada para `xl`, com trilha principal `minmax(0,1fr)` |
| V06 | P1 | Erros equivalentes apareciam visualmente, mas vários não tinham anúncio de erro; mensagens compartilhadas de sucesso também não tinham role | `role=alert`/`status` nos retornos existentes, sem alterar conteúdo ou decisões de erro |
| V07 | P2 | Sidebar não indicava item ativo e repetia a apresentação do menu mobile | Componente pequeno compartilhado com tokens existentes e `aria-current`; subrota mais específica evita dois itens ativos; sidebar pode rolar verticalmente |
| V08 | P2 | Cidade de serviço em configurações não declarava a mesma superfície/cor de texto/transição dos campos de onboarding/cadastro | Campo alinhado aos tokens e ao padrão de 44 px; espaçamento de grupo 16 px e cursor disabled consistente |
| V09 | P2 | Ajuda longa do valor final vinha antes do campo, desalinhando a sequência label/input em relação ao estimado | Ajuda após o input, associada por `aria-describedby`; labels começam no topo do grupo |
| V10 | P2 | Voltar/Editar do detalhe de cliente e Copiar/Desativar do quiosque mantinham 36 px também no mobile | 44 px no mobile, preservando o tamanho compacto desktop |
| V11 | P2 | Nomes/notas/descrições extensas podiam ultrapassar detalhes e timeline | Quebra de palavras e `min-w-0` nos pontos de conteúdo variável; trilha principal do detalhe da OS permite encolhimento |
| V12 | P2 | Filtros de saídas dividiam cinco controles já em 1024 px, quando a sidebar reduz a área útil | Cinco colunas somente a partir de `xl`; duas colunas intermediárias mantidas |
| V13 | P2 | Alternativas de WhatsApp/cópia manual usavam estilos incompletos de borda, fundo, raio e hover | Reutilização dos tokens e do mesmo padrão de controle; links, cópia e conteúdo preservados |
| V14 | P2 | Hover das linhas de tabela era inconsistente; estado de envio não era informado em alguns formulários principais | Hover suave central e `aria-busy` reutilizando os estados pending existentes |
| C01 | P3 | Parte da UI antiga usa português sem acentos e marcadores como “Fase 3”/“Fase 10” | Apenas relatado; não foi feita revisão editorial |
| C02 | P3 | Estados vazios têm variações justificadas de densidade/alinhamento; cards públicos usam por vezes raio maior | Apenas relatado; nenhuma uniformização mecânica |
| C03 | P3 | Status de solicitações de conta aparece como texto no detalhe do card, enquanto a seleção de filtro usa botão destacado | Apenas relatado; o texto identifica o estado e não introduz cor contraditória. Um badge futuro pode ser avaliado sem urgência |

Os achados de largura são estruturais; as correções ainda precisam da verificação visual nos breakpoints. Nenhum P3 foi aplicado como redesign.

## Novidades recentes e fluxos específicos

- **Clientes:** endereço e aniversário mantêm os mesmos tokens, labels, foco e alturas dos demais campos; textarea permite endereço completo. O detalhe aceita quebra de palavras. Nome, telefone, consentimento e notas preservam seus comportamentos. Listagem conserva cards mobile e tabela desktop.
- **Maps:** o componente compartilhado já é uma ação auxiliar com borda, texto accent, ícone MapPin, alvo mínimo de 44 px e abertura externa identificada. Mantido abaixo do endereço no formulário/detalhe. Não mudou URL, helper, cidade ou condição de exibição.
- **Criar conta:** o campo cidade usa exatamente a mesma constante `inputClass` dos demais campos. Senha/confirmar/toggle, limpeza das credenciais, pending e aprovação não foram alterados. Foco central também cobre o controle de senha.
- **Onboarding/configurações:** cidade corrigida visualmente, sem misturar preferência local de tema com dado da organização. A escolha de tema continua no header, sem persistência na empresa.
- **Manutenção rápida:** modelo → defeito → estimado seguem na seção Atendimento; cliente segue opcional e formulário mantém sua estrutura. Não foi expandido com dados da manutenção normal. Erro e envio ficaram identificados semanticamente.
- **Manutenção completa:** estimado e final conservam labels distintos; ajuda do final foi alinhada à sequência dos campos. Status, diagnóstico, previsão e garantia mantêm os grupos existentes. Nenhuma fórmula ou fallback de preço mudou.
- **Status:** manutenção usa um único `MaintenanceStatusBadge` nos pontos revisados; garantia usa tokens semânticos coerentes; aprovado/rejeitado/pendente seguem identificados por texto e filtros. Não foram alterados valores ou transições.
- **Dashboard:** preservados cards, filtros, valores, barras teal e grupos de indicadores. Trilhas e skeleton usam tokens de superfície. Hover de tabela recebe o padrão global; nenhuma consulta, período ou cálculo foi alterado.
- **Modais e tooltips:** não há modal customizado neste escopo. As confirmações existentes são `confirm()` nativos; atributos `title` são controlados pelo navegador. Nenhum dialog novo foi introduzido.
- **Loading:** botões já usam pending/disabled; isso foi preservado. Adicionados anúncios sem criar arquitetura de submissão. Nenhuma chamada a `alert()` foi encontrada na apresentação auditada.

## Páginas e áreas revisadas pelo código

| Área | Cobertura |
| --- | --- |
| Públicas | `/login`, `/criar-conta`, `/criar-conta/aguardando`, `/auth/definir-senha` |
| Organização | `/onboarding/organizacao`, `/configuracoes`, `/configuracoes/quiosque` |
| Painel | `/dashboard`, header, sidebar, menu mobile, tema, indicadores, filtros, barras, alertas |
| Clientes | `/clientes`, `/clientes/novo`, `/clientes/[id]`, `/clientes/[id]/editar`, formulário, tabela/cards, loading, vazio, Maps |
| Manutenções | Listagem, normal, rápida, detalhe, edição, aparelho, cliente, preços, status, garantia, timeline e mensagens |
| Mensagens | `/mensagens`, modelos padrão/personalizados, filtros, prévias, variáveis e alternativas WhatsApp |
| Produtos/saídas | `/saidas`, `/saidas/nova`, `/saidas/[id]/editar`, `/saidas/modelos`, filtros, categorias, formulários e tabelas |
| Reposição | `/relatorios/reposicao`, filtros, resumo, tabela/cards e cópia |
| Administração | `/admin/solicitacoes-conta`, filtros, cards, aprovação/rejeição e estados de retorno |
| Quiosque público | `/kiosk/[slug]`, controles maiores e paleta herdada do tema |

## Desktop, mobile e temas

| Largura | Resultado estrutural | Validação visual |
| --- | --- | --- |
| 320 px | Campos podem encolher; menu alinha à direita do grupo completo; alvos principais de 44 px | Pendente |
| 375 px | Mesmas correções de header/menu; cards mobile e formulários em coluna preservados | Pendente |
| 390 px | Mesmos critérios; Maps continua auxiliar abaixo do endereço | Pendente |
| 430 px | Mesmos critérios, sem introduzir tabela desktop no lugar dos cards | Pendente |
| 768 px | Grids existentes preservados; filtros de produtos cabem em duas trilhas flexíveis | Pendente |
| 1024 px | Sidebar com rolagem; mensagens em coluna; filtros de saídas permanecem em duas colunas | Pendente |
| 1440 px | Colunas laterais e filtros amplos habilitados; hierarquia desktop preservada | Pendente |

**Claro:** paleta original mantida; cidade em configurações passa a declarar a mesma superfície branca e texto dos demais campos. **Escuro:** nenhuma paleta paralela; novas correções usam somente tokens existentes. O fallback de cópia manual também passou a usar bordas/superfície corretas. Contraste dos pares principais permanece coberto pelo teste de tema. Nenhum dos temas foi aprovado por screenshot nesta revisão.

## Verificações e integridade

| Verificação | Resultado |
| --- | --- |
| `node --test --test-concurrency=1 tests/*.test.cjs` em `apps/web` | 73 aprovados; 0 falhas, 0 ignorados |
| Novos testes de apresentação | 3 aprovados: item ativo único nas subrotas/desktop/mobile, nome acessível da saída e preservação dos controles, erro/envio/disabled dos formulários |
| Regressões existentes | Clientes/endereço/aniversário, Maps/cidade, preço estimado/final, manutenção rápida, garantia, vendas, dashboard, mensagens, contas/autorização e tema aprovados |
| `pnpm lint` | Aprovado |
| `pnpm typecheck` | Aprovado |
| `pnpm build` | Aprovado com Turbopack; compilação, TypeScript, geração e otimização concluídos |
| `git diff --check` | Aprovado |
| Integridade | 66 arquivos protegidos com SHA-256 idêntico ao início da revisão: TypeScript de regras/infraestrutura, SQL, `.env.local` e lockfile |
| Paleta | Blocos `:root` e `.dark` idênticos ao estado inicial |
| CSS de produção | Contém foco compartilhado, limites de tamanho dos controles e hover de tabela |
| Conferência visual/teclado real | Não executada: sessão encerrada pela ferramenta de navegador conforme limite descrito acima |

A comparação usou cópia do estado inicial desta revisão, evitando atribuir alterações de trabalhos anteriores a este pedido. O build normalizou automaticamente a referência aos tipos de rotas em `next-env.d.ts`, de `.next/dev/types` para `.next/types`; esse arquivo gerado não foi editado manualmente e foi separado dos 66 arquivos protegidos. Nenhuma dependência ou script do projeto foi alterado.

Os comandos foram executados sequencialmente, com limite de memória somente no processo: heap de 384 MB e semi-space de 4 MB para testes/lint/typecheck; heap de 512 MB e semi-space de 4 MB para build. Não foram alterados os arquivos de ambiente. Os testes usam dados simulados e não gravam em banco real. Não foram criados testes baseados em centenas de classes CSS; os novos testes verificam comportamento/semântica dos componentes.

## Pendências para homologação

- Conferência visual real em claro e escuro nas sete larguras, com foco em header/menu aberto, endereço/Maps, cadastro, rápida, manutenção completa, mensagens e produtos.
- Teclado: percorrer links, menu, tema, inputs e ações; conferir contorno, nomes e anúncios de erro/sucesso com leitor de tela.
- Dados extensos: nome, endereço, notas, modelo e valores; conferir quebras e scroll interno das tabelas no desktop.
- Verificar reload/navegação/logout/login no tema escolhido e console de hidratação. Os testes de SSR/persistência não substituem esse passo em navegador.
- Itens P3 C01–C03 são opcionais e não foram promovidos a bloqueadores nesta revisão.

Não foi identificado bloqueador visual remanescente por inspeção de código. Há, porém, **uma limitação para a aprovação final: a validação visual desktop/mobile não pôde ser executada pela ferramenta**. O código pode seguir para homologação após as verificações automatizadas; a aparência e ausência de overflow devem ser aprovadas no ambiente de homologação.


## Arquivos desta revisão

Criados:

- `apps/web/src/components/dashboard-navigation.tsx`
- `apps/web/tests/presentation.test.cjs`
- `docs/planejamento/revisao-visual-pre-homologacao.md`

Alterados em relação ao estado inicial desta revisão:

- `apps/web/src/app/(auth)/login/login-form.tsx`
- `apps/web/src/app/(dashboard)/clientes/confirm-delete-button.tsx`
- `apps/web/src/app/(dashboard)/clientes/customer-form.tsx`
- `apps/web/src/app/(dashboard)/clientes/page.tsx`
- `apps/web/src/app/(dashboard)/clientes/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/page.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/quiosque/create-token-form.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/quiosque/token-actions.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/service-city-form.tsx`
- `apps/web/src/app/(dashboard)/layout.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/delete-maintenance-button.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-form.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-status-controls.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-timeline.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/rapida/quick-maintenance-form.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/mensagens/custom-message-template-manager.tsx`
- `apps/web/src/app/(dashboard)/mensagens/custom-whatsapp-message-form.tsx`
- `apps/web/src/app/(dashboard)/mensagens/message-template-form.tsx`
- `apps/web/src/app/(dashboard)/mensagens/page.tsx`
- `apps/web/src/app/(dashboard)/mensagens/whatsapp-button.tsx`
- `apps/web/src/app/(dashboard)/mensagens/whatsapp-controls.tsx`
- `apps/web/src/app/(dashboard)/onboarding/organizacao/organization-form.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-action-button.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-model-template-manager.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-outflow-filters.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-outflow-form.tsx`
- `apps/web/src/app/globals.css`
