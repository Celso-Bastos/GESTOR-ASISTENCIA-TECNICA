-- Fase 1 - Schema inicial do MVP de gerenciamento de assistencia tecnica.
-- Este arquivo deve ser revisado e aplicado manualmente no Supabase.
-- Nao inclua chaves, tokens ou dados reais nesta migration.

create extension if not exists pgcrypto;

-- Enums de dominio do MVP.
create type public.user_role as enum (
  'owner',
  'admin',
  'employee'
);

create type public.customer_source as enum (
  'manual',
  'tablet',
  'future_import'
);

create type public.maintenance_status as enum (
  'recebido',
  'em_analise',
  'aguardando_peca',
  'em_manutencao',
  'pronto_para_entrega',
  'entregue',
  'cancelado'
);

create type public.message_type as enum (
  'maintenance_received',
  'maintenance_ready',
  'maintenance_reminder',
  'delivery_today',
  'promotion_future',
  'sales_future'
);

create type public.message_channel as enum (
  'whatsapp_manual',
  'whatsapp_api_future',
  'sms_future',
  'email_future'
);

-- Tabelas de organizacao e usuarios.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.user_role not null default 'employee',
  created_at timestamptz default now(),
  unique (organization_id, user_id)
);

-- Clientes, aparelhos e ordens de manutencao.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  phone text not null,
  phone_normalized text not null,
  whatsapp_opt_in boolean default false,
  whatsapp_opt_in_at timestamptz,
  source public.customer_source not null default 'manual',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique (organization_id, phone_normalized)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete cascade not null,
  brand text,
  model text,
  color text,
  storage text,
  imei text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.maintenance_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete restrict not null,
  device_id uuid references public.devices(id) on delete restrict not null,
  order_number text not null,
  reported_issue text not null,
  diagnosis text,
  status public.maintenance_status not null default 'recebido',
  expected_delivery_date date,
  delivered_at timestamptz,
  estimated_price numeric(10, 2),
  final_price numeric(10, 2),
  internal_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique (organization_id, order_number)
);

create table public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  maintenance_order_id uuid references public.maintenance_orders(id) on delete cascade not null,
  event_type text not null,
  old_status public.maintenance_status,
  new_status public.maintenance_status,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Mensagens prontas e historico de abertura manual do WhatsApp.
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  type public.message_type not null,
  title text not null,
  body text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, type)
);

create table public.message_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  customer_id uuid references public.customers(id),
  maintenance_order_id uuid references public.maintenance_orders(id),
  message_type public.message_type not null,
  channel public.message_channel not null default 'whatsapp_manual',
  message_body text not null,
  opened_whatsapp_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Tokens para tablet/quiosque. O token deve ser gerado no servidor, nunca exposto em repositorio.
create table public.kiosk_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  token text unique not null,
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

-- Indices uteis para consultas do MVP.
create index customers_organization_id_idx on public.customers (organization_id);
create index customers_phone_normalized_idx on public.customers (phone_normalized);
create index maintenance_orders_organization_id_idx on public.maintenance_orders (organization_id);
create index maintenance_orders_status_idx on public.maintenance_orders (status);
create index maintenance_orders_expected_delivery_date_idx on public.maintenance_orders (expected_delivery_date);
create index maintenance_events_maintenance_order_id_idx on public.maintenance_events (maintenance_order_id);
create index kiosk_tokens_token_idx on public.kiosk_tokens (token);

-- Funcao reutilizavel para manter updated_at atualizado em alteracoes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger set_devices_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

create trigger set_maintenance_orders_updated_at
before update on public.maintenance_orders
for each row execute function public.set_updated_at();

create trigger set_message_templates_updated_at
before update on public.message_templates
for each row execute function public.set_updated_at();

-- Helper de RLS. SECURITY DEFINER evita recursao ao consultar organization_members.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
  );
$$;

grant execute on function public.is_org_member(uuid) to authenticated;

-- Row Level Security.
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.devices enable row level security;
alter table public.maintenance_orders enable row level security;
alter table public.maintenance_events enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_logs enable row level security;
alter table public.kiosk_tokens enable row level security;

create policy "Members can view their organizations"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Members can view members from their organizations"
on public.organization_members
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can view customers from their organizations"
on public.customers
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert customers into their organizations"
on public.customers
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "Members can update customers from their organizations"
on public.customers
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "Members can view devices from their organizations"
on public.devices
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert devices into their organizations"
on public.devices
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.customers c
    where c.id = public.devices.customer_id
      and c.organization_id = public.devices.organization_id
  )
);

create policy "Members can update devices from their organizations"
on public.devices
for update
to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.customers c
    where c.id = public.devices.customer_id
      and c.organization_id = public.devices.organization_id
  )
);

create policy "Members can view maintenance orders from their organizations"
on public.maintenance_orders
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert maintenance orders into their organizations"
on public.maintenance_orders
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.customers c
    where c.id = public.maintenance_orders.customer_id
      and c.organization_id = public.maintenance_orders.organization_id
  )
  and exists (
    select 1
    from public.devices d
    where d.id = public.maintenance_orders.device_id
      and d.organization_id = public.maintenance_orders.organization_id
      and d.customer_id = public.maintenance_orders.customer_id
  )
);

create policy "Members can update maintenance orders from their organizations"
on public.maintenance_orders
for update
to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.customers c
    where c.id = public.maintenance_orders.customer_id
      and c.organization_id = public.maintenance_orders.organization_id
  )
  and exists (
    select 1
    from public.devices d
    where d.id = public.maintenance_orders.device_id
      and d.organization_id = public.maintenance_orders.organization_id
      and d.customer_id = public.maintenance_orders.customer_id
  )
);

create policy "Members can view maintenance events from their organizations"
on public.maintenance_events
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert maintenance events into their organizations"
on public.maintenance_events
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.maintenance_orders mo
    where mo.id = public.maintenance_events.maintenance_order_id
      and mo.organization_id = public.maintenance_events.organization_id
  )
);

create policy "Members can view message templates from their organizations"
on public.message_templates
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert message templates into their organizations"
on public.message_templates
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "Members can update message templates from their organizations"
on public.message_templates
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "Members can view message logs from their organizations"
on public.message_logs
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert message logs into their organizations"
on public.message_logs
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    public.message_logs.customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = public.message_logs.customer_id
        and c.organization_id = public.message_logs.organization_id
    )
  )
  and (
    public.message_logs.maintenance_order_id is null
    or exists (
      select 1
      from public.maintenance_orders mo
      where mo.id = public.message_logs.maintenance_order_id
        and mo.organization_id = public.message_logs.organization_id
    )
  )
);

create policy "Members can view kiosk tokens from their organizations"
on public.kiosk_tokens
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert kiosk tokens into their organizations"
on public.kiosk_tokens
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "Members can update kiosk tokens from their organizations"
on public.kiosk_tokens
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "Members can delete kiosk tokens from their organizations"
on public.kiosk_tokens
for delete
to authenticated
using (public.is_org_member(organization_id));
