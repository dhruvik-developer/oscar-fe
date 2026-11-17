import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useERP } from '../../../../context/ERPContext';
import { inventoryService } from '../../../../services/domainServices';
import { formatINR, formatNumberIN } from '../../../accounts/accountingShared';
import RejectReturnModal from '../RejectReturnModal';
import SendForReprocessModal from '../SendForReprocessModal';
import ReceiveReturnModal from '../ReceiveReturnModal';
import { RefreshCw, ArrowDownLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Card, Empty, Field, Notice, Stat, Table, btnDark, btnGhost, godownsOf, inGodown, inputCls, rollsWhere, useBatchAction,
} from './shared';

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
const STATE_STYLE = {
  'QC Not Done': 'bg-slate-100 text-slate-700 border-slate-200',
  'Pending Inspection': 'bg-amber-50 text-amber-800 border-amber-200',
  'Passed / Accepted': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Rework / Reprocess': 'bg-violet-50 text-violet-700 border-violet-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};
const QC_FIELDS = [['goodQty', 'Good / Passed'], ['secondQualityQty', 'Second quality'], ['reprocessQty', 'Rework / Reprocess'], ['rejectedQty', 'Rejected / Waste'], ['holdQty', 'Hold (undecided)']];
const blankQc = { goodQty: '', secondQualityQty: '', reprocessQty: '', rejectedQty: '', holdQty: '', locationId: '', remarks: '', cause: 'NORMAL_LOSS', responsiblePartyId: '', outcome: 'PENDING' };

export default function QcTab({ batch, onBatch, goTo, autoReturn = false }) {
  const { parties = [], locations = [] } = useERP() || {};
  const godowns = godownsOf(locations);
  const perms = batch.permissions || {};
  const qc = batch.qc || { now: {}, inspected: {}, results: [] };
  const uom = batch.quantities?.uom || 'm';
  const { busy, error, notice, run, wrap, reload, setNotice } = useBatchAction(batch, onBatch);

  const sendable = rollsWhere(batch, (t) => inGodown(t) && t.status !== 'Reserved');
  const rework = rollsWhere(batch, (t) => t.locationCode === 'SYS-REPROCESS');
  const rejected = rollsWhere(batch, (t) => t.locationCode === 'SYS-REJECT');
  const inspectable = Number(qc.inspectableQty || 0);

  const [send, setSend] = useState({ ids: [], quantity: '', remarks: '' });
  const [result, setResult] = useState(blankQc);
  const [reworkForm, setReworkForm] = useState({ quantity: '', cost: '', remarks: '' });
  const [rejectRow, setRejectRow] = useState(null); // { id, takaId, mode: 'scrap'|'rework', quantity, reason }
  const [returning, setReturning] = useState(autoReturn);
  const [lossForm, setLossForm] = useState(null);
  const [sendingReprocess, setSendingReprocess] = useState(false);
  const [receiveReturnRecord, setReceiveReturnRecord] = useState(null);

  const resultTotal = QC_FIELDS.reduce((s, [k]) => s + Number(result[k] || 0), 0);
  const submitQc = async (e) => {
    e.preventDefault();
    const payload = { ...result };
    if (Number(result.rejectedQty) > 0) {
      payload.loss = { cause: result.cause, responsiblePartyId: result.responsiblePartyId || undefined, outcome: result.outcome };
    }
    if (await run('qc', payload, (b) => `QC ${b.reference} recorded.`)) setResult(blankQc);
  };

  const rejectAction = async (e) => {
    e.preventDefault();
    const done = await wrap(async () => {
      await inventoryService.stockPositionAction('scrap', rejectRow.mode === 'scrap' ? 'dispose' : 'route-rework', {
        lotTakaId: rejectRow.id, quantity: rejectRow.quantity, reason: rejectRow.reason,
      });
      return reload();
    }, rejectRow.mode === 'scrap' ? 'Waste written off.' : 'Moved to rework stock.');
    if (done) setRejectRow(null);
  };

  const saveLoss = async (e) => {
    e.preventDefault();
    if (await wrap(() => inventoryService.recordBatchLoss(batch.batchCode, lossForm), 'Rejection classified.')) setLossForm(null);
  };
  const updateLoss = (id, data) => wrap(() => inventoryService.updateBatchLoss(id, data));

  const now = qc.now || {};
  return (
    <div className="space-y-4">
      <Notice>{error}</Notice>
      <Notice kind="ok">{notice}</Notice>

      <Card
        title="QC status"
        subtitle="QC is optional. Fabric that skipped QC is usable as “Not inspected” — it is never shown as passed."
        actions={<span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${STATE_STYLE[qc.state] || STATE_STYLE['QC Not Done']}`}>{qc.state}</span>}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <Stat label="Not inspected" value={now.notInspected} uom={uom} />
          <Stat label="Pending inspection" value={now.pending} uom={uom} tone="text-amber-700" />
          <Stat label="On hold" value={now.onHold} uom={uom} tone="text-amber-700" />
          <Stat label="Passed / accepted" value={now.passed} uom={uom} tone="text-emerald-700" />
          <Stat label="Second quality" value={now.secondQuality} uom={uom} />
          <Stat label="Rework / reprocess" value={now.reprocess} uom={uom} tone="text-violet-700" />
          <Stat label="Rejected" value={now.rejected} uom={uom} tone="text-rose-700" />
          <Stat label="Wasted (scrapped)" value={qc.wasted} uom={uom} tone="text-rose-700" />
        </div>
        {Number(qc.purchaseQcPending) > 0 && (
          <div className="mt-3"><Notice kind="warn">
            {formatNumberIN(qc.purchaseQcPending)} {uom} came on a purchase receipt ({(qc.purchaseQcReferences || []).join(', ')}) and is inspected on the purchase QC screen, because its result also settles the bill.{' '}
            <Link to="/inventory/qc/pending" className="font-semibold underline">Open pending inspections</Link>
          </Notice></div>
        )}
      </Card>

      {perms.qc && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title="1. Send for QC" subtitle="Move rolls from the godown to QC Hold. Choose rolls, or enter a quantity to take from them in order.">
            {sendable.length === 0 ? <Empty>No rolls of this batch are in a godown.</Empty> : (
              <form onSubmit={async (e) => { e.preventDefault(); if (await run('send-to-qc', { lotTakaIds: send.ids, quantity: send.quantity || undefined, remarks: send.remarks }, (b) => `Sent for QC (${b.reference}).`)) setSend({ ids: [], quantity: '', remarks: '' }); }} className="space-y-2">
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {sendable.map((t) => (
                    <label key={t.id} className="flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer">
                      <span className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={send.ids.includes(t.id)} onChange={(e) => setSend({ ...send, ids: e.target.checked ? [...send.ids, t.id] : send.ids.filter((x) => x !== t.id) })} />
                        <span className="font-mono">{t.takaId}</span><span className="text-slate-400">{t.location} · {t.qcStatus}</span>
                      </span>
                      <span className="tabular-nums">{formatNumberIN(t.availableQuantity)}</span>
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={`Quantity (${uom}) — blank = whole rolls`}><input type="number" min="0.0001" step="any" value={send.quantity} onChange={(e) => setSend({ ...send, quantity: e.target.value })} className={inputCls} /></Field>
                  <Field label="Remarks"><input value={send.remarks} onChange={(e) => setSend({ ...send, remarks: e.target.value })} className={inputCls} placeholder="e.g. Buyer asked for 4-point" /></Field>
                </div>
                <p className="text-[11px] text-slate-500">{send.ids.length ? `${send.ids.length} roll(s) chosen.` : 'No roll chosen: all rolls in the godown are used.'}</p>
                <button type="submit" disabled={busy} className={btnDark}>Send for QC</button>
              </form>
            )}
          </Card>

          <Card title={`2. Record QC result (${formatNumberIN(inspectable)} ${uom} waiting)`} subtitle="Split everything waiting at QC Hold. Hold keeps the undecided part waiting.">
            {inspectable <= 0 ? <Empty>Nothing is waiting for QC here. Send rolls for QC first.</Empty> : (
              <form onSubmit={submitQc} className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {QC_FIELDS.map(([k, label]) => (
                    <Field key={k} label={label}><input type="number" min="0" step="any" value={result[k]} onChange={(e) => setResult({ ...result, [k]: e.target.value })} className={inputCls} /></Field>
                  ))}
                  <Field label="Good fabric goes to *">
                    <select required value={result.locationId} onChange={(e) => setResult({ ...result, locationId: e.target.value })} className={inputCls}>
                      <option value="">Godown</option>{godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </Field>
                </div>
                {Number(result.rejectedQty) > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-rose-50/50 border border-rose-100">
                    <Field label="Why rejected"><select value={result.cause} onChange={(e) => setResult({ ...result, cause: e.target.value })} className={inputCls}>{LOSS_CAUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                    {result.cause !== 'NORMAL_LOSS' && (
                      <Field label="Responsible party"><select value={result.responsiblePartyId} onChange={(e) => setResult({ ...result, responsiblePartyId: e.target.value })} className={inputCls}><option value="">Select</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                    )}
                    <Field label="Outcome"><select value={result.outcome} onChange={(e) => setResult({ ...result, outcome: e.target.value })} className={inputCls}>{LOSS_OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                  </div>
                )}
                <Field label="Remarks / defects"><input value={result.remarks} onChange={(e) => setResult({ ...result, remarks: e.target.value })} className={inputCls} /></Field>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] ${Math.abs(resultTotal - inspectable) < 0.001 ? 'text-emerald-700' : 'text-amber-700'}`}>Total {formatNumberIN(resultTotal)} of {formatNumberIN(inspectable)} {uom}</span>
                  <button type="submit" disabled={busy} className={btnDark}>Save QC result</button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}

      <Card
        title={`Rework / reprocess (${formatNumberIN(batch.quantities?.rework)} ${uom})`}
        subtitle="Rework in-house and send it back to QC, or send it to a dyer / processor."
        actions={rework.length > 0 && perms.jobWork ? <button type="button" onClick={() => goTo('dyeing')} className={btnGhost}>Send to processor for reprocess</button> : null}
      >
        {rework.length === 0 ? <Empty>No rolls are in rework stock.</Empty> : (
          <>
            <Table head={[['Roll'], ['Lot'], ['Qty', 'r']]} minWidth={360}>
              {rework.map((t) => <tr key={t.id}><td className="px-2 py-1.5 font-mono">{t.takaId}</td><td className="px-2 py-1.5">{t.lotNumber}</td><td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(t.availableQuantity)}</td></tr>)}
            </Table>
            {perms.qc && (
              <form onSubmit={async (e) => { e.preventDefault(); if (await run('rework-done', reworkForm, (b) => `Back at QC for re-inspection (${b.reference}).`)) setReworkForm({ quantity: '', cost: '', remarks: '' }); }} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3">
                <Field label={`Reworked qty (${uom}) — blank = all`}><input type="number" min="0.0001" step="any" value={reworkForm.quantity} onChange={(e) => setReworkForm({ ...reworkForm, quantity: e.target.value })} className={inputCls} /></Field>
                {perms.cost && <Field label="Rework cost (₹)"><input type="number" min="0" step="any" value={reworkForm.cost} onChange={(e) => setReworkForm({ ...reworkForm, cost: e.target.value })} className={inputCls} /></Field>}
                <Field label="Remarks"><input value={reworkForm.remarks} onChange={(e) => setReworkForm({ ...reworkForm, remarks: e.target.value })} className={inputCls} /></Field>
                <div className="flex items-end"><button type="submit" disabled={busy} className={`${btnDark} w-full`}>Rework done → QC</button></div>
              </form>
            )}
          </>
        )}
      </Card>

      <Card
        title={`Rejected stock (${formatNumberIN(batch.quantities?.rejected)} ${uom})`}
        subtitle="Return to the vendor, write off as waste, or rework it."
        actions={
          <div className="flex items-center gap-1.5">
            {(rejected.length > 0 || Number(batch.quantities?.rejected || 0) > 0) && (
              <button
                type="button"
                onClick={() => setSendingReprocess(true)}
                className="h-9 px-3 rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw size={13} />
                Send for Reprocess
              </button>
            )}
            {rejected.length > 0 && perms.purchaseReturn && batch.origin === 'PURCHASE' ? (
              <button
                type="button"
                onClick={() => setReturning(true)}
                className="h-9 px-3 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 cursor-pointer"
              >
                Return to vendor
              </button>
            ) : null}
          </div>
        }
      >
        {returning && (
          <RejectReturnModal
            batch={batch}
            onClose={() => setReturning(false)}
            onDone={async (rows) => {
              setReturning(false);
              await wrap(reload, `Purchase return raised: ${rows.map((r) => `${r.returnNumber} (${r.supplier})`).join(', ')}.`);
            }}
          />
        )}
        {rejected.length === 0 ? <Empty>No rejected stock.</Empty> : (
          <Table head={[['Roll'], ['Lot'], ['Qty', 'r'], ['Action', 'r']]} minWidth={480}>
            {rejected.map((t) => (
              <tr key={t.id}>
                <td className="px-2 py-1.5 font-mono">{t.takaId}</td>
                <td className="px-2 py-1.5">{t.lotNumber}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(t.availableQuantity)}</td>
                <td className="px-2 py-1.5 text-right space-x-1">
                  {perms.adjustStock && <button type="button" onClick={() => setRejectRow({ id: t.id, takaId: t.takaId, mode: 'scrap', quantity: t.availableQuantity, reason: '' })} className="h-7 px-2 rounded-md border border-rose-200 text-rose-700 font-semibold cursor-pointer">Waste / scrap</button>}
                  {perms.qc && <button type="button" onClick={() => setRejectRow({ id: t.id, takaId: t.takaId, mode: 'rework', quantity: t.availableQuantity, reason: '' })} className="h-7 px-2 rounded-md border border-slate-200 font-semibold cursor-pointer">To rework</button>}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {rejectRow && (
          <form onSubmit={rejectAction} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="sm:col-span-4 font-semibold">{rejectRow.mode === 'scrap' ? 'Write off as waste' : 'Move to rework stock'} — {rejectRow.takaId}</p>
            <Field label={`Quantity (${uom})`}><input required type="number" min="0.0001" step="any" value={rejectRow.quantity} onChange={(e) => setRejectRow({ ...rejectRow, quantity: e.target.value })} className={inputCls} /></Field>
            <Field label="Reason *" className="sm:col-span-2"><input required value={rejectRow.reason} onChange={(e) => setRejectRow({ ...rejectRow, reason: e.target.value })} className={inputCls} /></Field>
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => setRejectRow(null)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={busy} className={btnDark}>Save</button>
            </div>
          </form>
        )}
      </Card>

      <Card
        title="QC results"
        subtitle="Every inspection of this batch: purchase, production, job work and batch QC."
      >
        {(qc.results || []).length === 0 ? <Empty>QC not done for this batch.</Empty> : (
          <Table head={[['Date'], ['Reference'], ['Good', 'r'], ['Second', 'r'], ['Rework', 'r'], ['Rejected', 'r'], ['By'], ['Notes']]} minWidth={720}>
            {qc.results.map((r) => (
              <tr key={`${r.referenceType}-${r.reference}`}>
                <td className="px-2 py-1.5">{r.date}</td>
                <td className="px-2 py-1.5 font-mono">{r.reference}<span className="block text-[10px] text-slate-400 font-sans">{r.referenceType}</span></td>
                {['good', 'second', 'reprocess', 'reject'].map((k) => <td key={k} className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(r[k])}</td>)}
                <td className="px-2 py-1.5">{r.by || '—'}</td>
                <td className="px-2 py-1.5 text-slate-500">{r.notes || ''}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card
        title="Rejections & claims"
        subtitle="Normal loss is spread over the good fabric. Supplier, job-worker or process faults keep their cost as a claim to recover."
        actions={perms.qc && !lossForm ? <button type="button" onClick={() => { setNotice(''); setLossForm({ quantity: '', cause: 'NORMAL_LOSS', responsiblePartyId: '', process: '', outcome: 'PENDING', reference: '', notes: '' }); }} className={btnGhost}>Classify rejection</button> : null}
      >
        {lossForm && (
          <form onSubmit={saveLoss} className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <Field label={`Rejected qty (${uom}) *`}><input required type="number" min="0.0001" step="any" value={lossForm.quantity} onChange={(e) => setLossForm({ ...lossForm, quantity: e.target.value })} className={inputCls} /></Field>
            <Field label="Cause *"><select value={lossForm.cause} onChange={(e) => setLossForm({ ...lossForm, cause: e.target.value })} className={inputCls}>{LOSS_CAUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            {lossForm.cause !== 'NORMAL_LOSS' && (
              <Field label="Responsible party"><select value={lossForm.responsiblePartyId} onChange={(e) => setLossForm({ ...lossForm, responsiblePartyId: e.target.value })} className={inputCls}><option value="">Select supplier / job worker</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            )}
            <Field label="Outcome"><select value={lossForm.outcome} onChange={(e) => setLossForm({ ...lossForm, outcome: e.target.value })} className={inputCls}>{LOSS_OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Process"><input value={lossForm.process} onChange={(e) => setLossForm({ ...lossForm, process: e.target.value })} placeholder="e.g. Dyeing" className={inputCls} /></Field>
            <Field label="Reference (QC / debit note)"><input value={lossForm.reference} onChange={(e) => setLossForm({ ...lossForm, reference: e.target.value })} className={inputCls} /></Field>
            <Field label="Notes" className="lg:col-span-2"><input value={lossForm.notes} onChange={(e) => setLossForm({ ...lossForm, notes: e.target.value })} className={inputCls} /></Field>
            <div className="col-span-2 lg:col-span-4 flex justify-end gap-2">
              <button type="button" onClick={() => setLossForm(null)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={busy} className={btnDark}>Save</button>
            </div>
          </form>
        )}
        {(batch.costing?.losses || []).length === 0 ? (
          <Empty>{batch.canSeeCost ? 'No rejection classified yet: all rejected metres count as normal loss.' : 'Claim details are visible with ledger access.'}</Empty>
        ) : (
          <Table head={[['Date'], ['Cause'], ['Qty', 'r'], ['Outcome'], ['Claim value', 'r'], ['Claim status'], ['Recovered', 'r']]} minWidth={760}>
            {batch.costing.losses.map((l) => (
              <tr key={l.id}>
                <td className="px-2 py-1.5">{l.date}</td>
                <td className="px-2 py-1.5">{l.causeLabel}{l.responsibleParty ? ` — ${l.responsibleParty}` : ''}{l.reference ? <span className="block text-[10px] text-slate-400">{l.reference}</span> : null}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(l.quantity)}</td>
                <td className="px-2 py-1.5">
                  <select value={l.outcome} disabled={!perms.qc} onChange={(e) => updateLoss(l.id, { outcome: e.target.value })} className="h-7 px-1 rounded border border-slate-200" aria-label="Outcome">
                    {LOSS_OUTCOMES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.claimable ? formatINR(l.claimValue) : 'absorbed'}</td>
                <td className="px-2 py-1.5">
                  {l.claimable ? (
                    <select value={l.claimStatus} onChange={(e) => updateLoss(l.id, { claimStatus: e.target.value })} className="h-7 px-1 rounded border border-slate-200" aria-label="Claim status">
                      {CLAIM_STATUSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  ) : '—'}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {l.claimable ? (
                    <input type="number" min="0" step="any" defaultValue={l.recoveredAmount} aria-label="Recovered amount"
                      onBlur={(e) => { if (e.target.value !== l.recoveredAmount) updateLoss(l.id, { recoveredAmount: e.target.value }); }}
                      className="w-24 h-7 px-1 rounded border border-slate-200 text-right" />
                  ) : '—'}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    
      {/* ── Reprocess Summary & History ─────────────────────── */}
      <Card
        title={`Reprocess History & Vendor Returns (${(batch.reprocessRecords || []).length})`}
        subtitle="Track fabric sent to vendor for rework, partial/full returns, and Reprocess QC status."
      >
        {!(batch.reprocessRecords && batch.reprocessRecords.length > 0) ? (
          <Empty>No reprocess records found for this batch.</Empty>
        ) : (
          <div className="space-y-4">
            {(batch.reprocessRecords || []).map((rpc) => {
              const uomStr = rpc.uom || uom;
              const isFullyReturned = Number(rpc.outstandingQty || 0) <= 0 || rpc.status === 'Completed';
              return (
                <div key={rpc.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700 text-sm">{rpc.reprocessNo}</span>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                          rpc.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {rpc.status}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Outward Challan: {rpc.outwardChallan || '—'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Vendor: <strong className="text-slate-800">{rpc.vendorName || '—'}</strong> · Sent: {rpc.sentDate || '—'} · Target Reprocess Batch: <span className="font-mono font-semibold text-slate-800">{rpc.reprocessBatchCode || `${batch.batchCode}-RP`}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isFullyReturned || !rpc.canReceiveReturn}
                        onClick={() => setReceiveReturnRecord(rpc)}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                          isFullyReturned || !rpc.canReceiveReturn
                            ? 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer'
                        }`}
                        title={isFullyReturned ? 'Full quantity already returned' : 'Record return receipt from vendor'}
                      >
                        <ArrowDownLeft size={14} />
                        {isFullyReturned ? 'Fully Returned' : 'Receive Return'}
                      </button>
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Sent Quantity</span>
                      <span className="font-bold text-slate-800 text-sm">{formatNumberIN(rpc.sentQty)} {uomStr}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Returned Quantity</span>
                      <span className="font-bold text-blue-700 text-sm">{formatNumberIN(rpc.returnedQty)} {uomStr}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Outstanding Quantity</span>
                      <span className={`font-extrabold text-sm ${rpc.outstandingQty > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {formatNumberIN(rpc.outstandingQty)} {uomStr}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Reprocess QC Status</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                        rpc.reprocessQcStatus === 'Passed' ? 'bg-emerald-50 text-emerald-700' :
                        rpc.reprocessQcStatus === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {rpc.reprocessQcStatus || 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Return receipt history sub-table */}
                  {rpc.returns && rpc.returns.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/80">
                      <p className="text-[11px] font-bold text-slate-600 mb-1.5">Return Receipts / GRNs:</p>
                      <Table head={[['GRN #'], ['Return Qty', 'r'], ['Date'], ['Vendor Challan'], ['Charges (₹)', 'r'], ['QC Status']]}>
                        {rpc.returns.map((ret) => (
                          <tr key={ret.id}>
                            <td className="px-2 py-1.5 font-mono font-bold text-indigo-700">{ret.grnNumber}</td>
                            <td className="px-2 py-1.5 text-right font-bold tabular-nums">{formatNumberIN(ret.returnQty)} {uomStr}</td>
                            <td className="px-2 py-1.5 text-slate-600">{ret.returnDate}</td>
                            <td className="px-2 py-1.5 font-mono text-slate-700">{ret.vendorChallan}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{ret.reprocessCharges > 0 ? formatINR(ret.reprocessCharges) : '—'}</td>
                            <td className="px-2 py-1.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {ret.qcStatus || 'Pending QC'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {sendingReprocess && (
        <SendForReprocessModal
          batch={batch}
          onClose={() => setSendingReprocess(false)}
          onDone={async () => {
            setSendingReprocess(false);
            await reload();
          }}
        />
      )}
      {receiveReturnRecord && (
        <ReceiveReturnModal
          record={receiveReturnRecord}
          onClose={() => setReceiveReturnRecord(null)}
          onDone={async () => {
            setReceiveReturnRecord(null);
            await reload();
          }}
        />
      )}

</div>
  );
}
