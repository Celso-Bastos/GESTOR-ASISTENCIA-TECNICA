/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const Link = ({ children, ...props }) => React.createElement('a', props, children);

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
      if (name === 'next/link') return Link;
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    }
    new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const form = values => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

test('layout usa o helper no servidor e repassa a decisão às duas navegações', async () => {
  for (const platformAdmin of [false, true]) {
    let checks = 0;
    const load = loader({
      '@/lib/auth/queries': { requireAuth: async () => ({ id: 'user', email: 'user@example.com' }) },
      '@/lib/auth/platform-admin': { isPlatformAdmin: async () => { checks++; return platformAdmin; } },
      '@/lib/auth/actions': { logoutAction() {} },
      '@/components/theme-toggle': { ThemeToggle: () => null },
      'next/navigation': { usePathname: () => '/dashboard' }
    });
    const html = renderToStaticMarkup(await load('src/app/(dashboard)/layout.tsx').default({ children: 'Conteúdo' }));
    assert.equal(checks, 1);
    assert.equal((html.match(/href="\/admin\/solicitacoes-conta"/g) || []).length, platformAdmin ? 2 : 0);
    assert.equal((html.match(/Administração/g) || []).length, platformAdmin ? 2 : 0);
  }
});

test('rota manual bloqueia anônimo e usuário comum antes de ler pedidos; admin abre pelo endereço do menu', async () => {
  for (const scenario of [{ user: null, admin: false }, { user: { id: 'org-admin' }, admin: false }, { user: { id: 'platform-admin' }, admin: true }]) {
    let queries = 0;
    const query = new Proxy({}, { get(_, method) {
      if (method === 'returns') return async () => ({ data: [], count: 0, error: null });
      return () => query;
    }});
    const load = loader({
      '@/lib/auth/queries': { getCurrentUser: async () => scenario.user },
      '@/lib/auth/platform-admin': { isPlatformAdmin: async () => scenario.admin },
      '@/lib/supabase/server': { createClient: async () => ({ from(table) { queries++; assert.equal(table, 'account_requests'); return query; } }) },
      '@/lib/auth/actions': { logoutAction() {} },
      '@/components/theme-toggle': { ThemeToggle: () => null },
      './review-form': { ReviewForm: () => null },
      'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); }, usePathname: () => '/dashboard' }
    });
    const render = () => load('src/app/admin/solicitacoes-conta/page.tsx').default({ searchParams: Promise.resolve({}) });
    if (!scenario.user) await assert.rejects(render(), /REDIRECT:\/login/);
    else {
      const html = renderToStaticMarkup(await render());
      assert.match(html, scenario.admin ? /Solicitações de conta/ : /Acesso negado/);
      const menu = renderToStaticMarkup(React.createElement(load('src/components/dashboard-navigation.tsx').DashboardNavigation, { platformAdmin: scenario.admin }));
      assert.equal(menu.includes('href="/admin/solicitacoes-conta"'), scenario.admin);
    }
    assert.equal(queries, scenario.admin ? 1 : 0);
  }
});

test('sugestão normaliza acentos, espaços, símbolos e hífens, respeitando 60 caracteres', () => {
  const load = loader();
  const suggest = load('src/lib/organization/slug.ts').suggestOrganizationSlug;
  const schema = load('src/lib/validations/organization.ts').organizationSlugSchema;
  for (const [name, expected] of [
    ['Celso Assistência', 'celso-assistencia'], ['Assistência São José', 'assistencia-sao-jose'],
    ['Assistência do João', 'assistencia-do-joao'], ['Tech & Cell', 'tech-cell'],
    [' -- Minha   Loja!!! -- ', 'minha-loja'], ['a'.repeat(59) + ' bbb', 'a'.repeat(59)]
  ]) {
    assert.equal(suggest(name), expected); assert.equal(schema.safeParse(suggest(name)).success, true);
  }
  assert.equal(suggest('!!!'), '');
  assert.equal(schema.safeParse('').success, false);
  for (const value of ['Minha Loja!!!', '-loja', 'loja-', 'loja--nova', 'São-José', 'ab', 'a'.repeat(61), 'loja/site']) {
    assert.equal(schema.safeParse(value).success, false, value);
  }
  for (const value of ['celso-cell', 'assistencia123', 'minha-loja-2']) assert.equal(schema.parse(value), value);
  assert.equal(schema.parse(' CELSO-CELL '), 'celso-cell');
});

function fixture({ role = 'owner', error = null, missing = false } = {}) {
  const state = { writes: [], invalidated: [], organization: { id: 'own-org', name: 'Celso Cell', slug: 'celso-cell', role } };
  const client = { from(table) {
    assert.equal(table, 'organizations');
    const write = { filters: [] }; state.writes.push(write);
    return {
      update(values) { write.values = values; return this; },
      eq(key, value) { write.filters.push([key, value]); return this; },
      select() { return this; },
      async maybeSingle() {
        if (!error && !missing) Object.assign(state.organization, write.values);
        return { error, data: error || missing ? null : { id: 'own-org' } };
      }
    };
  }};
  const load = loader({
    './queries': { requireOrganization: async () => state.organization },
    '@/lib/auth/queries': { requireAuth: async () => ({ id: 'user', email: 'user@example.com' }) },
    '@/lib/supabase/admin': { createAdminClient: () => client },
    'next/cache': { revalidatePath: (...args) => state.invalidated.push(args) },
    'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } }
  });
  return { state, load, update: load('src/lib/organization/actions.ts').updateOrganizationSite };
}

test('edição manual autoriza owner/admin, ignora IDs e nomes forjados e invalida links do quiosque', async () => {
  for (const role of ['owner', 'admin', 'employee']) {
    const f = fixture({ role });
    const result = await f.update({}, form({ slug: ' NOVA-LOJA ', organization_id: 'other-org', name: 'Nome forjado', role: 'owner' }));
    if (role === 'employee') {
      assert.match(result.error, /Somente/); assert.equal(f.state.writes.length, 0); continue;
    }
    assert.ok(result.success);
    assert.deepEqual(f.state.writes[0], { values: { slug: 'nova-loja' }, filters: [['id', 'own-org']] });
    assert.equal(f.state.organization.name, 'Celso Cell');
    assert.equal(f.state.organization.slug, 'nova-loja');
    assert.deepEqual(f.state.invalidated, [['/configuracoes'], ['/configuracoes/quiosque'], ['/kiosk/[slug]', 'page']]);
    const { buildKioskLink } = f.load('src/lib/kiosk/links.ts');
    assert.equal(new URL(buildKioskLink(f.state.organization.slug, 'test-token'), 'http://localhost').pathname, '/kiosk/nova-loja');
  }
});

test('validação no servidor impede escrita inválida; duplicidade e erros não expõem PostgreSQL', async () => {
  const f = fixture();
  for (const slug of ['Minha Loja!!!', '', 'São José', '-loja']) assert.ok((await f.update({}, form({ slug }))).error);
  assert.equal(f.state.writes.length, 0);
  for (const scenario of [{ error: { code: '23505', message: 'RAW POSTGRES' } }, { error: { code: 'FAIL', message: 'RAW POSTGRES' } }, { missing: true }]) {
    const failed = fixture(scenario);
    const result = await failed.update({}, form({ slug: 'outra-loja' }));
    assert.match(result.error, scenario.error?.code === '23505' ? /Este endereço já está sendo utilizado. Escolha outro./ : /Não foi possível/);
    assert.doesNotMatch(result.error, /RAW POSTGRES/);
    assert.equal(failed.state.organization.slug, 'celso-cell'); assert.equal(failed.state.invalidated.length, 0);
  }
});

test('criação também converte conflito UNIQUE em mensagem amigável', async () => {
  const load = loader({
    '@/lib/auth/queries': { requireAuth: async () => ({ id: 'user', email: 'user@example.com' }) },
    '@/lib/organization/queries': {},
    '@/lib/supabase/admin': { createAdminClient: () => ({ from(table) {
      if (table === 'organization_members') return { select() { return this; }, eq() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
      if (table === 'profiles') return { upsert: async () => ({ error: null }) };
      return { insert() { return this; }, select() { return this; }, single: async () => ({ data: null, error: { code: '23505', message: 'RAW POSTGRES' } }) };
    } }) },
    'next/cache': {}, 'next/navigation': {}
  });
  const result = await load('src/lib/organization/actions.ts').createInitialOrganization({}, form({ name: 'Minha Loja', slug: 'minha-loja', service_city: 'São Luís - MA' }));
  assert.equal(result.error, 'Este endereço já está sendo utilizado. Escolha outro.');
});

function findField(element, name) {
  if (!React.isValidElement(element)) return null;
  if (element.type === 'input' && element.props.name === name) return element;
  return React.Children.toArray(element.props.children).map(child => findField(child, name)).find(Boolean);
}

test('onboarding sugere enquanto não editado manualmente e não sobrescreve escolha ao mudar nome', () => {
  let site;
  const load = loader({
    '@/lib/organization/actions': { createInitialOrganization() {} },
    react: { ...React, useActionState: () => [{}, () => {}, false], useState: initial => [site ?? initial, value => { site = typeof value === 'function' ? value(site) : value; }] }
  });
  const Form = load('src/app/(dashboard)/onboarding/organizacao/organization-form.tsx').OrganizationForm;
  const render = () => { const tree = Form({ serviceCity: null }); site ??= { value: '', manuallyEdited: false }; return tree; };
  findField(render(), 'name').props.onChange({ target: { value: 'Celso Assistência' } });
  assert.equal(findField(render(), 'slug').props.value, 'celso-assistencia');
  findField(render(), 'slug').props.onChange({ target: { value: 'celso-cell' } });
  findField(render(), 'name').props.onChange({ target: { value: 'Assistência São José' } });
  assert.equal(findField(render(), 'slug').props.value, 'celso-cell');
  const html = renderToStaticMarkup(render());
  assert.match(html, /Site da loja/); assert.doesNotMatch(html, /Slug|Copiar link|Abrir site/);
});

test('configuração preserva endereço salvo mesmo após mudança do nome e não inventa site público', () => {
  let saved = 'celso-cell';
  const load = loader({
    '@/lib/organization/actions': { updateOrganizationSite() {} },
    react: { ...React, useActionState: () => [{}, () => {}, false] }
  });
  const Form = load('src/app/(dashboard)/configuracoes/site-form.tsx').OrganizationSiteForm;
  assert.equal(findField(Form({ slug: saved, name: 'Novo nome' }), 'slug').props.defaultValue, 'celso-cell');
  saved = 'novo-endereco';
  const html = renderToStaticMarkup(React.createElement(Form, { slug: saved }));
  assert.match(html, /value="novo-endereco"/); assert.match(html, /site público da loja ainda não está disponível/);
  assert.match(html, /links do Quiosque/); assert.doesNotMatch(html, /<a|Copiar link|Abrir site|Slug/);
});
