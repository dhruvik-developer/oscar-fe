import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatINR, formatNumberIN } from '../../accounts/accountingShared';

const QTY = [
  ['received', 'Received'], ['available', 'Available'], ['reserved', 'Reserved'], ['qcHold', 'QC Hold'],
  ['rework', 'Rework'], ['rejected', 'Rejected'], ['withJobWorker', 'At job worker'], ['sold', 'Sold'],
];

/** Side drawer: a batch's QR identity, ownership, stock, QC / job work / rework history and cost. */
export default function BatchDrawer({ code, onClose }) {
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    inventoryService.getBatch(code)
      .then((b) => alive && setBatch(b))
      .catch((err) => alive && setError(describeApiError(err) || 'The batch could not be loaded.'));
    return () => { alive = false; };
  }, [code]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = batch?.quantities || {};
  const c = batch?.costing;
  const timeline = (batch?.timeline || []).slice(-25).reverse();
  return createPortal(
    <div className="fixed inset-0 z-[900] bg-slate-900/40 flex justify-end" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={`Batch ${code}`} className="w-full max-w-lg h-full bg-white overflow-y-auto text-xs">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm font-bold">{batch?.batchCode || code}</div>
            {batch && <div className="text-slate-500">{batch.item} · {batch.origin} · {batch.status}</div>}
          </div>
          <div className="flex items-center gap-1">
            <Link to={`/inventory/batches/${encodeURIComponent(code)}`} className="p-1.5 rounded-lg hover:bg-slate-100" title="Open full batch workspace (QR traceability)" aria-label="Open batch workspace"><ExternalLink size={16} /></Link>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
          </div>
        </div>
        {error && <div role="alert" className="m-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        {!batch && !error && <p className="p-5 text-slate-400">Loading…</p>}
        {batch && (
          <div className="p-5 space-y-4">
            <dl className="grid grid-cols-2 gap-2">
              {[
                ['HSN', batch.hsnCode],
                ['Supplier', batch.supplierName],
                ['Source', [batch.sourceDocumentType, batch.sourceDocumentNumber].filter(Boolean).join(' ')],
                ['Quality / shade', [batch.fabricQuality, batch.shade].filter(Boolean).join(' · ')],
                ['Lots', (batch.lots || []).join(', ')],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-[10px] uppercase text-slate-400">{k}</dt><dd className="font-semibold text-slate-800 break-words">{v || '—'}</dd></div>
              ))}
            </dl>
            <div className="grid grid-cols-4 gap-2">
              {QTY.map(([k, label]) => (
                <div key={k} className="rounded-lg border border-slate-200 p-2">
                  <div className="text-[10px] text-slate-400">{label}</div>
                  <div className="font-bold tabular-nums">{formatNumberIN(q[k] || 0)}</div>
                </div>
              ))}
            </div>
            {batch.canSeeCost && c && (
              <dl className="rounded-lg border border-slate-200 p-3 space-y-1">
                <div className="flex justify-between"><dt>Total cost</dt><dd className="font-mono">{formatINR(c.totalCost)}</dd></div>
                <div className="flex justify-between"><dt>Cost per {q.uom || 'm'}</dt><dd className="font-mono">{formatINR(c.costPerUnit)}</dd></div>
                <div className="flex justify-between"><dt>Realized profit</dt><dd className="font-mono">{formatINR(c.realizedProfit)}</dd></div>
                <div className="flex justify-between"><dt>Outstanding claims</dt><dd className="font-mono">{formatINR(c.outstandingClaim)}</dd></div>
              </dl>
            )}
            <div>
              <h4 className="font-bold mb-1">Recent history (stock, QC, job work, rejections)</h4>
              <ol className="space-y-1.5">
                {timeline.map((e, i) => (
                  <li key={i} className="border-l-2 border-slate-200 pl-2">
                    <div className="flex justify-between gap-2"><span className="font-semibold">{e.title}</span><span className="text-slate-400">{e.date}</span></div>
                    <div className="text-slate-500">{[e.quantity && formatNumberIN(e.quantity), e.location, e.reference, e.status].filter(Boolean).join(' · ')}</div>
                  </li>
                ))}
              </ol>
              <Link to={`/inventory/batches/${encodeURIComponent(code)}`} className="inline-block mt-2 font-semibold text-blue-700 hover:underline">Full ledger and history →</Link>
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
