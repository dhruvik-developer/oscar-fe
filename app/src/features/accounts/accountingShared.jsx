import KpiCard from '../../components/ui/KpiCard';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';

/**
 * Shared helpers for the accounting / reports screens.
 * Every figure rendered through these comes straight from the server --
 * nothing here invents, defaults or recomputes a business number.
 */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹ in Indian grouping; a value the server did not send renders as an em dash. */
export function formatINR(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return INR.format(n);
}

export function formatNumberIN(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function formatDate(value) {
  if (!value) return '—';
  return formatDateDDMMYYYY(String(value).slice(0, 10));
}

/** List endpoints answer with the envelope ({results, count, aggregates}). */
export function unwrapList(response) {
  if (Array.isArray(response)) return response;
  return Array.isArray(response?.results) ? response.results : [];
}

/** Walk every page of an envelope list (page_size is capped at 200 server-side). */
export async function fetchAllPages(api, endpoint, query = {}) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await api.get(endpoint, { query: { ...query, page, page_size: 200 } });
    rows.push(...unwrapList(res));
    if (!res?.next || Array.isArray(res)) break;
    page += 1;
  }
  return rows;
}

/**
 * GET one endpoint and keep {data, loading, error, reload}. A failed request
 * clears `data` -- a stale or invented figure is never left on screen.
 */
export function useApiGet(path, query, { enabled = true } = {}) {
  const queryKey = JSON.stringify(query || {});
  const [state, setState] = useState({ data: null, loading: enabled, error: '' });

  const reload = useCallback(async () => {
    if (!enabled || !path) return;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await api.get(path, { query: JSON.parse(queryKey) });
      setState({ data, loading: false, error: '' });
    } catch (err) {
      setState({ data: null, loading: false, error: describeApiError(err) });
    }
  }, [path, queryKey, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Money compared in paise so 0.1 + 0.2 style float drift never blocks a balanced entry. */
export function toPaise(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * The API client surfaces `message`; validation failures carry the detail in
 * `field_errors` ({ lines: ["Entry does not balance ..."] }), so show both.
 */
export function describeApiError(err) {
  if (!err) return '';
  const base = err.message || 'Request failed.';
  const fieldErrors = err.payload?.field_errors || err.payload?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const details = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(' ') : String(msgs)}`)
      .join(' · ');
    if (details) return `${base} ${details}`;
  }
  if (err.payload?.detail && err.payload.detail !== base) return `${base} ${err.payload.detail}`;
  return base;
}

export const inputClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';

export const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1';

export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`bg-white border border-[#dce5f4] rounded-xl ${className}`}>
      {(title || actions) && (
        <div className="px-4 sm:px-5 py-3 border-b border-[#dce5f4] flex flex-wrap items-center justify-between gap-2">
          <div>
            {title && <h3 className="font-bold text-sm text-slate-800">{title}</h3>}
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function ErrorState({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" role="alert">
      <span className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:underline cursor-pointer">
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-xs text-slate-400">{message}</td>
    </tr>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 no-print">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition border ${
            active === tab.id
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-600 border-[#dce5f4] hover:bg-slate-50'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Kpi({ label, value, note, tone = 'text-slate-800' }) {
  const selectedTone = tone.includes('rose') || tone.includes('red') ? 'rose' : tone.includes('emerald') || tone.includes('green') ? 'emerald' : tone.includes('amber') ? 'amber' : 'blue';
  return (
    <KpiCard
      label={label}
      value={value}
      sub={note}
      tone={selectedTone}
    />
  );
}

export const thClass = 'py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500';
