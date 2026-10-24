// Run with: node tests/task-allocation.browser.mjs
// Exercises the real pages and CRM transport against an isolated API stub.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const executablePath = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find(existsSync);
assert.ok(executablePath, 'Set CHROME_PATH to a Chromium browser executable.');

const employee = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Employee', department: 'Sales' };
const existingId = '22222222-2222-4222-8222-222222222222';
const createdId = '33333333-3333-4333-8333-333333333333';
let records = [{ id: existingId, title: 'Previously saved task', assignee: employee.name, assigneeId: employee.id, assignedBy: 'Test Manager', department: 'Sales', status: 'Pending', priority: 'Medium', audit: [] }];
const writes = [];
let rejectCreate = false;
let releaseCreate;
const createGate = new Promise((resolve) => { releaseCreate = resolve; });
const errors = [];

const entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { BrowserRouter, Routes, Route } from 'react-router-dom';
  import List from '/src/features/crm/tasks/allocation/TaskAllocationPage.jsx';
  import Detail from '/src/features/crm/tasks/allocation/TaskAllocationDetailPage.jsx';
  localStorage.setItem('auth_token', 'allocation-test-token');
  createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter, null,
    React.createElement(Routes, null,
      React.createElement(Route, {path:'/crm/tasks/allocation', element:React.createElement(List)}),
      React.createElement(Route, {path:'/crm/tasks/allocation/:id', element:React.createElement(Detail)})
    )));
`;
const html = '<div id="root"></div><script type="module" src="/__allocation-test-entry.jsx"></script>';

const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'allocation-test-harness',
    resolveId(id) {
      if (id === '/__allocation-test-entry.jsx') return '\0allocation-test-entry.jsx';
    },
    load(id) {
      if (id === '\0allocation-test-entry.jsx') return entry;
    },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/crm/tasks/allocation')) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml(req.url, html));
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return request.continue();
    const method = request.method();
    let body = { results: [] };
    let status = 200;
    if (url.pathname.endsWith('/team-roster/')) body = { roster: { Sales: [employee] } };
    if (url.pathname.includes('/task-allocations/')) {
      if (method === 'GET') {
        await new Promise((resolve) => setTimeout(resolve, 150));
        body = { results: records };
      } else {
        const payload = request.postData() ? JSON.parse(request.postData()) : null;
        writes.push({ method, payload, path: url.pathname });
        if (method === 'POST') {
          if (rejectCreate) {
            status = 400;
            body = { message: 'Allocation rejected by test server' };
          } else if (!payload.title || payload.assigneeId !== employee.id) {
            status = 400;
            body = { message: 'Title and employee ID are required' };
          } else {
            await createGate;
            body = { ...payload, id: createdId, assignee: employee.name, assignedBy: 'Test Manager', audit: [] };
            records = [body, ...records];
            status = 201;
          }
        } else if (method === 'PATCH') {
          body = { ...records.find((r) => url.pathname.includes(r.id)), ...payload };
          records = records.map((r) => r.id === body.id ? body : r);
        }
      }
    }
    await request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });

  async function clickText(text) {
    await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === label && !b.disabled), {}, text);
    await page.evaluate((label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label && !b.disabled).click(), text);
  }
  async function waitText(text) {
    await page.waitForFunction((value) => document.body.textContent.includes(value), {}, text);
  }
  async function fillTask(title) {
    await clickText('Assign Task');
    await page.waitForSelector('[role="dialog"]');
    await page.type('[role="dialog"] input', title);
    const selects = await page.$$('[role="dialog"] select');
    await selects[1].select(employee.id);
    await selects[2].select('High');
    await page.type('[role="dialog"] textarea', 'Regression test description');
  }

  // A cold direct link must subscribe to hydration and open a saved task.
  await page.goto(`${base}/crm/tasks/allocation/${existingId}`);
  await waitText('Previously saved task');
  await clickText('Back');
  await waitText('Previously saved task');
  assert.equal(writes.length, 0, 'Opening pages must not create/update/delete allocations');

  await fillTask('New allocated task');
  await page.click('[role="dialog"] button[type="submit"]');
  await waitText('Saving...');
  assert.equal(await page.$eval('[role="dialog"] fieldset', (el) => el.disabled), true);
  await page.waitForFunction(() => [...document.querySelectorAll('tbody tr')].some((row) => row.textContent.includes('New allocated task')));
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('tbody tr')].find((row) => row.textContent.includes('New allocated task')).querySelector('button').disabled), true);
  releaseCreate();
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  assert.equal(writes[0].payload.title, 'New allocated task');
  assert.equal(writes[0].payload.assigneeId, employee.id);
  assert.equal(writes[0].payload.priority, 'High');
  assert.equal(writes[0].payload.description, 'Regression test description');
  assert.equal(writes[0].payload.deadline, null);
  await page.evaluate(() => [...document.querySelectorAll('tbody tr')].find((row) => row.textContent.includes('New allocated task')).querySelector('button').click());
  await page.waitForFunction((id) => location.pathname.endsWith(id), {}, createdId);
  await waitText('New allocated task');
  await page.reload();
  await waitText('New allocated task');
  assert.equal((await page.content()).includes('Task not found'), false);

  await page.select('select', 'Completed');
  await clickText('Save');
  await page.waitForFunction(() => [...document.querySelectorAll('p')].some((el) => el.textContent === 'Completed') && [...document.querySelectorAll('button')].some((el) => el.textContent.trim() === 'Edit' && !el.disabled));
  assert.equal(records.find((r) => r.id === createdId).status, 'Completed');
  await clickText('Edit');
  await page.waitForSelector('[role="dialog"]');
  assert.equal(await page.$eval('[role="dialog"] input', (el) => el.value), 'New allocated task');
  await clickText('Cancel');
  await clickText('Back');
  await waitText('Previously saved task');

  rejectCreate = true;
  await fillTask('Rejected task');
  await page.click('[role="dialog"] button[type="submit"]');
  await page.waitForSelector('[role="dialog"] [role="alert"]');
  assert.match(await page.$eval('[role="dialog"] [role="alert"]', (el) => el.textContent), /Allocation rejected/);
  assert.equal(await page.$eval('[role="dialog"] input', (el) => el.value), 'Rejected task');
  assert.equal(await page.evaluate(() => document.querySelector('tbody').textContent.includes('Rejected task')), false);
  assert.equal(writes.filter((w) => w.method === 'POST').length, 2, 'Only one request per submission');
  assert.equal(writes.some((w) => w.method === 'DELETE'), false, 'Navigation must never delete saved tasks');
  assert.deepEqual(errors, []);
  console.log('PASS: hydration, create payload, pending state, server-ID navigation, reload, status save, edit initialization, failure feedback and rollback.');
} finally {
  releaseCreate();
  await browser?.close();
  await server.close();
}
