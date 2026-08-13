# Fase 11 - Saidas/Vendas Modulares

## Objetivo

Implementar um controle simples de saidas/vendas de produtos de balcao, como peliculas, cases, carregadores, fones, cabos e acessorios.

O modulo responde o que saiu no periodo e quanto foi vendido, ajudando a equipe a repor itens no fim do mes.

## Saida modular x estoque fixo

Saida/venda modular registra apenas o produto vendido, modelo, quantidade, valor unitario, data e cliente opcional.

Estoque fixo tradicional controlaria entradas, saldo atual, custo medio, fornecedor, fiscal e lucro liquido real. Esses pontos nao fazem parte desta fase.

## Produtos base

Categorias fixas:

- `charger`: Carregador
- `earphone`: Fone
- `bluetooth_earphone`: Fone Bluetooth
- `screen_protector`: Película
- `privacy_screen_protector`: Película privativa
- `cable`: Cabo
- `case`: Case
- `keyboard`: Teclado
- `other`: Outro

Valores base definidos em constantes no codigo para o MVP:

- `screen_protector`: `10`
- `privacy_screen_protector`: `20`
- `case`: `20`
- `charger`: `30`
- `cable`: `15`
- `earphone`, `bluetooth_earphone`, `keyboard` e `other`: `null`, sem valor base definido nesta fase.

## Produtos/modelos cadastrados

Produtos/modelos recorrentes ficam em `product_model_templates` e sao administrados em `/saidas/modelos`, com o titulo "Produtos cadastrados".

Cada produto/modelo pertence a organizacao atual, tem categoria, nome/modelo, valor proprio opcional e status ativo/inativo.

O sistema permite criar, editar, desativar, buscar por nome e filtrar por categoria. Tambem evita produto/modelo ativo duplicado por organizacao, categoria e nome normalizado.

Exemplo:

- categoria: `screen_protector` (Película);
- nome/modelo: `iPhone 11`;
- valor base da categoria: `10,00`;
- valor do modelo: `15,00`;
- ativo: `true`.

Exemplo com pelicula privativa:

- categoria: `privacy_screen_protector` (Película privativa);
- nome/modelo: `iPhone 13`;
- valor base da categoria: `20,00`;
- valor do modelo: `35,00`;
- ativo: `true`.

## Valor base x valor do modelo x valor da saida

O valor base da categoria fica em constante no codigo e nao cria tabela nova nesta fase.

O `default_price` em `product_model_templates` e o valor proprio opcional do modelo salvo.

Ao selecionar apenas uma categoria em `/saidas/nova`, o formulario sugere o valor base da categoria.

Ao selecionar um produto/modelo salvo em `/saidas/nova`, o formulario preenche automaticamente categoria e modelo. Se o modelo tiver `default_price`, esse valor e sugerido; se nao tiver, o formulario usa o valor base da categoria.

O campo de valor unitario continua editavel. Alterar esse valor na venda altera somente aquela linha em `product_outflows.unit_price`; nao altera o valor base da categoria nem `product_model_templates.default_price`.

O `total_price` da saida continua sendo calculado no servidor como `quantity * unit_price`. O formulario nao envia nem define o total confiavel.

## Produto esporadico

Uma saida pode ser registrada com modelo digitado sem salvar modelo.

Exemplo: um case vendido uma unica vez pode entrar em `product_outflows.custom_model_name` e nao aparecer em `/saidas/modelos`.

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

## Copiar lista para reposicao

A rota `/relatorios/reposicao` gera server-side uma lista textual com base no relatorio ja filtrado por mes e categoria.

O botao "Copiar lista para reposicao" usa a Clipboard API no navegador e mostra "Lista copiada!" quando a copia funciona.

Se o navegador bloquear a area de transferencia, a tela mostra um fallback com textarea selecionavel e a mensagem "Nao foi possivel copiar. Selecione e copie manualmente.".

Formato:

```text
Lista para reposicao - Agosto/2026

Película
* iPhone 11: 8 unidades

Película privativa
* iPhone 13: 2 unidades

Total de unidades: 10
Total vendido: R$ 270,00
```

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
