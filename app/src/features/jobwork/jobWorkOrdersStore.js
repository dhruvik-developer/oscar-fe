/**
 * Job work helpers. Business records always come from the backend
 * (see services/jobWorkSync.js); this file only holds pure formatting /
 * derivation helpers.
 */

/** Old browser caches of business data — purged, never read. */
const LEGACY_KEYS = ['oscar_jobWorkOrders', 'oscar_jobWorkOrders_v2', 'oscar_processPlans', 'oscar_processPlans_v2'];

export const purgeLegacyJobWorkCache = () => {
  LEGACY_KEYS.forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  });
};

export const toDDMMYYYY = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // already DD-MM-YYYY or display string — pass through
  return iso || '—';
};

export const toISO = (ddmmyyyy) => {
  const m = String(ddmmyyyy || '').match(/^(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ddmmyyyy;
};

export const jwoKpis = (jwo) => {
  const totalOrdered = Number(jwo?.plannedQty) || 0;
  const totalOutward = (jwo?.outwards || []).reduce((s, o) => s + (Number(o.qty) || 0), 0);
  const totalInward = (jwo?.inwards || []).reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const accepted = (jwo?.inwards || []).reduce((s, r) => s + (Number(r.accepted) || 0), 0);
  const rejected = (jwo?.inwards || []).reduce((s, r) => s + (Number(r.rejected) || 0), 0);
  const pending = Math.max(0, totalOrdered - totalInward);
  // Server-computed from material rows.
  const totalAmount = Number(jwo?.totalAmount) || 0;
  return { totalOrdered, totalOutward, totalInward, accepted, rejected, pending, totalAmount };
};

export const inr = (n) =>
  `₹ ${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const numIN = (n) => (Number(n) || 0).toLocaleString('en-IN');
