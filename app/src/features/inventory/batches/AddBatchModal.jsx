import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Layers, Palette, Plus } from 'lucide-react';
import { useERP } from '../../../context/ERPContext';
import { api } from '../../../services/api';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError } from '../../accounts/accountingShared';

const inputCls = 'w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-blue-500';
const METHODS = [
  ['manual', 'Manual entry', 'Opening stock, stock found on a count, or fabric bought / made outside the system.'],
  ['production', 'In-house production', 'Weave / knit grey fabric: enter yarn and production day by day.'],
  ['auto', 'From PO / GRN (automatic)', 'Created by itself from the quantity actually received.'],

];

/** Fabric quality / design / shade masters, for the optional pickers. */
export function useTextileMasters() {
  const [masters, setMasters] = useState({ qualities: [], designs: [], shades: [] });
  useEffect(() => {
    let alive = true;
    const list = (path) => api.get(path, { query: { page_size: 500 } }).then((b) => b?.results || b || []).catch(() => []);
    Promise.all([list('/inventory/fabric-qualities/'), list('/inventory/designs/'), list('/inventory/shades/')])
      .then(([qualities, designs, shades]) => { if (alive) setMasters({ qualities, designs, shades }); });
    return () => { alive = false; };
  }, []);
  return masters;
}

/**
 * Create a batch. The batch code is never typed: the server generates it
 * (OSCAR-GRY-<year>-<n> for grey, OSCAR-DYD-… for dyed). Batches from a PO
 * are made automatically from the goods actually received (GRN), so a
 * partial delivery never counts the PO quantity as stock.
 */
export default function AddBatchModal({ onClose, onDone, defaultFabricType = 'GREY' }) {
  const { items = [], locations = [], parties = [] } = useERP() || {};
  const { qualities, designs, shades } = useTextileMasters();
  const godowns = locations.filter((l) => !String(l.code || '').startsWith('SYS-'));
  const fabrics = items.filter((i) => ['LOT', 'TAKA'].includes(String(i.trackingType || '').toUpperCase()) || /fabric/i.test(i.itemKind || ''));
  const [method, setMethod] = useState('manual');
  const [form, setForm] = useState({
    fabricType: defaultFabricType || 'GREY', itemId: '', locationId: '', rolls: '', totalMeters: '', rate: '', reason: '', reference: '',
    supplierId: '', fabricQualityId: '', designId: '', shadeId: '', width: '', gsm: '', date: '', qc: 'later', hsnCode: '',
  });
  const [run, setRun] = useState({ outputItemId: '', plannedQty: '', runDate: '', customerId: '', machine: '', fabricQualityId: '', shadeId: '', width: '', gsm: '' });
  // 'bulk': the batch is entered as total metres and takas are registered later.
  const [mode, setMode] = useState('bulk');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setR = (key) => (e) => setRun({ ...run, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (method === 'production') {
        const created = await inventoryService.createProductionRun({
          ...run, openBatch: true, runDate: run.runDate || undefined, customerId: run.customerId || undefined,
          fabricQualityId: run.fabricQualityId || undefined, shadeId: run.shadeId || undefined,
          width: run.width || undefined, gsm: run.gsm || undefined,
        });
        onDone({ batchCode: created.batchCode }, 'production');
        return;
      }
      const { qc, ...rest } = form;
      const batch = await inventoryService.createBatch({
        ...rest,
        hsnCode: itemHsn(form.itemId) ? undefined : form.hsnCode.trim() || undefined,
        sendToQc: qc === 'now',
        rolls: mode === 'takas' ? form.rolls.split(/[\s,]+/).filter(Boolean).map((m) => ({ meters: m })) : [],
        totalMeters: mode === 'bulk' ? form.totalMeters : undefined,
        supplierId: form.supplierId || undefined,
        fabricQualityId: form.fabricQualityId || undefined,
        designId: form.designId || undefined,
        shadeId: form.shadeId || undefined,
        date: form.date || undefined,
        width: form.width || undefined,
        gsm: form.gsm || undefined,
      });
      onDone(batch, qc === 'now' ? 'qc' : 'overview');
    } catch (err) {
      setError(describeApiError(err) || 'The batch could not be added.');
    } finally {
      setSaving(false);
    }
  };

  // HSN lives on the fabric's item master: shown here when it has one, typed
  // here (and saved to the item master) when it has none yet.
  const itemHsn = (itemId) => items.find((i) => String(i.id) === String(itemId))?.hsnCode || '';
  const hsnField = (itemId, value, onChange) => {
    const known = itemHsn(itemId);
    if (!onChange) {
      return (
        <label className="block"><span className="block font-semibold mb-1">HSN code</span>
          <input disabled value={known} placeholder={itemId ? 'Not set' : 'Select fabric first'} className={`${inputCls} font-mono disabled:bg-slate-50 disabled:text-slate-600`} />
          {itemId && !known && <span className="block mt-1 text-[11px] text-amber-700">No HSN on this fabric — add it in the item master.</span>}
        </label>
      );
    }
    return (
      <label className="block"><span className="block font-semibold mb-1">HSN code *</span>
        <input
          required={!!itemId} disabled={!itemId || !!known} value={known || value} onChange={onChange}
          placeholder={itemId ? 'e.g. 52083190' : 'Select fabric first'} className={`${inputCls} font-mono disabled:bg-slate-50 disabled:text-slate-600`}
        />
        <span className="block mt-1 text-[11px] text-slate-500">
          {known ? "From the fabric's item master — change it there." : itemId ? "Saved to this fabric's item master." : "Comes from the fabric you select."}
        </span></label>
    );
  };
  const fabricLabel = (i) => (i.hsnCode ? `${i.name} · HSN ${i.hsnCode}` : i.name);

  const masterSelect = (label, value, onChange, rows) => (
    <label className="block"><span className="block font-semibold mb-1">{label}</span>
      <select value={value} onChange={onChange} className={inputCls}>
        <option value="">—</option>
        {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select></label>
  );

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="add-batch-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col text-xs">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold shrink-0">
              {form.fabricType === 'GREY' ? <Layers size={17} /> : <Palette size={17} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="add-batch-title" className="text-sm font-bold text-slate-900">
                  {form.fabricType === 'GREY' ? 'Add Grey Batch' : 'Add Dyeing Batch'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-sky-50 text-sky-700 border-sky-200">
                  {form.fabricType === 'GREY' ? 'Grey Inventory' : 'Dyeing Inventory'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                The batch ID and QR code are generated automatically when you save.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center cursor-pointer transition-colors text-slate-500"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <legend className="sr-only">How is this batch created?</legend>
            {METHODS.map(([key, label, hint]) => (
              <label key={key} className={`p-3 rounded-xl border cursor-pointer ${method === key ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="flex items-center gap-2 font-semibold text-slate-800">
                  <input type="radio" name="method" checked={method === key} onChange={() => setMethod(key)} className="accent-blue-600" /> {label}
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">{hint}</span>
              </label>
            ))}
          </fieldset>

          {method === 'auto' && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 space-y-1">
              <p>Batches from purchase are created automatically when goods are received. Each PO gets one batch per HSN code; every receipt against it — partial or repeat — joins the batch of its HSN, and only the metres actually received count as stock (never the ordered quantity).</p>
              <p>Received fabric waits at QC Hold for the purchase QC. <Link to="/purchase/receipts" className="font-bold underline">Open Goods Receipts</Link></p>
            </div>
          )}

          

          {method === 'production' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <p className="sm:col-span-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                Opens a production run and its Grey Fabric batch together. Then, on the batch&apos;s Daily Production and Yarn tabs, issue yarn and enter each day&apos;s rolls; complete the run to book the cost.
              </p>
              <label className="block sm:col-span-2"><span className="block font-semibold mb-1">Fabric to produce *</span>
                <select required value={run.outputItemId} onChange={setR('outputItemId')} className={inputCls}>
                  <option value="">Select fabric</option>
                  {fabrics.map((i) => <option key={i.id} value={i.id}>{fabricLabel(i)}</option>)}
                </select></label>
              {hsnField(run.outputItemId)}
              <label className="block"><span className="block font-semibold mb-1">Planned quantity (m) *</span>
                <input required type="number" min="0.01" step="any" value={run.plannedQty} onChange={setR('plannedQty')} className={inputCls} /></label>
              <label className="block"><span className="block font-semibold mb-1">Start date</span>
                <input type="date" value={run.runDate} onChange={setR('runDate')} className={inputCls} /></label>
              {masterSelect('Fabric quality', run.fabricQualityId, setR('fabricQualityId'), qualities)}
              {masterSelect('Shade', run.shadeId, setR('shadeId'), shades)}
              <label className="block"><span className="block font-semibold mb-1">Machine / loom</span>
                <input value={run.machine} onChange={setR('machine')} className={inputCls} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="block font-semibold mb-1">Width</span><input type="number" min="0" step="any" value={run.width} onChange={setR('width')} className={inputCls} /></label>
                <label className="block"><span className="block font-semibold mb-1">GSM</span><input type="number" min="0" step="any" value={run.gsm} onChange={setR('gsm')} className={inputCls} /></label>
              </div>
            </div>
          )}

          {method === 'manual' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <fieldset className="sm:col-span-2">
                <legend className="font-semibold mb-1 text-slate-700">Fabric type *</legend>
                <div className="flex items-center gap-2.5">
                  <label
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                      form.fabricType === 'GREY'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-800 font-bold shadow-2xs'
                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="fabricType"
                      checked={form.fabricType === 'GREY'}
                      onChange={() => setForm({ ...form, fabricType: 'GREY' })}
                      className="accent-blue-600"
                    />
                    <Layers size={13} className={form.fabricType === 'GREY' ? 'text-blue-600' : 'text-slate-400'} />
                    <span>Grey fabric</span>
                  </label>
                  <label
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                      form.fabricType === 'DYED'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-800 font-bold shadow-2xs'
                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="fabricType"
                      checked={form.fabricType === 'DYED'}
                      onChange={() => setForm({ ...form, fabricType: 'DYED' })}
                      className="accent-blue-600"
                    />
                    <Palette size={13} className={form.fabricType === 'DYED' ? 'text-blue-600' : 'text-slate-400'} />
                    <span>Dyed fabric</span>
                  </label>
                </div>
              </fieldset>
              <label className="block"><span className="block font-semibold mb-1">Fabric *</span>
                <select required value={form.itemId} onChange={set('itemId')} className={inputCls}>
                  <option value="">Select fabric</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{fabricLabel(i)}</option>)}
                </select></label>
              {hsnField(form.itemId, form.hsnCode, set('hsnCode'))}
              <label className="block"><span className="block font-semibold mb-1">Godown *</span>
                <select required value={form.locationId} onChange={set('locationId')} className={inputCls}>
                  <option value="">Select godown</option>
                  {godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select></label>
              {masterSelect('Fabric quality', form.fabricQualityId, set('fabricQualityId'), qualities)}
              {masterSelect('Design', form.designId, set('designId'), designs)}
              {masterSelect(form.fabricType === 'DYED' ? 'Shade / colour' : 'Shade (if any)', form.shadeId, set('shadeId'), shades)}
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="block font-semibold mb-1">Width</span>
                  <input type="number" min="0" step="any" value={form.width} onChange={set('width')} className={inputCls} /></label>
                <label className="block"><span className="block font-semibold mb-1">GSM</span>
                  <input type="number" min="0" step="any" value={form.gsm} onChange={set('gsm')} className={inputCls} /></label>
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="font-semibold mb-1">Quantity *</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="radio" name="mode" checked={mode === 'bulk'} onChange={() => setMode('bulk')} className="accent-blue-600" /> Total metres now, register takas later</label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="radio" name="mode" checked={mode === 'takas'} onChange={() => setMode('takas')} className="accent-blue-600" /> Enter each taka now</label>
                </div>
                {mode === 'bulk' ? (
                  <input required type="number" min="0.0001" step="any" value={form.totalMeters} onChange={set('totalMeters')} placeholder="Total metres in the batch, e.g. 1000" className={inputCls} aria-label="Total metres" />
                ) : (
                  <input required value={form.rolls} onChange={set('rolls')} placeholder="Metres per taka, e.g. 102, 98.5, 110" className={inputCls} aria-label="Metres per taka" />
                )}
              </fieldset>
              <label className="block"><span className="block font-semibold mb-1">Purchase rate / cost per metre (₹) *</span>
                <input required type="number" min="0.01" step="any" value={form.rate} onChange={set('rate')} className={inputCls} /></label>
              <label className="block"><span className="block font-semibold mb-1">Date</span>
                <input type="date" value={form.date} onChange={set('date')} className={inputCls} /></label>
              <label className="block"><span className="block font-semibold mb-1">Vendor (if bought)</span>
                <select value={form.supplierId} onChange={set('supplierId')} className={inputCls}>
                  <option value="">—</option>
                  {parties.filter((p) => /vendor|both/i.test(p.type || '')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <label className="block"><span className="block font-semibold mb-1">Reference (bill / challan no.)</span>
                <input value={form.reference} onChange={set('reference')} className={inputCls} /></label>
              <label className="block sm:col-span-2"><span className="block font-semibold mb-1">Source / reason *</span>
                <input required value={form.reason} onChange={set('reason')} placeholder="e.g. Opening stock as on 1 Apr; bought from market" className={inputCls} /></label>
              <fieldset className="sm:col-span-2">
                <legend className="font-semibold mb-1">QC</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="radio" name="qc" checked={form.qc === 'later'} onChange={() => setForm({ ...form, qc: 'later' })} className="accent-blue-600" /> No QC now — usable as “Not inspected” (QC can be done any time)</label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="radio" name="qc" checked={form.qc === 'now'} onChange={() => setForm({ ...form, qc: 'now' })} className="accent-blue-600" /> Hold for QC before use</label>
                </div>
              </fieldset>
            </div>
          )}
          {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer hover:bg-slate-50 transition-colors">Cancel</button>
          {(method === 'manual' || method === 'production') && (
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60 cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} />
              {saving
                ? 'Saving…'
                : method === 'production'
                  ? 'Start production batch'
                  : form.fabricType === 'GREY'
                    ? 'Add Grey Batch'
                    : 'Add Dyeing Batch'}
            </button>
          )}
        </div>
      </form>
    </div>,
    document.body,
  );
}
