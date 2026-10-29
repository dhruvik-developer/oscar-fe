import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, RotateCcw, Search, X } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import AppPagination from '../../../components/ui/AppPagination';
import { useERP } from '../../../context/ERPContext';
import { api } from '../../../services/api';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatINR, formatNumberIN } from '../../accounts/accountingShared';
import BatchDrawer from './BatchDrawer';
import { RowActionModal } from './RowActions';

/** `?type=` values the sidebar already links to -> screen keys. */
const TYPE_TO_SCREEN = {
  good: 'usable', sample: 'samples', shortage: 'scrap', reprocess: 'reprocessing', 'customer-return': 'customer-returns', '': 'usable', wastage: 'scrap',

};
const SCREEN_TO_TYPE = Object.fromEntries(Object.entries(TYPE_TO_SCREEN).map(([k, v]) => [v, k]));

const qty = (v, uom) => (v == null ? '—' : `${formatNumberIN(v)}${uom ? ` ${uom}` : ''}`);
const money = (v) => (v == null ? '—' : formatINR(v));

const STOCK_STATUS_OPTIONS = [
  ['', 'All statuses'], ['available', 'Available'], ['reserved', 'Reserved'], ['qcHold', 'QC Hold'],
  ['rework', 'Reprocessing'], ['secondQuality', 'Second Quality'], ['rejected', 'Rejected'], ['withJobWorker', 'At Job Worker'],
];

const ownerCell = (r) => (r.ownership === 'OSCAR'
  ? <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">OSCAR</span>
  : <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px] font-semibold" title="Customer material: not OSCAR's stock">{r.ownerName || 'Customer'}</span>);

const rollColumns = (withCost) => [
  { key: 'batchCode', label: 'Batch', render: (r, open) => (r.batchCode ? <button type="button" onClick={() => open(r.batchCode)} className="font-mono font-bold text-blue-700 hover:underline cursor-pointer">{r.batchCode}</button> : '—'), sub: (r) => r.takaId },
  { key: 'fabric', label: 'Fabric', sub: (r) => r.fabricQuality },
  { key: 'design', label: 'Design' },
  { key: 'shade', label: 'Colour' },
  { key: 'location', label: 'Location' },
  { key: 'quantity', label: 'Qty', align: 'right', render: (r) => qty(r.quantity, r.uom) },
  { key: 'qcStatus', label: 'QC' },
  { key: 'ownership', label: 'Owner', render: ownerCell },
  { key: 'stockStatus', label: 'Status' },
  ...(withCost ? [{ key: 'value', label: 'Value', align: 'right', render: (r) => money(r.value), sub: (r) => (r.rate ? `@ ${formatINR(r.rate)}` : null) }] : []),
];

/** One config per screen: KPIs, columns, filters and row actions. */
const SCREENS = {
  usable: {
    title: 'Usable Fabric Stock',
    subtitle: "OSCAR's own QC-passed fabric in godowns. QC hold, rejected, at vendor and customer material are excluded; reserved is shown apart.",
    kpis: [['forSale', 'Available for sale'], ['forProduction', 'Available for production'], ['reserved', 'Reserved'], ['lowStockItems', 'Low-stock fabrics', 'count'], ['availableValue', 'Available value', 'money']],
    filters: ['q', 'date', 'item', 'design', 'shade', 'location', 'usableStatus'],
    columns: rollColumns,
  },
  scrap: {
    title: 'Short Stock Fabric',
    subtitle: 'QC-rejected stock awaiting a decision, second quality, production wastage and approved process loss. Material routed to rework leaves this list.',
    kpis: [['qcRejected', 'QC rejected (in stock)'], ['scrap', 'Classified as scrap'], ['reusable', 'Reusable / downgrade'], ['productionWaste', 'Production wastage'], ['processLoss', 'Approved process loss'], ['value', 'Rejected stock value', 'money']],
    filters: ['q', 'date', 'item', 'location', 'scrapKind'],
    columns: (withCost) => [
      { key: 'kind', label: 'Type' },
      { key: 'batchCode', label: 'Original batch', render: (r, open) => (r.batchCode ? <button type="button" onClick={() => open(r.batchCode)} className="font-mono font-bold text-blue-700 hover:underline cursor-pointer">{r.batchCode}</button> : '—'), sub: (r) => r.takaId },
      { key: 'fabric', label: 'Fabric' },
      { key: 'reason', label: 'Reason' },
      { key: 'quantity', label: 'Qty', align: 'right', render: (r) => qty(r.quantity, r.uom) },
      { key: 'reusable', label: 'Reusable', render: (r) => (r.reusable ? 'Yes' : 'No') },
      { key: 'disposition', label: 'Disposition' },
      { key: 'stockStatus', label: 'Status' },
      ...(withCost ? [{ key: 'value', label: 'Value', align: 'right', render: (r) => money(r.value) }] : []),
    ],
    actions: (r) => (r.kind === 'QC rejected' && r.lotTakaId ? ['rework', 'dispose', 'vendorReturn'] : []),
  },
  reprocessing: {
    title: 'Reprocess Stock',
    subtitle: 'Fabric with dyeing / processing vendors and in the in-house reprocess store. Pending material is pending — never assumed lost.',
    kpis: [['lotsUnderProcessing', 'Orders with material out', 'count'], ['vendorHeld', 'Held by vendors'], ['pendingReturn', 'Pending return'], ['returnedAwaitingQc', 'Returned, awaiting QC'], ['overdueLots', 'Overdue orders', 'count'], ['awaitingReprocessInStore', 'In reprocess store']],
    filters: ['q', 'reprocessStatus'],
    columns: (withCost) => [
      { key: 'jwoNo', label: 'Job work order', render: (r) => <Link to={`/job-work/orders/${r.jobWorkOrderId}`} className="font-mono font-bold text-blue-700 hover:underline">{r.jwoNo}</Link> },
      { key: 'batches', label: 'Batch', render: (r, open) => (r.batches?.length ? r.batches.map((b) => <button key={b} type="button" onClick={() => open(b)} className="block font-mono text-blue-700 hover:underline cursor-pointer">{b}</button>) : '—') },
      { key: 'vendor', label: 'Vendor' },
      { key: 'process', label: 'Process' },
      { key: 'outwardQty', label: 'Sent', align: 'right', render: (r) => qty(r.outwardQty) },
      { key: 'returnedQty', label: 'Returned', align: 'right', render: (r) => qty(r.returnedQty) },
      { key: 'processLoss', label: 'Process loss', align: 'right', render: (r) => qty(r.processLoss) },
      { key: 'pendingQty', label: 'Pending', align: 'right', render: (r) => <span className={Number(r.pendingQty) > 0 ? 'font-semibold text-amber-700' : ''}>{qty(r.pendingQty)}</span> },
      { key: 'awaitingQcQty', label: 'Awaiting QC', align: 'right', render: (r) => qty(r.awaitingQcQty) },
      ...(withCost ? [{ key: 'charges', label: 'Charges', align: 'right', render: (r) => money(r.charges) }] : []),
      { key: 'dueDate', label: 'Due', render: (r) => <span className={r.overdue ? 'font-semibold text-rose-700' : ''}>{r.dueDate || '—'}{r.overdue ? ' (overdue)' : ''}</span> },
      { key: 'status', label: 'Status' },
    ],
  },
  'customer-returns': {
    title: 'Customer Return Stock',
    subtitle: 'Goods customers sent back. Returned stock stays in QC Hold until QC accepts, regrades, reprocesses or rejects it.',
    kpis: [['total', 'Total returned'], ['awaitingQc', 'Awaiting QC'], ['accepted', 'Accepted'], ['reprocess', 'Reprocessing required'], ['rejected', 'Rejected / awaiting decision']],
    filters: ['q', 'date', 'returnStatus'],
    columns: (withCost) => [
      { key: 'returnNumber', label: 'Return', render: (r) => <Link to="/sales/returns" className="font-mono font-bold text-blue-700 hover:underline">{r.returnNumber}</Link>, sub: (r) => r.date },
      { key: 'customer', label: 'Customer' },
      { key: 'invoiceNumber', label: 'Original sale' },
      { key: 'batchCode', label: 'Original batch', render: (r, open) => (r.batchCode ? <button type="button" onClick={() => open(r.batchCode)} className="font-mono text-blue-700 hover:underline cursor-pointer">{r.batchCode}</button> : '—'), sub: (r) => r.takaId },
      { key: 'fabric', label: 'Fabric' },
      { key: 'quantity', label: 'Qty', align: 'right', render: (r) => qty(r.quantity) },
      { key: 'reason', label: 'Reason' },
      { key: 'qcStatus', label: 'QC status' },
      { key: 'disposition', label: 'Disposition' },
      { key: 'creditNote', label: 'Credit note' },
      ...(withCost ? [{ key: 'creditValue', label: 'Credit value', align: 'right', render: (r) => money(r.creditValue) }] : []),
    ],
  },
  samples: {
    title: 'Sample Fabric Stock',
    subtitle: 'Samples cut from batches: issued, returned, consumed and outstanding. Returns are routed by condition; damaged samples go to Reject.',
    kpis: [['total', 'Samples', 'count'], ['outstanding', 'Outstanding', 'count'], ['issuedQty', 'Issued qty'], ['returnedQty', 'Returned qty'], ['consumedQty', 'Consumed qty'], ['returnedUnderQcQty', 'Returned, under QC']],
    filters: ['q', 'date', 'sampleStatus'],
    headerAction: { to: '/inventory/samples', label: 'Issue sample' },
    columns: (withCost) => [
      { key: 'sampleNumber', label: 'Sample', render: (r) => <span className="font-mono font-bold">{r.sampleNumber}</span>, sub: (r) => r.date },
      { key: 'batchCode', label: 'Batch', render: (r, open) => (r.batchCode ? <button type="button" onClick={() => open(r.batchCode)} className="font-mono text-blue-700 hover:underline cursor-pointer">{r.batchCode}</button> : '—'), sub: (r) => r.takaId },
      { key: 'fabricQuality', label: 'Fabric', sub: (r) => [r.design, r.shade].filter(Boolean).join(' · ') },
      { key: 'party', label: 'Given to' },
      { key: 'quantity', label: 'Qty', align: 'right', render: (r) => qty(r.quantity, r.uom) },
      { key: 'returned', label: 'Returned', align: 'right', render: (r) => qty(r.returned) },
      { key: 'consumed', label: 'Consumed', align: 'right', render: (r) => qty(r.consumed) },
      { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => qty(r.outstanding) },
      { key: 'dueDate', label: 'Due' },
      { key: 'status', label: 'Status' },
      ...(withCost ? [{ key: 'estimatedCost', label: 'Cost', align: 'right', render: (r) => money(r.estimatedCost) }] : []),
    ],
    actions: (r) => (Number(r.outstanding) > 0 ? [...(r.returnable ? ['sampleReturn'] : []), 'sampleConsume'] : []),
  },
};

const STATUS_FILTERS = {
  stockStatus: STOCK_STATUS_OPTIONS,
  usableStatus: [['', 'Available + reserved'], ['available', 'Available'], ['reserved', 'Reserved']],
  scrapKind: [['', 'All types'], ['QC rejected', 'QC rejected'], ['Second quality', 'Second quality'], ['Production wastage', 'Production wastage'], ['Process loss', 'Process loss']],
  reprocessStatus: [['', 'All orders'], ['pending', 'Material pending'], ['overdue', 'Overdue']],
  returnStatus: [['', 'All'], ['Awaiting QC', 'Awaiting QC'], ['Accepted', 'Accepted'], ['Reprocessing required', 'Reprocessing required'], ['Rejected', 'Rejected']],
  sampleStatus: [['', 'All'], ['Issued', 'Issued'], ['Partially Returned', 'Partially returned'], ['Returned', 'Returned'], ['Consumed', 'Consumed'], ['Overdue', 'Overdue']],
};

const inputCls = 'h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500';
const BLANK = { q: '', from: '', to: '', itemId: '', designId: '', shadeId: '', locationId: '', ownership: '', status: '', kind: '' };

export default function StockPositionScreens() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const screen = TYPE_TO_SCREEN[searchParams.get('type') || ''] || 'overview';
  const config = SCREENS[screen];
  const { items = [], locations = [] } = useERP() || {};
  const [masters, setMasters] = useState({ designs: [], shades: [] });
  const [filters, setFilters] = useState(BLANK);
  const [applied, setApplied] = useState(BLANK);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    // Screen change: start from clean filters.
    setFilters(BLANK);
    setApplied(BLANK);
    setPage(1);
    setNotice('');
  }, [screen]);

  useEffect(() => {
    if (!config.filters.some((f) => f === 'design' || f === 'shade')) return;
    Promise.all([
      api.get('/inventory/designs/', { query: { page_size: 200 } }).catch(() => null),
      api.get('/inventory/shades/', { query: { page_size: 200 } }).catch(() => null),
    ]).then(([d, s]) => setMasters({ designs: d?.results || d || [], shades: s?.results || s || [] }));
  }, [config.filters]);

  const query = useMemo(() => {
    const q = { page, page_size: pageSize };
    Object.entries(applied).forEach(([k, v]) => {
      if (!v) return;
      q[k === 'kind' ? 'kind' : k] = v;
    });
    return q;
  }, [applied, page, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await inventoryService.getStockPosition(screen, query));
    } catch (err) {
      setError(describeApiError(err) || 'Stock could not be loaded.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [screen, query]);
  useEffect(() => { load(); }, [load]);

  const withCost = Boolean(data?.canSeeCost);
  const columns = config.columns(withCost);
  const rows = data?.results || [];
  const kpis = data?.kpis || {};
  const has = (f) => config.filters.includes(f);
  const statusKey = config.filters.find((f) => STATUS_FILTERS[f]);
  const apply = (e) => { e?.preventDefault(); setPage(1); setApplied(filters); };
  const reset = () => { setFilters(BLANK); setApplied(BLANK); setPage(1); };
  const exportCsv = async () => {
    try {
      const { page: _p, page_size: _s, ...rest } = query;
      await inventoryService.exportStockPosition(screen, rest);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={(
          <div className="flex gap-2">
            {config.headerAction && <Link to={config.headerAction.to} className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center">{config.headerAction.label}</Link>}
            <button type="button" onClick={exportCsv} disabled={!rows.length} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
              <Download size={14} /> Export CSV
            </button>
          </div>
        )}
      />

      <nav aria-label="Stock position screens" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {Object.entries(SCREENS).sort(([a], [b]) => Object.keys(SCREEN_TO_TYPE).indexOf(a) - Object.keys(SCREEN_TO_TYPE).indexOf(b)).map(([key, s]) => (
          <button key={key} type="button" onClick={() => navigate(SCREEN_TO_TYPE[key] ? `/inventory/stock-position?type=${SCREEN_TO_TYPE[key]}` : '/inventory/stock-position')}
            aria-current={key === screen ? 'page' : undefined}
            className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px cursor-pointer ${key === screen ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {s.title}
          </button>
        ))}
      </nav>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {config.kpis.filter(([key, , kind]) => kind !== 'money' || withCost).map(([key, label, kind]) => (
          <div key={key} className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
            <div className="text-base font-bold text-slate-900 tabular-nums">
              {loading ? '…' : kind === 'money' ? money(kpis[key] ?? 0) : kind === 'count' ? (kpis[key] ?? 0) : formatNumberIN(kpis[key] ?? 0)}
            </div>
          </div>
        ))}
      </section>

      {screen === 'usable' && (data?.lowStock || []).length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <span className="font-semibold">Low stock:</span>{' '}
          {data.lowStock.map((l) => `${l.fabric} (${formatNumberIN(l.available)} / reorder ${formatNumberIN(l.reorderLevel)})`).join(' · ')}
        </div>
      )}

      <form onSubmit={apply} className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <div className="relative lg:col-span-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search batch, taka, lot, fabric, order, customer…" className={`${inputCls} w-full pl-8`} aria-label="Search" />
        </div>
        {has('date') && (
          <div className="flex gap-2 lg:col-span-2">
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={`${inputCls} flex-1 min-w-0`} aria-label="From date" />
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={`${inputCls} flex-1 min-w-0`} aria-label="To date" />
          </div>
        )}
        {has('item') && (
          <select value={filters.itemId} onChange={(e) => setFilters({ ...filters, itemId: e.target.value })} className={inputCls} aria-label="Fabric">
            <option value="">All fabrics</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )}
        {has('design') && (
          <select value={filters.designId} onChange={(e) => setFilters({ ...filters, designId: e.target.value })} className={inputCls} aria-label="Design">
            <option value="">All designs</option>
            {masters.designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {has('shade') && (
          <select value={filters.shadeId} onChange={(e) => setFilters({ ...filters, shadeId: e.target.value })} className={inputCls} aria-label="Colour">
            <option value="">All colours</option>
            {masters.shades.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {has('location') && (
          <select value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })} className={inputCls} aria-label="Godown">
            <option value="">All godowns</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {has('ownership') && (
          <select value={filters.ownership} onChange={(e) => setFilters({ ...filters, ownership: e.target.value })} className={inputCls} aria-label="Ownership">
            <option value="">OSCAR + customer</option>
            <option value="OSCAR">OSCAR-owned</option>
            <option value="CUSTOMER">Customer material</option>
          </select>
        )}
        {statusKey && (
          <select value={statusKey === 'scrapKind' ? filters.kind : filters.status}
            onChange={(e) => setFilters(statusKey === 'scrapKind' ? { ...filters, kind: e.target.value } : { ...filters, status: e.target.value })}
            className={inputCls} aria-label="Status">
            {STATUS_FILTERS[statusKey].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <div className="flex gap-2 justify-end sm:col-span-2 lg:col-span-6">
          <button type="button" onClick={reset} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"><RotateCcw size={13} /> Reset</button>
          <button type="submit" className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer">Apply</button>
        </div>
      </form>

      {error && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex justify-between gap-2">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button></div>}
      {notice && <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">{notice}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                {columns.map((c) => <th key={c.key} className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
                {config.actions && <th className="px-3 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={columns.length + 1} className="px-3 py-10 text-center text-slate-400">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={columns.length + 1} className="px-3 py-10 text-center text-slate-400">Nothing matches these filters.</td></tr>}
              {!loading && rows.map((r, i) => (
                <tr key={r.lotTakaId || r.jobWorkOrderId || r.sampleId || `${r.returnId}-${i}` || i} className="hover:bg-slate-50 align-top">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                      {c.render ? c.render(r, setDrawer) : (r[c.key] ?? '—')}
                      {c.sub && c.sub(r) && <div className="text-[10px] text-slate-400">{c.sub(r)}</div>}
                    </td>
                  ))}
                  {config.actions && (
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {config.actions(r).map((a) => (a === 'vendorReturn' ? (
                        <Link key={a} to={`/inventory/batches/${encodeURIComponent(r.batchCode)}?returnRejected=1`} className="ml-1 inline-block px-2 py-1 rounded-md border border-red-200 text-red-700 font-semibold hover:bg-red-50">Return to supplier</Link>
                      ) : (
                        <button key={a} type="button" onClick={() => setAction({ kind: a, row: r })} className="ml-1 px-2 py-1 rounded-md border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                          {{ rework: 'Route to rework', dispose: 'Dispose', sampleReturn: 'Record return', sampleConsume: 'Mark consumed' }[a]}
                        </button>
                      )))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AppPagination total={data?.count || 0} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[10, 25, 50, 100]} loading={loading} />
      </div>

      {drawer && <BatchDrawer code={drawer} onClose={() => setDrawer(null)} />}
      {action && (
        <RowActionModal
          action={action}
          onClose={() => setAction(null)}
          onDone={(message) => { setAction(null); setNotice(message); load(); }}
        />
      )}
    </div>
  );
}
