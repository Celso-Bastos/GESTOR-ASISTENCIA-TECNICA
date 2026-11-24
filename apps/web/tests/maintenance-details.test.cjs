/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loader(overrides = {}) {
  const modules = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (!/\.(ts|tsx)$/.test(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (modules.has(file)) return modules.get(file).exports;
    const mod = { exports: {} }; modules.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX
    } }).outputText;
    function req(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    }
    new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
    return mod.exports;
  }
  return load;
}

function detailFixture({ missing = false, denied = false, gate } = {}) {
  const calls = [];
  const history = Array.from({ length: 121 }, (_, i) => ({ id: String(i), description: `Evento ${i}` }));
  const client = { from(table) {
    const call = { table, filters: [], order: [] }; calls.push(call);
    const query = new Proxy({}, { get(_, method) {
      if (method === 'maybeSingle' || method === 'returns') return async () => {
        call.started = true;
        if (gate) await gate;
        return { data: table === 'maintenance_orders' ? (missing ? null : { id: 'order' })
          : history.slice(call.range[0], call.range[1] + 1), error: null };
      };
      return (...args) => {
        if (method === 'eq' || method === 'is') call.filters.push(args);
        else if (method === 'order') call.order.push(args);
        else call[method] = method === 'range' ? args : args[0];
        return query;
      };
    } });
    return query;
  } };
  const load = loader({
    '@/lib/organization/queries': { requireOrganization: async () => {
      if (denied) throw new Error('REDIRECT:/login');
      return { id: 'organization' };
    } },
    '@/lib/supabase/server': { createClient: async () => client }
  });
  return { ...load('src/lib/maintenance/detail-queries.ts'), calls };
}

test('histórico pagina todos os eventos sem duplicar, com limite e escopo de organização', async () => {
  const f = detailFixture();
  const collected = [];
  for (let page = 1; page <= 3; page++) {
    const order = await f.getMaintenanceOrderById('order', page);
    collected.push(...order.events.map(event => event.id));
    assert.equal(order.eventPage, page);
    assert.equal(order.hasMoreEvents, page < 3);
    assert.equal(order.events.length, page < 3 ? 50 : 21);
  }
  assert.deepEqual(collected, Array.from({ length: 121 }, (_, i) => String(i)));
  for (const call of f.calls) {
    assert.ok(call.filters.some(([key, value]) => key === 'organization_id' && value === 'organization'));
    assert.doesNotMatch(call.select, /\*/);
    if (call.table === 'maintenance_events') {
      assert.ok(call.filters.some(([key, value]) => key === 'maintenance_order_id' && value === 'order'));
      assert.deepEqual(call.order, [['created_at', { ascending: false }], ['id', { ascending: false }]]);
      assert.equal(call.range[1] - call.range[0], 50);
    } else assert.ok(call.filters.some(([key, value]) => key === 'deleted_at' && value === null));
  }
  for (const value of [undefined, ['2'], '-1', '0', '2x', 'Infinity', '1.5', '999999999999999999']) {
    assert.equal(f.parseMaintenanceEventPage(value), 1);
  }
  assert.equal(f.parseMaintenanceEventPage('2'), 2);
});

test('OS e eventos começam em paralelo; sessão inválida não consulta dados e OS ausente continua nula', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = detailFixture({ gate });
  const pending = f.getMaintenanceOrderById('order');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.filter(call => call.started).length, 2);
  release(); await pending;
  assert.equal(await detailFixture({ missing: true }).getMaintenanceOrderById('order'), null);
  const denied = detailFixture({ denied: true });
  await assert.rejects(denied.getMaintenanceOrderById('order'), /REDIRECT/);
  assert.equal(denied.calls.length, 0);
});

test('mensagens da OS consultam somente o DTO usado no client e preservam filtros de segurança', async () => {
  const calls = [];
  const query = new Proxy({}, { get(_, method) {
    if (method === 'returns') return async () => ({ data: [], error: null });
    return (...args) => { calls.push([method, ...args]); return query; };
  } });
  const load = loader({
    '@/lib/organization/queries': { requireOrganization: async () => ({ id: 'organization' }) },
    '@/lib/supabase/server': { createClient: async () => ({ from: () => query }) }
  });
  assert.deepEqual(await load('src/lib/messages/maintenance-queries.ts').getActiveCustomMessageTemplatesForMaintenance(), []);
  assert.ok(calls.some(call => call[0] === 'select' && call[1] === 'id, title, body, context'));
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'organization_id' && call[2] === 'organization'));
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'is_active' && call[2] === true));
  assert.ok(calls.some(call => call[0] === 'is' && call[1] === 'deleted_at' && call[2] === null));
  assert.ok(calls.some(call => call[0] === 'in' && call[1] === 'context' && JSON.stringify(call[2]) === '["maintenance","warranty","general"]'));
});

test('cache real do React deduplica por requisição e isola organizações, aprovação e sessão expirada', async () => {
  const ReactServer = require(path.join(path.dirname(require.resolve('react/package.json')), 'react.react-server.js'));
  const internals = ReactServer.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previous = internals.A;
  const requests = new AsyncLocalStorage();
  // Reproduz o dispatcher de cache do renderer usando o cache real do React 19.
  internals.A = { getCacheForType(type) {
    const values = requests.getStore().cache;
    if (!values.has(type)) values.set(type, type());
    return values.get(type);
  } };
  const load = loader({
    react: ReactServer,
    'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } },
    '@/lib/supabase/server': { createClient: async () => {
      const request = requests.getStore();
      return {
        auth: { getUser: async () => { request.calls.auth++; return { data: { user: request.user }, error: null }; } },
        rpc: async () => { request.calls.approval++; return { data: request.access, error: null }; },
        from(table) {
          request.calls[table]++;
          return { select() { return this; }, eq() { return this; }, limit() { return this; },
            maybeSingle: async () => ({ data: table === 'platform_admins' ? null : {
              role: 'owner', organizations: { id: request.user.id, name: request.user.id }
            }, error: null }) };
        }
      };
    } }
  });
  const auth = load('src/lib/auth/queries.ts');
  const organizations = load('src/lib/organization/queries.ts');
  const admin = load('src/lib/auth/platform-admin.ts');
  function run(user, access, fn) {
    const context = { user, access, cache: new Map(), calls: { auth: 0, approval: 0, organization_members: 0, platform_admins: 0 } };
    return requests.run(context, async () => fn(context.calls));
  }
  try {
    await Promise.all(['organization-a', 'organization-b'].map(id => run({ id }, 'approved', async calls => {
      const [, , first, second] = await Promise.all([
        auth.requireAuth(), auth.getCurrentUser(), organizations.requireOrganization(), organizations.requireOrganization(), admin.isPlatformAdmin()
      ]);
      assert.equal(first.id, id); assert.equal(second.id, id);
      assert.deepEqual(calls, { auth: 1, approval: 1, organization_members: 1, platform_admins: 1 });
    })));
    for (const access of ['pending', 'rejected', 'blocked']) await run({ id: 'organization-a' }, access, async calls => {
      await assert.rejects(organizations.requireOrganization(), new RegExp('REDIRECT:/login\\?conta=' + access));
      assert.equal(await admin.isPlatformAdmin(), false);
      assert.deepEqual(calls, { auth: 1, approval: 1, organization_members: 0, platform_admins: 0 });
    });
    await run(null, 'approved', async calls => {
      await assert.rejects(organizations.requireOrganization(), /REDIRECT:\/login/);
      assert.deepEqual(calls, { auth: 1, approval: 0, organization_members: 0, platform_admins: 0 });
    });
  } finally { internals.A = previous; }
});
