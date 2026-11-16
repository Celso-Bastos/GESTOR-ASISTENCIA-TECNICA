-- Fase 14A.2. Aplicar manualmente; não contém dados de administradores.
begin;

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.account_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 3 and 160),
  email text not null check (char_length(email) <= 254),
  email_normalized text not null check (email_normalized = lower(btrim(email)) and email_normalized <> ''),
  phone text null,
  phone_normalized text null,
  business_name text null check (char_length(business_name) <= 160),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id),
  invite_sent_at timestamptz null,
  auth_user_id uuid null references auth.users(id),
  rejection_reason text null check (char_length(rejection_reason) <= 1000),
  -- Reserva durável: um convite externo não participa da transação PostgreSQL.
  -- Não expira automaticamente: uma falha ambígua exige conciliação manual.
  review_started_at timestamptz null
);

create unique index account_requests_pending_email_unique
  on public.account_requests (email_normalized) where status = 'pending';
create index account_requests_status_created_at_idx
  on public.account_requests (status, created_at desc);

create function public.touch_account_request_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger account_requests_updated_at before update on public.account_requests
  for each row execute function public.touch_account_request_updated_at();

alter table public.platform_admins enable row level security;
alter table public.account_requests enable row level security;

-- Um usuário só pode verificar o próprio cadastro de administrador.
-- Nenhuma escrita por anon/authenticated, nem mesmo por platform admins.
revoke all on public.platform_admins, public.account_requests from anon, authenticated;
grant select on public.platform_admins, public.account_requests to authenticated;
grant all on public.platform_admins, public.account_requests to service_role;

create policy platform_admins_read_self on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));
create policy account_requests_platform_admin_read on public.account_requests
  for select to authenticated using (
    exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
  );

-- Consulta pontual ao Auth; não pagina nem expõe a lista de usuários.
-- Exclusiva do servidor com a chave secreta (service_role).
create function public.find_account_auth_user(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(btrim(email)) = lower(btrim(p_email)) limit 1;
$$;
revoke all on function public.find_account_auth_user(text) from public, anon, authenticated;
grant execute on function public.find_account_auth_user(text) to service_role;
revoke all on function public.touch_account_request_updated_at() from public, anon, authenticated;

commit;
