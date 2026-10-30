import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import AppPagination from '../../../components/ui/AppPagination';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useERP } from '../../../context/ERPContext';
import { api } from '../../../services/api';
import { inventoryService, jobworkService } from '../../../services/domainServices';
import { describeApiError, formatINR, formatNumberIN } from '../../accounts/accountingShared';
import { Modal, ModalButtons } from '../../inventory/warehouses/WarehousesPage';

const TYPES = [
  ['CUSTOMER_FABRIC', 'Dyeing service — customer’s own fabric'],
  ['OSCAR_GREY', 'OSCAR grey fabric + dyeing'],
];
const STATUSES = ['', 'Draft', 'Confirmed', 'Fabric Received', 'At Vendor', 'Dyeing QC', 'Ready', 'Delivered', 'Invoiced', 'Closed', 'Cancelled'];
const n = (v) => formatNumberIN(v || 0);
const inp = 'w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs';

/** Dyeing as its own business: no dependence on OSCAR producing the grey first. */
export default function ServiceOrdersPage() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [f, setF] = useState({ status: '', orderType: '', q: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await jobworkService.getServiceOrders({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page, page_size: pageSize });
      setRows(res?.results || []);
      setCount(res?.count || 0);
    } catch (err) {
      setError(describeApiError(err) || 'Service orders could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [f, page, pageSize]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4 text-xs">
      <PageHeader
        title="Dyeing Service Orders"
        subtitle="Dye a customer's own fabric (bill only the service), or sell OSCAR grey fabric with dyeing (fabric and dyeing billed separately). The dyeing runs on normal job work orders and is inspected in Dyeing QC."
        actions={<button type="button" onClick={() => setEditing({})} className="h-9 px-3 rounded-lg bg-blue-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"><Plus size={14} /> New service order</button>}
      />
      <div className="flex flex-wrap gap-2">
        <select value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }} className="h-9 px-2 rounded-lg border border-slate-200 bg-white" aria-label="Status">
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select value={f.orderType} onChange={(e) => { setF({ ...f, orderType: e.target.value }); setPage(1); }} className="h-9 px-2 rounded-lg border border-slate-200 bg-white" aria-label="Order type">
          <option value="">All types</option>
          {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={f.q} onChange={(e) => { setF({ ...f, q: e.target.value }); setPage(1); }} placeholder="Search order / customer / shade / batch" className="h-9 px-2.5 rounded-lg border border-slate-200 w-64" aria-label="Search" />
      </div>
      {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[980px]">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr><th className="text-left p-2">Order #</th><th className="text-left p-2">Type</th><th className="text-left p-2">Customer / lead</th><th className="text-left p-2">Fabric · shade</th><th className="text-right p-2">Qty</th><th className="text-right p-2">At vendor</th><th className="text-right p-2">Ready</th><th className="text-right p-2">Delivered</th><th className="text-right p-2">Service value</th><th className="text-left p-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={10} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-slate-400">No service orders yet.</td></tr>}
            {!loading && rows.map((o) => (
              <tr key={o.id} onClick={() => setOpenId(o.id)} className="hover:bg-slate-50 cursor-pointer">
                <td className="p-2 font-mono font-bold text-blue-700">{o.orderNumber}</td>
                <td className="p-2">{o.orderType === 'CUSTOMER_FABRIC' ? 'Customer fabric' : 'OSCAR grey + dyeing'}</td>
                <td className="p-2">{o.partyName || o.crmLeadName || '—'}</td>
                <td className="p-2">{o.itemName || o.fabricDescription || '—'}{o.shade ? ` · ${o.shade}` : ''}</td>
                <td className="p-2 text-right tabular-nums">{n(o.quantity)} {o.uom}</td>
                <td className="p-2 text-right tabular-nums">{n(o.quantities.atVendor)}</td>
                <td className="p-2 text-right tabular-nums">{n(o.quantities.ready)}</td>
                <td className="p-2 text-right tabular-nums">{n(o.orderType === 'CUSTOMER_FABRIC' ? o.quantities.delivered : o.quantities.sold)}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(o.serviceValue)}</td>
                <td className="p-2"><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AppPagination total={count} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[10, 25, 50, 100]} loading={loading} />
      {editing && <OrderForm initial={editing} onClose={() => setEditing(null)} onDone={(o) => { setEditing(null); load(); setOpenId(o.id); }} />}
      {openId && <OrderDetail id={openId} onClose={() => setOpenId(null)} onChanged={load} onEdit={(o) => setEditing(o)} />}
    </div>
  );
}

function OrderForm({ initial, onClose, onDone }) {
  const { parties = [], items = [] } = useERP() || {};
  const isNew = !initial.id;
  const [form, setForm] = useState(() => ({
    orderType: 'CUSTOMER_FABRIC', serviceType: 'Dyeing', partyId: '', crmLeadId: '', itemId: '', fabricDescription: '',
    fabricQuality: '', shade: '', colourReference: '', quantity: '', uom: 'Mtr', serviceRate: '', serviceValue: '',
    fabricRate: '', freightCharge: '', otherCharges: '', otherChargesNote: '', finalSellingPrice: '', vendorId: '',
    vendorRate: '', expectedFabricDate: '', expectedVendorReturnDate: '', expectedDeliveryDate: '', notes: '',
    ...Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ''])),
  }));
  const [leads, setLeads] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/crm/leads/', { query: { page_size: 200 } }).then((r) => setLeads(r?.results || [])).catch(() => setLeads([]));
  }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const computed = Number(form.quantity || 0) * Number(form.serviceRate || 0);
  const grey = form.orderType === 'OSCAR_GREY';

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const keys = ['orderType', 'serviceType', 'partyId', 'crmLeadId', 'itemId', 'fabricDescription', 'fabricQuality', 'shade', 'colourReference', 'quantity', 'uom', 'serviceRate', 'serviceValue', 'fabricRate', 'freightCharge', 'otherCharges', 'otherChargesNote', 'finalSellingPrice', 'vendorId', 'vendorRate', 'expectedFabricDate', 'expectedVendorReturnDate', 'expectedDeliveryDate', 'notes'];
    const data = Object.fromEntries(keys.map((k) => [k, form[k] === '' ? null : form[k]]));
    try {
      const o = isNew ? await jobworkService.createServiceOrder(data) : await jobworkService.updateServiceOrder(initial.id, data);
      onDone(o);
    } catch (err) {
      setError(describeApiError(err) || 'The service order could not be saved.');
      setSaving(false);
    }
  };
  const field = (k, label, props = {}) => (
    <label className="block"><span className="block font-semibold mb-1">{label}</span><input value={form[k]} onChange={set(k)} className={inp} {...props} /></label>
  );
  const money = (k, label) => field(k, label, { type: 'number', min: '0', step: 'any' });

  return (
    <Modal title={isNew ? 'New dyeing service order' : `Edit ${initial.orderNumber}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block sm:col-span-2"><span className="block font-semibold mb-1">Order type *</span>
            <select value={form.orderType} onChange={set('orderType')} className={inp} disabled={!isNew && (initial.batchCodes || []).length > 0}>
              {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          {field('serviceType', 'Service')}
          <label className="block"><span className="block font-semibold mb-1">Customer</span>
            <select value={form.partyId} onChange={set('partyId')} className={inp}>
              <option value="">Select customer</option>
              {parties.filter((p) => /customer|both/i.test(p.type || '')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <label className="block"><span className="block font-semibold mb-1">Or CRM lead</span>
            <select value={form.crmLeadId} onChange={set('crmLeadId')} className={inp}>
              <option value="">No lead</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.leadNumber ? `${l.leadNumber} · ` : ''}{l.company || l.name}</option>)}
            </select></label>
          <label className="block"><span className="block font-semibold mb-1">Fabric item</span>
            <select value={form.itemId} onChange={set('itemId')} className={inp}>
              <option value="">Select item</option>
              {items.filter((i) => i.itemKind !== 'Service').map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
            </select></label>
          {field('fabricDescription', 'Fabric details')}
          {field('fabricQuality', 'Quality')}
          {field('shade', 'Colour / shade')}
          {field('colourReference', 'Colour reference / lab dip')}
          {field('quantity', 'Quantity *', { type: 'number', min: '0', step: 'any', required: true })}
          {field('uom', 'Unit')}
        </div>
        <fieldset className="rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <legend className="px-1 font-bold">Rates and prices (entered by you)</legend>
          {money('serviceRate', `Dyeing rate to customer / ${form.uom || 'unit'}`)}
          <label className="block"><span className="block font-semibold mb-1">Service value</span>
            <input type="number" min="0" step="any" value={form.serviceValue} onChange={set('serviceValue')} placeholder={computed ? `${computed.toFixed(2)} (qty × rate)` : ''} className={inp} /></label>
          {grey ? money('fabricRate', `Grey fabric selling rate / ${form.uom || 'unit'}`) : <div />}
          {money('freightCharge', 'Freight charged')}
          {money('otherCharges', 'Other charges')}
          {field('otherChargesNote', 'Other charges — what for')}
          {money('finalSellingPrice', 'Agreed final price (optional)')}
          <label className="block"><span className="block font-semibold mb-1">Dyeing vendor</span>
            <select value={form.vendorId} onChange={set('vendorId')} className={inp}>
              <option value="">Select vendor</option>
              {parties.filter((p) => /vendor|both|agency|processor/i.test(p.type || '')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          {money('vendorRate', `Vendor's dyeing rate / ${form.uom || 'unit'}`)}
        </fieldset>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {field('expectedFabricDate', grey ? 'Fabric ready by' : 'Customer fabric expected', { type: 'date' })}
          {field('expectedVendorReturnDate', 'Expected back from vendor', { type: 'date' })}
          {field('expectedDeliveryDate', 'Delivery to customer', { type: 'date' })}
        </div>
        <label className="block"><span className="block font-semibold mb-1">Notes</span><textarea value={form.notes} onChange={set('notes')} rows={2} className="w-full p-2 rounded-lg border border-slate-200" /></label>
        {error && <div role="alert" className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        <ModalButtons saving={saving} onClose={onClose} label={isNew ? 'Create order' : 'Save changes'} />
      </form>
    </Modal>
  );
}

function OrderDetail({ id, onClose, onChanged, onEdit }) {
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => jobworkService.getServiceOrder(id).then(setO).catch((err) => setError(describeApiError(err) || 'Could not load the order.')), [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (action, data, okText) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await jobworkService.serviceOrderAction(id, action, data);
      setO(next);
      setNotice(okText || '');
      onChanged();
      return true;
    } catch (err) {
      setError(describeApiError(err) || 'That could not be done.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!o) return <Modal title="Service order" onClose={onClose}>{error ? <div role="alert" className="text-rose-700">{error}</div> : <p className="text-slate-400">Loading…</p>}</Modal>;
  const q = o.quantities;
  const closed = ['Closed', 'Cancelled'].includes(o.status);
  const customer = o.orderType === 'CUSTOMER_FABRIC';
  const btn = 'h-8 px-3 rounded-lg font-semibold cursor-pointer disabled:opacity-60';

  return (
    <Modal title={`${o.orderNumber} · ${o.orderTypeLabel}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={o.status} />
          <span className="font-semibold">{o.partyName || o.crmLeadName}</span>
          <span className="text-slate-500">{o.itemName || o.fabricDescription}{o.shade ? ` · ${o.shade}` : ''} · {n(o.quantity)} {o.uom}</span>
          <div className="ml-auto flex gap-2">
            {!closed && <button type="button" onClick={() => onEdit(o)} className={`${btn} border border-slate-200`}>Edit</button>}
            {o.status === 'Draft' && <button type="button" disabled={busy} onClick={() => run('confirm', {}, 'Order confirmed.')} className={`${btn} bg-blue-600 text-white`}>Confirm</button>}
          </div>
        </div>
        {error && <div role="alert" className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        {notice && <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">{notice}</div>}

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {[['received', 'Fabric received'], ['sentToVendor', 'Sent to vendor'], ['atVendor', 'At vendor'], ['returnedFromVendor', 'Returned'], ['dyeingQcPending', 'In Dyeing QC'], ['rework', 'Re-dyeing'], ['rejected', 'Rejected'], ['ready', 'Ready'], [customer ? 'delivered' : 'sold', customer ? 'Delivered' : 'Sold']].map(([k, l]) => (
            <div key={k} className="rounded-lg border border-slate-200 p-2"><div className="text-[10px] text-slate-400">{l}</div><div className="font-bold tabular-nums">{n(q[k])}</div></div>
          ))}
        </div>

        {o.status !== 'Draft' && !closed && (
          <>
            <Section title={customer ? '1. Customer fabric' : '1. OSCAR grey batch'}>
              <BatchList o={o} busy={busy} run={run} />
            </Section>
            <Section title="2. Dyeing vendor (job work)">
              <VendorSteps o={o} busy={busy} run={run} />
            </Section>
            <Section title="3. Dyeing QC">
              <p className="text-slate-600">
                {Number(q.dyeingQcPending) > 0 ? `${n(q.dyeingQcPending)} ${o.uom} is waiting for inspection. ` : 'Nothing waiting for inspection. '}
                Passed fabric becomes ready; re-dyeing goes back to the vendor as a reprocess.{' '}
                <Link to="/inventory/qc/results?stage=dyeing" className="font-semibold text-blue-700 hover:underline">Open Dyeing QC →</Link>
              </p>
            </Section>
            <Section title={customer ? '4. Deliver to customer & bill the service' : '4. Invoice fabric + dyeing'}>
              <Finish o={o} busy={busy} run={run} />
            </Section>
          </>
        )}

        {o.costing && <Costing o={o} />}
        {!closed && o.status !== 'Draft' && (
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" disabled={busy} onClick={() => run('cancel', { reason: 'Cancelled by user' }, 'Order cancelled.')} className={`${btn} border border-rose-200 text-rose-700`}>Cancel order</button>
            <button type="button" disabled={busy} onClick={() => run('close', {}, 'Order closed.')} className={`${btn} border border-slate-300`}>Close order</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Section({ title, children }) {
  return <section className="rounded-xl border border-slate-200 p-3 space-y-2"><h4 className="font-bold">{title}</h4>{children}</section>;
}

function BatchList({ o, busy, run }) {
  const { locations = [] } = useERP() || {};
  const [code, setCode] = useState('');
  const [receive, setReceive] = useState({ locationId: '', totalMeters: '', rolls: '' });
  const [warehouses, setWarehouses] = useState([]);
  const customer = o.orderType === 'CUSTOMER_FABRIC';
  useEffect(() => {
    inventoryService.getWarehouses().then((r) => setWarehouses(r?.results || [])).catch(() => setWarehouses(locations.filter((l) => !String(l.code || '').startsWith('SYS-'))));
  }, [locations]);
  const rolls = receive.rolls.split(/[\s,]+/).filter(Boolean).map((m) => ({ meters: m }));
  return (
    <div className="space-y-2">
      {o.batches.length ? (
        <ul className="space-y-1">
          {o.batches.map((b) => (
            <li key={b.batchCode} className="flex items-center gap-2">
              <Link to={`/inventory/batches/${encodeURIComponent(b.batchCode)}`} className="font-mono font-semibold text-blue-700 hover:underline">{b.batchCode}</Link>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${b.ownership === 'OSCAR' ? 'bg-slate-100 text-slate-700' : 'bg-violet-50 text-violet-700'}`}>{b.ownership === 'OSCAR' ? 'OSCAR' : `${b.ownerPartyName || 'Customer'}'s fabric`}</span>
              <span className="text-slate-500">{b.itemName}</span>
              <button type="button" disabled={busy} onClick={() => run('unlink-batch', { batchCode: b.batchCode }, `Unlinked ${b.batchCode}.`)} className="ml-auto text-rose-600 font-semibold cursor-pointer">Unlink</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-slate-500">No batch linked yet.</p>}
      {customer && (
        <form onSubmit={(e) => { e.preventDefault(); run('receive-fabric', { locationId: receive.locationId, totalMeters: rolls.length ? undefined : receive.totalMeters, rolls: rolls.length ? rolls : undefined }, 'Customer fabric received.').then((ok) => ok && setReceive({ locationId: receive.locationId, totalMeters: '', rolls: '' })); }} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <label className="block"><span className="block font-semibold mb-1">Receive into warehouse</span>
            <select required value={receive.locationId} onChange={(e) => setReceive({ ...receive, locationId: e.target.value })} className={inp}>
              <option value="">Select</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select></label>
          <label className="block"><span className="block font-semibold mb-1">Total metres (bulk)</span><input type="number" min="0" step="any" value={receive.totalMeters} onChange={(e) => setReceive({ ...receive, totalMeters: e.target.value })} className={inp} /></label>
          <label className="block"><span className="block font-semibold mb-1">…or metres per taka</span><input value={receive.rolls} onChange={(e) => setReceive({ ...receive, rolls: e.target.value })} placeholder="60, 40, 52" className={inp} /></label>
          <button type="submit" disabled={busy} className="h-9 px-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">Receive customer fabric</button>
        </form>
      )}
      <form onSubmit={(e) => { e.preventDefault(); run('link-batch', { batchCode: code.trim() }, `Linked ${code.trim()}.`).then((ok) => ok && setCode('')); }} className="flex flex-wrap gap-2 items-end">
        <label className="block"><span className="block font-semibold mb-1">{customer ? 'Or link an existing customer batch' : 'Link the OSCAR grey batch'}</span>
          <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Batch code or scan QR" className={`${inp} w-56 font-mono`} /></label>
        <button type="submit" disabled={busy} className="h-9 px-3 rounded-lg border border-slate-300 font-semibold cursor-pointer">Link batch</button>
      </form>
    </div>
  );
}

function VendorSteps({ o, busy, run }) {
  const [rate, setRate] = useState(o.vendorRate || '');
  const [qty, setQty] = useState(o.quantity || '');
  const [send, setSend] = useState({});
  const [back, setBack] = useState({});
  const sendable = (o.availableRolls || []).filter((r) => !r.locationCode?.startsWith('SYS-') && r.status !== 'External WIP' && !r.bulk);
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); run('create-jwo', { vendorId: o.vendorId, rate, qty }, 'Job work order opened.'); }} className="flex flex-wrap gap-2 items-end">
        <span className="self-center text-slate-600">Vendor: <b>{o.vendorName || 'set on the order'}</b></span>
        <label className="block"><span className="block font-semibold mb-1">Vendor rate / {o.uom}</span><input type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} className={`${inp} w-28`} /></label>
        <label className="block"><span className="block font-semibold mb-1">Qty to dye</span><input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={`${inp} w-28`} /></label>
        <button type="submit" disabled={busy || !o.vendorId} className="h-9 px-3 rounded-lg border border-slate-300 font-semibold disabled:opacity-60 cursor-pointer">Open job work order</button>
      </form>
      {(o.jobWorkOrders || []).map((j) => (
        <div key={j.id} className="rounded-lg border border-slate-200 p-2 space-y-2">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="font-mono font-bold">{j.jwoNo}</span><span>{j.vendorName}</span><span className="text-slate-500">@ {formatINR(j.rate)} · {n(j.plannedQty)}</span><StatusBadge status={j.status} />
            <span className="text-slate-500">Out: {j.outwards.map((x) => `${x.no} (${n(x.meters)})`).join(', ') || '—'} · Back: {j.inwards.map((x) => `${x.no} (${n(x.qty)})`).join(', ') || '—'}</span>
          </div>
          {sendable.length > 0 && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const takas = Object.entries(send[j.id] || {}).filter(([, m]) => Number(m) > 0).map(([lotTakaId, meters]) => ({ lotTakaId, meters }));
              run('send', { jwoId: j.id, takas }, 'Sent to vendor.').then((ok) => ok && setSend({ ...send, [j.id]: {} }));
            }} className="space-y-1">
              <div className="font-semibold">Send rolls to the vendor</div>
              {sendable.map((r) => {
                const val = send[j.id]?.[r.lotTakaId];
                return (
                  <label key={r.lotTakaId} className="flex items-center gap-2">
                    <input type="checkbox" checked={val !== undefined} onChange={(e) => {
                      const next = { ...(send[j.id] || {}) };
                      if (e.target.checked) next[r.lotTakaId] = r.qty; else delete next[r.lotTakaId];
                      setSend({ ...send, [j.id]: next });
                    }} />
                    <span className="font-mono">{r.takaId}</span><span className="text-slate-500">{r.batchCode} · {r.location} · {r.qcStatus}</span>
                    <input type="number" min="0" step="any" max={r.qty} disabled={val === undefined} value={val ?? ''} aria-label={`Metres of ${r.takaId}`} onChange={(e) => setSend({ ...send, [j.id]: { ...send[j.id], [r.lotTakaId]: e.target.value } })} className="w-24 h-7 px-1 rounded border border-slate-200 text-right" />
                    <span className="text-slate-400">of {n(r.qty)}</span>
                  </label>
                );
              })}
              <button type="submit" disabled={busy || !Object.keys(send[j.id] || {}).length} className="h-8 px-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">Send (outward challan)</button>
            </form>
          )}
          {j.atVendorRolls.length > 0 && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const rows = Object.entries(back[j.id] || {}).filter(([, m]) => Number(m) > 0).map(([sourceTakaId, meters]) => ({ sourceTakaId, meters }));
              run('receive-return', { jwoId: j.id, rows }, 'Received from vendor; now in Dyeing QC.').then((ok) => ok && setBack({ ...back, [j.id]: {} }));
            }} className="space-y-1">
              <div className="font-semibold">Record return from vendor (metres received per roll)</div>
              {j.atVendorRolls.map((r) => (
                <label key={r.lotTakaId} className="flex items-center gap-2">
                  <span className="font-mono w-36">{r.takaId}</span><span className="text-slate-500 w-40">{r.batchCode} · sent {n(r.qty)}</span>
                  <input type="number" min="0" step="any" value={back[j.id]?.[r.lotTakaId] ?? ''} aria-label={`Metres back for ${r.takaId}`} onChange={(e) => setBack({ ...back, [j.id]: { ...back[j.id], [r.lotTakaId]: e.target.value } })} className="w-24 h-7 px-1 rounded border border-slate-200 text-right" />
                </label>
              ))}
              <button type="submit" disabled={busy || !Object.values(back[j.id] || {}).some((v) => Number(v) > 0)} className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60 cursor-pointer">Record return</button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

function Finish({ o, busy, run }) {
  const [pick, setPick] = useState({});
  const customer = o.orderType === 'CUSTOMER_FABRIC';
  const rolls = (o.deliverableRolls || []).filter((r) => (customer ? true : r.dyed));
  return (
    <div className="space-y-2">
      {customer && (rolls.length ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          const list = Object.entries(pick).filter(([, q]) => Number(q) > 0).map(([lotTakaId, qty]) => ({ lotTakaId, qty }));
          run('deliver', { rolls: list }, 'Delivered to the customer.').then((ok) => ok && setPick({}));
        }} className="space-y-1">
          {rolls.map((r) => (
            <label key={r.lotTakaId} className="flex items-center gap-2">
              <input type="checkbox" checked={pick[r.lotTakaId] !== undefined} onChange={(e) => { const next = { ...pick }; if (e.target.checked) next[r.lotTakaId] = r.qty; else delete next[r.lotTakaId]; setPick(next); }} />
              <span className="font-mono">{r.takaId}</span><span className="text-slate-500">{r.batchCode} · {r.location} · {n(r.qty)} {r.uom}{r.dyed ? ' · dyed' : ' · undyed'}</span>
            </label>
          ))}
          <button type="submit" disabled={busy || !Object.keys(pick).length} className="h-8 px-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">Deliver selected</button>
        </form>
      ) : <p className="text-slate-500">No QC-passed rolls to deliver yet.</p>)}
      {!customer && <p className="text-slate-500">{rolls.length ? `${rolls.length} dyed roll(s) ready to invoice.` : 'No dyed, QC-passed rolls yet.'}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {o.salesInvoiceId
          ? <Link to="/sales/invoices" className="font-semibold text-blue-700 hover:underline">Invoice created — review and finalize it in Sales Invoices →</Link>
          : <button type="button" disabled={busy} onClick={() => run('invoice', {}, 'Draft invoice created. Check GST and finalize it in Sales Invoices.')} className="h-8 px-3 rounded-lg border border-slate-300 font-semibold cursor-pointer disabled:opacity-60">Create draft invoice</button>}
        <span className="text-slate-500">{customer ? 'Bills only the dyeing service (and any freight / other charges) — never the customer’s fabric.' : 'Fabric and dyeing are separate lines; the fabric line sells the dyed rolls from stock at their cost.'}</span>
      </div>
    </div>
  );
}

function Costing({ o }) {
  const p = o.costing.planned;
  const a = o.costing.actual;
  const row = (label, value, strong) => <div className={`flex justify-between ${strong ? 'font-bold' : ''}`}><dt>{label}</dt><dd className="font-mono">{value == null ? '—' : formatINR(value)}</dd></div>;
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <dl className="rounded-xl border border-slate-200 p-3 space-y-1">
        <h4 className="font-bold mb-1">Planned (your rates)</h4>
        {row('Dyeing service', p.serviceValue)}
        {o.orderType === 'OSCAR_GREY' && row('Grey fabric', p.fabricValue)}
        {row('Freight', p.freight)}
        {row('Other charges', p.otherCharges)}
        {row('Total to customer', p.total, true)}
        {p.finalSellingPrice != null && row('Agreed final price', p.finalSellingPrice)}
        {row('Vendor dyeing cost (planned)', p.vendorCost)}
      </dl>
      <dl className="rounded-xl border border-slate-200 p-3 space-y-1">
        <h4 className="font-bold mb-1">Actual</h4>
        {o.orderType === 'OSCAR_GREY' && row('Grey fabric cost (rolls sent)', a.greyFabricCost)}
        {row(`Vendor dyeing charges (${n(a.returnedQty)} returned)`, a.dyeingCharges)}
        {row('Other job work charges', a.otherJobWorkCharges)}
        {row('Total cost', a.totalCost, true)}
        {row(`Revenue${a.invoiceNumber ? ` (${a.invoiceNumber})` : a.invoiceStatus ? ` (${a.invoiceStatus})` : ''}`, a.revenue)}
        {row('Margin', a.margin, true)}
        <p className="text-[11px] text-slate-500 pt-1">{o.costing.notes.join(' ')} Revenue counts once the invoice is finalized (excluding GST).</p>
      </dl>
    </section>
  );
}
