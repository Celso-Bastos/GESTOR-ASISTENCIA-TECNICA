-- Atualização 3.1. Substitui a 0019 NÃO aplicada da versão 3.
-- Aplicar após 0018. Não introduz telefone global em organizations.
begin;

create function public.can_manage_inventory_suppliers(p_org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.organization_members
    where organization_id = p_org and user_id = auth.uid() and role in ('owner','admin'));
$$;
revoke all on function public.can_manage_inventory_suppliers(uuid) from public, anon;
grant execute on function public.can_manage_inventory_suppliers(uuid) to authenticated;

-- Chaves compostas impedem vínculos entre organizações mesmo fora das policies.
alter table public.product_model_templates
  add constraint product_models_org_id_unique unique(organization_id, id);

create table public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  whatsapp_phone text check (whatsapp_phone is null or whatsapp_phone ~ '^55[1-9][0-9][2-9][0-9]{7,8}$'),
  notes text check (notes is null or length(notes) <= 2000),
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_suppliers_org_id_unique unique(organization_id,id)
);
create index inventory_suppliers_org_active_name_idx on public.inventory_suppliers(organization_id,is_active,name,id);

create table public.inventory_product_suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_model_id uuid not null,
  supplier_id uuid not null,
  is_preferred boolean not null default false,
  supplier_unit_cost numeric(10,2) check (supplier_unit_cost between 0 and 99999999.99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_product_suppliers_product_fk foreign key(organization_id,product_model_id)
    references public.product_model_templates(organization_id,id),
  constraint inventory_product_suppliers_supplier_fk foreign key(organization_id,supplier_id)
    references public.inventory_suppliers(organization_id,id),
  constraint inventory_product_suppliers_unique unique(organization_id,product_model_id,supplier_id)
);
create index inventory_product_suppliers_supplier_idx on public.inventory_product_suppliers(organization_id,supplier_id,product_model_id);
create unique index inventory_product_suppliers_one_preferred_idx
  on public.inventory_product_suppliers(organization_id,product_model_id) where is_preferred;

create trigger inventory_suppliers_updated_at before update on public.inventory_suppliers
  for each row execute function public.set_updated_at();
create trigger inventory_product_suppliers_updated_at before update on public.inventory_product_suppliers
  for each row execute function public.set_updated_at();

alter table public.inventory_suppliers enable row level security;
alter table public.inventory_product_suppliers enable row level security;
create policy inventory_suppliers_read on public.inventory_suppliers
  for select to authenticated using (public.is_org_member(organization_id));
create policy inventory_suppliers_insert on public.inventory_suppliers
  for insert to authenticated with check (public.can_manage_inventory_suppliers(organization_id));
create policy inventory_suppliers_update on public.inventory_suppliers
  for update to authenticated using (public.can_manage_inventory_suppliers(organization_id))
  with check (public.can_manage_inventory_suppliers(organization_id));
create policy inventory_product_suppliers_read on public.inventory_product_suppliers
  for select to authenticated using (public.is_org_member(organization_id));
create policy inventory_product_suppliers_insert on public.inventory_product_suppliers
  for insert to authenticated with check (public.can_manage_inventory_suppliers(organization_id)
    and exists(select 1 from public.inventory_suppliers s where s.organization_id = inventory_product_suppliers.organization_id
      and s.id = supplier_id and s.is_active)
    and exists(select 1 from public.product_model_templates p where p.organization_id = inventory_product_suppliers.organization_id
      and p.id = product_model_id and p.deleted_at is null));
create policy inventory_product_suppliers_update on public.inventory_product_suppliers
  for update to authenticated using (public.can_manage_inventory_suppliers(organization_id))
  with check (public.can_manage_inventory_suppliers(organization_id)
    and exists(select 1 from public.inventory_suppliers s where s.organization_id = inventory_product_suppliers.organization_id
      and s.id = supplier_id and s.is_active));
create policy inventory_product_suppliers_delete on public.inventory_product_suppliers
  for delete to authenticated using (public.can_manage_inventory_suppliers(organization_id));

-- Fornecedor nunca é excluído pela API. Reativar/desativar preserva vínculos.
revoke all on public.inventory_suppliers, public.inventory_product_suppliers from public,anon,authenticated;
grant select on public.inventory_suppliers, public.inventory_product_suppliers to authenticated;
grant insert(organization_id,name,whatsapp_phone,notes,is_active) on public.inventory_suppliers to authenticated;
grant update(name,whatsapp_phone,notes,is_active) on public.inventory_suppliers to authenticated;
grant insert(organization_id,product_model_id,supplier_id,is_preferred,supplier_unit_cost) on public.inventory_product_suppliers to authenticated;
grant update(is_preferred,supplier_unit_cost) on public.inventory_product_suppliers to authenticated;
grant delete on public.inventory_product_suppliers to authenticated;

-- Alterar o preferencial e criar/remover vínculo em uma única transação.
-- Lock por produto serializa trocas simultâneas; índice parcial protege também DML direto.
create function public.set_inventory_product_supplier(p_organization_id uuid,p_product_model_id uuid,
  p_supplier_id uuid,p_operation text)
returns void language plpgsql security definer set search_path = public,pg_temp as $$
begin
  if auth.uid() is null or not public.can_manage_inventory_suppliers(p_organization_id) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;
  if p_operation is null or p_operation not in ('add','remove','prefer','unprefer') then raise exception 'Operação inválida.'; end if;
  perform 1 from public.product_model_templates where id=p_product_model_id
    and organization_id=p_organization_id and deleted_at is null for update;
  if not found then raise exception 'Produto não encontrado nesta organização.'; end if;
  perform 1 from public.inventory_suppliers where id=p_supplier_id and organization_id=p_organization_id
    and (p_operation in ('remove','unprefer') or is_active) for update;
  if not found then raise exception 'Fornecedor indisponível nesta organização.'; end if;
  if p_operation = 'remove' then
    delete from public.inventory_product_suppliers where organization_id=p_organization_id
      and product_model_id=p_product_model_id and supplier_id=p_supplier_id;
  elsif p_operation = 'unprefer' then
    update public.inventory_product_suppliers set is_preferred=false where organization_id=p_organization_id
      and product_model_id=p_product_model_id and supplier_id=p_supplier_id;
  else
    if p_operation = 'prefer' then
      update public.inventory_product_suppliers set is_preferred=false
        where organization_id=p_organization_id and product_model_id=p_product_model_id and is_preferred;
    end if;
    insert into public.inventory_product_suppliers(organization_id,product_model_id,supplier_id,is_preferred)
      values(p_organization_id,p_product_model_id,p_supplier_id,p_operation = 'prefer')
      on conflict(organization_id,product_model_id,supplier_id) do update
        set is_preferred=case when p_operation = 'prefer' then true else inventory_product_suppliers.is_preferred end;
      -- Repetir add não apaga uma preferência definida por outra ação.
  end if;
end;
$$;
revoke all on function public.set_inventory_product_supplier(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.set_inventory_product_supplier(uuid,uuid,uuid,text) to authenticated;

comment on column public.inventory_product_suppliers.supplier_unit_cost is
  'Custo de compra opcional reservado para evolução futura. Não é preço de venda e não gera total financeiro.';
commit;
