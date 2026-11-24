// Executa a migration/policies reais em PostgreSQL descartável.
// As tabelas mínimas storage.* simulam o catálogo; não simulam a API HTTP do Storage.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const sql = name => readFileSync(path.join(__dirname, '../migrations', name), 'utf8');

test('0018: documento padrão privado, permissões, substituição e isolamento', async t => {
  const db = new PGlite();
  const owner = randomUUID(), admin = randomUUID(), employee = randomUUID(), outsider = randomUUID(), noMember = randomUUID();
  const org = randomUUID(), other = randomUUID();
  const document = `${org}/warranty/${randomUUID()}.pdf`;
  const next = `${org}/warranty/${randomUUID()}.pdf`;
  const second = `${org}/warranty/${randomUUID()}.pdf`;
  const foreign = `${other}/warranty/${randomUUID()}.pdf`;
  const q = (query, args = []) => db.query(query, args);
  async function login(user = owner, role = 'authenticated') {
    await db.exec('reset role');
    await q("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
    await db.exec(`set role ${role}`);
  }
  const upload = name => q("insert into storage.objects(bucket_id,name,metadata) values ('organization-documents',$1,'{\"mimetype\":\"application/pdf\",\"size\":100}') returning name", [name]);
  const replace = (expected, target, organization = org, name = 'termo-de-garantia.pdf') => q('select replace_organization_warranty_document($1,$2,$3,$4) as ok', [organization, expected, target, name]);
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;
      grant select,insert,update,delete on storage.objects to authenticated,anon;
    `);
    await db.exec(sql('0001_initial_schema.sql').replace('create extension if not exists pgcrypto;', ''));
    await q('insert into auth.users values ($1),($2),($3),($4),($5)', [owner, admin, employee, outsider, noMember]);
    await q("insert into organizations(id,name,slug) values ($1,'Loja A','loja-a'),($2,'Loja B','loja-b')", [org, other]);
    await q("insert into organization_members(organization_id,user_id,role) values ($1,$2,'owner'),($1,$3,'admin'),($1,$4,'employee'),($5,$6,'owner')", [org, owner, admin, employee, other, outsider]);
    await db.exec('grant select,update on organizations to authenticated,anon; grant select on organization_members to authenticated,anon;');
    const before = (await q('select * from organizations where id=$1', [org])).rows[0];
    await db.exec(sql('0018_organization_warranty_document.sql'));

    await t.test('organizações existentes recebem somente metadata nula; bucket privado permite apenas PDF até 4 MB', async () => {
      assert.deepEqual((await q('select * from organizations where id=$1', [org])).rows[0], { ...before, warranty_document_path: null, warranty_document_name: null, warranty_document_updated_at: null });
      assert.deepEqual((await q("select public,file_size_limit,allowed_mime_types from storage.buckets where id='organization-documents'")).rows[0], { public: false, file_size_limit: 4194304, allowed_mime_types: ['application/pdf'] });
      assert.equal((await q("select count(*) from information_schema.columns where table_schema='public' and table_name='maintenance_orders' and column_name like 'warranty_document%'")).rows[0].count, 0);
      const diagnostic = await db.exec(readFileSync(path.join(__dirname, '../diagnostics/0018_warranty_document_check.sql'), 'utf8'));
      assert.equal(diagnostic[0].rows[0].public, false);
      assert.equal(diagnostic[1].rows.length, 3); assert.equal(diagnostic[2].rows.length, 3);
      assert.equal(diagnostic[3].rows[0].rls_enabled, true);
      assert.deepEqual(diagnostic[4].rows[0], { function_exists: true, security_definer: true,
        function_settings: ['search_path=public, pg_temp'], authenticated_can_execute: true, anon_can_execute: false });
      await login();
      assert.deepEqual((await q('select warranty_document_path from organizations where id=$1', [org])).rows, [{ warranty_document_path: null }]);
    });
    await t.test('owner publica termo; exige objeto existente, prefixo correto e nome seguro', async () => {
      await assert.rejects(replace(null, document), /não encontrado/);
      await upload(document);
      for (const [target, name] of [[foreign, 'termo.pdf'], [document, '../termo.pdf'], [document, 'a.html'], [`${org}/warranty/../../outside.pdf`, 'a.pdf']]) await assert.rejects(replace(null, target, org, name), /inválido/);
      assert.equal((await replace(null, document)).rows[0].ok, true);
      const row = (await q('select warranty_document_path,warranty_document_name,warranty_document_updated_at from organizations where id=$1', [org])).rows[0];
      assert.equal(row.warranty_document_path, document); assert.equal(row.warranty_document_name, 'termo-de-garantia.pdf'); assert.ok(row.warranty_document_updated_at);
      assert.equal((await q('delete from storage.objects where name=$1 returning name', [document])).rows.length, 0);
      assert.equal((await q("update storage.objects set name=$1 where name=$2 returning name", [next, document])).rows.length, 0);
    });
    await t.test('employee lê PDF/metadata da própria loja, mas não faz upload, substituição ou exclusão', async () => {
      await login(employee);
      assert.equal((await q('select name from storage.objects')).rows[0].name, document);
      await assert.rejects(upload(next), /row-level security/);
      await assert.rejects(replace(document, next), /não autorizada/);
      assert.equal((await q('delete from storage.objects returning name')).rows.length, 0);
      assert.equal((await q("update organizations set warranty_document_name='forged.pdf' where id=$1 returning id", [org])).rows.length, 0);
    });
    await t.test('organização B não lê nem altera documentos/metadata de A, mesmo sabendo o path', async () => {
      await login(outsider);
      assert.equal((await q('select name from storage.objects where name=$1', [document])).rows.length, 0);
      assert.equal((await q('select warranty_document_path from organizations where id=$1', [org])).rows.length, 0);
      await assert.rejects(upload(next), /row-level security/);
      await assert.rejects(replace(document, next), /não autorizada/);
      await upload(foreign); assert.equal((await replace(null, foreign, other)).rows[0].ok, true);
      assert.equal((await q('delete from storage.objects where name=$1 returning name', [document])).rows.length, 0);
    });
    await t.test('admin substitui com compare-and-swap; conflito preserva vencedor e permite limpar só o perdedor', async () => {
      await login(admin);
      await upload(next); await upload(second);
      assert.equal((await replace(document, next)).rows[0].ok, true);
      assert.equal((await replace(document, second)).rows[0].ok, false);
      assert.equal((await q('select warranty_document_path from organizations where id=$1', [org])).rows[0].warranty_document_path, next);
      assert.equal((await q('delete from storage.objects where name=$1 returning name', [next])).rows.length, 0);
      assert.equal((await q('delete from storage.objects where name=$1 returning name', [second])).rows.length, 1);
      assert.equal((await q('delete from storage.objects where name=$1 returning name', [document])).rows.length, 1);
    });
    await t.test('falha na metadata reverte troca; termo anterior continua disponível', async () => {
      await db.exec('reset role');
      await db.exec("alter table organizations add constraint simulated_failure check (warranty_document_name is distinct from 'falhar.pdf')");
      await login(); await upload(second);
      await assert.rejects(replace(next, second, org, 'falhar.pdf'), /simulated_failure/);
      assert.equal((await q('select warranty_document_path from organizations where id=$1', [org])).rows[0].warranty_document_path, next);
      assert.equal((await q('delete from storage.objects where name=$1 returning name', [second])).rows.length, 1);
      assert.equal((await q('select name from storage.objects where name=$1', [next])).rows.length, 1);
    });
    await t.test('anônimo e autenticado sem membership não acessam arquivos, listagem ou RPC', async () => {
      for (const [user, role] of [[noMember, 'authenticated'], [null, 'anon']]) {
        await login(user, role);
        assert.equal((await q("select name from storage.objects where bucket_id='organization-documents'")).rows.length, 0);
        await assert.rejects(upload(second), /row-level security/);
        await assert.rejects(replace(next, second), /não autorizada|permission denied/);
      }
    });
  } finally { await db.close(); }
});
