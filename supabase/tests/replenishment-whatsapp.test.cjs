const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');const {PGlite}=require('@electric-sql/pglite');
const sql=name=>fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8');
test('0019: fornecedores N:N, preferencial único, RLS, roles e isolamento no PostgreSQL',async t=>{
 const db=new PGlite();const org=randomUUID(),other=randomUUID(),owner=randomUUID(),admin=randomUUID(),employee=randomUUID(),outsider=randomUUID(),nomember=randomUUID();
 const product=randomUUID(),productB=randomUUID(),foreignProduct=randomUUID();let a,b,c,foreign;
 const q=(text,args=[])=>db.query(text,args);
 async function login(user=owner,role='authenticated'){await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[user??'']);await db.exec(`set role ${role}`);}
 const add=async(name,active=true,organization=org)=> (await q('insert into inventory_suppliers(organization_id,name,is_active) values($1,$2,$3) returning id',[organization,name,active])).rows[0].id;
 const set=(p,s,preferred=false,linked=true,organization=org,operation)=>q('select set_inventory_product_supplier($1,$2,$3,$4)',[organization,p,s,operation??(!linked?'remove':preferred?'prefer':'add')]);
 try{
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;
   grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated,anon;`);
  await db.exec(sql('0001_initial_schema.sql').replace('create extension if not exists pgcrypto;',''));
  for(const name of ['0006_add_product_outflows.sql','0007_add_privacy_screen_protector_category.sql','0008_sync_product_category_constraints.sql','0017_complete_inventory.sql','0018_organization_warranty_document.sql'])await db.exec(sql(name));
  await q('insert into auth.users values($1),($2),($3),($4),($5)',[owner,admin,employee,outsider,nomember]);
  await q("insert into organizations(id,name,slug) values($1,'A','a'),($2,'B','b')",[org,other]);
  await q("insert into organization_members(organization_id,user_id,role) values($1,$2,'owner'),($1,$3,'admin'),($1,$4,'employee'),($5,$6,'owner')",[org,owner,admin,employee,other,outsider]);
  await q("insert into product_model_templates(id,organization_id,category,model_name) values($1,$2,'case','A05'),($3,$2,'cable','USB'),($4,$5,'case','B')",[product,org,productB,foreignProduct,other]);
  await db.exec('grant select,insert,update,delete on organizations,organization_members,product_model_templates to authenticated;');
  const before=(await q('select stock_quantity,minimum_stock from product_model_templates where id=$1',[product])).rows[0];
  await db.exec(sql('0019_inventory_suppliers.sql'));
  await t.test('não introduz coluna global nem altera saldo; tabelas têm RLS e índice preferencial',async()=>{
   assert.equal((await q("select count(*) from information_schema.columns where table_name='organizations' and column_name='replenishment_whatsapp_phone'")).rows[0].count,0);
   assert.deepEqual((await q('select stock_quantity,minimum_stock from product_model_templates where id=$1',[product])).rows[0],before);
   assert.equal((await q("select count(*) from pg_class where relname in ('inventory_suppliers','inventory_product_suppliers') and relrowsecurity")).rows[0].count,2);
   assert.match((await q("select indexdef from pg_indexes where indexname='inventory_product_suppliers_one_preferred_idx'")).rows[0].indexdef,/UNIQUE.*WHERE is_preferred/);
  });
  await login();a=await add('Distribuidora A');b=await add('Atacado B');c=await add('Inativo',false);
  await t.test('nome/telefone/notas válidos; criado por sessão; delete físico proibido',async()=>{
   assert.equal((await q('select created_by from inventory_suppliers where id=$1',[a])).rows[0].created_by,owner);
   for(const name of ['',' '.repeat(2),'x'.repeat(121)])await assert.rejects(add(name),/check constraint/);
   for(const phone of ['123','98999999999','000000000000'])await assert.rejects(q('update inventory_suppliers set whatsapp_phone=$1 where id=$2',[phone,a]),/check constraint/);
   await q("update inventory_suppliers set whatsapp_phone='5598999999999',notes='Contato' where id=$1",[a]);
   await assert.rejects(q('delete from inventory_suppliers where id=$1',[a]),/permission denied/);
   await assert.rejects(q('update inventory_suppliers set organization_id=$1 where id=$2',[other,a]),/permission denied/);
  });
  await t.test('produto com vários fornecedores e fornecedor com vários produtos; sem duplicar vínculo',async()=>{
   await set(product,a);await set(product,b);await set(productB,a);await set(product,a);
   assert.equal((await q('select count(*) from inventory_product_suppliers')).rows[0].count,3);
   await assert.rejects(q('insert into inventory_product_suppliers(organization_id,product_model_id,supplier_id) values($1,$2,$3)',[org,product,a]),/unique constraint/);
  });
  await t.test('preferencial opcional, único e troca atômica; DML direto não consegue dois',async()=>{
   assert.equal((await q('select count(*) from inventory_product_suppliers where is_preferred')).rows[0].count,0);
   await set(product,a,true);await set(product,a);assert.equal((await q('select is_preferred from inventory_product_suppliers where product_model_id=$1 and supplier_id=$2',[product,a])).rows[0].is_preferred,true);await assert.rejects(q('update inventory_product_suppliers set is_preferred=true where supplier_id=$1 and product_model_id=$2',[b,product]),/unique constraint/);
   await set(product,b,true);assert.deepEqual((await q('select supplier_id from inventory_product_suppliers where product_model_id=$1 and is_preferred',[product])).rows,[{supplier_id:b}]);
   await set(product,b,false,true,org,'unprefer');assert.equal((await q('select count(*) from inventory_product_suppliers where is_preferred')).rows[0].count,0);
   await Promise.all([set(product,a,true),set(product,b,true)]);assert.equal((await q('select count(*) from inventory_product_suppliers where product_model_id=$1 and is_preferred',[product])).rows[0].count,1);
  });
  await t.test('inativo preserva vínculos; não pode receber novos; reativação/remover vínculo preserva fornecedor',async()=>{
   await q('update inventory_suppliers set is_active=false where id=$1',[a]);assert.equal((await q('select count(*) from inventory_product_suppliers where supplier_id=$1',[a])).rows[0].count,2);
   await assert.rejects(set(product,a),/indisponível/);await assert.rejects(set(product,c),/indisponível/);
   await assert.rejects(q('insert into inventory_product_suppliers(organization_id,product_model_id,supplier_id) values($1,$2,$3)',[org,product,c]),/row-level security/);
   await set(product,a,false,false);assert.equal((await q('select count(*) from inventory_suppliers where id=$1',[a])).rows[0].count,1);
   await q('update inventory_suppliers set is_active=true where id=$1',[a]);await set(product,a);
  });
  await t.test('custo de compra opcional separado e validado; nenhum total financeiro',async()=>{
   await q('update inventory_product_suppliers set supplier_unit_cost=4.50 where supplier_id=$1',[a]);
   await assert.rejects(q('update inventory_product_suppliers set supplier_unit_cost=-1 where supplier_id=$1',[a]),/check constraint/);
   assert.equal((await q('select default_price from product_model_templates where id=$1',[product])).rows[0].default_price,null);
  });
  await t.test('employee lê mas não cadastra/edita/desativa/vincula/remove/pretere',async()=>{
   await login(employee);assert.equal((await q('select count(*) from inventory_suppliers')).rows[0].count,3);
   await assert.rejects(add('forged'),/row-level security/);
   assert.equal((await q("update inventory_suppliers set name='forged' where id=$1 returning id",[a])).rows.length,0);
   await assert.rejects(set(product,b,true),/não autorizada/);
   assert.equal((await q('delete from inventory_product_suppliers returning id')).rows.length,0);
   assert.equal((await q('update inventory_product_suppliers set is_preferred=true returning id')).rows.length,0);
   await assert.rejects(q('insert into inventory_product_suppliers(organization_id,product_model_id,supplier_id) values($1,$2,$3)',[org,product,c]),/row-level security/);
  });
  await t.test('admin pode editar e preferir; organização B não lê nem escreve A',async()=>{
   await login(admin);await q("update inventory_suppliers set name='A editado' where id=$1",[a]);await set(product,a,true);
   await login(outsider);foreign=await add('Fornecedor B',true,other);
   assert.equal((await q('select id from inventory_suppliers where id=$1',[a])).rows.length,0);assert.equal((await q('select id from inventory_product_suppliers')).rows.length,0);
   assert.equal((await q('update inventory_suppliers set is_active=false where id=$1 returning id',[a])).rows.length,0);
   await assert.rejects(set(product,a,true,true,org),/não autorizada/);
   await assert.rejects(set(product,foreign,true,true,other),/Produto não encontrado/);
   await assert.rejects(q('insert into inventory_product_suppliers(organization_id,product_model_id,supplier_id) values($1,$2,$3)',[other,foreignProduct,a]),/row-level security|foreign key/);
  });
  await t.test('FKs compostas bloqueiam cross-tenant até para papel privilegiado, rollback mantém preferencial',async()=>{
   await db.exec('reset role');
   for(const [organization,p,s]of [[org,product,foreign],[org,foreignProduct,a],[other,product,foreign]])await assert.rejects(q('insert into inventory_product_suppliers(organization_id,product_model_id,supplier_id) values($1,$2,$3)',[organization,p,s]),/foreign key/);
   await login();await assert.rejects(set(product,foreign,true),/indisponível/);
   assert.deepEqual((await q('select supplier_id from inventory_product_suppliers where product_model_id=$1 and is_preferred',[product])).rows,[{supplier_id:a}]);
  });
  await t.test('anônimo/sem membership não acessam tabelas nem RPC',async()=>{
   for(const [user,role]of [[nomember,'authenticated'],[null,'anon']]){
    await login(user,role);await assert.rejects(set(product,a),/não autorizada|permission denied/);
    if(role==='anon')await assert.rejects(q('select * from inventory_suppliers'),/permission denied/);else assert.equal((await q('select * from inventory_suppliers')).rows.length,0);
   }
  });
 }finally{await db.close();}
});
