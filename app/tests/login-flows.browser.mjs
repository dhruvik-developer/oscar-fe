// Sign-in flows against a scripted /api/v1/auth backend:
// workspace picker, lockout message, Caps Lock hint, forgot/reset password,
// forced password change, remember-me storage, session-expired notice, logout.
//
//   node tests/login-flows.browser.mjs
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

// ── Harness: the auth pages and guards, with a stand-in dashboard ──
const entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
  import '/src/styles/globals.css';
  import SessionGate from '/src/routes/SessionGate.jsx';
  import RequireAuth from '/src/routes/RequireAuth.jsx';
  import LoginPage from '/src/features/auth/LoginPage.jsx';
  import ResetPasswordPage from '/src/features/auth/ResetPasswordPage.jsx';
  import ChangePasswordPage from '/src/features/auth/ChangePasswordPage.jsx';
  import AccountSecurityPage from '/src/features/auth/AccountSecurityPage.jsx';
  import { logout } from '/src/services/authService.js';
  const h = React.createElement;
  function Home() {
    const navigate = useNavigate();
    return h('div', null,
      h('h1', { id: 'home' }, 'HOME'),
      h('button', { id: 'logout', onClick: async () => { await logout(); navigate('/login'); } }, 'Sign out'));
  }
  createRoot(document.getElementById('root')).render(
    h(BrowserRouter, null, h(SessionGate, null, h(Routes, null,
      h(Route, { path: '/login', element: h(LoginPage) }),
      h(Route, { path: '/reset-password', element: h(ResetPasswordPage) }),
      h(Route, { element: h(RequireAuth) },
        h(Route, { path: '/change-password', element: h(ChangePasswordPage) }),
        h(Route, { path: '/dashboard', element: h(Home) }),
        h(Route, { path: '/account/security', element: h(AccountSecurityPage) })),
    ))),
  );
`;
const html = `<!doctype html><html><head></head><body><div id="root"></div>
  <script type="module" src="/__login-test.jsx"></script></body></html>`;
const PAGES = ['/login', '/reset-password', '/change-password', '/dashboard', '/account/security'];

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '127.0.0.1', port: 43823, open: false },
  logLevel: 'error',
  plugins: [{
    name: 'login-test',
    enforce: 'pre',
    resolveId(id) {
      if (id === '/__login-test.jsx') return '\0login-test.jsx';
    },
    load(id) {
      if (id === '\0login-test.jsx') return entry;
    },
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        const path = request.url.split('?')[0];
        if (!PAGES.includes(path)) return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml(request.url, html));
      });
    },
  }],
});

// ── Scripted backend ─────────────────────────────────────────
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const jwt = (expSeconds) => `${b64({ alg: 'HS256' })}.${b64({ exp: expSeconds })}.sig`;
const liveToken = () => jwt(Math.floor(Date.now() / 1000) + 3600);

const users = {
  'asha@oscar.test': { id: 'u1', name: 'Asha', email: 'asha@oscar.test', mustChangePassword: false },
  'shared@oscar.test': { id: 'u2', name: 'Shared', email: 'shared@oscar.test', mustChangePassword: false },
  'temp@oscar.test': { id: 'u3', name: 'New Joiner', email: 'temp@oscar.test', mustChangePassword: true },
  'owner@oscar.test': { id: 'u4', name: 'Owner', email: 'owner@oscar.test', mustChangePassword: false, twoFactorRequired: true },
};
let sessions = [
  { id: 's1', device: 'Chrome on Windows', ip: '10.0.0.5', issuedAt: '2026-10-26T05:00:00Z', lastSeenAt: '2026-10-26T06:00:00Z', expiresAt: '2099-01-01T00:00:00Z', revokedAt: null, isCurrent: true },
  { id: 's2', device: 'Safari on macOS', ip: '10.0.0.9', issuedAt: '2026-10-25T05:00:00Z', lastSeenAt: '2026-10-25T06:00:00Z', expiresAt: '2099-01-01T00:00:00Z', revokedAt: null, isCurrent: false },
];
let signedInAs = null;
const calls = [];
const lastBody = {};

function handleApi(method, path, body) {
  const json = (status, data) => ({ status, data });
  if (method === 'POST' && path === '/api/v1/auth/login/') {
    if (body.email === 'locked@oscar.test') {
      return json(401, {
        code: 'ACCOUNT_LOCKED',
        message: 'Too many failed sign-in attempts. Try again in 15 minutes, or reset your password.',
        payload: { retryAfterSeconds: 900 },
      });
    }
    const user = users[body.email];
    if (!user || body.password !== 'Right1234!') {
      return json(401, { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' });
    }
    if (body.email === 'owner@oscar.test') {
      return json(200, { twoFactorRequired: true, challengeId: 'ch-1', email: 'o•••r@oscar.test', expiresIn: 300 });
    }
    if (body.email === 'shared@oscar.test' && !body.tenant) {
      return json(401, {
        code: 'TENANT_REQUIRED',
        message: 'This email belongs to more than one workspace. Choose one to continue.',
        payload: { workspaces: [{ slug: 'alpha', name: 'Alpha Textiles' }, { slug: 'beta', name: 'Beta Fabrics' }] },
      });
    }
    signedInAs = { ...user };
    return json(200, { access: liveToken(), refresh: 'refresh-ok', user: signedInAs, permissions: [] });
  }
  if (method === 'POST' && path === '/api/v1/auth/login/verify-otp/') {
    if (body.challengeId !== 'ch-1' || body.otp !== '246810') {
      return json(400, { code: 'OTP_INVALID', message: 'That code is wrong or has expired. Check the latest email, or send a new code.' });
    }
    signedInAs = { ...users['owner@oscar.test'] };
    return json(200, { access: liveToken(), refresh: 'refresh-ok', user: signedInAs, permissions: [] });
  }
  if (method === 'GET' && path === '/api/v1/auth/support/') {
    return json(200, { email: 'help@oscar.test', phone: '+91 90000 11111', hours: '' });
  }
  if (method === 'GET' && path === '/api/v1/auth/sessions/') return json(200, { results: sessions });
  if (method === 'POST' && path === '/api/v1/auth/sessions/revoke-others/') {
    const count = sessions.filter((x) => !x.isCurrent).length;
    sessions = sessions.filter((x) => x.isCurrent);
    return json(200, { revoked: count });
  }
  if (method === 'GET' && path === '/api/v1/auth/login-history/') {
    return json(200, { results: [
      { id: 2, action: 'login', description: 'Signed in', ip: '10.0.0.5', at: '2026-10-26T05:00:00Z' },
      { id: 1, action: 'login_failed', description: 'Sign-in failed', ip: '10.0.0.7', at: '2026-10-26T04:59:00Z' },
    ] });
  }
  if (method === 'PATCH' && path === '/api/v1/auth/me/') {
    signedInAs = { ...signedInAs, twoFactorEnabled: body.twoFactorEnabled, twoFactorRequired: body.twoFactorEnabled };
    return json(200, { user: signedInAs, permissions: [] });
  }
  if (method === 'GET' && path === '/api/v1/auth/me/') {
    return signedInAs ? json(200, { user: signedInAs, permissions: [] }) : json(401, { code: 'TOKEN_EXPIRED', message: 'Expired.' });
  }
  if (method === 'POST' && path === '/api/v1/auth/refresh/') {
    return body.refresh === 'refresh-ok'
      ? json(200, { access: liveToken() })
      : json(401, { code: 'TOKEN_INVALID', message: 'Your session has expired.' });
  }
  if (method === 'POST' && path === '/api/v1/auth/change-password/') {
    if (body.currentPassword !== 'Right1234!') {
      return json(400, { code: 'VALIDATION_FAILED', message: 'Your current password is incorrect.', field_errors: { currentPassword: ['Incorrect password.'] } });
    }
    signedInAs.mustChangePassword = false;
    return json(204, null);
  }
  if (method === 'POST' && path === '/api/v1/auth/forgot-password/') return json(204, null);
  if (method === 'POST' && path === '/api/v1/auth/verify-reset-otp/') {
    return body.otp === '482913'
      ? json(200, { token: 'otp-token', expiresIn: 900 })
      : json(400, { code: 'OTP_INVALID', message: 'That code is wrong or has expired. Check the latest email, or send a new code.', field_errors: { otp: ['Wrong or expired code.'] } });
  }
  if (method === 'POST' && path === '/api/v1/auth/reset-password/') {
    // The emailed link's token needs the emailed code; the exchanged one does not.
    if (body.token === 'good-token' && body.otp !== '482913') {
      return json(400, { code: 'OTP_INVALID', message: 'That code is wrong or has expired. Check the latest email, or request a new code.', field_errors: { otp: ['Wrong or expired code.'] } });
    }
    return ['good-token', 'otp-token'].includes(body.token)
      ? json(204, null)
      : json(400, { code: 'TOKEN_EXPIRED', message: 'That reset link is no longer valid. Request a new one.', field_errors: { token: ['Expired or already used.'] } });
  }
  if (method === 'POST' && path === '/api/v1/auth/logout/') {
    signedInAs = null;
    return json(204, null);
  }
  return json(404, { code: 'NOT_FOUND', message: 'Not mocked.' });
}

const errors = [];
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    // 4xx answers are the point of several checks; the browser logs them.
    if (msg.type() === 'error' && !/status of 40[0-4]/.test(msg.text())) errors.push(msg.text());
  });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return request.continue();
    let body = {};
    try { body = JSON.parse(request.postData() || '{}'); } catch { body = {}; }
    calls.push(`${request.method()} ${url.pathname}`);
    lastBody[url.pathname] = body;
    const { status, data } = handleApi(request.method(), url.pathname, body);
    return request.respond({
      status,
      contentType: 'application/json',
      body: data === null ? '' : JSON.stringify(data),
    });
  });

  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const waitText = (text) => page.waitForFunction((v) => document.body.innerText.includes(v), { timeout: 8000 }, text);
  const pathname = () => page.evaluate(() => location.pathname);
  const fresh = async (path = '/login') => {
    await page.goto(`${base}/login`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    signedInAs = null;
    await page.goto(`${base}${path}`);
  };
  const typeInto = async (selector, value) => {
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(selector, value);
  };
  const signIn = async (email, password) => {
    await page.waitForSelector('input[autocomplete="username"]');
    await typeInto('input[autocomplete="username"]', email);
    await typeInto('input[autocomplete="current-password"]', password);
    await page.click('button[type="submit"]');
  };

  // 1. Wrong password → generic message.
  await fresh();
  await signIn('asha@oscar.test', 'Nope0000!');
  await waitText('Incorrect email or password.');
  console.log('✓ wrong password shows the generic message');

  // 2. Locked account → wait time and reset hint.
  await signIn('locked@oscar.test', 'Whatever1!');
  await waitText('Try again in 15 minutes');
  console.log('✓ locked account explains how long to wait');

  // 3. Caps Lock hint appears while Caps Lock is on, clears when off.
  // Headless Chrome does not track Caps Lock from key presses, so the key
  // events carry the modifier state themselves.
  const capsKey = (on) => page.$eval('input[autocomplete="current-password"]', (input, value) => {
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true, modifierCapsLock: value }));
  }, on);
  await capsKey(true);
  await waitText('Caps Lock is on');
  await capsKey(false);
  await page.waitForFunction(() => !document.body.innerText.includes('Caps Lock is on'), { timeout: 5000 });
  console.log('✓ Caps Lock hint toggles');

  // 4. Shared email → workspace picker → sign in to the chosen one.
  await fresh();
  await signIn('shared@oscar.test', 'Right1234!');
  await waitText('more than one workspace');
  await page.waitForSelector('select');
  await page.select('select', 'beta');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#home');
  assert.equal(lastBody['/api/v1/auth/login/'].tenant, 'beta');
  console.log('✓ workspace picker sends the chosen tenant');

  // 5. Remember me on → localStorage; logout posts to the server and clears it.
  assert.ok(await page.evaluate(() => Boolean(localStorage.getItem('evenmore_refresh_token'))));
  await page.click('#logout');
  await page.waitForSelector('input[autocomplete="username"]');
  assert.ok(calls.includes('POST /api/v1/auth/logout/'), 'logout must call the server');
  assert.ok(await page.evaluate(() => !localStorage.getItem('evenmore_refresh_token') && !sessionStorage.getItem('evenmore_refresh_token')));
  console.log('✓ logout revokes on the server and clears local tokens');

  // 6. Remember me off → tokens only in sessionStorage.
  await fresh();
  await page.waitForSelector('input[type="checkbox"]');
  await page.click('input[type="checkbox"]');
  await signIn('asha@oscar.test', 'Right1234!');
  await page.waitForSelector('#home');
  const where = await page.evaluate(() => ({
    local: localStorage.getItem('evenmore_refresh_token'),
    session: sessionStorage.getItem('evenmore_refresh_token'),
  }));
  assert.equal(where.local, null, 'no token in localStorage without remember-me');
  assert.equal(where.session, 'refresh-ok');
  await page.reload();
  await page.waitForSelector('#home');
  console.log('✓ "keep me signed in" off keeps the session in this tab only');

  // 7. Admin-set password → held on /change-password, even when navigating away.
  await fresh();
  await signIn('temp@oscar.test', 'Right1234!');
  await waitText('Set your own password');
  assert.equal(await pathname(), '/change-password');
  await page.goto(`${base}/dashboard`);
  await waitText('Set your own password');
  assert.equal(await pathname(), '/change-password', 'gate must hold the user');
  const pw = 'input[autocomplete="new-password"]';
  await typeInto('input[autocomplete="current-password"]', 'Right1234!');
  const [newField, confirmField] = await page.$$(pw);
  await newField.type('Mine5678!x');
  await confirmField.type('Mine5678!x');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#home');
  console.log('✓ temporary password must be changed before entering the app');

  // 8. Forgot password by emailed code: email → code + new password → done.
  const clickButton = (text) => page.evaluate((value) => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(value));
    if (!button) throw new Error(`Button not found: ${value}`);
    button.click();
  }, text);
  await fresh();
  await page.waitForSelector('input[autocomplete="username"]');
  await typeInto('input[autocomplete="username"]', 'asha@oscar.test');
  await clickButton('Forgot password?');
  await page.waitForSelector('input[type="email"]');
  assert.equal(await page.$eval('input[type="email"]', (i) => i.value), 'asha@oscar.test', 'modal is prefilled');
  await clickButton('Send Code');
  await page.waitForSelector('input[autocomplete="one-time-code"]');
  assert.equal(lastBody['/api/v1/auth/forgot-password/'].email, 'asha@oscar.test');
  await waitText('Resend in');
  const [otpNew, otpConfirm] = await page.$$('input[autocomplete="new-password"]');
  await otpNew.type('Fresh5678!');
  await otpConfirm.type('Fresh5678!');
  await page.type('input[autocomplete="one-time-code"]', '111111');
  await clickButton('Reset Password');
  await waitText('That code is wrong or has expired');
  await page.click('input[autocomplete="one-time-code"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input[autocomplete="one-time-code"]', '48a29b13');
  assert.equal(await page.$eval('input[autocomplete="one-time-code"]', (i) => i.value), '482913', 'digits only');
  await clickButton('Reset Password');
  await waitText('Your password has been changed');
  assert.equal(lastBody['/api/v1/auth/reset-password/'].token, 'otp-token');
  assert.equal(lastBody['/api/v1/auth/reset-password/'].newPassword, 'Fresh5678!');
  console.log('✓ forgot password by code: wrong code refused, right code resets');

  // 9. Reset page (emailed link): needs the code too; bad token, wrong code,
  // right code, missing token.
  const otpField = 'input[autocomplete="one-time-code"]';
  const fillReset = async (otp, first, second) => {
    await page.waitForSelector(pw);
    const [p1, p2] = await page.$$(pw);
    await page.click(otpField, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(otpField, otp);
    for (const [field, value] of [[p1, first], [p2, second]]) {
      await field.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await field.type(value);
    }
  };
  await fresh('/reset-password?token=stale');
  await fillReset('482913', 'Fresh5678!', 'Fresh5678!');
  await page.click('button[type="submit"]');
  await waitText('no longer valid');
  await fresh('/reset-password?token=good-token');
  const resetCalls = () => calls.filter((c) => c.endsWith('/auth/reset-password/')).length;
  const before = resetCalls();
  await fillReset('', 'Fresh5678!', 'Fresh5678!');
  await page.click('button[type="submit"]');
  await waitText('Enter the 6-digit code');
  assert.equal(resetCalls(), before, 'no request is sent without a code');
  await fillReset('111111', 'Fresh5678!', 'Fresh5678!');
  await page.click('button[type="submit"]');
  await waitText('That code is wrong or has expired');
  await fillReset('482913', 'Fresh5678!', 'Different9!');
  await waitText('Passwords do not match');
  await fillReset('482913', 'Fresh5678!', 'Fresh5678!');
  await page.click('button[type="submit"]');
  await waitText('Password updated');
  assert.equal(lastBody['/api/v1/auth/reset-password/'].otp, '482913');
  await fresh('/reset-password');
  await waitText('Link is incomplete');
  console.log('✓ reset link needs the emailed code; wrong code refused, right code resets');

  // 10. Expired session → back to sign-in with an explanation, shown once.
  await fresh();
  await page.evaluate((token) => {
    localStorage.setItem('evenmore_auth_token', token);
    localStorage.setItem('evenmore_refresh_token', 'refresh-dead');
  }, jwt(Math.floor(Date.now() / 1000) - 60));
  await page.goto(`${base}/dashboard`);
  await waitText('Your session expired');
  assert.equal(await pathname(), '/login');
  await page.reload();
  await page.waitForSelector('input[autocomplete="username"]');
  assert.ok(await page.evaluate(() => !document.body.innerText.includes('Your session expired')), 'notice is shown once');
  console.log('✓ expired session explains itself once');

  // 11. Two-step sign-in: password → emailed code → in.
  await fresh();
  await signIn('owner@oscar.test', 'Right1234!');
  await page.waitForSelector('input[autocomplete="one-time-code"]');
  await waitText('o•••r@oscar.test');
  assert.ok(await page.evaluate(() => !localStorage.getItem('evenmore_refresh_token')), 'no tokens before the code');
  await waitText('Resend in');
  await page.type('input[autocomplete="one-time-code"]', '111111');
  await clickButton('Verify and sign in');
  await waitText('That code is wrong or has expired');
  await page.type('input[autocomplete="one-time-code"]', '246810');
  await clickButton('Verify and sign in');
  await page.waitForSelector('#home');
  console.log('✓ two-step sign-in: tokens only after the right code');

  // 12. Helpdesk box shows the configured contact, no placeholders.
  await fresh();
  await page.waitForSelector('input[autocomplete="username"]');
  assert.equal(await page.$eval('input[autocomplete="username"]', (i) => i.placeholder), 'you@company.com');
  await clickButton('IT Helpdesk');
  await waitText('help@oscar.test');
  const helpText = await page.evaluate(() => document.body.innerText);
  assert.ok(!helpText.includes('4800-ERP1') && !helpText.includes('support@evenmore.io'), 'old placeholders gone');
  assert.ok(!helpText.includes('Hours'), 'empty hours are hidden');
  console.log('✓ helpdesk shows real contact details from the server');

  // 13. Security page: devices, sign out others, history, two-step toggle.
  await fresh();
  await signIn('asha@oscar.test', 'Right1234!');
  await page.waitForSelector('#home');
  await page.goto(`${base}/account/security`);
  await waitText('Safari on macOS');
  await waitText('This device');
  await waitText('Wrong password');
  await clickButton('Sign out all other devices');
  await page.waitForFunction(() => !document.body.innerText.includes('Safari on macOS'), { timeout: 5000 });
  assert.ok(calls.includes('POST /api/v1/auth/sessions/revoke-others/'));
  await page.click('input[type="checkbox"]');
  await page.waitForFunction(() => document.querySelector('input[type="checkbox"]')?.checked, { timeout: 5000 });
  assert.equal(lastBody['/api/v1/auth/me/'].twoFactorEnabled, true);
  console.log('✓ security page: devices, sign out others, history, two-step toggle');

  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  console.log('✓ no runtime/console errors');
  console.log('\nAll login-flow checks passed.');
} finally {
  await browser?.close();
  await server.close();
}
