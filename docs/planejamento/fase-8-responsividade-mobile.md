# Fase 8 - Responsividade Mobile

## Objetivo

Melhorar o uso do sistema em celular, tablet, notebook e desktop sem alterar regras de negocio, schema, RLS ou fluxos de Supabase ja existentes.

## Paginas revisadas

- `/dashboard`
- `/clientes`
- `/manutencoes`
- `/manutencoes/rapida`
- `/manutencoes/nova`
- `/manutencoes/[id]`
- `/manutencoes/[id]/editar`
- `/mensagens`
- `/kiosk/[slug]`
- layout protegido do dashboard

## Decisoes de layout

- Desktop mantem sidebar lateral fixa.
- Mobile usa botao de menu no topo com navegacao recolhivel.
- O conteudo principal ganhou largura maxima para evitar linhas muito longas em telas grandes.
- Listagens de clientes e manutencoes continuam em tabela no desktop.
- No mobile, clientes e ordens de servico aparecem como cards com informacoes essenciais e acoes grandes.
- Formularios usam campos de 48px, labels visiveis, melhor espacamento e botoes em largura total no celular.
- O quiosque nao usa menu administrativo e foi ajustado para celular e tablet vertical/horizontal.

## Padrao desktop/mobile

- `md` ou maior: tabelas completas para leitura operacional.
- Abaixo de `md`: cards empilhados para evitar rolagem horizontal.
- `lg` ou maior: sidebar fixa.
- Abaixo de `lg`: header com menu recolhivel.

## Como testar no celular

1. Rode `pnpm dev`.
2. Abra o sistema pelo navegador do celular usando a URL de rede local exibida pelo Next.js.
3. Entre no sistema e teste:
   - menu no topo;
   - dashboard;
   - clientes em cards;
   - manutencoes em cards;
   - manutencao rapida;
   - detalhe da OS e botoes de WhatsApp;
   - mensagens;
   - link publico do quiosque.

## Como testar pelo IP da rede local

1. Inicie o Next.js expondo o host:

```bash
pnpm --filter web dev -- --hostname 0.0.0.0
```

2. No terminal, use a URL `Network` informada pelo Next.js, por exemplo:

```txt
http://192.168.0.10:3000
```

3. No celular, esteja na mesma rede Wi-Fi e acesse essa URL.
4. Confirme que o valor de `NEXT_PUBLIC_APP_URL` esta adequado para gerar links publicos quando necessario.

## Pendencias visuais

- Validar em aparelho fisico com dados reais de nomes/modelos longos.
- Revisar futuramente acentos corrompidos em textos exibidos, caso o projeto decida padronizar encoding/conteudo.
- Se o menu crescer muito, pode valer migrar o menu mobile de `details` para um drawer client-side com fechamento automatico.
