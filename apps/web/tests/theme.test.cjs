/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
      if (name.endsWith('.css')) return {};
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    }
    new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
}

function browser(initial = null, blocked = false) {
  const classes = new Set();
  const values = new Map(initial === null ? [] : [['assistencia-theme', initial]]);
  const storage = {
    getItem(key) { if (blocked) throw new Error('Storage blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Storage blocked'); values.set(key, value); }
  };
  const document = { documentElement: { classList: {
    toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
    contains(name) { return classes.has(name); }
  } } };
  const window = new EventTarget();
  Object.defineProperty(window, 'localStorage', { get() { if (blocked) throw new Error('Storage unavailable'); return storage; } });
  return { classes, values, document, window, localStorage: storage };
}

function withBrowser(env, run) {
  const previous = { window: global.window, document: global.document };
  global.window = env.window; global.document = env.document;
  try { return run(); }
  finally {
    if (previous.window === undefined) delete global.window; else global.window = previous.window;
    if (previous.document === undefined) delete global.document; else global.document = previous.document;
  }
}

test('bootstrap anterior à pintura aceita apenas dark; padrão claro mesmo com SO escuro', () => {
  const { themeInitializationScript } = loader()('src/lib/theme.ts');
  for (const preference of [null, 'light', 'dark', 'system', '<script>alert(1)</script>']) {
    const env = browser(preference);
    vm.runInNewContext(themeInitializationScript, { ...env, matchMedia: () => ({ matches: true }) });
    assert.deepEqual([...env.classes], preference === 'dark' ? ['dark'] : []);
    // Nova carga repete a preferência sem precisar do React ou de uma requisição.
    vm.runInNewContext(themeInitializationScript, env);
    assert.equal(env.classes.has('dark'), preference === 'dark');
  }
  assert.doesNotThrow(() => vm.runInNewContext(themeInitializationScript, browser(null, true)));
});

test('alterna claro → escuro → claro, persiste e notifica; armazenamento bloqueado não quebra a troca', () => {
  const theme = loader()('src/lib/theme.ts');
  for (const blocked of [false, true]) {
    const env = browser(null, blocked);
    withBrowser(env, () => {
      let notifications = 0;
      const unsubscribe = theme.subscribeToTheme(() => notifications++);
      theme.setThemePreference('dark');
      assert.equal(theme.getThemeSnapshot(), 'dark');
      if (!blocked) assert.equal(env.values.get(theme.THEME_STORAGE_KEY), 'dark');
      theme.setThemePreference('light');
      assert.equal(theme.getThemeSnapshot(), 'light');
      if (!blocked) assert.equal(env.values.get(theme.THEME_STORAGE_KEY), 'light');
      assert.equal(notifications, 2);
      unsubscribe(); theme.setThemePreference('dark');
      assert.equal(notifications, 2);
    });
  }
});

test('sincroniza outras abas e limpeza do storage, ignora outras chaves e remove listeners', () => {
  const theme = loader()('src/lib/theme.ts');
  const env = browser();
  withBrowser(env, () => {
    let notifications = 0;
    const unsubscribe = theme.subscribeToTheme(() => notifications++);
    const storageEvent = key => { const event = new Event('storage'); event.key = key; env.window.dispatchEvent(event); };
    env.values.set(theme.THEME_STORAGE_KEY, 'dark');
    storageEvent('other-preference'); assert.equal(notifications, 0);
    storageEvent(theme.THEME_STORAGE_KEY);
    assert.equal(theme.getThemeSnapshot(), 'dark'); assert.equal(notifications, 1);
    env.values.clear(); storageEvent(null);
    assert.equal(theme.getThemeSnapshot(), 'light'); assert.equal(notifications, 2);
    unsubscribe(); storageEvent(null); assert.equal(notifications, 2);
  });
});

test('layout raiz contém provider e script; SSR e primeiro snapshot de hidratação são estáveis', () => {
  const load = loader();
  const Layout = load('src/app/layout.tsx').default;
  const { ThemeToggle } = load('src/components/theme-toggle.tsx');
  const theme = load('src/lib/theme.ts');
  const render = () => renderToStaticMarkup(React.createElement(Layout, null, React.createElement(ThemeToggle)));
  const server = render();
  assert.match(server, /<html lang="pt-BR"/);
  assert.ok(server.indexOf(theme.themeInitializationScript) < server.indexOf('<body>'));
  assert.match(server, /aria-label="Alternar para tema escuro"/);
  const env = browser('dark');
  vm.runInNewContext(theme.themeInitializationScript, env);
  withBrowser(env, () => {
    assert.equal(theme.getThemeSnapshot(), 'dark');
    assert.equal(theme.getServerThemeSnapshot(), 'light');
    // React usa getServerSnapshot tanto no servidor quanto durante a hidratação,
    // atualizando o ícone depois para o snapshot atual sem divergência de markup.
    assert.equal(render(), server);
  });
});

test('controle acessível é button nativo, informa estado e dispara a preferência oposta', () => {
  const changes = [];
  let theme = 'light';
  const { ThemeToggle } = loader({ './theme-provider': { useTheme: () => ({ theme, setTheme: value => changes.push(value) }) } })('src/components/theme-toggle.tsx');
  for (const current of ['light', 'dark']) {
    theme = current;
    const element = ThemeToggle();
    assert.equal(element.type, 'button'); assert.equal(element.props.type, 'button');
    assert.equal(element.props['aria-pressed'], current === 'dark');
    assert.equal(element.props['aria-label'], `Alternar para tema ${current === 'dark' ? 'claro' : 'escuro'}`);
    assert.match(renderToStaticMarkup(element), /Tema (claro|escuro)/);
    element.props.onClick();
  }
  assert.deepEqual(changes, ['dark', 'light']);
});

test('texto principal, auxiliar e estados semânticos têm contraste AA no tema escuro', () => {
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
  const dark = css.match(/\.dark\s*\{([^}]+)\}/)[1];
  const tokens = Object.fromEntries([...dark.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map(match => [match[1], match[2]]));
  function luminance(hex) {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }
  for (const [foreground, background] of [
    ['foreground', 'background'], ['body', 'surface'], ['muted', 'surface'],
    ['subtle', 'input'], ['accent', 'surface'], ['success', 'success-soft'],
    ['danger', 'danger-soft'], ['warning', 'warning-soft'], ['info', 'info-soft']
  ]) {
    const values = [luminance(tokens[foreground]), luminance(tokens[background])].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${foreground}/${background}`);
  }
});
