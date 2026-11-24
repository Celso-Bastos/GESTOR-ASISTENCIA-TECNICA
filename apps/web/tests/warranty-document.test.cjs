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
const other = '10000000-0000-4000-8000-000000000002';
const previous = `${org}/warranty/20000000-0000-4000-8000-000000000001.pdf`;
const document = { path: previous, name: 'termo.pdf', updatedAt: '2026-11-23T15:00:00Z' };
const pdf = (name = 'Termo Garantia.pdf', content = '%PDF-1.7\nconteúdo', type = 'application/pdf') => new File([content], name, { type });
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (!/\.(ts|tsx)$/.test(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true
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
const staticBoundaries = {
  'next/link': ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
  react: { ...React, useActionState: () => [{}, () => {}, false] }
};
function fixture({ role = 'owner', current = document, currentError, uploadError, rpcError, rpcData = true, cleanupError } = {}) {
  const calls = [], revalidated = [];
  const bucket = {
    upload: async (...args) => { calls.push(['upload', ...args]); return { error: uploadError }; },
    remove: async paths => { calls.push(['remove', paths]); return { error: cleanupError, data: cleanupError ? null : paths.map(name => ({ name })) }; }
  };
  const client = {
    storage: { from: name => { assert.equal(name, 'organization-documents'); return bucket; } },
    rpc: async (...args) => { calls.push(['rpc', ...args]); return { data: rpcData, error: rpcError }; }
  };
  const load = loader({
    '@/lib/organization/queries': { requireOrganization: async () => ({ id: org, role }) },
    './queries': { requireOrganization: async () => ({ id: org, role }) },
    '@/lib/organization/warranty-document-queries': { getOrganizationWarrantyDocument: async () => ({ document: current, error: currentError }) },
    './warranty-document-queries': { getOrganizationWarrantyDocument: async () => ({ document: current, error: currentError }) },
    '@/lib/supabase/server': { createClient: async () => client },
    'next/cache': { revalidatePath: (...args) => revalidated.push(args) }
  });
  const action = load('src/lib/organization/warranty-document-actions.ts').uploadWarrantyDocumentAction;
  const submit = file => { const form = new FormData(); if (file) form.set('document', file); form.set('organization_id', other); form.set('path', 'forged'); return action({}, form); };
  return { submit, calls, revalidated };
}

test('upload valida MIME, extensão, tamanho e cabeçalho no servidor; nome é sanitizado', async () => {
  const { validateWarrantyDocument: validate, sanitizeWarrantyDocumentName: name, WARRANTY_DOCUMENT_MAX_BYTES: max } = loader()('src/lib/organization/warranty-document.ts');
  assert.equal(await validate(pdf()), null);
  for (const file of [pdf('a.docx'), pdf('a.pdf', '<html/>', 'text/html'), pdf('a.pdf', ''), pdf('a.pdf', '<html/>'), pdf('a.pdf', 'x'.repeat(max + 1))]) assert.ok(await validate(file));
  assert.equal(await validate(pdf('a.pdf', '%PDF-' + 'x'.repeat(max - 5))), null);
  assert.equal(name('../../Termo ç ação\r\n<script>.pdf'), 'Termo-c-acao-script.pdf');
  assert.equal(name('.pdf'), 'termo-de-garantia.pdf');
  assert.match(name('a'.repeat(500) + '.pdf'), /^[a-z]{100}\.pdf$/);
});

test('upload válido sem termo cria caminho da sessão e metadata; ignora organização/path do formulário', async () => {
  const f = fixture({ current: null });
  assert.match((await f.submit(pdf())).success, /atualizado/);
  assert.equal(f.calls[0][0], 'upload');
  assert.match(f.calls[0][1], new RegExp(`^${org}/warranty/[0-9a-f-]{36}\\.pdf$`));
  assert.deepEqual(f.calls[0][3], { contentType: 'application/pdf', upsert: false, cacheControl: '0' });
  const [method, rpc, args] = f.calls[1];
  assert.equal(method, 'rpc'); assert.equal(rpc, 'replace_organization_warranty_document');
  assert.deepEqual(args, { p_organization_id: org, p_expected_path: null, p_new_path: f.calls[0][1], p_name: 'Termo-Garantia.pdf' });
  assert.deepEqual(f.revalidated, [['/configuracoes'], ['/manutencoes/[id]', 'page']]);
});

test('employee, arquivo ausente/inválido e schema indisponível não fazem upload', async () => {
  for (const [opts, file] of [[{ role: 'employee' }, pdf()], [{}, null], [{}, pdf('a.exe')], [{ currentError: 'Schema indisponível' }, pdf()]]) {
    const f = fixture(opts); assert.ok((await f.submit(file)).error); assert.equal(f.calls.length, 0);
  }
});

test('substituição publica metadata antes da limpeza e não altera garantias históricas', async () => {
  const f = fixture(); assert.ok((await f.submit(pdf())).success);
  assert.deepEqual(f.calls.map(c => c[0]), ['upload', 'rpc', 'remove']);
  assert.equal(f.calls[1][2].p_expected_path, previous); assert.deepEqual(f.calls[2][1], [previous]);
  const failure = fixture({ uploadError: { message: 'Storage indisponível' } });
  assert.ok((await failure.submit(pdf())).error); assert.deepEqual(failure.calls.map(c => c[0]), ['upload', 'remove']);
  assert.deepEqual(failure.calls[1][1], [failure.calls[0][1]]);
});

test('conflito e falha de metadata limpam somente o novo upload sem invalidar páginas como sucesso', async () => {
  for (const opts of [{ rpcData: false }, { rpcError: { code: 'FAIL' } }, { rpcError: { code: 'FAIL' }, cleanupError: { code: 'FAIL' } }]) {
    const f = fixture(opts); const result = await f.submit(pdf());
    assert.ok(result.error); assert.equal(result.success, undefined);
    assert.deepEqual(f.calls.at(-1), ['remove', [f.calls[0][1]]]); assert.notEqual(f.calls[0][1], previous);
    assert.equal(f.revalidated.length, 0);
    if (opts.cleanupError) assert.ok(result.warning);
  }
  const f = fixture({ cleanupError: { code: 'FAIL' } });
  const result = await f.submit(pdf()); assert.ok(result.success); assert.ok(result.warning);
});

function queryFixture(row, error) {
  const calls = [];
  const query = new Proxy({}, { get(_, key) {
    if (key === 'maybeSingle') return async () => ({ data: row, error });
    return (...args) => { calls.push([key, ...args]); return query; };
  } });
  const load = loader({
    '@/lib/organization/queries': { requireOrganization: async () => ({ id: org }) },
    './queries': { requireOrganization: async () => ({ id: org }) },
    '@/lib/supabase/server': { createClient: async () => ({ from: table => { calls.push(['from', table]); return query; } }) }
  });
  return { query: load('src/lib/organization/warranty-document-queries.ts').getOrganizationWarrantyDocument, calls };
}
test('consulta diferencia organização sem termo de falha e recusa path de outra loja', async () => {
  const f = queryFixture({ warranty_document_path: null });
  assert.deepEqual(await f.query(), { document: null }); assert.ok(f.calls.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === org));
  for (const row of [null, { warranty_document_path: previous }, { warranty_document_path: previous.replace(org, other), warranty_document_name: 'a.pdf', warranty_document_updated_at: document.updatedAt }]) assert.ok((await queryFixture(row).query()).error);
  assert.ok((await queryFixture(null, { code: '42703' }).query()).error);
});

test('sessão expirada/sem aprovação interrompe upload e leitura antes do acesso ao Storage', async () => {
  const load = loader({
    '@/lib/organization/queries': { requireOrganization: async () => { throw new Error('REDIRECT:/login'); } },
    './queries': { requireOrganization: async () => { throw new Error('REDIRECT:/login'); } },
    '@/lib/supabase/server': { createClient: () => assert.fail('Não pode acessar Storage') }
  });
  await assert.rejects(load('src/lib/organization/warranty-document-queries.ts').getOrganizationWarrantyDocument(), /REDIRECT/);
  await assert.rejects(load('src/lib/organization/warranty-document-actions.ts').uploadWarrantyDocumentAction({}, new FormData()), /REDIRECT/);
});

test('Visualizar/Baixar assinam por 300 segundos; rota ignora IDs e paths externos', async () => {
  const calls = [];
  const load = loader({
    '@/lib/organization/warranty-document-queries': { getOrganizationWarrantyDocument: async () => ({ document }) },
    '@/lib/supabase/server': { createClient: async () => ({ storage: { from: bucket => {
      assert.equal(bucket, 'organization-documents'); return { createSignedUrl: async (...args) => { calls.push(args); return { data: { signedUrl: 'https://storage.example/signed' } }; } };
    } } }) }
  });
  const { GET } = load('src/app/api/organization/warranty-document/route.ts');
  for (const suffix of ['', '?download=1&organization_id=' + other + '&path=forged']) {
    const response = await GET(new Request('https://app.example/api/organization/warranty-document' + suffix));
    assert.equal(response.status, 302); assert.equal(response.headers.get('location'), 'https://storage.example/signed');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.deepEqual(calls, [[previous, 300, undefined], [previous, 300, { download: 'termo.pdf' }]]);
});

test('rota prepara PDF na mesma origem; sem termo, schema ou Storage retorna falha explícita', async () => {
  for (const [result, storageError, status] of [[{ document }, null, 200], [{ document: null }, null, 404], [{ document: null, error: 'Falha' }, null, 503], [{ document }, { code: 'FAIL' }, 503]]) {
    const load = loader({
      '@/lib/organization/warranty-document-queries': { getOrganizationWarrantyDocument: async () => result },
      '@/lib/supabase/server': { createClient: async () => ({ storage: { from: () => ({ download: async path => { assert.equal(path, previous); return { data: pdf(), error: storageError }; } }) } }) }
    });
    const response = await load('src/app/api/organization/warranty-document/route.ts').GET(new Request('https://app.example/api/organization/warranty-document?file=1'));
    assert.equal(response.status, status); assert.match(response.headers.get('cache-control'), /no-store/);
    if (status === 200) { assert.equal(response.headers.get('content-type'), 'application/pdf'); assert.match(await response.text(), /^%PDF-/); }
  }
});

test('mensagem usa primeiro nome, OS, aparelho e período; WhatsApp reutiliza telefone normalizado', () => {
  const { buildWarrantyDocumentMessage: message, warrantyDocumentWhatsAppUrl: url } = loader()('src/lib/maintenance/warranty-document-sharing.ts');
  const text = message({ customerName: 'João da Silva', orderNumber: '#0042', deviceModel: 'Galaxy A14', warrantyAmount: 3, warrantyUnit: 'months', imei: 'SEGREDO', internal_notes: 'INTERNO', password: 'SENHA' });
  assert.match(text, /Olá, João!/); assert.match(text, /#0042/); assert.match(text, /Galaxy A14/); assert.match(text, /3 meses/);
  assert.doesNotMatch(text, /Silva|SEGREDO|INTERNO|SENHA/);
  const link = new URL(url('11999998888', text)); assert.equal(link.pathname, '/5511999998888'); assert.equal(link.searchParams.get('text'), text);
  assert.equal(url(null, text), null); assert.equal(url('', text), null); assert.match(message({}), /^Olá!/);
});

test('Web Share verifica share e canShare; exceções e suporte parcial usam fallback', () => {
  const { canShareWarrantyFile: canShare } = loader()('src/lib/maintenance/warranty-document-sharing.ts');
  for (const nav of [{}, { share() {} }, { canShare: () => true }, { share() {}, canShare: () => false }, { share() {}, canShare() { throw new Error('unsupported'); } }]) assert.equal(canShare(nav, pdf()), false);
  assert.equal(canShare({ share() {}, canShare: data => data.files.length === 1 }, pdf()), true);
});

test('preparo de arquivo detecta sessão expirada e falha; usa nome atual retornado pelo servidor', async () => {
  const { prepareWarrantyShareFile: prepare } = loader()('src/lib/maintenance/warranty-document-sharing.ts');
  const file = await prepare('old.pdf', async (url, opts) => {
    assert.equal(url, '/api/organization/warranty-document?file=1'); assert.equal(opts.cache, 'no-store');
    return new Response(pdf(), { headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="novo.pdf"' } });
  });
  assert.equal(file.name, 'novo.pdf'); assert.equal(file.type, 'application/pdf');
  for (const response of [new Response('login', { headers: { 'content-type': 'text/html' } }), new Response('{}', { status: 503 }), new Response('', { headers: { 'content-type': 'application/pdf' } })]) await assert.rejects(prepare('a.pdf', async () => response));
});

test('OS com garantia permite compartilhar antes da assinatura; sem garantia não consulta nem exibe documento', async () => {
  let reads = 0;
  const controls = props => React.createElement('div', { 'data-controls': true, 'data-phone': props.phone }, props.message);
  const load = loader({ ...staticBoundaries,
    '@/lib/organization/warranty-document-queries': { getOrganizationWarrantyDocument: async () => { reads++; return { document }; } },
    './warranty-document-controls': { WarrantyDocumentControls: controls }
  });
  const { MaintenanceWarrantyDocument: Block } = load('src/components/maintenance-warranty-document.tsx');
  const props = { order: { warranty_enabled: false, warranty_signed: false, order_number: '#0042', warranty_amount: 3, warranty_unit: 'months' }, role: 'employee', customer: null, deviceModel: 'A14' };
  assert.equal(await Block(props), null); assert.equal(reads, 0);
  const html = renderToStaticMarkup(await Block({ ...props, order: { ...props.order, warranty_enabled: true } }));
  assert.match(html, /Termo físico assinado: Não/); assert.match(html, /data-controls/); assert.match(html, /#0042/); assert.doesNotMatch(html, /Configurar termo/);
});

test('sem documento/falha de consulta OS continua disponível; configurar só para owner/admin', async () => {
  for (const role of ['owner', 'admin', 'employee']) for (const error of [undefined, 'Falha de consulta']) {
    const load = loader({ ...staticBoundaries, '@/lib/organization/warranty-document-queries': { getOrganizationWarrantyDocument: async () => ({ document: null, error }) } });
    const { MaintenanceWarrantyDocument: Block } = load('src/components/maintenance-warranty-document.tsx');
    const html = renderToStaticMarkup(await Block({ order: { warranty_enabled: true, warranty_signed: true }, role, customer: null, deviceModel: null }));
    assert.match(html, error ? /Falha de consulta/ : /Nenhum termo de garantia configurado para esta loja/);
    assert.equal(html.includes('Configurar termo'), role !== 'employee');
    assert.doesNotMatch(html, /Compartilhar termo/);
  }
});

test('controles usam nova aba segura, download e layout empilhado sem largura fixa', () => {
  const load = loader(staticBoundaries);
  const { WarrantyDocumentControls: Controls } = load('src/components/warranty-document-controls.tsx');
  const html = renderToStaticMarkup(React.createElement(Controls, { name: 'a.pdf', message: 'Olá' }));
  for (const label of ['Visualizar termo', 'Baixar termo', 'Compartilhar termo']) assert.ok(html.includes(label));
  assert.match(html, /target="_blank" rel="noopener noreferrer"/); assert.match(html, /\?download=1/);
  assert.match(html, /grid min-w-0 gap-2 sm:flex/); assert.doesNotMatch(html, /(?:^|\s)w-[1-9]\d*|min-w-\[/);
});

function nodes(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}
function controlFixture(nav) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: nav });
  const states = []; let index = 0, downloads = 0, prepares = 0;
  const file = pdf();
  const helpers = loader()('src/lib/maintenance/warranty-document-sharing.ts');
  const load = loader({
    react: { useState(initial) { const slot = index++; if (!(slot in states)) states[slot] = initial; return [states[slot], value => { states[slot] = value; }]; } },
    '@/lib/maintenance/warranty-document-sharing': { ...helpers,
      prepareWarrantyShareFile: async () => { prepares++; return file; },
      downloadPreparedWarrantyFile: value => { assert.equal(value, file); downloads++; }
    }
  });
  const { WarrantyDocumentControls: Controls } = load('src/components/warranty-document-controls.tsx');
  return {
    render(phone = null) { index = 0; return Controls({ name: 'a.pdf', message: 'Olá, João!', phone }); },
    click(element, label) { const button = nodes(element).find(node => node.type === 'button' && node.props.children === label); assert.ok(button, label); return button.props.onClick(); },
    get downloads() { return downloads; }, get prepares() { return prepares; },
    restore() { if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator; }
  };
}

test('Web Share prepara primeiro e só chama share no clique explícito; cancelamento permite tentar novamente', async () => {
  let shared = 0;
  const f = controlFixture({ canShare: () => true, share: async data => {
    shared++; assert.equal(data.files.length, 1); assert.equal(data.text, 'Olá, João!');
    if (shared === 1) throw new DOMException('Cancelado', 'AbortError');
  } });
  try {
    let element = f.render(); assert.equal(f.prepares, 0); assert.equal(shared, 0);
    await f.click(element, 'Compartilhar termo'); element = f.render();
    assert.equal(f.prepares, 1); assert.equal(shared, 0); assert.equal(f.downloads, 0);
    await f.click(element, 'Escolher aplicativo'); element = f.render();
    assert.match(renderToStaticMarkup(element), /cancelado/); assert.equal(f.downloads, 0);
    await f.click(element, 'Escolher aplicativo'); assert.equal(shared, 2);
    assert.match(renderToStaticMarkup(f.render()), /Confira o envio/);
  } finally { f.restore(); }
});

test('sem Web Share baixa PDF e oferece WhatsApp correto; sem telefone mantém alternativas amigáveis', async () => {
  for (const phone of [null, '5511999998888']) {
    const f = controlFixture({});
    try {
      await f.click(f.render(phone), 'Compartilhar termo');
      const html = renderToStaticMarkup(f.render(phone)); assert.equal(f.downloads, 1);
      assert.match(html, /anexe o PDF baixado/); assert.match(html, /não é anexado automaticamente/);
      if (phone) { assert.match(html, /Abrir WhatsApp/); assert.match(html, /wa.me\/5511999998888/); }
      else { assert.match(html, /Cliente sem telefone cadastrado/); assert.doesNotMatch(html, /wa.me/); }
      assert.match(html, /Visualizar termo/); assert.match(html, /Baixar termo/);
    } finally { f.restore(); }
  }
});

test('falha do compartilhamento nativo oferece download e anexo manual', async () => {
  const f = controlFixture({ canShare: () => true, share: async () => { throw new DOMException('Bloqueado', 'NotAllowedError'); } });
  try {
    await f.click(f.render(), 'Compartilhar termo'); await f.click(f.render(), 'Escolher aplicativo');
    assert.equal(f.downloads, 1); assert.match(renderToStaticMarkup(f.render()), /anexe o PDF/);
  } finally { f.restore(); }
});

test('Configurações mostra documento/estado vazio; formulário de substituição segue owner/admin', async () => {
  for (const role of ['owner', 'admin', 'employee']) for (const current of [null, document]) {
    const load = loader({ ...staticBoundaries,
      '@/lib/organization/queries': { requireOrganization: async () => ({ id: org, name: 'Loja', role }) },
      '@/lib/organization/warranty-document-queries': { getOrganizationWarrantyDocument: async () => ({ document: current }) },
      '@/components/warranty-document-controls': { WarrantyDocumentControls: () => React.createElement('p', null, 'Controles do PDF') },
      './warranty-document-form': { WarrantyDocumentForm: ({ hasDocument }) => React.createElement('p', null, hasDocument ? 'Substituir documento' : 'Adicionar documento') },
      './service-city-form': { ServiceCityForm: () => null }, './site-form': { OrganizationSiteForm: () => null }
    });
    const html = renderToStaticMarkup(await load('src/app/(dashboard)/configuracoes/page.tsx').default());
    assert.match(html, /Termo de garantia/);
    assert.match(html, current ? /termo.pdf/ : /Nenhum termo de garantia configurado/);
    assert.equal(html.includes(current ? 'Substituir documento' : 'Adicionar documento'), role !== 'employee');
  }
});
