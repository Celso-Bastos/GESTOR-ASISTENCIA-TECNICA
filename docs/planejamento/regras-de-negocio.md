# Regras de Negocio

## Clientes

- Nome e telefone sao os dados minimos para cadastro.
- O telefone deve ser tratado como identificador operacional principal.
- O telefone deve ser normalizado em `phone_normalized` antes de salvar.
- Cliente sempre pertence a organizacao atual do usuario autenticado.
- O formulario nunca deve enviar nem permitir alterar `organization_id`.
- Nao pode existir cliente ativo duplicado com o mesmo `phone_normalized` dentro da mesma organizacao.
- Clientes removidos devem usar soft delete com `deleted_at`; nao apagar fisicamente no MVP.
- Listagens devem ignorar clientes com `deleted_at` preenchido.
- O cadastro manual deve usar `source = manual`.
- Consentimento de WhatsApp deve ser explicito via checkbox.
- `whatsapp_opt_in_at` deve ser preenchido quando houver consentimento e ficar `null` quando nao houver.
- Mensagens promocionais futuras so devem considerar clientes com `whatsapp_opt_in = true`.
- Cadastros vindos do tablet/quiosque devem ser marcados com origem propria.
- O cadastro publico do tablet exige token ativo da organizacao e consentimento de WhatsApp.
- Cliente novo vindo do tablet deve ser salvo com `source = tablet`.
- Se o telefone do tablet ja existir como cliente ativo na mesma organizacao, atualizar nome, telefone e consentimento sem criar duplicado e sem revelar a duplicidade ao publico.
- Em duplicidade, preservar `source` original do cliente existente para manter a primeira origem conhecida.

## Quiosque / Tablet

- Tokens de quiosque pertencem a uma unica organizacao.
- Usuario autenticado so pode criar ou desativar tokens da propria organizacao atual.
- Token desativado nao pode aceitar novos cadastros.
- A tela publica nao pode listar clientes, manutencoes, tokens ou dados internos.

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
