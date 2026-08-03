-- Fase 10 - Mensagens personalizadas para WhatsApp manual.
-- Nao inclua chaves, tokens ou dados reais nesta migration.

alter type public.message_type add value if not exists 'custom_message';

create table if not exists public.custom_message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text not null,
  context text not null default 'general',
  is_active boolean not null default true,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint custom_message_templates_context_chk
    check (context in ('maintenance', 'warranty', 'customer', 'sales', 'general'))
);

create index if not exists custom_message_templates_organization_id_idx
  on public.custom_message_templates (organization_id);

create index if not exists custom_message_templates_context_idx
  on public.custom_message_templates (context);

create index if not exists custom_message_templates_is_active_idx
  on public.custom_message_templates (is_active);

create index if not exists custom_message_templates_deleted_at_idx
  on public.custom_message_templates (deleted_at);

create index if not exists custom_message_templates_created_at_idx
  on public.custom_message_templates (created_at);

drop trigger if exists set_custom_message_templates_updated_at
  on public.custom_message_templates;

create trigger set_custom_message_templates_updated_at
before update on public.custom_message_templates
for each row execute function public.set_updated_at();

alter table public.custom_message_templates enable row level security;

create policy "Members can view custom message templates from their organizations"
on public.custom_message_templates
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert custom message templates into their organizations"
on public.custom_message_templates
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "Members can update custom message templates from their organizations"
on public.custom_message_templates
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
