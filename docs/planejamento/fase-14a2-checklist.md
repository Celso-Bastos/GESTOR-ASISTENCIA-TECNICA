# Fase 14A.2 — Checklist do piloto

## Decisão de escopo

“Resend e notificações de e-mail personalizadas foram retiradas do escopo do piloto. O acompanhamento de solicitações será realizado pelo painel administrativo. A integração poderá ser reavaliada após validação com cliente.”

Não há novo serviço de e-mail. SMTP, templates, convites legados e demais comportamentos existentes do Supabase Auth permanecem preservados. Ausência de e-mail personalizado não bloqueia cadastro, revisão ou homologação.

## Implementação local

- [x] Cadastro com nome/e-mail, telefone/assistência opcionais, senha e confirmação.
- [x] Zod valida 8 a 128 caracteres e igualdade; toggle acessível; limpeza dos campos ao enviar.
- [x] Credencial entregue somente ao Supabase Auth; nenhuma tabela pública, metadata, log ou action state armazena senha.
- [x] Auth criado via servidor com account_status pending e pedido pending associado ao UUID.
- [x] Duplicidades não criam outro usuário nem substituem credenciais.
- [x] Compensação de falhas e diagnóstico seguro de estados inconsistentes preservados.
- [x] Proteção de login, proxy, layout, helpers e onboarding bloqueia pending/rejected no servidor.
- [x] Pending mostra Sua conta está aguardando aprovação.
- [x] Rejected mostra Sua solicitação de acesso não foi aprovada.
- [x] Somente platform_admins podem listar e revisar pedidos; auditoria usa a sessão real.
- [x] Painel oferece filtros Pendentes/Aprovadas/Rejeitadas e decisões para pedidos pending.
- [x] Aprovação atualiza usuário existente, confirma/libera conforme fluxo atual, grava auditoria e dispensa envio de e-mail.
- [x] Rejeição mantém Auth com metadata rejected e preserva motivo/histórico.
- [x] Login aprovado usa a mesma credencial; sem organização vai ao onboarding e depois dashboard.
- [x] Tela de aguardando orienta contato com o responsável e não promete e-mail.
- [x] Helpers, action e formulário exclusivos de Resend foram removidos.
- [x] Painel não mostra envio pendente nem botão de reenvio de e-mail.
- [x] Variáveis Resend removidas de .env.example; NEXT_PUBLIC_APP_URL preservada.
- [x] Migrations 0012 e 0013 preservadas; nenhuma nova migration necessária.
- [x] 0013 revisada: sem dependência operacional de Resend; timestamp de aviso permanece sem uso por compatibilidade.

## Checks locais desta revisão

Usar pnpm.cmd no PowerShell quando pnpm.ps1 estiver bloqueado pela política existente. Não alterar a política do Windows.

| Comando | Resultado |
| --- | --- |
| pnpm.cmd lint | A verificar |
| pnpm.cmd typecheck | A verificar |
| pnpm.cmd build | A verificar; variáveis de e-mail vazias somente no processo |
| pnpm.cmd --filter web test:14a2 | 27 testes passaram |

O teste sem variáveis remove RESEND_API_KEY, EMAIL_FROM e ACCOUNT_APPROVER_EMAIL apenas do processo e restaura o estado ao terminar. Nenhuma chamada fetch de envio é permitida. Ele cobre cadastro, duplicidades, aprovação, login/onboarding com a mesma credencial e rejeição. O painel também é renderizado nos três filtros e a tela aguardando é conferida. Esses testes usam o código real com fronteiras externas simuladas; não substituem homologação com Supabase real.

Os testes SQL existentes usam PostgreSQL descartável via PGlite, sem ler .env ou conectar remotamente:

```powershell
$env:PGLITE_TEST_MODULE = "$env:TEMP\assistencia-14a-sql-validation\node_modules\@electric-sql\pglite"
node --test supabase/tests/account-requests.test.cjs
```

A senha pode ser inspecionada pelo usuário no payload original da requisição no DevTools Network. A aplicação não a retorna na resposta/estado, limpa os inputs e não a persiste em storage próprio ou logs. Não registrar credenciais nas evidências de teste.

## Homologação integrada pendente

Usar contas descartáveis sob seu controle e a conexão Supabase existente. Não rejeitar contas reais de operação.

| Teste | Passos | Esperado |
| --- | --- | --- |
| 1 — Cadastro | /criar-conta com e-mail novo e confirmação válida | Auth criado com metadata pending; account_request pending com auth_user_id; tela aguardando |
| 2 — Login pending | Entrar antes da aprovação e abrir rotas internas diretamente | Sua conta está aguardando aprovação; nenhum acesso interno |
| 3 — Painel admin | Login de platform admin; abrir /admin/solicitacoes-conta | Pedido aparece em Pendentes com nome, e-mail, opcionais, data, status e botões Aprovar/Rejeitar |
| 4 — Aprovação | Aprovar o pedido | Mesmo usuário Auth com metadata approved; pedido approved, reviewed_at e reviewed_by; sucesso independente de e-mail |
| 5 — Login aprovado | Entrar com a mesma credencial | Sem organização vai a /onboarding/organizacao; depois /dashboard; com organização vai direto ao dashboard |
| 6 — Rejeição | Cadastrar outro usuário e rejeitar com/sem motivo | Metadata/pedido rejected, auditoria correta, login bloqueado |
| 7 — Pending duplicado | Reenviar e-mail ainda pendente | Não duplica; orienta aguardar revisão |
| 8 — E-mail aprovado | Reenviar e-mail já aprovado | Não duplica; orienta login; não troca a credencial |
| 9 — Sem variáveis Resend | Em ambiente de teste sem as três variáveis, executar build e fluxo completo | Build/cadastro/aprovação/rejeição/login funcionam; nenhuma integração de e-mail é necessária |

Complementar com senhas divergentes/curtas, acesso anônimo/comum ao painel, concorrência de revisão, falha parcial de Auth/banco, contas antigas e responsividade/teclado do cadastro/painel.

## Operação manual antes de homologar

- [ ] Conferir histórico de migrations no ambiente; aplicar somente arquivos pendentes.
- [ ] Se 0012/0013 já foram aplicadas, não reaplicá-las. Nenhum SQL adicional é necessário por retirar Resend.
- [ ] Se 0013 ainda estiver pendente, aplicar seu arquivo completo após 0012, antes do deploy.
- [ ] Conferir credenciais/conexão Supabase existentes e o próprio UUID em platform_admins.
- [ ] Conferir a restrição existente de criação pública no Auth para impedir cadastro fora da revisão.
- [ ] Iniciar aplicação com pnpm.cmd dev (Windows) ou pnpm dev e executar os nove testes acima.
- [ ] Conferir os estados diretamente em account_requests e no Auth, sem expor credenciais.
- [ ] Regularizar com o titular pedidos antigos sem auth_user_id antes de aprovar.
- [ ] Conciliar manualmente reservas/órfãos somente após verificar ambos os estados.
- [ ] Registrar a validação com cliente.

Não configurar Resend, SMTP novo, templates novos ou Vercel para esta revisão. Nenhuma variável real ou .env.local deve ser alterada automaticamente. Integração personalizada de e-mail poderá ser reavaliada futuramente, fora dos requisitos de aprovação do piloto.

## Situação

Código pronto para homologação após checks locais e conferência das dependências existentes do Supabase. A homologação integrada ainda está pendente. Não houve commit, push, migration remota, alteração de .env.local/Vercel ou criação de novo serviço de e-mail.
