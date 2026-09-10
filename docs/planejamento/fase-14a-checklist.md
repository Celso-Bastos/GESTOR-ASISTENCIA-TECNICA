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
