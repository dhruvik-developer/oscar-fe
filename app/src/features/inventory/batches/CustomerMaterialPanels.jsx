import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useERP } from '../../../context/ERPContext';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';

const inputCls = 'w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-blue-500';

/** Receive a customer's own fabric: a customer-owned batch, no value, no journal. */
export function CustomerReceiptModal({ onClose, onDone }) {
  const { parties = [], items = [], locations = [] } = useERP() || {};
  const [form, setForm] = useState({ customerId: '', itemId: '', locationId: '', rolls: '', totalMeters: '', reference: '' });
  const [mode, setMode] = useState('bulk');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const godowns = locations.filter((l) => !String(l.code || '').startsWith('SYS-'));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const batch = await inventoryService.receiveCustomerMaterial({
        customerId: form.customerId,
        itemId: form.itemId,
        locationId: form.locationId,
        reference: form.reference,
        rolls: mode === 'takas' ? form.rolls.split(/[\s,]+/).filter(Boolean).map((m) => ({ meters: m })) : [],
        totalMeters: mode === 'bulk' ? form.totalMeters : undefined,
      });
      onDone(batch);
    } catch (err) {
      setError(describeApiError(err) || 'The receipt could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cust-receipt-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg text-xs">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 id="cust-receipt-title" className="text-sm font-bold">Receive fabric batch</h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block"><span className="block font-semibold mb-1">Customer *</span>
            <select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className={inputCls}>
              <option value="">Select customer</option>
              {parties.filter((p) => /customer|both/i.test(p.type || '')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <label className="block"><span className="block font-semibold mb-1">Fabric *</span>
            <select required value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} className={inputCls}>
              <option value="">Select fabric</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select></label>
          <label className="block"><span className="block font-semibold mb-1">Stored at *</span>
            <select required value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={inputCls}>
              <option value="">Select godown</option>
              {godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></label>
          <label className="block"><span className="block font-semibold mb-1">Customer challan / reference</span>
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputCls} /></label>
          <fieldset className="sm:col-span-2">
            <legend className="font-semibold mb-1">Quantity</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="radio" name="cmode" checked={mode === 'bulk'} onChange={() => setMode('bulk')} /> Total metres, takas later</label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="radio" name="cmode" checked={mode === 'takas'} onChange={() => setMode('takas')} /> Each taka now</label>
            </div>
            {mode === 'bulk' ? (
              <input required type="number" min="0.0001" step="any" value={form.totalMeters} onChange={(e) => setForm({ ...form, totalMeters: e.target.value })} placeholder="Total metres, e.g. 1000" className={inputCls} aria-label="Total metres" />
            ) : (
              <input required value={form.rolls} onChange={(e) => setForm({ ...form, rolls: e.target.value })} placeholder="Metres per taka, e.g. 102, 98.5, 110" className={inputCls} aria-label="Metres per taka" />
            )}
          </fieldset>
          <p className="sm:col-span-2 text-[11px] text-slate-500">Fabric batch receives its own batch and QR tag for tracking.</p>
          {error && <div role="alert" className="sm:col-span-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">{saving ? 'Saving…' : 'Receive'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

const STATES = [
  ['available', 'Ready'],
  ['reserved', 'Reserved'],
  ['qcHold', 'QC Hold'],
  ['withJobWorker', 'At job worker'],
  ['rework', 'Rework'],
  ['secondQuality', 'Second'],
  ['rejected', 'Rejected'],
];

/** Everything physically in OSCAR's custody: own stock vs each customer's material. */
export function PhysicalStockSummary() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    inventoryService.getPhysicalStock()
      .then((res) => setRows(res?.results || []))
      .catch((err) => setError(describeApiError(err) || 'Physical stock could not be loaded.'));
  }, []);
  if (error) return <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>;
  if (!rows) return <p className="text-xs text-slate-400 p-3">Loading physical stock…</p>;
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[820px] text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Owner</th>
            <th className="px-3 py-2 text-right">Batches</th>
            {STATES.map(([, label]) => <th key={label} className="px-3 py-2 text-right">{label}</th>)}
            <th className="px-3 py-2 text-right">In hand</th>
            <th className="px-3 py-2 text-right">Delivered back</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && <tr><td colSpan={STATES.length + 4} className="px-3 py-6 text-center text-slate-400">Nothing in stock.</td></tr>}
          {rows.map((r) => (
            <tr key={`${r.ownership}-${r.ownerPartyId || ''}`}>
              <td className="px-3 py-2 font-semibold">{r.ownership === 'OSCAR' ? 'OSCAR Stock' : (r.ownerPartyName || 'Stock')}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.batches}</td>
              {STATES.map(([key]) => <td key={key} className="px-3 py-2 text-right tabular-nums">{formatNumberIN(r[key])}</td>)}
              <td className="px-3 py-2 text-right tabular-nums font-bold">{formatNumberIN(r.inHand)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.ownership === 'OSCAR' ? '—' : formatNumberIN(r.deliveredBack)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Hand a customer's material back to them (roll by roll, partial allowed). */
export function DeliverToOwnerForm({ batch, onDone }) {
  const rolls = (batch.takas || []).filter((t) => Number(t.availableQuantity) > 0 && !String(t.locationCode || '').startsWith('SYS-'));
  const [qty, setQty] = useState({});
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await inventoryService.deliverToOwner(batch.batchCode, {
        rolls: Object.entries(qty).filter(([, v]) => Number(v) > 0).map(([lotTakaId, v]) => ({ lotTakaId, qty: v })),
        reference,
      });
      setQty({});
      onDone(res);
    } catch (err) {
      setError(describeApiError(err) || 'The delivery could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  if (rolls.length === 0) return <p className="text-xs text-slate-400">No rolls of this batch are ready in a godown.</p>;
  return (
    <form onSubmit={submit} className="space-y-2 text-xs">
      <table className="w-full">
        <thead className="text-[10px] uppercase text-slate-400"><tr><th className="text-left py-1">Roll</th><th className="text-left py-1">At</th><th className="text-right py-1">In hand</th><th className="text-right py-1 w-28">Deliver</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rolls.map((t) => (
            <tr key={t.id}>
              <td className="py-1.5 font-mono">{t.takaId}</td>
              <td className="py-1.5">{t.location}</td>
              <td className="py-1.5 text-right tabular-nums">{formatNumberIN(t.availableQuantity)}</td>
              <td className="py-1.5 text-right">
                <input type="number" min="0" step="any" max={t.availableQuantity} aria-label={`Deliver quantity for ${t.takaId}`} value={qty[t.id] ?? ''} onChange={(e) => setQty({ ...qty, [t.id]: e.target.value })} className="w-24 h-8 px-2 rounded-md border border-slate-200 text-right" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2 items-center">
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Delivery challan / reference" className="h-9 px-3 rounded-lg border border-slate-200 flex-1 min-w-48" />
        <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">{saving ? 'Saving…' : 'Deliver to owner'}</button>
      </div>
      {error && <div role="alert" className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
    </form>
  );
}
