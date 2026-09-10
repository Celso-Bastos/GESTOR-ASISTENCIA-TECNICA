// Banco PostgreSQL descartavel via PGlite. Nao le .env nem conecta ao Supabase.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PGLITE_TEST_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
const sql = name => readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
const signature = 'public.create_maintenance_intake(uuid,uuid,uuid,text,text,jsonb,boolean)';

test('migrations e RPC de abertura no PostgreSQL, com RLS e rollback', async t => {
  const db = new PGlite();
  const user = randomUUID(), org = randomUUID(), otherOrg = randomUUID();
  try {
    // Substitui apenas o provedor Auth; usa tabelas, policies e funcoes reais do repo.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated;
    `);
    // gen_random_uuid e nativo; a extensao pgcrypto do Supabase nao e usada nestes fluxos.
    await db.exec(sql('0001_initial_schema.sql').replace('create extension if not exists pgcrypto;', ''));
    await db.exec(sql('0002_customers_active_phone_unique.sql'));

    await t.test('dependencia ausente aborta a migration sem instalar RPC incompleta', async () => {
      await assert.rejects(db.exec(sql('0010_atomic_maintenance_intake.sql')), /0004_add_warranty/);
      await db.exec('rollback;');
      assert.equal((await db.query('select to_regprocedure($1) as fn', [signature])).rows[0].fn, null);
    });
    await db.exec(sql('0004_add_warranty_to_maintenance_orders.sql'));
    await t.test('0009 e 0010 podem ser reaplicadas; telefones passam de NO para YES', async () => {
      const columns = "select is_nullable from information_schema.columns where table_schema='public' and table_name='customers' and column_name in ('phone','phone_normalized')";
      assert.ok((await db.query(columns)).rows.every(row => row.is_nullable === 'NO'));
      for (let i = 0; i < 2; i++) {
        await db.exec(sql('0009_allow_customers_without_phone.sql'));
        await db.exec(sql('0010_atomic_maintenance_intake.sql'));
      }
      assert.ok((await db.query(columns)).rows.every(row => row.is_nullable === 'YES'));
    });
    await t.test('parametros, retorno e grant correspondem ao contrato da action', async () => {
      const rows = (await db.query("select proargnames, pg_get_function_result(oid) as result from pg_proc where oid=to_regprocedure($1)", [signature])).rows;
      assert.equal(rows.length, 1);
      const action = readFileSync(path.join(root, 'apps/web/src/app/(dashboard)/manutencoes/actions.ts'), 'utf8');
      const call = action.match(/\.rpc\("create_maintenance_intake", \{([\s\S]*?)\}\)\.maybeSingle/)[1];
      const names = [...call.matchAll(/\b(p_\w+):/g)].map(match => match[1]);
      assert.deepEqual(rows[0].proargnames.slice(0, 7).sort(), names.sort());
      assert.equal(rows[0].result, 'TABLE(order_id uuid, order_number text)');
      const grants = (await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') as allowed, has_function_privilege('anon',$1,'EXECUTE') as anonymous", [signature])).rows[0];
      assert.equal(grants.allowed, true); assert.equal(grants.anonymous, false);
    });

    await db.query('insert into auth.users(id) values ($1)', [user]);
    await db.query("insert into organizations(id,name,slug) values ($1,'Loja Teste','loja-teste'),($2,'Outra Loja','outra-loja')", [org, otherOrg]);
    await db.query("insert into organization_members(organization_id,user_id,role) values ($1,$2,'owner')", [org, user]);
    await db.exec('grant select, insert, update on all tables in schema public to authenticated;');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec('set role authenticated;');

    async function intake({ request = randomUUID(), organization = org, customer = null, name = null, phone = null, quick = true, input = { device: { model: 'Samsung A14' }, reported_issue: 'Nao carrega' } } = {}) {
      // Ordem intencionalmente igual ao erro de producao: argumentos nomeados.
      const result = await db.query(`select * from public.create_maintenance_intake(
        p_customer_id => $1::uuid, p_customer_name => $2::text, p_customer_phone => $3::text,
        p_input => $4::jsonb, p_organization_id => $5::uuid, p_quick => $6::boolean, p_request_id => $7::uuid
      )`, [customer, name, phone, JSON.stringify(input), organization, quick, request]);
      assert.equal(result.rows.length, 1);
      return result.rows[0];
    }
    async function details(id) {
      return (await db.query(`select c.id as customer_id,c.name,c.phone,c.phone_normalized,c.source,
        d.id as device_id,mo.status,(select count(*)::int from maintenance_events e where e.maintenance_order_id=mo.id and e.event_type='created') as events
        from maintenance_orders mo join customers c on c.id=mo.customer_id join devices d on d.id=mo.device_id
        where mo.id=$1`, [id])).rows[0];
    }
    async function counts() {
      return (await db.query(`select (select count(*) from customers) as customers,
        (select count(*) from devices) as devices,(select count(*) from maintenance_orders) as orders,
        (select count(*) from maintenance_events) as events`)).rows[0];
    }
    await t.test('A: sem dados cria cliente exclusivo, aparelho, OS e evento', async () => {
      const a = await details((await intake()).order_id), b = await details((await intake()).order_id);
      assert.equal(a.name, 'Cliente não informado'); assert.equal(a.phone, null); assert.equal(a.phone_normalized, null);
      assert.equal(a.source, 'manual'); assert.equal(a.status, 'recebido'); assert.equal(a.events, 1);
      assert.notEqual(a.customer_id, b.customer_id); assert.notEqual(a.device_id, b.device_id);
    });
    await t.test('B: nome informado sem telefone', async () => {
      const row = await details((await intake({ name: 'Joao Teste' })).order_id);
      assert.equal(row.name, 'Joao Teste'); assert.equal(row.phone, null); assert.equal(row.phone_normalized, null);
    });
    let existingCustomer;
    await t.test('C: normaliza telefone e reaproveita cliente ativo sem sobrescrever nome', async () => {
      const a = await details((await intake({ phone: '+55 (98) 99999-8888' })).order_id);
      const b = await details((await intake({ phone: '98999998888', name: 'Nao sobrescrever' })).order_id);
      assert.equal(a.name, 'Cliente sem nome'); assert.equal(a.phone_normalized, '98999998888');
      assert.equal(a.customer_id, b.customer_id); assert.equal(b.name, a.name); existingCustomer = a.customer_id;
    });
    await t.test('completa com cliente existente usa o mesmo contrato de retorno', async () => {
      const row = await intake({ customer: existingCustomer, quick: false });
      assert.match(row.order_number, /^OS-\d+$/); assert.equal((await details(row.order_id)).customer_id, existingCustomer);
    });
    await t.test('reenvio do mesmo UUID retorna OS existente sem gravar novamente', async () => {
      const request = randomUUID(); const a = await intake({ request }); const before = await counts();
      const b = await intake({ request }); assert.deepEqual(b, a); assert.deepEqual(await counts(), before);
    });
    await t.test('organizacao externa e telefone invalido nao gravam dados', async () => {
      const before = await counts();
      await assert.rejects(intake({ organization: otherOrg }), /Organizacao indisponivel/);
      await assert.rejects(intake({ phone: 'abc' }), /Telefone invalido/);
      await assert.rejects(intake({ input: null }), /Informe modelo e defeito/);
      assert.deepEqual(await counts(), before);
    });
    await t.test('falha no evento reverte inclusive cliente, aparelho e OS', async () => {
      await db.exec(`reset role;
        create function public.fail_intake_test_event() returns trigger language plpgsql as $$
        begin raise exception 'EVENT_FAILURE_TEST'; end; $$;
        create trigger fail_intake_test before insert on maintenance_events for each row execute function fail_intake_test_event();
        set role authenticated;`);
      const before = await counts();
      await assert.rejects(intake({ name: 'Rollback Teste' }), /EVENT_FAILURE_TEST/);
      assert.deepEqual(await counts(), before);
      await db.exec('reset role; drop trigger fail_intake_test on maintenance_events; drop function fail_intake_test_event(); set role authenticated;');
    });
    await t.test('sem permissao para registrar UUID reverte toda a abertura', async () => {
      await db.exec('reset role; revoke update on maintenance_orders from authenticated; set role authenticated;');
      const before = await counts();
      await assert.rejects(intake(), /permission denied/);
      assert.deepEqual(await counts(), before);
    });
  } finally { await db.close(); }
});
