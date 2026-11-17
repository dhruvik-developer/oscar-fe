import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Boxes, CheckCircle2, Clock, Download, Factory, FlaskConical, Hourglass, IndianRupee, MapPin, PackageCheck,
  PackageX, Plus, Recycle, RefreshCw, RotateCcw, Ruler, Scissors, Search, ShoppingBag, Trash2, Truck, Undo2, Warehouse, X,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import AppPagination from '../../../components/ui/AppPagination';
import EmptyState from '../../../components/ui/EmptyState';
import KpiCard from '../../../components/ui/KpiCard';
import Skeleton from '../../../components/ui/Skeleton';
import { useERP } from '../../../context/ERPContext';
import { api } from '../../../services/api';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatINR, formatNumberIN } from '../../accounts/accountingShared';
import BatchDrawer from './BatchDrawer';

/** `?type=` values the sidebar already links to -> screen keys. */
const TYPE_TO_SCREEN = {
  good: 'usable', sample: 'samples', shortage: 'scrap', reprocess: 'reprocessing', 'customer-return': 'customer-returns', '': 'usable', wastage: 'scrap',

};
const SCREEN_TO_TYPE = Object.fromEntries(Object.entries(TYPE_TO_SCREEN).map(([k, v]) => [v, k]));

const qty = (v, uom) => (v == null ? '—' : (
  <span className="whitespace-nowrap">
    <span className="font-semibold text-slate-800">{formatNumberIN(v)}</span>
    {uom && <span className="ml-1 text-[11px] text-slate-400">{uom}</span>}
  </span>
));
const money = (v) => (v == null ? '—' : <span className="font-semibold text-slate-800 whitespace-nowrap">{formatINR(v)}</span>);

const BADGE_COLOURS = {
  green: ['Available', 'Passed', 'Accepted', 'Returned', 'Completed'],
  blue: ['Reserved', 'Issued', 'Sent', 'In Progress'],
  yellow: ['Pending', 'On Hold', 'QC Hold', 'Awaiting QC', 'Partially Returned', 'Partially Received'],
  purple: ['Reprocess', 'Reprocessing', 'Reprocessing required', 'In Reprocess Store'],
  orange: ['Second Quality', 'Second quality', 'Production wastage', 'Process loss'],
  cyan: ['At Job Worker'],
  red: ['Rejected', 'QC rejected', 'Overdue'],
};
const BADGE_BY_STATUS = Object.fromEntries(Object.entries(BADGE_COLOURS).flatMap(([tone, list]) => list.map((v) => [v, tone])));
const pill = (v) => (v ? <span className={`badge badge-${BADGE_BY_STATUS[v] || 'gray'} whitespace-nowrap`}>{v}</span> : '—');

const batchCell = (r, open) => (r.batchCode ? <button type="button" onClick={() => open(r.batchCode)} className="font-mono font-bold text-blue-700 hover:underline cursor-pointer whitespace-nowrap">{r.batchCode}</button> : '—');
const strong = (v) => (v ? <span className="inline-block min-w-[150px] font-semibold text-slate-800">{v}</span> : '—');
const place = (v) => (v ? <span className="inline-flex items-center gap-1 whitespace-nowrap"><MapPin size={12} className="text-slate-400 shrink-0" />{v}</span> : '—');

/** Icon and colour of every KPI, by the key the API returns it under. */
const KPI_LOOK = {
  forSale: [ShoppingBag, 'emerald'], forProduction: [Factory, 'blue'], reserved: [PackageCheck, 'sky'], lowStockItems: [AlertTriangle, 'amber'], availableValue: [IndianRupee, 'emerald'],
  qcRejected: [PackageX, 'rose'], scrap: [Trash2, 'rose'], reusable: [Recycle, 'emerald'], productionWaste: [Factory, 'amber'], processLoss: [Hourglass, 'amber'], value: [IndianRupee, 'rose'],
  lotsUnderProcessing: [Boxes, 'blue'], vendorHeld: [Truck, 'sky'], pendingReturn: [Clock, 'amber'], returnedAwaitingQc: [FlaskConical, 'sky'], overdueLots: [AlertTriangle, 'rose'], awaitingReprocessInStore: [Warehouse, 'violet'],
  total: [Boxes, 'blue'], awaitingQc: [FlaskConical, 'amber'], accepted: [CheckCircle2, 'emerald'], reprocess: [RefreshCw, 'violet'], rejected: [PackageX, 'rose'],
  outstanding: [Clock, 'amber'], issuedQty: [Ruler, 'blue'], returnedQty: [Undo2, 'emerald'], consumedQty: [Scissors, 'slate'], returnedUnderQcQty: [FlaskConical, 'sky'],
};
const KPI_COLUMNS = { 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: '2xl:grid-cols-6' };

const STOCK_STATUS_OPTIONS = [
  ['', 'All statuses'], ['available', 'Available'], ['reserved', 'Reserved'], ['qcHold', 'QC Hold'],
  ['rework', 'Reprocessing'], ['secondQuality', 'Second Quality'], ['rejected', 'Rejected'], ['withJobWorker', 'At Job Worker'],
];

const rollColumns = (withCost) => [
  { key: 'batchCode', label: 'Batch', render: batchCell, sub: (r) => r.takaId },
  { key: 'fabric', label: 'Fabric', render: (r) => strong(r.fabric), sub: (r) => r.fabricQuality },
  { key: 'design', label: 'Design / Colour', sub: (r) => r.shade },
  { key: 'location', label: 'Location', render: (r) => place(r.location) },
  { key: 'quantity', label: 'Qty', align: 'right', render: (r) => qty(r.quantity, r.uom) },
  { key: 'qcStatus', label: 'QC', render: (r) => pill(r.qcStatus) },
  { key: 'stockStatus', label: 'Status', render: (r) => pill(r.stockStatus) },
  ...(withCost ? [{ key: 'value', label: 'Value', align: 'right', render: (r) => money(r.value), sub: (r) => (r.rate ? `@ ${formatINR(r.rate)}` : null) }] : []),
];

const STORE_COLUMNS = [
  { key: 'takaNumber', label: 'Taka / Roll #', render: (r) => <span className="font-mono font-bold text-slate-800">#{r.takaNumber}</span> },
  { key: 'lotNumber', label: 'Lot Number', render: (r) => <span className="font-mono">{r.lotNumber || '—'}</span> },
  { key: 'batchCode', label: 'Batch Code', render: batchCell },
  { key: 'fabric', label: 'Fabric Item', render: (r) => strong(r.fabric) },
  { key: 'quantity', label: 'Available Qty', align: 'right', render: (r) => qty(r.quantity, r.uom) },
  { key: 'qcStatus', label: 'QC Status', render: (r) => pill(r.qcStatus) },
  { key: 'location', label: 'Godown / Location', render: (r) => place(r.location) },
  { key: 'receivedDate', label: 'Receipt Date' },
];

/** One config per screen: KPIs, columns and filters. */
const SCREENS = {
  usable: {
    icon: PackageCheck,
    title: 'Usable Fabric Stock',
    subtitle: "OSCAR's own QC-passed fabric in godowns. QC hold, rejected, and at vendor are excluded; reserved is shown apart.",
    kpis: [['forSale', 'For sale'], ['forProduction', 'For production'], ['reserved', 'Reserved'], ['lowStockItems', 'Low stock', 'count'], ['availableValue', 'Stock value', 'money']],
    filters: ['q', 'date', 'item', 'design', 'shade', 'location', 'usableStatus'],
    columns: rollColumns,
  },
  scrap: {
    icon: PackageX,
    title: 'Short Stock Fabric',
    subtitle: 'QC-rejected stock awaiting a decision, second quality, production wastage and approved process loss. Material routed to rework leaves this list.',
    kpis: [['qcRejected', 'QC rejected'], ['scrap', 'Scrap'], ['reusable', 'Reusable'], ['productionWaste', 'Wastage'], ['processLoss', 'Process loss'], ['value', 'Rejected value', 'money']],
    filters: ['q', 'date', 'item', 'location', 'scrapKind'],
    columns: (withCost) => [
      { key: 'kind', label: 'Type', render: (r) => pill(r.kind) },
      { key: 'batchCode', label: 'Original batch', render: batchCell, sub: (r) => r.takaId },
      { key: 'fabric', label: 'Fabric', render: (r) => strong(r.fabric) },
      { key: 'reason', label: 'Reason' },
      { key: 'quantity', label: 'Qty', align: 'right', render: (r) => qty(r.quantity, r.uom) },
      { key: 'reusable', label: 'Reusable', render: (r) => (r.reusable ? 'Yes' : 'No') },
      { key: 'disposition', label: 'Disposition' },
      { key: 'stockStatus', label: 'Status', render: (r) => pill(r.stockStatus) },
      ...(withCost ? [{ key: 'value', label: 'Value', align: 'right', render: (r) => money(r.value) }] : []),
    ],
  },
  reprocessing: {
    icon: RefreshCw,
    title: 'Reprocess Stock',
    subtitle: 'Fabric with dyeing / processing vendors and in the in-house reprocess store. Pending material is pending — never assumed lost.',
    kpis: [['lotsUnderProcessing', 'Orders out', 'count'], ['vendorHeld', 'With vendors'], ['pendingReturn', 'Pending return'], ['returnedAwaitingQc', 'Awaiting QC'], ['overdueLots', 'Overdue orders', 'count'], ['awaitingReprocessInStore', 'In store']],
    filters: ['q', 'reprocessStatus'],
    columns: (withCost) => [
      { key: 'jwoNo', label: 'Job work order', render: (r) => <Link to={`/job-work/orders/${r.jobWorkOrderId}`} className="font-mono font-bold text-blue-700 hover:underline">{r.jwoNo}</Link> },
      { key: 'batches', label: 'Batch', render: (r, open) => (r.batches?.length ? r.batches.map((b) => <button key={b} type="button" onClick={() => open(b)} className="block font-mono font-bold text-blue-700 hover:underline cursor-pointer whitespace-nowrap">{b}</button>) : '—') },
      { key: 'vendor', label: 'Vendor', render: (r) => strong(r.vendor) },
      { key: 'process', label: 'Process' },
      { key: 'outwardQty', label: 'Sent', align: 'right', render: (r) => qty(r.outwardQty) },
      { key: 'returnedQty', label: 'Returned', align: 'right', render: (r) => qty(r.returnedQty) },
      { key: 'processLoss', label: 'Process loss', align: 'right', render: (r) => qty(r.processLoss) },
      { key: 'pendingQty', label: 'Pending', align: 'right', render: (r) => (Number(r.pendingQty) > 0 ? <span className="badge badge-yellow">{formatNumberIN(r.pendingQty)}</span> : qty(r.pendingQty)) },
      { key: 'awaitingQcQty', label: 'Awaiting QC', align: 'right', render: (r) => qty(r.awaitingQcQty) },
      ...(withCost ? [{ key: 'charges', label: 'Charges', align: 'right', render: (r) => money(r.charges) }] : []),
      { key: 'dueDate', label: 'Due', render: (r) => <span className={`whitespace-nowrap ${r.overdue ? 'font-semibold text-rose-700' : ''}`}>{r.dueDate || '—'}{r.overdue ? ' (overdue)' : ''}</span> },
      { key: 'status', label: 'Status', render: (r) => pill(r.status) },
    ],
  },
  'customer-returns': {
    icon: Undo2,
    title: 'Customer Return Stock',
    subtitle: 'Goods customers sent back. Returned stock stays in QC Hold until QC accepts, regrades, reprocesses or rejects it.',
    kpis: [['total', 'Total returned'], ['awaitingQc', 'Awaiting QC'], ['accepted', 'Accepted'], ['reprocess', 'To reprocess'], ['rejected', 'Rejected']],
    filters: ['q', 'date', 'returnStatus'],
    columns: (withCost) => [
      { key: 'returnNumber', label: 'Return', render: (r) => <Link to="/sales/returns" className="font-mono font-bold text-blue-700 hover:underline">{r.returnNumber}</Link>, sub: (r) => r.date },
      { key: 'customer', label: 'Customer', render: (r) => strong(r.customer) },
      { key: 'invoiceNumber', label: 'Original sale' },
      { key: 'batchCode', label: 'Original batch', render: batchCell, sub: (r) => r.takaId },
      { key: 'fabric', label: 'Fabric', render: (r) => strong(r.fabric) },
      { key: 'quantity', label: 'Qty', align: 'right', render: (r) => qty(r.quantity) },
      { key: 'reason', label: 'Reason' },
      { key: 'qcStatus', label: 'QC status', render: (r) => pill(r.qcStatus) },
      { key: 'disposition', label: 'Disposition' },
      { key: 'creditNote', label: 'Credit note' },
      ...(withCost ? [{ key: 'creditValue', label: 'Credit value', align: 'right', render: (r) => money(r.creditValue) }] : []),
    ],
  },
  samples: {
    icon: Scissors,
    title: 'Sample Fabric Stock',
    subtitle: 'Samples cut from batches: issued, returned, consumed and outstanding. Returns are routed by condition; damaged samples go to Reject.',
    kpis: [['total', 'Samples', 'count'], ['outstanding', 'Outstanding', 'count'], ['issuedQty', 'Issued qty'], ['returnedQty', 'Returned qty'], ['consumedQty', 'Consumed qty'], ['returnedUnderQcQty', 'Under QC']],
    filters: ['q', 'date', 'sampleStatus'],
    headerAction: { to: '/inventory/samples', label: 'Issue sample' },
    columns: (withCost) => [
      { key: 'sampleNumber', label: 'Sample', render: (r) => <span className="font-mono font-bold">{r.sampleNumber}</span>, sub: (r) => r.date },
      { key: 'batchCode', label: 'Batch', render: batchCell, sub: (r) => r.takaId },
      { key: 'fabricQuality', label: 'Fabric', render: (r) => strong(r.fabricQuality), sub: (r) => [r.design, r.shade].filter(Boolean).join(' · ') },
      { key: 'party', label: 'Given to' },
      { key: 'quantity', label: 'Qty', align: 'right', render: (r) => qty(r.quantity, r.uom) },
      { key: 'returned', label: 'Returned', align: 'right', render: (r) => qty(r.returned) },
      { key: 'consumed', label: 'Consumed', align: 'right', render: (r) => qty(r.consumed) },
      { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => qty(r.outstanding) },
      { key: 'dueDate', label: 'Due' },
      { key: 'status', label: 'Status', render: (r) => pill(r.status) },
      ...(withCost ? [{ key: 'estimatedCost', label: 'Cost', align: 'right', render: (r) => money(r.estimatedCost) }] : []),
    ],
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

const inputCls = 'h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const selectCls = `${inputCls} w-full sm:w-40`;
const BLANK = { q: '', from: '', to: '', itemId: '', designId: '', shadeId: '', locationId: '', ownership: '', status: '', kind: '' };

function StockTable({ columns, rows, rowKey, loading, emptyTitle, emptyText, onOpen, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-[13px] text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((c) => <th key={c.key} className={`px-3 py-3 first:pl-4 last:pr-4 font-bold whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 6 }, (_, i) => (
              <tr key={i}>{columns.map((c) => <td key={c.key} className="px-3 py-3.5 first:pl-4 last:pr-4"><Skeleton height={12} /></td>)}</tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={columns.length}><EmptyState title={emptyTitle} description={emptyText} /></td></tr>}
            {!loading && rows.map((r, i) => (
              <tr key={rowKey(r, i)} className="hover:bg-blue-50/40 transition-colors">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-3 first:pl-4 last:pr-4 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                    {c.render ? c.render(r, onOpen) : (r[c.key] ?? '—')}
                    {c.sub && c.sub(r) && <div className="mt-0.5 text-[11px] text-slate-400">{c.sub(r)}</div>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {children}
    </div>
  );
}

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
  const [storePage, setStorePage] = useState(1);
  const [storePageSize, setStorePageSize] = useState(25);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [reprocessView, setReprocessView] = useState('store');

  useEffect(() => {
    // Screen change: start from clean filters.
    setFilters(BLANK);
    setApplied(BLANK);
    setPage(1);
    setStorePage(1);
    setReprocessView('store');
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
  const inStoreLots = data?.inStoreLots || [];
  const kpis = data?.kpis || {};
  const shownKpis = config.kpis.filter(([, , kind]) => kind !== 'money' || withCost);

  const filteredInStoreLots = useMemo(() => {
    let lots = inStoreLots;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      lots = lots.filter((l) =>
        (l.batchCode || '').toLowerCase().includes(q) ||
        (l.lotNumber || '').toLowerCase().includes(q) ||
        (l.takaNumber || '').toLowerCase().includes(q) ||
        (l.fabric || '').toLowerCase().includes(q)
      );
    }
    return lots;
  }, [inStoreLots, filters.q]);

  const paginatedInStoreLots = useMemo(() => {
    const start = (storePage - 1) * storePageSize;
    return filteredInStoreLots.slice(start, start + storePageSize);
  }, [filteredInStoreLots, storePage, storePageSize]);
  const has = (f) => config.filters.includes(f);
  const statusKey = config.filters.find((f) => STATUS_FILTERS[f]);
  const apply = (e) => { e?.preventDefault(); setPage(1); setStorePage(1); setApplied(filters); };
  const reset = () => { setFilters(BLANK); setApplied(BLANK); setPage(1); setStorePage(1); };
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

      <nav aria-label="Stock position screens" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200">
        {Object.entries(SCREENS).sort(([a], [b]) => Object.keys(SCREEN_TO_TYPE).indexOf(a) - Object.keys(SCREEN_TO_TYPE).indexOf(b)).map(([key, s]) => (
          <button key={key} type="button" onClick={() => navigate(SCREEN_TO_TYPE[key] ? `/inventory/stock-position?type=${SCREEN_TO_TYPE[key]}` : '/inventory/stock-position')}
            aria-current={key === screen ? 'page' : undefined}
            className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${key === screen ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
            <s.icon size={14} /> {s.title}
          </button>
        ))}
      </nav>

      <section className={`grid grid-cols-2 lg:grid-cols-3 ${KPI_COLUMNS[shownKpis.length] || ''} gap-3`}>
        {shownKpis.map(([key, label, kind]) => {
          const isStoreKpi = key === 'awaitingReprocessInStore';
          const isReprocessScreen = screen === 'reprocessing';
          const isActiveKpi = isReprocessScreen && ((isStoreKpi && reprocessView === 'store') || (!isStoreKpi && reprocessView === 'vendors'));
          const [icon, tone] = KPI_LOOK[key];
          const text = kind === 'money' ? `₹${formatNumberIN(Math.round(kpis[key] ?? 0))}` : kind === 'count' ? (kpis[key] ?? 0) : formatNumberIN(kpis[key] ?? 0);
          return (
            <KpiCard
              key={key}
              label={label}
              icon={icon}
              tone={tone}
              value={loading ? '…' : <span title={kind === 'money' ? formatINR(kpis[key] ?? 0) : undefined} className={kind === 'money' ? 'text-xl' : ''}>{text}</span>}
              onClick={isReprocessScreen ? () => setReprocessView(isStoreKpi ? 'store' : 'vendors') : undefined}
              className={isActiveKpi ? 'border-blue-500! ring-2 ring-blue-100' : ''}
            />
          );
        })}
      </section>

      {screen === 'usable' && (data?.lowStock || []).length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-px shrink-0 text-amber-600" />
          <div>
            <span className="font-semibold">Low stock:</span>{' '}
            {data.lowStock.map((l) => `${l.fabric} (${formatNumberIN(l.available)} / reorder ${formatNumberIN(l.reorderLevel)})`).join(' · ')}
          </div>
        </div>
      )}

      <form onSubmit={apply} className="bg-white border border-slate-200 rounded-xl shadow-xs p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search batch, taka, lot, fabric, order, customer…" className={`${inputCls} w-full pl-8`} aria-label="Search" />
        </div>
        {has('date') && (
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={`${inputCls} flex-1 sm:flex-none sm:w-34 min-w-0`} aria-label="From date" />
            <span className="text-[11px] text-slate-400">to</span>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={`${inputCls} flex-1 sm:flex-none sm:w-34 min-w-0`} aria-label="To date" />
          </div>
        )}
        {has('item') && (
          <select value={filters.itemId} onChange={(e) => setFilters({ ...filters, itemId: e.target.value })} className={selectCls} aria-label="Fabric">
            <option value="">All fabrics</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )}
        {has('design') && (
          <select value={filters.designId} onChange={(e) => setFilters({ ...filters, designId: e.target.value })} className={selectCls} aria-label="Design">
            <option value="">All designs</option>
            {masters.designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {has('shade') && (
          <select value={filters.shadeId} onChange={(e) => setFilters({ ...filters, shadeId: e.target.value })} className={selectCls} aria-label="Colour">
            <option value="">All colours</option>
            {masters.shades.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {has('location') && (
          <select value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })} className={selectCls} aria-label="Godown">
            <option value="">All godowns</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {statusKey && (
          <select value={statusKey === 'scrapKind' ? filters.kind : filters.status}
            onChange={(e) => setFilters(statusKey === 'scrapKind' ? { ...filters, kind: e.target.value } : { ...filters, status: e.target.value })}
            className={selectCls} aria-label="Status">
            {STATUS_FILTERS[statusKey].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={reset} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"><RotateCcw size={13} /> Reset</button>
          <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer">Apply</button>
        </div>
      </form>

      {error && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex justify-between gap-2">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button></div>}

      {screen === 'reprocessing' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-100 rounded-xl">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setReprocessView('store')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                reprocessView === 'store'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Reprocess Store ({formatNumberIN(kpis.awaitingReprocessInStore ?? 0)} m · {inStoreLots.length} rolls)
            </button>
            <button
              type="button"
              onClick={() => setReprocessView('vendors')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                reprocessView === 'vendors'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              With Processing Vendors ({rows.length} orders)
            </button>
          </div>
        </div>
      )}

      {screen === 'reprocessing' && reprocessView === 'store' ? (
        <StockTable
          columns={STORE_COLUMNS}
          rows={paginatedInStoreLots}
          rowKey={(lot) => lot.id}
          loading={loading}
          emptyTitle="Reprocess store is empty"
          emptyText="No fabric rolls currently waiting in the in-house reprocess store."
          onOpen={setDrawer}
        >
          <AppPagination
            total={filteredInStoreLots.length}
            page={storePage}
            pageSize={storePageSize}
            onPageChange={setStorePage}
            onPageSizeChange={setStorePageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            loading={loading}
          />
        </StockTable>
      ) : (
        <StockTable
          columns={columns}
          rows={rows}
          rowKey={(r, i) => r.lotTakaId || r.jobWorkOrderId || r.sampleId || `${r.returnId}-${i}`}
          loading={loading}
          emptyTitle="No stock found"
          emptyText="Nothing matches these filters."
          onOpen={setDrawer}
        >
          <AppPagination total={data?.count || 0} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[10, 25, 50, 100]} loading={loading} />
        </StockTable>
      )}

      {drawer && <BatchDrawer code={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}
