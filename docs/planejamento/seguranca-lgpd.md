# Seguranca e LGPD

## Dados pessoais

- Nome e telefone de clientes sao dados pessoais.
- Coletar apenas o necessario para atendimento.
- Evitar observacoes sensiveis ou dados que nao tenham finalidade operacional.

## Variaveis de ambiente

- Nunca commitar `.env`, `.env.local` ou chaves reais.
- `SUPABASE_SERVICE_ROLE_KEY` deve ficar apenas em ambiente seguro de servidor.
- Chaves anonimas publicas devem respeitar RLS e permissoes minimas.

## Supabase

- Ativar RLS em todas as tabelas com dados de usuarios ou clientes.
- Criar policies por perfil e necessidade real.
- Revisar policies antes do piloto.

## Operacao

- Mensagens do WhatsApp no MVP sao manuais.
- Nao armazenar conversas completas sem necessidade.
- Restringir acessos por papel assim que os modulos forem implementados.
