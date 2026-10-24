/**
 * Authentication Utilities for Evenmore ERP.
 * Handles token storage, JWT expiration checks, and session validation.
 */

// The primary key is configurable per deployment; the legacy key is kept in
// sync for sessions created before the key was introduced.
export const AUTH_TOKEN_KEY = 'auth_token';
export const EVENMORE_AUTH_TOKEN_KEY =
  import.meta.env?.VITE_AUTH_TOKEN_KEY || 'evenmore_auth_token';
export const REFRESH_TOKEN_KEY = 'evenmore_refresh_token';
export const TOKEN_EXPIRES_KEY = 'evenmore_token_expires_at';
export const SAVED_USER_KEY = 'evenmore_saved_user';

/**
 * Validates whether a token exists and is unexpired.
 * Supports standard JWTs (reads exp claim) and fallback session timestamps.
 */
export function isTokenValid(token) {
  if (!token || typeof token !== 'string') return false;

  // 1. Check JWT format (3 base64url segments separated by dots)
  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      if (payload && typeof payload.exp === 'number') {
        // payload.exp is in seconds; check against current timestamp with 5s grace period
        return payload.exp * 1000 > Date.now() + 5000;
      }
      return true;
    } catch {
      return false;
    }
  }

  // 2. Fallback / mock token: verify stored expiration timestamp if set
  try {
    const exp = localStorage.getItem(TOKEN_EXPIRES_KEY);
    if (exp) {
      const expNum = Number(exp);
      if (!Number.isNaN(expNum) && expNum <= Date.now()) {
        return false;
      }
    }
  } catch {}

  return true;
}

/** The refresh token, if one was issued at sign-in. */
export function getStoredRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * True when there is anything left of a session: a live access token, or a
 * refresh token that can mint a new one. Used by the route guards so an
 * expired access token does not look like a signed-out user.
 */
export function hasStoredSession() {
  return Boolean(getStoredToken() || getStoredRefreshToken());
}

/**
 * Retrieves the stored access token.
 *
 * An expired access token is kept when a refresh token exists: the API client
 * exchanges it for a new access token on the next 401. Only tokens with no
 * refresh path behind them are cleared here, so a one-hour access token no
 * longer signs the user out.
 */
export function getStoredToken() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(EVENMORE_AUTH_TOKEN_KEY);
    if (!token) return null;

    if (!isTokenValid(token) && !getStoredRefreshToken()) {
      clearStoredAuth();
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Persists auth credentials with expiration.
 */
export function saveStoredAuth(token, { refreshToken = null, expiresInMs = null, remember = true } = {}) {
  try {
    if (!token) return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(EVENMORE_AUTH_TOKEN_KEY, token);

    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }

    // Default duration: 30 days for remember-me, 24 hours otherwise
    const duration = expiresInMs || (remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
    localStorage.setItem(TOKEN_EXPIRES_KEY, String(Date.now() + duration));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('evenmore:authorized', { detail: { token } }));
    }
  } catch {}
}

/**
 * Persists tokens returned by the silent refresh endpoint.
 *
 * Deliberately does not emit `evenmore:authorized`: the same user is still
 * signed in, so there is no session to re-resolve — only the bearer token
 * changed. Rotation is optional, hence the conditional refresh update.
 */
export function saveRefreshedTokens(accessToken, refreshToken = null) {
  try {
    if (accessToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
      localStorage.setItem(EVENMORE_AUTH_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  } catch {}
}

/**
 * Completely clears stored authentication data.
 */
export function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(EVENMORE_AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
    localStorage.removeItem(SAVED_USER_KEY);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('evenmore:unauthorized'));
    }
  } catch {}
}
