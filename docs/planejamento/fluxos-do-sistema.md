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
7. Se houver garantia, equipe ativa a garantia, informa periodo, data de inicio e se o cliente assinou/aceitou.
8. Sistema calcula a validade da garantia no servidor.
9. Equipe informa cliente manualmente quando necessario.
10. Ordem fica pronta para retirada.
11. Atendimento marca como entregue, preenchendo `delivered_at`.

## Garantia por WhatsApp

1. Usuario abre o detalhe da OS.
2. Sistema mostra status visual da garantia: sem garantia, valida, vencida ou nao assinada.
3. Usuario clica em `Enviar garantia no WhatsApp`.
4. Sistema reconsulta a OS na organizacao atual e exige `deleted_at is null`.
5. Sistema bloqueia se a garantia nao estiver ativa, se nao houver aceite ou se os campos obrigatorios estiverem incompletos.
6. Sistema interpola `{{garantia_periodo}}` e `{{garantia_validade}}`.
7. Sistema registra `message_logs`, atualiza `warranty_message_sent_at` e cria evento `warranty_message_opened`.
8. Sistema abre o WhatsApp em nova aba para envio manual.

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

## Mensagens personalizadas

1. Usuario acessa `/mensagens`.
2. Sistema exibe modelos padrao do sistema e mensagens personalizadas da organizacao.
3. Usuario cria ou edita uma mensagem com titulo, contexto, corpo e status ativo/inativo.
4. Sistema valida dados com Zod e salva `organization_id` no servidor.
5. Usuario visualiza preview com variaveis interpoladas em dados seguros.
6. No detalhe da OS, usuario escolhe uma mensagem personalizada ativa.
7. Sistema reconsulta mensagem e OS dentro da organizacao atual.
8. Sistema interpola variaveis reais da OS.
9. Sistema registra `message_logs` com `message_type = custom_message`.
10. Sistema abre WhatsApp em nova aba para envio manual.

## Saidas/Vendas

1. Usuario acessa `/saidas/nova`.
2. Escolhe categoria e opcionalmente um modelo salvo.
3. Se escolher modelo salvo, o sistema usa o modelo da organizacao atual e preenche preco padrao no formulario.
4. Se nao escolher modelo salvo, usuario informa o modelo digitado.
5. Usuario informa quantidade, valor unitario, data, cliente opcional e observacao.
6. Se marcar "Salvar este modelo para usar depois", o servidor cria ou reaproveita modelo salvo ativo.
7. Servidor valida usuario, organizacao, modelo e cliente.
8. Servidor calcula `total_price = quantity * unit_price`.
9. Sistema grava `product_outflows` com `organization_id` da organizacao atual.
10. Usuario retorna para `/saidas` e visualiza a venda na lista.

## Modelos de produtos

1. Usuario acessa `/saidas/modelos`.
2. Cria modelo com categoria, nome, preco padrao opcional e status ativo.
3. Sistema valida duplicidade de modelo ativo na mesma organizacao/categoria.
4. Usuario pode editar, desativar, reativar pelo checkbox de ativo ou excluir por soft delete.

## Relatorio de reposicao

1. Usuario acessa `/relatorios/reposicao`.
2. Sistema usa o mes atual como padrao.
3. Usuario pode filtrar por mes e categoria.
4. Sistema busca saidas da organizacao atual com `deleted_at is null`.
5. Sistema agrupa por categoria e modelo salvo ou modelo digitado.
6. Sistema mostra quantidade vendida, valor total vendido, total do mes, categoria mais vendida e itens para repor.

## Alertas operacionais

1. Usuario acessa `/dashboard`.
2. Sistema exige usuario autenticado e organizacao atual.
3. Sistema usa o mes atual como periodo padrao.
4. Usuario pode alterar o filtro para hoje, semana atual, mes atual, mes passado ou intervalo personalizado simples.
5. Sistema calcula cards reais da organizacao atual, sempre filtrando por `organization_id`.
6. Equipe acompanha faturamento, receita de manutencoes, receita de vendas, tickets medios, manutencoes abertas, atrasadas, aguardando peca e prontas para entrega.
7. Equipe acompanha vendas por produto/modelo, itens para repor, clientes novos e garantias.
8. Em alertas importantes, usuario pode abrir a OS relacionada.

## Uso mobile

1. Usuario acessa o painel em celular ou tablet.
2. Sistema mostra menu recolhivel no topo em vez da sidebar lateral.
3. Usuario navega por dashboard, clientes, manutencoes, manutencao rapida, mensagens e configuracoes.
4. Listagens grandes aparecem em cards no mobile para evitar tabela espremida.
5. Formularios mostram campos e botoes maiores para toque.
6. Quiosque continua sem elementos administrativos e funciona em celular/tablet.
