-- Contexto operacional opcional para registros antigos. Sem backfill de cidade.
begin;

alter table public.account_requests
  add column if not exists service_city text null;

alter table public.organizations
  add column if not exists service_city text null;

commit;
