# Fluxos do Sistema

## Login

1. Usuario acessa o sistema.
2. Informa credenciais.
3. Sistema valida autenticacao no Supabase.
4. Usuario autenticado entra no painel.

## Cadastro no atendimento

1. Atendente pesquisa telefone.
2. Se cliente nao existir, cadastra nome e telefone.
3. Registra aparelho e problema relatado.
4. Abre manutencao com status inicial.

## Quiosque/tablet

1. Usuario logado cria um token em `/configuracoes/quiosque`.
2. Sistema gera link publico `/kiosk/[slug]?token=[token]`.
3. Cliente abre o link no tablet, informa nome e telefone e aceita contato pelo WhatsApp.
4. Sistema valida slug, token ativo e telefone.
5. Cliente novo e registrado com origem `tablet`.
6. Se o telefone ja existir como cliente ativo da organizacao, o cadastro e atualizado sem duplicar.
7. Equipe usa `/clientes` para iniciar atendimento.

## Manutencao

1. Atendente acessa `/manutencoes/nova`.
2. Seleciona um cliente ativo da organizacao atual.
3. Informa dados do aparelho e defeito relatado.
4. Sistema cria `device`, `maintenance_order` e evento inicial.
5. Tecnico atualiza diagnostico e status em `/manutencoes/[id]` ou na edicao.
6. Cada mudanca de status gera evento no historico.
7. Equipe informa cliente manualmente quando necessario.
8. Ordem fica pronta para retirada.
9. Atendimento marca como entregue, preenchendo `delivered_at`.

## Mensagens prontas

1. Sistema monta mensagem com dados da manutencao.
2. Usuario copia o texto.
3. Usuario envia manualmente pelo WhatsApp.
