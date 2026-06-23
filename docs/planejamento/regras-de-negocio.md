# Regras de Negocio

## Clientes

- Nome e telefone sao os dados minimos para cadastro.
- O telefone deve ser tratado como identificador operacional principal.
- Cadastros vindos do tablet/quiosque devem ser marcados com origem propria.

## Manutencoes

- Uma manutencao pertence a um cliente.
- Uma manutencao deve ter status claro desde a entrada ate a entrega.
- Mudancas importantes de status devem gerar evento no historico.

## Alertas

- Alertas servem para lembrar a equipe de acoes manuais.
- O MVP nao envia mensagens automaticamente.
- Mensagens prontas devem ser copiadas e enviadas manualmente pelo WhatsApp.

## Usuarios

- Papeis iniciais: dono, gerente, tecnico e atendente.
- Permissoes detalhadas serao refinadas com RLS na Fase 1.
