/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const organizationId = '10000000-0000-4000-8000-000000000001';
const requestId = '20000000-0000-4000-8000-000000000002';

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
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    }
    new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
const quick = extra => form({ request_id: requestId, device_model: 'Galaxy A14', reported_issue: 'Troca de tela', ...extra });
const edit = extra => form({ customer_name: 'Maria', model: 'Galaxy A14', reported_issue: 'Troca de tela', status: 'entregue', ...extra });

function fixture(order = {}, { concurrentFinal, anonymous = false } = {}) {
  const state = { calls: [], events: [], rpcs: [], order: {
    id: 'order', order_number: 'OS-001', customer_id: 'customer', device_id: 'device', organization_id: organizationId,
    status: 'recebido', estimated_price: 150, final_price: null, delivered_at: null, deleted_at: null,
    warranty_enabled: false, warranty_signed: false, warranty_amount: null, warranty_unit: null,
    warranty_started_at: null, warranty_expires_at: null, warranty_notes: null,
    ...order
  }};
  const client = {
    rpc(name, args) {
      state.rpcs.push({ name, args });
      state.order.estimated_price = args.p_input.estimated_price ?? null;
      state.order.final_price = null;
      return { maybeSingle: async () => ({ data: { order_id: 'order' }, error: null }) };
    },
    from(table) {
      const call = { table, filters: [] }; state.calls.push(call);
      let done;
      const execute = () => {
        if (done) return done;
        done = (async () => {
          if (table === 'maintenance_orders') {
            if (call.update && concurrentFinal !== undefined) state.order.final_price = concurrentFinal;
            const matches = call.filters.every(([key, value]) => state.order[key] === value);
            if (!matches) return { data: null, error: null };
            if (call.update) Object.assign(state.order, call.update);
            return { data: { ...state.order }, error: null };
          }
          if (table === 'maintenance_events' && call.insert) state.events.push(...(Array.isArray(call.insert) ? call.insert : [call.insert]));
          return { data: null, error: null };
        })(); return done;
      };
      const query = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve, reject) => execute().then(resolve, reject);
        if (method === 'maybeSingle' || method === 'returns') return execute;
        return (...args) => {
          if (['select', 'insert', 'update'].includes(method)) call[method] = args[0];
          if (method === 'eq' || method === 'is') call.filters.push(args);
          return query;
        };
      }}); return query;
    }
  };
  const load = loader({
    '@/lib/auth/queries': { getCurrentUser: async () => anonymous ? null : ({ id: 'user' }), requireAuth: async () => ({ id: 'user' }) },
    '@/lib/organization/queries': { getCurrentOrganization: async () => ({ id: organizationId }), requireOrganization: async () => ({ id: organizationId }) },
    '@/lib/supabase/server': { createClient: async () => client },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } },
    'next/link': ({ href, children }) => React.createElement('a', { href }, children),
    react: { ...React, useActionState: () => [{}, () => {}, false] }
  });
  return { state, load, actions: load('src/app/(dashboard)/manutencoes/actions.ts') };
}

test('rápida valida moeda pelo mesmo schema da normal: vazio, vírgula, ponto, milhares e zero', () => {
  const schemas = loader()('src/lib/validations/maintenance.schema.ts');
  for (const [input, expected] of [['', undefined], ['  ', undefined], ['150', 150], ['150,00', 150], ['150.25', 150.25], ['1.234,56', 1234.56], ['0', 0]]) {
    const base = { device_model: 'A14', reported_issue: 'Troca de tela', estimated_price: input };
    assert.equal(schemas.createQuickMaintenanceOrderSchema.parse(base).estimated_price, expected);
    assert.equal(schemas.createMaintenanceOrderSchema.parse({ device: { model: 'A14' }, reported_issue: base.reported_issue, customer_mode: 'new', customer_name: 'Maria', estimated_price: input }).estimated_price, expected);
  }
  for (const input of ['texto', 'NaN', 'Infinity', '0x10', '1e2', '-1', '150,00abc', '1,2,3', '1.234', '100000000', '1.999,999', NaN, Infinity]) {
    assert.equal(schemas.createQuickMaintenanceOrderSchema.safeParse({ device_model: 'A14', reported_issue: 'Troca de tela', estimated_price: input }).success, false, String(input));
  }
});

test('rápida envia estimado pela RPC existente e nunca preenche final na criação', async () => {
  for (const [input, expected] of [['150,00', 150], ['', null], ['0', 0]]) {
    const f = fixture();
    await assert.rejects(f.actions.createQuickMaintenanceOrderAction({}, quick({ estimated_price: input, organization_id: 'forged', final_price: '999' })), /REDIRECT/);
    assert.equal(f.state.order.estimated_price, expected); assert.equal(f.state.order.final_price, null);
    const call = f.state.rpcs[0]; assert.equal(call.name, 'create_maintenance_intake'); assert.equal(call.args.p_quick, true);
    assert.equal(call.args.p_organization_id, organizationId); assert.equal(call.args.p_customer_name, null); assert.equal(call.args.p_customer_phone, null);
    assert.equal(Object.hasOwn(call.args.p_input, 'final_price'), false);
  }
  const f = fixture(); const result = await f.actions.createQuickMaintenanceOrderAction({}, quick({ estimated_price: 'inválido' }));
  assert.ok(result.error); assert.equal(result.values.estimated_price, 'inválido'); assert.equal(f.state.rpcs.length, 0);
});

test('formulário rápido oferece estimado opcional após defeito e não exige cliente', () => {
  const f = fixture();
  const html = renderToStaticMarkup(React.createElement(f.load('src/app/(dashboard)/manutencoes/rapida/quick-maintenance-form.tsx').QuickMaintenanceForm, { requestId }));
  assert.match(html, /Valor estimado \(opcional\)/);
  const input = html.match(/<input[^>]*name="estimated_price"[^>]*>/)[0];
  assert.doesNotMatch(input, /required/); assert.match(input, /step="0.01"/);
  assert.ok(html.indexOf('name="reported_issue"') < html.indexOf('name="estimated_price"'));
  assert.doesNotMatch(html, /name="final_price"/);
});

test('todos os caminhos de entrega preenchem ausente, preservam final informado e zero, não inventam preço', async () => {
  for (const path of ['edit', 'status', 'shortcut']) {
    for (const [estimated, final, expected] of [[150, null, 150], [150, 130, 130], [150, 0, 0], [null, null, null], [0, null, 0], ['150.00', '0.00', '0.00']]) {
      const f = fixture({ estimated_price: estimated, final_price: final });
      if (path === 'edit') {
        await assert.rejects(f.actions.updateMaintenanceOrderAction('order', {}, edit({ estimated_price: estimated ?? '', final_price: final ?? '' })), /REDIRECT/);
      } else if (path === 'status') assert.ok((await f.actions.updateMaintenanceStatusAction('order', {}, form({ new_status: 'entregue' }))).success);
      else assert.ok((await f.actions.markMaintenanceAsDeliveredAction('order', {}, new FormData())).success);
      assert.equal(f.state.order.status, 'entregue'); assert.equal(Number(f.state.order.final_price), Number(expected));
      assert.equal(f.state.order.final_price === null, expected === null);
      assert.equal(f.state.events.length, 1);
      const update = f.state.calls.find(c => c.table === 'maintenance_orders' && c.update);
      assert.ok(update.filters.some(([key, value]) => key === 'organization_id' && value === organizationId));
      assert.ok(update.filters.some(([key, value]) => key === 'deleted_at' && value === null));
    }
  }
});

test('alterar estimado depois de entregar preserva final; formulário sem campos de preço também preserva', async () => {
  for (const finalFields of [{ final_price: '150' }, {}]) {
    const f = fixture({ status: 'entregue', estimated_price: 150, final_price: 150, delivered_at: '2026-01-01T12:00:00Z' });
    await assert.rejects(f.actions.updateMaintenanceOrderAction('order', {}, edit({ estimated_price: '170', ...finalFields })), /REDIRECT/);
    assert.equal(f.state.order.estimated_price, 170); assert.equal(f.state.order.final_price, 150);
  }
});

test('outros statuses não copiam preço e novo pedido normal mantém o contrato', async () => {
  for (const status of ['em_analise', 'pronto_para_entrega', 'cancelado']) {
    const f = fixture();
    assert.ok((await f.actions.updateMaintenanceStatusAction('order', {}, form({ new_status: status }))).success);
    assert.equal(f.state.order.final_price, null);
  }
  const f = fixture();
  await assert.rejects(f.actions.createMaintenanceOrderAction({}, form({ request_id: requestId, customer_mode: 'new', customer_name: 'Maria', model: 'A14', reported_issue: 'Troca de tela', estimated_price: '300,00' })), /REDIRECT/);
  assert.equal(f.state.rpcs[0].args.p_quick, false); assert.equal(f.state.order.estimated_price, 300); assert.equal(f.state.order.final_price, null);
});

test('repetir entrega não recalcula final nem duplica histórico; legado sem final mantém data de entrega', async () => {
  const f = fixture({ status: 'entregue', estimated_price: 170, final_price: 150 });
  assert.ok((await f.actions.markMaintenanceAsDeliveredAction('order', {}, new FormData())).success);
  assert.equal(f.state.order.final_price, 150); assert.equal(f.state.events.length, 0);
  const legacy = fixture({ status: 'entregue', final_price: null, delivered_at: '2026-01-01T12:00:00Z' });
  assert.ok((await legacy.actions.markMaintenanceAsDeliveredAction('order', {}, new FormData())).success);
  assert.equal(legacy.state.order.final_price, 150); assert.equal(legacy.state.order.delivered_at, '2026-01-01T12:00:00Z');
  assert.equal(legacy.state.events[0].event_type, 'maintenance_updated');
});

test('preenchimento automático não sobrescreve final gravado concorrentemente', async () => {
  for (const path of ['edit', 'shortcut']) {
    const f = fixture({}, { concurrentFinal: 130 });
    const result = path === 'edit'
      ? await f.actions.updateMaintenanceOrderAction('order', {}, edit({ estimated_price: '150', final_price: '' }))
      : await f.actions.markMaintenanceAsDeliveredAction('order', {}, new FormData());
    assert.ok(result.error); assert.equal(f.state.order.final_price, 130); assert.equal(f.state.order.status, 'recebido'); assert.equal(f.state.events.length, 0);
  }
});

test('sessão ausente, outra organização e OS excluída não podem entregar nem editar', async () => {
  for (const [order, options] of [[{}, { anonymous: true }], [{ organization_id: 'other' }, {}], [{ deleted_at: '2026-01-01' }, {}]]) {
    const f = fixture(order, options);
    assert.ok((await f.actions.markMaintenanceAsDeliveredAction('order', {}, new FormData())).error);
    assert.ok((await f.actions.updateMaintenanceOrderAction('order', {}, edit({ estimated_price: '150', final_price: '' }))).error);
    assert.equal(f.state.calls.some(c => c.update), false); assert.equal(f.state.events.length, 0);
  }
});

test('edição entregue conserva garantia e usa o preço resultante do formulário', async () => {
  const f = fixture({ estimated_price: 150 });
  await assert.rejects(f.actions.updateMaintenanceOrderAction('order', {}, edit({ estimated_price: '300', final_price: '', warranty_enabled: 'on', warranty_signed: 'on', warranty_amount: '1', warranty_unit: 'months', warranty_started_at: '2026-01-31' })), /REDIRECT/);
  assert.equal(f.state.order.final_price, 300); assert.equal(f.state.order.warranty_enabled, true); assert.equal(f.state.order.warranty_expires_at, '2026-02-28');
});
