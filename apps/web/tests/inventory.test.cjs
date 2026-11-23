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

test('status único: negativo, esgotado, baixo inclusive no mínimo, OK',()=>{
  const {getStockStatus}=loader()('src/lib/products/inventory.ts');
  for (const [quantity,minimum,status] of [[-1,5,'NEGATIVO'],[0,0,'ESGOTADO'],[3,5,'BAIXO'],[5,5,'BAIXO'],[6,5,'OK'],[1,0,'OK']]) assert.equal(getStockStatus(quantity,minimum),status);
});
test('valor ignora saldo negativo e custo ausente; reposição usa déficit e categorias reais',()=>{
  const {getInventorySummary,getStockRestock,formatStockRestockList}=loader()('src/lib/products/inventory.ts');
  const items=[item(),item({id:'b',stock_quantity:-1}),item({id:'c',stock_quantity:0,unit_cost:null}),item({id:'d',stock_quantity:10,unit_cost:null}),item({id:'e',is_active:false})];
  assert.deepEqual(getInventorySummary(items),{units:15,belowMinimum:4,empty:1,negative:1,value:24});
  assert.deepEqual(getStockRestock(items).map(i=>i.suggested),[2,6,5]);
  const text=formatStockRestockList(items);
  assert.match(text,/REPOSIÇÃO POR ESTOQUE[\s\S]*Case[\s\S]*A05 — 6 un\./);
  assert.doesNotMatch(text,/WhatsApp/);
});
test('schema recusa frações, custo inválido, vazio e entrada zero; contagem zero é aceita',()=>{
  const {inventoryMovementSchema:s}=loader()('src/lib/validations/inventory.schema.ts');
  const base={model_id:model,movement_type:'entry',quantity:'10',unit_cost:'3,50',reason:'',notes:''};
  assert.equal(s.parse(base).unit_cost,3.5);
  for(const extra of [{quantity:'1.5'},{quantity:'0'},{quantity:'-1'},{quantity:''},{quantity:'abc'},{unit_cost:'inválido'},{unit_cost:'-1'},{quantity:'2147483648'},{movement_type:'outflow'}]) assert.equal(s.safeParse({...base,...extra}).success,false,JSON.stringify(extra));
  assert.equal(s.safeParse({...base,movement_type:'opening_balance',quantity:'0'}).success,true);
  assert.equal(s.safeParse({...base,movement_type:'adjustment',quantity:'0',reason:'Contagem'}).success,true);
  assert.equal(s.safeParse({...base,movement_type:'adjustment'}).success,false);
});
test('action envia uma RPC com organização do servidor, sem calcular saldo no cliente',async()=>{
  const calls=[];
  const client={rpc:async(name,args)=>{calls.push([name,args]);return {data:30,error:null};}};
  const {registerInventoryMovementAction:action}=loader(boundaries(client))('src/app/(dashboard)/estoque/actions.ts');
  const input={model_id:model,movement_type:'entry',quantity:'10',unit_cost:'3,50',reason:'Reposição',notes:'Novembro',organization_id:'OUTRA',quantity_after:'999'};
  assert.match((await action({},form(input))).success,/Saldo atual: 30/);
  assert.deepEqual(calls,[['register_inventory_movement',{p_organization_id:org,p_model_id:model,p_movement_type:'entry',p_quantity:10,p_unit_cost:3.5,p_reason:'Reposição',p_notes:'Novembro'}]]);
  assert.ok((await action({},form({...input,quantity:'1.5'}))).error);assert.equal(calls.length,1);
});
test('criação permite saldo inicial; edição do produto só envia metadados de estoque',()=>{
  const s=loader()('src/lib/validations/product.schema.ts');
  const base={category:'case',model_name:'A05',minimum_stock:'5',unit_cost:'4,00',initial_stock:'20'};
  assert.equal(s.createProductModelTemplateSchema.parse(base).initial_stock,20);
  const edited=s.updateProductModelTemplateSchema.parse({...base,id:model,stock_quantity:999});
  assert.equal(edited.minimum_stock,5);assert.equal(edited.unit_cost,4);
  assert.ok(!Object.hasOwn(edited,'stock_quantity'));assert.ok(!Object.hasOwn(edited,'initial_stock'));
  for(const extra of [{minimum_stock:'-1'},{minimum_stock:'1.5'},{unit_cost:'abc'},{initial_stock:'1.5'}]) assert.equal(s.createProductModelTemplateSchema.safeParse({...base,...extra}).success,false);
});
test('visão geral apresenta ações, preços distintos, badges sem cores fixas e cards responsivos',()=>{
  const load=loader(boundaries({}));
  const {InventoryOverview}=load('src/app/(dashboard)/estoque/inventory-overview.tsx');
  const html=renderToStaticMarkup(React.createElement(InventoryOverview,{items:[item({stock_quantity:-1})]}));
  for(const text of ['ESTOQUE NEGATIVO','Entrada','Saída','Ajustar','Histórico','Definir estoque inicial','Custo / Preço de venda']) assert.ok(html.includes(text),text);
  assert.ok(html.includes(`/saidas/nova?modelo=${model}`));assert.match(html,/border-danger-line/);assert.match(html,/grid-cols-2/);assert.doesNotMatch(html,/<table/);
});
test('consulta de estoque pagina por organização',async()=>{
  const filters=[];let batch=0;
  const query=new Proxy({}, {get(_,key){
    if(key==='returns')return async()=>({data:batch++===0?Array.from({length:500},()=>item()):[item({id:'last'})],error:null});
    return (...args)=>{filters.push([key,...args]);return query;};
  }});
  const actions=loader(boundaries({from:()=>query}))('src/app/(dashboard)/estoque/actions.ts');
  const result=await actions.getInventoryItems();assert.equal(result.items.length,501);
  assert.ok(filters.some(f=>f[0]==='eq'&&f[1]==='organization_id'&&f[2]===org));
  assert.ok(filters.some(f=>f[0]==='range'&&f[1]===500&&f[2]===999));
});

test('falha em página posterior não apresenta estoque parcial ou lista para copiar',async()=>{
  let batch=0;
  const query=new Proxy({}, {get(_,key){
    if(key==='returns')return async()=>batch++===0?{data:Array.from({length:500},()=>item()),error:null}:{data:null,error:{code:'SIMULATED_FAILURE'}};
    return ()=>query;
  }});
  const load=loader(boundaries({from:()=>query}));
  const result=await load('src/app/(dashboard)/estoque/actions.ts').getInventoryItems();
  assert.deepEqual(result.items,[]);assert.ok(result.error);
  const pageLoader=loader({...boundaries({}), '../actions':{getInventoryItems:async()=>result}});
  const page=pageLoader('src/app/(dashboard)/estoque/reposicao/page.tsx').default;
  const html=renderToStaticMarkup(await page());
  assert.match(html,/Não foi possível carregar/);assert.doesNotMatch(html,/Copiar lista|Nenhum produto abaixo/);
});

test('histórico mantém nome de produto arquivado e paginação sem edição da auditoria',async()=>{
  const m={id:'movement',product_model_template_id:model,movement_type:'adjustment',quantity:2,quantity_before:3,quantity_after:5,created_at:'2026-11-19T14:00:00Z',created_by:model,created_by_name:'Celso',unit_cost:null,reason:'Cancelamento de saída',notes:'Conferido',product_outflow_id:'sale',product_model_templates:{model_name:'A05 arquivado'}};
  const load=loader({...boundaries({}), '../actions':{
    getInventoryItems:async()=>({items:[]}),getInventoryMovements:async()=>({movements:[m],hasMore:true})
  }});
  const Page=load('src/app/(dashboard)/estoque/movimentacoes/page.tsx').default;
  const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({modelo:model,pagina:'2'})}));
  for(const text of ['A05 arquivado','Celso','Cancelamento de saída','+2','3 → 5','Anterior','Próxima']) assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/>Editar<|>Excluir</);
});

test('proxy deixa Next produzir o payload de actions sem perder proteção de GET/POST comuns',async()=>{
  const {NextRequest,NextResponse}=require('next/server');
  for(const status of ['approved','pending','rejected','blocked',null]) {
    const response=NextResponse.next();
    response.cookies.set('session-cookie','test-only-session');
    const {proxy}=loader({
      '@/lib/supabase/middleware':{
        updateSession:async()=>({response,supabase:{rpc:async()=>({data:status,error:null})},user:status?{id:model}:null}),
        hasOrganizationMembership:async()=>true
      }
    })('src/proxy.ts');
    for(const route of [`/estoque/${model}?tipo=entry`,'/estoque','/clientes','/manutencoes','/saidas']) {
      for(const [method,headers,isAction] of [['GET',{},false],['POST',{},false],['GET',{'next-action':'test-action'},false],['POST',{'next-action':'test-action'},true]]) {
        const result=await proxy(new NextRequest('http://localhost:3000'+route,{method,headers}));
        if(isAction||status==='approved') {
          assert.equal(result,response,`${status} ${method} ${route}: action precisa chegar ao handler do Next`);
          assert.equal(result.headers.get('location'),null);
        } else {
          assert.equal(result.status,307);
          assert.equal(result.headers.get('location'),'http://localhost:3000/login'+(status?'?conta='+status:''));
        }
        assert.equal(result.cookies.get('session-cookie').value,'test-only-session');
      }
    }
  }
});

test('action de estoque bloqueia sessão expirada ou conta sem aprovação antes de consultar organização ou movimentar',async()=>{
  for(const status of [null,'pending','rejected','blocked']) {
    let rpcCalls=0;
    const client={
      auth:{getUser:async()=>({data:{user:status?{id:model}:null},error:null})},
      rpc:async name=>{assert.equal(name,'get_account_access_status');rpcCalls++;return {data:status,error:null};},
      from(){assert.fail('Conta sem acesso não pode consultar a organização ou o estoque');}
    };
    const {registerInventoryMovementAction:action}=loader({
      '@/lib/supabase/server':{createClient:async()=>client},
      'next/navigation':{redirect(url){throw new Error('REDIRECT:'+url);}},
      'next/cache':{revalidatePath(){assert.fail('Não pode revalidar após rejeitar acesso');}}
    })('src/app/(dashboard)/estoque/actions.ts');
    await assert.rejects(action({},form({model_id:model,movement_type:'entry',quantity:'10'})),
      new RegExp('REDIRECT:/login'+(status?'\\?conta='+status:'')));
    assert.equal(rpcCalls,status?1:0);
  }
});

test('página aguarda params/searchParams, restringe consultas à organização e passa somente props simples ao formulário',async()=>{
  for(const [tipo,expected] of [['opening_balance','opening_balance'],['entry','entry'],['adjustment','adjustment'],['inválido','entry'],[['entry','adjustment'],'entry']]) {
    const calls=[];
    const client={from(table){
      const query=new Proxy({}, {get(_,key){
        if(key==='maybeSingle')return async()=>({data:table==='product_model_templates'?item():{id:'opening'},error:null});
        return (...args)=>{calls.push([table,key,...args]);return query;};
      }});
      return query;
    }};
    const {default:Page}=loader(boundaries(client))('src/app/(dashboard)/estoque/[id]/page.tsx');
    const element=await Page({params:Promise.resolve({id:model}),searchParams:Promise.resolve({tipo})});
    const component=React.Children.toArray(element.props.children).find(child=>child.type?.name==='InventoryMovementForm');
    assert.deepEqual(component.props,{item:{id:model},initialType:expected,hasOpening:true});
    assert.deepEqual(JSON.parse(JSON.stringify(component.props)),component.props);
    for(const table of ['product_model_templates','inventory_movements']) {
      assert.ok(calls.some(c=>c[0]===table&&c[1]==='eq'&&c[2]==='organization_id'&&c[3]===org));
    }
  }
});

test('página diferencia produto inexistente de falha de schema sem exibir formulário incompleto',async()=>{
  for(const [table,error] of [['product_model_templates',{code:'42703'}],['inventory_movements',{code:'PGRST205'}],['inventory_movements',{code:'42501'}],['product_model_templates',null]]) {
    const client={from(name){
      const query=new Proxy({}, {get(_,key){
        if(key==='maybeSingle')return async()=>({data:name===table?null:item(),error:name===table?error:null});
        return ()=>query;
      }});
      return query;
    }};
    const {default:Page}=loader({...boundaries(client),'next/navigation':{notFound(){throw new Error('NOT_FOUND');}}})('src/app/(dashboard)/estoque/[id]/page.tsx');
    const run=()=>Page({params:Promise.resolve({id:model}),searchParams:Promise.resolve({})});
    if(!error) { await assert.rejects(run(),/NOT_FOUND/);continue; }
    const html=renderToStaticMarkup(await run());
    assert.match(html,/role="alert"/);assert.doesNotMatch(html,/<form|name="quantity"/);
    if(error.code==='42501') { assert.match(html,/conferir o estoque inicial/);assert.doesNotMatch(html,/migration/); }
    else assert.match(html,/0017_complete_inventory.sql/);
  }
});

test('action informa falha de RPC/schema sem sucesso nem revalidação',async()=>{
  for(const code of ['PGRST202','42883','42501']) {
    const {registerInventoryMovementAction:action}=loader({
      ...boundaries({rpc:async()=>({data:null,error:{code,message:'Falha de teste'}})}),
      'next/cache':{revalidatePath(){assert.fail('Falha de banco não pode revalidar como sucesso');}}
    })('src/app/(dashboard)/estoque/actions.ts');
    const result=await action({},form({model_id:model,movement_type:'entry',quantity:'10'}));
    assert.equal(result.success,undefined);
    assert.match(result.error,code==='42501'?/Não foi possível registrar/:/0017_complete_inventory.sql/);
    assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
  }
});

test('formulário não chama a action no mount e troca abertura já registrada por ajuste após revalidação',()=>{
  let selectedType='opening_balance';
  const action=()=>assert.fail('Não deve executar action durante renderização');
  const load=loader({
    react:{useState:()=>[selectedType,value=>{selectedType=value;}],useActionState:()=>[{success:'Registrado'},action,false]},
    './actions':{registerInventoryMovementAction:action}
  });
  const {InventoryMovementForm:Form}=load('src/app/(dashboard)/estoque/inventory-movement-form.tsx');
  const before=Form({item:{id:model},initialType:'opening_balance',hasOpening:false});
  const after=Form({item:{id:model},initialType:'opening_balance',hasOpening:true});
  const select=element=>React.Children.toArray(element.props.children).find(child=>child.type==='label').props.children[1];
  assert.equal(before.props.action,action);assert.equal(select(before).props.value,'opening_balance');
  assert.equal(select(after).props.value,'adjustment');
  const html=renderToStaticMarkup(after);
  assert.doesNotMatch(html,/<option value="opening_balance"/);assert.match(html,/Motivo \(obrigatório\)/);
});
