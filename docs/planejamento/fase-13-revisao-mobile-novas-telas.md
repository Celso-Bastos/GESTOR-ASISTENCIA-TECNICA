# Fase 13 - Revisao mobile das novas telas

## Objetivo

Revisar as telas criadas nas fases recentes para melhorar responsividade,
usabilidade mobile e acessibilidade basica, sem alterar regras de negocio,
schema do banco, envio de WhatsApp ou calculos do dashboard.

## Paginas revisadas

- `/dashboard`
- `/manutencoes/[id]`
- `/manutencoes/[id]/editar`
- `/mensagens`
- `/saidas`
- `/saidas/nova`
- `/saidas/modelos`
- `/relatorios/reposicao`
- menu/header mobile do layout autenticado

## Principais melhorias mobile

- Dashboard: filtros e chamada principal com largura confortavel no celular.
- Dashboard: itens para repor aparecem em cards no mobile e tabela apenas em telas maiores.
- Relatorio de reposicao: resultado detalhado aparece em cards no mobile, evitando tabela espremida.
- Relatorio de reposicao: filtro de mes/categoria usa campos maiores no celular.
- Saidas/Vendas: filtros usam campos maiores no celular e acoes destrutivas mantem area de toque confortavel.
- Menu mobile: dropdown com altura maxima e rolagem interna para nao cobrir a tela de forma ruim.
- Acessibilidade basica: foco visivel preservado, botoes com texto claro e alvos de toque maiores no mobile.

## Padrao por tamanho de tela

Celular:

- Conteudo em uma coluna.
- Cards para listas operacionais e relatorios.
- Campos de formulario com altura de 48px quando possivel.
- Botoes principais com largura total quando isso melhora o toque.
- Sem dependencia de scroll horizontal para leitura principal.

Tablet:

- Grids em duas colunas quando ha espaco.
- Tabelas podem aparecer a partir de larguras medias, com overflow controlado.

Notebook e PC:

- Mantem colunas multiplas no dashboard.
- Mantem tabelas para leitura densa em relatorios e listagens.
- Menu lateral fixo continua disponivel em desktop.

## Como testar no Chrome DevTools

1. Rode `pnpm dev`.
2. Abra `http://localhost:3000`.
3. Faca login com uma conta valida do ambiente local.
4. Abra DevTools e ative o modo responsivo.
5. Teste pelo menos estes tamanhos:
   - iPhone SE: 375 x 667
   - iPhone 12/13/14: 390 x 844
   - iPad/tablet: 768 x 1024
   - Desktop: 1366 x 768
6. Navegue pelas paginas revisadas e confirme:
   - sem scroll horizontal indevido;
   - botoes faceis de tocar;
   - formularios legiveis;
   - cards e tabelas sem conteudo cortado;
   - menu mobile abre, rola e permite logout.

## Como testar em celular real pela URL Network

1. Rode `pnpm dev -- --hostname 0.0.0.0`.
2. Confirme o IP local da maquina na mesma rede Wi-Fi.
3. No celular, abra `http://SEU-IP:3000`.
4. Faca login com uma conta de teste.
5. Navegue pelas paginas da fase.
6. Confirme que toques, selects, inputs de data, textareas e botoes de WhatsApp funcionam confortavelmente.

## Pendencias visuais

- Validar visualmente com dados reais de uma organizacao de teste, especialmente em OS com historico longo e mensagens personalizadas extensas.
- Caso existam modelos com nomes muito longos, confirmar que os cards continuam quebrando linha sem gerar scroll horizontal.
