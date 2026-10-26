// getAllPages walks every page of an envelope list.
//
//   node tests/pagination.node.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { middlewareMode: true },
  logLevel: 'error',
});

const requests = [];
const TOTAL = 450;
globalThis.fetch = async (url) => {
  const { searchParams, pathname } = new URL(url, 'http://test');
  requests.push(`${pathname}?${searchParams}`);
  const json = (body) => new Response(JSON.stringify(body), { status: 200 });
  if (pathname.endsWith('/plain/')) return json([{ id: 'a' }, { id: 'b' }]);
  const page = Number(searchParams.get('page'));
  const size = Number(searchParams.get('page_size'));
  const start = (page - 1) * size;
  const results = Array.from({ length: Math.max(0, Math.min(size, TOTAL - start)) }, (_, i) => ({ id: start + i }));
  return json({
    count: TOTAL,
    page,
    page_size: size,
    next: start + size < TOTAL ? `/api/v1/things/?page=${page + 1}` : null,
    results,
  });
};

try {
  const { getAllPages } = await server.ssrLoadModule('/src/services/api.js');

  const rows = await getAllPages('/things/', { query: { status: 'Open' } });
  assert.equal(rows.length, TOTAL, 'every row from every page');
  assert.deepEqual(rows.map((r) => r.id), Array.from({ length: TOTAL }, (_, i) => i));
  assert.equal(requests.length, 3, '200 + 200 + 50');
  assert.ok(requests.every((r) => r.includes('page_size=200') && r.includes('status=Open')), requests.join(' '));
  console.log('✓ walks all pages at 200 rows, keeping filters');

  requests.length = 0;
  const plain = await getAllPages('/plain/');
  assert.deepEqual(plain.map((r) => r.id), ['a', 'b']);
  assert.equal(requests.length, 1);
  console.log('✓ a plain array response is returned as is');

  console.log('\nAll pagination checks passed.');
} finally {
  await server.close();
}
