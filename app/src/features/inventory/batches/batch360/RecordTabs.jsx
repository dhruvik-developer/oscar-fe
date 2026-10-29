import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { formatINR, formatNumberIN } from '../../../accounts/accountingShared';
import BatchChargeModal from '../BatchChargeModal';
import RegisterTakasForm from '../RegisterTakasForm';
import { Card, Empty, Notice, Stat, Table, btnDark, btnGhost, inGodown, rollsWhere, useBatchAction } from './shared';

/* ---------------------------------------------------------------- Stock */
export function StockTab({ batch, onBatch }) {
  const q = batch.quantities || {};
  const uom = q.uom || 'm';
  const takas = batch.takas || [];
  const [showEmpty, setShowEmpty] = useState(false);
  const rows = showEmpty ? takas : takas.filter((t) => Number(t.availableQuantity) > 0);
  return (
    <div className="space-y-4">
      <Card title="Quantity & stock" subtitle="Each metre is in exactly one place. Received = sum of these + sold + sent out / written off.">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <Stat label="Received" value={q.received} uom={uom} />
          <Stat label="In hand" value={q.onHand} uom={uom} />
          <Stat label="Available" value={q.available} uom={uom} tone="text-emerald-700" />
          <Stat label="Reserved" value={q.reserved} uom={uom} />
          <Stat label="QC hold" value={q.qcHold} uom={uom} />
          <Stat label="Rework" value={q.rework} uom={uom} />
          <Stat label="Rejected" value={q.rejected} uom={uom} />
          <Stat label="At job worker" value={q.withJobWorker} uom={uom} />
          <Stat label="Second quality" value={q.secondQuality} uom={uom} />
          <Stat label="Sent for job work" value={q.sentForJobWork} uom={uom} />
          <Stat label="Back from job work" value={q.returnedFromJobWork} uom={uom} />
          <Stat label="Sold (net)" value={q.sold} uom={uom} />
        </div>
        {batch.ownership !== 'OSCAR' && <p className="mt-2 text-[11px] text-amber-700">Customer-owned material: kept apart from OSCAR stock and never sold.</p>}
      </Card>
      {Number(q.unregistered) > 0 && batch.permissions?.adjustStock && (
        <Card title={`Register takas (${formatNumberIN(q.unregistered)} ${uom} in bulk)`}>
          <RegisterTakasForm batch={batch} onDone={onBatch} />
        </Card>
      )}
      <Card
        title={`Rolls / takas (${rows.length})`}
        actions={<label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> Show used-up rolls</label>}
      >
        {rows.length === 0 ? <Empty>No rolls in hand.</Empty> : (
          <Table head={[['Taka ID'], ['Lot / taka'], ['Location'], ['Status'], ['QC'], ['Design / shade'], ['Received', 'r'], ['In hand', 'r'], ['Source']]} minWidth={900}>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="px-2 py-1.5 font-mono">{t.takaId}{t.bulk ? <span className="ml-1 text-[10px] text-amber-700">bulk</span> : null}</td>
                <td className="px-2 py-1.5">{t.lotNumber} / {t.takaNumber}</td>
                <td className="px-2 py-1.5">{t.location}</td>
                <td className="px-2 py-1.5">{t.status}</td>
                <td className="px-2 py-1.5">{t.qcStatus}</td>
                <td className="px-2 py-1.5">{[t.design, t.shade].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(t.receivedQuantity)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(t.availableQuantity)}</td>
                <td className="px-2 py-1.5 text-slate-500">{[t.sourceDocumentType, t.sourceDocumentNumber].filter(Boolean).join(' ')}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- Sales */
export function SalesTab({ batch }) {
  const perms = batch.permissions || {};
  const uom = batch.quantities?.uom || 'm';
  const rows = batch.sales || [];
  const own = batch.ownership === 'OSCAR';
  const sellable = rollsWhere(batch, (t) => inGodown(t) && t.status !== 'Reserved' && !t.bulk && ['Passed', 'Pass', 'Not Inspected'].includes(t.qcStatus));
  const sellableQty = sellable.reduce((s, t) => s + Number(t.availableQuantity), 0);
  const notInspected = sellable.filter((t) => t.qcStatus === 'Not Inspected').reduce((s, t) => s + Number(t.availableQuantity), 0);
  return (
    <div className="space-y-4">
      <Card
        title="Sell fabric"
        subtitle={own ? 'Sell from a delivery challan or invoice: pick or scan this batch in the line’s batch picker. QC is not required.' : 'Customer material is not sold; deliver it to its owner from the Overview tab.'}
        actions={own && perms.sell ? (
          <>
            <Link to="/sales/delivery" className={`${btnDark} inline-flex items-center`}>New delivery challan</Link>
            <Link to="/sales/invoices" className={`${btnGhost} inline-flex items-center`}>New invoice</Link>
          </>
        ) : null}
      >
        {own && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat label="Sellable now" value={sellableQty} uom={uom} tone="text-emerald-700" />
            <Stat label="…of which not inspected" value={notInspected} uom={uom} />
            <Stat label="Sold (net)" value={batch.quantities?.sold} uom={uom} />
          </div>
        )}
        {own && <p className="mt-2 text-slate-600">Batch ID to pick / scan: <span className="font-mono font-bold text-slate-800">{batch.batchCode}</span></p>}
        {own && Number(batch.quantities?.unregistered) > 0 && <div className="mt-2"><Notice kind="warn">{formatNumberIN(batch.quantities.unregistered)} {uom} is still bulk; register it as takas before selling.</Notice></div>}
      </Card>
      <Card title={`Sales & returns (${rows.length})`}>
        {rows.length === 0 ? <Empty>Nothing from this batch has been sold.</Empty> : (
          <Table head={[['Date'], ['Document'], ['Customer'], ['Type'], ['Qty', 'r'], ...(batch.canSeeCost ? [['Rate', 'r'], ['Amount', 'r']] : [])]} minWidth={700}>
            {rows.map((r, i) => (
              <tr key={`${r.documentId}-${r.kind}-${i}`}>
                <td className="px-2 py-1.5">{r.date}</td>
                <td className="px-2 py-1.5 font-mono">{r.documentNumber || '—'}<span className="block text-[10px] text-slate-400 font-sans">{r.documentType}{r.status ? ` · ${r.status}` : ''}</span></td>
                <td className="px-2 py-1.5">{r.customer || '—'}</td>
                <td className="px-2 py-1.5">{r.kind}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(r.quantity)} {uom}</td>
                {batch.canSeeCost && <td className="px-2 py-1.5 text-right tabular-nums">{r.rate ? formatINR(r.rate) : (r.kind === 'Sale' ? 'unpriced' : '')}</td>}
                {batch.canSeeCost && <td className="px-2 py-1.5 text-right tabular-nums">{r.amount ? formatINR(r.amount) : ''}</td>}
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {(batch.vendorReturns || []).length > 0 && (
        <Card title="Returned to vendor">
          <Table head={[['Date'], ['Return'], ['Qty', 'r'], ['Notes']]} minWidth={480}>
            {batch.vendorReturns.map((r) => <tr key={r.reference}><td className="px-2 py-1.5">{r.date}</td><td className="px-2 py-1.5 font-mono">{r.reference}</td><td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(r.quantity)}</td><td className="px-2 py-1.5 text-slate-500">{r.notes}</td></tr>)}
          </Table>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Cost */
export function CostTab({ batch, onBatch }) {
  const c = batch.costing;
  const uom = batch.quantities?.uom || 'm';
  const [charging, setCharging] = useState(false);
  const { notice, wrap, reload } = useBatchAction(batch, onBatch);
  if (!batch.canSeeCost || !c) {
    return (
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
        <ShieldAlert size={14} /> Cost and profit are visible to users with ledger access.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Notice kind="ok">{notice}</Notice>
      {charging && (
        <BatchChargeModal
          batches={[batch]}
          onClose={() => setCharging(false)}
          onDone={(rows) => { setCharging(false); wrap(reload, `Charge posted: ${rows.map((r) => `₹${r.amount}`).join(', ')}.`); }}
        />
      )}
      <Card
        title="Cost & profit"
        subtitle="From recorded transactions only. Charges awaiting approval are not counted."
        actions={<button type="button" onClick={() => setCharging(true)} className={btnGhost}>Add charge (freight, dyeing, other)</button>}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <dl className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase text-slate-400">Cost of the batch</div>
            {Object.entries(c.costByType || {}).map(([type, amount]) => (
              <div key={type} className="flex justify-between text-slate-600"><dt>{type}</dt><dd className="font-mono">{formatINR(amount)}</dd></div>
            ))}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5"><dt>Total batch cost</dt><dd className="font-mono">{formatINR(c.totalCost)}</dd></div>
            {Number(c.pendingCost) > 0 && <div className="flex justify-between text-amber-700"><dt>Awaiting approval (estimate, not counted)</dt><dd className="font-mono">{formatINR(c.pendingCost)}</dd></div>}
            <div className="flex justify-between text-slate-600"><dt>Good output</dt><dd className="font-mono">{formatNumberIN(c.goodOutput)} {uom}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Cost per {uom}</dt><dd className="font-mono">{formatINR(c.costPerUnit)}</dd></div>
          </dl>
          <dl className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase text-slate-400">Realized on sales</div>
            <div className="flex justify-between text-slate-600"><dt>Sold {formatNumberIN(c.soldQty)} {uom} at avg {formatINR(c.averageSellingRate)}</dt><dd className="font-mono">{formatINR(c.revenue)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Cost of sold metres only</dt><dd className="font-mono">− {formatINR(c.costOfSold)}</dd></div>
            <div className={`flex justify-between font-bold border-t border-slate-100 pt-1.5 ${Number(c.realizedProfit) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}><dt>Realized profit</dt><dd className="font-mono">{formatINR(c.realizedProfit)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Unsold stock value (not profit)</dt><dd className="font-mono">{formatINR(c.unsoldInventoryValue)}</dd></div>
            <div className="text-[11px] font-semibold uppercase text-slate-400 pt-1.5">Rejections ({formatNumberIN(c.rejectedQty)} {uom})</div>
            <div className="flex justify-between text-slate-600"><dt>Normal loss absorbed ({formatNumberIN(c.normalLossQty)} {uom})</dt><dd className="font-mono">{formatINR(c.normalLossAbsorbedCost)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Claims ({formatNumberIN(c.claimableQty)} {uom})</dt><dd className="font-mono">{formatINR(c.claimValue)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Recovered</dt><dd className="font-mono">{formatINR(c.recoveredAmount)}</dd></div>
            <div className="flex justify-between text-amber-700"><dt>Outstanding claim</dt><dd className="font-mono">{formatINR(c.outstandingClaim)}</dd></div>
            <div className="flex justify-between text-rose-700"><dt>Written off</dt><dd className="font-mono">{formatINR(c.writtenOffLoss)}</dd></div>
            <div className="flex justify-between font-bold text-slate-900"><dt>Net batch result</dt><dd className="font-mono">{formatINR(c.netResult)}</dd></div>
            {Number(c.unpricedSoldQty) > 0 && <p className="text-[11px] text-amber-700">{formatNumberIN(c.unpricedSoldQty)} {uom} sold could not be matched to a document price.</p>}
          </dl>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">{c.rule}</p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- Documents */
export function DocumentsTab({ batch }) {
  const docs = batch.documents || [];
  return (
    <Card title={`Linked documents (${docs.length})`} subtitle="Every document that touched this batch.">
      {docs.length === 0 ? <Empty>No documents.</Empty> : (
        <Table head={[['Role'], ['Type'], ['Number'], ['Date'], ['Party']]} minWidth={560}>
          {docs.map((d, i) => (
            <tr key={`${d.type}-${d.number}-${i}`}>
              <td className="px-2 py-1.5">{d.role}</td>
              <td className="px-2 py-1.5">{d.type}</td>
              <td className="px-2 py-1.5 font-mono">{d.number || '—'}</td>
              <td className="px-2 py-1.5">{d.date || '—'}</td>
              <td className="px-2 py-1.5">{d.party || '—'}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- History */
const KIND_STYLE = {
  BATCH_CREATED: 'bg-slate-800',
  MOVEMENT: 'bg-blue-500',
  LOSS: 'bg-rose-500',
  QC: 'bg-amber-500',
  JOB_WORK_OUT: 'bg-violet-500',
  JOB_WORK_IN: 'bg-violet-700',
  COST: 'bg-emerald-600',
  YARN: 'bg-teal-500',
};
const KIND_FILTERS = [['', 'All'], ['MOVEMENT', 'Stock'], ['QC', 'QC'], ['JOB_WORK', 'Job work'], ['YARN', 'Yarn'], ['LOSS', 'Rejections'], ['COST', 'Cost']];

export function HistoryTab({ batch }) {
  const [kind, setKind] = useState('');
  const uom = batch.quantities?.uom || 'm';
  const timeline = useMemo(() => {
    const rows = batch.timeline || [];
    if (!kind) return rows;
    return rows.filter((e) => (kind === 'JOB_WORK' ? e.kind.startsWith('JOB_WORK') : e.kind === kind));
  }, [batch, kind]);
  return (
    <Card
      title={`History (${timeline.length})`}
      subtitle="Every transaction on the batch, oldest first, with who did it."
      actions={(
        <div className="inline-flex flex-wrap p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold" role="tablist">
          {KIND_FILTERS.filter(([k]) => k !== 'COST' || batch.canSeeCost).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`px-3 py-1 rounded-md cursor-pointer ${kind === k ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>{label}</button>
          ))}
        </div>
      )}
    >
      {timeline.length === 0 ? <Empty>No events.</Empty> : (
        <ol className="relative border-l border-slate-200 ml-2 space-y-3">
          {timeline.map((e, i) => (
            <li key={`${e.kind}-${i}`} className="ml-4">
              <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ring-2 ring-white ${KIND_STYLE[e.kind] || 'bg-slate-400'}`} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold text-slate-800">{e.title}</span>
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
    </Card>
  );
}
