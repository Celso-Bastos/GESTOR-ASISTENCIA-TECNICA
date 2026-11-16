# Fase 14A — Checklist

## Implementação e verificação local

- [x] Nome e telefone opcionais na manutenção rápida.
- [x] RPC de criação transacional com UUID de tentativa e RLS preservada.
- [x] Nenhum fallback para gravação parcial na criação.
- [x] Novo cliente na manutenção completa sem sair da OS.
- [x] WhatsApp com reabertura, alternativas e feedback.
- [x] Prévia usa dados reais e helper compartilhado com envio.
- [x] Dashboard oculta valores dos blocos com erro.
- [x] Reposição não oferece lista copiável em erro.
- [x] Garantia mensal limitada ao último dia do mês.
- [x] Edição de vendas e total antes de salvar.
- [x] Dez testes automatizados aprovados (fronteiras externas simuladas).
- [x] Lint aprovado.
- [x] Typecheck aprovado.
- [x] Build aprovado.
- [x] Sem commit e sem envio ao GitHub.

## Validação necessária antes do piloto

- [ ] Aplicar/verificar 0009 e aplicar 0010 no Supabase correto.
- [ ] Validar os 12 cenários reais do documento da fase.
- [ ] Validar rollback ao falhar evento em banco de teste.
- [ ] Validar reenvio concorrente do mesmo UUID: uma única OS.
- [ ] Validar acesso por organização com usuários de teste.
- [ ] Validar cadastro inline preservando dados no desktop e celular.
- [ ] Validar abertura/reabertura do WhatsApp e cópia em aparelhos reais.
- [ ] Autorizar liberação do piloto após validações.

## Correção do PGRST202 — 10/09/2026

- [x] Localizada a RPC na migration 0010; não há necessidade de outra numeração.
- [x] Sete nomes de argumentos conferidos com a action da Vercel.
- [x] Retorno tabular preservado para `.maybeSingle()` e redirecionamento.
- [x] Migration 0009 envolve nulabilidade/índice em transação.
- [x] Migration 0010 verifica dependência da 0004 e confirmação da OS/tentativa.
- [x] Grant usa os mesmos sete tipos da assinatura real.
- [x] Migrations notificam `pgrst` para recarregar schema após commit.
- [x] Documentados comandos de aplicação, diagnóstico e critérios de redeploy.
- [x] Onze cenários SQL aprovados em PostgreSQL/PGlite descartável, incluindo assinatura/grant, reenvio, RLS e rollback.
- [x] Dez testes existentes da aplicação continuam aprovados.
- [ ] Aplicar 0009 e 0010 no Supabase usado pela Vercel e verificar sucesso.
- [ ] Verificar `phone` e `phone_normalized` com `is_nullable = YES`.
- [ ] Conferir assinatura da RPC e grant de `authenticated` no banco remoto.
- [ ] Executar `notify pgrst, 'reload schema';` após aplicar SQL.
- [ ] Na Vercel: rápida só com modelo e defeito abre detalhe, cliente pendente e WhatsApp bloqueado.
- [ ] Na Vercel: rápida com nome/sem telefone e com telefone/sem nome.
- [ ] Na Vercel: completa com cliente existente.
- [ ] Confirmar ausência de PGRST202 nos testes acima.

## Cliente arquivado no fluxo de manutenção — 03/11/2026

- [x] Auditadas as migrations: constraint original global por organização; índice atual parcial por organização e telefone ativo não nulo. Estado remoto ainda não consultado.
- [x] Criada 0011 com `create or replace function`, grants e reload de schema; migrations antigas intactas.
- [x] Regra centralizada na RPC compartilhada por rápida e normal: ativo, arquivado, somente então novo cliente.
- [x] Reativação explícita (`deleted_at = null`), preservando ID, organização, histórico, notas e consentimento WhatsApp.
- [x] Nome informado e telefone atualizados na reativação; nome anterior válido preservado quando omitido, com fallback para inválido.
- [x] Ativo priorizado; vários arquivados legados têm escolha estável, sem mesclar ou apagar dados.
- [x] `unique_violation` repete a busca por ativos/arquivados, com tentativas limitadas e rollback transacional.
- [x] Conflito de telefone persistente tem mensagem específica, log técnico no servidor e UUID preservado.
- [x] Testes de regressão SQL e actions adicionados; instruções de aplicação e testes local/Vercel documentadas.
- [ ] Conferir constraints/índices reais do Supabase com o SQL de auditoria documentado.
- [ ] Aplicar 0011 no Supabase utilizado pela Vercel, após migrations anteriores faltantes.
- [ ] Publicar a action atualizada para disponibilizar a mensagem específica.
- [ ] Repetir em rápida e normal: telefone novo, ativo, arquivado com histórico e mesmo telefone em outra organização.
- [ ] Validar concorrência real com UUIDs iguais/distintos e com cadastro/reativação externo em banco de teste.
- [ ] Confirmar no app: mesmo ID, histórico e notas preservados; `whatsapp_opt_in` não alterado; nenhuma duplicata nova.
