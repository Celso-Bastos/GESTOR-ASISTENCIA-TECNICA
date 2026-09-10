-- Permite manutencao rapida sem telefone do cliente.
-- Telefones preenchidos continuam unicos por organizacao entre clientes ativos.
-- Execute o arquivo inteiro no SQL Editor do projeto Supabase usado pela Vercel.

begin;

drop index if exists public.customers_active_phone_normalized_unique;

alter table public.customers
alter column phone drop not null,
alter column phone_normalized drop not null;

create unique index customers_active_phone_normalized_unique
on public.customers (organization_id, phone_normalized)
where deleted_at is null
  and phone_normalized is not null;

-- A notificacao so e entregue apos o commit das alteracoes.
notify pgrst, 'reload schema';
commit;
