# Fase 1 - Supabase

## Objetivo

Configurar a base real do Supabase para autenticacao, banco de dados, seguranca e dados minimos de desenvolvimento.

## Tarefas previstas

- Definir schema inicial.
- Criar migrations para tabelas principais.
- Ativar RLS.
- Criar policies por entidade.
- Configurar auth e profiles.
- Criar seed minimo para desenvolvimento.
- Documentar variaveis de ambiente.

## Tabelas candidatas

- `profiles`
- `customers`
- `devices`
- `maintenances`
- `maintenance_events`
- `message_templates`
- `alerts`

## Criterios de aceite

- Migrations executam em ambiente limpo.
- RLS ativado nas tabelas protegidas.
- Usuario autenticado acessa apenas dados permitidos.
- Nenhuma chave real aparece no repositorio.
