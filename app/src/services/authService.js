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
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || (row.email || '?').slice(0, 2).toUpperCase(),
  };
}

/**
 * Sign in. Throws `ApiError` on bad credentials — there is no demo persona to
 * fall back to, so the form shows the server's own message.
 */
export async function login({ email, password, tenant, remember = true }) {
  const response = await api.post('/auth/login/', {
    email: String(email || '').trim().toLowerCase(),
    password,
    tenant: String(tenant || '').trim() || undefined,
  });

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
      clearStoredAuth();
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

export async function updateProfile(updates) {
  const row = await api.patch('/auth/me/', updates);
  return normalizeUser(row?.user || row);
}
