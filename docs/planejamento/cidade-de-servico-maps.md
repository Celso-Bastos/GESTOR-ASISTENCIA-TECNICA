# Cidade de serviço e Google Maps

Cidade de serviço é utilizada para fornecer contexto geográfico aos endereços de clientes e gerar links rápidos do Google Maps.

Google Maps é aberto apenas quando o usuário clica no botão; não existe consulta automática nem API key nesta fase.

## Banco e implantação

Aplicar manualmente `supabase/migrations/0015_add_service_city.sql` depois das migrations anteriores, antes de disponibilizar a nova versão. A migration acrescenta somente `service_city text null` a `account_requests` e `organizations`. Não altera migrations antigas, dados existentes, defaults, grants ou RLS. Registros anteriores continuam nulos; nenhuma organização recebe Anajatuba automaticamente.

```sql
begin;
alter table public.account_requests add column if not exists service_city text null;
alter table public.organizations add column if not exists service_city text null;
commit;
```

Verificação após aplicação:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('account_requests', 'organizations')
  and column_name = 'service_city'
order by table_name;
```

Esperado: duas linhas, ambas `text` e `YES`.

## Solicitação, onboarding e configurações

`/criar-conta` exige Cidade de serviço, com trim e tamanho entre 2 e 120 caracteres. `Ex.: Anajatuba - MA` é somente um placeholder; outras cidades são aceitas. O valor é salvo em `account_requests.service_city` e mostrado em `/admin/solicitacoes-conta`, inclusive nas solicitações aprovadas. Pedidos antigos mostram `Não informada`.

Depois da aprovação, `/onboarding/organizacao` consulta no servidor o pedido aprovado do próprio `auth_user_id`, sem revisão pendente, e preenche a cidade para revisão. A criação copia o valor revisado para `organizations.service_city`. Contas antigas sem pedido podem informar a cidade manualmente ao criar uma organização.

Organizações antigas configuram a cidade em `/configuracoes`. Owner/admin pode definir, editar ou limpar o valor; employee apenas consulta. A action valida a sessão, a organização e o papel antes de usar o cliente administrativo, necessário porque as policies existentes não permitem UPDATE direto em `organizations`. Não aceita organization_id do formulário nem amplia grants/RLS.

Depois do onboarding, os links consultam somente a cidade atual da organização, nunca o pedido histórico. Alterar de Anajatuba para São Luís muda os links sem alterar os clientes ou a solicitação.

## Links e privacidade

`buildGoogleMapsAddressUrl` monta uma URL com origem fixa `https://www.google.com/maps/search/`, `api=1` e query codificada por `URLSearchParams`: endereço, cidade de serviço e Brasil. Endereço nulo/vazio não gera link. Sem cidade, o fallback é endereço e Brasil.

O componente `GoogleMapsAddressLink` aparece abaixo do endereço no formulário compartilhado de novo/editar cliente e no detalhe. No formulário, acompanha o texto digitado. É uma âncora comum com `target="_blank"` e `rel="noopener noreferrer"`, sem prefetch, SDK, fetch, geocoding, autocomplete ou nova dependência. O endereço continua opcional.

Não existe coluna de cidade no cliente nem `google_maps_url` persistida. Não há envio automático, exposição no quiosque ou inclusão dos endereços em logs. Ao clicar, o funcionário envia o endereço e o contexto geográfico ao Google para pesquisar; o resultado não garante uma localização exata.

## Testes

```sh
pnpm --filter web test:service-city
pnpm --filter web test:14a2
pnpm --filter web test:customers
pnpm --filter web test:14a
pnpm test:sql:service-city
pnpm test:sql:maintenance
pnpm lint
pnpm typecheck
pnpm build
```

As suítes SQL usam PGlite `0.5.16`, instalado como dependência de desenvolvimento ou disponível por `PGLITE_TEST_MODULE`. Consulte `fase-3-clientes.md` para preparação reproduzível. Não acessam Supabase remoto. No PowerShell com scripts bloqueados, use `pnpm.cmd`.

Homologação manual: criar e aprovar uma solicitação com cidade, revisar a cidade preenchida no onboarding, concluir a organização, criar/editar cliente com e sem endereço e conferir o Maps em desktop/mobile. Alterar a cidade nas configurações e confirmar a nova query. Conferir uma organização antiga sem cidade, o fallback, a ocultação do botão com endereço vazio e a restrição de edição para employee. Abrir DevTools/Network e confirmar ausência de requisições ao Google antes do clique. Revalidar manutenção rápida/completa.
