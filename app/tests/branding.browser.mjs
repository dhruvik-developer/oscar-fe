import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find(existsSync);
assert.ok(executablePath, 'A Chromium browser is required.');

// ── Test logos ───────────────────────────────────────────────
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
/** 80×80 RGBA PNG: `fg` square in the middle, `bg` around it. */
function png(fg, bg) {
  const size = 80;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const inside = x >= 12 && x < 68 && y >= 12 && y < 68;
      row.push(...(inside ? fg : bg));
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const dir = mkdtempSync(join(tmpdir(), 'branding-test-'));
const files = {
  red: join(dir, 'red.png'),
  grey: join(dir, 'grey.png'),
  blue: join(dir, 'blue.svg'),
  text: join(dir, 'notes.txt'),
};
writeFileSync(files.red, png([225, 29, 72, 255], [255, 255, 255, 255]));
writeFileSync(files.grey, png([90, 90, 90, 255], [0, 0, 0, 0]));
writeFileSync(files.blue, "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><rect width='120' height='60' fill='#ffffff'/><circle cx='60' cy='30' r='26' fill='#2563eb'/></svg>");
writeFileSync(files.text, 'not an image');

// ── Harness: login page + branding card on one screen ───────
const entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { BrowserRouter } from 'react-router-dom';
  import '/src/styles/globals.css';
  import LoginPage from '/src/features/auth/LoginPage.jsx';
  import BrandingSettingsCard from '/src/features/settings/BrandingSettingsCard.jsx';
  import BrandLogo from '/src/components/common/BrandLogo.jsx';
  createRoot(document.getElementById('root')).render(
    React.createElement(BrowserRouter, null,
      React.createElement('div', { id: 'sidebar-logo', className: 'brand-logo' }, React.createElement(BrandLogo, { size: 28 })),
      React.createElement('div', { id: 'card' }, React.createElement(BrandingSettingsCard, { isAdmin: true })),
      React.createElement('div', { id: 'login' }, React.createElement(LoginPage)),
    ),
  );
`;
const html = `<!doctype html><html data-theme="oscar"><head>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>∞</text></svg>" />
  </head><body><div id="root"></div><script type="module" src="/__branding-test.jsx"></script></body></html>`;

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '127.0.0.1', port: 43822, open: false },
  logLevel: 'error',
  plugins: [{
    name: 'branding-test',
    enforce: 'pre',
    resolveId(id) {
      if (id === '/__branding-test.jsx') return '\0branding-test.jsx';
    },
    load(id) {
      if (id === '\0branding-test.jsx') return entry;
    },
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (!request.url.startsWith('/branding-test')) return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml(request.url, html));
      });
    },
  }],
});

const errors = [];
const apiCalls = [];
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      apiCalls.push(`${request.method()} ${url.pathname}`);
      return request.respond({ status: 401, contentType: 'application/json', body: '{}' });
    }
    return request.continue();
  });

  const url = `http://127.0.0.1:${server.httpServer.address().port}/branding-test`;
  // The button has a 150ms colour transition — let it settle before reading.
  const submitBg = async () => {
    await new Promise((r) => setTimeout(r, 400));
    return page.$eval('#login button[type="submit"]', (b) => getComputedStyle(b).backgroundColor);
  };
  const rootVar = (name) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name);
  const colorText = () => page.$eval('#card input[placeholder="Default theme"]', (i) => i.value);
  const logoCount = () => page.$$eval('img[alt="Company logo"]', (els) => els.length);
  const favicon = () => page.$eval("link[rel='icon']", (l) => l.href);
  const clickText = (text) => page.evaluate((value) => {
    const button = [...document.querySelectorAll('#card button')].find((b) => b.textContent.trim().includes(value));
    if (!button) throw new Error(`Button not found: ${value}`);
    button.click();
  }, text);
  const upload = async (path) => {
    const input = await page.$('#card input[type="file"]');
    await input.uploadFile(path);
    await input.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
  };
  const waitText = (text) => page.waitForFunction((v) => document.body.innerText.includes(v), { timeout: 5000 }, text);

  // 1. Defaults: nothing stored → stock login blue, no custom logo.
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#login button[type="submit"]');
  assert.equal(await submitBg(), 'rgb(30, 108, 251)', 'default login button colour');
  assert.equal(await rootVar('--primary'), '', 'no inline brand override by default');
  assert.equal(await logoCount(), 0, 'default infinity icon, no <img> logo');
  const defaultFavicon = await favicon();
  assert.ok(defaultFavicon.startsWith('data:image/svg+xml'), 'default favicon untouched');
  console.log('✓ defaults unchanged when no branding is set');

  // 2. Wrong file type is rejected.
  await upload(files.text);
  await waitText('Please upload a PNG, JPG, WebP or SVG image.');
  assert.equal(await colorText(), '');
  console.log('✓ non-image file rejected');

  // 3. Red logo → colour detected → save applies everywhere.
  await upload(files.red);
  await page.waitForFunction(() => document.querySelector('#card input[placeholder="Default theme"]').value !== '', { timeout: 5000 });
  const detected = await colorText();
  assert.match(detected, /^#[0-9a-f]{6}$/);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(detected.slice(i, i + 2), 16));
  assert.ok(r > 180 && g < 80 && b < 120, `expected red, got ${detected}`);
  await page.type('#card input[placeholder="e.g. Oscar Textiles"]', 'Acme Fabrics');
  await clickText('Save & Apply Branding');
  await waitText('Branding applied');
  const primary = await rootVar('--primary');
  assert.match(primary, /^#[0-9a-f]{6}$/, '--primary set on <html>');
  assert.equal(await rootVar('--brand-primary'), primary);
  const expectedBg = await page.evaluate((hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  }, primary);
  assert.equal(await submitBg(), expectedBg, 'login button follows brand colour');
  assert.ok((await logoCount()) >= 3, 'logo replaces icon on login + sidebar');
  assert.ok((await favicon()).startsWith('data:image/png'), 'favicon switched to logo');
  assert.ok(await page.evaluate(() => document.body.innerText.includes('Acme Fabrics')), 'brand name shown');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('evenmore_branding')));
  assert.equal(stored.color, detected);
  assert.equal(stored.name, 'Acme Fabrics');
  assert.ok(stored.logo.startsWith('data:image/png'));
  assert.ok(stored.logo.length < 200_000, `stored logo is small (${stored.logo.length} chars)`);
  console.log(`✓ red logo → ${detected} → primary ${primary}, applied to login, sidebar, favicon`);

  // 4. Survives a reload (applied before React renders).
  await page.reload();
  await page.waitForSelector('#login button[type="submit"]');
  assert.equal(await rootVar('--primary'), primary, 'brand colour restored on reload');
  assert.equal(await submitBg(), expectedBg);
  assert.ok((await logoCount()) >= 3);
  console.log('✓ branding persists across reload');

  // 5. Grey logo: no vivid colour → keeps current colour, shows hint.
  await upload(files.grey);
  await waitText('No clear colour found');
  assert.equal(await colorText(), detected, 'colour not overwritten by grey logo');
  console.log('✓ grey logo keeps existing colour and explains why');

  // 6. SVG logo → blue.
  await upload(files.blue);
  await page.waitForFunction((prev) => document.querySelector('#card input[placeholder="Default theme"]').value !== prev, { timeout: 5000 }, detected);
  const blue = await colorText();
  const [br, bg2, bb] = [1, 3, 5].map((i) => parseInt(blue.slice(i, i + 2), 16));
  assert.ok(bb > 180 && br < 80 && bg2 < 140, `expected blue, got ${blue}`);
  console.log(`✓ SVG logo → ${blue}`);

  // 7. Reset restores every default.
  await clickText('Reset to Default');
  await page.waitForFunction(() => !document.documentElement.style.getPropertyValue('--primary'));
  assert.equal(await submitBg(), 'rgb(30, 108, 251)');
  assert.equal(await logoCount(), 0);
  assert.equal(await favicon(), defaultFavicon);
  assert.equal(await page.evaluate(() => localStorage.getItem('evenmore_branding')), null);
  const themePrimary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
  assert.equal(themePrimary, '#14b8a6', 'Oscar theme primary is back');
  console.log('✓ reset restores defaults (colour, logo, favicon, storage)');

  // 8. Corrupt storage must not break the app.
  await page.evaluate(() => localStorage.setItem('evenmore_branding', '{not json'));
  await page.reload();
  await page.waitForSelector('#login button[type="submit"]');
  assert.equal(await submitBg(), 'rgb(30, 108, 251)');
  console.log('✓ corrupt saved branding falls back to defaults');

  assert.deepEqual(apiCalls, [], `branding made API calls: ${apiCalls.join(', ')}`);
  console.log('✓ no API requests made by branding');
  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  console.log('✓ no runtime/console errors');
  console.log('\nAll branding checks passed.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(dir, { recursive: true, force: true });
}
