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

1. Cliente informa nome e telefone.
2. Sistema registra origem como tablet/quiosque.
3. Equipe usa o cadastro para iniciar atendimento.

## Manutencao

1. Tecnico recebe a ordem.
2. Atualiza diagnostico e status.
3. Equipe informa cliente manualmente quando necessario.
4. Ordem fica pronta para retirada.
5. Atendimento marca como entregue.

## Mensagens prontas

1. Sistema monta mensagem com dados da manutencao.
2. Usuario copia o texto.
3. Usuario envia manualmente pelo WhatsApp.
