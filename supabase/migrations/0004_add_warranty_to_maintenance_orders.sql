-- Fase 9 - Garantia em ordens de manutencao.
-- Nao inclua chaves, tokens ou dados reais nesta migration.

alter type public.message_type add value if not exists 'warranty_notice';

alter table public.maintenance_orders
  add column if not exists warranty_enabled boolean not null default false,
  add column if not exists warranty_signed boolean not null default false,
  add column if not exists warranty_amount integer,
  add column if not exists warranty_unit text,
  add column if not exists warranty_started_at date,
  add column if not exists warranty_expires_at date,
  add column if not exists warranty_notes text,
  add column if not exists warranty_message_sent_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_orders_warranty_amount_positive_chk'
  ) then
    alter table public.maintenance_orders
      add constraint maintenance_orders_warranty_amount_positive_chk
      check (warranty_amount is null or warranty_amount > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_orders_warranty_unit_chk'
  ) then
    alter table public.maintenance_orders
      add constraint maintenance_orders_warranty_unit_chk
      check (warranty_unit is null or warranty_unit in ('days', 'months'));
  end if;
end;
$$;

drop function if exists public.create_maintenance_order(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  numeric,
  text
);

create or replace function public.create_maintenance_order(
  p_organization_id uuid,
  p_customer_id uuid,
  p_created_by uuid,
  p_device_brand text,
  p_device_model text,
  p_device_color text,
  p_device_storage text,
  p_device_imei text,
  p_device_notes text,
  p_reported_issue text,
  p_expected_delivery_date date,
  p_estimated_price numeric,
  p_internal_notes text,
  p_warranty_enabled boolean default false,
  p_warranty_signed boolean default false,
  p_warranty_amount integer default null,
  p_warranty_unit text default null,
  p_warranty_started_at date default null,
  p_warranty_expires_at date default null,
  p_warranty_notes text default null
)
returns table (
  order_id uuid,
  order_number text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_device_id uuid;
  v_next_number integer;
  v_order_id uuid;
  v_order_number text;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Usuario nao pertence a organizacao informada.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.organization_id = p_organization_id
      and c.deleted_at is null
  ) then
    raise exception 'Cliente invalido para esta organizacao.'
      using errcode = '23503';
  end if;

  if p_warranty_enabled then
    if p_warranty_amount is null
      or p_warranty_unit is null
      or p_warranty_started_at is null
      or p_warranty_expires_at is null
    then
      raise exception 'Garantia ativa exige quantidade, unidade, inicio e validade.'
        using errcode = '23514';
    end if;

    if p_warranty_amount <= 0 then
      raise exception 'Quantidade de garantia invalida.'
        using errcode = '23514';
    end if;

    if p_warranty_unit not in ('days', 'months') then
      raise exception 'Unidade de garantia invalida.'
        using errcode = '23514';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    ('x' || substr(md5(p_organization_id::text), 1, 16))::bit(64)::bigint
  );

  select coalesce(max(substring(mo.order_number from '^OS-(\d+)$')::integer), 0) + 1
  into v_next_number
  from public.maintenance_orders mo
  where mo.organization_id = p_organization_id;

  v_order_number := 'OS-' || lpad(v_next_number::text, 6, '0');

  insert into public.devices (
    organization_id,
    customer_id,
    brand,
    model,
    color,
    storage,
    imei,
    notes
  )
  values (
    p_organization_id,
    p_customer_id,
    nullif(p_device_brand, ''),
    p_device_model,
    nullif(p_device_color, ''),
    nullif(p_device_storage, ''),
    nullif(p_device_imei, ''),
    nullif(p_device_notes, '')
  )
  returning id into v_device_id;

  insert into public.maintenance_orders (
    organization_id,
    customer_id,
    device_id,
    order_number,
    reported_issue,
    status,
    expected_delivery_date,
    estimated_price,
    internal_notes,
    warranty_enabled,
    warranty_signed,
    warranty_amount,
    warranty_unit,
    warranty_started_at,
    warranty_expires_at,
    warranty_notes
  )
  values (
    p_organization_id,
    p_customer_id,
    v_device_id,
    v_order_number,
    p_reported_issue,
    'recebido',
    p_expected_delivery_date,
    p_estimated_price,
    nullif(p_internal_notes, ''),
    coalesce(p_warranty_enabled, false),
    coalesce(p_warranty_signed, false),
    case when coalesce(p_warranty_enabled, false) then p_warranty_amount else null end,
    case when coalesce(p_warranty_enabled, false) then p_warranty_unit else null end,
    case when coalesce(p_warranty_enabled, false) then p_warranty_started_at else null end,
    case when coalesce(p_warranty_enabled, false) then p_warranty_expires_at else null end,
    case when coalesce(p_warranty_enabled, false) then nullif(p_warranty_notes, '') else null end
  )
  returning id into v_order_id;

  insert into public.maintenance_events (
    organization_id,
    maintenance_order_id,
    event_type,
    old_status,
    new_status,
    description,
    created_by
  )
  values (
    p_organization_id,
    v_order_id,
    'created',
    null,
    'recebido',
    'Ordem ' || v_order_number || ' criada com status Recebido.',
    p_created_by
  );

  return query select v_order_id, v_order_number;
end;
$$;

grant execute on function public.create_maintenance_order(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  numeric,
  text,
  boolean,
  boolean,
  integer,
  text,
  date,
  date,
  text
) to authenticated;
