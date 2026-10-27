import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScanLine, X } from 'lucide-react';
import { inventoryService } from '../../services/domainServices';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (v) => num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Pick which batches a sales line is drawn from — by hand or by scanning a
 * batch QR tag. Quantities are entered per batch and spread over that
 * batch's oldest takas, so the line still saves `takaAllocations`
 * ([{ lotTakaId, qty }]) and the server validates QC, reservation and stock.
 */
export default function BatchPickerModal({ itemId, itemName, qty, value = [], orderId, onClose, onSave }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [perBatch, setPerBatch] = useState({});
  const [scan, setScan] = useState('');

  useEffect(() => {
    let alive = true;
    inventoryService.getEligibleBatchStock({ itemId, orderId })
      .then((res) => {
        if (!alive) return;
        const rows = res?.results || [];
        setBatches(rows);
        // Re-open with what the line already holds.
        const taken = {};
        rows.forEach((b) => {
          const sum = b.takas.reduce((s, t) => s + num(value.find((v) => String(v.lotTakaId) === t.lotTakaId)?.qty), 0);
          if (sum > 0) taken[b.batchCode] = String(sum);
        });
        setPerBatch(taken);
      })
      .catch((err) => alive && setError(err?.message || 'Batch stock could not be loaded.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, orderId]);

  const total = useMemo(() => Object.values(perBatch).reduce((s, v) => s + num(v), 0), [perBatch]);
  const remaining = num(qty) - total;

  const onScan = (e) => {
    e.preventDefault();
    const raw = scan.trim();
    if (!raw) return;
    const code = decodeURIComponent(raw.split('/').filter(Boolean).pop() || raw).toUpperCase();
    setScan('');
    const batch = batches.find((b) => b.batchCode.toUpperCase() === code
      || b.takas.some((t) => String(t.takaId || '').toUpperCase() === code || String(t.lotNumber).toUpperCase() === code));
    if (!batch) {
      setError(`${code} has no sellable stock of ${itemName || 'this item'}.`);
      return;
    }
    setError('');
    const already = num(perBatch[batch.batchCode]);
    const add = Math.min(num(batch.available) - already, Math.max(0, remaining));
    setPerBatch({ ...perBatch, [batch.batchCode]: String(already + Math.max(0, add)) });
  };

  const save = () => {
    const allocations = [];
    for (const b of batches) {
      let want = num(perBatch[b.batchCode]);
      if (want <= 0) continue;
      if (want > num(b.available) + 1e-6) {
        setError(`${b.batchCode} has only ${fmt(b.available)} available.`);
        return;
      }
      // Reserved-for-this-order takas first, then oldest.
      const takas = [...b.takas].sort((x, y) => Number(y.reservedForThisOrder) - Number(x.reservedForThisOrder));
      for (const t of takas) {
        if (want <= 0) break;
        const take = Math.min(num(t.available), want);
        allocations.push({ lotTakaId: t.lotTakaId, qty: Math.round(take * 10000) / 10000, batchCode: b.batchCode, takaId: t.takaId });
        want -= take;
      }
    }
    if (allocations.length && Math.abs(total - num(qty)) > 0.0001) {
      setError(`Selected ${fmt(total)}, the line is for ${fmt(qty)}. They must match, or clear the selection to use FIFO.`);
      return;
    }
    onSave(allocations);
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="batch-picker-title" className="bg-card text-text rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h3 id="batch-picker-title" className="text-sm font-bold">Select batches — {itemName}</h3>
            <p className="text-[11px] text-muted">Line quantity {fmt(qty)}. Only QC-passed stock not reserved for another order is listed.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-muted hover:bg-soft cursor-pointer"><X size={16} /></button>
        </div>

        <form onSubmit={onScan} className="px-5 pt-3 flex gap-2">
          <label htmlFor="batch-picker-scan" className="sr-only">Scan batch tag</label>
          <div className="relative flex-1">
            <ScanLine size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input id="batch-picker-scan" autoFocus value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan batch QR or type batch / taka ID, then Enter" className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-card text-xs font-mono focus:outline-none focus:border-primary" />
          </div>
          <button type="submit" className="h-9 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-soft cursor-pointer">Add</button>
        </form>

        {error && <div role="alert" className="mx-5 mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700">{error}</div>}

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="text-xs text-muted py-6 text-center">Loading batches…</p>
          ) : batches.length === 0 ? (
            <p className="text-xs text-muted py-6 text-center">No sellable stock of this item.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-muted">
                <tr><th className="text-left py-1.5">Batch</th><th className="text-left py-1.5">Takas</th><th className="text-right py-1.5">Available</th><th className="text-right py-1.5 w-32">Sell qty</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batches.map((b) => (
                  <tr key={b.batchCode}>
                    <td className="py-2 font-mono font-semibold">{b.batchCode}</td>
                    <td className="py-2 text-muted">{b.takas.length}{b.takas.some((t) => t.reservedForThisOrder) ? ' · reserved for this order' : ''}</td>
                    <td className="py-2 text-right tabular-nums">{fmt(b.available)}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number" min="0" step="any" max={b.available}
                        aria-label={`Quantity from ${b.batchCode}`}
                        value={perBatch[b.batchCode] ?? ''}
                        onChange={(e) => setPerBatch({ ...perBatch, [b.batchCode]: e.target.value })}
                        className="w-28 h-8 px-2 rounded-md border border-border bg-card text-right tabular-nums focus:outline-none focus:border-primary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-border">
          <span className={`text-xs font-semibold ${Math.abs(remaining) < 0.0001 ? 'text-emerald-700' : 'text-amber-700'}`}>
            Selected {fmt(total)} of {fmt(qty)}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => onSave([])} className="h-9 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-soft cursor-pointer">Clear (use FIFO)</button>
            <button type="button" onClick={save} className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold cursor-pointer">Use these batches</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
