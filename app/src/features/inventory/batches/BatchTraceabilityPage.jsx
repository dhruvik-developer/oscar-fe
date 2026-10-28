import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, ShieldAlert } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { inventoryService } from '../../../services/domainServices';
import { useERP } from '../../../context/ERPContext';
import { formatINR, formatNumberIN, describeApiError } from '../../accounts/accountingShared';
import { printBatchTags } from './printBatchTag';
import RejectReturnModal from './RejectReturnModal';
import { DeliverToOwnerForm } from './CustomerMaterialPanels';
import RegisterTakasForm from './RegisterTakasForm';

const QTY_TILES = [
  ['received', 'Received'],
  ['unregistered', 'Not yet in takas'],
  ['available', 'Available'],
  ['reserved', 'Reserved'],
  ['qcHold', 'QC Hold'],
  ['rework', 'Rework'],
  ['secondQuality', 'Second Quality'],
  ['rejected', 'Rejected'],
  ['withJobWorker', 'At Job Worker'],
  ['sold', 'Sold (net)'],
];
const KIND_STYLE = {
  BATCH_CREATED: 'bg-slate-800',
  MOVEMENT: 'bg-blue-500',
  LOSS: 'bg-rose-500',
  QC: 'bg-amber-500',
  JOB_WORK_OUT: 'bg-violet-500',
  JOB_WORK_IN: 'bg-violet-700',
  COST: 'bg-emerald-600',
};
const LOSS_CAUSES = [
  ['NORMAL_LOSS', 'Normal production / process loss'],
  ['SUPPLIER_QUALITY', 'Supplier quality issue'],
  ['JOB_WORKER_FAULT', 'Dyeing / job worker fault'],
  ['PROCESS_FAULT', 'Specific process fault'],
];
const LOSS_OUTCOMES = [
  ['PENDING', 'Pending decision'],
  ['SCRAP', 'Scrap'],
  ['REWORK', 'Rework'],
  ['REPLACEMENT', 'Replacement by vendor'],
  ['VENDOR_RETURN', 'Returned to vendor'],
  ['DOWNGRADE', 'Approved downgrade'],
];
const CLAIM_STATUSES = [
  ['OPEN', 'Open'],
  ['CLAIMED', 'Claimed'],
  ['PARTLY_RECOVERED', 'Partly recovered'],
  ['RECOVERED', 'Recovered'],
  ['WRITTEN_OFF', 'Written off'],
];
const KIND_FILTERS = [
  ['', 'All'],
  ['MOVEMENT', 'Stock'],
  ['QC', 'QC'],
  ['JOB_WORK', 'Job work'],
  ['COST', 'Cost'],
];

/**
 * Batch Traceability workspace — what a batch QR tag opens. History is for
 * any inventory user; the server sends cost and profit only to users who may
 * see the ledger.
 */
export default function BatchTraceabilityPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('');
  const { parties = [] } = useERP() || {};
  const [owner, setOwner] = useState(null); // { ownership, ownerPartyId } while editing
  const [ownerError, setOwnerError] = useState('');
  const [searchParams] = useSearchParams();
  // Opened from the QC screen with ?returnRejected=1.
  const [returning, setReturning] = useState(searchParams.get('returnRejected') === '1');
  const [returnNotice, setReturnNotice] = useState('');
  const [lossForm, setLossForm] = useState(null);
  const [lossError, setLossError] = useState('');
  const saveLoss = async (e) => {
    e.preventDefault();
    setLossError('');
    try {
      setBatch(await inventoryService.recordBatchLoss(batch.batchCode, lossForm));
      setLossForm(null);
    } catch (err) {
      setLossError(describeApiError(err) || 'The rejection could not be recorded.');
    }
  };
  const updateLoss = async (id, data) => {
    setLossError('');
    try {
      setBatch(await inventoryService.updateBatchLoss(id, data));
    } catch (err) {
      setLossError(describeApiError(err) || 'The claim could not be updated.');
    }
  };
  const saveOwner = async () => {
    setOwnerError('');
    try {
      setBatch(await inventoryService.setBatchOwnership(batch.batchCode, owner));
      setOwner(null);
    } catch (err) {
      setOwnerError(describeApiError(err) || 'Ownership could not be saved.');
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    inventoryService.getBatch(code)
      .then((res) => { if (alive) setBatch(res); })
      .catch((err) => { if (alive) { setBatch(null); setError(describeApiError(err) || 'The batch could not be loaded.'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [code]);

  const timeline = useMemo(() => {
    const rows = batch?.timeline || [];
    if (!kind) return rows;
    return rows.filter((e) => (kind === 'JOB_WORK' ? e.kind.startsWith('JOB_WORK') : e.kind === kind));
  }, [batch, kind]);

  const back = (
    <button type="button" onClick={() => navigate('/inventory/batches')} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer">
      <ArrowLeft size={14} /> Batch Registry
    </button>
  );

  if (loading) {
    return <div className="p-10 text-center text-sm text-slate-400">Loading batch {code}…</div>;
  }
  if (error || !batch) {
    return (
      <div className="space-y-4">
        <PageHeader title="Batch Traceability" actions={back} />
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{error || 'Batch not found.'}</div>
      </div>
    );
  }

  const q = batch.quantities || {};
  const c = batch.costing;
  const uom = q.uom || 'm';

  return (
    <div className="space-y-4">
      <PageHeader
        title={batch.batchCode}
        subtitle={`${batch.item || 'Fabric'} · ${batch.origin} · created ${batch.createdOn}`}
        titleExtra={<span className="ml-2 px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-slate-50 text-slate-700 border-slate-200">{batch.status}</span>}
        actions={(
          <div className="flex gap-2">
            {back}
            <button type="button" onClick={() => printBatchTags([batch]).catch((err) => setError(err.message))} className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
              <Printer size={14} /> Print Tag
            </button>
          </div>
        )}
      />

      {(batch.hsnMissingFor || []).length > 0 && (
        <div role="alert" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          HSN is missing for {batch.hsnMissingFor.join(', ')}. Add it in the item master (Inventory → Total Inventory) —
          the batch, POs and invoices take HSN from there.
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {[
          ['Fabric', batch.item],
          ['HSN (from item master)', batch.hsnCode],
          ['Quality / Shade', [batch.fabricQuality, batch.shade].filter(Boolean).join(' · ')],
          ['Width / GSM', [batch.width && `${batch.width}"`, batch.gsm && `${batch.gsm} GSM`].filter(Boolean).join(' · ')],
          ['Ownership', batch.ownership === 'OSCAR' ? 'OSCAR' : `${batch.ownership} — ${batch.ownerPartyName || ''}`],
          ['Supplier', batch.supplierName],
          ['Source', [batch.sourceDocumentType, batch.sourceDocumentNumber].filter(Boolean).join(' ')],
          ['Lots', (batch.lots || []).join(', ')],
          ['Merged from', (batch.parentBatches || []).join(', ')],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
            <div className="font-semibold text-slate-800 break-words">{value || '—'}</div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-3 text-xs flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-700">Material owner:</span>
        {owner ? (
          <>
            <select value={owner.ownership} onChange={(e) => setOwner({ ...owner, ownership: e.target.value })} className="h-8 px-2 rounded-lg border border-slate-200" aria-label="Ownership">
              <option value="OSCAR">OSCAR (own stock)</option>
              <option value="CUSTOMER">Customer</option>
              <option value="THIRD_PARTY">Third party</option>
            </select>
            {owner.ownership !== 'OSCAR' && (
              <select value={owner.ownerPartyId || ''} onChange={(e) => setOwner({ ...owner, ownerPartyId: e.target.value })} className="h-8 px-2 rounded-lg border border-slate-200 max-w-56" aria-label="Owner">
                <option value="">Select party</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button type="button" onClick={saveOwner} className="h-8 px-3 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer">Save</button>
            <button type="button" onClick={() => { setOwner(null); setOwnerError(''); }} className="h-8 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
            {ownerError && <span role="alert" className="text-rose-700">{ownerError}</span>}
          </>
        ) : (
          <>
            <span className="text-slate-800">{batch.ownership === 'OSCAR' ? 'OSCAR (own stock — sellable)' : `${batch.ownerPartyName} (${batch.ownership === 'CUSTOMER' ? 'customer' : 'third-party'} material — not sellable, delivered to owner only)`}</span>
            <button type="button" onClick={() => setOwner({ ownership: batch.ownership, ownerPartyId: '' })} className="h-7 px-2 rounded-md border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Change</button>
          </>
        )}
      </section>

      {Number(batch.quantities?.unregistered) > 0 && (
        <section className="bg-white border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Register takas</h3>
          <RegisterTakasForm batch={batch} onDone={setBatch} />
        </section>
      )}

      {batch.ownership !== 'OSCAR' && (
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Deliver to owner ({batch.ownerPartyName})</h3>
          <DeliverToOwnerForm batch={batch} onDone={setBatch} />
        </section>
      )}

      <section className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        {QTY_TILES.map(([key, label]) => (
          <div key={key} className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
            <div className="text-sm font-bold text-slate-900 tabular-nums">{formatNumberIN(q[key])}</div>
            <div className="text-[10px] text-slate-400">{uom}</div>
          </div>
        ))}
      </section>

      {batch.canSeeCost && c ? (
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Cost & Profit</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <dl className="space-y-1.5">
              {Object.entries(c.costByType || {}).map(([type, amount]) => (
                <div key={type} className="flex justify-between text-slate-600"><dt>{type}</dt><dd className="font-mono">{formatINR(amount)}</dd></div>
              ))}
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5"><dt>Total batch cost</dt><dd className="font-mono">{formatINR(c.totalCost)}</dd></div>
              {Number(c.pendingCost) > 0 && (
                <div className="flex justify-between text-amber-700"><dt>Awaiting approval (not counted)</dt><dd className="font-mono">{formatINR(c.pendingCost)}</dd></div>
              )}
            </dl>
            <dl className="space-y-1.5">
              <div className="flex justify-between text-slate-600"><dt>Good output</dt><dd className="font-mono">{formatNumberIN(c.goodOutput)} {uom}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Cost per {uom}</dt><dd className="font-mono">{formatINR(c.costPerUnit)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Sold ({formatNumberIN(c.soldQty)} {uom}) at avg {formatINR(c.averageSellingRate)}</dt><dd className="font-mono">{formatINR(c.revenue)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Cost of sold</dt><dd className="font-mono">− {formatINR(c.costOfSold)}</dd></div>
              <div className={`flex justify-between font-bold border-t border-slate-100 pt-1.5 ${Number(c.realizedProfit) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                <dt>Realized profit</dt><dd className="font-mono">{formatINR(c.realizedProfit)}</dd>
              </div>
              <div className="flex justify-between text-slate-600"><dt>Unsold stock value</dt><dd className="font-mono">{formatINR(c.unsoldInventoryValue)}</dd></div>
              <div className="border-t border-slate-100 pt-1.5 mt-1.5 text-[11px] font-semibold uppercase text-slate-400">Rejections ({formatNumberIN(c.rejectedQty)} {uom})</div>
              <div className="flex justify-between text-slate-600"><dt>Normal loss absorbed by good fabric ({formatNumberIN(c.normalLossQty)} {uom})</dt><dd className="font-mono">{formatINR(c.normalLossAbsorbedCost)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Claims against vendor / job worker ({formatNumberIN(c.claimableQty)} {uom})</dt><dd className="font-mono">{formatINR(c.claimValue)}</dd></div>
              <div className="flex justify-between text-slate-600"><dt>Recovered</dt><dd className="font-mono">{formatINR(c.recoveredAmount)}</dd></div>
              <div className="flex justify-between text-amber-700"><dt>Outstanding claim</dt><dd className="font-mono">{formatINR(c.outstandingClaim)}</dd></div>
              <div className="flex justify-between text-rose-700"><dt>Written off (batch loss)</dt><dd className="font-mono">{formatINR(c.writtenOffLoss)}</dd></div>
              <div className="flex justify-between font-bold text-slate-900"><dt>Net batch result</dt><dd className="font-mono">{formatINR(c.netResult)}</dd></div>
              {Number(c.unpricedSoldQty) > 0 && (
                <p className="text-[11px] text-amber-700">{formatNumberIN(c.unpricedSoldQty)} {uom} sold could not be matched to a document price.</p>
              )}
            </dl>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">{c.rule}</p>
        </section>
      ) : (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
          <ShieldAlert size={14} /> Cost and profit are visible to users with ledger access.
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold text-slate-900">Rejections &amp; Claims</h3>
          {(batch.takas || []).some((t) => t.locationCode === 'SYS-REJECT' && Number(t.availableQuantity) > 0) && (
            <button type="button" onClick={() => setReturning(true)} className="h-8 px-3 rounded-lg border border-red-200 text-red-700 font-semibold hover:bg-red-50 cursor-pointer">
              Return rejected to supplier
            </button>
          )}
          {!lossForm && (
            <button type="button" onClick={() => setLossForm({ quantity: '', cause: 'NORMAL_LOSS', responsiblePartyId: '', process: '', outcome: 'PENDING', reference: '', notes: '' })} className="h-8 px-3 rounded-lg border border-slate-200 font-semibold hover:bg-slate-50 cursor-pointer">
              Classify rejection
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mb-2">Normal loss is spread over the good fabric. Supplier, job-worker or process faults keep their cost as a claim to recover.</p>
        {lossError && <div role="alert" className="mb-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{lossError}</div>}
        {returnNotice && <div role="status" className="mb-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">{returnNotice}</div>}
        {returning && (
          <RejectReturnModal
            batch={batch}
            onClose={() => setReturning(false)}
            onDone={async (rows) => {
              setReturning(false);
              setReturnNotice(`Purchase return raised: ${rows.map((r) => `${r.returnNumber} (${r.supplier})`).join(', ')}.`);
              setBatch(await inventoryService.getBatch(batch.batchCode));
            }}
          />
        )}
        {lossForm && (
          <form onSubmit={saveLoss} className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <label className="block"><span className="block text-slate-500">Rejected qty ({uom}) *</span>
              <input required type="number" min="0.0001" step="any" value={lossForm.quantity} onChange={(e) => setLossForm({ ...lossForm, quantity: e.target.value })} className="w-full h-8 px-2 rounded-md border border-slate-200" /></label>
            <label className="block"><span className="block text-slate-500">Cause *</span>
              <select value={lossForm.cause} onChange={(e) => setLossForm({ ...lossForm, cause: e.target.value })} className="w-full h-8 px-2 rounded-md border border-slate-200">
                {LOSS_CAUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
            {lossForm.cause !== 'NORMAL_LOSS' && (
              <label className="block"><span className="block text-slate-500">Responsible party</span>
                <select value={lossForm.responsiblePartyId} onChange={(e) => setLossForm({ ...lossForm, responsiblePartyId: e.target.value })} className="w-full h-8 px-2 rounded-md border border-slate-200">
                  <option value="">Select supplier / job worker</option>
                  {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
            )}
            <label className="block"><span className="block text-slate-500">Outcome</span>
              <select value={lossForm.outcome} onChange={(e) => setLossForm({ ...lossForm, outcome: e.target.value })} className="w-full h-8 px-2 rounded-md border border-slate-200">
                {LOSS_OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
            <label className="block"><span className="block text-slate-500">Process</span>
              <input value={lossForm.process} onChange={(e) => setLossForm({ ...lossForm, process: e.target.value })} placeholder="e.g. Dyeing" className="w-full h-8 px-2 rounded-md border border-slate-200" /></label>
            <label className="block"><span className="block text-slate-500">Reference (QC / debit note)</span>
              <input value={lossForm.reference} onChange={(e) => setLossForm({ ...lossForm, reference: e.target.value })} className="w-full h-8 px-2 rounded-md border border-slate-200" /></label>
            <label className="block lg:col-span-2"><span className="block text-slate-500">Notes</span>
              <input value={lossForm.notes} onChange={(e) => setLossForm({ ...lossForm, notes: e.target.value })} className="w-full h-8 px-2 rounded-md border border-slate-200" /></label>
            <div className="col-span-2 lg:col-span-4 flex justify-end gap-2">
              <button type="button" onClick={() => setLossForm(null)} className="h-8 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
              <button type="submit" className="h-8 px-3 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer">Save</button>
            </div>
          </form>
        )}
        {(c?.losses || []).length === 0 ? (
          <p className="text-slate-400">{batch.canSeeCost ? 'No rejection classified yet: all rejected metres count as normal loss.' : 'Claim details are visible with ledger access.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="text-[10px] uppercase text-slate-400">
                <tr><th className="text-left py-1">Date</th><th className="text-left py-1">Cause</th><th className="text-right py-1">Qty</th><th className="text-left py-1">Outcome</th><th className="text-right py-1">Claim value</th><th className="text-left py-1">Claim status</th><th className="text-right py-1">Recovered</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {c.losses.map((l) => (
                  <tr key={l.id}>
                    <td className="py-1.5">{l.date}</td>
                    <td className="py-1.5">{l.causeLabel}{l.responsibleParty ? ` — ${l.responsibleParty}` : ''}{l.reference ? <span className="block text-[10px] text-slate-400">{l.reference}</span> : null}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatNumberIN(l.quantity)}</td>
                    <td className="py-1.5">
                      <select value={l.outcome} onChange={(e) => updateLoss(l.id, { outcome: e.target.value })} className="h-7 px-1 rounded border border-slate-200" aria-label="Outcome">
                        {LOSS_OUTCOMES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{l.claimable ? formatINR(l.claimValue) : 'absorbed'}</td>
                    <td className="py-1.5">
                      {l.claimable ? (
                        <select value={l.claimStatus} onChange={(e) => updateLoss(l.id, { claimStatus: e.target.value })} className="h-7 px-1 rounded border border-slate-200" aria-label="Claim status">
                          {CLAIM_STATUSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                        </select>
                      ) : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      {l.claimable ? (
                        <input type="number" min="0" step="any" defaultValue={l.recoveredAmount} aria-label="Recovered amount"
                          onBlur={(e) => { if (e.target.value !== l.recoveredAmount) updateLoss(l.id, { recoveredAmount: e.target.value }); }}
                          className="w-24 h-7 px-1 rounded border border-slate-200 text-right" />
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-slate-900">History ({timeline.length})</h3>
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold" role="tablist">
            {KIND_FILTERS.filter(([k]) => k !== 'COST' || batch.canSeeCost).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`px-3 py-1 rounded-md cursor-pointer ${kind === k ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {timeline.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No events.</p>
        ) : (
          <ol className="relative border-l border-slate-200 ml-2 space-y-3">
            {timeline.map((e, i) => (
              <li key={`${e.kind}-${i}`} className="ml-4">
                <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ring-2 ring-white ${KIND_STYLE[e.kind] || 'bg-slate-400'}`} />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-xs font-semibold text-slate-800">{e.title}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{e.date}</span>
                </div>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                  {e.quantity && <span>Qty {formatNumberIN(e.quantity)} {e.uom || uom}</span>}
                  {e.amount && <span>{formatINR(e.amount)}</span>}
                  {e.unitCost && <span>@ {formatINR(e.unitCost)}</span>}
                  {e.location && <span>{e.location}</span>}
                  {e.taka && <span className="font-mono">{e.taka}</span>}
                  {e.reference && <span>{e.referenceType ? `${e.referenceType} ` : ''}{e.reference}</span>}
                  {e.status && <span>{e.status}</span>}
                  {e.by && <span>by {e.by}</span>}
                </div>
                {e.notes && <div className="text-[11px] text-slate-400">{e.notes}</div>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <h3 className="text-sm font-bold text-slate-900 px-4 pt-4 pb-2">Rolls / Takas ({(batch.takas || []).length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Taka ID</th>
                <th className="px-3 py-2 text-left">Lot / Taka</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">QC</th>
                <th className="px-3 py-2 text-right">Received</th>
                <th className="px-3 py-2 text-right">In hand</th>
                <th className="px-3 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(batch.takas || []).map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 font-mono">{t.takaId}</td>
                  <td className="px-3 py-2">{t.lotNumber} / {t.takaNumber}</td>
                  <td className="px-3 py-2">{t.location}</td>
                  <td className="px-3 py-2">{t.status}</td>
                  <td className="px-3 py-2">{t.qcStatus}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumberIN(t.receivedQuantity)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumberIN(t.availableQuantity)}</td>
                  <td className="px-3 py-2 text-slate-500">{[t.sourceDocumentType, t.sourceDocumentNumber].filter(Boolean).join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
