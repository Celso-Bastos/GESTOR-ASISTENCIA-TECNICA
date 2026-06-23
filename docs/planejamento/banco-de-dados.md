# Banco de Dados

Planejamento inicial para Supabase/PostgreSQL. A implementacao real das migrations fica para a Fase 1.

## Entidades previstas

- `profiles`: dados do usuario autenticado e papel operacional.
- `customers`: clientes com nome, telefone e origem do cadastro.
- `devices`: aparelhos vinculados a clientes.
- `maintenances`: ordens de manutencao, status e informacoes do atendimento.
- `maintenance_events`: historico de eventos da manutencao.
- `message_templates`: mensagens prontas para WhatsApp manual.
- `alerts`: alertas operacionais de entrega e manutencao.

## Diretrizes

- Usar UUID como chave primaria.
- Usar `created_at` e `updated_at` nas tabelas principais.
- Ativar RLS antes de qualquer uso em producao.
- Evitar armazenar dados pessoais desnecessarios.
- Normalizar telefone para facilitar busca e evitar duplicidade.
