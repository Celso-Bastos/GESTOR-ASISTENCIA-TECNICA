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

## Manutencao Rapida

1. Atendente acessa `/manutencoes/rapida`.
2. Informa nome, telefone, modelo do aparelho e defeito.
3. Sistema normaliza o telefone.
4. Sistema procura cliente ativo da organizacao atual pelo telefone normalizado.
5. Se o cliente existir, reaproveita o cadastro sem alterar `source`.
6. Se o cliente nao existir, cria cliente manual com opt-in de WhatsApp desativado.
7. Sistema cria aparelho, OS com status `recebido` e evento inicial.
8. Sistema redireciona para o detalhe da OS.

## Mensagens prontas

1. Usuario configura modelos operacionais em `/mensagens`.
2. Ao abrir uma OS, usuario escolhe o tipo de mensagem: recebimento, pronto, lembrete ou entrega hoje.
3. Sistema reconsulta a manutencao dentro da organizacao atual.
4. Sistema interpola variaveis seguras no modelo.
5. Sistema registra `message_logs` com `channel = whatsapp_manual`.
6. Sistema abre o WhatsApp em nova aba com texto codificado.
7. Usuario revisa e envia manualmente pelo WhatsApp.

## Alertas operacionais

1. Usuario acessa `/dashboard`.
2. Sistema calcula cards reais da organizacao atual.
3. Equipe acompanha entregas de hoje, atrasadas, aguardando peca e prontas para entrega.
4. Em entregas de hoje e prontas para entrega, usuario pode abrir a OS ou iniciar WhatsApp manual.
