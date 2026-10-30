import React, { useState } from 'react';
import { inventoryService } from '../../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../../accounts/accountingShared';

export const inputCls = 'w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-blue-500';
export const btnPrimary = 'h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer';
export const btnDark = 'h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer';
export const btnGhost = 'h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer';

export const godownsOf = (locations = []) => locations.filter((l) => !String(l.code || '').startsWith('SYS-'));

/** A white card with a title row; `actions` sit on the right. */
export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-xl p-4 text-xs ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="py-6 text-center text-slate-400">{children}</p>;
}

export function Notice({ kind = 'error', children }) {
  if (!children) return null;
  const cls = kind === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : kind === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`p-2.5 rounded-lg border text-xs ${cls}`}>{children}</div>;
}

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block font-semibold text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

/** Small figure tile. */
export function Stat({ label, value, uom, tone = 'text-slate-900' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${tone}`}>{formatNumberIN(value)}</div>
      {uom && <div className="text-[10px] text-slate-400">{uom}</div>}
    </div>
  );
}

/** Table with a horizontal scroll on small screens. */
export function Table({ head, children, minWidth = 640 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth }}>
        <thead className="text-[10px] uppercase text-slate-400 bg-slate-50">
          <tr>{head.map(([label, align]) => <th key={label} className={`px-2 py-2 ${align === 'r' ? 'text-right' : 'text-left'}`}>{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

/**
 * Run a Batch 360 action and hand the refreshed batch back.
 * `run(action, payload)` posts to /inventory/batches/<code>/actions/<action>/;
 * `wrap(promiseFn)` runs any other call that returns (or reloads) the batch.
 */
export function useBatchAction(batch, onBatch) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const wrap = async (fn, success) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await fn();
      if (next?.batchCode) onBatch(next);
      if (success) setNotice(typeof success === 'function' ? success(next) : success);
      return next;
    } catch (err) {
      setError(describeApiError(err) || 'That could not be saved.');
      return null;
    } finally {
      setBusy(false);
    }
  };
  const run = (action, payload, success) => wrap(() => inventoryService.batchAction(batch.batchCode, action, payload), success);
  const reload = () => inventoryService.getBatch(batch.batchCode);
  return { busy, error, notice, setError, setNotice, run, wrap, reload };
}

/** Rolls of the batch matching `test`, with metres in hand. */
export const rollsWhere = (batch, test) => (batch.takas || []).filter((t) => Number(t.availableQuantity) > 0 && test(t));
export const inGodown = (t) => !String(t.locationCode || '').startsWith('SYS-');
