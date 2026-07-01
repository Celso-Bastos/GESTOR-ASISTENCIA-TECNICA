-- Fase 3 - Permite reutilizar telefone de cliente removido por soft delete.
-- A duplicidade continua bloqueada para clientes ativos da mesma organizacao.

alter table public.customers
drop constraint if exists customers_organization_id_phone_normalized_key;

create unique index if not exists customers_active_phone_normalized_unique
on public.customers (organization_id, phone_normalized)
where deleted_at is null;
