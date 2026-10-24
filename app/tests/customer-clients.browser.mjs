import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find(existsSync);
assert.ok(executablePath, 'A Chromium browser is required.');
const records = Array.from({ length: 201 }, (_, index) => ({
  id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
  name: `Customer ${String(index + 1).padStart(3, '0')}`,
  code: `CUST-${index + 1}`,
  type: index === 200 ? 'Both' : 'Customer',
  status: 'Active',
  email: index === 200 ? null : 'customer@example.com',
  phone: '+91 9876543210',
  billingAddress: { city: 'Surat', state: 'Gujarat', postalCode: '395001' },
  deals: 0,
  projects: 0,
}));
const reads = [];
const writes = [];
const errors = [];
let rejectRead = false;
let rejectWrite = false;
const entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { BrowserRouter } from 'react-router-dom';
  import ClientsPage from '/src/features/administration/ClientsPage.jsx';
  localStorage.setItem('auth_token', 'customer-client-test-token');
  createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter, null, React.createElement(ClientsPage)));
`;
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '127.0.0.1', port: 43821, open: false },
  plugins: [{
    name: 'customer-client-test',
    enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('/context/ERPContext')) return '\0client-test-context';
      if (id === '/__client-test.jsx') return '\0client-test.jsx';
    },
    load(id) {
      if (id === '\0client-test-context') return 'export const useERP = () => ({ refreshFromBackend: async () => {} });';
      if (id === '\0client-test.jsx') return entry;
    },
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (!request.url.startsWith('/administration/clients')) return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml(request.url, '<div id="root"></div><script type="module" src="/__client-test.jsx"></script>'));
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return request.continue();
    assert.ok(url.pathname.startsWith('/api/v1/admin/customer-clients/'), `Unexpected endpoint: ${url.pathname}`);
    const reply = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'GET') {
      if (rejectRead) return reply({ message: 'Client service unavailable' }, 503);
      const number = Number(url.searchParams.get('page'));
      reads.push(number);
      const offset = (number - 1) * 200;
      return reply({ count: records.length, results: records.slice(offset, offset + 200), next: offset + 200 < records.length ? '?page=2' : null });
    }
    const payload = JSON.parse(request.postData() || '{}');
    writes.push({ method: request.method(), path: url.pathname, payload });
    if (rejectWrite) return reply({ message: 'Client update rejected' }, 400);
    if (request.method() === 'PATCH') {
      const record = records.find((row) => url.pathname.includes(row.id));
      Object.assign(record, payload);
      return reply(record);
    }
    if (request.method() === 'POST') {
      const record = { ...records[0], ...payload, id: '22222222-2222-4222-8222-222222222222', code: 'CUST-NEW' };
      records.push(record);
      return reply(record, 201);
    }
    return reply({});
  });
  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${address.port}/administration/clients`;
  const waitText = (text) => page.waitForFunction((value) => document.body.innerText.includes(value), {}, text);
  const clickText = (text) => page.evaluate((value) => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === value);
    if (!button) throw new Error(`Button not found: ${value}`);
    button.click();
  }, text);
  const fill = async (selector, value) => {
    const input = await page.$(selector);
    await input.click({ clickCount: 3 });
    await input.press('Backspace');
    if (value) await input.type(value);
  };
  await page.goto(url);
  await waitText('Showing 1 to 12 of 201 clients');
  assert.ok(reads.includes(1) && reads.includes(2));
  assert.equal(await page.evaluate(() => document.body.innerText.includes('Default Tenant')), false);
  await fill('input[placeholder^="Search clients"]', 'CUST-201');
  await waitText('Customer 201');
  await clickText('Edit');
  assert.equal(await page.$eval('form input[type="tel"]', (input) => input.value), '+91 9876543210');
  await fill('form input[type="text"]', 'Updated Customer');
  await clickText('Save Client');
  await waitText('Updated Customer');
  assert.equal(writes[0].method, 'PATCH');
  assert.equal(writes[0].payload.email, '');
  assert.equal(writes[0].payload.billingAddress.postalCode, '395001');
  assert.equal(records[200].type, 'Both');
  rejectWrite = true;
  await clickText('Edit');
  await fill('form input[type="text"]', 'Rejected Name');
  await clickText('Save Client');
  await waitText('Client update rejected');
  assert.equal(records[200].name, 'Updated Customer');
  await clickText('Cancel');
  rejectWrite = false;
  await clickText('Create New Client');
  await fill('form input[type="text"]', 'New Client');
  await clickText('Save Client');
  await page.waitForFunction(() => !document.querySelector('form'));
  assert.equal(writes.at(-1).method, 'POST');
  assert.equal(records.at(-1).name, 'New Client');
  await page.reload();
  await waitText('Showing 1 to 12 of 202 clients');
  await fill('input[placeholder^="Search clients"]', 'CUST-201');
  await waitText('Updated Customer');
  rejectRead = true;
  await page.reload();
  await waitText('Unable to load clients: Client service unavailable');
  assert.deepEqual(errors, []);
  console.log('Customer client browser checks passed: pagination, display, shared edits, create, reload, and failure handling.');
} finally {
  await browser?.close();
  await server.close();
}
