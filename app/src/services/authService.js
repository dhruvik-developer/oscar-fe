/**
 * authService — the only place the app talks to `/auth/*`.
 *
 * The session is the server's, not the browser's: a token in `localStorage` is
 * a claim, and `fetchMe()` is what turns it back into a user. Nothing here has
 * a local fallback — if the server does not answer, there is no session, and
 * the app says so instead of pretending to be signed in.
 */
import { api } from './api';
import {
  saveStoredAuth,
  clearStoredAuth,
  hasStoredSession,
} from '../utils/authUtils';

/** `{id, name, role: {name}, …}` from the API → what the header/sidebar read. */
export function normalizeUser(row) {
  if (!row) return null;
  const name = row.name || row.fullName || row.email || '';
  return {
    id: row.id,
    name,
    email: row.email || '',
    phone: row.phone || '',
    // `role` is an object on the wire and a label on screen.
    role: row.role?.name || row.role || '',
    roleId: row.role?.id || row.roleId || null,
    roleCode: row.role?.code || '',
    department: row.department || '',
    location: row.location || '',
    employeeId: row.employeeId || null,
    reportingManager: row.reportingManager || null,
    status: row.status || 'Active',
    avatar: row.avatar || null,
    // An administrator set the password; the app holds the user on
    // /change-password until they replace it.
    mustChangePassword: Boolean(row.mustChangePassword),
    // Two-step sign-in: chosen by the user, or forced by the role.
    twoFactorEnabled: Boolean(row.twoFactorEnabled),
    twoFactorRequired: Boolean(row.twoFactorRequired),
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || (row.email || '?').slice(0, 2).toUpperCase(),
  };
}

/** Store the tokens from a finished sign-in and return the session. */
function completeSignIn(response, remember) {
  const token = response?.access || response?.token;
  if (!token) {
    throw new Error('The server did not return a session token.');
  }

  saveStoredAuth(token, { refreshToken: response.refresh, remember });

  return {
    user: normalizeUser(response.user),
    permissions: response.permissions || [],
    tenant: response.tenant || null,
  };
}

/**
 * Sign in. Throws `ApiError` on bad credentials — there is no demo persona to
 * fall back to, so the form shows the server's own message.
 *
 * For an account with two-step sign-in the password only earns a challenge:
 * the result is `{ twoFactor: { challengeId, email, expiresIn } }` and no
 * tokens are stored until `verifyLoginOtp` succeeds.
 */
export async function login({ email, password, role, tenant, remember = true }) {
  const response = await api.post('/auth/login/', {
    email: String(email || '').trim().toLowerCase(),
    password,
    role,
    tenant: String(tenant || '').trim() || undefined,
  });
  if (response?.twoFactorRequired) {
    return {
      twoFactor: {
        challengeId: response.challengeId,
        email: response.email,
        expiresIn: response.expiresIn,
      },
    };
  }
  return completeSignIn(response, remember);
}

/** Second step of a two-step sign-in. */
export async function verifyLoginOtp({ challengeId, otp, remember = true }) {
  const response = await api.post('/auth/login/verify-otp/', {
    challengeId,
    otp: String(otp || '').trim(),
  });
  return completeSignIn(response, remember);
}

/** A fresh sign-in code; returns the new `{ challengeId, email, expiresIn }`. */
export async function resendLoginOtp(challengeId) {
  return api.post('/auth/login/resend-otp/', { challengeId });
}

/** Helpdesk contact shown on the sign-in page (empty strings when unset). */
export async function getSupportInfo() {
  return api.get('/auth/support/');
}

/**
 * Roles for the sign-in dropdown: `[{ code, name }]`, only roles held by
 * active users (plus an administrator entry while a superuser exists).
 * The server decides the list; the page keeps no copy of its own.
 */
export async function getLoginRoles(tenant) {
  const body = await api.get('/auth/login-roles/', {
    query: tenant ? { tenant } : undefined,
  });
  return Array.isArray(body?.roles) ? body.roles : [];
}

export async function listSessions() {
  const body = await api.get('/auth/sessions/');
  return body?.results || [];
}

export async function revokeSession(id) {
  return api.delete(`/auth/sessions/${id}/`);
}

export async function revokeOtherSessions() {
  return api.post('/auth/sessions/revoke-others/', {});
}

export async function getLoginHistory() {
  const body = await api.get('/auth/login-history/');
  return body?.results || [];
}

/**
 * Rehydrate the session after a reload. Returns `null` when the token is gone
 * or the server rejects it, and clears the token in that case so the guard
 * sends the user back to the sign-in page rather than into an empty shell.
 */
export async function fetchMe() {
  if (!hasStoredSession()) return null;
  try {
    const row = await api.get('/auth/me/');
    if (!row) return null;
    // `/auth/me/` returns the user; permissions ride alongside when present.
    const user = normalizeUser(row.user || row);
    return {
      user,
      permissions: row.permissions || [],
      tenant: row.tenant || null,
    };
  } catch (err) {
    // The API client clears the session when its refresh attempt fails; only
    // clear here for a 403 the refresh path never saw.
    if ((err?.status === 401 || err?.status === 403) && hasStoredSession()) {
      clearStoredAuth({ reason: 'expired' });
    }
    return null;
  }
}

/** Tell the server, then forget locally either way. */
export async function logout() {
  try {
    if (hasStoredSession()) await api.post('/auth/logout/', {});
  } catch {
    // A failed logout must still end the local session.
  } finally {
    clearStoredAuth();
  }
}

export async function changePassword({ currentPassword, newPassword }) {
  return api.post('/auth/change-password/', {
    currentPassword,
    newPassword,
  });
}

export async function forgotPassword(email) {
  return api.post('/auth/forgot-password/', {
    email: String(email || '').trim().toLowerCase(),
  });
}

/** Trade the emailed 6-digit code for a short-lived reset token. */
export async function verifyResetOtp({ email, otp }) {
  return api.post('/auth/verify-reset-otp/', {
    email: String(email || '').trim().toLowerCase(),
    otp: String(otp || '').trim(),
  });
}

/** Redeem a reset token (emailed link or verified code). Every session is signed out. */
export async function resetPassword({ token, otp, newPassword }) {
  // A token from the emailed link needs the emailed code too.
  return api.post('/auth/reset-password/', { token, newPassword, ...(otp ? { otp } : {}) });
}

export async function updateProfile(updates) {
  const row = await api.patch('/auth/me/', updates);
  return normalizeUser(row?.user || row);
}
