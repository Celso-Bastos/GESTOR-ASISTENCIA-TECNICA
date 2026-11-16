// PostgreSQL descartável. Não lê .env nem acessa Supabase remoto.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PGLITE_TEST_MODULE || '@electric-sql/pglite');

test('0012/0013: schema, RLS, grants, reservas e controle de acesso em PostgreSQL real', async t => {
  const db = new PGlite();
  const admin = randomUUID(), user = randomUUID(), request = randomUUID();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema public, auth to authenticated, anon, service_role;
      grant execute on function auth.uid() to authenticated;
    `);
    await db.exec(readFileSync(path.resolve(__dirname, '../migrations/0012_account_requests.sql'), 'utf8'));
    await db.exec(readFileSync(path.resolve(__dirname, '../migrations/0013_account_request_password_signup.sql'), 'utf8'));
    await db.query('insert into auth.users(id,email) values ($1, $2), ($3, $4)', [admin, 'admin@example.com', user, 'existing@example.com']);
    await db.query('insert into platform_admins(user_id) values ($1)', [admin]);
    await db.query('insert into account_requests(id,full_name,email,email_normalized) values ($1,$2,$3,$3)', [request, 'Maria Silva', 'maria@example.com']);

    await t.test('RLS está ativa nas duas tabelas', async () => {
      const result = await db.query("select relrowsecurity from pg_class where oid in ('public.account_requests'::regclass, 'public.platform_admins'::regclass)");
      assert.equal(result.rows.length, 2); assert.ok(result.rows.every(r => r.relrowsecurity));
    });
    await t.test('anon não pode consultar, inserir, atualizar nem executar lookup Auth', async () => {
      await db.exec('set role anon;');
      for (const sql of ['select * from account_requests', 'select * from platform_admins', "insert into account_requests(full_name,email,email_normalized) values ('Spam','spam@example.com','spam@example.com')", "update account_requests set status='approved'", "select find_account_auth_user('existing@example.com')"]) {
        await assert.rejects(db.exec(sql), /permission denied/);
      }
      await db.exec('reset role;');
    });
    await t.test('usuário comum não vê solicitações nem admins e não consegue promover a si mesmo', async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      await db.exec('set role authenticated;');
      assert.equal((await db.query('select * from account_requests')).rows.length, 0);
      assert.equal((await db.query('select * from platform_admins')).rows.length, 0);
      await assert.rejects(db.query('insert into platform_admins(user_id) values ($1)', [user]), /permission denied/);
      await assert.rejects(db.exec('delete from platform_admins'), /permission denied/);
      await assert.rejects(db.exec("select find_account_auth_user('existing@example.com')"), /permission denied/);
      await db.exec('reset role;');
    });
    await t.test('platform admin lê os pedidos e somente o próprio registro; escrita só pelo servidor', async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
      await db.exec('set role authenticated;');
      assert.equal((await db.query('select * from account_requests')).rows.length, 1);
      assert.equal((await db.query('select * from platform_admins')).rows[0].user_id, admin);
      for (const sql of ["update account_requests set status='approved'", 'delete from account_requests', 'delete from platform_admins']) {
        await assert.rejects(db.exec(sql), /permission denied/);
      }
      await db.exec('reset role;');
    });
    await t.test('service_role consulta Auth com normalização e sem expor outros usuários', async () => {
      await db.exec('set role service_role;');
      assert.equal((await db.query("select find_account_auth_user(' EXISTING@EXAMPLE.COM ') as id")).rows[0].id, user);
      assert.equal((await db.query("select find_account_auth_user('missing@example.com') as id")).rows[0].id, null);
      await db.exec('reset role;');
    });
    await t.test('unicidade pending é garantida no banco; rejeitada permite nova solicitação', async () => {
      await db.exec('set role service_role;');
      const insert = "insert into account_requests(full_name,email,email_normalized) values ('Maria Silva','maria@example.com','maria@example.com')";
      await assert.rejects(db.exec(insert), /unique constraint/);
      await db.query("update account_requests set status='rejected' where id=$1", [request]);
      await db.exec(insert);
      assert.equal((await db.query("select count(*)::int as total from account_requests where status='pending'")).rows[0].total, 1);
      await db.exec('reset role;');
    });
    await t.test('checks rejeitam status e normalização adulterados', async () => {
      await assert.rejects(db.exec("insert into account_requests(full_name,email,email_normalized,status) values ('Maria Silva','x@example.com','x@example.com','active')"), /check constraint/);
      await assert.rejects(db.exec("insert into account_requests(full_name,email,email_normalized) values ('Maria Silva','X@example.com','X@example.com')"), /check constraint/);
    });
    await t.test('UPDATE atômico reserva uma vez, bloqueia rejeição e aceita somente uma finalização', async () => {
      const pending = (await db.query("select id from account_requests where status='pending'")).rows[0].id;
      const before = (await db.query('select updated_at from account_requests where id=$1', [pending])).rows[0].updated_at;
      const claim = "update account_requests set review_started_at=now() where id=$1 and status='pending' and review_started_at is null returning review_started_at";
      const first = await db.query(claim, [pending]); assert.equal(first.rows.length, 1);
      assert.equal((await db.query(claim, [pending])).rows.length, 0);
      assert.equal((await db.query("update account_requests set status='rejected' where id=$1 and status='pending' and review_started_at is null returning id", [pending])).rows.length, 0);
      const approve = "update account_requests set status='approved',reviewed_by=$2,reviewed_at=now(),invite_sent_at=now(),auth_user_id=$3,review_started_at=null where id=$1 and status='pending' and review_started_at=$4 returning *";
      const result = await db.query(approve, [pending, admin, user, first.rows[0].review_started_at]);
      assert.equal(result.rows.length, 1); assert.equal(result.rows[0].reviewed_by, admin); assert.ok(result.rows[0].invite_sent_at);
      assert.ok(result.rows[0].updated_at >= before);
      assert.equal((await db.query(approve, [pending, admin, user, first.rows[0].review_started_at])).rows.length, 0);
    });
    await t.test('0013 mantém convite histórico, adiciona aviso e não cria coluna de senha', async () => {
      const columns = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='account_requests'")).rows.map(r => r.column_name);
      assert.ok(columns.includes('approval_email_sent_at')); assert.ok(columns.includes('invite_sent_at'));
      assert.ok(columns.every(name => !['password', 'password_hash', 'confirm_password'].includes(name)));
      await db.exec('set role anon;');
      await assert.rejects(db.exec('select public.get_account_access_status()'), /permission denied/);
      await db.exec('reset role;');
    });
    await t.test('0013 usa Auth atual e pedido; JWT forjado, revisão parcial e órfão não liberam', async () => {
      const managed = randomUUID();
      await db.query(`insert into auth.users(id,email,raw_app_meta_data) values ($1,'managed@example.com','{"account_status":"pending"}')`, [managed]);
      await db.query("insert into account_requests(full_name,email,email_normalized,auth_user_id) values ('Teste Usuário','managed@example.com','managed@example.com',$1)", [managed]);
      async function status(id) {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
        await db.exec('set role authenticated;');
        try { return (await db.query('select public.get_account_access_status() as status')).rows[0].status; }
        finally { await db.exec('reset role;'); }
      }
      assert.equal(await status(managed), 'pending');
      await db.exec(`select set_config('request.jwt.claims','{"app_metadata":{"account_status":"approved"}}',false)`);
      assert.equal(await status(managed), 'pending');
      await db.query(`update auth.users set raw_app_meta_data='{"account_status":"approved"}' where id=$1`, [managed]);
      assert.equal(await status(managed), 'pending');
      await db.query("update account_requests set status='approved',review_started_at=now() where auth_user_id=$1", [managed]);
      assert.equal(await status(managed), 'blocked');
      await db.query("update account_requests set review_started_at=null where auth_user_id=$1", [managed]);
      assert.equal(await status(managed), 'approved');
      await db.query(`update auth.users set raw_app_meta_data='{"account_status":"rejected"}' where id=$1`, [managed]);
      assert.equal(await status(managed), 'rejected');
      await db.query("update account_requests set status='rejected' where auth_user_id=$1", [managed]);
      await db.query(`update auth.users set raw_app_meta_data='{"account_status":"approved"}' where id=$1`, [managed]);
      assert.equal(await status(managed), 'rejected');
      await db.query('delete from account_requests where auth_user_id=$1', [managed]);
      assert.equal(await status(managed), 'blocked');
      // Contas anteriores sem account_status continuam compatíveis.
      assert.equal(await status(admin), 'approved');
      assert.equal(await status(randomUUID()), 'blocked');
    });
  } finally { await db.close(); }
});
