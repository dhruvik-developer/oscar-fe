/**
 * quotationSharing — the public link for a quotation (api.md §5.3).
 *
 * The link used to be minted in the browser: the token was either a base64 copy
 * of the whole quotation stuffed into the URL, or a row in this profile's
 * `localStorage`. Neither is a link — the first leaks the document to anyone who
 * can read a URL, and the second only opens in the browser that made it.
 *
 * `POST /sales/quotations/{id}/share/` issues the token, and the recipient's
 * page reads it back through `/public/quotations/{number}/{token}/`, which is
 * the only unauthenticated surface involved.
 */
import { api, ApiError } from './api';
import { isBackendEnabled } from './resourceSync';

export { ApiError };

/**
 * Read, create or replace the share link for a quotation.
 *
 * With no `data` this reads the current link and 404s when there is none, which
 * is what the workflow panel expects. With `data` it issues a fresh one,
 * superseding whatever was open.
 */
export const sharingRequest = async (id, data) => {
  if (!isBackendEnabled()) {
    throw new ApiError('Sign in to share a quotation.', { status: 401 });
  }

  if (!data) {
    const result = await api.get(`/sales/quotations/${id}/share/`);
    if (!result) throw new ApiError('No quotation link has been generated.', { status: 404 });
    return result;
  }

  return api.post(`/sales/quotations/${id}/share/`, {
    expiryDays: data.expiryDays,
    allowDownload: data.allowDownload,
    // The document itself stays server-side; only the options travel.
  });
};

/** Withdraw the link so the URL stops resolving for the recipient. */
export const revokeSharingRequest = async (id) => {
  if (!isBackendEnabled()) return null;
  return api.delete(`/sales/quotations/${id}/share/`);
};

/**
 * The recipient's side. `action` is `view` or `download`, which the server
 * records against the link; without one this returns the quotation to render.
 */
export const publicQuoteRequest = async (number, token, action) => {
  const base = `/public/quotations/${encodeURIComponent(number)}/${encodeURIComponent(token)}/`;
  if (!action) {
    return api.get(base);
  }
  if (action === 'view' || action === 'download') {
    return api.post(`${base}comment/`, { event: action });
  }
  throw new ApiError('Unsupported action for this link.', { status: 400 });
};

export const acceptQuotation = (number, token, payload = {}) =>
  api.post(`/public/quotations/${encodeURIComponent(number)}/${encodeURIComponent(token)}/accept/`, payload);

export const rejectQuotation = (number, token, payload = {}) =>
  api.post(`/public/quotations/${encodeURIComponent(number)}/${encodeURIComponent(token)}/reject/`, payload);
