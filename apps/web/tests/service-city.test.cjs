/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');

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
      if (name === '@/components/theme-toggle') return { ThemeToggle: () => null };
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
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
const city = 'Anajatuba - MA';
const customer = { id: 'customer', name: 'Maria', address: 'Rua Principal, 100', birth_date: null, source: 'manual', created_at: '2026-01-01T12:00:00Z' };

function fixture({ role = 'owner', organization = null, requestCity = city, error = false } = {}) {
  const state = { role, organization, calls: [], request: { auth_user_id: 'user', status: 'approved', review_started_at: null, service_city: requestCity } };
  const client = { from(table) {
    const call = { table, filters: [] }; state.calls.push(call);
    const execute = async () => {
      if (error) return { data: null, error: { code: 'FAIL' } };
      if (table === 'account_requests') {
        const matches = call.filters.every(([key, value]) => state.request[key] === value);
        return { data: matches ? { service_city: state.request.service_city } : null, error: null };
      }
      if (table === 'organizations' && call.insert) {
        state.organization = { id: 'own-org', ...call.insert }; return { data: { id: 'own-org' }, error: null };
      }
      if (table === 'organizations' && call.update) {
        assert.deepEqual(call.filters, [['id', 'own-org']]);
        Object.assign(state.organization, call.update); return { data: { id: 'own-org' }, error: null };
      }
      if (table === 'organization_members' && !call.insert) {
        return { data: state.organization ? { id: 'member', role: state.role, organizations: state.organization } : null, error: null };
      }
      return { data: null, error: null };
    };
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => execute().then(resolve, reject);
      if (method === 'single' || method === 'maybeSingle') return execute;
      return (...args) => {
        if (['insert', 'update', 'select', 'upsert'].includes(method)) call[method] = args[0];
        if (method === 'eq' || method === 'is') call.filters.push(args);
        return query;
      };
    }}); return query;
  }};
  const load = loader({
    '@/lib/auth/queries': { requireAuth: async () => ({ id: 'user', email: 'user@example.com' }) },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/admin': { createAdminClient: () => client },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); }, notFound() { throw new Error('NOT_FOUND'); } },
    'next/link': ({ href, children }) => React.createElement('a', { href }, children),
    react: { ...React, useActionState: () => [{}, () => {}, false] },
    '../actions': { getCustomerById: async () => customer, deleteCustomerAction: async () => ({}) },
    '../confirm-delete-button': { ConfirmDeleteButton: () => null }
  });
  return { state, load };
}

test('Maps codifica endereço/cidade e mantém origem e parâmetros mesmo com acentos e símbolos', () => {
  const { buildGoogleMapsAddressUrl } = loader()('src/lib/google-maps.ts');
  for (const [address, serviceCity, expected] of [
    ['Rua Principal, 100', city, 'Rua Principal, 100, Anajatuba - MA, Brasil'],
    [' Rua São José, 15 & fundos #2 ', ' São Luís - MA ', 'Rua São José, 15 & fundos #2, São Luís - MA, Brasil'],
    ['Rua A', null, 'Rua A, Brasil'], ['Rua A', '   ', 'Rua A, Brasil']
  ]) {
    const url = new URL(buildGoogleMapsAddressUrl(address, serviceCity));
    assert.equal(url.origin, 'https://www.google.com'); assert.equal(url.pathname, '/maps/search/');
    assert.equal(url.searchParams.get('api'), '1'); assert.equal(url.searchParams.get('query'), expected);
    assert.deepEqual([...url.searchParams.keys()], ['api', 'query']); assert.equal(url.hash, '');
  }
  for (const empty of [null, undefined, '', '   ']) assert.equal(buildGoogleMapsAddressUrl(empty, city), null);
});

test('link some sem endereço e abre nova aba com proteção; renderizar não consulta Google', () => {
  const load = loader();
  const { GoogleMapsAddressLink } = load('src/components/google-maps-address-link.tsx');
  for (const address of [null, '', '  ']) assert.equal(renderToStaticMarkup(React.createElement(GoogleMapsAddressLink, { address, serviceCity: city })), '');
  const html = renderToStaticMarkup(React.createElement(GoogleMapsAddressLink, { address: customer.address, serviceCity: city }));
  assert.match(html, /target="_blank"/); assert.match(html, /rel="noopener noreferrer"/); assert.match(html, /Abrir no Maps/);
  assert.doesNotMatch(html, /<script|<iframe|<img|prefetch/);
});

test('cidade é obrigatória, aceita outras cidades, normaliza trim e limita tamanho', () => {
  const { accountRequestSchema } = loader()('src/lib/validations/account-request.schema.ts');
  const base = { full_name: 'Maria Silva', email: 'maria@example.com', password: 'valid-test-password', confirm_password: 'valid-test-password' };
  for (const value of [undefined, null, '', '   ', 'A', 'x'.repeat(121)]) assert.equal(accountRequestSchema.safeParse({ ...base, service_city: value }).success, false);
  for (const value of [city, 'São Luís - MA', 'Bacabal - MA']) assert.equal(accountRequestSchema.parse({ ...base, service_city: ` ${value} ` }).service_city, value);
});

test('solicitação aprovada preenche onboarding; organização copia e passa a controlar a cidade do Maps', async () => {
  const f = fixture();
  const initialCity = await f.load('src/lib/organization/onboarding.ts').getApprovedRequestServiceCity();
  assert.equal(initialCity, city);
  assert.deepEqual(f.state.calls[0].filters, [['auth_user_id', 'user'], ['status', 'approved'], ['review_started_at', null]]);
  const onboarding = await f.load('src/app/(dashboard)/onboarding/organizacao/page.tsx').default();
  assert.match(renderToStaticMarkup(onboarding), /value="Anajatuba - MA"/);
  const actions = f.load('src/lib/organization/actions.ts');
  await assert.rejects(actions.createInitialOrganization({}, form({ name: 'Loja', slug: 'loja', service_city: ` ${initialCity} ` })), /REDIRECT:\/dashboard/);
  assert.equal(f.state.organization.service_city, city);
  const detail = f.load('src/app/(dashboard)/clientes/[id]/page.tsx').default;
  const mapsQuery = async () => {
    const html = renderToStaticMarkup(await detail({ params: Promise.resolve({ id: 'customer' }) }));
    return new URL(html.match(/href="(https:\/\/www.google.com\/maps[^\"]*)"/)[1].replace(/&amp;/g, '&')).searchParams.get('query');
  };
  assert.equal(await mapsQuery(), 'Rua Principal, 100, Anajatuba - MA, Brasil');
  assert.ok((await actions.updateOrganizationServiceCity({}, form({ service_city: ' São Luís - MA ', organization_id: 'forged' }))).success);
  assert.equal(f.state.organization.service_city, 'São Luís - MA'); assert.equal(f.state.request.service_city, city);
  assert.equal(await mapsQuery(), 'Rua Principal, 100, São Luís - MA, Brasil');
});

test('onboarding consulta somente pedido aprovado do próprio usuário; legados ficam vazios e editáveis', async () => {
  for (const scenario of [{ auth_user_id: 'other' }, { status: 'pending' }, { status: 'rejected' }, { review_started_at: 'processing' }, { service_city: null }]) {
    const f = fixture(); Object.assign(f.state.request, scenario);
    assert.equal(await f.load('src/lib/organization/onboarding.ts').getApprovedRequestServiceCity(), null);
  }
  const f = fixture();
  await assert.rejects(f.load('src/lib/organization/actions.ts').createInitialOrganization({}, form({ name: 'Loja', slug: 'loja', service_city: 'Bacabal - MA' })), /REDIRECT/);
  assert.equal(f.state.organization.service_city, 'Bacabal - MA');
});

test('configuração recusa empregado, valida dados e permite owner/admin definir ou limpar a cidade', async () => {
  for (const role of ['owner', 'admin', 'employee']) {
    const f = fixture({ role, organization: { id: 'own-org', service_city: null } });
    const update = f.load('src/lib/organization/actions.ts').updateOrganizationServiceCity;
    const result = await update({}, form({ service_city: city, organization_id: 'other-org' }));
    if (role === 'employee') {
      assert.match(result.error, /Somente/); assert.equal(f.state.calls.some(c => c.update), false); continue;
    }
    assert.ok(result.success); assert.equal(f.state.organization.service_city, city);
    assert.ok((await update({}, form({ service_city: 'x'.repeat(121) }))).error);
    assert.ok((await update({}, form({ service_city: ' ' }))).success); assert.equal(f.state.organization.service_city, null);
  }
});

test('formulário atualiza o Maps com o endereço digitado e mantém endereço opcional', () => {
  let draft;
  const load = loader({ react: { ...React, useActionState: () => [{}, () => {}, false], useState: initial => [draft ?? initial, value => { draft = value; }] } });
  const { CustomerForm } = load('src/app/(dashboard)/clientes/customer-form.tsx');
  const props = { action: async () => ({}), serviceCity: city, submitLabel: 'Salvar' };
  const findTextarea = element => {
    if (!React.isValidElement(element)) return null;
    if (element.type === 'textarea' && element.props.name === 'address') return element;
    return React.Children.toArray(element.props.children).map(findTextarea).find(Boolean);
  };
  let tree = CustomerForm(props);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Abrir no Maps/);
  assert.equal(findTextarea(tree).props.required, undefined);
  findTextarea(tree).props.onChange({ target: { value: 'Rua nova, 12' } });
  tree = CustomerForm(props);
  assert.match(renderToStaticMarkup(tree), /Rua\+nova%2C\+12%2C\+Anajatuba/);
  findTextarea(tree).props.onChange({ target: { value: '' } });
  assert.doesNotMatch(renderToStaticMarkup(CustomerForm(props)), /Abrir no Maps/);
});

test('painel administrativo exibe cidade e fallback de solicitações antigas', async () => {
  for (const service_city of [city, null]) {
    const query = new Proxy({}, { get(_, method) {
      if (method === 'returns') return async () => ({ data: [{ id: 'request', full_name: 'Maria', service_city, status: 'approved', created_at: '2026-01-01T12:00:00Z' }], error: null, count: 1 });
      return () => query;
    }});
    const load = loader({
      '@/lib/auth/queries': { getCurrentUser: async () => ({ id: 'admin' }) },
      '@/lib/auth/platform-admin': { isPlatformAdmin: async () => true },
      '@/lib/supabase/server': { createClient: async () => ({ from: () => query }) },
      '@/lib/auth/actions': { logoutAction() {} }, './review-form': {},
      'next/link': ({ href, children }) => React.createElement('a', { href }, children)
    });
    const html = renderToStaticMarkup(await load('src/app/admin/solicitacoes-conta/page.tsx').default({ searchParams: Promise.resolve({ status: 'approved' }) }));
    assert.match(html, /Cidade de serviço/); assert.ok(html.includes(service_city || 'Não informada'));
  }
});
