import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useERP } from '../../../../context/ERPContext';
import { formatINR, formatNumberIN } from '../../../accounts/accountingShared';
import { Card, Empty, Field, Notice, Stat, Table, btnDark, btnGhost, inputCls, useBatchAction } from './shared';

const blank = {
  yarnItemId: '', yarnName: '', yarnLot: '', yarnCount: '', supplierId: '', uom: 'Kg',
  issuedQty: '', consumedQty: '', returnedQty: '', wasteQty: '', rate: '', date: '', remarks: '',
};

export default function YarnTab({ batch, onBatch }) {
  const { items = [], parties = [] } = useERP() || {};
  const perms = batch.permissions || {};
  const yarn = batch.yarn || { issues: [], manual: [], totals: {} };
  const t = yarn.totals || {};
  const { busy, error, notice, run } = useBatchAction(batch, onBatch);
  const [form, setForm] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const yarnItems = items.filter((i) => String(i.id) !== String(batch.itemId) && !/fabric/i.test(i.itemKind || ''));

  const fromRuns = yarn.issues || [];
  const manual = yarn.manual || [];
  return (
    <div className="space-y-4">
      <Notice>{error}</Notice>
      <Notice kind="ok">{notice}</Notice>
      <Card title="Yarn to fabric" subtitle="Yarn that went into this batch. Purchased ready-made fabric needs no yarn entry.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Issued" value={t.issued} />
          <Stat label="Consumed" value={t.consumed} tone="text-emerald-700" />
          <Stat label="Returned / unused" value={t.returned} />
          <Stat label="Yarn waste" value={t.waste} tone="text-rose-700" />
        </div>
        {perms.cost && yarn.costedAmount != null && (
          <p className="mt-2 text-[11px] text-slate-500">Yarn cost booked from production runs: <span className="font-semibold text-slate-800">{formatINR(yarn.costedAmount)}</span>. Hand entries below are for traceability and add no cost.</p>
        )}
      </Card>

      <Card title="From production runs" subtitle="Issued and returned on the Production tab; these move stock and carry cost.">
        {fromRuns.length === 0 ? <Empty>No yarn issued through a production run.</Empty> : (
          <Table head={[['Date'], ['Run'], ['Yarn'], ['Yarn lot'], ['Qty', 'r'], ...(perms.cost ? [['Amount', 'r']] : [])]} minWidth={600}>
            {fromRuns.map((r) => (
              <tr key={r.id} className={r.isReturn ? 'text-slate-500' : ''}>
                <td className="px-2 py-1.5">{r.date}</td>
                <td className="px-2 py-1.5 font-mono">{r.runNumber}</td>
                <td className="px-2 py-1.5">{r.isReturn ? `↩ Returned: ${r.yarn}` : r.yarn}</td>
                <td className="px-2 py-1.5 font-mono">{r.yarnLot || '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(r.quantity)} {r.uom}</td>
                {perms.cost && <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(r.amount)}</td>}
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card
        title="Recorded by hand"
        subtitle="For fabric made outside a production run. No stock moves and no cost is added."
        actions={perms.production && !form ? <button type="button" onClick={() => setForm(blank)} className={btnGhost}>+ Add yarn</button> : null}
      >
        {form && (
          <form onSubmit={async (e) => { e.preventDefault(); if (await run('yarn', form, 'Yarn recorded.')) setForm(null); }} className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <Field label="Yarn (item)" className="col-span-2">
              <select value={form.yarnItemId} onChange={set('yarnItemId')} className={inputCls}>
                <option value="">— or type the name →</option>
                {yarnItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            {!form.yarnItemId && <Field label="Yarn name"><input value={form.yarnName} onChange={set('yarnName')} className={inputCls} placeholder="e.g. Cotton 30s" /></Field>}
            <Field label="Yarn lot"><input value={form.yarnLot} onChange={set('yarnLot')} className={inputCls} /></Field>
            <Field label="Count"><input value={form.yarnCount} onChange={set('yarnCount')} className={inputCls} placeholder="30s, 2/40" /></Field>
            <Field label="Supplier"><select value={form.supplierId} onChange={set('supplierId')} className={inputCls}><option value="">—</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Unit"><input value={form.uom} onChange={set('uom')} className={inputCls} /></Field>
            <Field label="Issued *"><input type="number" min="0" step="any" value={form.issuedQty} onChange={set('issuedQty')} className={inputCls} /></Field>
            <Field label="Consumed (blank = issued − returned − waste)"><input type="number" min="0" step="any" value={form.consumedQty} onChange={set('consumedQty')} className={inputCls} /></Field>
            <Field label="Returned / unused"><input type="number" min="0" step="any" value={form.returnedQty} onChange={set('returnedQty')} className={inputCls} /></Field>
            <Field label="Waste"><input type="number" min="0" step="any" value={form.wasteQty} onChange={set('wasteQty')} className={inputCls} /></Field>
            {perms.cost && <Field label="Rate (indicative)"><input type="number" min="0" step="any" value={form.rate} onChange={set('rate')} className={inputCls} /></Field>}
            <Field label="Date"><input type="date" value={form.date} onChange={set('date')} className={inputCls} /></Field>
            <Field label="Remarks" className="col-span-2 lg:col-span-4"><input value={form.remarks} onChange={set('remarks')} className={inputCls} /></Field>
            <div className="col-span-2 flex items-end justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={busy} className={btnDark}>Save</button>
            </div>
          </form>
        )}
        {manual.length === 0 ? <Empty>No yarn recorded by hand.</Empty> : (
          <Table head={[['Date'], ['Yarn'], ['Lot / count'], ['Supplier'], ['Issued', 'r'], ['Consumed', 'r'], ['Returned', 'r'], ['Waste', 'r'], ['', 'r']]} minWidth={760}>
            {manual.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1.5">{r.date}</td>
                <td className="px-2 py-1.5">{r.yarn}{r.remarks ? <span className="block text-[10px] text-slate-400">{r.remarks}</span> : null}</td>
                <td className="px-2 py-1.5 font-mono">{[r.yarnLot, r.yarnCount].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-2 py-1.5">{r.supplier || '—'}</td>
                {['issued', 'consumed', 'returned', 'waste'].map((k) => <td key={k} className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(r[k])} {r.uom}</td>)}
                <td className="px-2 py-1.5 text-right">
                  {perms.production && (
                    <button type="button" disabled={busy} onClick={() => { if (window.confirm('Remove this yarn entry?')) run('yarn-delete', { yarnId: r.id }, 'Yarn entry removed.'); }} aria-label="Remove yarn entry" className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-rose-700 cursor-pointer"><Trash2 size={13} /></button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
