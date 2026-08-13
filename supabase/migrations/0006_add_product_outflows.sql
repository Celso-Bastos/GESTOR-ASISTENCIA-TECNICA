-- Fase 11 - Saidas/vendas modulares de produtos.
-- Nao inclua chaves, tokens ou dados reais nesta migration.

create table if not exists public.product_model_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null,
  model_name text not null,
  default_price numeric(10, 2) null,
  is_active boolean not null default true,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint product_model_templates_category_chk
    check (category in (
      'charger',
      'earphone',
      'bluetooth_earphone',
      'screen_protector',
      'privacy_screen_protector',
      'cable',
      'case',
      'keyboard',
      'other'
    )),
  constraint product_model_templates_default_price_chk
    check (default_price is null or default_price >= 0),
  constraint product_model_templates_model_name_chk
    check (btrim(model_name) <> '')
);

create table if not exists public.product_outflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null,
  model_template_id uuid null references public.product_model_templates(id) on delete set null,
  custom_model_name text null,
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null default 0,
  total_price numeric(10, 2) not null default 0,
  sold_at date not null default current_date,
  customer_id uuid null references public.customers(id) on delete set null,
  notes text null,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint product_outflows_category_chk
    check (category in (
      'charger',
      'earphone',
      'bluetooth_earphone',
      'screen_protector',
      'privacy_screen_protector',
      'cable',
      'case',
      'keyboard',
      'other'
    )),
  constraint product_outflows_quantity_chk check (quantity > 0),
  constraint product_outflows_unit_price_chk check (unit_price >= 0),
  constraint product_outflows_total_price_chk check (total_price >= 0),
  constraint product_outflows_model_required_chk
    check (
      model_template_id is not null
      or nullif(btrim(coalesce(custom_model_name, '')), '') is not null
    ),
  constraint product_outflows_custom_model_name_chk
    check (
      custom_model_name is null
      or btrim(custom_model_name) <> ''
    )
);

create index if not exists product_model_templates_organization_id_idx
  on public.product_model_templates (organization_id);

create index if not exists product_model_templates_category_idx
  on public.product_model_templates (category);

create index if not exists product_model_templates_deleted_at_idx
  on public.product_model_templates (deleted_at);

create unique index if not exists product_model_templates_active_unique_idx
  on public.product_model_templates (
    organization_id,
    category,
    lower(btrim(model_name))
  )
  where deleted_at is null and is_active = true;

create index if not exists product_outflows_organization_id_idx
  on public.product_outflows (organization_id);

create index if not exists product_outflows_category_idx
  on public.product_outflows (category);

create index if not exists product_outflows_sold_at_idx
  on public.product_outflows (sold_at);

create index if not exists product_outflows_deleted_at_idx
  on public.product_outflows (deleted_at);

create index if not exists product_outflows_model_template_id_idx
  on public.product_outflows (model_template_id);

drop trigger if exists set_product_model_templates_updated_at
  on public.product_model_templates;

create trigger set_product_model_templates_updated_at
before update on public.product_model_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_product_outflows_updated_at
  on public.product_outflows;

create trigger set_product_outflows_updated_at
before update on public.product_outflows
for each row execute function public.set_updated_at();

alter table public.product_model_templates enable row level security;
alter table public.product_outflows enable row level security;

create policy "Members can view product model templates from their organizations"
on public.product_model_templates
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert product model templates into their organizations"
on public.product_model_templates
for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "Members can update product model templates from their organizations"
on public.product_model_templates
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "Members can view product outflows from their organizations"
on public.product_outflows
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can insert product outflows into their organizations"
on public.product_outflows
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    model_template_id is null
    or exists (
      select 1
      from public.product_model_templates pmt
      where pmt.id = public.product_outflows.model_template_id
        and pmt.organization_id = public.product_outflows.organization_id
        and pmt.deleted_at is null
    )
  )
  and (
    customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = public.product_outflows.customer_id
        and c.organization_id = public.product_outflows.organization_id
        and c.deleted_at is null
    )
  )
);

create policy "Members can update product outflows from their organizations"
on public.product_outflows
for update
to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and (
    model_template_id is null
    or exists (
      select 1
      from public.product_model_templates pmt
      where pmt.id = public.product_outflows.model_template_id
        and pmt.organization_id = public.product_outflows.organization_id
        and pmt.deleted_at is null
    )
  )
  and (
    customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = public.product_outflows.customer_id
        and c.organization_id = public.product_outflows.organization_id
        and c.deleted_at is null
    )
  )
);
