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

function toCivilDate(value) {
  if (value === null) return null;
  if (typeof value === 'string') {
    assert.match(value, /^\d{4}-\d{2}-\d{2}$/, 'DATE deve ser uma data civil YYYY-MM-DD');
    return value;
  }
  assert.ok(value instanceof Date && !Number.isNaN(value.getTime()), 'DATE deve ser string civil, Date válido ou null');
  // O driver representa SQL DATE à meia-noite UTC. Não usar componentes locais,
  // que poderiam transformar 2000-02-29 em 2000-02-28 conforme o fuso da máquina.
  const year = String(value.getUTCFullYear()).padStart(4, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
    await t.test('0011 substitui a RPC sem alterar unicidade e pode ser reaplicada', async () => {
      const indexes = () => db.query("select indexname,indexdef from pg_indexes where schemaname='public' and tablename='customers' order by indexname");
      const before = (await indexes()).rows;
      const unique = before.find(row => row.indexname === 'customers_active_phone_normalized_unique');
      assert.match(unique.indexdef, /UNIQUE.*organization_id, phone_normalized/);
      assert.match(unique.indexdef, /deleted_at IS NULL.*phone_normalized IS NOT NULL/);
      await db.exec(sql('0011_restore_archived_customer_on_intake.sql'));
      await db.exec(sql('0011_restore_archived_customer_on_intake.sql'));
      assert.deepEqual((await indexes()).rows, before);
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
    await t.test('0016 sem dependência 0014 aborta sem substituir a RPC existente', async () => {
      const before = (await db.query('select pg_get_functiondef(to_regprocedure($1)) as definition', [signature])).rows[0].definition;
      await assert.rejects(db.exec(sql('0016_quick_maintenance_customer_address.sql')), /0014/);
      await db.exec('rollback;');
      assert.equal((await db.query('select pg_get_functiondef(to_regprocedure($1)) as definition', [signature])).rows[0].definition, before);
    });
    await t.test('0014 é reaplicável, mantém clientes antigos e adiciona colunas nulas', async () => {
      assert.equal(toCivilDate('2000-02-29'), '2000-02-29');
      assert.equal(toCivilDate(new Date('2000-02-29T00:00:00.000Z')), '2000-02-29');
      assert.equal(toCivilDate(null), null);
      assert.throws(() => toCivilDate(new Date('invalid')), /Date válido/);
      assert.throws(() => toCivilDate('2000-02-29T00:00:00Z'), /YYYY-MM-DD/);
      const legacyId = randomUUID();
      await db.query("insert into customers(id,organization_id,name) values ($1,$2,'Cliente antigo')", [legacyId, org]);
      const before = (await db.query('select * from customers where id=$1', [legacyId])).rows[0];
      for (let i = 0; i < 2; i++) await db.exec(sql('0014_customer_address_birth_date.sql'));
      const after = (await db.query('select * from customers where id=$1', [legacyId])).rows[0];
      assert.deepEqual(after, { ...before, address: null, birth_date: null });
      const columns = (await db.query(`select column_name,data_type,is_nullable,column_default from information_schema.columns
        where table_schema='public' and table_name='customers' and column_name in ('address','birth_date') order by column_name`)).rows;
      assert.deepEqual(columns, [
        { column_name: 'address', data_type: 'text', is_nullable: 'YES', column_default: null },
        { column_name: 'birth_date', data_type: 'date', is_nullable: 'YES', column_default: null }
      ]);
    });
    await db.exec(sql('0016_quick_maintenance_customer_address.sql'));
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
    async function customerRow(id) {
      const row = (await db.query('select * from customers where id=$1', [id])).rows[0];
      // Normaliza na fronteira do teste: todas as comparações de birth_date,
      // inclusive snapshots completos e comparações futuras, usam valor civil.
      return row ? { ...row, birth_date: toCivilDate(row.birth_date) } : undefined;
    }
    await t.test('A: sem dados cria cliente exclusivo, aparelho, OS e evento', async () => {
      const a = await details((await intake()).order_id), b = await details((await intake()).order_id);
      assert.equal(a.name, 'Cliente não informado'); assert.equal(a.phone, null); assert.equal(a.phone_normalized, null);
      assert.equal(a.source, 'manual'); assert.equal(a.status, 'recebido'); assert.equal(a.events, 1);
      const customer = await customerRow(a.customer_id);
      assert.equal(customer.address, null); assert.equal(customer.birth_date, null);
      assert.notEqual(a.customer_id, b.customer_id); assert.notEqual(a.device_id, b.device_id);
      for (const quick of [true, false]) {
        for (const estimated of [null, 0, 150.25]) {
          const order = await intake({ quick, name: quick ? null : 'Cliente completo', input: {
            device: { model: 'Galaxy A14' }, reported_issue: 'Troca de tela', estimated_price: estimated
          } });
          const saved = (await db.query('select estimated_price,final_price from maintenance_orders where id=$1', [order.order_id])).rows[0];
          assert.equal(saved.estimated_price === null, estimated === null);
          if (estimated !== null) assert.equal(Number(saved.estimated_price), estimated);
          assert.equal(saved.final_price, null);
        }
      }
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
    await t.test('cadastro inline completo continua mínimo, sem endereço nem aniversário', async () => {
      const row = await details((await intake({ name: 'Cliente inline', quick: false })).order_id);
      const customer = await customerRow(row.customer_id);
      assert.equal(customer.address, null); assert.equal(customer.birth_date, null);
    });
    await t.test('novos campos são graváveis sob RLS e invisíveis a outra organização e anon', async () => {
      const own = (await details((await intake()).order_id)).customer_id;
      await db.query("update customers set address='Rua A',birth_date='2000-02-29' where id=$1", [own]);
      const saved = await customerRow(own);
      assert.equal(saved.address, 'Rua A'); assert.equal(saved.birth_date, '2000-02-29');
      const foreign = randomUUID();
      await db.exec('reset role;');
      await db.query("insert into customers(id,organization_id,name,address,birth_date) values ($1,$2,'Outra loja','Privado','1990-01-01')", [foreign, otherOrg]);
      await db.exec('set role authenticated;');
      assert.equal(await customerRow(foreign), undefined);
      assert.equal((await db.query("update customers set address='Tentativa',birth_date=null where id=$1 returning id", [foreign])).rows.length, 0);
      await assert.rejects(db.query("insert into customers(organization_id,name,address,birth_date) values ($1,'Tentativa','Privado','1990-01-01')", [otherOrg]), /row-level security/);
      await db.exec('reset role; grant select on customers to anon; set role anon;');
      assert.equal((await db.query('select address,birth_date from customers')).rows.length, 0);
      await db.exec('reset role; set role authenticated;');
      await db.query('update customers set address=null,birth_date=null where id=$1', [own]);
      assert.equal((await customerRow(own)).address, null);
      assert.equal((await customerRow(own)).birth_date, null);
    });
    await t.test('reativa tambem com a constraint global antiga sem remove-la', async () => {
      await db.exec('reset role; alter table customers add constraint customers_organization_id_phone_normalized_key unique (organization_id,phone_normalized); set role authenticated;');
      try {
        const first = await details((await intake({ phone: '11987654321', name: 'Cadastro antigo' })).order_id);
        await db.query('update customers set deleted_at=now() where id=$1', [first.customer_id]);
        const second = await details((await intake({ phone: '+55 (11) 98765-4321', name: 'Cadastro reativado' })).order_id);
        assert.equal(second.customer_id, first.customer_id);
        assert.equal((await customerRow(first.customer_id)).deleted_at, null);
        assert.equal((await db.query("select count(*)::int as n from pg_constraint where conname='customers_organization_id_phone_normalized_key'")).rows[0].n, 1);
      } finally {
        await db.exec('reset role; alter table customers drop constraint customers_organization_id_phone_normalized_key; set role authenticated;');
      }
    });
    for (const quick of [true, false]) {
      await t.test(`${quick ? 'rapida' : 'normal'}: novo, ativo, arquivado e historico sem duplicar`, async () => {
        const phone = quick ? '21987650001' : '21987650002';
        const firstOrder = await intake({ phone, name: 'Nome original', quick });
        const first = await details(firstOrder.order_id);
        const active = await details((await intake({ phone, name: 'Nao sobrescrever ativo', quick })).order_id);
        assert.equal(active.customer_id, first.customer_id);
        assert.equal(active.name, 'Nome original');
        await db.query(`update customers set deleted_at=now(),notes='Notas e historico preservados',
          address='Rua preservada',birth_date='2000-02-29',
          whatsapp_opt_in=$2,whatsapp_opt_in_at='2026-01-01T12:00:00Z',source='tablet' where id=$1`, [first.customer_id, quick]);
        const archived = await customerRow(first.customer_id);
        const request = randomUUID();
        const restoredOrder = await intake({ phone: `+55 (${phone.slice(0, 2)}) ${phone.slice(2)}`, name: 'Nome atualizado', quick, request });
        const restored = await customerRow(first.customer_id);
        assert.equal((await details(restoredOrder.order_id)).customer_id, first.customer_id);
        assert.equal((await details(firstOrder.order_id)).customer_id, first.customer_id);
        assert.equal(restored.deleted_at, null);
        assert.equal(restored.name, 'Nome atualizado');
        assert.equal(restored.phone, `+55 (${phone.slice(0, 2)}) ${phone.slice(2)}`);
        assert.equal(restored.phone_normalized, phone);
        for (const field of ['id', 'organization_id', 'notes', 'whatsapp_opt_in', 'source', 'address', 'birth_date']) assert.equal(restored[field], archived[field]);
        assert.deepEqual(restored.whatsapp_opt_in_at, archived.whatsapp_opt_in_at);
        assert.deepEqual(restored.created_at, archived.created_at);
        assert.equal((await db.query('select count(*)::int as n from customers where organization_id=$1 and phone_normalized=$2', [org, phone])).rows[0].n, 1);
        assert.equal((await db.query('select count(*)::int as n from maintenance_orders where customer_id=$1', [first.customer_id])).rows[0].n, 3);
        const before = await counts();
        assert.deepEqual(await intake({ request, phone, name: 'Nao alterar no reenvio', quick }), restoredOrder);
        assert.deepEqual(await counts(), before);
        assert.equal((await customerRow(first.customer_id)).name, 'Nome atualizado');
      });
    }
    await t.test('rapida sem nome preserva nome valido ou usa fallback para legado invalido', async () => {
      const phone = '31987650001';
      const id = (await details((await intake({ phone, name: 'Nome preservado' })).order_id)).customer_id;
      for (const oldName of ['Nome preservado', '', ' ', 'X', 'x'.repeat(121)]) {
        await db.query('update customers set name=$2,deleted_at=now(),whatsapp_opt_in=null where id=$1', [id, oldName]);
        await intake({ phone, name: '   ' });
        const row = await customerRow(id);
        assert.equal(row.name, oldName === 'Nome preservado' ? oldName : 'Cliente sem nome');
        assert.equal(row.deleted_at, null);
        assert.equal(row.whatsapp_opt_in, null);
      }
    });
    await t.test('ativo tem prioridade; entre varios arquivados reativa apenas o mais recente', async () => {
      const phone = '41987650001';
      const older = (await details((await intake({ phone, name: 'Mais antigo' })).order_id)).customer_id;
      await db.query("update customers set deleted_at='2025-01-01T00:00:00Z' where id=$1", [older]);
      const newer = randomUUID();
      await db.query(`insert into customers(id,organization_id,name,phone,phone_normalized,deleted_at)
        values ($1,$2,'Mais recente',$3,$3,'2026-01-01T00:00:00Z')`, [newer, org, phone]);
      assert.equal((await details((await intake({ phone })).order_id)).customer_id, newer);
      assert.notEqual((await customerRow(older)).deleted_at, null);
      assert.equal((await details((await intake({ phone, name: 'Nao sobrescrever' })).order_id)).customer_id, newer);
      assert.equal((await customerRow(newer)).name, 'Mais recente');
      assert.notEqual((await customerRow(older)).deleted_at, null);
    });
    await t.test('telefone de outra organizacao nao e reutilizado nem reativado nos dois fluxos', async () => {
      for (const quick of [true, false]) {
        const phone = quick ? '51987650001' : '51987650002';
        const foreign = randomUUID();
        await db.exec('reset role;');
        await db.query(`insert into customers(id,organization_id,name,phone,phone_normalized,deleted_at)
          values ($1,$2,'Outra loja',$3,$3,now())`, [foreign, otherOrg, phone]);
        const before = await customerRow(foreign);
        await db.exec('set role authenticated;');
        const own = await details((await intake({ phone, name: 'Minha loja', quick })).order_id);
        assert.notEqual(own.customer_id, foreign);
        assert.equal((await customerRow(own.customer_id)).organization_id, org);
        assert.equal(await customerRow(foreign), undefined);
        await assert.rejects(intake({ customer: foreign, quick }), /Cliente invalido/);
        await db.exec('reset role;');
        assert.deepEqual(await customerRow(foreign), before);
        await db.exec('set role authenticated;');
      }
    });
    await t.test('unique_violation na reativacao repete busca de arquivado e preserva dados', async () => {
      const phone = '61987650001';
      const id = (await details((await intake({ phone, name: 'Repeticao' })).order_id)).customer_id;
      await db.query('update customers set deleted_at=now() where id=$1', [id]);
      // Sequencias nao sofrem rollback: injeta uma unica colisao no UPDATE.
      // Exercita o retry real, sem alegar concorrencia entre sessoes no PGlite.
      await db.exec(`reset role;
        create sequence intake_conflict_test;
        grant usage,select on sequence intake_conflict_test to authenticated;
        create function public.intake_conflict_once() returns trigger language plpgsql as $$
        begin
          if old.deleted_at is not null and new.deleted_at is null and nextval('intake_conflict_test')=1 then
            raise exception 'customers_active_phone_normalized_unique' using errcode='23505';
          end if;
          return new;
        end; $$;
        create trigger intake_conflict_once before update on customers for each row execute function intake_conflict_once();
        set role authenticated;`);
      try {
        const row = await details((await intake({ phone })).order_id);
        assert.equal(row.customer_id, id);
        assert.equal((await customerRow(id)).deleted_at, null);
        assert.equal((await db.query('select last_value::int as n from intake_conflict_test')).rows[0].n, 2);
      } finally {
        await db.exec('reset role; drop trigger intake_conflict_once on customers; drop function intake_conflict_once(); drop sequence intake_conflict_test; set role authenticated;');
      }
    });
    await t.test('conflito persistente nao duplica nem reativa parcialmente', async () => {
      const phone = '71987650001';
      const id = (await details((await intake({ phone, name: 'Conflito' })).order_id)).customer_id;
      await db.query('update customers set deleted_at=now() where id=$1', [id]);
      const archived = await customerRow(id), before = await counts();
      await db.exec(`reset role;
        create function public.intake_conflict_always() returns trigger language plpgsql as $$
        begin raise exception 'customers_active_phone_normalized_unique' using errcode='23505'; end; $$;
        create trigger intake_conflict_always before update on customers for each row execute function intake_conflict_always();
        set role authenticated;`);
      try {
        await assert.rejects(intake({ phone, name: 'Nao persistir' }), error => error.code === '23505');
        assert.deepEqual(await customerRow(id), archived);
        assert.deepEqual(await counts(), before);
      } finally {
        await db.exec('reset role; drop trigger intake_conflict_always on customers; drop function intake_conflict_always(); set role authenticated;');
      }
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
      const phone = '81987650001';
      const id = (await details((await intake({ phone, name: 'Restauracao revertida' })).order_id)).customer_id;
      await db.query('update customers set deleted_at=now() where id=$1', [id]);
      const archived = await customerRow(id);
      await db.exec(`reset role;
        create function public.fail_intake_test_event() returns trigger language plpgsql as $$
        begin raise exception 'EVENT_FAILURE_TEST'; end; $$;
        create trigger fail_intake_test before insert on maintenance_events for each row execute function fail_intake_test_event();
        set role authenticated;`);
      const before = await counts();
      await assert.rejects(intake({ name: 'Rollback Teste' }), /EVENT_FAILURE_TEST/);
      await assert.rejects(intake({ phone, name: 'Nao persistir nome' }), /EVENT_FAILURE_TEST/);
      assert.deepEqual(await customerRow(id), archived);
      assert.deepEqual(await counts(), before);
      await db.exec('reset role; drop trigger fail_intake_test on maintenance_events; drop function fail_intake_test_event(); set role authenticated;');
    });
    const addressInput = extra => ({ device: { model: 'A14' }, reported_issue: 'Troca de tela', ...extra });
    await t.test('0016 mantém assinatura, RLS e grants, é reaplicável e não cria endereço na OS', async () => {
      await db.exec('reset role;');
      const metadata = async () => (await db.query(`select oid,prosecdef,proconfig,proargnames,pg_get_function_result(oid) as result,
        has_function_privilege('authenticated',oid,'EXECUTE') as allowed,
        has_function_privilege('anon',oid,'EXECUTE') as anonymous from pg_proc where oid=to_regprocedure($1)`, [signature])).rows;
      const before = await metadata();
      await db.exec(sql('0016_quick_maintenance_customer_address.sql'));
      await db.exec(sql('0016_quick_maintenance_customer_address.sql'));
      assert.deepEqual(await metadata(), before);
      assert.equal(before[0].prosecdef, false); assert.equal(before[0].allowed, true); assert.equal(before[0].anonymous, false);
      assert.equal((await db.query("select relrowsecurity from pg_class where oid='customers'::regclass")).rows[0].relrowsecurity, true);
      assert.equal((await db.query("select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='maintenance_orders' and column_name in ('address','customer_address')")).rows[0].n, 0);
      await db.exec('set role authenticated;');
    });
    await t.test('endereço é salvo no novo cliente, inclusive placeholder, mantendo previsão e estimado', async () => {
      for (const name of [null, 'Maria endereço']) {
        const row = await details((await intake({ name, input: addressInput({ customer_address: '  Rua Principal, 50  ', estimated_price: 150, expected_delivery_date: '2026-11-20' }) })).order_id);
        assert.equal((await customerRow(row.customer_id)).address, 'Rua Principal, 50');
        const order = (await db.query('select estimated_price,final_price,expected_delivery_date from maintenance_orders where device_id=$1', [row.device_id])).rows[0];
        assert.equal(Number(order.estimated_price), 150); assert.equal(order.final_price, null);
        assert.equal(toCivilDate(order.expected_delivery_date), '2026-11-20');
      }
    });
    await t.test('cliente ativo recebe endereço informado; omissão, null e vazio ambíguos preservam dados', async () => {
      const phone = '11987770001';
      const id = (await details((await intake({ phone, name: 'Original' })).order_id)).customer_id;
      await db.query("update customers set birth_date='2000-02-29',notes='Preservar' where id=$1", [id]);
      await intake({ phone, name: 'Não sobrescrever', input: addressInput({ customer_address: ' Rua A, 20 ' }) });
      const saved = await customerRow(id); assert.equal(saved.address, 'Rua A, 20'); assert.equal(saved.name, 'Original');
      for (const extra of [{}, { customer_address: null }, { customer_address: '' }, { customer_address: '   ' }, { customer_address: 'Prefill antigo', customer_address_action: 'preserve' }]) {
        assert.equal((await details((await intake({ phone, input: addressInput(extra) })).order_id)).customer_id, id);
        assert.deepEqual(await customerRow(id), saved);
      }
      await intake({ phone, input: addressInput({ customer_address: 'Rua A, 30', customer_address_action: 'set', customer_address_customer_id: id }) });
      const edited = await customerRow(id); assert.equal(edited.address, 'Rua A, 30'); assert.equal(edited.birth_date, '2000-02-29'); assert.equal(edited.notes, 'Preservar');
      await intake({ phone, quick: false, name: 'Normal', input: addressInput({ customer_address: 'Não alterar no fluxo normal' }) });
      assert.deepEqual(await customerRow(id), edited);
    });
    await t.test('limpeza exige intenção e cliente confirmado; ID diferente aborta sem dados parciais', async () => {
      const phone = '11987770002';
      const id = (await details((await intake({ phone, input: addressInput({ customer_address: 'Rua B' }) })).order_id)).customer_id;
      const saved = await customerRow(id), before = await counts();
      for (const extra of [
        { customer_address: null, customer_address_action: 'clear' },
        { customer_address: 'Rua C', customer_address_action: 'clear', customer_address_customer_id: id },
        { customer_address: null, customer_address_action: 'clear', customer_address_customer_id: randomUUID() },
        { customer_address: 'Rua C', customer_address_customer_id: randomUUID() }
      ]) await assert.rejects(intake({ phone, input: addressInput(extra) }), error => ['22023', '40001'].includes(error.code));
      assert.deepEqual(await customerRow(id), saved); assert.deepEqual(await counts(), before);
      await intake({ phone, input: addressInput({ customer_address: null, customer_address_action: 'clear', customer_address_customer_id: id }) });
      assert.equal((await customerRow(id)).address, null);
    });
    await t.test('reativação mantém ID, aniversário, notas e histórico e permite atualizar só endereço', async () => {
      const phone = '11987770003';
      const first = await intake({ phone, name: 'Arquivado', input: addressInput({ customer_address: 'Rua Antiga' }) });
      const id = (await details(first.order_id)).customer_id;
      await db.query("update customers set deleted_at=now(),birth_date='2000-02-29',notes='Histórico preservado' where id=$1", [id]);
      assert.equal((await details((await intake({ phone })).order_id)).customer_id, id);
      assert.equal((await customerRow(id)).address, 'Rua Antiga');
      await db.query('update customers set deleted_at=now() where id=$1', [id]);
      assert.equal((await details((await intake({ phone, input: addressInput({ customer_address: 'Rua Nova' }) })).order_id)).customer_id, id);
      const customer = await customerRow(id);
      assert.equal(customer.address, 'Rua Nova'); assert.equal(customer.birth_date, '2000-02-29'); assert.equal(customer.notes, 'Histórico preservado');
      assert.equal((await details(first.order_id)).customer_id, id);
      assert.equal((await db.query('select count(*)::int as n from customers where phone_normalized=$1 and organization_id=$2', [phone, org])).rows[0].n, 1);
    });
    await t.test('endereço inválido ou longo é rejeitado no SQL antes de gravar cliente ou OS', async () => {
      const before = await counts();
      for (const value of ['x'.repeat(301), 123, [], {}]) {
        await assert.rejects(intake({ input: addressInput({ customer_address: value }) }), error => error.code === '22023');
      }
      await assert.rejects(intake({ input: addressInput({ customer_address: 'Rua', customer_address_action: 'invalid' }) }), error => error.code === '22023');
      assert.deepEqual(await counts(), before);
    });
    await t.test('outra organização não tem endereço alterado, nem com ID forjado', async () => {
      const foreign = randomUUID();
      await db.exec('reset role;');
      await db.query("insert into customers(id,organization_id,name,address) values($1,$2,'Outro cliente','Rua externa')", [foreign, otherOrg]);
      await db.exec('set role authenticated;');
      const before = await counts();
      await assert.rejects(intake({ customer: foreign, input: addressInput({ customer_address: 'Tentativa' }) }), error => error.code === '42501');
      await assert.rejects(intake({ organization: otherOrg, customer: foreign, input: addressInput({ customer_address: 'Tentativa' }) }), error => error.code === '42501');
      assert.deepEqual(await counts(), before);
      await db.exec('reset role;');
      assert.equal((await customerRow(foreign)).address, 'Rua externa');
      await db.exec('set role authenticated;');
    });
    await t.test('reenvio idempotente não reaplica outro endereço', async () => {
      const request = randomUUID(), phone = '11987770004';
      const first = await intake({ request, phone, input: addressInput({ customer_address: 'Rua inicial' }) });
      const id = (await details(first.order_id)).customer_id, before = await counts();
      assert.deepEqual(await intake({ request, phone, input: addressInput({ customer_address: 'Não reaplicar' }) }), first);
      assert.equal((await customerRow(id)).address, 'Rua inicial'); assert.deepEqual(await counts(), before);
    });
    await t.test('falha após alteração do endereço desfaz cliente novo, atualização e reativação', async () => {
      const phone = '11987770005';
      const id = (await details((await intake({ phone, input: addressInput({ customer_address: 'Antes' }) })).order_id)).customer_id;
      await db.exec(`reset role;
        create function public.fail_address_test() returns trigger language plpgsql as $$
        begin raise exception 'ADDRESS_ROLLBACK_TEST'; end; $$;
        create trigger fail_address_test before insert on maintenance_events for each row execute function fail_address_test();
        set role authenticated;`);
      try {
        const active = await customerRow(id), before = await counts();
        await assert.rejects(intake({ input: addressInput({ customer_address: 'Novo cliente' }) }), /ADDRESS_ROLLBACK_TEST/);
        await assert.rejects(intake({ phone, input: addressInput({ customer_address: 'Depois' }) }), /ADDRESS_ROLLBACK_TEST/);
        assert.deepEqual(await customerRow(id), active); assert.deepEqual(await counts(), before);
        await db.query('update customers set deleted_at=now() where id=$1', [id]);
        const archived = await customerRow(id);
        await assert.rejects(intake({ phone, input: addressInput({ customer_address: 'Depois' }) }), /ADDRESS_ROLLBACK_TEST/);
        assert.deepEqual(await customerRow(id), archived); assert.deepEqual(await counts(), before);
      } finally { await db.exec('reset role; drop trigger fail_address_test on maintenance_events; drop function fail_address_test(); set role authenticated;'); }
    });
    await t.test('sem permissao para registrar UUID reverte toda a abertura', async () => {
      await db.exec('reset role; revoke update on maintenance_orders from authenticated; set role authenticated;');
      const before = await counts();
      await assert.rejects(intake(), /permission denied/);
      assert.deepEqual(await counts(), before);
    });
  } finally { await db.close(); }
});
