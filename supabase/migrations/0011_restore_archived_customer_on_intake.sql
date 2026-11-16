-- Requer migrations anteriores, inclusive 0010. Nao altera indices ou dados em lote.
-- Reativacao, aparelho, OS e evento pertencem a mesma transacao.
begin;

create or replace function public.create_maintenance_intake(
  p_organization_id uuid,
  p_request_id uuid,
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_input jsonb,
  p_quick boolean default false
)
returns table (order_id uuid, order_number text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer_id uuid := p_customer_id;
  v_phone text := nullif(btrim(p_customer_phone), '');
  v_normalized text;
  v_name text := nullif(btrim(p_customer_name), '');
  v_order record;
  v_attempt integer;
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'Organizacao indisponivel.' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'Identificador da tentativa obrigatorio.' using errcode = '22023';
  end if;
  -- Mesmo bloqueio da RPC de criacao: serializa numeracao e reenvios por loja.
  perform pg_advisory_xact_lock(
    ('x' || substr(md5(p_organization_id::text), 1, 16))::bit(64)::bigint
  );
  return query select mo.id, mo.order_number from public.maintenance_orders mo
    where mo.organization_id = p_organization_id and mo.intake_request_id = p_request_id;
  if found then return; end if;

  if p_input is null or jsonb_typeof(p_input) is distinct from 'object'
    or nullif(btrim(p_input->'device'->>'model'), '') is null
    or length(btrim(coalesce(p_input->>'reported_issue', ''))) < 3 then
    raise exception 'Informe modelo e defeito.' using errcode = '22023';
  end if;
  if v_customer_id is null then
    if not coalesce(p_quick, false) and v_name is null then
      raise exception 'Informe o nome do cliente.' using errcode = '22023';
    end if;
    if v_phone is not null then
      v_normalized := regexp_replace(v_phone, '[^0-9]', '', 'g');
      if length(v_normalized) in (12, 13) and left(v_normalized, 2) = '55' then
        v_normalized := substring(v_normalized from 3);
      end if;
      if length(v_normalized) not in (10, 11) then
        raise exception 'Telefone invalido.' using errcode = '22023';
      end if;
    end if;

    for v_attempt in 1..3 loop
      v_customer_id := null;
      begin
        if v_normalized is not null then
          -- Ativo tem prioridade e seus dados nao sao sobrescritos.
          select c.id into v_customer_id from public.customers c
            where c.organization_id = p_organization_id and c.phone_normalized = v_normalized
              and c.deleted_at is null
            limit 1 for update;
          if v_customer_id is not null then exit; end if;

          -- Indices parciais antigos permitem varios arquivados: escolha estavel
          -- do mais recentemente arquivado, sem mesclar ou apagar historico.
          select c.id into v_customer_id from public.customers c
            where c.organization_id = p_organization_id and c.phone_normalized = v_normalized
              and c.deleted_at is not null
            order by c.deleted_at desc, c.id
            limit 1 for update;
          if v_customer_id is not null then
            update public.customers c set
              deleted_at = null,
              name = coalesce(v_name, case
                when length(btrim(coalesce(c.name, ''))) between 2 and 120 then c.name
                else 'Cliente sem nome' end),
              phone = v_phone,
              phone_normalized = v_normalized
            where c.id = v_customer_id and c.organization_id = p_organization_id;
            if not found then
              raise exception 'Nao foi possivel reativar o cliente nesta organizacao.' using errcode = '42501';
            end if;
            exit;
          end if;
        end if;

        insert into public.customers (organization_id, name, phone, phone_normalized, source, notes, whatsapp_opt_in)
          values (p_organization_id,
            coalesce(v_name, case when v_phone is null then 'Cliente não informado' else 'Cliente sem nome' end),
            v_phone, v_normalized, 'manual',
            case when v_name is null and v_phone is null then
              'Cliente criado automaticamente pelo fluxo de manutenção rápida sem dados informados.' else null end,
            false)
          returning id into v_customer_id;
        exit;
      exception when unique_violation then
        -- Insert/reativacao concorrente fora desta RPC: o sub-bloco desfaz a
        -- tentativa e repete a busca de ativos E arquivados sob RLS.
        -- Limita repeticoes e preserva o erro tecnico se o conflito persistir.
        if v_normalized is null or v_attempt = 3 then raise; end if;
      end;
    end loop;
  end if;

  select * into v_order from public.create_maintenance_order(
    p_organization_id, v_customer_id, auth.uid(),
    p_input->'device'->>'brand', p_input->'device'->>'model',
    p_input->'device'->>'color', p_input->'device'->>'storage',
    p_input->'device'->>'imei', p_input->'device'->>'notes',
    p_input->>'reported_issue', nullif(p_input->>'expected_delivery_date', '')::date,
    nullif(p_input->>'estimated_price', '')::numeric, p_input->>'internal_notes',
    coalesce((p_input->>'warranty_enabled')::boolean, false),
    coalesce((p_input->>'warranty_signed')::boolean, false),
    (p_input->>'warranty_amount')::integer, p_input->>'warranty_unit',
    (p_input->>'warranty_started_at')::date, (p_input->>'warranty_expires_at')::date,
    p_input->>'warranty_notes'
  );
  if v_order.order_id is null or v_order.order_number is null then
    raise exception 'Nao foi possivel confirmar a criacao da OS.' using errcode = '23514';
  end if;
  update public.maintenance_orders set intake_request_id = p_request_id
    where id = v_order.order_id and organization_id = p_organization_id;
  if not found then
    raise exception 'Nao foi possivel registrar a tentativa de abertura.' using errcode = '42501';
  end if;
  return query select v_order.order_id::uuid, v_order.order_number::text;
end;
$$;

revoke all on function public.create_maintenance_intake(uuid, uuid, uuid, text, text, jsonb, boolean) from public, anon;
grant execute on function public.create_maintenance_intake(uuid, uuid, uuid, text, text, jsonb, boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
