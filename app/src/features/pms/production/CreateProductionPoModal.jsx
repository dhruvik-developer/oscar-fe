import React, { useMemo, useState } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import { useERP } from '../../../context/ERPContext';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Vendor A Production PO -- the first stage of a project's production run,
 * created inside the PMS project slide. Same server path as the Purchase
 * screen's Create PO (ERPContext addPurchaseOrder -> POST /purchase/orders/):
 * Draft, PO number series and rate checks on the server; approval follows the
 * normal purchase flow before the Production Work Instruction is raised.
 */
export function CreateProductionPoModal({ project, defaultQty, onClose, onCreated }) {
  const { vendors = [], items = [], addPurchaseOrder } = useERP();
  const [vendorId, setVendorId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState(defaultQty ? String(defaultQty) : '');
  const [rate, setRate] = useState('');
  const [poDate, setPoDate] = useState(todayISO);
  const [expectedDate, setExpectedDate] = useState(() => addDays(todayISO(), 10));
  const [notes, setNotes] = useState(`Vendor A production for project ${project?.code || project?.name || ''}`.trim());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const item = useMemo(() => items.find((i) => String(i.id) === String(itemId)), [items, itemId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!vendorId) return setError('Select the vendor / agency.');
    if (!itemId) return setError('Select the fabric item.');
    if (!(Number(qty) > 0) || !(Number(rate) > 0)) return setError('Enter a quantity and rate greater than zero.');
    if (!poDate || !expectedDate) return setError('Enter the PO date and expected date.');
    setSaving(true);
    try {
      const saved = await addPurchaseOrder({
        vendorId,
        date: poDate,
        expectedDate,
        status: 'Draft',
        purchaseType: 'Vendor A Production',
        projectId: project?.id,
        items: [{
          itemId,
          sku: item?.sku || '',
          name: item?.name || '',
          qty: Number(qty),
          rate: Number(rate),
          amount: Number(qty) * Number(rate),
          uom: item?.purchaseUnit || item?.uom || 'Mtr',
          tax: 0,
          discount: 0,
        }],
        notes,
      });
      onCreated?.(saved);
    } catch (err) {
      setError(err?.message || 'The purchase order was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800';
  const label = 'block font-semibold text-slate-700 mb-1';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 text-xs">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-amber-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">Purchase Order — Vendor A Production</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-slate-500">
            Project: <strong className="text-slate-800">{project?.code || project?.name}</strong> · saved as Draft. After approval the Production Work Instruction is raised from this PO.
          </div>
          <label className="block">
            <span className="flex items-baseline justify-between">
              <span className={label}>Vendor / Agency</span>
              <MasterSourceLink source="vendors" />
            </span>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={field}>
              <option value="">Select…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between">
              <span className={label}>Fabric Item</span>
              <MasterSourceLink source="items" />
            </span>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={field}>
              <option value="">Select…</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.sku ? ` (${i.sku})` : ''}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className={label}>Quantity (m)</span><input type="number" min="0" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className={`${field} font-mono`} /></label>
            <label><span className={label}>Rate (₹/m)</span><input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className={`${field} font-mono`} /></label>
            <label><span className={label}>PO Date</span><input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={field} /></label>
            <label><span className={label}>Expected Date</span><input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={field} /></label>
          </div>
          <label className="block">
            <span className={label}>Notes</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
          </label>
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold">Cancel</button>
          <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-60">
            {saving ? 'Saving…' : 'Create PO'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateProductionPoModal;
