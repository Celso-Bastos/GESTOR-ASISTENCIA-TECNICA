# Fase 9 - Checklist Garantia

- [x] Migration criada.
- [x] Campos de garantia adicionados.
- [x] Formulario completo permite garantia.
- [x] Edicao permite alterar garantia.
- [x] Detalhe mostra garantia.
- [x] Calculo de validade funciona com dias.
- [x] Calculo de validade funciona com meses.
- [x] Botao de garantia bloqueia se nao assinou.
- [x] Botao de garantia bloqueia se nao ha garantia ativa.
- [x] WhatsApp abre com mensagem correta.
- [x] `message_logs` registra `warranty_notice`.
- [x] `maintenance_events` registra evento.
- [x] `warranty_message_sent_at` e preenchido.
- [x] Manutencao excluida nao permite enviar garantia.
- [x] `.env.local` continua ignorado.
- [x] `pnpm lint` passa.
- [x] `pnpm typecheck` passa.
- [x] `pnpm build` passa.

## Validacao manual

- Criar garantia de 90 dias com aceite e conferir validade.
- Criar garantia ativa sem aceite e conferir bloqueio do botao.
- Enviar garantia pelo WhatsApp e conferir log, evento e `warranty_message_sent_at`.
- Criar garantia de 3 meses e conferir periodo e validade.
- Excluir uma manutencao e confirmar que detalhe/envio nao ficam acessiveis.
