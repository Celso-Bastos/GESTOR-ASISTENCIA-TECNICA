-- Campos opcionais; preserva registros, RLS e os fluxos de cadastro mínimo.
alter table public.customers
  add column if not exists address text null,
  add column if not exists birth_date date null;
