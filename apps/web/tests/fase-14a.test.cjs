/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const org = { id: '10000000-0000-4000-8000-000000000001', name: 'Loja Teste' };
const customerId = '20000000-0000-4000-8000-000000000002';
const requestId = '30000000-0000-4000-8000-000000000003';

// Executa o TypeScript real com apenas fronteiras externas substituidas.
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (!/\.(ts|tsx|js|cjs)$/.test(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText;
    function localRequire(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('@assistencia/shared/')) return load(path.resolve(root, '../../packages/shared', name.slice('@assistencia/shared/'.length)));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    }
    new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
function boundaries(client) {
  return {
    '@/lib/auth/queries': { getCurrentUser: async () => ({ id: customerId }), requireAuth: async () => ({ id: customerId }) },
    '@/lib/organization/queries': { getCurrentOrganization: async () => org, requireOrganization: async () => org },
    '@/lib/supabase/server': { createClient: async () => client },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } },
    'next/link': ({ children, href }) => React.createElement('a', { href }, children)
  };
}
function queryClient(resultFor) {
  return { from(table) {
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve(resultFor(table)).then(resolve, reject);
      if (method === 'returns' || method === 'maybeSingle') return () => Promise.resolve(resultFor(table));
      return () => query;
    }});
    return query;
  }};
}
function form(values) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }

test('garantia mensal limita ao ultimo dia, incluindo ano bissexto', () => {
  const { calculateWarrantyExpiration: expiry } = loader()('src/lib/maintenance/warranty.ts');
  assert.equal(expiry('2026-01-31', 1, 'months'), '2026-02-28');
  assert.equal(expiry('2024-01-31', 1, 'months'), '2024-02-29');
  assert.equal(expiry('2026-08-31', 1, 'months'), '2026-09-30');
  assert.equal(expiry('2026-12-31', 2, 'months'), '2027-02-28');
  assert.equal(expiry('2026-01-31', 30, 'days'), '2026-03-02');
});

test('schemas: dados opcionais na rapida e modo de cliente na completa', () => {
  const schemas = loader()('src/lib/validations/maintenance.schema.ts');
  const base = { device_model: 'Samsung A14', reported_issue: 'Nao carrega' };
  for (const extra of [{}, { customer_name: 'Joao' }, { phone: '98999998888' }, { customer_name: '', phone: '' }]) {
    assert.equal(schemas.createQuickMaintenanceOrderSchema.safeParse({ ...base, ...extra }).success, true);
  }
  for (const extra of [{ phone: 'abc' }, { device_model: '' }, { reported_issue: '' }]) {
    assert.equal(schemas.createQuickMaintenanceOrderSchema.safeParse({ ...base, ...extra }).success, false);
  }
  const full = { device: { model: 'A14' }, reported_issue: 'Nao carrega' };
  assert.equal(schemas.createMaintenanceOrderSchema.safeParse({ ...full, customer_id: customerId }).success, true);
  assert.equal(schemas.createMaintenanceOrderSchema.safeParse({ ...full, customer_mode: 'new', customer_name: 'Joao' }).success, true);
  assert.equal(schemas.createMaintenanceOrderSchema.safeParse(full).success, false);
});

test('actions usam uma RPC e preservam tentativa e organizacao em reenvios', async () => {
  const calls = [];
  const client = { rpc(name, args) { calls.push({ name, args }); return { maybeSingle: async () => ({ data: { order_id: 'os-existente' }, error: null }) }; } };
  const actions = loader(boundaries(client))('src/app/(dashboard)/manutencoes/actions.ts');
  for (const extra of [{}, { customer_name: 'Joao' }, { phone: '98999998888' }]) {
    await assert.rejects(actions.createQuickMaintenanceOrderAction({}, form({ request_id: requestId, device_model: 'A14', reported_issue: 'Nao carrega', organization_id: 'outra', ...extra })), /REDIRECT:\/manutencoes\/os-existente/);
  }
  for (const extra of [{ customer_mode: 'existing', customer_id: customerId }, { customer_mode: 'new', customer_name: 'Novo Cliente' }]) {
    await assert.rejects(actions.createMaintenanceOrderAction({}, form({ request_id: requestId, model: 'A14', reported_issue: 'Nao carrega', ...extra })), /REDIRECT/);
  }
  assert.equal(calls.length, 5);
  assert.ok(calls.every(call => call.name === 'create_maintenance_intake' && call.args.p_request_id === requestId && call.args.p_organization_id === org.id));
  assert.equal(calls[0].args.p_customer_phone, null);
  assert.equal(calls[3].args.p_customer_id, customerId);
  assert.equal(calls[4].args.p_customer_id, null);
});

test('previa e envio interpolam os dados reais da OS', () => {
  const load = loader();
  const { buildOrderMessageVariables } = load('src/lib/messages/order-variables.ts');
  const { interpolateMessageTemplate } = load('src/lib/messages/interpolation.ts');
  const variables = buildOrderMessageVariables({ organizationName: org.name, order: {
    order_number: 'OS-123456', status: 'recebido', expected_delivery_date: '2026-09-15',
    warranty_amount: 1, warranty_unit: 'months', warranty_expires_at: '2026-10-15',
    customers: { name: 'Maria Real', phone: '98999998888' }, devices: { model: 'Moto G32' }
  }});
  assert.equal(interpolateMessageTemplate('{{cliente_nome}} / {{aparelho_modelo}} / {{numero_ordem}} / {{data_entrega}}', variables), 'Maria Real / Moto G32 / OS-123456 / 15/09/2026');
});

test('WhatsApp com telefone retorna mensagem e sem telefone orienta completar cadastro', async () => {
  for (const phone of [null, '98999998888']) {
    const client = queryClient(table => ({ error: null, data: table === 'maintenance_orders' ? {
      id: 'os', order_number: 'OS-000001', status: 'recebido', expected_delivery_date: null,
      warranty_amount: null, warranty_unit: null, warranty_expires_at: null,
      customers: { id: customerId, name: 'Maria', phone }, devices: { model: 'Moto G32' }
    } : null }));
    const actions = loader(boundaries(client))('src/app/(dashboard)/mensagens/actions.ts');
    const result = await actions.logWhatsAppMessageAction('os', 'maintenance_received', {}, new FormData());
    if (!phone) {
      assert.match(result.error, /Informe um telefone/);
      assert.equal(result.whatsappUrl, undefined);
    } else {
      assert.match(result.whatsappUrl, /^https:\/\/wa.me\//);
      assert.match(result.messageBody, /Maria/);
    }
  }
});

test('migration ausente gera orientacao e mantem o identificador de tentativa', async () => {
  const client = { rpc() { return { maybeSingle: async () => ({ data: null, error: { code: 'PGRST202' } }) }; } };
  const actions = loader(boundaries(client))('src/app/(dashboard)/manutencoes/actions.ts');
  const result = await actions.createQuickMaintenanceOrderAction({}, form({ request_id: requestId, device_model: 'A14', reported_issue: 'Nao carrega' }));
  assert.match(result.error, /0009 e 0010/);
  assert.equal(result.values.request_id, requestId);
});

test('WhatsApp prepara a mesma mensagem duas vezes e detecta bloqueio', async () => {
  let run, opened = 0; const feedbacks = [];
  const fakeReact = {
    useRef: value => ({ current: value }),
    useState: value => [value, next => feedbacks.push(next)],
    useActionState: fn => { run = fn; return [{}, fn, false]; }
  };
  const previousWindow = global.window;
  global.window = { open: () => { opened++; return { closed: false, location: {}, close() {} }; } };
  try {
    const { useWhatsAppAction } = loader({ react: fakeReact })('src/app/(dashboard)/mensagens/whatsapp-controls.tsx');
    const hook = useWhatsAppAction(async () => ({ whatsappUrl: 'https://wa.me/5598999998888?text=oi', messageBody: 'oi' }));
    for (let i = 0; i < 2; i++) { hook.prepare({ preventDefault() { assert.fail('Envio sequencial bloqueado'); } }); await run({}, new FormData()); }
    assert.equal(opened, 2);
    global.window.open = () => null;
    hook.prepare({ preventDefault() {} }); await run({}, new FormData());
    assert.match(feedbacks.at(-1), /bloqueada/);
  } finally { global.window = previousWindow; }
});

test('dashboard diferencia consulta vazia de erro e oculta valores com falha', async () => {
  const empty = queryClient(() => ({ data: [], error: null }));
  const ok = await loader(boundaries(empty))('src/lib/dashboard/metrics.ts').getDashboardMetrics();
  assert.equal(ok.errors.financial, false);
  assert.equal(ok.financial.totalRevenue, 0);
  const failed = queryClient(() => ({ data: null, error: { code: 'SIMULATED_FAILURE' } }));
  const mocks = boundaries(failed);
  const metricsModule = loader(mocks)('src/lib/dashboard/metrics.ts');
  const metrics = await metricsModule.getDashboardMetrics();
  assert.ok(Object.values(metrics.errors).every(Boolean));
  const page = loader({ ...mocks, '@/lib/dashboard/metrics': { ...metricsModule, getDashboardMetrics: async () => metrics } })('src/app/(dashboard)/dashboard/page.tsx');
  const html = renderToStaticMarkup(await page.default({}));
  assert.match(html, /valores estão indisponíveis/);
  assert.doesNotMatch(html, /R\$.*0,00/);
  assert.doesNotMatch(html, /Nenhuma manutencao atrasada/);
});

test('reposicao com erro nao oferece lista vazia para copiar', async () => {
  const mocks = boundaries(queryClient(() => ({ data: null, error: {} })));
  const page = loader({ ...mocks, '../../saidas/actions': { getMonthlyRestockReport: async () => ({ error: 'Falha simulada', report: { month: '2026-09', rows: [], totalQuantity: 0, totalSold: 0, topCategory: null } }) } })('src/app/(dashboard)/relatorios/reposicao/page.tsx');
  const html = renderToStaticMarkup(await page.default({}));
  assert.match(html, /Falha simulada/);
  assert.doesNotMatch(html, /Copiar lista|Nenhum item vendido|Total vendido/);
});

test('edicao de venda calcula total no servidor e limita por organizacao', async () => {
  let updated; const filters = [];
  const q = new Proxy({}, { get(_, method) {
    if (method === 'update') return values => { updated = values; return q; };
    if (method === 'eq') return (...args) => { filters.push(args); return q; };
    if (method === 'maybeSingle') return async () => ({ data: { id: customerId }, error: null });
    return () => q;
  }});
  const actions = loader(boundaries({ from: () => q }))('src/app/(dashboard)/saidas/actions.ts');
  const result = await actions.updateProductOutflowAction(customerId, {}, form({ category: 'case', custom_model_name: 'Moto G32', quantity: '3', unit_price: '25,50', sold_at: '2026-09-09', notes: 'Corrigido' }));
  assert.equal(result.success, 'Saida atualizada.');
  assert.equal(updated.total_price, 76.5);
  assert.equal(updated.notes, 'Corrigido');
  assert.ok(filters.some(([field, value]) => field === 'organization_id' && value === org.id));
  const { getSuggestedUnitPrice } = loader()('src/lib/products/format.ts');
  assert.equal(getSuggestedUnitPrice('case', { default_price: '25.50' }), 25.5);
});
