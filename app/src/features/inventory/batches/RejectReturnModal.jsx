import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';

/**
 * Return QC-rejected purchased rolls to the supplier as a debit note.
 * Only rolls in Reject stock are listed; any part of each can be returned,
 * the rest stays for other dispositions (scrap, rework, downgrade).
 */
export default function RejectReturnModal({ batch, onClose, onDone }) {
  const rolls = (batch.takas || []).filter((t) => t.locationCode === 'SYS-REJECT' && Number(t.availableQuantity) > 0);
  const claims = (batch.costing?.losses || []).filter((l) => l.claimable && l.cause === 'SUPPLIER_QUALITY');
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [lossId, setLossId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await inventoryService.returnRejectedToSupplier({
        rolls: Object.entries(qty).filter(([, v]) => Number(v) > 0).map(([lotTakaId, v]) => ({ lotTakaId, qty: v })),
        reason,
        lossId: lossId || undefined,
      });
      onDone(res?.returns || []);
    } catch (err) {
      setError(describeApiError(err) || 'The purchase return could not be created.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="reject-return-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col text-xs">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 id="reject-return-title" className="text-sm font-bold">Return rejected rolls — {batch.batchCode}</h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {rolls.length === 0 ? (
            <p className="text-slate-500">No rolls of this batch are in Reject stock.</p>
          ) : (
            <table className="w-full">
              <thead className="text-[10px] uppercase text-slate-400"><tr><th className="text-left py-1">Roll</th><th className="text-right py-1">Rejected</th><th className="text-right py-1 w-28">Return qty</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rolls.map((t) => (
                  <tr key={t.id}>
                    <td className="py-1.5 font-mono">{t.takaId}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatNumberIN(t.availableQuantity)}</td>
                    <td className="py-1.5 text-right">
                      <input type="number" min="0" step="any" max={t.availableQuantity} aria-label={`Return quantity for ${t.takaId}`} value={qty[t.id] ?? ''} onChange={(e) => setQty({ ...qty, [t.id]: e.target.value })} className="w-24 h-8 px-2 rounded-md border border-slate-200 text-right" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <label className="block"><span className="block font-semibold mb-1">Rejection reason (for the supplier) *</span>
            <input required value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200" placeholder="e.g. Holes, shade variation" /></label>
          {claims.length > 0 && (
            <label className="block"><span className="block font-semibold mb-1">Link to supplier claim (optional)</span>
              <select value={lossId} onChange={(e) => setLossId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-slate-200">
                <option value="">None</option>
                {claims.map((l) => <option key={l.id} value={l.id}>{l.date} · {formatNumberIN(l.quantity)} · {l.responsibleParty || 'supplier'}</option>)}
              </select></label>
          )}
          <p className="text-[11px] text-slate-500">A debit note is raised against the supplier&apos;s bill; stock leaves the Reject location. Whatever is not returned stays for scrap, rework or downgrade.</p>
          {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving || rolls.length === 0} className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-60 cursor-pointer">{saving ? 'Raising…' : 'Raise purchase return'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
