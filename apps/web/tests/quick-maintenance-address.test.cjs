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
const request = '20000000-0000-4000-8000-000000000002';
const customerId = '30000000-0000-4000-8000-000000000003';

function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (!/\.(ts|tsx)$/.test(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText;
    function localRequire(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    }
    new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ request_id: request, device_model: 'A14', reported_issue: 'Troca de tela', ...extra })) data.set(key, value);
  return data;
}
const Link = ({ href, children }) => React.createElement('a', { href }, children);
function fixture({ anonymous = false, queryError = null, rpcError = null } = {}) {
  const state = { queries: [], rpcs: [] };
  const client = {
    rpc(name, args) { state.rpcs.push({ name, args }); return { maybeSingle: async () => ({ data: rpcError ? null : { order_id: 'order' }, error: rpcError }) }; },
    from(table) {
      const call = { table, operations: [] }; state.queries.push(call);
      const query = new Proxy({}, { get(_, method) {
        if (method === 'maybeSingle') return async () => ({ data: queryError ? null : { id: customerId, address: 'Rua A, 20' }, error: queryError });
        return (...args) => { call.operations.push([method, ...args]); return query; };
      }}); return query;
    }
  };
  const load = loader({
    '@/lib/auth/queries': { getCurrentUser: async () => anonymous ? null : ({ id: 'user' }) },
    '@/lib/organization/queries': { getCurrentOrganization: async () => ({ id: org }) },
    '@/lib/supabase/server': { createClient: async () => client },
    'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } },
    'next/link': Link
  });
  return { state, load, actions: load('src/app/(dashboard)/manutencoes/actions.ts') };
}

test('endereço reutiliza o schema do cliente: opcional, trim, null, limite e intenção explícita', () => {
  const load = loader();
  const { customerAddressSchema } = load('src/lib/validations/customer.schema.ts');
  const schema = load('src/lib/validations/maintenance.schema.ts').createQuickMaintenanceOrderSchema;
  assert.equal(schema.shape.customer_address, customerAddressSchema);
  for (const [value, expected] of [[undefined, null], [null, null], ['', null], ['   ', null], [' Rua A ', 'Rua A'], ['x'.repeat(300), 'x'.repeat(300)]]) {
    assert.equal(schema.parse({ device_model: 'A14', reported_issue: 'Teste', customer_address: value }).customer_address, expected);
  }
  for (const value of ['x'.repeat(301), 15, {}]) assert.equal(customerAddressSchema.safeParse(value).success, false);
  const base = { device_model: 'A14', reported_issue: 'Teste', customer_address_action: 'clear', customer_address: '' };
  assert.equal(schema.safeParse(base).success, false);
  assert.equal(schema.safeParse({ ...base, customer_address_customer_id: customerId }).success, true);
  assert.equal(schema.safeParse({ ...base, customer_address_action: 'set' }).success, false);
});

test('action envia endereço validado em uma única RPC e usa organização da sessão', async () => {
  const f = fixture();
  await assert.rejects(f.actions.createQuickMaintenanceOrderAction({}, form({ customer_address: ' Rua Nova, 10 ', organization_id: 'forged', birth_date: '2000-01-01' })), /REDIRECT/);
  assert.equal(f.state.queries.length, 0); assert.equal(f.state.rpcs.length, 1);
  const args = f.state.rpcs[0].args;
  assert.equal(f.state.rpcs[0].name, 'create_maintenance_intake');
  assert.equal(args.p_organization_id, org); assert.equal(args.p_quick, true);
  assert.equal(args.p_input.customer_address, 'Rua Nova, 10'); assert.equal(args.p_input.customer_address_action, 'set');
  assert.equal(Object.hasOwn(args.p_input, 'birth_date'), false); assert.equal(Object.hasOwn(args.p_input, 'final_price'), false);
});

test('omissão/vazio/prefill intocado não alteram endereço; remoção só com ID confirmado', async () => {
  for (const values of [{}, { customer_address: '' }, { customer_address: '   ' }, { customer_address: 'Prefill antigo', customer_address_action: 'preserve' }]) {
    const f = fixture(); await assert.rejects(f.actions.createQuickMaintenanceOrderAction({}, form(values)), /REDIRECT/);
    assert.equal(Object.hasOwn(f.state.rpcs[0].args.p_input, 'customer_address'), false);
  }
  const f = fixture();
  await assert.rejects(f.actions.createQuickMaintenanceOrderAction({}, form({ customer_address: '', customer_address_action: 'clear', customer_address_customer_id: customerId })), /REDIRECT/);
  assert.equal(f.state.rpcs[0].args.p_input.customer_address, null);
  assert.equal(f.state.rpcs[0].args.p_input.customer_address_action, 'clear');
  assert.equal(f.state.rpcs[0].args.p_input.customer_address_customer_id, customerId);
});

test('falhas validam antes da RPC, preservam entrada/tentativa e orientam cliente alterado', async () => {
  for (const values of [{ customer_address: 'x'.repeat(301) }, { customer_address_action: 'clear' }, { customer_address_action: 'unknown' }, { customer_address_customer_id: 'invalid' }]) {
    const f = fixture(), result = await f.actions.createQuickMaintenanceOrderAction({}, form(values));
    assert.ok(result.error); assert.equal(f.state.rpcs.length, 0); assert.equal(result.values.request_id, request);
    if (values.customer_address) assert.equal(result.values.customer_address, values.customer_address);
  }
  const f = fixture({ rpcError: { code: '40001' } });
  const result = await f.actions.createQuickMaintenanceOrderAction({}, form({ customer_address: 'Rua A' }));
  assert.match(result.error, /cliente vinculado ao telefone mudou/); assert.equal(result.values.customer_address, 'Rua A');
  const anonymous = fixture({ anonymous: true });
  assert.ok((await anonymous.actions.createQuickMaintenanceOrderAction({}, form({ customer_address: 'Rua' }))).error);
  assert.equal(anonymous.state.rpcs.length, 0);
});

test('consulta por telefone é exata, autenticada, limitada e segue prioridade ativo/arquivado da RPC', async () => {
  const f = fixture();
  assert.equal((await f.actions.getQuickCustomerAddress('+55 (11) 98765-4321')).customer.address, 'Rua A, 20');
  const operations = f.state.queries[0].operations;
  assert.deepEqual(operations.find(x => x[0] === 'select'), ['select', 'id, address']);
  assert.ok(operations.some(x => x[0] === 'eq' && x[1] === 'organization_id' && x[2] === org));
  assert.ok(operations.some(x => x[0] === 'eq' && x[1] === 'phone_normalized' && x[2] === '11987654321'));
  assert.deepEqual(operations.filter(x => x[0] === 'order'), [['order', 'deleted_at', { ascending: false, nullsFirst: true }], ['order', 'id', { ascending: true }]]);
  assert.deepEqual(operations.find(x => x[0] === 'limit'), ['limit', 1]);
  for (const phone of ['', 'abc', '1'.repeat(31)]) assert.equal((await f.actions.getQuickCustomerAddress(phone)).customer, null);
  assert.equal(f.state.queries.length, 1);
  const anonymous = fixture({ anonymous: true }); assert.ok((await anonymous.actions.getQuickCustomerAddress('11987654321')).error); assert.equal(anonymous.state.queries.length, 0);
  assert.ok((await fixture({ queryError: { code: 'FAILED' } }).actions.getQuickCustomerAddress('11987654321')).error);
});

function find(element, predicate) {
  if (Array.isArray(element)) return element.map(child => find(child, predicate)).find(Boolean) ?? null;
  if (!React.isValidElement(element)) return null;
  return predicate(element) ? element : find(element.props.children, predicate);
}
function harness(lookup) {
  const hooks = []; let cursor = 0;
  const useState = initial => {
    const i = cursor++;
    if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
    return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }];
  };
  const load = loader({
    react: { ...React, useState, useRef: initial => { const i = cursor++; return hooks[i] ??= { current: initial }; }, useActionState: () => [{}, () => {}, false] },
    'next/link': Link, '../actions': { createQuickMaintenanceOrderAction() {}, getQuickCustomerAddress: lookup }
  });
  const Component = load('src/app/(dashboard)/manutencoes/rapida/quick-maintenance-form.tsx').QuickMaintenanceForm;
  const render = () => { cursor = 0; return Component({ requestId: request }); };
  return { render, field: name => find(render(), node => node.props.name === name), remove: () => find(render(), node => node.type === 'button' && node.props['aria-pressed'] !== undefined) };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('prefill fica editável sem gravar valor intocado; remover/desfazer são explícitos', async () => {
  const h = harness(async () => ({ customer: { id: customerId, address: 'Rua atual' } }));
  h.field('phone').props.onBlur({ currentTarget: { value: '11987654321' } }); await flush();
  assert.equal(h.field('customer_address').props.value, 'Rua atual');
  assert.equal(h.field('customer_address_action').props.value, 'preserve');
  h.remove().props.onClick();
  assert.equal(h.field('customer_address').props.value, ''); assert.equal(h.field('customer_address_action').props.value, 'clear');
  h.remove().props.onClick();
  assert.equal(h.field('customer_address').props.value, 'Rua atual'); assert.equal(h.field('customer_address_action').props.value, 'preserve');
  h.field('customer_address').props.onChange({ target: { value: '' } });
  assert.equal(h.field('customer_address_action').props.value, 'preserve');
  h.field('customer_address').props.onChange({ target: { value: 'Rua editada' } });
  assert.equal(h.field('customer_address_action').props.value, 'set');
});

test('resposta atrasada não substitui edição nem endereço de outro telefone; falha preserva dados', async () => {
  let resolve;
  const h = harness(() => new Promise(done => { resolve = done; }));
  h.field('phone').props.onBlur({ currentTarget: { value: '11987654321' } });
  h.field('customer_address').props.onChange({ target: { value: 'Digitado durante consulta' } });
  resolve({ customer: { id: customerId, address: 'Não substituir' } }); await flush();
  assert.equal(h.field('customer_address').props.value, 'Digitado durante consulta');
  h.field('phone').props.onBlur({ currentTarget: { value: '11987654321' } });
  h.field('phone').props.onChange({ target: { value: '21987654321' } });
  resolve({ customer: { id: customerId, address: 'Resposta antiga' } }); await flush();
  assert.equal(h.field('customer_address').props.value, ''); assert.equal(h.field('customer_address_customer_id').props.value, '');
  const failed = harness(async () => { throw new Error('Network'); });
  failed.field('phone').props.onBlur({ currentTarget: { value: '11987654321' } }); await flush();
  assert.equal(failed.field('customer_address_action').props.value, 'preserve');
  assert.equal(failed.remove(), null);
});

test('nova consulta com falha mantém opção de desfazer; mudança do cliente descarta intenção antiga', async () => {
  let response = { customer: { id: customerId, address: 'Rua original' } };
  const h = harness(async () => response);
  const lookup = async () => { h.field('phone').props.onBlur({ currentTarget: { value: '11987654321' } }); await flush(); };
  await lookup(); h.remove().props.onClick();
  response = { customer: null, error: 'Falha de consulta' }; await lookup();
  assert.ok(h.remove()); assert.equal(h.field('customer_address_customer_id').props.value, customerId);
  response = { customer: { id: org, address: 'Outro cadastro' } }; await lookup();
  assert.equal(h.field('customer_address_action').props.value, 'preserve');
  assert.equal(h.field('customer_address').props.value, 'Outro cadastro');
});

test('layout reutiliza grid: previsão e estimado são irmãos, mobile em coluna e sem aniversário/cidade', () => {
  const h = harness(async () => ({ customer: null }));
  const row = find(h.render(), node => node.type === 'div' &&
    find(node, child => child.props.name === 'expected_delivery_date') && find(node, child => child.props.name === 'estimated_price'));
  assert.match(row.props.className, /\bsm:grid-cols-2\b/);
  assert.equal(React.Children.count(row.props.children), 2);
  assert.equal(find(row.props.children[0], node => node.props.name === 'expected_delivery_date').props.type, 'date');
  assert.equal(find(row.props.children[1], node => node.props.name === 'estimated_price').props.type, 'number');
  assert.equal(h.field('customer_address').props.maxLength, 300); assert.equal(h.field('customer_address').props.required, undefined);
  const html = renderToStaticMarkup(h.render());
  assert.doesNotMatch(html, /name="(birth_date|service_city|final_price)"/);
});
