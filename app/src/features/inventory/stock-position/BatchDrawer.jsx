import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, X } from 'lucide-react';
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
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800">Recent history (stock, QC, job work, rejections)</h4>
                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                  <span className="inline-flex items-center gap-0.5 text-blue-700 font-medium">⇄ Transfer</span>
                  <span className="inline-flex items-center gap-0.5 text-emerald-700 font-medium">↑ Inward</span>
                  <span className="inline-flex items-center gap-0.5 text-rose-700 font-medium">↓ Outward</span>
                </div>
              </div>
              <ol className="space-y-2">
                {timeline.map((e, i) => {
                  const num = e.quantity != null && e.quantity !== '' ? Number(e.quantity) : null;
                  const isTransfer = e.kind === 'TRANSFER' || Boolean(e.fromLocation && e.toLocation);
                  const isOut = !isTransfer && (e.direction === 'OUT' || (num != null && num < 0));
                  const isIn = !isTransfer && (e.direction === 'IN' || (num != null && num > 0));
                  const borderClass = isTransfer
                    ? 'border-blue-400'
                    : isOut
                      ? 'border-rose-400'
                      : isIn
                        ? 'border-emerald-400'
                        : 'border-slate-300';

                  return (
                    <li key={i} className={`border-l-2 pl-2.5 py-1 ${borderClass} bg-slate-50/50 rounded-r-lg`}>
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="font-semibold text-slate-800">{e.title}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">{e.date}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 mt-1">
                        {isTransfer ? (
                          <>
                            {num != null && (
                              <span className="inline-flex items-center gap-0.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded text-[10px] tabular-nums">
                                ⇄ {formatNumberIN(Math.abs(num))} {e.uom || 'm'}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-slate-700 font-medium text-[11px]">
                              <span className="text-slate-600">{e.fromLocation}</span>
                              <ArrowRight size={11} className="text-blue-500 shrink-0" />
                              <span className="text-emerald-700 font-semibold">{e.toLocation}</span>
                            </span>
                          </>
                        ) : isOut ? (
                          <>
                            {num != null && (
                              <span className="inline-flex items-center font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded text-[10px] tabular-nums">
                                ↓ -{formatNumberIN(Math.abs(num))} {e.uom || 'm'} (Out)
                              </span>
                            )}
                            {(e.fromLocation || e.location) && (
                              <span className="text-slate-600">
                                from <strong>{e.fromLocation || e.location}</strong>
                              </span>
                            )}
                          </>
                        ) : isIn ? (
                          <>
                            {num != null && (
                              <span className="inline-flex items-center font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px] tabular-nums">
                                ↑ +{formatNumberIN(Math.abs(num))} {e.uom || 'm'} (In)
                              </span>
                            )}
                            {(e.toLocation || e.location) && (
                              <span className="text-slate-600">
                                into <strong>{e.toLocation || e.location}</strong>
                              </span>
                            )}
                          </>
                        ) : e.kind === 'BATCH_CREATED' ? (
                          <span className="inline-flex items-center font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded text-[10px]">
                            Initial Creation
                          </span>
                        ) : null}

                        {e.reference && <span className="text-slate-400 font-mono text-[10px]">· {e.reference}</span>}
                        {e.status && <span className="text-slate-500 font-medium text-[10px] bg-slate-100 px-1 rounded">· {e.status}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <Link to={`/inventory/batches/${encodeURIComponent(code)}`} className="inline-block mt-3 font-semibold text-blue-700 hover:underline">Full ledger and history →</Link>
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
