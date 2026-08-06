# Fase 11 - Saidas/Vendas Modulares

## Objetivo

Implementar um controle simples de saidas/vendas de produtos de balcao, como peliculas, capinhas, carregadores, fones, cabos e acessorios.

O modulo responde o que saiu no periodo e quanto foi vendido, ajudando a equipe a repor itens no fim do mes.

## Saida modular x estoque fixo

Saida/venda modular registra apenas o produto vendido, modelo, quantidade, valor unitario, data e cliente opcional.

Estoque fixo tradicional controlaria entradas, saldo atual, custo medio, fornecedor, fiscal e lucro liquido real. Esses pontos nao fazem parte desta fase.

## Produtos base

Categorias fixas:

- `charger`: Carregador
- `earphone`: Fone
- `bluetooth_earphone`: Fone Bluetooth
- `screen_protector`: Pelicula
- `cable`: Cabo
- `case`: Capinha
- `keyboard`: Teclado
- `other`: Outro

## Modelos salvos

Modelos recorrentes ficam em `product_model_templates`.

Cada modelo pertence a organizacao atual, tem categoria, nome, preco padrao opcional e status ativo/inativo.

O sistema evita modelo ativo duplicado por organizacao, categoria e nome normalizado.

## Produto esporadico

Uma saida pode ser registrada com modelo digitado sem salvar modelo.

Exemplo: uma capinha vendida uma unica vez pode entrar em `product_outflows.custom_model_name` e nao aparecer em `/saidas/modelos`.

## Salvar modelo a partir da saida

Quando o usuario registra uma saida com modelo digitado e marca "Salvar este modelo para usar depois", a action cria ou reaproveita um modelo salvo ativo da mesma organizacao e categoria.

O `default_price` do modelo salvo recebe o `unit_price` informado na saida.

## Relatorio de reposicao

A rota `/relatorios/reposicao` agrupa `product_outflows` do mes por categoria e modelo, ignorando linhas com `deleted_at` preenchido.

O relatorio mostra:

- produto;
- modelo;
- quantidade que saiu;
- valor total vendido;
- total de unidades vendidas;
- total vendido no mes;
- categoria mais vendida;
- quantidade de itens/modelos para repor.

## Limitacoes do MVP

- Nao ha entrada de estoque.
- Nao ha saldo atual exato.
- Nao ha custo medio.
- Nao ha fornecedor.
- Nao ha lucro liquido real.
- Nao ha fiscal.
- Cards profissionais de vendas no dashboard ficam para a Fase 12.
- Nao ha campanha em massa.
- Nao ha WhatsApp API oficial.
- Nao ha envio automatico.

## Estoque futuro

Estoque fixo completo fica para fase futura, quando o cliente precisar controlar compras, entradas, fornecedor, custo, saldo e margem.
