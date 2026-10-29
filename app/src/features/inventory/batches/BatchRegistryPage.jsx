import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Printer, ScanLine, IndianRupee, Eye, SlidersHorizontal, X, Plus, Users, Layers, PackageOpen,
  Boxes, CheckCircle2, Bookmark, ClipboardCheck, RefreshCcw, XCircle, Truck, UserRound, ShoppingCart,
  Factory, GitMerge, PenLine,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import AppPagination from '../../../components/ui/AppPagination';
import { inventoryService } from '../../../services/domainServices';
import { formatINR, formatNumberIN, describeApiError } from '../../accounts/accountingShared';
import { printBatchTags } from './printBatchTag';
import BatchChargeModal from './BatchChargeModal';
import { CustomerReceiptModal, PhysicalStockSummary } from './CustomerMaterialPanels';
import AddBatchModal, { useTextileMasters } from './AddBatchModal';
import { useERP } from '../../../context/ERPContext';

const ORIGINS = [
  ['', 'All origins'],
  ['PURCHASE', 'Purchase'],
  ['PRODUCTION', 'Production'],
  ['JOB_WORK', 'Job work'],
  ['MERGE', 'Merge'],
  ['MANUAL', 'Manual'],
];
const ORIGIN_LABEL = Object.fromEntries(ORIGINS.filter(([v]) => v));
const FABRIC_TYPES = [
  ['', 'All'],
  ['GREY', 'Grey'],
  ['DYED', 'Dyed'],
];
/** Stock tiles: [summary key, label, holding filter it opens, figure colour, icon, icon tint]. */
const STOCK_TILES = [
  ['totalPhysical', 'Total physical', '', 'text-slate-900', Boxes, 'bg-slate-100 text-slate-600'],
  ['available', 'Available', 'available', 'text-emerald-700', CheckCircle2, 'bg-emerald-50 text-emerald-600'],
  ['reserved', 'Reserved', 'reserved', 'text-blue-700', Bookmark, 'bg-blue-50 text-blue-600'],
  ['qcHold', 'QC hold', 'qcHold', 'text-amber-700', ClipboardCheck, 'bg-amber-50 text-amber-600'],
  ['rework', 'Rework', 'rework', 'text-violet-700', RefreshCcw, 'bg-violet-50 text-violet-600'],
  ['rejected', 'Rejected', 'rejected', 'text-rose-700', XCircle, 'bg-rose-50 text-rose-600'],
  ['withJobWorker', 'At job worker', 'withJobWorker', 'text-indigo-700', Truck, 'bg-indigo-50 text-indigo-600'],
  ['customerMaterial', 'Customer material', '', 'text-slate-700', UserRound, 'bg-slate-100 text-slate-600'],
];
/** Where a batch came from, with its icon. */
const ORIGIN_ICON = { PURCHASE: ShoppingCart, PRODUCTION: Factory, JOB_WORK: Truck, MERGE: GitMerge, MANUAL: PenLine };
/** Status tabs above the table ('' = all). */
const STATUS_TABS = ['', 'In Stock', 'QC Hold', 'At Job Worker', 'Blocked', 'Sold Out'];
const STATUS_DOT = {
  'In Stock': 'bg-emerald-500', 'QC Hold': 'bg-amber-500', 'At Job Worker': 'bg-violet-500',
  Blocked: 'bg-rose-500', 'Sold Out': 'bg-slate-400', Closed: 'bg-slate-300',
};
const HOLDING_LABEL = Object.fromEntries(STOCK_TILES.filter(([, , h]) => h).map(([, label, h]) => [h, label]));
/** The stock bar of a row: [quantity key, label, bar colour]. */
const STOCK_PARTS = [
  ['available', 'Available', 'bg-emerald-500'],
  ['reserved', 'Reserved', 'bg-blue-500'],
  ['qcHold', 'QC hold', 'bg-amber-400'],
  ['rework', 'Rework', 'bg-violet-500'],
  ['secondQuality', '2nd quality', 'bg-sky-400'],
  ['rejected', 'Rejected', 'bg-rose-500'],
  ['withJobWorker', 'At job worker', 'bg-indigo-500'],
  ['sold', 'Sold', 'bg-slate-300'],
];
const STATUS_STYLE = {
  'In Stock': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'QC Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  'At Job Worker': 'bg-violet-50 text-violet-700 border-violet-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
  'Sold Out': 'bg-slate-100 text-slate-600 border-slate-200',
  Closed: 'bg-slate-100 text-slate-500 border-slate-200',
};
const BLANK = { q: '', origin: '', fabricType: '', status: '', from: '', to: '', itemId: '', designId: '', shadeId: '', locationId: '', holding: '' };
const inputCls = 'h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500';
const ghostBtn = 'h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer';

/** One bar per row: where the batch's metres are now, plus what was sold. */
function StockBar({ q }) {
  const parts = STOCK_PARTS.map(([key, label, colour]) => [key, label, colour, Number(q[key] || 0)]).filter(([, , , v]) => v > 0);
  const total = parts.reduce((s, [, , , v]) => s + v, 0);
  const uom = q.uom || 'm';
  if (!total) return <span className="text-slate-400">No stock</span>;
  return (
    <div className="min-w-44">
      <div className="flex items-baseline justify-between gap-2">
        <span className="tabular-nums"><span className="text-sm font-bold text-emerald-700">{formatNumberIN(q.available)}</span> <span className="text-[10px] text-slate-400">{uom} available</span></span>
        <span className="text-[10px] text-slate-400 tabular-nums">{Number(q.received) > 0 ? `${Math.round((Number(q.available || 0) / Number(q.received)) * 100)}% of ${formatNumberIN(q.received)}` : ''}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden flex" aria-hidden="true">
        {parts.map(([key, , colour, v]) => <span key={key} className={colour} style={{ width: `${(v / total) * 100}%` }} />)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-slate-500">
        {parts.filter(([key]) => key !== 'available').map(([key, label, colour, v]) => (
          <span key={key} className="inline-flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${colour}`} />{label} {formatNumberIN(v)}</span>
        ))}
      </div>
    </div>
  );
}

/** Batch Registry: every permanent batch ID with its live quantities. */
export default function BatchRegistryPage() {
  const navigate = useNavigate();
  const { items = [], locations = [] } = useERP() || {};
  const { designs, shades } = useTextileMasters();
  const fabrics = items.filter((i) => ['LOT', 'TAKA'].includes(String(i.trackingType || '').toUpperCase()) || /fabric/i.test(i.itemKind || ''));
  const godowns = locations.filter((l) => !String(l.code || '').startsWith('SYS-'));
  const [filters, setFilters] = useState(BLANK);
  const [query, setQuery] = useState(BLANK);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ results: [], count: 0, canSeeCost: false });
  // Batch profitability report: cost / revenue / profit columns (ledger access only).
  const [withCost, setWithCost] = useState(false);
  // PO receipts still at QC Hold are kept out of the registry unless asked for.
  const [showAwaitingQc, setShowAwaitingQc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scan, setScan] = useState('');
  const [selected, setSelected] = useState({});
  const [chargeOpen, setChargeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [receiving, setReceiving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showPhysical, setShowPhysical] = useState(false);
  const selectedRows = Object.values(selected);
  const toggle = (b) => setSelected((prev) => {
    const next = { ...prev };
    if (next[b.batchCode]) delete next[b.batchCode]; else next[b.batchCode] = b;
    return next;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, page_size: pageSize, ...(withCost ? { withCost: 1 } : {}), ...(showAwaitingQc ? { awaitingQc: 'include' } : {}) };
      Object.entries(query).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await inventoryService.getBatches(params);
      setData({ results: res?.results || [], count: res?.count || 0, canSeeCost: Boolean(res?.canSeeCost), summary: res?.summary || null, awaitingQcCount: res?.awaitingQcCount || 0 });
    } catch (err) {
      setError(describeApiError(err) || 'Batches could not be loaded.');
      setData({ results: [], count: 0 });
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, withCost, showAwaitingQc]);
  useEffect(() => { load(); }, [load]);

  // Filters apply as they change; typing in search waits a moment.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(filters); setPage(1); }, filters.q !== query.q ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);
  const setF = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  // A barcode/QR scanner types the code and presses Enter; a scanned URL
  // carries the code as its last path segment.
  const openScanned = (e) => {
    e.preventDefault();
    const raw = scan.trim();
    if (!raw) return;
    const code = decodeURIComponent(raw.split('/').filter(Boolean).pop() || raw);
    setScan('');
    navigate(`/inventory/batches/${encodeURIComponent(code)}`);
  };
  const open = (code) => navigate(`/inventory/batches/${encodeURIComponent(code)}`);
  const printTag = async (row) => {
    try {
      await printBatchTags([row]);
    } catch (err) {
      setError(err.message);
    }
  };

  /** The filters in use, as removable chips. */
  const nameOf = (list, id) => list.find((x) => String(x.id) === String(id))?.name || '…';
  const chips = [
    filters.holding && ['holding', `Stock: ${HOLDING_LABEL[filters.holding]}`],
    filters.origin && ['origin', `Origin: ${ORIGIN_LABEL[filters.origin]}`],
    filters.itemId && ['itemId', `Fabric: ${nameOf(fabrics, filters.itemId)}`],
    filters.designId && ['designId', `Design: ${nameOf(designs, filters.designId)}`],
    filters.shadeId && ['shadeId', `Colour: ${nameOf(shades, filters.shadeId)}`],
    filters.locationId && ['locationId', `Godown: ${nameOf(godowns, filters.locationId)}`],
    filters.from && ['from', `From ${filters.from}`],
    filters.to && ['to', `To ${filters.to}`],
  ].filter(Boolean);
  const advancedCount = chips.filter(([k]) => k !== 'holding').length;
  const s = data.summary;
  const cols = withCost ? 13 : 8;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Batch Registry"
        subtitle="Every grey and dyed fabric batch — its ID, QR tag, where its metres are now and its status. Click a batch for its Batch 360° view."
        actions={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowPhysical((v) => !v)} className={ghostBtn} aria-pressed={showPhysical}>
              <Layers size={14} /> {showPhysical ? 'Hide own vs customer' : 'Own vs customer'}
            </button>
            <button type="button" onClick={() => setReceiving(true)} className={ghostBtn}>
              <Users size={14} /> Customer material
            </button>
            <button type="button" onClick={() => setAdding(true)} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
              <Plus size={14} /> Create Batch
            </button>
          </div>
        )}
      />
      {showPhysical && <PhysicalStockSummary />}
      {adding && (
        <AddBatchModal
          onClose={() => setAdding(false)}
          onCustomerMaterial={() => { setAdding(false); setReceiving(true); }}
          onDone={(batch, tab) => {
            setAdding(false);
            navigate(`/inventory/batches/${encodeURIComponent(batch.batchCode)}${tab && tab !== 'overview' ? `?tab=${tab}` : ''}`);
          }}
        />
      )}
      {receiving && (
        <CustomerReceiptModal
          onClose={() => setReceiving(false)}
          onDone={(batch) => {
            setReceiving(false);
            open(batch.batchCode);
          }}
        />
      )}

      {/* Stock of all the batches shown: one strip, each figure filters the list. */}
      {s && (
        <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3" aria-label="Stock of the batches shown">
          {STOCK_TILES.map(([key, label, holding, tone, Icon, tint]) => {
            const value = Number(s[key] || 0);
            const active = holding && filters.holding === holding;
            return (
              <button
                key={key}
                type="button"
                disabled={!holding}
                onClick={() => setF('holding', active ? '' : holding)}
                title={holding ? (active ? 'Show all batches' : `Only batches with ${label.toLowerCase()} stock`) : undefined}
                className={`group text-left rounded-xl border bg-white px-3.5 py-3 transition-all ${active ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'} ${holding ? 'hover:border-blue-300 hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`grid place-items-center w-7 h-7 rounded-lg ${value || !holding ? tint : 'bg-slate-50 text-slate-300'}`}><Icon size={15} /></span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 leading-tight">{label}</span>
                </div>
                <div className={`mt-2 text-xl font-bold tabular-nums ${value ? tone : 'text-slate-300'}`}>{formatNumberIN(value)}</div>
                {key === 'totalPhysical' && <div className="text-[10px] text-slate-400">{data.count} batch{data.count === 1 ? '' : 'es'} · metres</div>}
              </button>
            );
          })}
        </section>
      )}

      {/* Toolbar: scan, search, grey / dyed, more filters. */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="flex flex-col lg:flex-row gap-2">
          <form onSubmit={openScanned} className="relative lg:w-80">
            <ScanLine size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-600" />
            <input
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="Scan tag or type batch / taka ID, Enter"
              aria-label="Scan or enter batch or taka ID"
              className={`${inputCls} w-full pl-8 font-mono`}
              autoComplete="off"
            />
          </form>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.q}
              onChange={(e) => setF('q', e.target.value)}
              placeholder="Search batch, lot, taka, fabric, supplier, GRN…"
              aria-label="Search batches"
              className={`${inputCls} w-full pl-8`}
            />
          </div>
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 self-start" role="radiogroup" aria-label="Fabric type">
            {FABRIC_TYPES.map(([v, l]) => (
              <button key={v || 'all'} type="button" role="radio" aria-checked={filters.fabricType === v} onClick={() => setF('fabricType', v)}
                className={`h-8 px-4 rounded-md text-xs font-semibold cursor-pointer ${filters.fabricType === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className={`${ghostBtn} self-start ${showFilters || advancedCount ? 'border-blue-300 text-blue-700' : ''}`}>
            <SlidersHorizontal size={14} /> Filters{advancedCount ? ` (${advancedCount})` : ''}
          </button>
          {data.canSeeCost && (
            <label className={`${ghostBtn} self-start ${withCost ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : ''}`}>
              <input type="checkbox" className="sr-only" checked={withCost} onChange={(e) => { setWithCost(e.target.checked); setPage(1); }} />
              <IndianRupee size={14} /> {withCost ? 'Hide' : 'Show'} cost &amp; profit
            </label>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-3 border-t border-slate-100">
            <select value={filters.itemId} onChange={(e) => setF('itemId', e.target.value)} className={inputCls} aria-label="Fabric">
              <option value="">All fabrics</option>
              {fabrics.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <select value={filters.designId} onChange={(e) => setF('designId', e.target.value)} className={inputCls} aria-label="Design">
              <option value="">All designs</option>
              {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filters.shadeId} onChange={(e) => setF('shadeId', e.target.value)} className={inputCls} aria-label="Colour / shade">
              <option value="">All colours</option>
              {shades.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filters.locationId} onChange={(e) => setF('locationId', e.target.value)} className={inputCls} aria-label="Godown">
              <option value="">All godowns</option>
              {godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={filters.origin} onChange={(e) => setF('origin', e.target.value)} className={inputCls} aria-label="Origin">
              {ORIGINS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-500">From
              <input type="date" value={filters.from} onChange={(e) => setF('from', e.target.value)} className={`${inputCls} flex-1 min-w-0`} aria-label="Created from" /></label>
            <label className="flex items-center gap-2 text-xs text-slate-500">To
              <input type="date" value={filters.to} onChange={(e) => setF('to', e.target.value)} className={`${inputCls} flex-1 min-w-0`} aria-label="Created to" /></label>
          </div>
        )}

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map(([key, label]) => (
              <span key={key} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-800">
                {label}
                <button type="button" onClick={() => setF(key, '')} aria-label={`Remove ${label}`} className="p-0.5 rounded-full hover:bg-blue-100 cursor-pointer"><X size={11} /></button>
              </span>
            ))}
            {chips.length > 0 && (
              <button type="button" onClick={() => setFilters({ ...BLANK, q: filters.q, fabricType: filters.fabricType })} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">Clear all</button>
            )}
          </div>
        )}
      </div>

      {(data.awaitingQcCount > 0 || showAwaitingQc) && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <span>
            <strong>{data.awaitingQcCount}</strong> PO receipt batch{data.awaitingQcCount === 1 ? '' : 'es'} waiting for QC.
            {' '}They join the registry, stock and godown only after QC — <Link to="/inventory/qc/entry" className="font-semibold underline">open QC Entry</Link>.
          </span>
          <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={showAwaitingQc} onChange={(e) => { setShowAwaitingQc(e.target.checked); setPage(1); }} />
            Show batches waiting for QC
          </label>
        </div>
      )}

      {error && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}
      {notice && <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">{notice}</div>}

      {selectedRows.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-900 text-white text-xs shadow-lg">
          <span className="font-semibold px-1">{selectedRows.length} selected</span>
          <button type="button" onClick={() => setChargeOpen(true)} className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 font-semibold inline-flex items-center gap-1 cursor-pointer"><IndianRupee size={13} /> Add charge (freight etc.)</button>
          <button type="button" onClick={() => printBatchTags(selectedRows).catch((err) => setError(err.message))} className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 font-semibold inline-flex items-center gap-1 cursor-pointer"><Printer size={13} /> Print tags</button>
          <button type="button" onClick={() => setSelected({})} className="ml-auto h-8 px-3 rounded-lg font-semibold text-white/80 hover:text-white cursor-pointer">Clear</button>
        </div>
      )}
      {chargeOpen && (
        <BatchChargeModal
          batches={selectedRows}
          onClose={() => setChargeOpen(false)}
          onDone={(rows) => {
            setChargeOpen(false);
            setSelected({});
            setNotice(`Charge posted: ${rows.map((r) => `${r.batchCode} ₹${r.amount}`).join(', ')}.`);
            load();
          }}
        />
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-1 px-3 border-b border-slate-200 overflow-x-auto" role="tablist" aria-label="Batch status">
          {STATUS_TABS.map((st) => {
            const isActive = filters.status === st;
            return (
              <button key={st || 'all'} type="button" role="tab" aria-selected={isActive} onClick={() => setF('status', st)}
                className={`inline-flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {st && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[st]}`} />}
                {st || 'All batches'}
                {isActive && !loading && <span className="px-1.5 rounded-full bg-blue-100 text-blue-700 text-[10px]">{data.count}</span>}
              </button>
            );
          })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all batches on this page"
                    checked={data.results.length > 0 && data.results.every((b) => selected[b.batchCode])}
                    onChange={(e) => setSelected((prev) => {
                      const next = { ...prev };
                      data.results.forEach((b) => { if (e.target.checked) next[b.batchCode] = b; else delete next[b.batchCode]; });
                      return next;
                    })}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-3 py-3 text-left">Batch</th>
                <th className="px-3 py-3 text-left">Fabric</th>
                <th className="px-3 py-3 text-left">Source</th>
                <th className="px-3 py-3 text-left w-[300px]">Stock now</th>
                {withCost && (
                  <>
                    <th className="px-3 py-3 text-right">Total cost</th>
                    <th className="px-3 py-3 text-right">Cost / m</th>
                    <th className="px-3 py-3 text-right">Revenue</th>
                    <th className="px-3 py-3 text-right">Profit</th>
                    <th className="px-3 py-3 text-right">Stock value</th>
                  </>
                )}
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={`sk-${i}`}><td colSpan={cols} className="px-3 py-4"><div className="h-8 rounded-lg bg-slate-100 animate-pulse" /></td></tr>
              ))}
              {!loading && data.results.length === 0 && (
                <tr>
                  <td colSpan={cols} className="px-3 py-14 text-center">
                    <PackageOpen size={30} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">{chips.length || filters.q || filters.fabricType ? 'No batches match these filters' : 'No batches yet'}</p>
                    <p className="text-xs text-slate-500">{chips.length || filters.q || filters.fabricType ? 'Clear a filter to see more.' : 'Batches are created from goods receipts, production and job work — or by hand.'}</p>
                    {!(chips.length || filters.q || filters.fabricType) && (
                      <button type="button" onClick={() => setAdding(true)} className="mt-3 h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"><Plus size={14} /> Create Batch</button>
                    )}
                  </td>
                </tr>
              )}
              {!loading && data.results.map((b) => {
                const q = b.quantities || {};
                const isSelected = Boolean(selected[b.batchCode]);
                return (
                  <tr
                    key={b.id}
                    onClick={() => open(b.batchCode)}
                    className={`group cursor-pointer align-top transition-colors ${isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'}`}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggle(b)} aria-label={`Select ${b.batchCode}`} className="cursor-pointer" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-blue-700">{b.batchCode}</span>
                        <span className={`px-1.5 py-px rounded border text-[10px] font-semibold ${b.fabricType === 'DYED' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>{b.fabricType === 'DYED' ? 'Dyed' : 'Grey'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{b.createdOn} · {b.takaCount} taka{b.processed && b.fabricType !== 'DYED' ? ' · has dyed rolls' : ''}</div>
                    </td>
                    <td className="px-3 py-3 max-w-60">
                      <div className="font-semibold text-slate-800 truncate">{b.item || '—'}</div>
                      <div className="text-[10px] text-slate-500 truncate">{[b.fabricQuality, b.design, b.shade].filter(Boolean).join(' · ') || ' '}</div>
                      {!b.hsnCode && <div className="text-[10px] font-semibold text-amber-700">HSN missing in item master</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        {(() => { const OriginIcon = ORIGIN_ICON[b.origin] || PenLine; return <span className="grid place-items-center w-6 h-6 rounded-md bg-slate-100 text-slate-500"><OriginIcon size={13} /></span>; })()}
                        <span>{ORIGIN_LABEL[b.origin] || b.origin}{b.sourceDocumentNumber && b.sourceDocumentNumber !== b.batchCode ? <span className="text-slate-400 font-mono text-[10.5px]"> · {b.sourceDocumentNumber}</span> : ''}</span>
                      </div>
                      <div className="pl-7 text-[10px] text-slate-500 truncate max-w-56">
                        {b.ownership === 'OSCAR' ? (b.supplierName || '') : <span className="font-semibold text-amber-700">{b.ownerPartyName || b.ownership}'s material</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3"><StockBar q={q} /></td>
                    {withCost && (
                      <>
                        <td className="px-3 py-3 text-right tabular-nums">{formatINR(b.costing?.totalCost)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatINR(b.costing?.costPerUnit)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatINR(b.costing?.revenue)}</td>
                        <td className={`px-3 py-3 text-right tabular-nums font-semibold ${Number(b.costing?.realizedProfit) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatINR(b.costing?.realizedProfit)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatINR(b.costing?.unsoldInventoryValue)}</td>
                      </>
                    )}
                    <td className="px-3 py-3">
                      {b.awaitingQc
                        ? <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200">Waiting for QC</span>
                        : <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLE[b.status] || STATUS_STYLE.Closed}`}><span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[b.status] || STATUS_DOT.Closed}`} />{b.status}</span>}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap space-x-1 opacity-60 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => open(b.batchCode)} title="Open Batch 360°" aria-label={`Open ${b.batchCode}`} className="p-1.5 rounded-md border border-slate-200 text-blue-700 hover:bg-blue-50 cursor-pointer">
                        <Eye size={13} />
                      </button>
                      <button type="button" onClick={() => printTag(b)} title="Print batch QR tag" aria-label={`Print tag for ${b.batchCode}`} className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer">
                        <Printer size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AppPagination
          total={data.count}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          loading={loading}
        />
      </div>
    </div>
  );
}
