/**
 * Base API Client — Bridges frontend state with Django REST APIs.
 * Supports timeout, retry, query builder, JWT authentication, idempotency keys,
 * structured ApiError, safe JSON parsing, single-flight token refresh, and
 * unauthorized session handling.
 */

import {
  AUTH_TOKEN_KEY,
  EVENMORE_AUTH_TOKEN_KEY,
  getStoredRefreshToken,
  saveRefreshedTokens,
  clearStoredAuth,
} from '../utils/authUtils';

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 15000;

export class ApiError extends Error {
  constructor(message, { status = 0, endpoint = '', payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.payload = payload;
  }
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, String(v)));
    } else {
      search.append(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function getAuthToken(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    return storage?.getItem(EVENMORE_AUTH_TOKEN_KEY) || storage?.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Alias kept for callers that import `clearAuthTokens` directly from this
 * module. Internally all session teardown goes through `clearStoredAuth` so
 * the `evenmore:unauthorized` event is always fired and all token keys are
 * cleared consistently.
 */
export { clearStoredAuth as clearAuthTokens };

/**
 * The one in-flight refresh request. Concurrent 401s await this same promise
 * instead of each spending the (possibly single-use) refresh token.
 */
let refreshPromise = null;

/**
 * Exchange the stored refresh token for a new access token.
 *
 * The refresh endpoint is called directly rather than through `apiClient`, so a
 * 401 from it cannot recurse into another refresh attempt. If the refresh
 * fails, the session is over: tokens are cleared and `evenmore:unauthorized`
 * fires. That is the only place a normal 401 path ends a session.
 */
export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearStoredAuth();
    return Promise.reject(
      new ApiError('Your session has expired. Please sign in again.', {
        status: 401,
        endpoint: '/auth/refresh/',
      }),
    );
  }

  refreshPromise = (async () => {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/auth/refresh/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      },
      DEFAULT_TIMEOUT_MS,
    );

    const payload = await parseBodySafe(response);
    if (!response.ok) {
      clearStoredAuth();
      const message =
        payload?.message ||
        payload?.detail ||
        'Your session has expired. Please sign in again.';
      throw new ApiError(String(message), {
        status: response.status,
        endpoint: '/auth/refresh/',
        payload,
      });
    }

    const access = payload?.access || payload?.token;
    if (!access) {
      clearStoredAuth();
      throw new ApiError('The server did not return a new access token.', {
        status: 0,
        endpoint: '/auth/refresh/',
        payload,
      });
    }

    // Rotation is off today, but persist a rotated refresh token if the server
    // ever turns it on.
    saveRefreshedTokens(access, payload?.refresh || payload?.refresh_token || null);
    return access;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function fetchWithTimeout(url, config, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    return await fetch(url, { ...config, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseBodySafe(response) {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  } catch {
    return null;
  }
}

function normalizeEndpoint(endpoint) {
  if (!endpoint) return '/';
  let ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Ensure trailing slash for DRF unless it has a query or extension
  if (!ep.endsWith('/') && !ep.includes('?') && !ep.includes('.')) {
    ep = `${ep}/`;
  }
  return ep;
}

export async function apiClient(
  endpoint,
  {
    data,
    method = 'GET',
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    query = null,
    params = null,
    clearAuthOnUnauthorized = true,
    idempotencyKey = null,
    signal = null,
    ...customConfig
  } = {},
) {
  const token = getAuthToken();
  const normalizedEp = normalizeEndpoint(endpoint);
  const queryParams = query || params || customConfig.params || null;
  const url = `${API_BASE_URL}${normalizedEp}${queryParams ? buildQuery(queryParams) : ''}`;

  const requestHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    ...headers,
  };

  const config = {
    method,
    headers: requestHeaders,
    ...customConfig,
  };

  if (data !== undefined) {
    config.body = JSON.stringify(data);
  }

  const isAuthEndpoint = normalizedEp === '/auth/login/' || normalizedEp === '/auth/refresh/';
  let didRefresh = false;
  let attempt = 0;
  for (;;) {
    try {
      const response = await fetchWithTimeout(url, config, timeoutMs, signal);

      if (response.status === 401 && clearAuthOnUnauthorized) {
        // An expired access token is not a signed-out user: exchange the
        // refresh token once, then replay the original request. Every 401 in
        // this window awaits the same refresh promise (refreshAccessToken).
        if (!isAuthEndpoint && !didRefresh && getStoredRefreshToken()) {
          try {
            await refreshAccessToken();
            didRefresh = true;
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${getAuthToken()}`,
            };
            continue;
          } catch {
            // refreshAccessToken has already cleared the session and fired
            // `evenmore:unauthorized`; fall through to the original 401.
          }
        } else if (!isAuthEndpoint) {
          // No refresh token, or the freshly minted token was rejected too —
          // the session is genuinely over. clearStoredAuth fires the event.
          clearStoredAuth();
        }
      }

      const result = await parseBodySafe(response);
      if (response.ok) {
        return result;
      }

      let message =
        (result && (result.message || result.detail || result.error)) ||
        (result && typeof result === 'object' && Object.values(result)[0]?.[0]) ||
        `Request failed with status ${response.status}`;
      // Error pages (Django DEBUG 404/500, proxies) come back as HTML, not
      // JSON — never surface raw markup in the toast, just the status.
      if (typeof message === 'string' && /\<\s*!?doctype|\<\s*html/i.test(message)) {
        message = `Request failed with status ${response.status}`;
      }
      if (typeof message !== 'string') message = `Request failed with status ${response.status}`;
      if (message.length > 300) message = `${message.slice(0, 297)}…`;

      throw new ApiError(message, { status: response.status, endpoint: normalizedEp, payload: result });
    } catch (err) {
      const retryable =
        err?.name === 'AbortError' ||
        (err instanceof ApiError && (err.status >= 500 || err.status === 429)) ||
        err instanceof TypeError;

      if (retryable && attempt < retries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 300 * attempt));
        continue;
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Network error occurred', { endpoint: normalizedEp });
    }
  }
}

export const api = {
  get: (url, config) => apiClient(url, { ...config, method: 'GET' }),
  post: (url, data, config) => apiClient(url, { ...config, data, method: 'POST' }),
  put: (url, data, config) => apiClient(url, { ...config, data, method: 'PUT' }),
  patch: (url, data, config) => apiClient(url, { ...config, data, method: 'PATCH' }),
  delete: (url, config) => apiClient(url, { ...config, method: 'DELETE' }),
};

export default api;
