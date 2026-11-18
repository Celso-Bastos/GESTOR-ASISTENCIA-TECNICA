# Fase 14A.2 — Solicitação e aprovação de contas

## Decisão para o piloto

“Resend e notificações de e-mail personalizadas foram retiradas do escopo do piloto. O acompanhamento de solicitações será realizado pelo painel administrativo. A integração poderá ser reavaliada após validação com cliente.”

O painel `/admin/solicitacoes-conta` é o mecanismo principal para acompanhar novos pedidos. Cadastro, aprovação, rejeição e login não dependem de nenhum envio de e-mail personalizado. Não foi criado outro serviço de e-mail; SMTP, templates e comportamentos existentes do Supabase Auth foram preservados.

## Arquitetura entregue

A migration `0015` acrescenta `account_requests.service_city` nullable para
compatibilidade com pedidos antigos. Novas solicitações exigem a cidade e o
painel administrativo a exibe. No onboarding, o pedido aprovado do próprio
usuário preenche a cidade, que será copiada para a organização. Implantação e
testes em [Cidade de serviço e Google Maps](cidade-de-servico-maps.md).

O usuário define sua senha em `/criar-conta`, junto com nome completo, e-mail, telefone opcional, nome da assistência opcional e cidade de serviço obrigatória. A cidade recebe trim e aceita de 2 a 120 caracteres, sem lista rígida ou valor padrão. A confirmação da senha é obrigatória; Zod valida de 8 a 128 caracteres e igualdade entre os dois campos. Não há exigência de combinações adicionais no MVP. As senhas não são aparadas: espaços fazem parte da senha.

A Server Action normaliza e-mail/telefone, consulta um pedido pending e um usuário Auth existentes, e chama `supabase.auth.admin.createUser` somente no servidor. Envia a senha exclusivamente no atributo de credencial do Auth, além de `email_confirm: false`, `app_metadata.account_status: pending` e nome não sensível em `user_metadata`. Não existe cadastro público via `signUp` neste fluxo.

O resultado é um usuário Auth sem e-mail confirmado e um registro `account_requests` pending com `auth_user_id`. O acompanhamento ocorre pelo painel administrativo e a navegação termina em `/criar-conta/aguardando`. A interface informa que o login posterior usará a senha escolhida no cadastro.

A aprovação atualiza o usuário Auth existente com `email_confirm: true` e `app_metadata.account_status: approved`, preservando as demais propriedades de app_metadata. Depois grava status approved, reviewed_at e reviewed_by no pedido. Não altera a senha, não cria outro usuário e não chama `inviteUserByEmail`.

## Senha e dados sensíveis

A senha pertence somente ao Supabase Auth, que mantém seu armazenamento seguro. Nenhuma coluna de senha, hash ou confirmação foi criada em public, account_requests ou profiles. Ela não é colocada em metadata, cookies próprios, URLs, e-mails, logs, documentação ou estado retornado pelas actions. A confirmação só participa da validação no servidor e nunca é enviada como atributo do Auth.

A lista explícita de valores de retorno contém apenas full_name, email, phone, business_name e service_city. O formulário não guarda as senhas em estado React. Limpa os inputs imediatamente ao iniciar o envio, volta a ocultá-los e remove os atributos de senha do FormData em memória ao terminar a chamada, inclusive em caso de erro. O botão de mostrar/ocultar tem aria-controls e aria-pressed.

Limite da inspeção em DevTools: o payload da requisição original precisa transportar a senha ao servidor, por HTTPS em produção, e pode ser inspecionado pelo proprietário do navegador no painel Network. Não é possível apagar retroativamente essa requisição do DevTools. A garantia implementada é ausência da credencial na resposta, estado da action, DOM após o envio, storage da aplicação, logs e e-mails. Não registrar o FormData, dados do Zod ou respostas brutas do provedor.

## Autorizações e proteção de acesso

`public.platform_admins` continua sendo a única origem da autorização para listar, aprovar e rejeitar solicitações. O papel de administrador de uma organização não concede essa permissão. A página lê com a sessão do administrador e RLS; as actions repetem a autorização antes de obter o cliente secreto. reviewed_by sempre vem da sessão validada.

A nova RPC `get_account_access_status()` não recebe parâmetros e só permite consulta pelo próprio usuário autenticado. É SECURITY DEFINER, com search_path vazio, referências qualificadas e EXECUTE revogado de PUBLIC/anon. Lê o estado atual em auth.users.raw_app_meta_data e o pedido associado pelo UUID, em vez de confiar em user_metadata ou em claims antigos de um JWT.

Regras de acesso:

- Auth ou pedido rejected: negar como rejected.
- Auth ou pedido pending: negar como pending.
- Revisão em processamento, inconsistência, RPC indisponível ou estado desconhecido: negar.
- Novo fluxo: liberar somente quando Auth e pedido concordarem em approved e não houver revisão em processamento.
- Compatibilidade: contas anteriores sem account_status continuam funcionando quando não há pedido associado, ou quando seu pedido histórico está approved. Isso preserva os usuários e administradores já existentes. Manter cadastro público do Auth desativado é obrigatório para não criar novas contas fora da revisão.

`proxy.ts` consulta esse estado e bloqueia dashboard, clientes, manutenções, mensagens, saídas, relatórios, configurações, admin e onboarding. Login e aguardando não criam loops. `requireAuth()` repete a verificação no servidor, cobrindo o layout protegido e a criação inicial de organização. `getCurrentOrganization()` exige requireAuth, protegendo também as actions internas que usam requireOrganization. Os helpers de platform admin e redirecionamento repetem a checagem. A definição de senha legada também recusa contas sem aprovação. A RLS por organização permanece como camada adicional.

No login com e-mail ainda não confirmado, somente a recusa `email_not_confirmed` aciona consulta Admin server-side para retornar a mensagem de pending/rejected. Quando o Auth retorna uma sessão tecnicamente válida, a RPC é obrigatória e sessões não aprovadas recebem signOut antes do retorno. Mensagens:

- `Sua conta está aguardando aprovação.`
- `Sua solicitação de acesso não foi aprovada.`

Com aprovação, o login continua usando a senha original. Sem organização, segue para `/onboarding/organizacao`; com organização, `/dashboard`.

## Consistência, concorrência e compensação

Auth e public não participam da mesma transação. Se o usuário Auth recém-criado não puder ser persistido no pedido, o servidor consulta o vínculo antes de compensar. Sem vínculo persistido, tenta removê-lo via Admin API; falha nessa remoção gera log somente com auth user ID e código técnico fixo. Nunca remove um usuário preexistente nem troca sua senha.

Se a resposta do INSERT se perder depois do commit e o vínculo existir, conserva o usuário e o pedido e conclui com a tela de aguardando. Se não for possível verificar se houve commit, não exclui às cegas: registra o UUID e `REQUEST_RECONCILIATION_REQUIRED`, mantém a conta bloqueada e devolve erro genérico. O operador deve verificar o vínculo antes de limpar qualquer órfão. Uma falha ambígua na própria criação do Auth também requer conferência; um novo envio não assume controle de um usuário já existente.

O índice único parcial de 0012 protege pedidos pending duplicados. A unicidade de e-mail do Auth protege criações concorrentes. Pedido pending duplicado retorna `Já existe uma solicitação pendente para este e-mail.`. Conta anterior existente ou novo cadastro coerentemente aprovado retorna `Este e-mail já possui acesso. Faça login.`. Metadata presente sem pedido coerente é tratada explicitamente com diagnóstico seguro e encaminhamento ao administrador.

Aprovação e rejeição compartilham a reserva durável review_started_at por UPDATE condicional (pending e reserva nula). Só uma decisão vence. Falhas antes de alterar o Auth liberam a reserva quando seguro. Depois de iniciar a mutação Auth, falhas ou respostas ambíguas conservam a reserva para conciliação. A RPC impede acesso durante uma aprovação parcialmente persistida, mesmo se o e-mail já tiver sido confirmado no Auth. Não há expiração automática dessa reserva.

Procedimento de conciliação, exclusivamente pelo operador autorizado: identificar request ID/auth user ID no log; conferir o vínculo, estado real do Auth e reserva; decidir se conclui a revisão e auditoria ou restaura pending em ambas as origens; somente depois limpar a reserva. Não liberar uma reserva sem conferir o Auth. Não existe endpoint público de conciliação ou remoção.

## Rejeição e compatibilidade

A rejeição mantém o usuário Auth e sua credencial, define app_metadata.account_status rejected e grava pedido rejected, reviewed_at, reviewed_by e motivo opcional. Não confirma e-mail nem apaga o histórico. Não permite novo cadastro automático com o mesmo e-mail. Isso evita substituir credenciais e preserva rastreabilidade para uma futura reconsideração administrativa.

Uma interface de reconsideração não faz parte desta entrega. Para implementá-la depois, será preciso uma ação administrativa própria com auditoria; não basta editar user_metadata. Pedidos antigos pending sem auth_user_id não podem ser aprovados automaticamente, pois seus titulares ainda não escolheram senha. A tela pede regularização com o titular e não associa um Auth encontrado apenas por e-mail. Esses pedidos antigos podem ser rejeitados mantendo o histórico.

As rotas `/auth/confirm` e `/auth/definir-senha` permanecem apenas para compatibilidade com convites emitidos pelo fluxo anterior. Nenhum novo pedido usa essas rotas para receber acesso.

## E-mail existente e variáveis

Nenhum envio personalizado de solicitação ou aprovação integra este piloto. A aprovação é bem-sucedida assim que o Auth existente é liberado e o pedido é atualizado; não aguarda nem tenta enviar mensagens. A rejeição também não chama provedor de e-mail. Não há botão de reenvio ou indicação de envio pendente no painel.

RESEND_API_KEY, EMAIL_FROM e ACCOUNT_APPROVER_EMAIL foram removidas de .env.example e não são lidas pela aplicação. Nenhuma delas é necessária para iniciar, criar pedidos, aprovar, rejeitar, fazer login ou build. NEXT_PUBLIC_APP_URL permanece como variável geral do projeto. O cliente administrativo continua usando NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY somente no servidor, e o cliente público utiliza a chave publicável existente. Não imprimir arquivos reais de ambiente.

Foram removidos o helper exclusivo `apps/web/src/lib/account-requests/email.ts`, o formulário exclusivo `apps/web/src/app/admin/solicitacoes-conta/resend-email-form.tsx` e a action de reenvio. A integração anterior usava fetch diretamente, sem pacote Resend instalado; não foi necessário alterar dependências ou lockfile.

Os fluxos legados de convite/definição de senha do Supabase Auth continuam disponíveis para compatibilidade. A criação e liberação do novo cadastro mantêm email_confirm false/true conforme a arquitetura já existente; a aprovação por Admin API não exige convite. O fato de uma operação não enviar e-mail não bloqueia a fase. Não há exigência nova de SMTP, templates ou remetente. A tela aguardando orienta o usuário a contatar o responsável para verificar seu status.

## SQL a aplicar manualmente

A migration 0012 foi preservada integralmente. O próximo número disponível era 0013:

`supabase/migrations/0013_account_request_password_signup.sql`

Executar o conteúdo completo desse arquivo, incluindo BEGIN/COMMIT, no projeto correto, depois de 0012. Não reaplicar 0012 se já foi aplicada. 0013 adiciona approval_email_sent_at, comentários de semântica, índice de consulta por usuário Auth e a função de consulta do próprio acesso com seus grants. Não altera usuários existentes, status existentes, variáveis nem credenciais.

A 0013 permanece válida sem Resend: não chama serviços externos, não lê variáveis de e-mail, não instala triggers de envio e não contém dependência de provedor. A coluna approval_email_sent_at e seu comentário são remanescentes do escopo anterior e permanecem por compatibilidade; a aplicação do piloto não lê nem escreve esse campo. invite_sent_at também continua histórico. Não apagar essas colunas nem editar migrations que podem já ter sido aplicadas apenas para retirar a integração. Nenhuma migration corretiva ou SQL adicional foi necessário nesta revisão.

Se 0012 ainda não foi aplicada, aplicar primeiro o arquivo original e depois 0013. Para cadastrar um platform admin, o operador deve escolher seu UUID real no Auth e inseri-lo manualmente em platform_admins. Nenhum administrador é criado por essas migrations.

No Supabase Authentication, conferir se a configuração existente impede criar contas públicas fora da revisão e se os provedores seguem essa regra. Não há supabase/config.toml no repositório; a configuração remota não foi consultada ou alterada nesta revisão. Nenhuma mudança de SMTP/templates é necessária para retirar o Resend. O controle de acesso no servidor continua obrigatório, independentemente da configuração de confirmação de e-mail.

Aplicar 0013 antes do deploy: sem a RPC o sistema falha fechado e não libera contas, incluindo contas anteriores.

## Arquivos desta revisão do piloto

Alterados:

- .env.example
- apps/web/src/lib/account-requests/actions.ts
- apps/web/src/lib/account-requests/types.ts
- apps/web/src/lib/auth/account-access.ts
- apps/web/src/app/(auth)/criar-conta/aguardando/page.tsx
- apps/web/src/app/admin/solicitacoes-conta/page.tsx
- apps/web/tests/fase-14a2.test.cjs
- docs/planejamento/fase-14a2-solicitacao-contas.md
- docs/planejamento/fase-14a2-checklist.md

Removidos, após verificar que não eram compartilhados com outros módulos:

- apps/web/src/lib/account-requests/email.ts
- apps/web/src/app/admin/solicitacoes-conta/resend-email-form.tsx

Nenhum arquivo novo ou migration foi criado nesta revisão. As migrations 0012/0013 foram preservadas, assim como o mecanismo existente do Supabase Auth. Alterações anteriores de outras fases foram preservadas. Não houve commit, push, SQL remoto, modificação de .env.local, alteração de Vercel ou operações sobre usuários reais.

## Validação e homologação

Os testes automatizados executam schemas/actions reais com fronteiras Auth/banco simuladas. Um teste remove as três variáveis de e-mail apenas do processo, bloqueia qualquer chamada fetch e exercita cadastro, duplicidade, aprovação, login com a mesma credencial/onboarding e rejeição. Também verifica que o painel lista os três estados sem indicadores de envio/reenvio e que a tela de aguardando não promete e-mail.

A segurança permanece coberta por testes de confirmação divergente, limite de senha, ausência de credencial no retorno e nos logs, compensação de falha de INSERT, autorização de platform admin, revisões concorrentes, falhas parciais e bloqueio de rotas/actions para pending/rejected.

O checklist complementar registra lint, typecheck, build e testes. O build é executado com as três variáveis de e-mail vazias somente no processo de verificação, sem editar .env.local. As migrations existentes continuam tendo testes locais em PostgreSQL descartável/PGlite; não há conexão remota nesses testes.

Para testar localmente, aplicar somente migrations ainda pendentes em um ambiente autorizado, conferir a conexão Supabase e um platform admin, e iniciar com `pnpm.cmd dev` no Windows (ou `pnpm dev`). Usar endereços novos controlados e credenciais escolhidas fora da documentação. Criar um usuário, confirmar pending e o bloqueio do login, consultar o painel, aprovar e entrar com a mesma credencial. Sem organização, seguir para `/onboarding/organizacao`, criar a organização e conferir `/dashboard`. Rejeitar outra conta descartável e verificar o bloqueio. Repetir o cadastro com e-mail pending/aprovado para conferir duplicidades.

Status: código pronto para homologação do piloto após conferir migrations/conexão existentes. A validação integrada com Supabase e o cliente ainda deve ser executada no ambiente autorizado. Envio personalizado de e-mail não é pendência desta fase; uma futura integração depende de nova decisão após a validação com cliente.
