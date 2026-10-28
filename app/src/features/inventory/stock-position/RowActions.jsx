import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';

const TEXT = {
  rework: { title: 'Route rejected stock to rework', help: 'The metres move to the Reprocess store and leave Scrap & Waste.', button: 'Route to rework', max: 'quantity' },
  dispose: { title: 'Approved disposal', help: 'Stock leaves at the roll’s cost (Dr Stock Adjustment, Cr Inventory). Give the approval reason.', button: 'Dispose', max: 'quantity' },
  sampleReturn: { title: 'Record sample return', help: 'Good returns go back to stock; Hold goes to QC; Reject / damaged goes to Reject stock.', button: 'Record return', max: 'outstanding' },
  sampleConsume: { title: 'Mark sample consumed', help: 'The outstanding quantity is written off as sample expense.', button: 'Mark consumed', max: 'outstanding' },
};

/** The few row actions the Stock Position screens offer, each wired to a real endpoint. */
export function RowActionModal({ action, onClose, onDone }) {
  const { kind, row } = action;
  const text = TEXT[kind];
  const max = Number(row[text.max] || 0);
  const [quantity, setQuantity] = useState(String(max));
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState('Good');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (kind === 'rework' || kind === 'dispose') {
        await inventoryService.stockPositionAction('scrap', kind === 'rework' ? 'route-rework' : 'dispose', {
          lotTakaId: row.lotTakaId, quantity, reason,
        });
      } else if (kind === 'sampleReturn') {
        await inventoryService.returnSampleAction(row.sampleId, { returnQuantity: quantity, condition, remarks: reason || undefined });
      } else {
        await inventoryService.consumeSampleAction(row.sampleId, { consumeQuantity: quantity, remarks: reason || undefined });
      }
      onDone(`${text.button}: ${formatNumberIN(quantity)} ${row.uom || ''} (${row.takaId || row.sampleNumber || row.batchCode}).`);
    } catch (err) {
      setError(describeApiError(err) || 'That could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const needsReason = kind === 'rework' || kind === 'dispose';
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="row-action-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-md text-xs">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 id="row-action-title" className="text-sm font-bold">{text.title}</h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-slate-500">{text.help}</p>
          <p className="font-semibold">{row.takaId || row.sampleNumber} · {row.batchCode || ''} · up to {formatNumberIN(max)} {row.uom || ''}</p>
          <label className="block"><span className="block font-semibold mb-1">Quantity *</span>
            <input required type="number" min="0.0001" max={max} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200" /></label>
          {kind === 'sampleReturn' && (
            <label className="block"><span className="block font-semibold mb-1">Condition</span>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-slate-200">
                {['Good', 'Hold', 'Reprocess', 'Second Quality', 'Reject'].map((c) => <option key={c}>{c}</option>)}
              </select></label>
          )}
          <label className="block"><span className="block font-semibold mb-1">{needsReason ? 'Reason / approval *' : 'Remarks'}</span>
            <input required={needsReason} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200" /></label>
          {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">{saving ? 'Saving…' : text.button}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
