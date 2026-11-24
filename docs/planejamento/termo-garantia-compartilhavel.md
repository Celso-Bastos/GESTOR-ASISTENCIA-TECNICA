# Atualização 2 — Termo de Garantia enviável ao cliente

## Conceito e auditoria

O documento digital é uma cópia informativa das condições gerais. O termo físico continua sendo assinado presencialmente pelo cliente.

A auditoria confirmou os campos existentes em `maintenance_orders`: `warranty_enabled`, `warranty_signed`, `warranty_amount`, `warranty_unit`, `warranty_started_at`, `warranty_expires_at`, `warranty_notes` e `warranty_message_sent_at`, introduzidos pela migration 0004 e preservados pelos fluxos de manutenção. Nenhum campo de garantia foi duplicado ou removido. `warranty_signed` continua registrando exclusivamente se o cliente assinou o termo físico; o formulário agora diz “O cliente assinou o termo físico de garantia”. Os cálculos de prazo, edição de OS e histórico permanecem no fluxo existente.

Não havia bucket, policies ou chamadas ao Supabase Storage no código versionado. O modelo administrativo atual permite alterar configurações da loja apenas a `owner` e `admin`; esse modelo foi mantido para upload/substituição. `employee` pode consultar, baixar e compartilhar o documento da própria loja.

## Arquitetura e Storage

A relação é `organizations → documento padrão` e `maintenance_orders → dados específicos da garantia`. Não há snapshot por OS, contrato personalizado, assinatura eletrônica, geração/edição de PDF ou cópia por cliente. A substituição muda o documento padrão disponível para todas as OS, sem atualizar seus registros históricos. O papel assinado continua sendo a referência da relação com o cliente.

Migration nova: `supabase/migrations/0018_organization_warranty_document.sql`, próximo número após 0017, em transação. Migrations anteriores não foram alteradas. A migration adiciona três campos nulos a `organizations`:

| Campo | Tipo | Uso |
| --- | --- | --- |
| `warranty_document_path` | text | Caminho interno do PDF atual |
| `warranty_document_name` | text | Nome sanitizado para exibição/download |
| `warranty_document_updated_at` | timestamptz | Última troca confirmada |

Uma constraint exige metadata completa ou todos os campos nulos, e restringe nome/path. Organizações existentes permanecem sem documento, sem backfill e sem alteração de suas OS. A consulta desses campos é separada da consulta básica de organização; se a migration ainda não estiver instalada, o restante da página continua funcionando e a seção exibe uma falha de configuração.

Bucket privado: **`organization-documents`**, somente `application/pdf`, limite **4 MiB (4.194.304 bytes; exibido como 4 MB na interface)**. Estrutura: `{organization_id}/warranty/{uuid}.pdf`. O UUID é gerado no servidor; o nome original nunca compõe o caminho. Foi escolhido limite inferior ao payload padrão de 4,5 MB das Functions Vercel, deixando margem para multipart, sem alterar variáveis de ambiente ou aderir a limites beta. O Next aceita requests de Server Actions de até 5 MB; a validação da aplicação/bucket continua limitada a 4 MiB. Referências: [limites Vercel](https://vercel.com/docs/functions/limitations), [configuração de Server Actions](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions).

Upload exige extensão `.pdf`, MIME `application/pdf`, tamanho não vazio dentro do limite e cabeçalho `%PDF-`, todos no servidor. A interface também antecipa erro de tamanho/tipo. O nome é reduzido a caracteres ASCII seguros e recebe extensão PDF. Essa validação identifica o formato esperado, sem constituir parser completo ou verificação antimalware de PDFs.

## Permissões e policies

Todas as operações usam o cliente Supabase da sessão, sem `service_role` no novo fluxo. A organização e o papel vêm de `requireOrganization`, que exige autenticação e conta aprovada. IDs/path enviados pelo formulário ou pela URL são ignorados.

Policies criadas em `storage.objects`, restritas ao bucket:

| Policy | Operação | Regra |
| --- | --- | --- |
| `organization_documents_read` | SELECT | Membro da organização identificada pelo prefixo |
| `organization_documents_insert` | INSERT | Owner/admin da organização, path de PDF restrito |
| `organization_documents_delete` | DELETE | Owner/admin da organização e objeto fora de uso como termo vigente |

Não há policy de UPDATE: não se sobrescreve o arquivo atual. Anônimos e outras organizações não leem/listam/alteram os objetos. Os limites de MIME/tamanho do bucket são aplicados pela API HTTP do Storage; as policies SQL controlam organização/operação. A RLS das organizações e de seus membros é reutilizada. Não há nova policy genérica de UPDATE em `organizations`.

A RPC `replace_organization_warranty_document(uuid,text,text,text)` usa `SECURITY DEFINER` e `search_path` fixo. Verifica novamente `auth.uid()`, membership e papel owner/admin, nome e prefixo, existência do upload no bucket e bloqueia a organização com `FOR UPDATE`. Só troca o ponteiro se o path anterior ainda corresponder ao esperado. EXECUTE é revogado de PUBLIC/anon e concedido a authenticated, com a autorização interna obrigatória.

Referências técnicas: [controle de acesso Storage](https://supabase.com/docs/guides/storage/security/access-control) e [URLs assinadas](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl).

## Substituição e falhas

1. Validar sessão, papel e arquivo; consultar o termo atual.
2. Fazer upload com UUID novo e `upsert: false`.
3. Chamar a RPC para trocar a metadata de forma atômica, comparando o path anterior.
4. Após sucesso, remover o arquivo anterior pela API Storage e revalidar Configurações/OS.
5. Se upload/RPC falhar, tentar limpar apenas o objeto novo. A policy impede apagar o documento vigente mesmo se uma resposta de sucesso da RPC tiver se perdido na rede.

Duas substituições iniciadas sobre o mesmo termo não se sobrescrevem silenciosamente: a segunda recebe aviso para atualizar a página. Falha na limpeza após sucesso não desfaz o novo termo; a interface avisa que o arquivo antigo precisa ser conferido. Storage e PostgreSQL não compartilham uma transação única: interrupção do processo entre upload, metadata e limpeza ainda pode deixar um objeto órfão. A conferência/remoção deve usar a API ou interface Storage, comparando com `organizations.warranty_document_path`; não remover objetos editando diretamente a tabela SQL de Storage.

## Configurações, manutenção e acesso

`/configuracoes#termo-garantia` mostra documento atual, data de atualização, Visualizar/Baixar/Compartilhar e o formulário Adicionar/Substituir para owner/admin. Funcionários consultam o documento e recebem orientação para solicitar a alteração a um administrador.

Na OS, o bloco “Termo de garantia” só é exibido com `warranty_enabled=true`. Informa o estado real da assinatura física e oferece ações mesmo com `warranty_signed=false`. Sem documento, mostra “Nenhum termo de garantia configurado para esta loja.”; “Configurar termo” só aparece para owner/admin. Os dados de prazo/início/fim continuam no detalhamento existente. OS sem garantia não consulta nem exibe o bloco de documento.

O botão antigo de mensagem foi renomeado para “Enviar aviso de garantia no WhatsApp”. Seu fluxo legado e suas regras continuam separados do envio do PDF informativo. O compartilhamento do PDF não chama essa action nem altera `warranty_signed` ou `warranty_message_sent_at`, pois preparar/compartilhar não comprova entrega ao destinatário.

O endpoint `/api/organization/warranty-document` exige a sessão e resolve o documento atual da própria organização:

- **Visualizar:** nova aba com `noopener noreferrer`, redirecionamento para URL assinada de 300 segundos.
- **Baixar:** `?download=1`, URL assinada com nome de download sanitizado.
- **Preparar compartilhamento:** `?file=1`, resposta PDF autenticada da mesma origem, para construir um `File` sem depender de CORS externo.

Respostas são `private, no-store`, `nosniff` e `no-referrer`. Bucket não é público. URLs assinadas são credenciais temporárias de leitura; quem as possuir pode ler o PDF durante a validade. Não são colocadas nas mensagens de WhatsApp.

## Compartilhamento e fallback

“Compartilhar termo” prepara o PDF. Quando `navigator.share` e `navigator.canShare({files})` estiverem disponíveis e aceitarem o arquivo, a interface mostra “Escolher aplicativo”. Esse segundo clique preserva a ativação do usuário exigida por navegadores móveis. O funcionário escolhe WhatsApp/outro aplicativo e o destinatário. Cancelar permite tentar novamente; nenhuma mensagem é enviada automaticamente.

Sem suporte a arquivos, ou após erro de compartilhamento, o PDF é preparado para download e a interface oferece “Abrir WhatsApp”. A mensagem pronta usa somente primeiro nome, número da OS, modelo e prazo de garantia. Não recebe IMEI, senha, defeito ou observações internas. O link usa `phone_normalized` com fallback para `phone` e o helper existente `buildWhatsAppUrl`; não há nova normalização.

O funcionário deve anexar o PDF baixado manualmente. Se o navegador impedir o download iniciado após o preparo, o botão “Baixar termo” permanece disponível. Sem cliente/telefone, visualizar, baixar e Web Share continuam disponíveis; o fallback informa “Cliente sem telefone cadastrado.”. Nas Configurações, a mensagem é genérica e não seleciona um cliente.

O suporte varia por navegador/sistema, exige contexto seguro para Web Share e pode depender das configurações do aparelho. O sistema não confirma envio ou recebimento pelo WhatsApp. Não há Resend, e-mail automático, WhatsApp Cloud API ou assinatura digital.

## Testes e qualidade

Comandos (no PowerShell local, usar `pnpm.cmd`, pois o atalho `pnpm.ps1` é bloqueado pela política de scripts):

```sh
pnpm test:warranty-document
pnpm test:sql:warranty-document
pnpm --filter web exec node --test --test-concurrency=1 tests/*.test.cjs
node --test --test-concurrency=1 supabase/tests/*.test.cjs
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Resultados em 23/11/2026: **124 testes web e 69 testes SQL aprovados**, sem falhas ou testes ignorados. Incluem **19 cenários web específicos** e **8 testes SQL do termo** (grupo e cenários), além das regressões de manutenção, garantia, autenticação, estoque, cidade e tema. Lint, typecheck, build de produção com Turbopack e `git diff --check` passaram. Os 20 arquivos novos/modificados foram revisados; os arquivos novos também foram verificados quanto a espaços no final das linhas, conflitos e segredos reconhecíveis, sem ocorrências.

A suíte web executa os módulos TypeScript reais com as fronteiras Supabase/navegador substituídas; testa validação, sessão/papel, upload, substituição/rollback, revalidação, endpoints, capability detection, clique de compartilhamento, cancelamento, fallback e ausência de telefone/garantia/documento. A suíte SQL aplica a migration e policies reais em PostgreSQL PGlite descartável, com catálogo mínimo `storage.*`; verifica RLS, grants, paths, comparação de versões e preservação do termo vigente. Ela não executa a API HTTP real do Supabase Storage, emissão real de URLs assinadas nem contenção entre conexões independentes.

Os componentes usam os tokens semânticos de light/dark, botões de pelo menos 44/48 px, grid empilhado no celular e `min-w-0`/quebra de nomes. A tentativa de conferência visual via Computer Use foi interrompida porque o navegador Firefox disponível não oferece suporte à verificação de URLs pelo mecanismo. Nenhuma validação visual ou de share sheet em aparelho real foi concluída nesta sessão.

## Supabase e homologação manual

Nenhum SQL foi aplicado remotamente. Nenhum PDF real foi enviado ao Storage nesta implementação; o arquivo conceitual `termo_garantia_01_envio_cliente.pdf` deve ser selecionado pelo administrador após instalar a migration. `.env.local` não foi alterado. Não houve commit ou push desta atualização.

1. No mesmo projeto Supabase usado pelo aplicativo, confirmar migrations anteriores até 0017 e Storage instalado. Fazer backup conforme a rotina do projeto.
2. Executar uma vez o arquivo inteiro `supabase/migrations/0018_organization_warranty_document.sql` no SQL Editor. Não editar/reaplicar migrations anteriores.
3. Executar `supabase/diagnostics/0018_warranty_document_check.sql` (somente leitura). Conferir bucket privado, MIME PDF, limite 4.194.304, três campos, três policies específicas, RLS habilitada, RPC com acesso authenticated e sem acesso anon. Conferir também se existem policies globais antigas que liberem esse bucket; elas não fazem parte do código auditado.
4. Publicar/executar o código desta atualização pelo processo habitual. Nenhum segredo ou variável nova é necessário.
5. Entrar como owner/admin, abrir Configurações e adicionar o PDF real. Confirmar metadata, nome, data, Visualizar e Baixar com nome amigável.

Checklist de homologação:

- [ ] Loja sem termo: Configurações e OS com garantia continuam funcionando, com mensagem discreta; OS sem garantia não mostra o bloco.
- [ ] Upload de PDF real válido; recusar DOCX/HTML/EXE, arquivo vazio, PDF forjado sem cabeçalho e arquivo maior que 4 MB.
- [ ] Substituir: novo conteúdo em Visualizar/Baixar; metadata atualizada e objeto antigo removido. Dados das garantias/assinaturas das OS preservados.
- [ ] Dois administradores substituindo simultaneamente: um vence; o outro recebe conflito e o termo vigente permanece disponível.
- [ ] Com usuário employee: leitura/download/compartilhamento permitidos; upload/substituição/remoção bloqueados, inclusive pela API Storage.
- [ ] Em organizações A/B e sessão anônima: tentar listar/baixar/criar/substituir/excluir pelo path conhecido; confirmar isolamento. URL pública do bucket deve falhar.
- [ ] URL assinada: abre imediatamente e deixa de autorizar novas leituras após 5 minutos; recarregar Visualizar gera URL nova.
- [ ] OS com garantia não assinada permite compartilhar; `warranty_signed` continua igual após o envio.
- [ ] Celular HTTPS: preparar, Escolher aplicativo, selecionar WhatsApp e destinatário; conferir anexo PDF real e mensagem sem informação interna. Cancelar e tentar de novo.
- [ ] Desktop/sem Web Share: baixar, Abrir WhatsApp da pessoa correta, anexar manualmente. Se o download for bloqueado, usar Baixar termo.
- [ ] Sem cliente/telefone: visualizar, baixar e share sheet continuam disponíveis; fallback mostra a mensagem de telefone ausente.
- [ ] Conferir 375, 390 e 430 px e desktop em light/dark, com nome de arquivo longo, foco/teclado e nenhum overflow horizontal.
- [ ] Conferir edição/entrega da manutenção, cálculo de prazos e aviso de garantia legado.

Pronto para homologação após instalação manual da migration e upload do PDF. A aprovação de commit deve ser solicitada somente após entregar o resultado e o checklist; push exige autorização explícita separada.

## Arquivos da atualização

Novos: migration 0018 e diagnóstico correspondente, `supabase/tests/warranty-document.test.cjs`, este documento, `apps/web/tests/warranty-document.test.cjs`, `apps/web/src/lib/organization/warranty-document.ts`, `warranty-document-queries.ts`, `warranty-document-actions.ts`, `apps/web/src/lib/maintenance/warranty-document-sharing.ts`, `apps/web/src/components/warranty-document-controls.tsx`, `maintenance-warranty-document.tsx`, `apps/web/src/app/api/organization/warranty-document/route.ts` e `apps/web/src/app/(dashboard)/configuracoes/warranty-document-form.tsx`.

Alterados: README, scripts em `package.json`/`apps/web/package.json`, `apps/web/next.config.ts`, página de Configurações, detalhe da OS e nomenclatura da assinatura no formulário de manutenção. Nenhuma dependência nova foi adicionada.
