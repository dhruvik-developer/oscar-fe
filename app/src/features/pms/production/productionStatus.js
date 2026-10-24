/**
 * Shared production-instruction status helpers.
 *
 * The backend owns the status machine (apps/pms/production_services.py);
 * `status` is read-only on the API and only moves through the
 * approve / start / complete / verify / generate-po actions or daily entries.
 * These helpers only decide which buttons to show — the server still
 * validates every transition.
 */

export const PRODUCTION_STATUSES = [
  'Draft',
  'Approved',
  'Not Started',
  'Running',
  'In Progress',
  'Partially Completed',
  'Completed',
  'Verification Pending',
  'Verified',
  'PO Pending',
  'PO Created',
  'Closed',
];

export const STATUS_PILL = {
  Draft: 'bg-slate-50 text-slate-600 border-slate-200',
  Approved: 'bg-sky-50 text-sky-700 border-sky-200',
  'Not Started': 'bg-slate-50 text-slate-500 border-slate-200',
  Running: 'bg-blue-50 text-blue-600 border-blue-200',
  'In Progress': 'bg-blue-50 text-blue-600 border-blue-200',
  'Partially Completed': 'bg-amber-50 text-amber-700 border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'Verification Pending': 'bg-orange-50 text-orange-700 border-orange-200',
  Verified: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  'PO Pending': 'bg-purple-50 text-purple-700 border-purple-200',
  'PO Created': 'bg-teal-50 text-teal-700 border-teal-200',
  Closed: 'bg-zinc-100 text-zinc-600 border-zinc-300',
};

const FALLBACK_PILL = 'bg-slate-50 text-slate-500 border-slate-200';

export const statusPill = (status) => STATUS_PILL[status] || FALLBACK_PILL;

/** Statuses where daily production can no longer be recorded / edited. */
export const LOCKED_STATUSES = ['Verified', 'PO Pending', 'PO Created', 'Closed'];
export const ACTIVE_STATUSES = ['Running', 'In Progress', 'Partially Completed'];
export const AWAITING_START_STATUSES = ['Approved', 'Not Started'];

export const isLockedStatus = (s) => LOCKED_STATUSES.includes(s);
export const canApprove = (s) => s === 'Draft';
export const canStart = (s) => AWAITING_START_STATUSES.includes(s);
/** UI keeps editing conservative: only before production starts. */
export const canEditInstruction = (s) => s === 'Draft' || AWAITING_START_STATUSES.includes(s);
export const canMarkComplete = (s) => ACTIVE_STATUSES.includes(s);
export const canVerify = (s) => ACTIVE_STATUSES.includes(s) || s === 'Completed' || s === 'Verification Pending';
export const canGeneratePo = (s) => s === 'PO Pending' || s === 'Verified';

/** Human-readable error text from an ApiError, including field errors. */
export function errorText(err, fallback = 'Request failed') {
  if (!err) return fallback;
  const base = err.message || fallback;
  const payload = err.payload || {};
  const fields = payload.field_errors || payload.fieldErrors || null;
  if (fields && typeof fields === 'object') {
    const details = Object.entries(fields)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`)
      .join('; ');
    if (details && !base.includes(details)) return `${base} (${details})`;
  }
  return base;
}

/** Indian-format number; returns '—' for missing values (never a fake 0). */
export function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function listOf(res) {
  return Array.isArray(res) ? res : res?.results || [];
}
