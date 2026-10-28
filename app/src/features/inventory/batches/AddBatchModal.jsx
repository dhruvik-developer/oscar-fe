import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useERP } from '../../../context/ERPContext';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError } from '../../accounts/accountingShared';

const inputCls = 'w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-blue-500';

/**
 * Add a batch by hand. The batch code is never typed: the server generates it
 * (OSCAR-GRY-<year>-<n>). OSCAR's own fabric needs a value per metre and a
 * reason (it posts stock, batch cost and a stock-adjustment journal);
 * customer material goes through the customer receipt instead.
 */
export default function AddBatchModal({ onClose, onDone, onCustomerMaterial }) {
  const { items = [], locations = [], parties = [] } = useERP() || {};
  const godowns = locations.filter((l) => !String(l.code || '').startsWith('SYS-'));
  const [form, setForm] = useState({
    itemId: '', locationId: '', rolls: '', totalMeters: '', rate: '', reason: '', supplierId: '', width: '', gsm: '', date: '', sendToQc: false,
  });
  // 'bulk': the batch is entered as total metres and takas are registered later.
  const [mode, setMode] = useState('bulk');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const batch = await inventoryService.createBatch({
        ...form,
        rolls: mode === 'takas' ? form.rolls.split(/[\s,]+/).filter(Boolean).map((m) => ({ meters: m })) : [],
        totalMeters: mode === 'bulk' ? form.totalMeters : undefined,
        supplierId: form.supplierId || undefined,
        date: form.date || undefined,
        width: form.width || undefined,
        gsm: form.gsm || undefined,
      });
      onDone(batch);
    } catch (err) {
      setError(describeApiError(err) || 'The batch could not be added.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="add-batch-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col text-xs">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div>
            <h3 id="add-batch-title" className="text-sm font-bold">Add batch</h3>
            <p className="text-[11px] text-slate-500">Batch ID is generated automatically when you save (e.g. OSCAR-GRY-2026-0001).</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <p className="sm:col-span-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
            This adds OSCAR&apos;s own fabric (opening stock or stock found on a count). For a customer&apos;s material use{' '}
            <button type="button" onClick={onCustomerMaterial} className="font-bold underline cursor-pointer">Receive customer material</button>.
          </p>
          <label className="block"><span className="block font-semibold mb-1">Fabric *</span>
            <select required value={form.itemId} onChange={set('itemId')} className={inputCls}>
              <option value="">Select fabric</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select></label>
          <label className="block"><span className="block font-semibold mb-1">Godown *</span>
            <select required value={form.locationId} onChange={set('locationId')} className={inputCls}>
              <option value="">Select godown</option>
              {godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></label>
          <fieldset className="sm:col-span-2">
            <legend className="font-semibold mb-1">Quantity</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="radio" name="mode" checked={mode === 'bulk'} onChange={() => setMode('bulk')} /> Total metres now, register takas later</label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="radio" name="mode" checked={mode === 'takas'} onChange={() => setMode('takas')} /> Enter each taka now</label>
            </div>
            {mode === 'bulk' ? (
              <input required type="number" min="0.0001" step="any" value={form.totalMeters} onChange={set('totalMeters')} placeholder="Total metres in the batch, e.g. 1000" className={inputCls} aria-label="Total metres" />
            ) : (
              <input required value={form.rolls} onChange={set('rolls')} placeholder="Metres per taka, e.g. 102, 98.5, 110" className={inputCls} aria-label="Metres per taka" />
            )}
          </fieldset>
          <label className="block"><span className="block font-semibold mb-1">Value per metre (₹) *</span>
            <input required type="number" min="0.01" step="any" value={form.rate} onChange={set('rate')} className={inputCls} /></label>
          <label className="block"><span className="block font-semibold mb-1">Received / opening date</span>
            <input type="date" value={form.date} onChange={set('date')} className={inputCls} /></label>
          <label className="block"><span className="block font-semibold mb-1">Supplier (if known)</span>
            <select value={form.supplierId} onChange={set('supplierId')} className={inputCls}>
              <option value="">—</option>
              {parties.filter((p) => /vendor|both/i.test(p.type || '')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="block font-semibold mb-1">Width</span>
              <input type="number" min="0" step="any" value={form.width} onChange={set('width')} className={inputCls} /></label>
            <label className="block"><span className="block font-semibold mb-1">GSM</span>
              <input type="number" min="0" step="any" value={form.gsm} onChange={set('gsm')} className={inputCls} /></label>
          </div>
          <label className="block sm:col-span-2"><span className="block font-semibold mb-1">Reason *</span>
            <input required value={form.reason} onChange={set('reason')} placeholder="e.g. Opening stock as on 1 Apr" className={inputCls} /></label>
          <label className="sm:col-span-2 inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.sendToQc} onChange={set('sendToQc')} /> Hold for QC inspection before it can be used
          </label>
          {error && <div role="alert" className="sm:col-span-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">{saving ? 'Saving…' : 'Add batch'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
