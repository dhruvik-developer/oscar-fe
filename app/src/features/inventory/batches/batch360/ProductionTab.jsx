import React, { useState } from 'react';
import { useERP } from '../../../../context/ERPContext';
import { inventoryService } from '../../../../services/domainServices';
import { formatINR, formatNumberIN } from '../../../accounts/accountingShared';
import { Card, Empty, Field, Notice, Stat, Table, btnDark, btnGhost, godownsOf, inputCls, useBatchAction } from './shared';

const EXPENSE_TYPES = ['Production labour', 'Machine / production expense', 'Other direct'];
const today = () => new Date().toLocaleDateString('en-CA');

function RunPanel({ run, batch, onBatch, goTo }) {
  const { items = [], locations = [] } = useERP() || {};
  const godowns = godownsOf(locations);
  const perms = batch.permissions || {};
  const open = run.status === 'Draft' || run.status === 'In Progress';
  const { busy, error, notice, wrap, reload } = useBatchAction(batch, onBatch);
  const act = (name, payload, success) => wrap(async () => {
    await inventoryService.productionRunAction(run.id, name, payload);
    return reload();
  }, success);

  const [day, setDay] = useState({ date: today(), rolls: '' });
  const [issue, setIssue] = useState({ itemId: '', locationId: '', quantity: '', yarnLot: '', customerSupplied: false });
  const [ret, setRet] = useState(null); // { issueId, quantity }
  const [expense, setExpense] = useState({ costType: EXPENSE_TYPES[0], amount: '', remarks: '' });
  const [finish, setFinish] = useState({ wastageQty: '', wastageUom: 'Kg' });
  const materials = items.filter((i) => String(i.id) !== String(run.outputItemId));
  const uom = run.uom || 'm';
  const issues = run.issues || [];
  const enter = perms.production && open;

  return (
    <div className="space-y-4">
      <Notice>{error}</Notice>
      <Notice kind="ok">{notice}</Notice>
      <Card
        title={`${run.runNumber} · ${run.status}`}
        subtitle={`${run.outputItem} · started ${run.runDate}${run.machine ? ` · ${run.machine}` : ''}${run.customerName ? ` · for ${run.customerName}` : ''}`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Planned" value={run.plannedQty} uom={uom} />
          <Stat label="Produced" value={run.producedQty} uom={uom} tone="text-emerald-700" />
          <Stat label="Waiting QC" value={run.waitingQcQty} uom={uom} tone="text-amber-700" />
          <Stat label="Yarn wastage" value={run.wastageQty} uom={run.wastageUom || 'Kg'} />
        </div>
        {Number(run.waitingQcQty) > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">Produced rolls wait at QC Hold. <button type="button" onClick={() => goTo('qc')} className="font-semibold text-blue-700 underline cursor-pointer">Record their QC</button>.</p>
        )}
      </Card>

      <Card title="Daily production" subtitle="Enter each day's rolls. All rolls join this batch and wait at QC Hold.">
        {(run.daily || []).length === 0 ? <Empty>No production entered yet.</Empty> : (
          <Table head={[['Date'], ['Rolls', 'r'], [`Metres (${uom})`, 'r']]} minWidth={360}>
            {run.daily.map((d) => (
              <tr key={d.date}><td className="px-2 py-1.5">{d.date}</td><td className="px-2 py-1.5 text-right tabular-nums">{d.rolls}</td><td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(d.meters)}</td></tr>
            ))}
          </Table>
        )}
        {enter && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await act('output', { date: day.date, rolls: day.rolls.split(/[\s,]+/).filter(Boolean).map((m) => ({ meters: m })) }, `Production for ${day.date} saved.`)) setDay({ ...day, rolls: '' }); }} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 mt-3">
            <Field label="Production date"><input type="date" required max={today()} min={run.runDate} value={day.date} onChange={(e) => setDay({ ...day, date: e.target.value })} className={inputCls} /></Field>
            <Field label={`Metres per roll (${uom})`}><input required value={day.rolls} onChange={(e) => setDay({ ...day, rolls: e.target.value })} placeholder="e.g. 102, 98.5, 110" className={inputCls} /></Field>
            <div className="flex items-end"><button type="submit" disabled={busy} className={btnDark}>Add day&apos;s rolls</button></div>
          </form>
        )}
      </Card>

      <Card title="Yarn issued to this run" subtitle="Issuing takes the yarn out of stock at its cost; return what was not used.">
        {issues.length === 0 ? <Empty>No yarn issued yet.</Empty> : (
          <Table head={[['Date'], ['Yarn'], ['Yarn lot'], ['From'], ['Qty', 'r'], ['Returned', 'r'], ...(perms.cost ? [['Amount', 'r']] : []), ['', 'r']]} minWidth={720}>
            {issues.map((i) => {
              const isReturn = Number(i.quantity) < 0;
              const outstanding = Number(i.quantity) - Number(i.returnedQty || 0);
              return (
                <tr key={i.id} className={isReturn ? 'text-slate-500' : ''}>
                  <td className="px-2 py-1.5">{i.issuedOn}</td>
                  <td className="px-2 py-1.5">{isReturn ? `↩ Returned: ${i.item}` : i.item}{i.customerSupplied ? ' (customer)' : ''}</td>
                  <td className="px-2 py-1.5 font-mono">{i.yarnLot || '—'}</td>
                  <td className="px-2 py-1.5">{i.location}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(i.quantity)} {i.uom}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{isReturn ? '' : formatNumberIN(i.returnedQty)}</td>
                  {perms.cost && <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(i.amount)}</td>}
                  <td className="px-2 py-1.5 text-right">
                    {enter && !isReturn && outstanding > 0 && (
                      <button type="button" onClick={() => setRet({ issueId: i.id, quantity: '', max: outstanding, item: i.item })} className="h-7 px-2 rounded-md border border-slate-200 font-semibold cursor-pointer">Return unused</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        {ret && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await act('return', { issueId: ret.issueId, quantity: ret.quantity }, 'Unused yarn returned to stock.')) setRet(null); }} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <Field label={`Return ${ret.item} (up to ${formatNumberIN(ret.max)})`}><input required type="number" min="0.0001" max={ret.max} step="any" value={ret.quantity} onChange={(e) => setRet({ ...ret, quantity: e.target.value })} className={inputCls} /></Field>
            <div className="flex items-end"><button type="button" onClick={() => setRet(null)} className={btnGhost}>Cancel</button></div>
            <div className="flex items-end"><button type="submit" disabled={busy} className={btnDark}>Return</button></div>
          </form>
        )}
        {enter && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await act('issue', issue, 'Yarn issued.')) setIssue({ itemId: '', locationId: '', quantity: '', yarnLot: '', customerSupplied: false }); }} className="grid grid-cols-2 lg:grid-cols-6 gap-2 mt-3">
            <Field label="Yarn / material *" className="col-span-2"><select required value={issue.itemId} onChange={(e) => setIssue({ ...issue, itemId: e.target.value })} className={inputCls}><option value="">Select</option>{materials.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
            <Field label="From godown *"><select required value={issue.locationId} onChange={(e) => setIssue({ ...issue, locationId: e.target.value })} className={inputCls}><option value="">Select</option>{godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
            <Field label="Quantity *"><input required type="number" min="0.0001" step="any" value={issue.quantity} onChange={(e) => setIssue({ ...issue, quantity: e.target.value })} className={inputCls} /></Field>
            <Field label="Yarn lot"><input value={issue.yarnLot} onChange={(e) => setIssue({ ...issue, yarnLot: e.target.value })} className={inputCls} /></Field>
            <div className="flex flex-col justify-end gap-1">
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={issue.customerSupplied} onChange={(e) => setIssue({ ...issue, customerSupplied: e.target.checked })} /> Customer&apos;s yarn</label>
              <button type="submit" disabled={busy} className={btnDark}>Issue yarn</button>
            </div>
          </form>
        )}
      </Card>

      <Card title="Production expenses" subtitle="Labour, machine and other direct costs become the batch's cost when the run is completed.">
        {(run.expenses || []).length === 0 ? <Empty>No expenses yet.</Empty> : (
          <Table head={[['Type'], ['Remarks'], ...(perms.cost ? [['Amount', 'r']] : [])]} minWidth={360}>
            {run.expenses.map((x) => <tr key={x.id}><td className="px-2 py-1.5">{x.costType}</td><td className="px-2 py-1.5">{x.remarks || '—'}</td>{perms.cost && <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(x.amount)}</td>}</tr>)}
          </Table>
        )}
        {perms.production && !run.costsPosted && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await act('expense', expense, 'Expense added.')) setExpense({ ...expense, amount: '', remarks: '' }); }} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3">
            <Field label="Type"><select value={expense.costType} onChange={(e) => setExpense({ ...expense, costType: e.target.value })} className={inputCls}>{EXPENSE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Amount (₹) *"><input required type="number" min="0.01" step="any" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} className={inputCls} /></Field>
            <Field label="Remarks"><input value={expense.remarks} onChange={(e) => setExpense({ ...expense, remarks: e.target.value })} className={inputCls} /></Field>
            <div className="flex items-end"><button type="submit" disabled={busy} className={btnDark}>Add expense</button></div>
          </form>
        )}
      </Card>

      {open && perms.verifyProduction && (
        <Card title="Complete the run" subtitle="Books the yarn issued (net of returns) and the expenses as the batch's cost, once. Record the yarn wasted.">
          <form onSubmit={(e) => { e.preventDefault(); act('complete', finish, 'Run completed; cost booked to the batch.'); }} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Yarn wastage"><input type="number" min="0" step="any" value={finish.wastageQty} onChange={(e) => setFinish({ ...finish, wastageQty: e.target.value })} className={inputCls} /></Field>
            <Field label="Unit"><input value={finish.wastageUom} onChange={(e) => setFinish({ ...finish, wastageUom: e.target.value })} className={inputCls} /></Field>
            <div className="flex items-end"><button type="submit" disabled={busy || !(run.rolls || []).length} className={btnDark}>Complete run</button></div>
          </form>
        </Card>
      )}
    </div>
  );
}

export default function ProductionTab({ batch, onBatch, goTo }) {
  const runs = batch.productionRuns || [];
  if (runs.length === 0) {
    return (
      <Card title="Production">
        <Empty>
          This batch was not made in an in-house production run, so there is no daily production to show.
          To enter production day by day, add a new batch with “In-house production” in the Batch Registry —
          the run and its batch open together.
        </Empty>
      </Card>
    );
  }
  return <div className="space-y-6">{runs.map((run) => <RunPanel key={run.id} run={run} batch={batch} onBatch={onBatch} goTo={goTo} />)}</div>;
}
