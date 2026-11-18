/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const organization = { id: 'current-organization' };

// Executa os schemas, actions e componentes reais; substitui apenas fronteiras externas.
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (!/\.(ts|tsx)$/.test(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText;
    function localRequire(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    }
    new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
}

function harness({ state = {}, customer = null } = {}) {
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [] };
    calls.push(call);
    const result = () => ({ data: call.update ? { id: 'customer' } : customer, error: null });
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve(result()).then(resolve, reject);
      if (method === 'maybeSingle' || method === 'returns') return async () => result();
      return (...args) => {
        if (method === 'insert' || method === 'update' || method === 'select') call[method] = args[0];
        if (method === 'eq' || method === 'is') call.filters.push(args);
        return query;
      };
    }});
    return query;
  }};
  const load = loader({
    '@/lib/auth/queries': { getCurrentUser: async () => ({ id: 'user' }), requireAuth: async () => ({ id: 'user' }) },
    '@/lib/organization/queries': { getCurrentOrganization: async () => organization, requireOrganization: async () => organization },
    '@/lib/supabase/server': { createClient: async () => client },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); }, notFound() { throw new Error('NOT_FOUND'); } },
    'next/link': ({ children, href }) => React.createElement('a', { href }, children),
    react: { ...React, useActionState: () => [state, () => {}, false] },
    '../confirm-delete-button': { ConfirmDeleteButton: () => null }
  });
  return { calls, load, actions: load('src/app/(dashboard)/clientes/actions.ts') };
}

function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: 'Maria', ...values })) data.set(key, value);
  return data;
}

test('schemas aceitam campos ausentes, vazios e nulos; normalizam endereço e data', () => {
  const schemas = loader()('src/lib/validations/customer.schema.ts');
  for (const schema of [schemas.createCustomerSchema, schemas.updateCustomerSchema]) {
    for (const extra of [{}, { address: '', birth_date: '' }, { address: '   ', birth_date: '  ' }, { address: null, birth_date: null }]) {
      const parsed = schema.parse({ name: 'Maria', whatsapp_opt_in: false, ...extra });
      assert.equal(parsed.address, null);
      assert.equal(parsed.birth_date, null);
    }
    const parsed = schema.parse({ name: 'Maria', whatsapp_opt_in: false, address: '  Rua A, 123  ', birth_date: ' 2000-02-29 ' });
    assert.equal(parsed.address, 'Rua A, 123');
    assert.equal(parsed.birth_date, '2000-02-29');
    assert.equal(schema.safeParse({ name: 'Maria', whatsapp_opt_in: false, address: 'a'.repeat(301) }).success, false);
    for (const birth_date of ['2025-02-29', '1900-02-29', '2000-02-30', '2000-13-01', '2000-01-00', '0000-01-01', '01/02/2000', '2000-01-01T00:00:00Z', '9999-12-31']) {
      assert.equal(schema.safeParse({ name: 'Maria', whatsapp_opt_in: false, birth_date }).success, false, birth_date);
    }
  }
});

test('data civil mantém o dia e valida hoje/amanhã na virada de dia em São Paulo', () => {
  const dates = loader()('src/lib/civil-date.ts');
  for (const value of [null, undefined, '', '2025-02-29']) assert.equal(dates.formatCivilDateBR(value), 'Não informado');
  assert.equal(dates.formatCivilDateBR('2000-02-29'), '29/02/2000');
  assert.equal(dates.formatCivilDateBR('0001-01-01'), '01/01/0001');
  assert.equal(dates.getTodayCivilDate(new Date('2026-11-16T02:59:59Z')), '2026-11-15');
  assert.equal(dates.getTodayCivilDate(new Date('2026-11-16T03:00:00Z')), '2026-11-16');
  const { createCustomerSchema } = loader({ '@/lib/civil-date': { ...dates, getTodayCivilDate: () => '2026-11-16' } })('src/lib/validations/customer.schema.ts');
  assert.equal(createCustomerSchema.safeParse({ name: 'Maria', whatsapp_opt_in: false, birth_date: '2026-11-16' }).success, true);
  assert.equal(createCustomerSchema.safeParse({ name: 'Maria', whatsapp_opt_in: false, birth_date: '2026-11-17' }).success, false);
});

test('criação mínima e completa persistem null ou valores na organização da sessão', async () => {
  for (const extra of [{}, { address: '  Rua A, 123  ', birth_date: '2000-02-29' }]) {
    const { actions, calls } = harness();
    await assert.rejects(actions.createCustomerAction({}, form({ organization_id: 'forged', ...extra })), /REDIRECT:\/clientes/);
    const saved = calls.find(call => call.insert).insert;
    assert.equal(saved.organization_id, organization.id);
    assert.equal(saved.address, extra.address ? 'Rua A, 123' : null);
    assert.equal(saved.birth_date, extra.birth_date || null);
  }
});

test('edição altera cada campo e permite apagar ambos com escopo de organização', async () => {
  for (const extra of [
    { address: 'Rua nova', birth_date: '2000-02-29' },
    { address: 'Rua A', birth_date: '1990-03-15' },
    { address: '', birth_date: '' },
    {}
  ]) {
    const { actions, calls } = harness();
    await assert.rejects(actions.updateCustomerAction('customer', {}, form({ organization_id: 'forged', ...extra })), /REDIRECT:\/clientes\/customer/);
    const saved = calls.find(call => call.update);
    assert.equal(saved.update.address, extra.address || null);
    assert.equal(saved.update.birth_date, extra.birth_date || null);
    assert.equal(Object.hasOwn(saved.update, 'organization_id'), false);
    assert.deepEqual(saved.filters, [['id', 'customer'], ['organization_id', organization.id], ['deleted_at', null]]);
  }
});

test('actions rejeitam data futura e endereço longo antes de acessar o banco, preservando valores', async () => {
  for (const extra of [{ address: 'Rua A', birth_date: '9999-12-31' }, { address: 'x'.repeat(301), birth_date: '2000-01-01' }]) {
    const { actions, calls } = harness();
    for (const action of [actions.createCustomerAction, actions.updateCustomerAction.bind(null, 'customer')]) {
      const result = await action({}, form(extra));
      assert.ok(result.error);
      assert.equal(result.values.address, extra.address);
      assert.equal(result.values.birth_date, extra.birth_date);
    }
    assert.equal(calls.length, 0);
  }
});

test('consultas autenticadas carregam os novos campos com filtro de organização', async () => {
  const { actions, calls } = harness();
  await actions.getCustomers();
  await actions.getCustomerById('customer');
  for (const call of calls) {
    assert.match(call.select, /address, birth_date/);
    assert.ok(call.filters.some(([key, value]) => key === 'organization_id' && value === organization.id));
  }
});

test('formulário carrega campos nulos, preenchidos e valores devolvidos após erro', () => {
  for (const customer of [undefined, { address: null, birth_date: null }, { address: 'Rua A', birth_date: '2000-02-29' }]) {
    const { load } = harness();
    const { CustomerForm } = load('src/app/(dashboard)/clientes/customer-form.tsx');
    const html = renderToStaticMarkup(React.createElement(CustomerForm, { customer, action: async () => ({}), submitLabel: 'Salvar' }));
    assert.match(html, /Endereço \(opcional\)/);
    assert.match(html, /Data de aniversário \(opcional\)/);
    assert.match(html, /maxLength="300"/);
    assert.doesNotMatch(html.match(/<input[^>]*name="birth_date"[^>]*>/)[0], /required/);
    assert.doesNotMatch(html.match(/<textarea[^>]*name="address"[^>]*>/)[0], /required/);
    assert.ok(html.includes(`>${customer?.address || ''}</textarea>`));
    assert.match(html, new RegExp(`name="birth_date"[^>]*value="${customer?.birth_date || ''}"`));
  }
  const { load } = harness({ state: { error: 'Erro simulado', values: { address: '', birth_date: '' } } });
  const { CustomerForm } = load('src/app/(dashboard)/clientes/customer-form.tsx');
  const html = renderToStaticMarkup(React.createElement(CustomerForm, { customer: { address: 'Antigo', birth_date: '2000-01-01' }, action: async () => ({}), submitLabel: 'Salvar' }));
  assert.doesNotMatch(html, /Antigo|2000-01-01/);
  assert.match(html, /Erro simulado/);
});

test('detalhe exibe endereço e aniversário brasileiro, com fallback para clientes antigos', async () => {
  for (const extra of [{}, { address: null, birth_date: null }, { address: 'Rua A, 123', birth_date: '2000-02-29' }]) {
    const { load } = harness({ customer: { id: 'customer', name: 'Maria', source: 'manual', created_at: '2026-01-01T12:00:00Z', ...extra } });
    const page = load('src/app/(dashboard)/clientes/[id]/page.tsx');
    const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ id: 'customer' }) }));
    assert.ok(html.includes(extra.address || 'Não informado'));
    assert.ok(html.includes(extra.birth_date ? '29/02/2000' : 'Não informado'));
    assert.doesNotMatch(html, />null</);
  }
});
