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
