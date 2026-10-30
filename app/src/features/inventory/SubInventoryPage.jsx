import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Printer,
  RotateCcw,
  ScanLine,
  IndianRupee,
  Eye,
  Plus,
  Package,
  Layers,
  Palette,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Factory,
  ArrowRight,
  Filter,
  Warehouse,
  FileText,
  Boxes,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AppPagination from '../../components/ui/AppPagination';
import { inventoryService } from '../../services/domainServices';
import { formatINR, formatNumberIN, describeApiError } from '../accounts/accountingShared';
import { printBatchTags } from './batches/printBatchTag';
import BatchChargeModal from './batches/BatchChargeModal';
import { PhysicalStockSummary } from './batches/CustomerMaterialPanels';
import AddBatchModal from './batches/AddBatchModal';

const ORIGINS = [
  ['', 'All origins'],
  ['PURCHASE', 'Purchase'],
  ['PRODUCTION', 'Production'],
  ['JOB_WORK', 'Job work'],
  ['MERGE', 'Merge'],
  ['MANUAL', 'Manual'],
];

const STATUSES = ['', 'In Stock', 'QC Hold', 'At Job Worker', 'Blocked', 'Sold Out', 'Closed'];

const STATUS_STYLE = {
  'In Stock': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'QC Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  'At Job Worker': 'bg-violet-50 text-violet-700 border-violet-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
  'Sold Out': 'bg-slate-100 text-slate-600 border-slate-200',
  Closed: 'bg-slate-100 text-slate-500 border-slate-200',
};

const inputCls =
  'h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500';

export default function SubInventoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine active sub-inventory: 'GREY' or 'DYED'
  const isDyeingRoute =
    location.pathname.includes('/inventory/dyeing') ||
    searchParams.get('type') === 'dyeing' ||
    searchParams.get('type') === 'dyed' ||
    searchParams.get('sub') === 'dyeing';

  const activeSub = isDyeingRoute ? 'DYED' : 'GREY';

  // Filters state
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    origin: searchParams.get('origin') || '',
    status: searchParams.get('status') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  });
  const [query, setQuery] = useState(filters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ results: [], count: 0, canSeeCost: false });
  const [withCost, setWithCost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scan, setScan] = useState('');
  const [selected, setSelected] = useState({});
  const [chargeOpen, setChargeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [showPhysical, setShowPhysical] = useState(false);

  // Tab counts
  const [counts, setCounts] = useState({ grey: 0, dyed: 0 });

  const selectedRows = Object.values(selected);
  const toggle = (b) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[b.batchCode]) delete next[b.batchCode];
      else next[b.batchCode] = b;
      return next;
    });

  // Switch Sub-Inventory Tab
  const handleTabChange = (type) => {
    setSelected({});
    setPage(1);
    if (type === 'DYED') {
      navigate('/inventory/dyeing');
    } else {
      navigate('/inventory/grey');
    }
  };

  // Fetch batches for active sub-inventory
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        page_size: pageSize,
        fabricType: activeSub,
        ...(withCost ? { withCost: 1 } : {}),
      };
      Object.entries(query).forEach(([k, v]) => {
        if (v) params[k] = v;
      });

      const res = await inventoryService.getBatches(params);
      const results = res?.results || [];
      setData({
        results,
        count: res?.count || results.length,
        canSeeCost: Boolean(res?.canSeeCost),
      });

      // Update current count
      if (activeSub === 'GREY') {
        setCounts((c) => ({ ...c, grey: res?.count || results.length }));
      } else {
        setCounts((c) => ({ ...c, dyed: res?.count || results.length }));
      }
    } catch (err) {
      setError(describeApiError(err) || 'Batches could not be loaded.');
      setData({ results: [], count: 0 });
    } finally {
      setLoading(false);
    }
  }, [activeSub, query, page, pageSize, withCost]);

  // Load counter for the other tab on mount/tab change
  useEffect(() => {
    let unmounted = false;
    const fetchOtherCount = async () => {
      try {
        const otherType = activeSub === 'GREY' ? 'DYED' : 'GREY';
        const res = await inventoryService.getBatches({ fabricType: otherType, page: 1, page_size: 1 });
        if (!unmounted && res) {
          if (otherType === 'GREY') {
            setCounts((c) => ({ ...c, grey: res.count || 0 }));
          } else {
            setCounts((c) => ({ ...c, dyed: res.count || 0 }));
          }
        }
      } catch {
        // silent counter fallback
      }
    };
    fetchOtherCount();
    return () => {
      unmounted = true;
    };
  }, [activeSub]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = (e) => {
    e?.preventDefault();
    setPage(1);
    setQuery(filters);
  };

  const resetFilters = () => {
    const blank = { q: '', origin: '', status: '', from: '', to: '' };
    setFilters(blank);
    setQuery(blank);
    setPage(1);
  };

  const openScanned = (e) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    navigate(`/inventory/batches/${encodeURIComponent(code)}`);
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const batches = data.results || [];
    let totalAvail = 0;
    let totalQcHold = 0;
    let totalAtWorker = 0;
    let totalSold = 0;
    let totalTakas = 0;

    batches.forEach((b) => {
      const q = b.quantities || {};
      totalAvail += Number(q.available || 0);
      totalQcHold += Number(q.qcHold || 0);
      totalAtWorker += Number(q.withJobWorker || 0);
      totalSold += Number(q.sold || 0);
      totalTakas += Number(b.takaCount || 0);
    });

    return {
      totalBatches: data.count,
      totalAvail,
      totalQcHold,
      totalAtWorker,
      totalSold,
      totalTakas,
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* ── Sub-Inventory Switcher & Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
              <span>Inventory</span>
              <span>/</span>
              <span className="text-slate-700 font-semibold">
                {activeSub === 'GREY' ? 'Grey Inventory' : 'Dyeing Inventory'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                {activeSub === 'GREY' ? (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center text-sm font-bold">
                      <Layers size={18} />
                    </div>
                    Grey Inventory
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold">
                      <Palette size={18} />
                    </div>
                    Dyeing Inventory
                  </>
                )}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  activeSub === 'GREY'
                    ? 'bg-stone-50 text-stone-700 border-stone-200'
                    : 'bg-sky-50 text-sky-700 border-sky-200'
                }`}
              >
                {activeSub === 'GREY' ? 'Grey Batches Only' : 'Dyeing Batches Only'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              {activeSub === 'GREY'
                ? 'Authoritative stock of raw un-dyed grey fabric batches. Track grey roll intake, godown lots, and issue to dyeing/processing.'
                : 'Finished and processed dyed fabric batches. Track color shades, dyeing house receipts, roll takas, and ready-to-sell stock.'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPhysical((v) => !v)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors"
            >
              {showPhysical ? 'Hide' : 'Physical Stock'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`h-9 px-3.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors ${
                activeSub === 'GREY' ? 'bg-stone-800 hover:bg-stone-900' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Plus size={15} />
              {activeSub === 'GREY' ? 'Add Grey Batch' : 'Add Dyeing Batch'}
            </button>
          </div>
        </div>

        {/* ── Sub-Inventory Navigation Pills ── */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('GREY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              activeSub === 'GREY'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <Layers size={14} className={activeSub === 'GREY' ? 'text-stone-300' : 'text-slate-400'} />
            <span>Grey Inventory</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                activeSub === 'GREY' ? 'bg-stone-700 text-stone-200' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {counts.grey}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('DYED')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              activeSub === 'DYED'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <Palette size={14} className={activeSub === 'DYED' ? 'text-sky-200' : 'text-slate-400'} />
            <span>Dyeing Inventory</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                activeSub === 'DYED' ? 'bg-sky-800 text-sky-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {counts.dyed}
            </span>
          </button>
        </div>
      </div>

      {/* Physical Stock Panel */}
      {showPhysical && <PhysicalStockSummary />}

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Total Batches */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                activeSub === 'GREY' ? 'bg-stone-100 text-stone-700' : 'bg-sky-100 text-sky-700'
              }`}
            >
              <Package size={16} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 leading-tight">
              {activeSub === 'GREY' ? 'Total Grey Batches' : 'Total Dyeing Batches'}
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-black text-slate-900 tracking-tight">{kpis.totalBatches}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {kpis.totalTakas} active {kpis.totalTakas === 1 ? 'taka' : 'takas'}
            </span>
          </div>
        </div>

        {/* Card 2: Available Stock */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 leading-tight">
              {activeSub === 'GREY' ? 'Available Grey Stock' : 'Available Dyed Stock'}
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-black text-emerald-700 tracking-tight">
              {formatNumberIN(kpis.totalAvail)} m
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {activeSub === 'GREY' ? 'Ready for processing / sale' : 'Ready for dispatch'}
            </span>
          </div>
        </div>

        {/* Card 3: QC Quarantine */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={16} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 leading-tight">In QC Quarantine</span>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-black text-amber-700 tracking-tight">
              {formatNumberIN(kpis.totalQcHold)} m
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Awaiting inspection clearance</span>
          </div>
        </div>

        {/* Card 4: External / Sold */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              {activeSub === 'GREY' ? <Factory size={16} /> : <Warehouse size={16} />}
            </div>
            <span className="text-[11px] font-semibold text-slate-500 leading-tight">
              {activeSub === 'GREY' ? 'At Job Worker / Dyeing' : 'Dispatched / Sold'}
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-black text-slate-800 tracking-tight">
              {formatNumberIN(activeSub === 'GREY' ? kpis.totalAtWorker : kpis.totalSold)} m
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {activeSub === 'GREY' ? 'External processing WIP' : 'Cumulative sales fulfillment'}
            </span>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Bar */}
      <form
        onSubmit={openScanned}
        className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-2 sm:items-center"
      >
        <label htmlFor="subinv-scan" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
          <ScanLine size={15} className="text-blue-600" /> Scan or enter batch ID
        </label>
        <input
          id="subinv-scan"
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          placeholder={activeSub === 'GREY' ? 'OSCAR-GRY-2026-0001' : 'OSCAR-DYD-2026-0001'}
          className={`${inputCls} flex-1 font-mono`}
          autoComplete="off"
        />
        <button
          type="submit"
          className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer shrink-0"
        >
          Open Batch 360°
        </button>
      </form>

      {/* Filter Row */}
      <form onSubmit={applyFilters} className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder={`Search ${activeSub === 'GREY' ? 'grey' : 'dyeing'} batch ID, fabric, lot #...`}
              className={`${inputCls} w-full pl-8`}
            />
          </div>

          {/* Origin */}
          <select
            value={filters.origin}
            onChange={(e) => setFilters({ ...filters, origin: e.target.value })}
            className={inputCls}
          >
            {ORIGINS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className={inputCls}
          >
            <option value="">All statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className={inputCls}
            title="Received on or after"
          />

          {/* Date to */}
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className={inputCls}
            title="Received on or before"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          {data.canSeeCost && (
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={withCost}
                onChange={(e) => setWithCost(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Show Cost & Profitability
            </label>
          )}
        </div>
      </form>

      {/* Notices & Errors */}
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
          {notice}
        </div>
      )}

      {/* Multi-batch selection action bar */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
          <span className="font-semibold text-blue-900">{selectedRows.length} selected</span>
          <button
            type="button"
            onClick={() => setChargeOpen(true)}
            className="h-8 px-3 rounded-lg bg-blue-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <IndianRupee size={13} /> Add charge
          </button>
          <button
            type="button"
            onClick={() => printBatchTags(selectedRows).catch((err) => setError(err.message))}
            className="h-8 px-3 rounded-lg border border-blue-300 bg-white font-semibold text-blue-700 inline-flex items-center gap-1 cursor-pointer"
          >
            <Printer size={13} /> Print tags
          </button>
          <button
            type="button"
            onClick={() => setSelected({})}
            className="h-8 px-3 rounded-lg text-blue-700 font-semibold cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Batches Ledger Table ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-xs">
            <thead className="bg-slate-50/80 text-[11px] uppercase text-slate-500 border-b border-slate-200/80 font-bold">
              <tr>
                <th className="px-3 py-2.5 w-8">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-2.5 text-left">Batch ID</th>
                <th className="px-3 py-2.5 text-left">Fabric Details</th>
                <th className="px-3 py-2.5 text-left">Sub-Inventory</th>
                <th className="px-3 py-2.5 text-left">Origin / Source</th>
                <th className="px-3 py-2.5 text-left">Supplier / Processor</th>
                <th className="px-3 py-2.5 text-right">Received (m)</th>
                <th className="px-3 py-2.5 text-right">Available (m)</th>
                <th className="px-3 py-2.5 text-right">QC Hold (m)</th>
                <th className="px-3 py-2.5 text-right">
                  {activeSub === 'GREY' ? 'At Job Worker (m)' : 'Sold (m)'}
                </th>
                {withCost && (
                  <>
                    <th className="px-3 py-2.5 text-right">Total Cost</th>
                    <th className="px-3 py-2.5 text-right">Cost/m</th>
                    <th className="px-3 py-2.5 text-right">Stock Value</th>
                  </>
                )}
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={withCost ? 16 : 13} className="px-3 py-10 text-center text-slate-400">
                    Loading {activeSub === 'GREY' ? 'grey' : 'dyeing'} inventory batches...
                  </td>
                </tr>
              )}
              {!loading && data.results.length === 0 && (
                <tr>
                  <td colSpan={withCost ? 16 : 13} className="px-3 py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">
                      No {activeSub === 'GREY' ? 'grey' : 'dyeing'} fabric batches found.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {activeSub === 'GREY'
                        ? 'Click "+ Add Grey Batch" or create a PO receipt to log incoming grey fabric batches.'
                        : 'Click "+ Add Dyeing Batch" or receive dyed fabric from external dyeing job workers.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      {activeSub === 'GREY' ? 'Add First Grey Batch' : 'Add First Dyeing Batch'}
                    </button>
                  </td>
                </tr>
              )}
              {!loading &&
                data.results.map((b) => {
                  const q = b.quantities || {};
                  return (
                    <tr key={b.id || b.batchCode} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[b.batchCode])}
                          onChange={() => toggle(b)}
                          aria-label={`Select ${b.batchCode}`}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/inventory/batches/${encodeURIComponent(b.batchCode)}`)}
                          className="font-mono font-bold text-blue-700 hover:underline cursor-pointer"
                        >
                          {b.batchCode}
                        </button>
                        <div className="text-[10px] text-slate-400">
                          {b.createdOn} • {b.takaCount || 0} takas
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-800">{b.item || 'Fabric'}</div>
                        <div className="text-[10px] text-slate-500">
                          {[b.fabricQuality, b.shade].filter(Boolean).join(' • ') || 'Standard'}
                        </div>
                        {b.shade && activeSub === 'DYED' && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-sky-50 border border-sky-100 text-[10px] font-medium text-sky-700 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                            {b.shade}
                          </div>
                        )}
                        <div
                          className={`text-[10px] font-mono ${
                            b.hsnCode ? 'text-slate-400' : 'text-amber-700 font-semibold'
                          }`}
                        >
                          {b.hsnCode ? `HSN ${b.hsnCode}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                            b.fabricType === 'DYED'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-stone-50 text-stone-700 border-stone-200'
                          }`}
                        >
                          {b.fabricType === 'DYED' ? 'Dyeing / Dyed' : 'Grey Fabric'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        <span className="font-medium text-slate-700">{b.origin || 'MANUAL'}</span>
                        <div className="text-[10px] text-slate-400">{b.sourceDocumentNumber || '-'}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {b.ownership === 'OSCAR'
                          ? b.supplierName || '-'
                          : `${b.ownerPartyName || b.ownership} (Customer)`}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {formatNumberIN(q.received)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700">
                        {formatNumberIN(q.available)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 font-medium">
                        {formatNumberIN(q.qcHold)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {activeSub === 'GREY' ? formatNumberIN(q.withJobWorker) : formatNumberIN(q.sold)}
                      </td>
                      {withCost && (
                        <>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(b.costing?.totalCost)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(b.costing?.costPerUnit)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {formatINR(b.costing?.unsoldInventoryValue)}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                            STATUS_STYLE[b.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {b.status || 'In Stock'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/inventory/batches/${encodeURIComponent(b.batchCode)}`)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                            title="Open Batch 360°"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => printBatchTags([b]).catch((err) => setError(err.message))}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                            title="Print Tags"
                          >
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Showing {data.results.length} of {data.count} {activeSub === 'GREY' ? 'grey' : 'dyeing'} batches
          </span>
          <AppPagination
            currentPage={page}
            totalItems={data.count}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(ps) => {
              setPageSize(ps);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Charge Modal */}
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

      {/* Add Batch Modal */}
      {adding && (
        <AddBatchModal
          defaultFabricType={activeSub}
          onClose={() => setAdding(false)}
          onDone={(batch, tab) => {
            setAdding(false);
            load();
            if (batch?.batchCode) {
              navigate(
                `/inventory/batches/${encodeURIComponent(batch.batchCode)}${
                  tab && tab !== 'overview' ? `?tab=${tab}` : ''
                }`
              );
            }
          }}
        />
      )}
    </div>
  );
}
