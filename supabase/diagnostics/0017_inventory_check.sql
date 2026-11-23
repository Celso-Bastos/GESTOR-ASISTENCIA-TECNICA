-- Executar manualmente no SQL Editor do MESMO projeto Supabase usado pelo app.
-- Somente leitura: não aplica migrations nem registra movimentações.
-- A existência dos objetos não comprova o conteúdo das funções nem o cache PostgREST.

select to_regclass('public.inventory_movements') as inventory_movements;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'product_model_templates'
  and column_name in ('stock_quantity', 'minimum_stock', 'unit_cost')
order by column_name;

-- A saída integrada ao estoque também depende desta coluna.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'product_outflows'
  and column_name = 'inventory_tracked';

-- A RPC register_inventory_movement atende abertura, entrada e ajuste.
-- Os demais objetos são helpers/triggers da integração de saídas.
with expected(signature) as (
  values
    ('public.register_inventory_movement(uuid,uuid,text,integer,numeric,text,text)'),
    ('public.apply_inventory_delta(uuid,uuid,text,integer,numeric,text,text,uuid)'),
    ('public.inventory_outflow_links_valid(uuid,uuid,uuid)'),
    ('public.inventory_immutable()'),
    ('public.initialize_product_inventory()'),
    ('public.prepare_inventory_outflow()'),
    ('public.sync_outflow_inventory()')
)
select e.signature,
  p.oid is not null as function_exists,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from expected e
left join pg_proc p on p.oid = to_regprocedure(e.signature)
order by e.signature;

-- Devem existir quatro triggers habilitados (enabled = O).
select c.relname as table_name, t.tgname as trigger_name, t.tgenabled as enabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname in (
    'inventory_movements_immutable', 'initialize_product_inventory',
    'prepare_inventory_outflow', 'sync_outflow_inventory'
  )
order by t.tgname;

-- RLS habilitada; authenticated pode ler, sem alterar o histórico diretamente.
select c.relrowsecurity as rls_enabled,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_can_update,
  has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_can_delete
from pg_class c
where c.oid = to_regclass('public.inventory_movements');
