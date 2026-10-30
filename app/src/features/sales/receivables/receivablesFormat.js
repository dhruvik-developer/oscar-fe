// Shared formatting and constants for the customer payments screens.
import { useAppStore } from '../../../stores/appStore';

export const PAYMENT_MODES = ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Card', 'Bank'];

export const INVOICE_STATUSES = ['Unpaid', 'Partially Paid', 'Paid', 'Due', 'Overdue'];
export const DISCOUNT_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Cancelled'];

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export function money(value) {
  const n = Number(value);
  return inr.format(Number.isFinite(n) ? n : 0);
}

export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** '2026-10-28' -> '28-10-2026'; anything unparsable comes back as given. */
export function date(value) {
  if (!value) return '—';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(value);
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso, days) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const out = new Date(y, m - 1, d + Number(days || 0));
  return `${out.getFullYear()}-${String(out.getMonth() + 1).padStart(2, '0')}-${String(out.getDate()).padStart(2, '0')}`;
}

export function daysBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const a = new Date(`${String(fromIso).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(toIso).slice(0, 10)}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

export const STATUS_TONE = {
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-200',
  Unpaid: 'bg-slate-50 text-slate-700 border-slate-200',
  Overdue: 'bg-rose-50 text-rose-700 border-rose-200',
  Draft: 'bg-slate-50 text-slate-600 border-slate-200',
  Submitted: 'bg-sky-50 text-sky-700 border-sky-200',
  'Under Review': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function errorText(err, fallback = 'Something went wrong. Please try again.') {
  return err?.message || err?.payload?.message || fallback;
}

/** Permission check matching the server: superusers and '*' pass everything. */
export function useCan() {
  const permissions = useAppStore((s) => s.permissions) || [];
  const user = useAppStore((s) => s.currentUser);
  return (code) => Boolean(
    user?.is_superuser || user?.isSuperuser || permissions.includes('*') || permissions.includes(code),
  );
}

export function newIdempotencyKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
