import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useERP } from '../../../../context/ERPContext';
import { createJWO, createJWORow, deleteJWO } from '../../../../services/jobWorkSync';
import { formatINR, formatNumberIN } from '../../../accounts/accountingShared';
import { Card, Empty, Field, Notice, Table, btnDark, btnGhost, inGodown, inputCls, rollsWhere, useBatchAction } from './shared';

const PROCESSES = ['Dyeing', 'Printing', 'Finishing', 'Reprocess', 'Washing'];
const today = () => new Date().toLocaleDateString('en-CA');
const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);

/**
 * Dyeing / processing at a job worker, from the batch. Sending opens a job
 * work order with an outward challan (the rolls move to the processor's WIP);
 * receiving records the processed rolls, which keep this batch and wait at QC
 * Hold. Losses and closing stay on the job work order.
 */
export default function DyeingTab({ batch, onBatch }) {
  const { parties = [] } = useERP() || {};
  const perms = batch.permissions || {};
  const uom = batch.quantities?.uom || 'm';
  const orders = batch.jobWork || [];
  const { busy, error, notice, wrap, reload, setError } = useBatchAction(batch, onBatch);
  const vendors = parties.filter((p) => /vendor|both|processor|job/i.test(p.type || ''));
  // Whole rolls only: a part-roll send would split the roll at the processor.
  const sendable = rollsWhere(batch, (t) => (inGodown(t) || t.locationCode === 'SYS-REPROCESS') && t.status !== 'Reserved' && !t.bulk);

  const [form, setForm] = useState(null);
  const [receive, setReceive] = useState(null); // { orderId, jwoNo, date, challanNo, meters: {takaId: m} }

  const startSend = () => setForm({
    process: sendable.some((t) => t.locationCode === 'SYS-REPROCESS') && !sendable.some(inGodown) ? 'Reprocess' : 'Dyeing',
    vendorId: '', rate: '', date: today(), challanNo: '', expectedReturnDate: '', remarks: '', ids: [],
  });

  const send = async (e) => {
    e.preventDefault();
    const rolls = sendable.filter((t) => form.ids.includes(t.id));
    if (!rolls.length) { setError('Choose the rolls to send.'); return; }
    const vendor = parties.find((p) => String(p.id) === String(form.vendorId));
    let orderNo = '';
    const done = await wrap(async () => {
      const order = await createJWO({
        process: form.process, vendorId: form.vendorId, vendor: vendor?.name || '', orderDate: form.date,
        rate: form.rate || 0, remarks: [`Batch ${batch.batchCode}`, form.remarks].filter(Boolean).join(' — '),
      });
      try {
        await createJWORow(order.id, 'outwards', {
          date: form.date, qty: sum(rolls, 'availableQuantity'), challanNo: form.challanNo,
          expectedReturnDate: form.expectedReturnDate || undefined, remarks: form.remarks, status: 'Sent',
          takas: rolls.map((t) => ({ lotTakaId: t.id, meters: t.availableQuantity })),
        });
      } catch (err) {
        await deleteJWO(order.id).catch(() => {});
        throw err;
      }
      orderNo = order.jwoNo;
      return reload();
    }, () => `Sent to ${vendor?.name || 'job worker'} on job work order ${orderNo}.`);
    if (done) setForm(null);
  };

  const atProcessor = (order) => {
    const sent = new Set((order.outwards || []).map((o) => o.taka));
    return rollsWhere(batch, (t) => sent.has(t.takaId) && String(t.locationCode || '').startsWith('SYS-WIP'));
  };

  const doReceive = async (e) => {
    e.preventDefault();
    const order = orders.find((o) => o.orderId === receive.orderId);
    const rows = atProcessor(order).filter((t) => Number(receive.meters[t.id]) > 0)
      .map((t) => ({ sourceTakaId: t.id, meters: receive.meters[t.id] }));
    if (!rows.length) { setError('Enter the metres received back.'); return; }
    const done = await wrap(async () => {
      await createJWORow(receive.orderId, 'inwards', {
        date: receive.date, qty: sum(rows, 'meters'), challanNo: receive.challanNo, rejected: 0, takas: rows,
      });
      return reload();
    }, 'Received back; the processed rolls wait at QC Hold (QC is optional — record it on the QC tab).');
    if (done) setReceive(null);
  };

  return (
    <div className="space-y-4">
      <Notice>{error}</Notice>
      <Notice kind="ok">{notice}</Notice>
      <Card
        title="Dyeing & job work"
        subtitle="Send grey fabric for dyeing (or any process) and receive it back. Processed rolls keep this batch ID."
        actions={perms.jobWork && !form ? <button type="button" onClick={startSend} disabled={!sendable.length} className={btnDark}>Send for dyeing / processing</button> : null}
      >
        {!sendable.length && !orders.length && <Empty>No whole rolls in a godown or rework stock to send. Register takas first if the batch is still in bulk.</Empty>}
        {form && (
          <form onSubmit={send} className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
              <Field label="Process *"><input required list="b360-processes" value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} className={inputCls} /></Field>
              <datalist id="b360-processes">{PROCESSES.map((p) => <option key={p} value={p} />)}</datalist>
              <Field label="Job worker / dyer *" className="col-span-2"><select required value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className={inputCls}><option value="">Select</option>{(vendors.length ? vendors : parties).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label={`Rate per ${uom} (₹)`}><input type="number" min="0" step="any" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className={inputCls} /></Field>
              <Field label="Date *"><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} /></Field>
              <Field label="Expected back"><input type="date" value={form.expectedReturnDate} onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })} className={inputCls} /></Field>
              <Field label="Challan no."><input value={form.challanNo} onChange={(e) => setForm({ ...form, challanNo: e.target.value })} className={inputCls} /></Field>
              <Field label="Remarks / shade" className="col-span-2 lg:col-span-5"><input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
              <label className="flex items-center gap-2 px-2 py-1.5 font-semibold cursor-pointer">
                <input type="checkbox" checked={form.ids.length === sendable.length} onChange={(e) => setForm({ ...form, ids: e.target.checked ? sendable.map((t) => t.id) : [] })} /> All rolls ({formatNumberIN(sum(sendable, 'availableQuantity'))} {uom})
              </label>
              {sendable.map((t) => (
                <label key={t.id} className="flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer">
                  <span className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={form.ids.includes(t.id)} onChange={(e) => setForm({ ...form, ids: e.target.checked ? [...form.ids, t.id] : form.ids.filter((x) => x !== t.id) })} />
                    <span className="font-mono">{t.takaId}</span><span className="text-slate-400">{t.location} · {t.qcStatus}</span>
                  </span>
                  <span className="tabular-nums">{formatNumberIN(t.availableQuantity)}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={busy} className={btnDark}>Send {formatNumberIN(sum(sendable.filter((t) => form.ids.includes(t.id)), 'availableQuantity'))} {uom}</button>
            </div>
          </form>
        )}
      </Card>

      {orders.length === 0 ? (
        <Card><Empty>This batch has not been sent for dyeing or any job work.</Empty></Card>
      ) : orders.map((o) => {
        const pending = atProcessor(o);
        return (
          <Card
            key={o.orderId}
            title={`${o.jwoNo} · ${o.process || 'Job work'}`}
            subtitle={`${o.vendor || '—'} · ordered ${o.orderDate} · ${o.status}${perms.cost && o.rate ? ` · rate ${formatINR(o.rate)}/${uom}` : ''}`}
            actions={(
              <>
                <Link to={`/job-work/orders/${o.orderId}`} className={btnGhost + ' inline-flex items-center'}>Open order (losses, close)</Link>
                {perms.jobWork && pending.length > 0 && !receive && (
                  <button type="button" onClick={() => setReceive({ orderId: o.orderId, date: today(), challanNo: '', meters: Object.fromEntries(pending.map((t) => [t.id, ''])) })} className={btnDark}>Receive back</button>
                )}
              </>
            )}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[['Sent', o.sent], ['Received back', o.received], ['Pending at processor', o.pending]].map(([l, v]) => (
                <div key={l} className="p-2 rounded-lg bg-slate-50"><div className="text-[10px] uppercase text-slate-400">{l}</div><div className="font-bold tabular-nums">{formatNumberIN(v)} {uom}</div></div>
              ))}
              {perms.cost && <div className="p-2 rounded-lg bg-slate-50"><div className="text-[10px] uppercase text-slate-400">Other charges</div><div className="font-bold tabular-nums">{formatINR(o.charges)}</div></div>}
            </div>
            {receive?.orderId === o.orderId && (
              <form onSubmit={doReceive} className="space-y-2 mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="grid grid-cols-2 gap-2 max-w-md">
                  <Field label="Date *"><input type="date" required value={receive.date} onChange={(e) => setReceive({ ...receive, date: e.target.value })} className={inputCls} /></Field>
                  <Field label="Processor challan"><input value={receive.challanNo} onChange={(e) => setReceive({ ...receive, challanNo: e.target.value })} className={inputCls} /></Field>
                </div>
                <Table head={[['Roll sent'], ['At processor', 'r'], [`Received (${uom})`, 'r']]} minWidth={360}>
                  {pending.map((t) => (
                    <tr key={t.id}>
                      <td className="px-2 py-1.5 font-mono">{t.takaId}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatNumberIN(t.availableQuantity)}</td>
                      <td className="px-2 py-1.5 text-right"><input type="number" min="0" step="any" max={t.availableQuantity} value={receive.meters[t.id]} onChange={(e) => setReceive({ ...receive, meters: { ...receive.meters, [t.id]: e.target.value } })} aria-label={`Metres received for ${t.takaId}`} className="w-28 h-8 px-2 rounded-md border border-slate-200 text-right" /></td>
                    </tr>
                  ))}
                </Table>
                <p className="text-[11px] text-slate-500">Leave a roll blank if it has not come back. Shrinkage or loss is recorded on the job work order.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setReceive(null)} className={btnGhost}>Cancel</button>
                  <button type="submit" disabled={busy} className={btnDark}>Save receipt</button>
                </div>
              </form>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <h4 className="font-semibold text-slate-700 mb-1">Outward (sent)</h4>
                {(o.outwards || []).length === 0 ? <Empty>—</Empty> : (
                  <Table head={[['Date'], ['Challan'], ['Roll'], ['Metres', 'r']]} minWidth={320}>
                    {o.outwards.map((r, i) => <tr key={`${r.no}-${i}`}><td className="px-2 py-1">{r.date}</td><td className="px-2 py-1">{r.no}{r.challan ? ` / ${r.challan}` : ''}</td><td className="px-2 py-1 font-mono">{r.taka}</td><td className="px-2 py-1 text-right tabular-nums">{formatNumberIN(r.meters)}</td></tr>)}
                  </Table>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-1">Inward (received back)</h4>
                {(o.inwards || []).length === 0 ? <Empty>Nothing received yet.</Empty> : (
                  <Table head={[['Date'], ['Inward'], ['New roll'], ['Metres', 'r'], ['QC']]} minWidth={360}>
                    {o.inwards.map((r, i) => <tr key={`${r.no}-${i}`}><td className="px-2 py-1">{r.date}</td><td className="px-2 py-1">{r.no}{r.challan ? ` / ${r.challan}` : ''}</td><td className="px-2 py-1 font-mono">{r.taka || '—'}</td><td className="px-2 py-1 text-right tabular-nums">{formatNumberIN(r.meters)}</td><td className="px-2 py-1">{r.qcStatus || '—'}</td></tr>)}
                  </Table>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
