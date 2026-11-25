/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const org = '10000000-0000-4000-8000-000000000001';
const model = '20000000-0000-4000-8000-000000000001';
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (!/\.(ts|tsx)$/.test(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true
    } }).outputText;
    function req(name) {
      if (Object.hasOwn(overrides,name)) return overrides[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file),name));
      return require(name);
    }
    new Function('require','module','exports',code)(req,mod,mod.exports);
    return mod.exports;
  }
  return load;
}
const item = (extra = {}) => ({ id:model, category:'case', model_name:'A05', stock_quantity:3, minimum_stock:5, unit_cost:4, default_price:15, is_active:true, ...extra });
const form = values => { const data = new FormData(); for (const [key,value] of Object.entries(values)) data.set(key,value); return data; };
const boundaries = client => ({
  '@/lib/auth/queries': { requireAuth:async()=>({id:model}),getCurrentUser:async()=>({id:model}) },
  '@/lib/organization/queries': { requireOrganization:async()=>({id:org}),getCurrentOrganization:async()=>({id:org}) },
  '@/lib/supabase/server': {createClient:async()=>client},
  'next/cache': {revalidatePath(){}},
  'next/link': ({href,children,...props})=>React.createElement('a',{href,...props},children)
});


const supplierA='30000000-0000-4000-8000-000000000001';
const supplierB='30000000-0000-4000-8000-000000000002';
const supplierC='30000000-0000-4000-8000-000000000003';
const modelB='20000000-0000-4000-8000-000000000002';
const modelC='20000000-0000-4000-8000-000000000003';
const suppliers=[{id:supplierA,name:'Distribuidora Á',whatsapp_phone:'5598999999999',notes:null,is_active:true},
 {id:supplierB,name:'Atacado B',whatsapp_phone:null,notes:null,is_active:true},{id:supplierC,name:'Inativo',whatsapp_phone:null,notes:null,is_active:false}];
const link=(product,supplier,preferred=false)=>({id:product+supplier,product_model_id:product,supplier_id:supplier,is_preferred:preferred});
const items=[item({stock_quantity:-2}),item({id:modelB,category:'screen_protector',model_name:'Película + Á',stock_quantity:1}),item({id:modelC,model_name:'Sem ativo'})];
const links=[link(model,supplierA,true),link(model,supplierB),link(modelB,supplierA),link(modelC,supplierC,true)];
const helpers=()=>loader()('src/lib/inventory-suppliers/restock.ts');
const actionsPath='src/lib/inventory-suppliers/actions.ts';
const queriesPath='src/lib/inventory-suppliers/queries.ts';
const pagePath='src/app/(dashboard)/estoque/reposicao/page.tsx';
const supplierBoundary='@/lib/inventory-suppliers/queries';
const pageLoader=(data={suppliers,links},inventory=items,role='owner')=>loader({...boundaries({}),
 '@/lib/organization/queries':{requireOrganization:async()=>({id:org,role})},
 '@/lib/inventory-suppliers/actions':{saveInventorySupplier(){},setInventorySupplierStatus(){},updateProductSupplier(){}},
 [supplierBoundary]:{getInventorySupplierData:async()=>data,getSupplierProduct:async()=>({product:item()})},
 '../actions':{getInventoryItems:async()=>({items:inventory})},'../../actions':{getInventoryItems:async()=>({items:inventory})}});
const renderPage=async(params={})=>renderToStaticMarkup(await pageLoader()(pagePath).default({searchParams:Promise.resolve(params)}));

test('telefone brasileiro reutiliza helpers; máscara, internacional, vazio e inválido',()=>{
 const schema=loader()('src/lib/validations/replenishment-whatsapp.ts').replenishmentWhatsAppPhoneSchema;
 for(const value of ['(98) 99999-9999','98999999999','+55 98 99999-9999','5598999999999'])assert.equal(schema.parse(value),'5598999999999');
 assert.equal(schema.parse('  '),null);assert.equal(schema.parse('(98) 3333-4444'),'559833334444');
 for(const value of ['abc','123','98999999999ABC','+1 202 555 1234','00000000000','++5598999999999'])assert.equal(schema.safeParse(value).success,false);
});

test('fornecedor exige nome, limita observações e aceita telefone/custo ausentes sem preço de venda',()=>{
 const schema=loader()('src/lib/inventory-suppliers/validation.ts').supplierSchema;
 const base={name:' Distribuidora Á ',notes:'',whatsapp_phone:'',is_active:true};
 assert.deepEqual(schema.parse(base),{name:'Distribuidora Á',notes:null,whatsapp_phone:null,is_active:true});
 for(const extra of [{name:' '},{name:'x'.repeat(121)},{notes:'x'.repeat(2001)},{whatsapp_phone:'123'}])assert.equal(schema.safeParse({...base,...extra}).success,false);
});

test('Todos conta produto só uma vez e mantém fornecedores/preferencial sem repartir déficit',()=>{
 const {getSupplierRestock:restock,getRestockIndicators:totals}=helpers();const rows=restock(items,suppliers,links);
 assert.equal(rows.length,3);assert.equal(rows[0].suppliers.length,2);assert.equal(rows[0].preferred.id,supplierA);assert.equal(rows[0].suggested,7);
 assert.deepEqual(totals(rows),{models:3,units:13,categories:2,withoutSupplier:1});
 assert.equal(restock(items,suppliers,links,{supplierId:supplierA}).find(i=>i.id===model).suggested,7);
 assert.equal(restock(items,suppliers,links,{supplierId:supplierB}).find(i=>i.id===model).suggested,7);
});

test('categoria, fornecedor, combinação e busca de modelo/fornecedor respeitam recorte',()=>{
 const {getSupplierRestock:r}=helpers();
 assert.deepEqual(r(items,suppliers,links,{category:'screen_protector'}).map(i=>i.id),[modelB]);
 assert.equal(r(items,suppliers,links,{supplierId:supplierA}).length,2);
 assert.deepEqual(r(items,suppliers,links,{supplierId:supplierA,category:'case'}).map(i=>i.id),[model]);
 assert.equal(r(items,suppliers,links,{search:'distribuidora a'}).length,2);
 assert.deepEqual(r(items,suppliers,links,{search:'pelicula + a'}).map(i=>i.id),[modelB]);
 assert.equal(r(items,suppliers,links,{supplierId:'forged'}).length,0);
});

test('sem fornecedor inclui apenas fornecedor inativo; preferencial inativo não é opção de compra',()=>{
 const {getSupplierRestock:r}=helpers();const rows=r(items,suppliers,links,{withoutSupplier:true});
 assert.deepEqual(rows.map(i=>i.id),[modelC]);assert.equal(rows[0].preferred,null);
 assert.equal(r(items,suppliers,links,{supplierId:supplierC}).length,0);
 assert.equal(r([item()],suppliers,[link(model,supplierA),link(model,supplierB)])[0].preferred,null);
 assert.equal(r([item()],[],[])[0].suppliers.length,0);
});

test('mensagem única: curta, categorias reais, nomes/Unicode integrais, totais e regras consolidadas',()=>{
 const {formatSupplierRestockList:message}=helpers();const large='Á + & / ? # % 😀 '.repeat(200);
 const text=message([item({stock_quantity:-2}),item({id:modelB,category:'screen_protector',model_name:large,stock_quantity:0}),
 item({id:'minimum',stock_quantity:5}),item({id:'above',stock_quantity:6}),item({id:'inactive',is_active:false}),item({id:'zero',minimum_stock:0,stock_quantity:0})]);
 assert.ok(text.includes('Case\n• A05 — repor 7'));assert.ok(text.includes('Película\n• '+large+' — repor 5'));
 assert.match(text,/Total de modelos: 2/);assert.match(text,/Total de unidades: 12/);assert.doesNotMatch(text,/atual:|mínimo:|default_price/);
 assert.match(message([item()]),/Total de unidades: 2/);assert.match(message([item({minimum_stock:0,stock_quantity:-2})]),/repor 2/);
 assert.equal(message([]),'Nenhum produto precisa de reposição neste filtro.');
});

test('URL wa.me preserva destinatário e encoding; limite não trunca e nunca abre vazio',()=>{
 const {getRestockWhatsAppLink:r,RESTOCK_WHATSAPP_MAX_URL_LENGTH:max}=loader()('src/lib/products/restock-whatsapp.ts');
 const message='Olá!\nPelícula + Á & / ? # % 😀';const result=r('5598999999999',message,true);const url=new URL(result.url);
 assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/5598999999999');assert.equal(url.searchParams.get('text'),message);
 const prefix='https://wa.me/5598999999999?text=';assert.equal(r('5598999999999','a'.repeat(max-prefix.length),true).url.length,max);
 assert.deepEqual(r('5598999999999','a'.repeat(max-prefix.length+1),true),{url:null,tooLong:true});
 assert.deepEqual(r(null,message,true),{url:null,tooLong:false});assert.equal(r('5598999999999',message,false).url,null);
});

test('Todos/categoria/Sem fornecedor têm cópia filtrada e não têm envio arbitrário',async()=>{
 for(const params of [{},{categoria:'screen_protector'},{visao:'sem-fornecedor'}]){
  const html=await renderPage(params);assert.match(html,/Copiar lista/);assert.doesNotMatch(html,/Enviar pelo WhatsApp|href="https:\/\/wa.me/);
  if(params.categoria){assert.match(html,/Película \+ Á — repor 4/);assert.doesNotMatch(html,/A05 — repor/);}
  if(params.visao){assert.match(html,/Sem ativo — repor 2/);assert.doesNotMatch(html,/A05 — repor/);}
 }
});

test('fornecedor específico só envia itens dele, inclusive categoria combinada e estoque negativo interno',async()=>{
 const html=await renderPage({fornecedor:supplierA,categoria:'case'});assert.match(html,/href="https:\/\/wa.me\/5598999999999/);
 assert.match(html,/atual|Atual: -2/);assert.match(html,/Repor: <strong>7/);assert.match(html,/Também disponível em: .*Atacado B/);
 assert.match(html,/Fornecedor preferencial/);assert.match(html,/A05 — repor 7/);assert.doesNotMatch(html,/Película \+ Á — repor/);
 const href=html.match(/href="(https:\/\/wa.me\/[^\"]+)"/)[1];const message=new URL(href.replaceAll('&amp;','&')).searchParams.get('text');
 assert.match(message,/A05 — repor 7/);assert.doesNotMatch(message,/mínimo|atual|Película/);
});

test('fornecedor sem telefone mantém cópia/edição; inválido ou inativo não oferece lista geral como fallback',async()=>{
 const html=await renderPage({fornecedor:supplierB});assert.match(html,/WhatsApp não configurado para este fornecedor/);assert.match(html,/Editar fornecedor/);assert.match(html,/Copiar lista/);assert.doesNotMatch(html,/href="https:\/\/wa.me/);
 for(const fornecedor of ['forged',supplierC]){const invalid=await renderPage({fornecedor});assert.match(invalid,/Fornecedor não encontrado ou inativo/);assert.doesNotMatch(invalid,/href="https:\/\/wa.me|A05 — repor/);}
});

test('sumários por categoria/fornecedor mantêm contadores únicos e deixam sobreposição explícita',async()=>{
 const supplier=await renderPage({visao:'fornecedores'});assert.match(supplier,/podem se sobrepor/);assert.match(supplier,/Distribuidora Á/);assert.match(supplier,/Atacado B/);
 assert.match(await renderPage({visao:'categorias'}),/Modelos: 1 · Unidades sugeridas: 4/);
});

test('lista vazia e falhas de dados nunca produzem envio ou cópia de lista parcial',async()=>{
 const empty=renderToStaticMarkup(await pageLoader({suppliers,links},[])(pagePath).default());assert.match(empty,/Nenhum produto precisa de reposição no momento/);
 const specific=renderToStaticMarkup(await pageLoader({suppliers,links},[])(pagePath).default({searchParams:Promise.resolve({fornecedor:supplierA})}));assert.doesNotMatch(specific,/href="https:\/\/wa.me/);
 const failure=renderToStaticMarkup(await pageLoader({suppliers:[],links:[],error:'Falha de schema'})(pagePath).default());assert.match(failure,/Não foi gerada uma lista parcial/);assert.doesNotMatch(failure,/Copiar lista|Enviar pelo WhatsApp/);
});

test('cadastro/edição owner/admin usam cliente autenticado, validação e organização da sessão; employee bloqueado',async()=>{
 for(const role of ['owner','admin','employee']){
  const calls=[];let writes=0;const query=new Proxy({}, {get(_,key){if(key==='single'||key==='maybeSingle')return async()=>({data:{id:supplierA},error:null});return(...args)=>{calls.push([key,...args]);if(key==='insert'||key==='update')writes++;return query;};}});
  const load=loader({'@/lib/organization/queries':{requireOrganization:async()=>({id:org,role})},'@/lib/supabase/server':{createClient:async()=>({from:()=>query})},'next/cache':{revalidatePath(){}}});
  const action=load(actionsPath).saveInventorySupplier;const input=form({name:'Loja A',whatsapp_phone:'(98) 99999-9999',notes:'',is_active:'on',organization_id:'forged',created_by:'forged'});
  const result=await action(null,{},input);
  if(role==='employee'){assert.ok(result.error);assert.equal(writes,0);continue;}
  assert.ok(result.success);const inserted=calls.find(c=>c[0]==='insert')[1];assert.equal(inserted.organization_id,org);assert.equal(inserted.whatsapp_phone,'5598999999999');assert.equal(inserted.created_by,undefined);
  assert.ok((await action(supplierA,{},input)).success);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='organization_id'&&c[2]===org));
  assert.ok((await action(null,{},form({name:'',whatsapp_phone:'123'}))).error);assert.equal(writes,2);
 }
});

test('vincular/remover/preferir/desmarcar usam RPC atômica com ID da sessão e não modificam estoque',async()=>{
 for(const operation of ['add','remove','prefer','unprefer']){
  const calls=[];const action=loader({'@/lib/organization/queries':{requireOrganization:async()=>({id:org,role:'admin'})},'@/lib/supabase/server':{createClient:async()=>({rpc:async(...args)=>{calls.push(args);return{error:null};}})},'next/cache':{revalidatePath(){}}})(actionsPath).updateProductSupplier;
  assert.ok((await action(model,{},form({supplier_id:supplierA,operation,organization_id:'forged'}))).success);
  assert.deepEqual(calls,[['set_inventory_product_supplier',{p_organization_id:org,p_product_model_id:model,p_supplier_id:supplierA,p_operation:operation}]]);
  assert.ok((await action('invalid',{},form({supplier_id:supplierA,operation}))).error);assert.equal(calls.length,1);
 }
});

test('roles e sessão expirada bloqueiam todas as mutações antes do banco',async()=>{
 for(const role of ['employee','expired']){
  const actions=loader({'@/lib/organization/queries':{requireOrganization:async()=>{if(role==='expired')throw Error('expired');return{id:org,role};}},'@/lib/supabase/server':{createClient(){assert.fail('Não autorizado');}}})(actionsPath);
  for(const [method,args]of [['saveInventorySupplier',[null,{},form({})]],['setInventorySupplierStatus',[supplierA,{},form({is_active:'false'})]],['updateProductSupplier',[model,{},form({supplier_id:supplierA,operation:'prefer'})]]]){
   if(role==='expired')await assert.rejects(()=>actions[method](...args),/expired/);else assert.ok((await actions[method](...args)).error);
  }
 }
});

test('desativação só atualiza is_active na organização atual e preserva vínculos',async()=>{
 const calls=[];const query=new Proxy({}, {get(_,key){if(key==='maybeSingle')return async()=>({data:{id:supplierA},error:null});return(...args)=>{calls.push([key,...args]);return query;};}});
 const action=loader({'@/lib/organization/queries':{requireOrganization:async()=>({id:org,role:'owner'})},'@/lib/supabase/server':{createClient:async()=>({from:table=>{calls.push(['from',table]);return query;}})},'next/cache':{revalidatePath(){}}})(actionsPath).setInventorySupplierStatus;
 assert.ok((await action(supplierA,{},form({is_active:'false',organization_id:'foreign'}))).success);
 assert.deepEqual(calls.find(c=>c[0]==='update')[1],{is_active:false});assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='organization_id'&&c[2]===org));assert.equal(calls.filter(c=>c[0]==='from').length,1);
});

test('leituras paginam, filtram tenant e IDs em lote, e não retornam dados parciais em erro',async()=>{
 for(const organizationId of [org,'other-org']){
  const calls=[];let linksBatch=0;
  const client={from(table){const query=new Proxy({}, {get(_,key){if(key==='returns')return async()=>({data:table==='inventory_suppliers'?suppliers:linksBatch++===0?Array.from({length:500},()=>links[0]):[links[1]],error:null});return(...args)=>{calls.push([table,key,...args]);return query;};}});return query;}};
  const read=loader({'@/lib/organization/queries':{requireOrganization:async()=>({id:organizationId})},'@/lib/supabase/server':{createClient:async()=>client}})(queriesPath).getInventorySupplierData;
  const data=await read({productIds:[model,modelB]});assert.equal(data.links.length,501);
  for(const table of ['inventory_suppliers','inventory_product_suppliers'])assert.ok(calls.some(c=>c[0]===table&&c[1]==='eq'&&c[2]==='organization_id'&&c[3]===organizationId));
  assert.ok(calls.some(c=>c[1]==='in'&&c[2]==='product_model_id'));assert.ok(calls.some(c=>c[1]==='range'&&c[2]===500));
 }
 let batch=0;const client={from(){const query=new Proxy({}, {get(_,key){if(key==='returns')return async()=>batch++===0?{data:suppliers,error:null}:{data:null,error:{code:'FAIL'}};return()=>query;}});return query;}};
 const read=loader({'@/lib/organization/queries':{requireOrganization:async()=>({id:org})},'@/lib/supabase/server':{createClient:async()=>client}})(queriesPath).getInventorySupplierData;
 const failed=await read();assert.deepEqual(failed.links,[]);assert.deepEqual(failed.suppliers,[]);assert.ok(failed.error);
});

test('formulários e páginas de gestão aparecem só para owner/admin; contagem de produtos e vínculos preservada',async()=>{
 for(const role of ['owner','admin','employee']){
  const load=pageLoader({suppliers,links},items,role);
  const list=renderToStaticMarkup(await load('src/app/(dashboard)/estoque/fornecedores/page.tsx').default({searchParams:Promise.resolve({novo:'1'})}));
  assert.equal(list.includes('Salvar fornecedor'),role!=='employee');assert.equal(/>Desativar<\/button>/.test(list),role!=='employee');assert.match(list,/2 produtos vinculados/);assert.match(list,/Ver produtos/);
  const product=renderToStaticMarkup(await load('src/app/(dashboard)/saidas/modelos/[id]/fornecedores/page.tsx').default({params:Promise.resolve({id:model})}));
  assert.equal(product.includes('Definir preferencial'),role!=='employee');assert.equal(/>Remover vínculo<\/button>/.test(product),role!=='employee');assert.match(product,/Preferencial/);
 }
});

test('Web Share detecta suporte; Clipboard copia texto inteiro e preserva fallback manual',async()=>{
 const {canShareRestock:can}=loader()('src/lib/products/restock-whatsapp.ts');assert.equal(can({},'lista'),false);assert.equal(can({share(){},canShare(){throw Error();}},'lista'),false);assert.equal(can({share(){},canShare:()=>true},'lista'),true);
 for(const fail of [false,true]){
  let copied,manual,index=0;const text='Á +\n'+'x'.repeat(9000);
  const load=loader({react:{useState:()=>{const state=index++;return[false,value=>{if(state===1)manual=value;}];},useRef:()=>({current:null})}});
  const Button=load('src/app/(dashboard)/relatorios/reposicao/copy-restock-list-button.tsx').CopyRestockListButton;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async value=>{if(fail)throw Error();copied=value;}}}});globalThis.window={setTimeout(){}};
  const element=Button({text,label:'Copiar lista'});await React.Children.toArray(element.props.children)[0].props.onClick();if(fail)assert.equal(manual,true);else assert.equal(copied,text);
 }
});
