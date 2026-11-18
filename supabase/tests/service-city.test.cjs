// PostgreSQL descartável; não lê .env e não acessa Supabase remoto.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PGLITE_TEST_MODULE || '@electric-sql/pglite');
const sql = name => readFileSync(path.resolve(__dirname, '../migrations', name), 'utf8');

test('0015: cidade de serviço, compatibilidade e isolamento', async t => {
  const db = new PGlite();
  const user = randomUUID(), otherUser = randomUUID(), ownOrg = randomUUID(), otherOrg = randomUUID(), request = randomUUID();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
      $$;
      grant usage on schema auth,public to authenticated,anon,service_role;
      grant execute on function auth.uid() to authenticated;
    `);
    await db.exec(sql('0001_initial_schema.sql').replace('create extension if not exists pgcrypto;', ''));
    await db.exec(sql('0012_account_requests.sql'));
    await db.exec(sql('0013_account_request_password_signup.sql'));
    await db.query("insert into auth.users(id,email) values ($1,'own@example.com'),($2,'other@example.com')", [user, otherUser]);
    await db.query("insert into organizations(id,name,slug) values ($1,'Minha loja','own'),($2,'Outra loja','other')", [ownOrg, otherOrg]);
    await db.query("insert into organization_members(organization_id,user_id,role) values ($1,$2,'owner'),($3,$4,'owner')", [ownOrg, user, otherOrg, otherUser]);
    await db.query("insert into account_requests(id,full_name,email,email_normalized,auth_user_id) values ($1,'Nome antigo','own@example.com','own@example.com',$2)", [request, user]);
    await t.test('migration reaplicável adiciona somente colunas text nullable sem backfill', async () => {
      const beforeOrg = (await db.query('select * from organizations where id=$1', [ownOrg])).rows[0];
      const beforeRequest = (await db.query('select * from account_requests where id=$1', [request])).rows[0];
      await db.exec(sql('0015_add_service_city.sql')); await db.exec(sql('0015_add_service_city.sql'));
      assert.deepEqual((await db.query('select * from organizations where id=$1', [ownOrg])).rows[0], { ...beforeOrg, service_city: null });
      assert.deepEqual((await db.query('select * from account_requests where id=$1', [request])).rows[0], { ...beforeRequest, service_city: null });
      const columns = (await db.query(`select table_name,data_type,is_nullable,column_default from information_schema.columns
        where table_schema='public' and table_name in ('organizations','account_requests') and column_name='service_city' order by table_name`)).rows;
      assert.deepEqual(columns, ['account_requests', 'organizations'].map(table_name => ({ table_name, data_type: 'text', is_nullable: 'YES', column_default: null })));
    });
    await t.test('pedido aprovado fornece cidade inicial; organização mantém configuração independente', async () => {
      await db.query("update account_requests set service_city='Anajatuba - MA',status='approved' where id=$1", [request]);
      await db.query("update organizations set service_city=(select service_city from account_requests where auth_user_id=$2 and status='approved') where id=$1", [ownOrg, user]);
      assert.equal((await db.query('select service_city from organizations where id=$1', [ownOrg])).rows[0].service_city, 'Anajatuba - MA');
      await db.query("update organizations set service_city='São Luís - MA' where id=$1", [ownOrg]);
      assert.equal((await db.query('select service_city from organizations where id=$1', [ownOrg])).rows[0].service_city, 'São Luís - MA');
      assert.equal((await db.query('select service_city from account_requests where id=$1', [request])).rows[0].service_city, 'Anajatuba - MA');
    });
    await db.exec('grant select on organizations,organization_members to authenticated,anon;');
    await t.test('RLS isola organizações e cidade das solicitações não é pública', async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      await db.exec('set role authenticated;');
      assert.equal((await db.query('select service_city from organizations where id=$1', [ownOrg])).rows[0].service_city, 'São Luís - MA');
      assert.equal((await db.query('select * from organizations where id=$1', [otherOrg])).rows.length, 0);
      assert.equal((await db.query('select service_city from account_requests')).rows.length, 0);
      await assert.rejects(db.query("update organizations set service_city='Tentativa' where id=$1", [otherOrg]), /permission denied/);
      await db.exec('reset role; set role anon;');
      assert.equal((await db.query('select service_city from organizations')).rows.length, 0);
      await assert.rejects(db.exec('select service_city from account_requests'), /permission denied/);
      await db.exec('reset role;');
    });
  } finally { await db.close(); }
});
