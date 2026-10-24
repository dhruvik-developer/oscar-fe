// Fills every Textile Masters form in a real browser, captures the request
// body each Save sends, and checks backend field errors reach the modal.
// Captured bodies are written to TEXTILE_PAYLOADS_OUT (if set) so they can be
// validated against the Django serializers.
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find(existsSync);
assert.ok(executablePath, 'A Chromium browser is required.');

const PROCESSOR = { id: '11111111-1111-4111-8111-000000000001', name: 'Dyning', code: 'DYE-001' };
const PROCESS = { id: '22222222-2222-4222-8222-000000000001', name: 'Dyeing', code: 'PRC-01' };
const QUALITY = { id: '33333333-3333-4333-8333-000000000001', name: 'dfdf' };
const LISTS = {
  '/masters/parties/processors/': [],
  '/masters/processes/': [],
  '/masters/defects/': [{ id: 'd1', code: 'DEF-HOLE', name: 'Hole', category: 'hole', severity: 'Major' }],
};
const AUX = {
  '/masters/parties/processors/': [PROCESSOR],
  '/masters/processes/': [PROCESS],
  '/inventory/fabric-qualities/': [QUALITY],
};

const entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { BrowserRouter } from 'react-router-dom';
  import '/src/styles/globals.css';
  import TextileMastersPage from '/src/features/masters/TextileMastersPage.jsx';
  localStorage.setItem('auth_token', 'textile-test-token');
  createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter, null, React.createElement(TextileMastersPage)));
`;
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '127.0.0.1', port: 43825, open: false },
  logLevel: 'error',
  plugins: [{
    name: 'textile-test',
    enforce: 'pre',
    resolveId(id) {
      // MasterSourceLink only needs refreshFromBackend from the ERP context.
      if (id.endsWith('/context/ERPContext')) return '\0textile-test-context';
      if (id === '/__textile-test.jsx') return '\0textile-test.jsx';
    },
    load(id) {
      if (id === '\0textile-test-context') return 'export const useERP = () => ({ refreshFromBackend: async () => {} });';
      if (id === '\0textile-test.jsx') return entry;
    },
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (!request.url.startsWith('/inventory/masters/textile')) return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml(request.url, '<div id="root"></div><script type="module" src="/__textile-test.jsx"></script>'));
      });
    },
  }],
});

const writes = [];
const errors = [];
let failNextWrite = null;
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => { errors.push(`unexpected dialog: ${d.message()}`); d.dismiss(); });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return request.continue();
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const reply = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'GET') {
      // Aux dropdown lists are fetched from the same endpoints as tab lists.
      const referer = request.headers().referer || '';
      const tab = new URL(referer || 'http://x/').searchParams.get('tab');
      if (path in AUX && tab === 'jobwork-rates') return reply(AUX[path]);
      return reply(LISTS[path] ?? []);
    }
    const payload = JSON.parse(request.postData() || '{}');
    if (failNextWrite) {
      const body = failNextWrite;
      failNextWrite = null;
      return reply(body, 400);
    }
    writes.push({ method: request.method(), path, payload });
    return reply({ id: 'new', ...payload }, 201);
  });

  const base = `http://127.0.0.1:${server.httpServer.address().port}/inventory/masters/textile`;
  const waitText = (t) => page.waitForFunction((v) => document.body.innerText.includes(v), { timeout: 8000 }, t);
  const click = (text) => page.evaluate((v) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(v));
    if (!b) throw new Error(`Button not found: ${v}`);
    b.click();
  }, text);
  // Set a form control by its <label> text (React-safe native setter).
  const fill = (label, value) => page.evaluate((lab, val) => {
    const labels = [...document.querySelectorAll('form label')];
    const text = (x) => x.textContent.trim().replace(/\s*\*$/, '');
    const l = labels.find((x) => text(x) === lab) || labels.find((x) => text(x).startsWith(lab));
    if (!l) throw new Error(`Label not found: ${lab}`);
    const scope = l.closest('div.grid > div, form > div, div') || l.parentElement;
    let el = scope.querySelector('input, select, textarea');
    if (!el) el = l.parentElement.parentElement.querySelector('input, select, textarea');
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }, label, value);
  const save = async () => {
    const before = writes.length;
    await click('Save Record');
    await page.waitForFunction((n) => window.__writes >= n || true, {}, before);
    await new Promise((r) => setTimeout(r, 400));
    return writes.slice(before);
  };

  const FORMS = {
    agencies: async () => { await fill('Code', 'AG-01'); await fill('Name', 'Surat Weavers'); },
    processors: async () => { await fill('Name', 'Dyning Mill'); await fill('Address', 'Ring Road'); await fill('City', 'Surat'); await fill('Agreed Terms', '30 days'); },
    brokers: async () => { await fill('Code', 'BR-01'); await fill('Name', 'Mehta'); await fill('Commission Type', 'per_taka'); await fill('Default Commission Value', '2'); },
    processes: async () => { await fill('Code', 'PRC-X'); await fill('Name', 'Jet Dyeing'); await fill('Process Type', 'Dyeing'); await fill('Expected Loss %', ''); },
    'jobwork-rates': async () => {
      await page.waitForFunction(() => document.querySelectorAll('form select option').length > 3);
      await fill('Processor', PROCESSOR.id); await fill('Process', PROCESS.id); await fill('Fabric Quality', QUALITY.id); await fill('Rate', '12');
    },
    defects: async () => { await fill('Code', 'DEF-X'); await fill('Name', 'Slub'); await fill('Category', 'weaving defect'); await fill('Severity', 'Critical'); },
    'loss-reasons': async () => { await fill('Code', 'LR-X'); await fill('Name', 'Edge cut'); },
    'return-reasons': async () => { await fill('Code', 'RR-X'); await fill('Name', 'Late delivery'); },
    transporters: async () => { await fill('Name', 'VRL'); },
    vehicles: async () => { await fill('Vehicle Number', 'GJ05AB1234'); },
    drivers: async () => { await fill('Driver Name', 'Ramesh'); await fill('Mobile Number', '9876543210'); },
    'rate-masters': async () => { await fill('Standard Rate', '150'); },
  };

  const captured = {};
  for (const [tab, fillForm] of Object.entries(FORMS)) {
    await page.goto(`${base}?tab=${tab}`);
    await page.waitForFunction(() => !document.body.innerText.includes('Loading'), { timeout: 8000 });
    await click('Add ');
    await page.waitForSelector('form', { timeout: 5000 }).catch((e) => {
      throw new Error(`${tab}: form did not open (${errors.join(' | ') || e.message})`);
    });
    await fillForm();
    const sent = await save();
    assert.equal(sent.length, 1, `${tab}: expected one write, got ${sent.length}`);
    captured[tab] = sent[0];
    assert.equal(await page.$('form') === null, true, `${tab}: modal should close after a successful save`);
    console.log(`✓ ${tab.padEnd(15)} ${sent[0].method} ${sent[0].path}`);
  }

  // Button labels use the singular names now.
  await page.goto(`${base}?tab=agencies`);
  await waitText('Add Agency');
  await page.goto(`${base}?tab=defects`);
  await waitText('Add Defect');
  console.log('✓ singular "Add …" labels');

  // Job-work form carries no code/name; empty Effective To goes as null.
  const jw = captured['jobwork-rates'].payload;
  assert.ok(!('code' in jw) && !('name' in jw), 'job-work rate sends no code/name');
  assert.equal(jw.effectiveTo, null);
  assert.match(jw.effectiveFrom, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(captured['rate-masters'].payload.validTo, null);
  assert.equal(captured.defects.payload.severity, 'Critical');
  assert.ok(!('expectedLossPct' in captured.processes.payload), 'blank loss % falls back to default');
  assert.ok(!('defaultRate' in captured.agencies.payload), 'blank agency rate falls back to default');
  const proc = captured.processors.payload;
  assert.equal(captured.processors.path, '/masters/parties/');
  assert.deepEqual(proc.billingAddress, { line1: 'Ring Road', city: 'Surat', state: '', pincode: '' });
  assert.equal(proc.paymentTerms, '30 days');
  assert.equal(proc.status, 'Active');
  assert.equal(proc.type, 'Processor');
  assert.ok(!('code' in proc), 'blank processor code is left to the server');
  console.log('✓ payload shapes match the backend serializers');

  // A backend 400 must show its field message inside the modal (no alert).
  await page.goto(`${base}?tab=jobwork-rates`);
  await click('Add ');
  await page.waitForSelector('form');
  await FORMS['jobwork-rates']();
  failNextWrite = { message: 'Some fields need attention.', code: 'VALIDATION_FAILED', field_errors: { effective_to: ['Date has wrong format.'] } };
  await click('Save Record');
  await waitText('Date has wrong format.');
  assert.ok(await page.$('form'), 'modal stays open on a validation error');
  console.log('✓ backend field errors are shown in the form');

  // "Load Standard List" adds only what is missing (Hole already exists).
  writes.length = 0;
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => d.accept());
  await page.goto(`${base}?tab=defects`);
  await waitText('Hole');
  await click('Load Standard List');
  await page.waitForFunction(() => !document.body.innerText.includes('Adding…'), { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 300));
  const names = writes.map((w) => w.payload.name);
  assert.ok(!names.includes('Hole'), 'existing defect not duplicated');
  assert.deepEqual(names, ['Shade Variation', 'Stain', 'Printing Defect', 'Finish Quality']);
  assert.ok(writes.every((w) => ['Minor', 'Major', 'Critical'].includes(w.payload.severity)));
  console.log(`✓ standard defect list adds ${names.length} missing rows`);
  captured.standardDefect = writes[0];

  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  console.log('✓ no runtime errors or stray alerts');
  if (process.env.TEXTILE_PAYLOADS_OUT) writeFileSync(process.env.TEXTILE_PAYLOADS_OUT, JSON.stringify(captured, null, 2));
  console.log('\nAll Textile Masters checks passed.');
} finally {
  await browser?.close();
  await server.close();
}
