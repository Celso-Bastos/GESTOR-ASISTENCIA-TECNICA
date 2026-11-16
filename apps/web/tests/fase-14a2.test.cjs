/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner CommonJS harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const requestId = '30000000-0000-4000-8000-000000000003';
const adminId = '20000000-0000-4000-8000-000000000002';
const userId = '10000000-0000-4000-8000-000000000001';

function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (!/\.(ts|tsx)$/.test(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText;
    function localRequire(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    }
    new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
const secret = 't' + 'est-only-credential';
const base = { full_name: 'Maria da Silva', email: ' Maria@Example.com ', password: secret, confirm_password: secret };
const row = () => ({ id: requestId, full_name: base.full_name, email: 'maria@example.com', email_normalized: 'maria@example.com', phone: null, business_name: null, status: 'pending', created_at: new Date().toISOString(), review_started_at: null, auth_user_id: userId, approval_email_sent_at: null, invite_sent_at: null });

// Substitui somente fronteiras externas. Schemas, decisões e compensações são reais.
function fixture(options = {}) {
  const state = { rows: options.rows ?? [], creates: 0, updates: 0, deletes: 0, calls: [], existing: options.existing ?? null,
    authUser: { id: userId, email: 'maria@example.com', app_metadata: options.metadata ?? { account_status: 'pending', provider: 'email' } } };
  const client = {
    async rpc(name, args) { state.calls.push(['rpc', name, args]); return { data: state.existing, error: options.lookupError ?? null }; },
    auth: { admin: {
      async createUser(args) {
        state.creates++;
        assert.equal(args.password, secret);
        assert.equal(args.email, 'maria@example.com');
        assert.equal(args.email_confirm, false);
        assert.deepEqual(args.app_metadata, { account_status: 'pending' });
        assert.deepEqual(args.user_metadata, { full_name: base.full_name });
        if (options.createError) return { data: { user: null }, error: { code: 'FAILED' } };
        state.existing = userId;
        return { data: { user: state.authUser }, error: null };
      },
      async getUserById(id) {
        assert.equal(id, userId);
        return { data: { user: options.authMissing ? null : state.authUser }, error: options.authMissing ? {} : null };
      },
      async updateUserById(id, args) {
        state.updates++; state.calls.push(['updateAuth', id, args]);
        if (options.updateWait) await options.updateWait;
        if (options.updateThrows) throw new Error('NETWORK_FAILURE');
        if (options.updateError) return { error: { code: 'FAILED' } };
        state.authUser.app_metadata = args.app_metadata;
        state.authUser.email_confirmed = args.email_confirm === true;
        return { data: { user: state.authUser }, error: null };
      },
      async deleteUser(id) {
        state.deletes++; assert.equal(id, userId);
        if (options.deleteError) return { error: { code: 'FAILED' } };
        state.existing = null; return { error: null };
      },
      inviteUserByEmail() { assert.fail('O fluxo novo nunca envia convites'); }
    }},
    from(table) {
      state.calls.push(['from', table]);
      let mode = 'select', values, executed;
      const filters = [];
      function execute() {
        if (executed) return executed;
        executed = (async () => {
          if (options.dbError) return { data: null, error: { code: 'FAILED' } };
          if (mode === 'insert') {
            if (options.insertError) return { data: null, error: { code: 'FAILED' } };
            if (options.insertDuplicate || state.rows.some(r => r.email_normalized === values.email_normalized && r.status === 'pending')) return { data: null, error: { code: '23505' } };
            const created = { ...row(), ...values }; state.rows.push(created);
            if (options.insertResponseLost) throw new Error('NETWORK_FAILURE_AFTER_COMMIT');
            return { data: { ...created }, error: null };
          }
          const found = state.rows.find(r => filters.every(([key, value]) => (r[key] ?? null) === value));
          if (mode === 'update' && found) {
            if (values.status && options.finalizeError) return { data: null, error: { code: 'FAILED' } };
            Object.assign(found, values);
          }
          return { data: found ? { ...found } : null, error: null };
        })(); return executed;
      }
      const query = {
        select() { return query; }, insert(v) { mode = 'insert'; values = v; return query; }, update(v) { mode = 'update'; values = v; return query; },
        eq(k, v) { filters.push([k, v]); return query; }, is(k, v) { filters.push([k, v]); return query; },
        maybeSingle: execute, single: execute, then(resolve, reject) { return execute().then(resolve, reject); }
      }; return query;
    }
  };
  const load = loader({
    '@/lib/supabase/admin': { createAdminClient() { state.calls.push(['adminClient']); return client; } },
    '@/lib/auth/platform-admin': { getPlatformAdmin: async () => options.unauthorized ? null : ({ id: adminId }) },
    'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } }
  }); return { state, client, actions: load('src/lib/account-requests/actions.ts') };
}

test('cadastro entrega senha somente ao Auth, cria pending associado sem persistir credenciais', async () => {
  const f = fixture();
  await assert.rejects(f.actions.createAccountRequestAction({}, form({ ...base, status: 'approved', reviewed_by: adminId })), /REDIRECT:\/criar-conta\/aguardando/);
  const saved = f.state.rows[0];
  assert.equal(saved.status, 'pending'); assert.equal(saved.auth_user_id, userId); assert.equal(saved.email_normalized, 'maria@example.com');
  assert.equal(saved.phone, null); assert.equal(saved.phone_normalized, null); assert.equal(saved.reviewed_by, undefined);
  assert.equal(f.state.creates, 1);
  for (const key of ['password', 'password_hash', 'confirm_password']) assert.equal(Object.hasOwn(saved, key), false);
  assert.equal(JSON.stringify(saved).includes(secret), false);
});
test('opcionais e telefone internacional usam helper BR', async () => {
  const f = fixture();
  await assert.rejects(f.actions.createAccountRequestAction({}, form({ ...base, phone: '+55 (11) 99999-8888', business_name: ' Loja Maria ' })), /REDIRECT/);
  assert.equal(f.state.rows[0].phone_normalized, '11999998888'); assert.equal(f.state.rows[0].business_name, 'Loja Maria');
});
test('Zod rejeita divergência, senha curta, ausente e longa antes de qualquer efeito externo', async () => {
  const cases = [{ full_name: 'A' }, { email: 'invalido' }, { phone: 'abc' }, { website: 'spam' },
    { password: 'short', confirm_password: 'short' }, { confirm_password: 'different' }, { password: '' },
    { password: 'x'.repeat(129), confirm_password: 'x'.repeat(129) }, { confirm_password: '' }];
  for (const extra of cases) {
    const f = fixture(); const result = await f.actions.createAccountRequestAction({}, form({ ...base, ...extra }));
    assert.ok(result.error); assert.equal(f.state.calls.length, 0);
    assert.deepEqual(Object.keys(result.values).sort(), ['business_name', 'email', 'full_name', 'phone']);
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
  const f = fixture();
  assert.equal((await f.actions.createAccountRequestAction({}, form({ ...base, password: 'short', confirm_password: 'short' }))).error, 'A senha deve ter pelo menos 8 caracteres.');
  assert.equal((await f.actions.createAccountRequestAction({}, form({ ...base, confirm_password: 'different' }))).error, 'As senhas não coincidem.');
});
test('duplicidades e contas existentes não criam usuários nem sobrescrevem a senha', async () => {
  for (const [options, pattern] of [[{ rows: [row()] }, /Já existe uma solicitação pendente/],
    [{ existing: userId, metadata: {} }, /Este e-mail já possui acesso/],
    [{ existing: userId, rows: [{ ...row(), status: 'rejected' }], metadata: { account_status: 'rejected' } }, /não foi aprovada/],
    [{ existing: userId }, /verificação pelo administrador/]]) {
    const f = fixture(options); assert.match((await f.actions.createAccountRequestAction({}, form(base))).error, pattern);
    assert.equal(f.state.creates, 0); assert.equal(f.state.updates, 0);
  }
});
test('falha no INSERT compensa somente o usuário recém-criado; resposta perdida preserva vínculo persistido', async () => {
  for (const options of [{ insertError: true }, { insertDuplicate: true }, { insertError: true, deleteError: true }]) {
    const f = fixture(options); const result = await f.actions.createAccountRequestAction({}, form(base));
    assert.match(result.error, options.insertDuplicate ? /Já existe uma solicitação pendente/ : /Não foi possível enviar/); assert.equal(f.state.creates, 1); assert.equal(f.state.deletes, 1);
    assert.equal(f.state.rows.length, 0); assert.equal(JSON.stringify(result).includes(secret), false);
  }
  const f = fixture({ insertResponseLost: true });
  await assert.rejects(f.actions.createAccountRequestAction({}, form(base)), /REDIRECT/);
  assert.equal(f.state.deletes, 0); assert.equal(f.state.rows.length, 1);
});
test('falhas de consulta ou Auth não criam pedidos', async () => {
  for (const options of [{ dbError: true }, { lookupError: {} }, { createError: true }]) {
    const failed = fixture(options); assert.ok((await failed.actions.createAccountRequestAction({}, form(base))).error);
    assert.equal(failed.state.rows.length, 0);
  }
});
test('usuário comum e anônimo não obtêm cliente administrativo em aprovação ou rejeição', async () => {
  const f = fixture({ unauthorized: true, rows: [row()] });
  for (const method of ['approveAccountRequestAction', 'rejectAccountRequestAction']) {
    assert.match((await f.actions[method]({}, form({ id: requestId }))).error, /Acesso negado/);
  }
  assert.equal(f.state.calls.length, 0);
});
test('aprovação libera usuário existente, confirma e-mail, preserva metadata e audita identidade real', async () => {
  const f = fixture({ rows: [row()] });
  const result = await f.actions.approveAccountRequestAction({}, form({ id: requestId, reviewed_by: 'forjado', status: 'rejected' }));
  assert.ok(result.success); const saved = f.state.rows[0];
  assert.equal(saved.status, 'approved'); assert.equal(saved.reviewed_by, adminId); assert.equal(saved.auth_user_id, userId);
  assert.ok(saved.reviewed_at); assert.equal(saved.approval_email_sent_at, null); assert.equal(saved.invite_sent_at, null);
  assert.equal(saved.review_started_at, null); assert.equal(f.state.creates, 0); assert.equal(f.state.updates, 1);
  assert.equal(f.state.authUser.app_metadata.account_status, 'approved'); assert.equal(f.state.authUser.app_metadata.provider, 'email'); assert.equal(f.state.authUser.email_confirmed, true);
  assert.match((await f.actions.approveAccountRequestAction({}, form({ id: requestId }))).error, /já foi revisada/);
  assert.equal(f.state.updates, 1);
});
test('aprovação e rejeição simultâneas respeitam a mesma reserva durável', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const f = fixture({ rows: [row()], updateWait: wait });
  const first = f.actions.approveAccountRequestAction({}, form({ id: requestId }));
  for (let attempt = 0; attempt < 200 && !f.state.updates; attempt++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.state.updates, 1);
  assert.match((await f.actions.approveAccountRequestAction({}, form({ id: requestId }))).error, /processamento/);
  assert.match((await f.actions.rejectAccountRequestAction({}, form({ id: requestId }))).error, /processamento/);
  release(); assert.ok((await first).success); assert.equal(f.state.updates, 1);
});
test('falhas ambíguas do Auth e falha pós-Auth mantêm reserva e não repetem liberação', async () => {
  for (const options of [{ updateError: true }, { updateThrows: true }, { finalizeError: true }]) {
    for (const method of ['approveAccountRequestAction', 'rejectAccountRequestAction']) {
      const f = fixture({ rows: [row()], ...options });
      assert.ok((await f.actions[method]({}, form({ id: requestId }))).error);
      assert.ok(f.state.rows[0].review_started_at); assert.equal(f.state.rows[0].status, 'pending');
      await f.actions[method]({}, form({ id: requestId })); assert.equal(f.state.updates, 1);
    }
  }
});
test('solicitação antiga sem Auth não aprova por convite; usuário ausente não libera acesso', async () => {
  for (const options of [{ rows: [{ ...row(), auth_user_id: null }] }, { rows: [row()], authMissing: true }]) {
    const f = fixture(options);
    assert.ok((await f.actions.approveAccountRequestAction({}, form({ id: requestId }))).error);
    assert.equal(f.state.rows[0].status, 'pending'); assert.equal(f.state.rows[0].review_started_at, null); assert.equal(f.state.updates, 0);
  }
});
test('rejeição preserva Auth e histórico, bloqueia acesso e grava motivo opcional', async () => {
  for (const reason of ['', ' Cadastro não autorizado ']) {
    const f = fixture({ rows: [row()] });
    assert.ok((await f.actions.rejectAccountRequestAction({}, form({ id: requestId, rejection_reason: reason, reviewed_by: 'forjado' }))).success);
    const saved = f.state.rows[0]; assert.equal(saved.status, 'rejected'); assert.equal(saved.reviewed_by, adminId); assert.ok(saved.reviewed_at);
    assert.equal(saved.rejection_reason, reason.trim() || null); assert.equal(f.state.authUser.app_metadata.account_status, 'rejected');
    assert.equal(f.state.deletes, 0); assert.equal(f.state.authUser.email_confirmed, false);
  }
});

test('tela admin nega usuário comum antes de consultar solicitações', async () => {
  const load = loader({
    '@/lib/auth/queries': { getCurrentUser: async () => ({ id: userId }) },
    '@/lib/auth/platform-admin': { isPlatformAdmin: async () => false },
    '@/lib/supabase/server': { createClient() { assert.fail('Não deveria consultar solicitações'); } },
    '@/lib/auth/actions': {},
    './review-form': {},
    'next/link': ({ href, children }) => React.createElement('a', { href }, children)
  });
  const html = renderToStaticMarkup(await load('src/app/admin/solicitacoes-conta/page.tsx').default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Acesso negado/); assert.doesNotMatch(html, /Maria|example.com/);
});
test('helper de platform admin exige usuário validado e associação real, sem autorizar por e-mail', async () => {
  for (const scenario of [{ user: null }, { user: { id: userId, email: 'admin@example.com' } }, { user: { id: adminId }, member: true }, { user: { id: adminId }, member: true, error: {} }]) {
    let queried = false;
    const load = loader({
      '@/lib/auth/queries': { getCurrentUser: async () => scenario.user },
      '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ data: 'approved', error: null }), from(table) {
        queried = true; assert.equal(table, 'platform_admins');
        return { select() { return this; }, eq(key, value) { assert.equal(key, 'user_id'); assert.equal(value, scenario.user.id); return this; }, maybeSingle: async () => ({ data: scenario.member ? { user_id: adminId } : null, error: scenario.error ?? null }) };
      } }) }
    });
    const helper = load('src/lib/auth/platform-admin.ts');
    const expected = !!scenario.user && !!scenario.member && !scenario.error;
    assert.equal(await helper.isPlatformAdmin(), expected);
    assert.equal(!!(await helper.getPlatformAdmin()), expected);
    assert.equal(queried, !!scenario.user);
  }
});
test('login preserva autenticação por senha e destinos com/sem organização', async () => {
  for (const membership of [false, true]) {
    const client = { rpc: async () => ({ data: 'approved', error: null }), auth: { signInWithPassword: async credentials => {
      assert.equal(credentials.email, 'maria@example.com');
      assert.equal(credentials.password, 'SenhaExistente');
      return { data: { user: { id: userId } }, error: null };
    } }, from: () => ({ select() { return this; }, eq() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: membership ? { id: requestId } : null }) }) };
    const login = loader({ '@/lib/supabase/server': { createClient: async () => client }, 'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } } })('src/lib/auth/actions.ts').loginAction;
    await assert.rejects(login({}, form({ email: 'maria@example.com', password: 'SenhaExistente' })), membership ? /REDIRECT:\/dashboard/ : /REDIRECT:\/onboarding\/organizacao/);
    client.auth.signInWithPassword = async () => ({ data: { user: null }, error: {} });
    assert.match((await login({}, form({ email: 'maria@example.com', password: 'SenhaExistente' }))).error, /Email ou senha invalidos/);
  }
});
test('definição de senha exige sessão, confirma senha e reutiliza destino de onboarding/dashboard', async () => {
  for (const member of [false, true]) {
    const client = { rpc: async () => ({ data: 'approved', error: null }), auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }), updateUser: async () => ({ error: null }) }, from: () => ({ select() { return this; }, eq() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: member ? { id: requestId } : null }) }) };
    const action = loader({ '@/lib/supabase/server': { createClient: async () => client }, 'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } } })('src/lib/auth/password-actions.ts').definePasswordAction;
    assert.match((await action({}, form({ password: 'abcdefgh', confirm_password: 'diferente' }))).error, /iguais/);
    await assert.rejects(action({}, form({ password: 'Senha!123forte', confirm_password: 'Senha!123forte' })), member ? /REDIRECT:\/dashboard/ : /REDIRECT:\/onboarding\/organizacao/);
    client.auth.getUser = async () => ({ data: { user: null }, error: null });
    client.auth.updateUser = async () => { assert.fail('Sem sessão não altera senha'); };
    assert.match((await action({}, form({ password: 'Senha!123forte', confirm_password: 'Senha!123forte' }))).error, /expirou|inválido/);
  }
});
test('confirmação do convite aceita apenas invite e sempre redireciona para destino local fixo', async () => {
  let verifications = 0;
  const { GET } = loader({
    '@/lib/supabase/server': { createClient: async () => ({ auth: { verifyOtp: async values => { verifications++; assert.equal(values.type, 'invite'); return { error: values.token_hash === 'expired' ? {} : null }; } } }) },
    'next/server': { NextResponse: { redirect: url => ({ url: String(url), headers: new Headers() }) } }
  })('src/app/auth/confirm/route.ts');
  for (const [query, valid] of [['?token_hash=valid&type=invite&next=https://evil.example', true], ['?token_hash=expired&type=invite', false], ['?token_hash=valid&type=recovery', false], ['', false]]) {
    const url = 'https://app.example.com/auth/confirm' + query;
    const response = await GET({ url, nextUrl: new URL(url) });
    assert.equal(response.url, 'https://app.example.com/auth/definir-senha' + (valid ? '' : '?erro=convite'));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal(verifications, 2);
});


test('status confiável falha fechado em RPC indisponível ou status desconhecido', async () => {
  const { getAccountAccessStatus } = loader()('src/lib/auth/account-access.ts');
  for (const data of ['approved', 'pending', 'rejected']) assert.equal(await getAccountAccessStatus({ rpc: async () => ({ data, error: null }) }), data);
  for (const result of [{ data: 'approved', error: {} }, { data: 'unknown', error: null }, { data: null, error: null }]) {
    assert.equal(await getAccountAccessStatus({ rpc: async () => result }), 'blocked');
  }
  assert.equal(await getAccountAccessStatus({ rpc: async () => { throw new Error('offline'); } }), 'blocked');
});
test('sessão tecnicamente autenticada pending/rejected nunca entra, mesmo com metadata de usuário forjada', async () => {
  for (const status of ['pending', 'rejected', 'blocked']) {
    let signedOut = 0;
    const client = { rpc: async () => ({ data: status, error: null }), auth: {
      signInWithPassword: async () => ({ data: { user: { id: userId, user_metadata: { account_status: 'approved' } } }, error: null }),
      signOut: async () => { signedOut++; }
    } };
    const action = loader({ '@/lib/supabase/server': { createClient: async () => client } })('src/lib/auth/actions.ts').loginAction;
    const result = await action({}, form({ email: 'maria@example.com', password: secret }));
    assert.match(result.error, status === 'pending' ? /está aguardando aprovação/ : status === 'rejected' ? /não foi aprovada/ : /confirmar a liberação/);
    assert.equal(signedOut, 1); assert.equal(JSON.stringify(result).includes(secret), false);
  }
});
test('Auth sem confirmação retorna mensagem pending/rejected via consulta Admin segura', async () => {
  for (const status of ['pending', 'rejected']) {
    const client = { auth: { signInWithPassword: async () => ({ data: { user: null }, error: { code: 'email_not_confirmed' } }) } };
    const admin = { rpc: async () => ({ data: userId, error: null }), auth: { admin: { getUserById: async () => ({ data: { user: { app_metadata: { account_status: status } } }, error: null }) } } };
    const action = loader({ '@/lib/supabase/server': { createClient: async () => client }, '@/lib/supabase/admin': { createAdminClient: () => admin } })('src/lib/auth/actions.ts').loginAction;
    assert.match((await action({}, form({ email: 'maria@example.com', password: secret }))).error, status === 'pending' ? /está aguardando aprovação/ : /não foi aprovada/);
  }
});
test('proxy bloqueia todas as áreas internas e preserva cookies sem criar loop no login', async () => {
  for (const status of ['pending', 'rejected', 'blocked', 'approved']) {
    const source = { cookies: { getAll: () => [{ name: 'session-cookie', value: 'test-only-session' }] } };
    const client = { rpc: async () => ({ data: status, error: null }) };
    const { proxy } = loader({
      '@/lib/supabase/middleware': { updateSession: async () => ({ response: source, supabase: client, user: { id: userId } }), hasOrganizationMembership: async () => false },
      'next/server': { NextResponse: { redirect: url => ({ url: String(url), cookies: { set() {} } }) } }
    })('src/proxy.ts');
    for (const route of ['/dashboard', '/clientes', '/manutencoes/nova', '/mensagens', '/saidas', '/relatorios/reposicao', '/configuracoes', '/onboarding/organizacao', '/admin/solicitacoes-conta']) {
      const nextUrl = new URL('https://app.example.com' + route); nextUrl.clone = () => new URL(nextUrl);
      const result = await proxy({ nextUrl, method: 'GET', headers: new Headers() });
      if (status === 'approved') assert.equal(result, source);
      else assert.equal(result.url, 'https://app.example.com/login?conta=' + status);
    }
    if (status !== 'approved') {
      for (const route of ['/login', '/criar-conta', '/criar-conta/aguardando']) {
        assert.equal(await proxy({ nextUrl: new URL('https://app.example.com' + route), method: 'GET', headers: new Headers() }), source);
      }
    }
  }
});
test('requireAuth bloqueia chamadas diretas de actions e onboarding antes do cliente privilegiado', async () => {
  for (const status of ['pending', 'rejected', 'blocked']) {
    const client = { rpc: async () => ({ data: status, error: null }), auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) } };
    const load = loader({
      '@/lib/supabase/server': { createClient: async () => client },
      '@/lib/supabase/admin': { createAdminClient() { assert.fail('Não deve criar organização'); } },
      'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } }
    });
    await assert.rejects(load('src/lib/auth/queries.ts').requireAuth(), new RegExp('REDIRECT:/login\\?conta=' + status));
    await assert.rejects(load('src/lib/organization/actions.ts').createInitialOrganization({}, form({ name: 'Teste', slug: 'teste' })), /REDIRECT:\/login/);
    await assert.rejects(load('src/lib/organization/queries.ts').requireOrganization(), /REDIRECT:\/login/);
  }
});
test('formulário tem toggle acessível, limpa DOM antes da chamada e elimina credenciais após erro', async () => {
  const refs = [];
  const load = loader({
    react: { useRef: () => { const ref = { current: { value: secret } }; refs.push(ref); return ref; }, useState: () => [false, () => {}], useActionState: (action, state) => [state, action, false] },
    '@/lib/account-requests/actions': { createAccountRequestAction: async (_state, data) => {
      assert.equal(data.get('password'), secret); assert.equal(data.get('confirm_password'), secret);
      assert.ok(refs.every(ref => ref.current.value === '')); return { error: 'Erro de teste' };
    } }
  });
  const element = load('src/app/(auth)/criar-conta/request-form.tsx').AccountRequestForm();
  const html = renderToStaticMarkup(element);
  assert.match(html, /aria-controls="request-password request-confirm-password"/); assert.match(html, /aria-pressed="false"/);
  assert.ok(html.indexOf('name="business_name"') < html.indexOf('name="password"')); assert.equal(html.includes(secret), false);
  const data = form(base); const result = await element.props.action({}, data);
  assert.ok(result.error); assert.equal(data.has('password'), false); assert.equal(data.has('confirm_password'), false); assert.equal(JSON.stringify(result).includes(secret), false);
});
test('logs de falhas e retorno da action nunca contêm senha ou FormData', async () => {
  const messages = []; const previous = console.error;
  try {
    console.error = (...args) => messages.push(args);
    const f = fixture({ insertError: true, deleteError: true });
    const result = await f.actions.createAccountRequestAction({}, form(base));
    const serialized = JSON.stringify({ messages, result });
    assert.equal(serialized.includes(secret), false); assert.doesNotMatch(serialized, /confirm_password|password_hash/);
    assert.match(serialized, /AUTH_CLEANUP_FAILED/); assert.match(serialized, new RegExp(userId));
  } finally { console.error = previous; }
});


test('piloto cadastra, aprova, rejeita e autentica sem variáveis Resend ou chamadas de e-mail', async () => {
  const names = ['RESEND_API_KEY', 'EMAIL_FROM', 'ACCOUNT_APPROVER_EMAIL'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = global.fetch;
  let outboundCalls = 0;
  try {
    names.forEach(name => { delete process.env[name]; });
    global.fetch = async () => { outboundCalls++; throw new Error('Nenhum serviço de e-mail deve ser chamado'); };
    const f = fixture();
    await assert.rejects(f.actions.createAccountRequestAction({}, form(base)), /REDIRECT:\/criar-conta\/aguardando/);
    assert.equal(f.state.creates, 1); assert.equal(f.state.rows[0].status, 'pending'); assert.equal(f.state.rows[0].auth_user_id, userId);
    assert.equal((await f.actions.createAccountRequestAction({}, form(base))).error, 'Já existe uma solicitação pendente para este e-mail.');
    const approval = await f.actions.approveAccountRequestAction({}, form({ id: requestId }));
    assert.match(approval.success, /Solicitação aprovada/); assert.doesNotMatch(approval.success, /enviado|aviso|reenvie/);
    assert.equal(f.state.rows[0].status, 'approved'); assert.equal(f.state.authUser.app_metadata.account_status, 'approved');
    assert.equal(f.state.rows[0].approval_email_sent_at, null); assert.equal(f.state.rows[0].invite_sent_at, null);
    assert.equal((await f.actions.createAccountRequestAction({}, form(base))).error, 'Este e-mail já possui acesso. Faça login.');

    let signedOut = 0;
    const session = {
      rpc: async () => ({ data: f.state.rows[0].status, error: null }),
      auth: {
        signInWithPassword: async credentials => { assert.equal(credentials.password, secret); return { data: { user: f.state.authUser }, error: null }; },
        signOut: async () => { signedOut++; }
      },
      from: () => ({ select() { return this; }, eq() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: null, error: null }) })
    };
    const login = loader({ '@/lib/supabase/server': { createClient: async () => session }, 'next/navigation': { redirect(url) { throw new Error('REDIRECT:' + url); } } })('src/lib/auth/actions.ts').loginAction;
    await assert.rejects(login({}, form({ email: 'maria@example.com', password: secret })), /REDIRECT:\/onboarding\/organizacao/);
    // Outra conta descartável, sem reutilizar ou rejeitar a conta aprovada.
    const rejected = fixture({ rows: [row()] });
    assert.ok((await rejected.actions.rejectAccountRequestAction({}, form({ id: requestId }))).success);
    assert.equal(rejected.state.rows[0].status, 'rejected'); assert.equal(rejected.state.authUser.app_metadata.account_status, 'rejected');
    session.rpc = async () => ({ data: rejected.state.rows[0].status, error: null });
    assert.equal((await login({}, form({ email: 'maria@example.com', password: secret }))).error, 'Sua solicitação de acesso não foi aprovada.');
    assert.equal(signedOut, 1); assert.equal(outboundCalls, 0);
  } finally {
    global.fetch = originalFetch;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  }
});

test('painel do platform admin lista pedidos nos três filtros sem indicadores ou reenvio de e-mail', async () => {
  for (const status of ['pending', 'approved', 'rejected']) {
    const client = { from(table) {
      assert.equal(table, 'account_requests');
      const query = { select() { return this; }, eq(key, value) { assert.equal(key, 'status'); assert.equal(value, status); return this; },
        order() { return this; }, range() { return this; }, returns: async () => ({ data: [{ ...row(), status }], count: 1, error: null }) };
      return query;
    } };
    const page = loader({
      '@/lib/auth/queries': { getCurrentUser: async () => ({ id: adminId }) },
      '@/lib/auth/platform-admin': { isPlatformAdmin: async () => true },
      '@/lib/supabase/server': { createClient: async () => client }, '@/lib/auth/actions': {},
      './review-form': { ReviewForm: () => React.createElement('form', {}, React.createElement('button', {}, 'Aprovar'), React.createElement('button', {}, 'Rejeitar')) },
      'next/link': ({ href, children }) => React.createElement('a', { href }, children)
    })('src/app/admin/solicitacoes-conta/page.tsx').default;
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ status }) }));
    assert.match(html, /Maria da Silva/); assert.match(html, /maria@example.com/); assert.match(html, /Pendentes/); assert.match(html, /Aprovadas/); assert.match(html, /Rejeitadas/);
    assert.doesNotMatch(html, /Aviso de aprovação|Envio pendente|Reenviar|Resend/);
    if (status === 'pending') { assert.match(html, /Aprovar/); assert.match(html, /Rejeitar/); }
    else assert.doesNotMatch(html, /<button[^>]*>Aprovar|<button[^>]*>Rejeitar/);
  }
});

test('tela de aguardando orienta contato e não promete envio de e-mail', () => {
  const page = loader({ 'next/link': ({ href, children }) => React.createElement('a', { href }, children) })('src/app/(auth)/criar-conta/aguardando/page.tsx').default;
  const html = renderToStaticMarkup(page());
  assert.match(html, /Sua conta está aguardando aprovação/); assert.match(html, /Entre em contato com o responsável pelo sistema/);
  assert.match(html, /e-mail e a senha cadastrados/); assert.doesNotMatch(html, /receberá|enviaremos|enviado por e-mail/i);
});
