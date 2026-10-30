import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Plus, RotateCcw, X } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import AppPagination from '../../../components/ui/AppPagination';
import { useERP } from '../../../context/ERPContext';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';
import WarehouseAvailabilityPanel from './WarehouseAvailabilityPanel';

const TABS = [['stock', 'Warehouse stock'], ['warehouses', 'Warehouses'], ['availability', 'Availability & shortage'], ['ledger', 'Stock ledger']];
const n = (v) => formatNumberIN(v || 0);
const input = 'h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs';

/** Simple multi-warehouse inventory: one level of warehouses, no zones / racks / bins. */
export default function WarehousesPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'stock';
  const [warehouses, setWarehouses] = useState([]);
  const [dash, setDash] = useState(null);
  const [error, setError] = useState('');

  const loadBase = useCallback(async () => {
    try {
      const [w, d] = await Promise.all([
        inventoryService.getWarehouses({ includeInactive: 1 }),
        inventoryService.getWarehouseDashboard(),
      ]);
      setWarehouses(w?.results || []);
      setDash(d);
    } catch (err) {
      setError(describeApiError(err) || 'Warehouses could not be loaded.');
    }
  }, []);
  useEffect(() => { loadBase(); }, [loadBase]);

  const uomMain = dash?.byUom?.[0];
  const kpis = [
    ['Total warehouses', dash ? `${dash.totalWarehouses}${dash.inactiveWarehouses ? ` (+${dash.inactiveWarehouses} inactive)` : ''}` : '—'],
    ['Physical stock', uomMain ? `${n(uomMain.physical)} ${uomMain.uom}` : '—'],
    ['Available', uomMain ? `${n(uomMain.available)} ${uomMain.uom}` : '—'],
    ['Reserved', uomMain ? `${n(uomMain.reserved)} ${uomMain.uom}` : '—'],
    ['Pending transfers', dash ? `${dash.pendingTransfers}${dash.draftTransfers ? ` · ${dash.draftTransfers} draft` : ''}` : '—'],
    ['Low-stock items', dash ? String(dash.lowStockItems) : '—'],
  ];

  return (
    <div className="space-y-4 text-xs">
      <PageHeader
        title="Warehouses"
        subtitle="Stock by warehouse, transfers between warehouses and low-stock alerts. Stock in QC hold, rework, reject and in transit is held in system stores and is not counted as warehouse stock."
        actions={<Link to="/inventory/transfers" className="h-9 px-3 inline-flex items-center rounded-lg border border-slate-200 font-semibold hover:bg-slate-50">Transfers →</Link>}
      />
      {error && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">{label}</div>
            <div className="text-base font-bold tabular-nums mt-1">{value}</div>
          </div>
        ))}
      </div>
      {dash?.byUom?.length > 1 && (
        <p className="text-slate-500">Other units: {dash.byUom.slice(1).map((u) => `${n(u.physical)} ${u.uom || '(no unit)'} physical, ${n(u.available)} available`).join(' · ')}</p>
      )}
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setParams({ tab: key })}
            className={`px-3 py-2 font-semibold border-b-2 -mb-px cursor-pointer ${tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>
        ))}
      </div>
      {tab === 'stock' && <StockTab warehouses={warehouses} onChanged={loadBase} />}
      {tab === 'warehouses' && <WarehouseTab warehouses={warehouses} onChanged={loadBase} />}
      {tab === 'availability' && <AvailabilityTab warehouses={warehouses} />}
      {tab === 'ledger' && <LedgerTab warehouses={warehouses} />}
    </div>
  );
}

function WarehouseSelect({ warehouses, value, onChange, label = 'All warehouses', activeOnly = false, ...rest }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={input} {...rest}>
      <option value="">{label}</option>
      {warehouses.filter((w) => !activeOnly || w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code}){w.isActive ? '' : ' — inactive'}</option>)}
    </select>
  );
}

function StockTab({ warehouses, onChanged }) {
  const { items = [] } = useERP() || {};
  const [f, setF] = useState({ warehouseId: '', itemId: '', search: '', groupBy: 'item', ownership: '', lowStock: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [levelRow, setLevelRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await inventoryService.getWarehouseStock(Object.fromEntries(Object.entries(f).filter(([, v]) => v)));
      setRows(res?.results || []);
      setPage(1);
    } catch (err) {
      setError(describeApiError(err) || 'Stock could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [f]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);
  const byBatch = f.groupBy === 'batch';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <WarehouseSelect warehouses={warehouses} value={f.warehouseId} onChange={set('warehouseId')} aria-label="Warehouse" />
        <select value={f.itemId} onChange={(e) => set('itemId')(e.target.value)} className={input} aria-label="Item">
          <option value="">All items</option>
          {items.filter((i) => i.itemKind !== 'Service').map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
        </select>
        <input value={f.search} onChange={(e) => set('search')(e.target.value)} placeholder="Search item / batch / warehouse" className={`${input} w-56`} aria-label="Search" />
        <select value={f.groupBy} onChange={(e) => set('groupBy')(e.target.value)} className={input} aria-label="Group by">
          <option value="item">By item</option><option value="batch">By batch</option>
        </select>
        <label className="inline-flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={!!f.lowStock} disabled={byBatch} onChange={(e) => set('lowStock')(e.target.checked ? '1' : '')} /> Low stock only</label>
        <button type="button" onClick={() => setF({ warehouseId: '', itemId: '', search: '', groupBy: 'item', lowStock: '' })} className="h-9 px-3 rounded-lg border border-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"><RotateCcw size={13} /> Reset</button>
        <button type="button" onClick={() => inventoryService.exportWarehouseStock(Object.fromEntries(Object.entries(f).filter(([, v]) => v))).catch((err) => setError(err.message))} className="ml-auto h-9 px-3 rounded-lg border border-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"><Download size={13} /> Export CSV</button>
      </div>
      {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[960px]">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="text-left p-2">Warehouse</th><th className="text-left p-2">Item</th>{byBatch && <th className="text-left p-2">Batch</th>}
              <th className="text-right p-2">Physical</th><th className="text-right p-2">Reserved</th><th className="text-right p-2">QC pending</th>
              <th className="text-right p-2">Available</th><th className="text-right p-2">Incoming (in transit)</th>
              {!byBatch && <th className="text-right p-2">Minimum</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={9} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-400">No stock matches these filters.</td></tr>}
            {!loading && shown.map((r) => (
              <tr key={`${r.warehouseId}-${r.itemId}-${r.batchCode || ''}`} className={r.lowStock ? 'bg-amber-50/60' : ''}>
                <td className="p-2 font-semibold">{r.warehouseName}<div className="text-[10px] text-slate-400 font-mono">{r.warehouseCode}</div></td>
                <td className="p-2">{r.itemName}<div className="text-[10px] text-slate-400 font-mono">{r.sku}{!byBatch && r.batchCount ? ` · ${r.batchCount} batch(es)` : ''}</div></td>
                {byBatch && <td className="p-2 font-mono">{r.batchCode ? <Link to={`/inventory/batches/${encodeURIComponent(r.batchCode)}`} className="text-blue-700 hover:underline">{r.batchCode}</Link> : 'Untracked'}</td>}
                <td className="p-2 text-right tabular-nums">{n(r.physical)} {r.uom}</td>
                <td className="p-2 text-right tabular-nums">{n(r.reserved)}</td>
                <td className="p-2 text-right tabular-nums">{n(r.qcPending)}</td>
                <td className="p-2 text-right tabular-nums font-bold">{n(r.available)}</td>
                <td className="p-2 text-right tabular-nums">{n(r.inTransit)}</td>
                {!byBatch && (
                  <td className="p-2 text-right">
                    <button type="button" onClick={() => setLevelRow(r)} className="font-semibold text-blue-700 hover:underline cursor-pointer" title="Set the minimum stock for this warehouse">
                      {r.minQty != null ? n(r.minQty) : 'Set'}
                    </button>
                    {r.lowStock && <div className="text-[10px] font-bold text-amber-700">Low stock</div>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AppPagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[10, 25, 50, 100]} loading={loading} />
      {levelRow && <MinStockModal row={levelRow} onClose={() => setLevelRow(null)} onDone={() => { setLevelRow(null); load(); onChanged(); }} />}
    </div>
  );
}

function MinStockModal({ row, onClose, onDone }) {
  const [minQty, setMinQty] = useState(row.minQty ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await inventoryService.setWarehouseStockLevel({ warehouseId: row.warehouseId, itemId: row.itemId, minQty: minQty || 0 });
      onDone();
    } catch (err) {
      setError(describeApiError(err) || 'Could not save.');
      setSaving(false);
    }
  };
  return (
    <Modal title={`Minimum stock — ${row.itemName} at ${row.warehouseName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-slate-500">The item is flagged low when available stock in this warehouse falls below this. 0 turns the alert off.</p>
        <label className="block"><span className="block font-semibold mb-1">Minimum ({row.uom})</span>
          <input type="number" min="0" step="any" required value={minQty} onChange={(e) => setMinQty(e.target.value)} className={`${input} w-full`} /></label>
        {error && <div role="alert" className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        <ModalButtons saving={saving} onClose={onClose} label="Save minimum" />
      </form>
    </Modal>
  );
}

const BLANK = { code: '', name: '', address: '', city: '', state: '', pincode: '', manager: '', contact: '', isActive: true };

function WarehouseTab({ warehouses, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const toggle = async (w) => {
    setError('');
    try {
      await inventoryService.updateWarehouse(w.id, { isActive: !w.isActive });
      onChanged();
    } catch (err) {
      setError(describeApiError(err) || 'Could not change the status.');
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setEditing(BLANK)} className="h-9 px-3 rounded-lg bg-blue-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"><Plus size={14} /> Add warehouse</button>
      </div>
      {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px]">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr><th className="text-left p-2">Code</th><th className="text-left p-2">Name</th><th className="text-left p-2">Address</th><th className="text-left p-2">Manager</th><th className="text-left p-2">Contact Number</th><th className="text-left p-2">Status</th><th className="p-2" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {warehouses.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">No warehouses yet. Add the first one.</td></tr>}
            {warehouses.map((w) => (
              <tr key={w.id}>
                <td className="p-2 font-mono font-semibold">{w.code}</td>
                <td className="p-2 font-semibold">{w.name}{w.type !== 'Warehouse' && <span className="ml-1 text-[10px] text-slate-400">(was {w.type})</span>}</td>
                <td className="p-2 text-slate-600">{[w.address, w.city, w.state, w.pincode].filter(Boolean).join(', ') || '—'}</td>
                <td className="p-2">{w.manager || '—'}</td>
                <td className="p-2">{w.contact || '—'}</td>
                <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${w.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{w.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="p-2 text-right whitespace-nowrap">
                  <button type="button" onClick={() => setEditing(w)} className="font-semibold text-blue-700 hover:underline cursor-pointer mr-3">Edit</button>
                  <button type="button" onClick={() => toggle(w)} className="font-semibold text-slate-600 hover:underline cursor-pointer">{w.isActive ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <WarehouseForm initial={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); onChanged(); }} />}
    </div>
  );
}

function WarehouseForm({ initial, onClose, onDone }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isNew = !initial.id;

  const field = (key, label, props = {}) => (
    <label className="block"><span className="block font-semibold mb-1">{label}</span>
      <input value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={`${input} w-full`} {...props} /></label>
  );

  const handleOnlyDigitsKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.ctrlKey || e.metaKey) return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    // 10-digit number validation for Contact Number
    if (form.contact && form.contact.trim()) {
      const cleanContact = form.contact.replace(/\D/g, '');
      if (cleanContact.length !== 10) {
        setError('Contact Number must be exactly 10 digits.');
        return;
      }
    }

    // 6-digit number validation for PIN code
    if (form.pincode && form.pincode.trim()) {
      const cleanPin = form.pincode.replace(/\D/g, '');
      if (cleanPin.length !== 6) {
        setError('PIN code must be exactly 6 digits.');
        return;
      }
    }

    setSaving(true);
    try {
      const { id, type, ...data } = form;
      const cleanData = {
        ...data,
        contact: (form.contact || '').replace(/\D/g, '').slice(0, 10),
        pincode: (form.pincode || '').replace(/\D/g, '').slice(0, 6)
      };
      if (isNew) await inventoryService.createWarehouse(cleanData);
      else await inventoryService.updateWarehouse(id, { ...cleanData, code: undefined });
      onDone();
    } catch (err) {
      setError(describeApiError(err) || 'The warehouse could not be saved.');
      setSaving(false);
    }
  };

  return (
    <Modal title={isNew ? 'Add warehouse' : `Edit ${initial.name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('code', 'Warehouse code *', { required: true, disabled: !isNew, placeholder: 'e.g. WH-SURAT' })}
        {field('name', 'Warehouse name *', { required: true })}
        <div className="sm:col-span-2">{field('address', 'Address')}</div>
        {field('city', 'City')}
        {field('state', 'State')}

        {/* PIN Code: exactly 6 numbers */}
        <label className="block">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold">PIN code</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {form.pincode ? `${form.pincode.length}/6` : '6 digits'}
            </span>
          </div>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            title="Must be exactly 6 numbers"
            value={form.pincode ?? ''}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setForm((prev) => ({ ...prev, pincode: val }));
            }}
            onKeyDown={handleOnlyDigitsKeyDown}
            placeholder="e.g. 394230"
            className={`${input} w-full font-mono`}
          />
        </label>

        {field('manager', 'Manager')}

        {/* Contact Number: strictly digits only, max 10 digits */}
        <label className="block">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold">Contact Number</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {form.contact ? `${form.contact.length}/10` : '10 digits'}
            </span>
          </div>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
            title="Must be exactly 10 numbers"
            value={form.contact ?? ''}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
              setForm((prev) => ({ ...prev, contact: val }));
            }}
            onKeyDown={handleOnlyDigitsKeyDown}
            placeholder="e.g. 9825012345"
            className={`${input} w-full font-mono`}
          />
        </label>

        {isNew ? null : (
          <label className="inline-flex items-center gap-2 font-semibold self-end h-9"><input type="checkbox" checked={!!form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
        )}
        {error && <div role="alert" className="sm:col-span-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>}
        <div className="sm:col-span-2"><ModalButtons saving={saving} onClose={onClose} label={isNew ? 'Create warehouse' : 'Save changes'} /></div>
      </form>
    </Modal>
  );
}

function AvailabilityTab({ warehouses }) {
  const { items = [] } = useERP() || {};
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-slate-500">Check whether a warehouse can supply a quantity. If it is short, raise a transfer request from a warehouse that has the stock; the stock is reserved at the source on request.</p>
      <div className="flex flex-wrap gap-2">
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={input} aria-label="Item">
          <option value="">Select item</option>
          {items.filter((i) => i.itemKind !== 'Service').map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
        </select>
        <input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Required qty" className={`${input} w-32`} aria-label="Required quantity" />
        <WarehouseSelect warehouses={warehouses} value={warehouseId} onChange={setWarehouseId} label="Dispatch warehouse" activeOnly aria-label="Dispatch warehouse" />
      </div>
      {itemId ? <WarehouseAvailabilityPanel itemId={itemId} qty={qty} warehouseId={warehouseId} /> : <p className="text-slate-400">Pick an item to see its stock in every warehouse.</p>}
    </div>
  );
}

function LedgerTab({ warehouses }) {
  const { items = [] } = useERP() || {};
  const [f, setF] = useState({ warehouseId: '', itemId: '', batch: '', from: '', to: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    inventoryService.getWarehouseLedger(Object.fromEntries(Object.entries(f).filter(([, v]) => v)))
      .then((res) => { if (alive) { setData(res); setPage(1); } })
      .catch((err) => alive && setError(describeApiError(err) || 'The ledger could not be loaded.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [f]);
  const rows = data?.results || [];
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <WarehouseSelect warehouses={warehouses} value={f.warehouseId} onChange={set('warehouseId')} aria-label="Warehouse" />
        <select value={f.itemId} onChange={(e) => set('itemId')(e.target.value)} className={input} aria-label="Item">
          <option value="">All items</option>
          {items.filter((i) => i.itemKind !== 'Service').map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
        </select>
        <input value={f.batch} onChange={(e) => set('batch')(e.target.value.trim())} placeholder="Batch code" className={`${input} w-40 font-mono`} aria-label="Batch" />
        <label className="inline-flex items-center gap-1">From <input type="date" value={f.from} onChange={(e) => set('from')(e.target.value)} className={input} /></label>
        <label className="inline-flex items-center gap-1">To <input type="date" value={f.to} onChange={(e) => set('to')(e.target.value)} className={input} /></label>
      </div>
      <p className="text-slate-500">Balance is the running stock of that item in that warehouse after each movement{f.from ? ' (opening balance before the From date included)' : ''}.{data?.truncated ? ` Showing the latest ${rows.length} of ${data.count}; narrow the filters to see older entries.` : ''}</p>
      {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr><th className="text-left p-2">Date</th><th className="text-left p-2">Warehouse</th><th className="text-left p-2">Item</th><th className="text-left p-2">Batch / taka</th><th className="text-left p-2">Type</th><th className="text-right p-2">In</th><th className="text-right p-2">Out</th><th className="text-right p-2">Balance</th><th className="text-left p-2">Owner</th><th className="text-left p-2">Reference</th><th className="text-left p-2">User</th><th className="text-left p-2">Notes</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={12} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={12} className="p-6 text-center text-slate-400">No movements.</td></tr>}
            {!loading && shown.map((r) => (
              <tr key={r.id}>
                <td className="p-2 whitespace-nowrap">{r.date}</td>
                <td className="p-2">{r.warehouseName}</td>
                <td className="p-2">{r.itemName}</td>
                <td className="p-2 font-mono">{r.batchCode || '—'}{r.takaId && <div className="text-[10px] text-slate-400">{r.takaId}</div>}</td>
                <td className="p-2">{r.type.replaceAll('_', ' ')}</td>
                <td className="p-2 text-right tabular-nums text-emerald-700">{Number(r.in) ? n(r.in) : ''}</td>
                <td className="p-2 text-right tabular-nums text-rose-700">{Number(r.out) ? n(r.out) : ''}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{n(r.balance)} {r.uom}</td>
                <td className="p-2">{r.ownership === 'OSCAR' ? 'OSCAR' : (r.ownerPartyName || r.ownership)}</td>
                <td className="p-2">{r.reference || '—'}</td>
                <td className="p-2">{r.user || '—'}</td>
                <td className="p-2 text-slate-500 max-w-[220px] truncate" title={r.notes || ''}>{r.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AppPagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[25, 50, 100, 200]} loading={loading} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[92vh] flex flex-col text-xs`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ModalButtons({ saving, onClose, label }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
      <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">{saving ? 'Saving…' : label}</button>
    </div>
  );
}
