-- Atualização 1: saldo por modelo e auditoria integrada às saídas existentes.
-- Aplicar depois de 0016. Não reconstrói saldos usando vendas históricas.
begin;

alter table public.product_model_templates
  add column stock_quantity integer not null default 0,
  add column minimum_stock integer not null default 0 check (minimum_stock >= 0),
  add column unit_cost numeric(10,2) null check (unit_cost between 0 and 99999999.99);

-- Somente INSERTs futuros serão marcados pelo trigger; históricos ficam false.
alter table public.product_outflows
  add column inventory_tracked boolean not null default false;

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_model_template_id uuid not null references public.product_model_templates(id),
  movement_type text not null check (movement_type in ('opening_balance','entry','outflow','adjustment')),
  quantity integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  unit_cost numeric(10,2) null check (unit_cost between 0 and 99999999.99),
  reason text null,
  notes text null,
  product_outflow_id uuid null references public.product_outflows(id),
  created_by uuid null references auth.users(id),
  created_by_name text null,
  created_at timestamptz not null default now(),
  check (quantity_before::bigint + quantity::bigint = quantity_after::bigint),
  check (movement_type <> 'entry' or quantity > 0),
  check (movement_type <> 'outflow' or (quantity < 0 and product_outflow_id is not null))
);

create index inventory_movements_org_date_idx on public.inventory_movements(organization_id, created_at desc, id desc);
create index inventory_movements_product_date_idx on public.inventory_movements(product_model_template_id, created_at desc, id desc);
create index inventory_movements_outflow_idx on public.inventory_movements(product_outflow_id) where product_outflow_id is not null;
create unique index inventory_movements_one_opening_idx on public.inventory_movements(product_model_template_id) where movement_type = 'opening_balance';

alter table public.inventory_movements enable row level security;
create policy "Members can read inventory movements" on public.inventory_movements
  for select to authenticated using (public.is_org_member(organization_id));
revoke all on public.inventory_movements from public, anon, authenticated;
grant select on public.inventory_movements to authenticated;

-- Saldo só pode ser alterado pelas funções/trigger. Metadados continuam sob RLS.
revoke update on public.product_model_templates from public, anon, authenticated;
grant update(category, model_name, default_price, is_active, minimum_stock, unit_cost, deleted_at)
  on public.product_model_templates to authenticated;
revoke update on public.product_outflows from public, anon, authenticated;
grant update(category, model_template_id, custom_model_name, quantity, unit_price, total_price,
  sold_at, customer_id, notes, deleted_at) on public.product_outflows to authenticated;

-- VOLATILE consulta um snapshot atualizado: modelos digitados podem ter sido
-- criados pelo BEFORE trigger dentro do mesmo INSERT/UPDATE da saída.
create function public.inventory_outflow_links_valid(p_org uuid, p_model uuid, p_customer uuid)
returns boolean language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.is_org_member(p_org) then return false; end if;
  return (p_model is null or exists(select 1 from public.product_model_templates where id = p_model and organization_id = p_org))
    and (p_customer is null or exists(select 1 from public.customers where id = p_customer and organization_id = p_org));
end;
$$;
revoke all on function public.inventory_outflow_links_valid(uuid,uuid,uuid) from public, anon;
grant execute on function public.inventory_outflow_links_valid(uuid,uuid,uuid) to authenticated;

drop policy "Members can insert product outflows into their organizations" on public.product_outflows;
create policy "Members can insert product outflows into their organizations" on public.product_outflows
  for insert to authenticated with check (public.is_org_member(organization_id)
    and public.inventory_outflow_links_valid(organization_id, model_template_id, customer_id));

-- Compensações precisam funcionar mesmo após arquivar produto/cliente vinculado.
-- O trigger abaixo rejeita novos vínculos com registros arquivados.
drop policy "Members can update product outflows from their organizations" on public.product_outflows;
create policy "Members can update product outflows from their organizations" on public.product_outflows
  for update to authenticated using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id)
    and public.inventory_outflow_links_valid(organization_id, model_template_id, customer_id));

create function public.inventory_immutable() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'Histórico imutável: registre um novo ajuste.';
end;
$$;
create trigger inventory_movements_immutable before update or delete on public.inventory_movements
  for each row execute function public.inventory_immutable();

-- Helper privado. Bloqueia também produtos arquivados para poder compensar vendas.
create function public.apply_inventory_delta(
  p_org uuid, p_model uuid, p_type text, p_delta integer, p_cost numeric,
  p_reason text, p_notes text, p_outflow uuid default null
) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_product public.product_model_templates; v_after integer;
begin
  if auth.uid() is null or not public.is_org_member(p_org) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;
  select * into v_product from public.product_model_templates
    where id = p_model and organization_id = p_org for update;
  if not found then raise exception 'Produto não encontrado nesta organização.'; end if;
  v_after := v_product.stock_quantity + p_delta;
  insert into public.inventory_movements(organization_id, product_model_template_id,
    movement_type, quantity, quantity_before, quantity_after, unit_cost, reason, notes,
    product_outflow_id, created_by, created_by_name)
  values(p_org, p_model, p_type, p_delta, v_product.stock_quantity, v_after,
    coalesce(p_cost, v_product.unit_cost), p_reason, p_notes, p_outflow, auth.uid(),
    (select full_name from public.profiles where user_id = auth.uid()));
  update public.product_model_templates set stock_quantity = v_after,
    unit_cost = coalesce(p_cost, unit_cost) where id = p_model;
  return v_after;
end;
$$;
revoke all on function public.apply_inventory_delta(uuid,uuid,text,integer,numeric,text,text,uuid) from public, anon, authenticated;

create function public.register_inventory_movement(
  p_organization_id uuid, p_model_id uuid, p_movement_type text, p_quantity integer,
  p_unit_cost numeric default null, p_reason text default null, p_notes text default null
) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_product public.product_model_templates; v_delta integer;
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;
  if p_movement_type is null or p_movement_type not in ('opening_balance','entry','adjustment') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  if p_quantity is null or p_quantity < 0 or (p_movement_type = 'entry' and p_quantity = 0) then
    raise exception 'Quantidade inválida.';
  end if;
  if p_unit_cost is not null and not (p_unit_cost between 0 and 99999999.99) then
    raise exception 'Custo inválido.';
  end if;
  if length(coalesce(p_reason,'')) > 200 or length(coalesce(p_notes,'')) > 1000 then
    raise exception 'Motivo ou observação muito longo.';
  end if;
  if p_movement_type = 'adjustment' and nullif(btrim(p_reason),'') is null then
    raise exception 'Informe o motivo do ajuste.';
  end if;
  select * into v_product from public.product_model_templates
    where id = p_model_id and organization_id = p_organization_id and deleted_at is null for update;
  if not found then raise exception 'Produto não encontrado nesta organização.'; end if;
  if p_movement_type = 'opening_balance' and exists(select 1 from public.inventory_movements
    where product_model_template_id = p_model_id and movement_type = 'opening_balance') then
    raise exception 'Estoque inicial já definido. Utilize Ajustar estoque.';
  end if;
  -- Entrada recebe incremento; contagens recebem saldo final, calculado sob lock.
  v_delta := case when p_movement_type = 'entry' then p_quantity else p_quantity - v_product.stock_quantity end;
  return public.apply_inventory_delta(p_organization_id, p_model_id, p_movement_type, v_delta,
    p_unit_cost, coalesce(nullif(btrim(p_reason),''), case when p_movement_type = 'opening_balance' then 'Contagem inicial' else 'Entrada' end), p_notes);
end;
$$;
revoke all on function public.register_inventory_movement(uuid,uuid,text,integer,numeric,text,text) from public, anon;
grant execute on function public.register_inventory_movement(uuid,uuid,text,integer,numeric,text,text) to authenticated;

-- Estoque opcional na criação é uma contagem inicial, nunca uma compra fictícia.
create function public.initialize_product_inventory() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.stock_quantity < 0 then raise exception 'Estoque inicial deve ser não negativo.'; end if;
  if new.stock_quantity <> 0 then
    if auth.uid() is null or not public.is_org_member(new.organization_id) then
      raise exception 'Organização não autorizada.' using errcode = '42501';
    end if;
    insert into public.inventory_movements(organization_id, product_model_template_id,
      movement_type, quantity, quantity_before, quantity_after, unit_cost, reason, created_by, created_by_name)
    values(new.organization_id, new.id, 'opening_balance', new.stock_quantity, 0, new.stock_quantity,
      new.unit_cost, 'Contagem inicial no cadastro', auth.uid(),
      (select full_name from public.profiles where user_id = auth.uid()));
  end if;
  return new;
end;
$$;
create trigger initialize_product_inventory after insert on public.product_model_templates
  for each row execute function public.initialize_product_inventory();

-- Resolve modelos digitados para o mesmo catálogo. Não cria um estoque paralelo.
create function public.prepare_inventory_outflow() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_model public.product_model_templates;
begin
  if tg_op = 'DELETE' then raise exception 'Use o cancelamento lógico da saída.'; end if;
  if auth.uid() is null or not public.is_org_member(new.organization_id) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.inventory_tracked <> old.inventory_tracked then
      raise exception 'Organização e marco do estoque são imutáveis.';
    end if;
  else
    new.inventory_tracked := true;
    new.created_by := auth.uid();
  end if;
  if new.quantity is null or new.quantity <= 0 then raise exception 'Quantidade inválida.'; end if;
  new.total_price := new.quantity * new.unit_price;
  if new.customer_id is not null then
    if not exists(select 1 from public.customers where id = new.customer_id and organization_id = new.organization_id) then
      raise exception 'Cliente não encontrado nesta organização.';
    end if;
    if tg_op = 'INSERT' or new.customer_id is distinct from old.customer_id then
      if exists(select 1 from public.customers where id = new.customer_id and deleted_at is not null) then
        raise exception 'Cliente arquivado.';
      end if;
    end if;
  end if;
  if new.inventory_tracked and new.model_template_id is null then
    if nullif(btrim(new.custom_model_name),'') is null then raise exception 'Informe o modelo.'; end if;
    insert into public.product_model_templates(organization_id, category, model_name, default_price, created_by)
      values(new.organization_id, new.category, btrim(new.custom_model_name), new.unit_price, auth.uid())
      on conflict (organization_id, category, lower(btrim(model_name))) where deleted_at is null and is_active = true do nothing;
    select id into new.model_template_id from public.product_model_templates
      where organization_id = new.organization_id and category = new.category
      and lower(btrim(model_name)) = lower(btrim(new.custom_model_name)) and is_active and deleted_at is null;
  end if;
  if new.model_template_id is not null then
    select * into v_model from public.product_model_templates
      where id = new.model_template_id and organization_id = new.organization_id;
    if not found then raise exception 'Modelo não encontrado nesta organização.'; end if;
    if tg_op = 'INSERT' then
      if v_model.deleted_at is not null or not v_model.is_active then raise exception 'Modelo inativo.'; end if;
    elsif new.model_template_id is distinct from old.model_template_id then
      if v_model.deleted_at is not null or not v_model.is_active then raise exception 'Modelo inativo.'; end if;
    end if;
    new.category := v_model.category;
    new.custom_model_name := null;
  end if;
  return new;
end;
$$;
create trigger prepare_inventory_outflow before insert or update or delete on public.product_outflows
  for each row execute function public.prepare_inventory_outflow();

create function public.sync_outflow_inventory() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_delta integer;
begin
  if not new.inventory_tracked then return new; end if;
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      perform public.apply_inventory_delta(new.organization_id, new.model_template_id, 'outflow',
        -new.quantity, null, 'Venda/saída', new.notes, new.id);
    end if;
    return new;
  end if;
  -- Ordem estável evita deadlocks ao trocar produtos em duas edições simultâneas.
  perform id from public.product_model_templates where id in (old.model_template_id, new.model_template_id) order by id for update;
  if old.model_template_id = new.model_template_id then
    v_delta := (case when old.deleted_at is null then old.quantity else 0 end)
      - (case when new.deleted_at is null then new.quantity else 0 end);
    if v_delta <> 0 then
      perform public.apply_inventory_delta(new.organization_id, new.model_template_id, 'adjustment', v_delta, null,
        case when new.deleted_at is not null then 'Cancelamento de saída'
          when old.deleted_at is not null then 'Restauração de saída' else 'Edição de saída' end, new.notes, new.id);
    end if;
  else
    if old.deleted_at is null then
      perform public.apply_inventory_delta(old.organization_id, old.model_template_id, 'adjustment', old.quantity,
        null, 'Troca de produto na saída: devolução', new.notes, new.id);
    end if;
    if new.deleted_at is null then
      perform public.apply_inventory_delta(new.organization_id, new.model_template_id, 'outflow', -new.quantity,
        null, 'Troca de produto na saída', new.notes, new.id);
    end if;
  end if;
  return new;
end;
$$;
create trigger sync_outflow_inventory after insert or update on public.product_outflows
  for each row execute function public.sync_outflow_inventory();

revoke all on function public.inventory_immutable() from public, anon, authenticated;
revoke all on function public.initialize_product_inventory() from public, anon, authenticated;
revoke all on function public.prepare_inventory_outflow() from public, anon, authenticated;
revoke all on function public.sync_outflow_inventory() from public, anon, authenticated;
commit;
