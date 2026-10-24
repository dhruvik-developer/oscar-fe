/**
 * resourceSync — the transport every module registry shares.
 *
 * `backendSync.js` grew this machinery for the sales/purchase side; CRM, PMS,
 * HRMS and Accounts need exactly the same four verbs against a different set of
 * paths, so it lives here once and each domain contributes only its registry:
 *
 *   { path, pullPath?, toApi?, fromApi?, omitOnUpdate?, pullQuery? }
 *
 * Reads return `null` (never `[]`) when the request fails, so a caller can tell
 * "the server has nothing" from "the server did not answer" and leave what is
 * already on screen alone in the second case.
 */
import { api, ApiError } from './api';
import { getStoredToken } from '../utils/authUtils';

export { ApiError };

/** Collections are pulled whole; the UI paginates in memory. */
export const PAGE_SIZE = 200;

/** No token → no server. */
export function isBackendEnabled() {
  return Boolean(getStoredToken());
}

/**
 * Server ids are UUIDs. Anything else is a local `lead-1758…` placeholder that
 * was never persisted — updating or deleting it over HTTP would 404.
 */
export function isServerId(id) {
  return typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** One key per create attempt; `randomUUID` needs a secure context. */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** A human-readable reason for a failed request, for the toast. */
export function describeError(err) {
  if (err instanceof ApiError) {
    const fieldErrors = err.payload?.field_errors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      const [field, messages] = Object.entries(fieldErrors)[0] || [];
      if (field) return `${field}: ${[].concat(messages)[0]}`;
    }
    return err.message;
  }
  return err?.message || 'Could not reach the server';
}

/** Drop keys the API rejects rather than sending `undefined` through JSON. */
export function compact(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  );
}

/**
 * How many requests a fan-out keeps in flight.
 *
 * Signing in loads every module at once, which is around fifty collections. Sent
 * as one burst that is a thundering herd: browsers only open ~6 connections per
 * origin anyway, so the rest queue in the socket layer where nothing can reason
 * about them, and a development server behind the proxy can simply drop them.
 * Queuing here instead keeps the burst to a size any backend can answer.
 */
export const MAX_IN_FLIGHT = 6;

/**
 * `Promise.all(items.map(fn))`, but with at most `limit` running at once.
 * Results keep the order of `items`.
 */
export async function mapWithLimit(items, fn, limit = MAX_IN_FLIGHT) {
  const list = [...items];
  const results = new Array(list.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= list.length) return;
      results[index] = await fn(list[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, worker),
  );
  return results;
}

/**
 * Turn the named fields into strings.
 *
 * The API returns `null` for anything unset — a user with no role yet, a client
 * with no location on file. The screens treat these as text: they search, sort
 * and group on them, so a `null` becomes a crash inside a filter rather than an
 * empty cell. Normalising at the edge means no screen has to guard each read.
 */
export function asText(row, fields) {
  const out = { ...row };
  fields.forEach((field) => {
    out[field] = out[field] == null ? '' : String(out[field]);
  });
  return out;
}

/** DRF paginates as `{results: []}`; action endpoints return a bare array. */
export function rowsOf(body) {
  if (Array.isArray(body)) return body;
  return body?.results || [];
}

/**
 * Build the four verbs for one registry. Each domain calls this once and
 * exports the result, so `crmSync.pull('leads')` reads the same as
 * `pmsSync.pull('projects')`.
 */
export function createSync(registry, { label = 'sync' } = {}) {
  const get = (key) => registry[key];

  /** Load one collection, or `null` when the read failed. */
  async function pull(key, query = {}) {
    const resource = get(key);
    if (!resource || !isBackendEnabled()) return null;
    try {
      const body = await api.get(resource.pullPath || resource.path, {
        // The API pages on `page_size` (default 25); `limit` is kept for older routes.
        query: { limit: PAGE_SIZE, page_size: PAGE_SIZE, ...(resource.pullQuery || {}), ...query },
      });
      const rows = rowsOf(body);
      return resource.fromApi ? rows.map(resource.fromApi) : rows;
    } catch (err) {
      console.warn(`[${label}] pull ${key} failed:`, err?.message || err);
      return null;
    }
  }

  /**
   * Load several collections at once. Failures are per-collection: a key whose
   * read failed is simply absent from the result.
   */
  async function pullMany(keys = Object.keys(registry), query = {}) {
    const settled = await mapWithLimit(
      keys,
      async (key) => [key, await pull(key, query)],
    );
    return Object.fromEntries(settled.filter(([, rows]) => rows !== null));
  }

  /** Read a single record by id, for the detail views. */
  async function pullOne(key, id) {
    const resource = get(key);
    if (!resource || !isBackendEnabled() || !isServerId(id)) return null;
    try {
      const body = await api.get(`${resource.path}${id}/`);
      return resource.fromApi ? resource.fromApi(body) : body;
    } catch (err) {
      console.warn(`[${label}] pull ${key}/${id} failed:`, err?.message || err);
      return null;
    }
  }

  /**
   * Create on the server and hand back the server's version. A rejection
   * throws — a record the server refused must not look saved.
   */
  async function create(key, record, { idempotencyKey } = {}) {
    const resource = get(key);
    if (!resource || !isBackendEnabled()) return null;
    const payload = resource.toApi ? resource.toApi(record) : record;
    const body = await api.post(resource.path, payload, {
      idempotencyKey: idempotencyKey || newIdempotencyKey(),
    });
    return resource.fromApi ? resource.fromApi(body) : body;
  }

  async function update(key, id, updates) {
    const resource = get(key);
    if (!resource || !isBackendEnabled() || !isServerId(id)) return null;
    const payload = resource.toApi ? resource.toApi(updates) : { ...updates };
    (resource.omitOnUpdate || []).forEach((field) => delete payload[field]);
    const body = await api.patch(`${resource.path}${id}/`, payload);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
    // `PATCH /crm/leads/{id}/` answers `{ lead, createdTasks: [] }` (the stage
    // automation reports what it generated) rather than the bare row, so
    // unwrap it — otherwise the store would keep the envelope as the lead.
    if (body.lead && typeof body.lead === 'object' && body.lead.id) {
      const mapped = resource.fromApi ? resource.fromApi(body.lead) : body.lead;
      if (mapped && typeof mapped === 'object' && !Array.isArray(mapped)) {
        mapped.createdTasks = body.createdTasks || [];
      }
      return mapped;
    }
    return resource.fromApi ? resource.fromApi(body) : body;
  }

  async function remove(key, id) {
    const resource = get(key);
    if (!resource || !isBackendEnabled() || id === undefined || id === null || id === "") return null;
    const idStr = String(id);
    // Local optimistic rows (e.g. `emp-local-…`) were never persisted —
    // dropping them locally is the whole delete; anything else must reach
    // the server, even legacy codes like `EMP0002`, or the UI shows a
    // success the server never applied.
    if (idStr.includes("-local-")) return null;
    await api.delete(`${resource.path}${idStr}/`);
    return true;
  }

  /**
   * A non-CRUD verb on a record — `/leads/{id}/convert/`, `/payroll/{id}/approve/`.
   * The server's answer is passed through the resource's reader when it looks
   * like the record itself, so callers can drop it straight into state.
   */
  async function act(key, id, action, data, { method = 'POST', raw = false } = {}) {
    const resource = get(key);
    if (!resource || !isBackendEnabled()) return null;
    const suffix = action ? `${action.replace(/^\/|\/$/g, '')}/` : '';
    const path = id ? `${resource.path}${id}/${suffix}` : `${resource.path}${suffix}`;
    const body = await api[method.toLowerCase()](path, data);
    if (raw || !resource.fromApi || !body || typeof body !== 'object' || Array.isArray(body)) {
      return body;
    }
    return body.id ? resource.fromApi(body) : body;
  }

  return { registry, pull, pullMany, pullOne, create, update, remove, act };
}
