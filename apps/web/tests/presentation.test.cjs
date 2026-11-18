/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');

function loader(overrides) {
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
const Link = ({ children, ...props }) => React.createElement('a', props, children);

test('navegação desktop/mobile identifica um único item ativo, incluindo subrotas', () => {
  for (const [pathname, expected] of [
    ['/dashboard', '/dashboard'], ['/clientes/cliente/editar', '/clientes'],
    ['/manutencoes/nova', '/manutencoes'], ['/manutencoes/rapida', '/manutencoes/rapida'],
    ['/configuracoes/quiosque', '/configuracoes/quiosque'],
    ['/configuracoes', '/configuracoes'], ['/saidas/modelos', '/saidas'],
    ['/clientes-inexistente', null], [null, null]
  ]) {
    const { DashboardNavigation } = loader({
      'next/link': Link, 'next/navigation': { usePathname: () => pathname }
    })('src/components/dashboard-navigation.tsx');
    for (const mobile of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(DashboardNavigation, { mobile }));
      const links = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0]);
      const active = links.filter(link => link.includes('aria-current="page"'));
      assert.equal(links.length, 9);
      assert.equal(active.length, expected ? 1 : 0);
      if (expected) assert.ok(active[0].includes(`href="${expected}"`));
    }
  }
});

test('header identifica saída mesmo com o texto visual oculto e conserva controles', async () => {
  const load = loader({
    'next/link': Link, 'next/navigation': { usePathname: () => '/dashboard' },
    '@/lib/auth/queries': { requireAuth: async () => ({ email: 'operador@example.test' }) },
    '@/lib/auth/platform-admin': { isPlatformAdmin: async () => false },
    '@/lib/auth/actions': { logoutAction() {} }
  });
  const Layout = load('src/app/(dashboard)/layout.tsx').default;
  const { ThemeProvider } = load('src/components/theme-provider.tsx');
  const html = renderToStaticMarkup(React.createElement(ThemeProvider, null, await Layout({ children: 'Conteúdo' })));
  assert.match(html, /aria-label="Sair do sistema"/);
  assert.match(html, /Alternar para tema escuro/);
  assert.match(html, /Abrir menu/);
  assert.match(html, /<details[^>]*>[\s\S]*<summary/);
});

test('formulários anunciam erro e envio sem mudar os campos ou habilitar novo envio', () => {
  const load = loader({
    'next/link': Link,
    react: { ...React, useActionState: () => [{ error: 'Falha simulada', values: {} }, () => {}, true] },
    '@/lib/auth/actions': { loginAction() {} },
    '../actions': { createQuickMaintenanceOrderAction() {} }
  });
  for (const [file, name, props, field] of [
    ['src/app/(auth)/login/login-form.tsx', 'LoginForm', {}, 'email'],
    ['src/app/(dashboard)/clientes/customer-form.tsx', 'CustomerForm', { action() {}, submitLabel: 'Salvar' }, 'address'],
    ['src/app/(dashboard)/manutencoes/rapida/quick-maintenance-form.tsx', 'QuickMaintenanceForm', { requestId: 'teste' }, 'estimated_price']
  ]) {
    const Component = load(file)[name];
    const html = renderToStaticMarkup(React.createElement(Component, props));
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /role="alert"[^>]*>Falha simulada<\/p>/);
    assert.match(html, /<button[^>]*disabled=""/);
    assert.ok(html.includes(`name="${field}"`));
  }
});
