// PostgreSQL descartável; não carrega .env nem acessa o Supabase real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PGLITE_TEST_MODULE || '@electric-sql/pglite');
const migration = name => readFileSync(path.join(__dirname, '../migrations', name), 'utf8');
const diagnostic = readFileSync(path.join(__dirname, '../diagnostics/0017_inventory_check.sql'), 'utf8');

test('Estoque completo: migration real, transações, auditoria e isolamento', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'inventory-pg-'));
  const db = new PGlite({ dataDir: directory });
  const user = randomUUID(), otherUser = randomUUID(), org = randomUUID(), otherOrg = randomUUID();
  const model = randomUUID(), otherModel = randomUUID(), historical = randomUUID();
  const q = (sql, args = []) => db.query(sql, args);
  const admin = () => db.exec('reset role');
  const login = async (id = user, role = 'authenticated') => {
    await admin(); await q("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.exec(`set role ${role}`);
  };
  const stock = async (id = model) => (await q('select stock_quantity from product_model_templates where id=$1', [id])).rows[0]?.stock_quantity;
  const move = async (type, quantity, { id = model, organization = org, cost = null, reason = 'Contagem física' } = {}) =>
    (await q('select register_inventory_movement($1,$2,$3,$4,$5,$6,$7) as balance', [organization, id, type, quantity, cost, reason, 'Teste'])).rows[0].balance;
  const sale = async (quantity, id = model, extra = {}) => (await q(`insert into product_outflows
    (organization_id,category,model_template_id,quantity,unit_price,total_price,notes)
    values($1,'case',$2,$3,15,999,$4) returning id,model_template_id,total_price,inventory_tracked`,
    [org, id, quantity, extra.notes ?? null])).rows[0];
  const movements = async (id = model) => (await q('select * from inventory_movements where product_model_template_id=$1 order by created_at,id', [id])).rows;
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(migration('0001_initial_schema.sql').replace('create extension if not exists pgcrypto;', ''));
    await db.exec(migration('0006_add_product_outflows.sql'));
    await db.exec(migration('0007_add_privacy_screen_protector_category.sql'));
    await db.exec(migration('0008_sync_product_category_constraints.sql'));
    await q('insert into auth.users values($1),($2)', [user, otherUser]);
    await q("insert into organizations(id,name,slug) values($1,'Loja','loja'),($2,'Outra','outra')", [org, otherOrg]);
    await q('insert into organization_members(organization_id,user_id) values($1,$2),($3,$4)', [org,user,otherOrg,otherUser]);
    await q("insert into profiles(user_id,full_name) values($1,'Celso')", [user]);
    await q("insert into product_model_templates(id,organization_id,category,model_name,default_price) values($1,$2,'case','A05',15),($3,$4,'cable','USB',20)", [model,org,otherModel,otherOrg]);
    await q("insert into product_outflows(id,organization_id,category,model_template_id,quantity,unit_price,total_price) values($1,$2,'case',$3,50,15,750)", [historical,org,model]);
    // Reproduz os grants padrão de tabelas Supabase antes das restrições de 0017.
    await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated;');
    const beforeMigration = await db.exec(diagnostic);
    assert.equal(beforeMigration[0].rows[0].inventory_movements, null);
    assert.equal(beforeMigration[1].rows.length, 0);
    assert.ok(beforeMigration[3].rows.every(row => !row.function_exists));
    await db.exec(migration('0017_complete_inventory.sql'));
    await login();

    await t.test('SQL manual identifica schema ausente e confere funções, triggers, RLS e grants após 0017', async () => {
      const results = await db.exec(diagnostic);
      assert.equal(results[0].rows[0].inventory_movements, 'inventory_movements');
      assert.deepEqual(results[1].rows.map(row => [row.column_name, row.data_type]), [
        ['minimum_stock', 'integer'], ['stock_quantity', 'integer'], ['unit_cost', 'numeric']
      ]);
      assert.equal(results[2].rows[0].column_name, 'inventory_tracked');
      assert.equal(results[3].rows.length, 7);
      assert.ok(results[3].rows.every(row => row.function_exists));
      const rpc = results[3].rows.find(row => row.signature.startsWith('public.register_inventory_movement('));
      assert.equal(rpc.return_type, 'integer');
      assert.equal(rpc.authenticated_can_execute, true);
      const helper = results[3].rows.find(row => row.signature.startsWith('public.apply_inventory_delta('));
      assert.equal(helper.authenticated_can_execute, false);
      assert.equal(results[4].rows.length, 4);
      assert.ok(results[4].rows.every(row => row.enabled === 'O'));
      assert.deepEqual(results[5].rows, [{rls_enabled:true, authenticated_can_select:true,
        authenticated_can_insert:false, authenticated_can_update:false, authenticated_can_delete:false}]);
    });

    await t.test('retrocompatibilidade: saldo zero, custo nulo e histórico sem débito', async () => {
      assert.equal(await stock(), 0);
      assert.equal((await q('select minimum_stock,unit_cost,default_price from product_model_templates where id=$1',[model])).rows[0].unit_cost, null);
      assert.equal((await q('select inventory_tracked from product_outflows where id=$1',[historical])).rows[0].inventory_tracked, false);
      assert.equal((await movements()).length, 0);
      await q('update product_outflows set quantity=51 where id=$1',[historical]);
      await q('update product_outflows set deleted_at=now() where id=$1',[historical]);
      assert.equal(await stock(), 0); assert.equal((await movements()).length, 0);
    });
    await t.test('estoque inicial 0→20, entrada 20+10=30 e saída 30−4=26', async () => {
      assert.equal(await move('opening_balance',20),20);
      assert.equal(await move('entry',10,{cost:3.5}),30);
      const out = await sale(4);
      assert.equal(out.inventory_tracked,true); assert.equal(Number(out.total_price),60);
      assert.equal(await stock(),26);
      const rows = await movements();
      assert.deepEqual(rows.map(m => [m.movement_type,m.quantity,m.quantity_before,m.quantity_after]),[
        ['opening_balance',20,0,20],['entry',10,20,30],['outflow',-4,30,26]
      ]);
      assert.ok(rows.every(m => m.created_by === user && m.created_by_name === 'Celso'));
      assert.equal(rows.at(-1).product_outflow_id,out.id);
      assert.equal(Number(rows.at(-1).unit_cost),3.5);
      await assert.rejects(move('opening_balance',30), /já definido/);
    });
    await t.test('homologação: estoque inicial 0→20, entrada 20→30, ajuste 30→25 e saída 25→21', async () => {
      const id = (await q("insert into product_model_templates(organization_id,category,model_name) values($1,'case','Homologação runtime') returning id",[org])).rows[0].id;
      assert.equal(await stock(id),0);
      assert.equal(await move('opening_balance',20,{id}),20);
      assert.equal(await move('entry',10,{id}),30);
      assert.equal(await move('adjustment',25,{id,reason:'Contagem física'}),25);
      assert.equal(await stock(id),25);
      const out = await sale(4,id);
      assert.equal(await stock(id),21);
      assert.deepEqual((await movements(id)).map(m=>[m.movement_type,m.quantity,m.quantity_before,m.quantity_after]),[
        ['opening_balance',20,0,20],['entry',10,20,30],['adjustment',-5,30,25],['outflow',-4,25,21]
      ]);
      assert.equal((await movements(id)).at(-1).product_outflow_id,out.id);
    });
    await t.test('saída maior que saldo é permitida e ajuste registra delta', async () => {
      await move('adjustment',2);
      await sale(3);
      assert.equal(await stock(),-1);
      assert.equal((await movements()).at(-1).quantity_after,-1);
      await move('adjustment',12); await move('adjustment',10);
      const row = (await movements()).at(-1);
      assert.deepEqual([row.quantity,row.quantity_before,row.quantity_after],[-2,12,10]);
      await move('adjustment',0); assert.equal(await stock(),0);
    });
    await t.test('edição de quantidade, troca de produto e cancelamento compensam sem apagar', async () => {
      await move('adjustment',20);
      const out = await sale(2);
      await q('update product_outflows set quantity=3 where id=$1',[out.id]);
      assert.equal(await stock(),17);
      assert.equal((await movements()).at(-1).quantity,-1);
      const second = (await q("insert into product_model_templates(organization_id,category,model_name,stock_quantity) values($1,'case','A16',10) returning id",[org])).rows[0].id;
      await q('update product_outflows set model_template_id=$1 where id=$2',[second,out.id]);
      assert.equal(await stock(),20); assert.equal(await stock(second),7);
      await q('update product_outflows set deleted_at=now() where id=$1',[out.id]);
      assert.equal(await stock(second),10);
      const customer = (await q("insert into customers(organization_id,name,phone,phone_normalized) values($1,'Cliente','11999999999','11999999999') returning id",[org])).rows[0].id;
      const withCustomer = await sale(1);
      await q('update product_outflows set customer_id=$1 where id=$2',[customer,withCustomer.id]);
      await q('update customers set deleted_at=now() where id=$1',[customer]);
      const beforeCancellation = await stock();
      await q('update product_outflows set deleted_at=now() where id=$1',[withCustomer.id]);
      assert.equal(await stock(),beforeCancellation+1);
      assert.equal((await movements(second)).at(-1).reason,'Cancelamento de saída');
      const count = (await movements(second)).length;
      await q('update product_outflows set deleted_at=now() where id=$1',[out.id]);
      assert.equal((await movements(second)).length,count);
      await q('update product_outflows set deleted_at=null where id=$1',[out.id]);
      assert.equal(await stock(second),7);
      const before = (await movements(second)).length;
      await q("update product_outflows set notes='Corrigido',unit_price=16 where id=$1",[out.id]);
      assert.equal((await movements(second)).length,before);
      assert.equal(Number((await q('select total_price from product_outflows where id=$1',[out.id])).rows[0].total_price),48);
      await q('update product_model_templates set deleted_at=now(),is_active=false where id=$1',[second]);
      await q('update product_outflows set deleted_at=now() where id=$1',[out.id]);
      assert.equal(await stock(second),10);
    });
    await t.test('modelo digitado integra catálogo e transação; nomes existentes são reutilizados', async () => {
      const insert = () => q("insert into product_outflows(organization_id,category,custom_model_name,quantity,unit_price,total_price) values($1,'screen_protector',' A55 ',2,10,20) returning model_template_id",[org]);
      const first = (await insert()).rows[0].model_template_id;
      const second = (await insert()).rows[0].model_template_id;
      assert.equal(first,second); assert.equal(await stock(first),-4);
      assert.equal((await movements(first)).length,2);
    });
    await t.test('falha de auditoria faz rollback de saída, saldo e catálogo digitado', async () => {
      await admin();
      await db.exec("alter table inventory_movements add constraint simulated_failure check (notes is distinct from 'FALHAR')");
      await login();
      const before = await stock();
      const count = (await q('select count(*) from product_outflows')).rows[0].count;
      await assert.rejects(sale(2,model,{notes:'FALHAR'}), /simulated_failure/);
      assert.equal(await stock(),before);
      assert.equal((await q('select count(*) from product_outflows')).rows[0].count,count);
      await assert.rejects(q("insert into product_outflows(organization_id,category,custom_model_name,quantity,unit_price,total_price,notes) values($1,'case','Rollback',2,10,20,'FALHAR')",[org]), /simulated_failure/);
      assert.equal((await q("select count(*) from product_model_templates where model_name='Rollback'")).rows[0].count,0);
      const beforeCost = (await q('select unit_cost from product_model_templates where id=$1',[model])).rows[0].unit_cost;
      for (const type of ['entry','adjustment']) {
        await assert.rejects(q('select register_inventory_movement($1,$2,$3,1,99,$4,$5)',[org,model,type,'Contagem','FALHAR']),/simulated_failure/);
        assert.equal(await stock(),before);
        assert.equal((await q('select unit_cost from product_model_templates where id=$1',[model])).rows[0].unit_cost,beforeCost);
      }
      const cancellable = await sale(1);
      await assert.rejects(q("update product_outflows set deleted_at=now(),notes='FALHAR' where id=$1",[cancellable.id]),/simulated_failure/);
      assert.equal(await stock(),before-1);
      assert.equal((await q('select deleted_at from product_outflows where id=$1',[cancellable.id])).rows[0].deleted_at,null);
      await admin(); await db.exec('alter table inventory_movements drop constraint simulated_failure'); await login();
    });
    await t.test('validações SQL, custo separado do preço, saldo protegido e auditoria imutável', async () => {
      for (const quantity of [0,-1,null]) await assert.rejects(move('entry',quantity));
      await assert.rejects(move('entry','1.5'));
      for (const cost of [-1,'NaN','Infinity']) await assert.rejects(move('entry',1,{cost}));
      await assert.rejects(move('adjustment',2,{reason:''}), /motivo/);
      await assert.rejects(move('outflow',1), /Tipo/);
      await assert.rejects(q('update product_model_templates set minimum_stock=-1 where id=$1',[model]));
      await assert.rejects(q('update product_model_templates set stock_quantity=100 where id=$1',[model]), /permission denied/);
      await assert.rejects(q('update product_model_templates set organization_id=$1 where id=$2',[otherOrg,model]), /permission denied/);
      await assert.rejects(q('update product_outflows set inventory_tracked=false'), /permission denied/);
      await assert.rejects(q('update inventory_movements set quantity=9'), /permission denied/);
      await assert.rejects(q('delete from inventory_movements'), /permission denied/);
      await assert.rejects(q("insert into inventory_movements(organization_id,product_model_template_id,movement_type,quantity,quantity_before,quantity_after) values($1,$2,'entry',1,0,1)",[org,model]), /permission denied/);
      assert.equal((await q('delete from product_outflows where id=$1 returning id',[historical])).rows.length,0);
      await assert.rejects(q("select apply_inventory_delta($1,$2,'entry',1,null,null,null,null)",[org,model]), /permission denied/);
      await q('update product_model_templates set minimum_stock=5,unit_cost=4 where id=$1',[model]);
      const row = (await q('select minimum_stock,unit_cost,default_price from product_model_templates where id=$1',[model])).rows[0];
      assert.deepEqual([row.minimum_stock,Number(row.unit_cost),Number(row.default_price)],[5,4,15]);
      // Mesmo o proprietário do banco não edita a auditoria acidentalmente.
      await admin();
      await assert.rejects(q('update inventory_movements set notes=null'), /imutável/);
      await assert.rejects(q('delete from product_outflows where id=$1',[historical]), /cancelamento/);
      await login();
    });
    await t.test('requisições concorrentes não perdem incremento; função usa lock real', async () => {
      await move('adjustment',100);
      await Promise.all(Array.from({length:12},()=>sale(1)));
      assert.equal(await stock(),88);
      await Promise.all(Array.from({length:12},()=>move('entry',1)));
      assert.equal(await stock(),100);
      const definition = (await q("select pg_get_functiondef('public.apply_inventory_delta(uuid,uuid,text,integer,numeric,text,text,uuid)'::regprocedure) as sql")).rows[0].sql;
      assert.match(definition,/for update/i);
      // PGlite possui uma conexão: teste de contenção multi-conexão deve ser repetido em homologação.
    });
    await t.test('RLS: outra organização, vínculo cruzado, usuário sem membership e anônimo', async () => {
      await assert.rejects(move('entry',1,{id:otherModel}), /não encontrado/);
      await assert.rejects(move('entry',1,{id:otherModel,organization:otherOrg}), /não autorizada/);
      await assert.rejects(sale(1,otherModel), /não encontrado/);
      await login(otherUser);
      assert.equal((await q('select count(*) from inventory_movements')).rows[0].count,0);
      assert.equal((await q('select * from product_model_templates where id=$1',[model])).rows.length,0);
      await assert.rejects(move('entry',1), /não autorizada/);
      await login(null);
      assert.equal((await q('select count(*) from inventory_movements')).rows[0].count,0);
      await assert.rejects(move('entry',1), /não autorizada/);
      await login(null,'anon');
      await assert.rejects(q('select * from inventory_movements'), /permission denied/);
      await assert.rejects(move('entry',1), /permission denied/);
    });
  } finally {
    await db.close();
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('inventory-pg-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
