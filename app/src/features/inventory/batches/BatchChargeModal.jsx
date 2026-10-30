import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatINR } from '../../accounts/accountingShared';

const COST_TYPES = [
  'Processing transport',
  'Purchase freight/loading',
  'Dyeing/Printing/Finishing',
  'Reprocess',
  'Other direct',
];
const BASES = [
  ['METER', 'By metres in hand'],
  ['TAKA', 'By takas in hand'],
  ['MANUAL', 'Enter each batch’s share'],
];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const inputCls = 'w-full h-9 px-3 rounded-lg border border-border bg-card text-xs focus:outline-none focus:border-primary';

/**
 * Split one charge (a tempo's freight, a dyeing bill, loading…) over the
 * chosen batches. The user decides the basis; the server books each share as
 * a batch cost and refuses the same reference twice.
 */
export default function BatchChargeModal({ batches, onClose, onDone }) {
  const [form, setForm] = useState({ costType: COST_TYPES[0], amount: '', basis: 'METER', reference: '', remarks: '' });
  const [manual, setManual] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    const amount = num(form.amount);
    if (form.basis === 'MANUAL') return batches.map((b) => num(manual[b.batchCode]));
    const weights = batches.map((b) => (form.basis === 'METER'
      ? num(b.quantities?.onHand)
      : num(b.takaCount)));
    const total = weights.reduce((s, w) => s + w, 0);
    return weights.map((w) => (total > 0 ? Math.round((amount * w / total) * 100) / 100 : 0));
  }, [batches, form.amount, form.basis, manual]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await inventoryService.allocateBatchCharge({
        batches: batches.map((b) => b.batchCode),
        amount: form.amount,
        costType: form.costType,
        basis: form.basis,
        manual: form.basis === 'MANUAL' ? manual : undefined,
        reference: form.reference,
        remarks: form.remarks,
      });
      onDone?.(res?.allocations || []);
    } catch (err) {
      setError(describeApiError(err) || 'The charge could not be posted.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="batch-charge-title" className="bg-card text-text rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 id="batch-charge-title" className="text-sm font-bold">Add charge to {batches.length} batch{batches.length === 1 ? '' : 'es'}</h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg text-muted hover:bg-soft cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block font-semibold mb-1">Charge type</span>
              <select value={form.costType} onChange={(e) => setForm({ ...form, costType: e.target.value })} className={inputCls}>
                {COST_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Amount (₹) *</span>
              <input required type="number" min="0.01" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Reference (bill / LR / trip no.)</span>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputCls} placeholder="Stops the same bill being charged twice" />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Remarks</span>
              <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={inputCls} />
            </label>
          </div>
          <fieldset>
            <legend className="font-semibold mb-1">Split</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {BASES.map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="basis" value={value} checked={form.basis === value} onChange={() => setForm({ ...form, basis: value })} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <table className="w-full">
            <thead className="text-[10px] uppercase text-muted">
              <tr><th className="text-left py-1">Batch</th><th className="text-right py-1">In hand</th><th className="text-right py-1">Takas</th><th className="text-right py-1 w-32">Share</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {batches.map((b, i) => (
                <tr key={b.batchCode}>
                  <td className="py-1.5 font-mono">{b.batchCode}</td>
                  <td className="py-1.5 text-right tabular-nums">{num(b.quantities?.onHand).toLocaleString('en-IN')}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.takaCount}</td>
                  <td className="py-1.5 text-right">
                    {form.basis === 'MANUAL' ? (
                      <input type="number" min="0" step="any" aria-label={`Share for ${b.batchCode}`} value={manual[b.batchCode] ?? ''} onChange={(e) => setManual({ ...manual, [b.batchCode]: e.target.value })} className="w-28 h-8 px-2 rounded-md border border-border bg-card text-right" />
                    ) : (
                      <span className="tabular-nums">{formatINR(preview[i])}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted">The preview counts takas in hand only approximately; the server makes the final split and books each share as a batch cost.</p>
          {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-soft cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">{saving ? 'Posting…' : 'Post charge'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
