import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Factory, Truck, Droplets, Warehouse, Layers, Wallet, Scale, Spool, RefreshCw, Plus, Pencil, Trash2, Undo2, QrCode,
} from 'lucide-react';
import { api } from '../../services/api';
import { newIdempotencyKey } from '../../services/resourceSync';
import { describeApiError } from '../accounts/accountingShared';
import {
  FABRIC_FLOW_B, EXPENSE_CATEGORIES, FabricFlowSteps, YarnLinesEditor, blankYarnLine, expenseCategoriesFor,
} from './FabricFlowForm';

/**
 * Everything about a factory fabric order on its own PO: quantities, yarn,
 * factory dispatch, dyeing mill (Flow B), receipts & batches, costs and the
 * quantity reconciliation. Every figure comes from the server
 * (`/purchase/orders/<id>/fabric-flow/`); the screen only shows it.
 */
const inputCls = 'w-full h-8 px-2 rounded-lg border border-slate-300 bg-white text-[12px] focus:outline-none focus:border-blue-500';
const btn = 'h-8 px-3 rounded-lg bg-[#1F2E4A] hover:bg-[#152033] text-white text-[11.5px] font-bold disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer';
const btnGhost = 'h-8 px-3 rounded-lg border border-slate-300 text-slate-700 text-[11.5px] font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer';
const num = (v) => Number(v || 0);
const qty = (v) => num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Empty({ children }) {
  return <p className="text-[11.5px] text-slate-400 italic py-2">{children}</p>;
}

function Table({ head, rows, foot }) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl">
      <table className="w-full min-w-[640px] text-[11.5px]">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
          <tr>{head.map(([h, r]) => <th key={h} className={`px-2.5 py-2 font-bold ${r ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((cells, i) => (
            <tr key={i} className="hover:bg-slate-50/60">
              {cells.map((c, j) => <td key={j} className={`px-2.5 py-2 ${head[j]?.[1] ? 'text-right tabular-nums' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot><tr className="border-t border-slate-200 bg-slate-50/60 font-bold">{foot.map((c, j) => <td key={j} className={`px-2.5 py-2 ${head[j]?.[1] ? 'text-right tabular-nums' : ''}`}>{c}</td>)}</tr></tfoot>
        )}
      </table>
    </div>
  );
}

/** One write: an idempotency key per attempt, so a double click saves once. */
function useFlowWrite(poId, onSummary, onError) {
  const [busy, setBusy] = useState(false);
  const keys = useRef({});
  const run = useCallback(async (name, method, path, body, done) => {
    if (!keys.current[name]) keys.current[name] = newIdempotencyKey();
    setBusy(true);
    onError('');
    try {
      const url = `/purchase/orders/${poId}/fabric-flow/${path}`;
      const config = { idempotencyKey: keys.current[name] };
      const res = method === 'delete' ? await api.delete(url, config) : await api[method](url, body, config);
      delete keys.current[name];
      onSummary(res);
      done?.();
      return true;
    } catch (err) {
      onError(describeApiError(err) || err?.message || 'That could not be saved.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [poId, onSummary, onError]);
  return { busy, run };
}

export function PoFabricFlowPanel({ po, vendors = [], items = [], locations = [], formatCurrency, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get(`/purchase/orders/${po.id}/fabric-flow/`));
      setError('');
    } catch (err) {
      setError(describeApiError(err) || 'The fabric flow could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [po.id]);
  useEffect(() => { load(); }, [load]);

  const onSummary = useCallback((summary) => { setData(summary); onChanged?.(); }, [onChanged]);
  const { busy, run } = useFlowWrite(po.id, onSummary, setError);

  if (loading && !data) return <div className="rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-xs">Loading fabric flow…</div>;
  if (!data) return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>;

  const flowB = data.fabricFlow === FABRIC_FLOW_B;
  const q = data.quantities;
  const active = ['Approved', 'Issued', 'Partially Received', 'Fully Received'].includes(data.status);
  const money = (v) => (formatCurrency ? formatCurrency(num(v)) : `₹${qty(v)}`);
  const tabs = [
    { key: 'overview', label: 'PO & Fabric', icon: Factory },
    { key: 'yarn', label: 'Yarn', icon: Spool, count: data.yarnLines.length },
    { key: 'dispatch', label: flowB ? 'Factory → Mill' : 'Factory Dispatch', icon: Truck, count: data.dispatches.length },
    ...(flowB ? [{ key: 'mill', label: 'Dyeing & Processing', icon: Droplets, count: data.millProcesses.length }] : []),
    { key: 'receipts', label: 'Receipts & Batches', icon: Warehouse, count: data.receipts.length },
    { key: 'costs', label: 'Costs & Expenses', icon: Wallet, count: data.expenses.length },
    { key: 'reconcile', label: 'Reconciliation', icon: Scale, alert: num(q.discrepancy.unresolved) > 0 },
  ];
  const props = { data, run, busy, flowB, active, money, vendors, items, locations, formatCurrency };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs" aria-label="Fabric flow">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-slate-100">
        <div className="min-w-0">
          <h4 className="text-[13px] font-extrabold text-[#1F2E4A]">{data.fabricFlowLabel}</h4>
          <div className="mt-1"><FabricFlowSteps flow={data.fabricFlow} /></div>
        </div>
        <button type="button" onClick={load} className={btnGhost} aria-label="Refresh fabric flow"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </header>
      <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 px-4 py-3">
        {[
          ['Ordered', q.ordered],
          flowB ? ['Sent to mill', q.dispatchedToMill] : ['Factory dispatched', q.dispatchedToOscar],
          ...(flowB ? [['Received at mill', q.receivedAtMill], ['Processed', q.processed]] : []),
          ['Received at OSCAR', q.receivedAtOscar],
          ['Accepted (QC)', q.accepted],
          ['Pending', q.pending],
          ['Unresolved difference', q.discrepancy.unresolved, num(q.discrepancy.unresolved) > 0 ? 'text-amber-700' : ''],
        ].map(([k, v, cls]) => (
          <div key={k} className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
            <dt className="text-[9.5px] uppercase font-bold tracking-wide text-slate-400">{k}</dt>
            <dd className={`text-[13px] font-black tabular-nums ${cls || 'text-slate-800'}`}>{qty(v)}</dd>
          </div>
        ))}
      </dl>
      <nav className="px-4" aria-label="Fabric flow sections">
        <div role="tablist" className="flex flex-wrap gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                className={`h-8 px-2.5 rounded-lg text-[11.5px] font-bold inline-flex items-center gap-1.5 cursor-pointer ${on ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:bg-white/60'}`}>
                <Icon size={13} /> {t.label}
                {t.count > 0 && <span className="px-1.5 rounded-full bg-slate-200/80 text-[10px] text-slate-600">{t.count}</span>}
                {t.alert && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="needs attention" />}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="p-4 space-y-3">
        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11.5px] text-rose-700">{error}</div>}
        {!active && tab !== 'overview' && tab !== 'costs' && tab !== 'yarn' && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11.5px] text-amber-800">Approve the PO to record dispatches, mill work and receipts.</p>
        )}
        {tab === 'overview' && <OverviewSection {...props} />}
        {tab === 'yarn' && <YarnSection {...props} />}
        {tab === 'dispatch' && <DispatchSection {...props} />}
        {tab === 'mill' && <MillSection {...props} />}
        {tab === 'receipts' && <ReceiptsSection {...props} />}
        {tab === 'costs' && <CostsSection {...props} />}
        {tab === 'reconcile' && <ReconcileSection {...props} />}
      </div>
    </section>
  );
}

function OverviewSection({ data, money, flowB }) {
  const q = data.quantities;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11.5px]">
        <div className="rounded-lg border border-slate-200 p-2.5"><span className="block text-slate-400 text-[10px] uppercase font-bold">Factory</span><strong>{data.factoryName || '—'}</strong></div>
        {flowB && <div className="rounded-lg border border-slate-200 p-2.5"><span className="block text-slate-400 text-[10px] uppercase font-bold">Dyeing mill</span><strong>{data.dyeingMillName || 'Not decided yet'}</strong></div>}
        <div className="rounded-lg border border-slate-200 p-2.5"><span className="block text-slate-400 text-[10px] uppercase font-bold">Order value</span><strong>{money(data.costs.orderValue)}</strong></div>
      </div>
      <Table
        head={[['Fabric'], ['Ordered', 1], ['UOM'], ['Rate', 1], ['Received at OSCAR', 1]]}
        rows={data.lines.map((l) => [l.item, qty(l.qty), l.uom || '—', money(l.rate), qty(l.receivedQty)])}
      />
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11.5px] text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <span>Awaiting QC: <strong className="tabular-nums">{qty(q.awaitingQc)}</strong></span>
        <span>Second quality: <strong className="tabular-nums">{qty(q.secondQuality)}</strong></span>
        <span>Rework at QC: <strong className="tabular-nums">{qty(q.reprocessAtQc)}</strong></span>
        <span>Rejected at QC: <strong className="tabular-nums">{qty(q.rejectedAtQc)}</strong></span>
      </div>
      <p className="text-[11px] text-slate-500">The PO is the order; a batch is fabric that actually arrived. Ordered quantity is never stock — only QC-accepted fabric becomes available.</p>
    </div>
  );
}

function YarnSection({ data, run, busy, vendors, items, formatCurrency }) {
  const [editing, setEditing] = useState(null);
  const yarnItems = items.filter((i) => /yarn/i.test(`${i.itemKind || ''} ${i.category || ''} ${i.name || ''}`));
  if (editing) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); run('yarn', 'put', 'yarn-lines/', { yarnLines: editing.map(({ key, id, item, supplierName, amount, ...r }) => ({ ...r, itemId: r.itemId || undefined, supplierId: r.supplierId || undefined })) }, () => setEditing(null)); }} className="space-y-2">
        <YarnLinesEditor rows={editing} onChange={setEditing} yarnItems={yarnItems} vendors={vendors} formatCurrency={formatCurrency} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={busy} className={btn}>Save yarn plan</button>
        </div>
      </form>
    );
  }
  const total = data.yarnLines.reduce((s, y) => s + num(y.amount), 0);
  return (
    <div className="space-y-2">
      {data.yarnLines.length === 0 ? <Empty>No yarn planned for this order.</Empty> : (
        <Table
          head={[['Yarn'], ['Supplier'], ['Lot / ref'], ['Required', 1], ['Actual used', 1], ['Rate', 1], ['Planned amount', 1]]}
          rows={data.yarnLines.map((y) => [y.item || y.yarnQuality, y.supplierName || '—', y.yarnLot || '—', `${qty(y.requiredQty)} ${y.uom}`, y.actualQtyUsed != null ? `${qty(y.actualQtyUsed)} ${y.uom}` : '—', formatCurrency(num(y.rate)), formatCurrency(num(y.amount))])}
          foot={data.yarnLines.length > 1 ? ['Total', '', '', '', '', '', formatCurrency(total)] : null}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10.5px] text-slate-400">Planned yarn is not consumed stock. Yarn bills go under Costs &amp; Expenses.</p>
        <button type="button" className={btnGhost} onClick={() => setEditing(data.yarnLines.length ? data.yarnLines.map((y) => ({ ...y, key: y.id, itemId: y.itemId || '', supplierId: y.supplierId || '', yarnQuality: y.itemId ? '' : y.yarnQuality, actualQtyUsed: y.actualQtyUsed ?? '' })) : [blankYarnLine()])}>
          <Pencil size={13} /> Edit yarn plan
        </button>
      </div>
    </div>
  );
}

function DispatchSection({ data, run, busy, flowB, active, vendors }) {
  const blank = { dispatchedQty: '', dispatchDate: today(), millId: data.dyeingMillId || '', challanNo: '', transporterName: '', vehicleNumber: '', lrBiltyNumber: '', remarks: '' };
  const [form, setForm] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const total = data.dispatches.reduce((s, d) => s + num(d.dispatchedQty), 0);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">
        {flowB
          ? 'Grey fabric the factory sends straight to the dyeing mill. Traced here only — it never becomes OSCAR grey stock.'
          : 'Fabric the factory has produced and dispatched to OSCAR. Stock is added only when it is received.'}
      </p>
      {data.dispatches.length === 0 ? <Empty>No dispatch recorded yet.</Empty> : (
        <Table
          head={[['Dispatch'], ['Date'], ['To'], ['Challan'], ['Transport'], ['Qty', 1]]}
          rows={data.dispatches.map((d) => [<span className="font-mono">{d.deliveryNumber}</span>, d.dispatchDate, d.destination === 'MILL' ? d.millName : 'OSCAR', d.challanNo || '—', [d.transporterName, d.vehicleNumber, d.lrBiltyNumber].filter(Boolean).join(' · ') || '—', qty(d.dispatchedQty)])}
          foot={data.dispatches.length > 1 ? ['Total', '', '', '', '', qty(total)] : null}
        />
      )}
      {active && !form && <button type="button" className={btnGhost} onClick={() => setForm(blank)}><Plus size={13} /> Record factory dispatch</button>}
      {form && (
        <form onSubmit={(e) => { e.preventDefault(); run('dispatch', 'post', 'dispatches/', form, () => setForm(null)); }} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <Field label="Dispatch date *"><input required type="date" value={form.dispatchDate} onChange={set('dispatchDate')} className={inputCls} /></Field>
          <Field label="Quantity dispatched *"><input required type="number" min="0.0001" step="any" value={form.dispatchedQty} onChange={set('dispatchedQty')} className={inputCls} /></Field>
          {flowB && (
            <Field label="Dyeing mill *" className="col-span-2">
              <select required value={form.millId} onChange={set('millId')} className={inputCls}>
                <option value="">Select mill</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Challan / delivery no."><input value={form.challanNo} onChange={set('challanNo')} className={inputCls} /></Field>
          <Field label="Transporter"><input value={form.transporterName} onChange={set('transporterName')} className={inputCls} /></Field>
          <Field label="Vehicle no."><input value={form.vehicleNumber} onChange={set('vehicleNumber')} className={inputCls} /></Field>
          <Field label="LR / bilty no."><input value={form.lrBiltyNumber} onChange={set('lrBiltyNumber')} className={inputCls} /></Field>
          <Field label="Remarks" className="col-span-2 sm:col-span-4"><input value={form.remarks} onChange={set('remarks')} className={inputCls} /></Field>
          <div className="col-span-2 sm:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancel</button>
            <button type="submit" disabled={busy} className={btn}>Save dispatch</button>
          </div>
        </form>
      )}
    </div>
  );
}

function MillSection({ data, run, busy, active, vendors }) {
  const millDispatches = data.dispatches.filter((d) => d.destination === 'MILL');
  const blank = { deliveryId: millDispatches[0]?.id || '', millId: millDispatches[0]?.millId || data.dyeingMillId || '', millReceiptDate: today(), qtyReceived: '', processType: 'Dyeing', shade: '', processDetails: '', processedQty: '', millDispatchDate: '', millDispatchedQty: '', millChallanNo: '', reference: '', remarks: '' };
  const [form, setForm] = useState(null); // { id?, ...fields }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = (e) => {
    e.preventDefault();
    const { id, ...body } = form;
    Object.keys(body).forEach((k) => { if (body[k] === '') delete body[k]; });
    if (id) run(`mill-${id}`, 'patch', `mill-processes/${id}/`, body, () => setForm(null));
    else run('mill', 'post', 'mill-processes/', body, () => setForm(null));
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">What the dyeing mill received from the factory, processed and sent on to OSCAR. Dyeing and mill charges go under Costs &amp; Expenses.</p>
      {data.millProcesses.length === 0 ? <Empty>No mill receipt recorded yet.</Empty> : (
        <Table
          head={[['Mill'], ['Received on'], ['Received', 1], ['Process'], ['Processed', 1], ['Sent to OSCAR', 1], ['Mill challan'], ['']]}
          rows={data.millProcesses.map((m) => [
            m.millName, m.millReceiptDate, qty(m.qtyReceived), [m.processType, m.shade].filter(Boolean).join(' · '),
            qty(m.processedQty), `${qty(m.millDispatchedQty)}${m.millDispatchDate ? ` (${m.millDispatchDate})` : ''}`, m.millChallanNo || '—',
            active ? <button type="button" className="text-blue-700 font-semibold hover:underline" onClick={() => setForm({ ...blank, ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v ?? ''])) })}>Update</button> : null,
          ])}
        />
      )}
      {active && !form && (
        millDispatches.length
          ? <button type="button" className={btnGhost} onClick={() => setForm(blank)}><Plus size={13} /> Record mill receipt</button>
          : <p className="text-[11px] text-amber-700">Record the factory&apos;s dispatch to the mill first.</p>
      )}
      {form && (
        <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
          {!form.id && (
            <>
              <Field label="Factory dispatch">
                <select value={form.deliveryId} onChange={(e) => { const d = millDispatches.find((x) => x.id === e.target.value); setForm({ ...form, deliveryId: e.target.value, millId: d?.millId || form.millId }); }} className={inputCls}>
                  <option value="">—</option>
                  {millDispatches.map((d) => <option key={d.id} value={d.id}>{d.deliveryNumber} · {qty(d.dispatchedQty)}</option>)}
                </select>
              </Field>
              <Field label="Dyeing mill *">
                <select required value={form.millId} onChange={set('millId')} className={inputCls}>
                  <option value="">Select mill</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label="Mill receipt date *"><input required type="date" value={form.millReceiptDate} onChange={set('millReceiptDate')} className={inputCls} /></Field>
          <Field label="Qty received by mill *"><input required type="number" min="0.0001" step="any" value={form.qtyReceived} onChange={set('qtyReceived')} className={inputCls} /></Field>
          <Field label="Process"><input value={form.processType} onChange={set('processType')} className={inputCls} /></Field>
          <Field label="Shade / colour"><input value={form.shade} onChange={set('shade')} className={inputCls} /></Field>
          <Field label="Processed qty"><input type="number" min="0" step="any" value={form.processedQty} onChange={set('processedQty')} className={inputCls} /></Field>
          <Field label="Mill dispatch date"><input type="date" value={form.millDispatchDate} onChange={set('millDispatchDate')} className={inputCls} /></Field>
          <Field label="Qty sent to OSCAR"><input type="number" min="0" step="any" value={form.millDispatchedQty} onChange={set('millDispatchedQty')} className={inputCls} /></Field>
          <Field label="Mill challan no."><input value={form.millChallanNo} onChange={set('millChallanNo')} className={inputCls} /></Field>
          <Field label="Processing details" className="col-span-2"><input value={form.processDetails} onChange={set('processDetails')} className={inputCls} /></Field>
          <Field label="Reference / document"><input value={form.reference} onChange={set('reference')} className={inputCls} /></Field>
          <Field label="Remarks"><input value={form.remarks} onChange={set('remarks')} className={inputCls} /></Field>
          <div className="col-span-2 sm:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancel</button>
            <button type="submit" disabled={busy} className={btn}>{form.id ? 'Save update' : 'Save mill receipt'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function ReceiptsSection({ data, run, busy, flowB, active, money, items, locations }) {
  const godowns = locations.filter((l) => !String(l.code || '').startsWith('SYS-'));
  const fabrics = items.filter((i) => /fabric/i.test(i.itemKind || '') || ['LOT', 'TAKA'].includes(String(i.trackingType || '').toUpperCase()));
  const blank = { receiptDate: today(), locationId: godowns[0]?.id || '', challanNo: '', poLineId: data.lines[0]?.id || '', itemId: '', receivedQty: '', rate: '', rolls: '' };
  const [form, setForm] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const rolls = form ? form.rolls.split(/[\s,]+/).filter(Boolean) : [];
  const save = (e) => {
    e.preventDefault();
    run('receipt', 'post', 'receipts/', {
      receiptDate: form.receiptDate, locationId: form.locationId, challanNo: form.challanNo || undefined,
      lines: [{
        poLineId: form.poLineId, itemId: form.itemId || undefined, receivedQty: form.receivedQty, rate: form.rate || undefined,
        takas: rolls.length ? rolls.map((m, i) => ({ taka_number: String(i + 1), qty: m })) : undefined,
      }],
    }, () => setForm(null));
  };
  const rollTotal = rolls.reduce((s, m) => s + num(m), 0);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">
        Each actual receipt opens its own {flowB ? 'Dyed' : 'Grey'} Fabric batch with its own QR code. Received fabric waits at QC Hold; only QC-accepted metres become available stock.
      </p>
      {data.receipts.length === 0 ? <Empty>Nothing received at OSCAR yet.</Empty> : (
        <Table
          head={[['Receipt'], ['Date'], ['Fabric'], ['Received', 1], ['Rate', 1], ['Batch'], ['QC'], ['Accepted', 1], ['Landed cost', 1]]}
          rows={data.receipts.map((r) => [
            <span className="font-mono">{r.grnNumber}</span>, r.receiptDate, r.item, `${qty(r.receivedQty)} ${r.uom || ''}`, money(r.rate),
            r.batchCode ? <Link to={`/inventory/batches/${encodeURIComponent(r.batchCode)}`} className="inline-flex items-center gap-1 font-mono text-blue-700 hover:underline"><QrCode size={12} />{r.batchCode}</Link> : '—',
            r.qcStatus, r.accepted != null ? qty(r.accepted) : '—',
            <span title={r.landedRate ? `₹${r.landedRate} per unit` : ''}>{money(r.allocatedCost)}</span>,
          ])}
        />
      )}
      {data.receipts.length > 0 && (
        <p className="text-[11px] text-slate-500">QC each receipt in <Link to="/inventory/qc" className="font-semibold text-blue-700 hover:underline">QC Work</Link> or from the batch&apos;s QC tab.</p>
      )}
      {active && !form && <button type="button" className={btnGhost} onClick={() => setForm(blank)}><Plus size={13} /> Record receipt at OSCAR</button>}
      {form && (
        <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <Field label="Receipt date *"><input required type="date" value={form.receiptDate} onChange={set('receiptDate')} className={inputCls} /></Field>
          <Field label="Godown *">
            <select required value={form.locationId} onChange={set('locationId')} className={inputCls}>
              <option value="">Select godown</option>
              {godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label={flowB ? 'Mill challan no.' : 'Factory challan no.'}><input value={form.challanNo} onChange={set('challanNo')} className={inputCls} /></Field>
          <Field label="PO fabric line *">
            <select required value={form.poLineId} onChange={set('poLineId')} className={inputCls}>
              {data.lines.map((l) => <option key={l.id} value={l.id}>{l.item} · open {qty(num(l.qty) - num(l.receivedQty))}</option>)}
            </select>
          </Field>
          {flowB && (
            <Field label="Dyed fabric item (if stocked separately)" className="col-span-2">
              <select value={form.itemId} onChange={set('itemId')} className={inputCls}>
                <option value="">Same as the PO fabric</option>
                {fabrics.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Quantity received *"><input required type="number" min="0.0001" step="any" value={form.receivedQty} onChange={set('receivedQty')} className={inputCls} /></Field>
          <Field label="Rate (blank = PO rate)"><input type="number" min="0" step="any" value={form.rate} onChange={set('rate')} className={inputCls} /></Field>
          <Field label={`Metres per roll (optional)${rolls.length ? ` — ${rolls.length} rolls · ${qty(rollTotal)}` : ''}`} className="col-span-2 sm:col-span-4">
            <input value={form.rolls} onChange={set('rolls')} placeholder="e.g. 102, 98.5, 110 — must add up to the quantity" className={inputCls} />
          </Field>
          <div className="col-span-2 sm:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancel</button>
            <button type="submit" disabled={busy} className={btn}><Layers size={13} /> Save receipt &amp; open batch</button>
          </div>
        </form>
      )}
    </div>
  );
}

function CostsSection({ data, run, busy, flowB, money }) {
  const c = data.costs;
  const categories = expenseCategoriesFor(data.fabricFlow);
  const blank = { category: 'MANUFACTURING', expenseType: 'Manufacturing charges', description: '', quantity: '', rate: '', amount: '', expenseDate: today(), billReference: '', status: 'ACTUAL', allocationBasis: 'QUANTITY', poLineId: '', remarks: '' };
  const [form, setForm] = useState(null);
  const set = (k) => (e) => {
    const next = { ...form, [k]: e.target.value };
    if (k === 'category') next.expenseType = (EXPENSE_CATEGORIES.find((x) => x.value === e.target.value)?.types || [''])[0];
    setForm(next);
  };
  const save = (e) => {
    e.preventDefault();
    const { id, ...body } = form;
    Object.keys(body).forEach((k) => { if (body[k] === '' && !['poLineId'].includes(k)) delete body[k]; });
    if (id) run(`expense-${id}`, 'patch', `expenses/${id}/`, body, () => setForm(null));
    else run('expense', 'post', 'expenses/', body, () => setForm(null));
  };
  const status = { NOT_STARTED: ['Not started', 'bg-slate-100 text-slate-600'], PROVISIONAL: ['Provisional', 'bg-amber-50 text-amber-800 border-amber-200'], COMPLETE: ['Complete', 'bg-emerald-50 text-emerald-700 border-emerald-200'] }[c.landedCostStatus] || [c.landedCostStatus, ''];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          ['Fabric / manufacturing', c.manufacturing],
          ['Yarn', c.yarn],
          ...(flowB ? [['Dyeing / processing', c.dyeing]] : []),
          ['Freight', c.freight],
          ['Other', c.other],
          ['Total recorded', c.totalRecorded],
          ['Allocated to batches', c.allocated],
          ['Unallocated', c.unallocated],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <span className="block text-[9.5px] uppercase font-bold tracking-wide text-slate-400">{k}</span>
            <strong className="text-[12.5px] tabular-nums">{money(v)}</strong>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
        <span className={`px-2 py-0.5 rounded-full border text-[10.5px] font-bold ${status[1]}`}>Landed cost: {status[0]}</span>
        <span className="text-slate-500">{c.landedCostNote}</span>
      </div>
      {data.expenses.length === 0 ? <Empty>No costs recorded on this PO yet.</Empty> : (
        <Table
          head={[['Category'], ['Expense'], ['Date'], ['Bill / ref'], ['Status'], ['Amount', 1], ['Allocated', 1], ['']]}
          rows={data.expenses.map((x) => [
            x.categoryLabel, <span>{x.expenseType}{x.description ? <span className="block text-[10.5px] text-slate-400">{x.description}</span> : null}</span>,
            x.expenseDate, x.billReference || '—', x.status === 'ACTUAL' ? 'Actual' : 'Estimated', money(x.amount), money(x.allocated),
            <span className="inline-flex gap-1">
              <button type="button" aria-label="Edit cost" className="p-1 rounded hover:bg-slate-100" onClick={() => setForm({ ...blank, ...Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v ?? ''])) })}><Pencil size={12} /></button>
              <button type="button" aria-label="Remove cost" className="p-1 rounded hover:bg-rose-50 text-rose-600" disabled={busy} onClick={() => { if (window.confirm(`Remove ${x.expenseType} (${money(x.amount)})? Its share is taken off the batches.`)) run(`expense-del-${x.id}`, 'delete', `expenses/${x.id}/`); }}><Trash2 size={12} /></button>
            </span>,
          ])}
        />
      )}
      {!form && <button type="button" className={btnGhost} onClick={() => setForm(blank)}><Plus size={13} /> Add cost</button>}
      {form && (
        <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <Field label="Category *">
            <select required value={form.category} onChange={set('category')} className={inputCls}>
              {categories.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="Expense *">
            <input required list="po-cost-types" value={form.expenseType} onChange={set('expenseType')} className={inputCls} />
            <datalist id="po-cost-types">{(EXPENSE_CATEGORIES.find((x) => x.value === form.category)?.types || []).map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Date *"><input required type="date" value={form.expenseDate} onChange={set('expenseDate')} className={inputCls} /></Field>
          <Field label="Bill / reference no."><input value={form.billReference} onChange={set('billReference')} className={inputCls} /></Field>
          <Field label="Quantity"><input type="number" min="0" step="any" value={form.quantity} onChange={set('quantity')} className={inputCls} /></Field>
          <Field label="Rate (₹)"><input type="number" min="0" step="any" value={form.rate} onChange={set('rate')} className={inputCls} /></Field>
          <Field label="Amount (₹) — blank = qty × rate"><input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} className={inputCls} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')} className={inputCls}>
              <option value="ACTUAL">Actual (billed)</option>
              <option value="ESTIMATED">Estimated</option>
            </select>
          </Field>
          <Field label="Charge to">
            <select value={form.poLineId} onChange={set('poLineId')} className={inputCls}>
              <option value="">Whole order</option>
              {data.lines.map((l) => <option key={l.id} value={l.id}>{l.item}</option>)}
            </select>
          </Field>
          <Field label="Spread over batches by">
            <select value={form.allocationBasis} onChange={set('allocationBasis')} className={inputCls}>
              <option value="QUANTITY">Quantity received</option>
              <option value="VALUE">Fabric value received</option>
            </select>
          </Field>
          <Field label="Description / remarks" className="col-span-2"><input value={form.description} onChange={set('description')} className={inputCls} /></Field>
          <div className="col-span-2 sm:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancel</button>
            <button type="submit" disabled={busy} className={btn}>{form.id ? 'Save cost' : 'Add cost'}</button>
          </div>
        </form>
      )}
      <p className="text-[10.5px] text-slate-400">{c.allocationRule}</p>
    </div>
  );
}

function ReconcileSection({ data, run, busy }) {
  const d = data.quantities.discrepancy;
  const categories = data.options.discrepancyCategories;
  const blankRow = () => ({ category: '', quantity: '' });
  const [rows, setRows] = useState([blankRow()]);
  const [meta, setMeta] = useState({ reason: '', date: today(), reference: '', remarks: '' });
  const total = rows.reduce((s, r) => s + num(r.quantity), 0);
  const over = total > num(d.unresolved) + 0.0001;
  const save = (e) => {
    e.preventDefault();
    run('classify', 'post', 'discrepancies/', { ...meta, entries: rows.filter((r) => r.category && num(r.quantity) > 0) }, () => { setRows([blankRow()]); setMeta({ ...meta, reason: '', reference: '', remarks: '' }); });
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[[d.basisLabel, d.basisQty], ['Received at OSCAR', d.receivedQty], ['Difference', d.difference], ['Classified', d.classifiedTotal], ['Unresolved', d.unresolved, num(d.unresolved) > 0 ? 'text-amber-700' : 'text-emerald-700']].map(([k, v, cls]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <span className="block text-[9.5px] uppercase font-bold tracking-wide text-slate-400">{k}</span>
            <strong className={`text-[13px] tabular-nums ${cls || 'text-slate-800'}`}>{qty(v)}</strong>
          </div>
        ))}
      </div>
      {num(d.overClassified) > 0 && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11.5px] text-amber-800">
          {qty(d.overClassified)} more is classified than the current difference — fabric marked pending has probably arrived. Release that entry below.
        </p>
      )}
      <p className="text-[11px] text-slate-500">The system shows the difference but never decides the reason. Split it yourself; none of these quantities count as available stock.</p>
      {data.discrepancies.length > 0 && (
        <Table
          head={[['Date'], ['Category'], ['Qty', 1], ['Reason'], ['Reference'], ['By'], ['']]}
          rows={data.discrepancies.map((x) => [x.date, x.categoryLabel, qty(x.quantity), x.reason, x.reference || '—', x.user || '—',
            <button type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-rose-700" disabled={busy}
              onClick={() => { const why = window.prompt(`Release ${qty(x.quantity)} ${x.categoryLabel.toLowerCase()}? Give a reason.`); if (why !== null) run(`release-${x.id}`, 'delete', `discrepancies/${x.id}/?reason=${encodeURIComponent(why)}`); }}>
              <Undo2 size={12} /> Release
            </button>])}
        />
      )}
      {num(d.unresolved) > 0 && (
        <form onSubmit={save} className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <h5 className="text-[12px] font-bold text-slate-700">Classify the unresolved {qty(d.unresolved)}</h5>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <Field label="Category *">
                <select required value={r.category} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} className={inputCls}>
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Quantity *">
                <input required type="number" min="0.0001" step="any" value={r.quantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className={inputCls} />
              </Field>
              <button type="button" aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"><Trash2 size={13} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setRows([...rows, blankRow()])} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-blue-600 hover:underline"><Plus size={12} /> Split into another category</button>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="Reason *" className="col-span-2"><input required value={meta.reason} onChange={(e) => setMeta({ ...meta, reason: e.target.value })} className={inputCls} /></Field>
            <Field label="Date"><input type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} className={inputCls} /></Field>
            <Field label="Supporting reference"><input value={meta.reference} onChange={(e) => setMeta({ ...meta, reference: e.target.value })} className={inputCls} /></Field>
            <Field label="Remarks" className="col-span-2 sm:col-span-4"><input value={meta.remarks} onChange={(e) => setMeta({ ...meta, remarks: e.target.value })} className={inputCls} /></Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-[11px] ${over ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>Classifying {qty(total)} of {qty(d.unresolved)}{over ? ' — more than is unresolved.' : ''}</span>
            <button type="submit" disabled={busy || over || total <= 0} className={btn}>Save classification</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default PoFabricFlowPanel;
