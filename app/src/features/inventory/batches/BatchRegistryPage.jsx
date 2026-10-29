import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Printer, RotateCcw, ScanLine, IndianRupee, Eye } from 'lucide-react';
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
const FABRIC_TYPES = [
  ['', 'Grey & dyed'],
  ['GREY', 'Grey fabric'],
  ['DYED', 'Dyed fabric'],
];
/** Where the rolls are now -- answers "how much is in QC / at the dyer / free to sell". */
const HOLDINGS = [
  ['', 'Any stock state'],
  ['available', 'Available to sell / use'],
  ['reserved', 'Reserved'],
  ['qcHold', 'In QC hold'],
  ['rework', 'In rework / reprocess'],
  ['secondQuality', 'Second quality'],
  ['rejected', 'Rejected'],
  ['withJobWorker', 'At job worker / dyer'],
];
/** Stock tiles: [summary key, label, holding filter it opens]. */
const STOCK_TILES = [
  ['totalPhysical', 'Total physical', ''],
  ['available', 'Available (OSCAR)', 'available'],
  ['reserved', 'Reserved', 'reserved'],
  ['qcHold', 'QC hold', 'qcHold'],
  ['rework', 'Rework', 'rework'],
  ['rejected', 'Rejected', 'rejected'],
  ['withJobWorker', 'At job worker', 'withJobWorker'],
  ['customerMaterial', 'Customer material', ''],
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
const inputCls = 'h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500';

/** Batch Registry: every permanent batch ID with its live quantities. */
export default function BatchRegistryPage() {
  const navigate = useNavigate();
  const { items = [], locations = [] } = useERP() || {};
  const { designs, shades } = useTextileMasters();
  const fabrics = items.filter((i) => ['LOT', 'TAKA'].includes(String(i.trackingType || '').toUpperCase()) || /fabric/i.test(i.itemKind || ''));
  const godowns = locations.filter((l) => !String(l.code || '').startsWith('SYS-'));
  const [filters, setFilters] = useState({ q: '', origin: '', fabricType: '', status: '', from: '', to: '', itemId: '', designId: '', shadeId: '', locationId: '', holding: '' });
  const [query, setQuery] = useState(filters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ results: [], count: 0, canSeeCost: false });
  // Batch profitability report: cost / revenue / profit columns (ledger access only).
  const [withCost, setWithCost] = useState(false);
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
      const params = { page, page_size: pageSize, ...(withCost ? { withCost: 1 } : {}) };
      Object.entries(query).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await inventoryService.getBatches(params);
      setData({ results: res?.results || [], count: res?.count || 0, canSeeCost: Boolean(res?.canSeeCost), summary: res?.summary || null });
    } catch (err) {
      setError(describeApiError(err) || 'Batches could not be loaded.');
      setData({ results: [], count: 0 });
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, withCost]);

  useEffect(() => { load(); }, [load]);

  const apply = (e) => {
    e?.preventDefault();
    setPage(1);
    setQuery(filters);
  };
  const reset = () => {
    const blank = { q: '', origin: '', fabricType: '', status: '', from: '', to: '', itemId: '', designId: '', shadeId: '', locationId: '', holding: '' };
    setFilters(blank);
    setQuery(blank);
    setPage(1);
  };
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
  const printTag = async (row) => {
    try {
      await printBatchTags([row]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Batch Registry"
        subtitle="Every grey and dyed fabric batch with its permanent ID, QR, live quantities and status. Scan a tag or open a batch for its Batch 360° view."
        actions={(
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowPhysical((v) => !v)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
              {showPhysical ? 'Hide' : 'Physical stock'} (own vs customer)
            </button>
            <button type="button" onClick={() => setReceiving(true)} className="h-9 px-3 rounded-lg border border-blue-200 bg-white text-blue-700 text-xs font-semibold hover:bg-blue-50 cursor-pointer">
              Receive customer material
            </button>
            <button type="button" onClick={() => setAdding(true)} className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
              + Create Batch
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
            navigate(`/inventory/batches/${encodeURIComponent(batch.batchCode)}`);
          }}
        />
      )}

      <form onSubmit={openScanned} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
        <label htmlFor="batch-scan" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
          <ScanLine size={15} className="text-blue-600" /> Scan or enter batch / taka ID
        </label>
        <input
          id="batch-scan"
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          placeholder="OSCAR-GRY-2026-0001"
          className={`${inputCls} flex-1 font-mono`}
          autoComplete="off"
        />
        <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer">Open</button>
      </form>

      {data.summary && (
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2" aria-label="Stock of the batches shown">
          {STOCK_TILES.map(([key, label, holding]) => {
            const active = holding && query.holding === holding;
            return (
              <button
                key={key}
                type="button"
                disabled={!holding}
                onClick={() => { const next = { ...filters, holding: active ? '' : holding }; setFilters(next); setQuery(next); setPage(1); }}
                title={holding ? (active ? 'Show all batches' : `Show batches with ${label.toLowerCase()} stock`) : undefined}
                className={`text-left bg-white border rounded-xl p-3 ${active ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'} ${holding ? 'hover:border-blue-300 cursor-pointer' : 'cursor-default'}`}
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
                <div className={`text-base font-bold tabular-nums ${key === 'available' ? 'text-emerald-700' : 'text-slate-900'}`}>{formatNumberIN(data.summary[key])}</div>
              </button>
            );
          })}
        </section>
      )}

      <form onSubmit={apply} className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <div className="relative lg:col-span-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Batch, lot, taka, fabric, supplier, GRN…"
            className={`${inputCls} w-full pl-8`}
          />
        </div>
        <select value={filters.origin} onChange={(e) => setFilters({ ...filters, origin: e.target.value })} className={inputCls} aria-label="Origin">
          {ORIGINS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.fabricType} onChange={(e) => setFilters({ ...filters, fabricType: e.target.value })} className={inputCls} aria-label="Fabric type">
          {FABRIC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.itemId} onChange={(e) => setFilters({ ...filters, itemId: e.target.value })} className={inputCls} aria-label="Fabric">
          <option value="">All fabrics</option>
          {fabrics.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select value={filters.designId} onChange={(e) => setFilters({ ...filters, designId: e.target.value })} className={inputCls} aria-label="Design">
          <option value="">All designs</option>
          {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filters.shadeId} onChange={(e) => setFilters({ ...filters, shadeId: e.target.value })} className={inputCls} aria-label="Colour / shade">
          <option value="">All colours</option>
          {shades.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })} className={inputCls} aria-label="Godown">
          <option value="">All godowns</option>
          {godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filters.holding} onChange={(e) => setFilters({ ...filters, holding: e.target.value })} className={inputCls} aria-label="Stock state">
          {HOLDINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={inputCls} aria-label="Status">
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <div className="flex gap-2 lg:col-span-2">
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={`${inputCls} flex-1 min-w-0`} aria-label="From date" />
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={`${inputCls} flex-1 min-w-0`} aria-label="To date" />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6 justify-end items-center">
          {data.canSeeCost && (
            <label className="mr-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={withCost} onChange={(e) => { setWithCost(e.target.checked); setPage(1); }} />
              Show cost &amp; profit (profitability report)
            </label>
          )}
          <button type="button" onClick={reset} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer">
            <RotateCcw size={13} /> Reset
          </button>
          <button type="submit" className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer">Apply</button>
        </div>
      </form>

      {error && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}
      {notice && <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">{notice}</div>}

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
          <span className="font-semibold text-blue-900">{selectedRows.length} selected</span>
          <button type="button" onClick={() => setChargeOpen(true)} className="h-8 px-3 rounded-lg bg-blue-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"><IndianRupee size={13} /> Add charge (freight etc.)</button>
          <button type="button" onClick={() => printBatchTags(selectedRows).catch((err) => setError(err.message))} className="h-8 px-3 rounded-lg border border-blue-300 bg-white font-semibold text-blue-700 inline-flex items-center gap-1 cursor-pointer"><Printer size={13} /> Print tags</button>
          <button type="button" onClick={() => setSelected({})} className="h-8 px-3 rounded-lg text-blue-700 font-semibold cursor-pointer">Clear</button>
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5 w-8"><span className="sr-only">Select</span></th>
                <th className="px-3 py-2.5 text-left">Batch ID</th>
                <th className="px-3 py-2.5 text-left">Fabric</th>
                <th className="px-3 py-2.5 text-left">Type</th>
                <th className="px-3 py-2.5 text-left">Origin / Source</th>
                <th className="px-3 py-2.5 text-left">Supplier / Owner</th>
                <th className="px-3 py-2.5 text-right">Received</th>
                <th className="px-3 py-2.5 text-right">Available</th>
                <th className="px-3 py-2.5 text-right">QC Hold</th>
                <th className="px-3 py-2.5 text-right">At Job Worker</th>
                <th className="px-3 py-2.5 text-right">Sold</th>
                {withCost && (
                  <>
                    <th className="px-3 py-2.5 text-right">Total cost</th>
                    <th className="px-3 py-2.5 text-right">Cost / m</th>
                    <th className="px-3 py-2.5 text-right">Revenue</th>
                    <th className="px-3 py-2.5 text-right">Profit</th>
                    <th className="px-3 py-2.5 text-right">Stock value</th>
                  </>
                )}
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={withCost ? 18 : 13} className="px-3 py-10 text-center text-slate-400">Loading batches…</td></tr>
              )}
              {!loading && data.results.length === 0 && (
                <tr><td colSpan={withCost ? 18 : 13} className="px-3 py-10 text-center text-slate-400">No batches match these filters.</td></tr>
              )}
              {!loading && data.results.map((b) => {
                const q = b.quantities || {};
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={Boolean(selected[b.batchCode])} onChange={() => toggle(b)} aria-label={`Select ${b.batchCode}`} className="cursor-pointer" />
                    </td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => navigate(`/inventory/batches/${encodeURIComponent(b.batchCode)}`)} className="font-mono font-bold text-blue-700 hover:underline cursor-pointer">
                        {b.batchCode}
                      </button>
                      <div className="text-[10px] text-slate-400">{b.createdOn} · {b.takaCount} taka</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-800">{b.item || '—'}</div>
                      <div className="text-[10px] text-slate-500">{[b.fabricQuality, b.shade].filter(Boolean).join(' · ')}</div>
                      <div className={`text-[10px] font-mono ${b.hsnCode ? 'text-slate-500' : 'text-amber-700 font-semibold'}`}>
                        {b.hsnCode ? `HSN ${b.hsnCode}` : 'HSN missing in item master'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${b.fabricType === 'DYED' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-stone-50 text-stone-700 border-stone-200'}`}>{b.fabricType === 'DYED' ? 'Dyed' : 'Grey'}</span>
                      {b.processed && b.fabricType !== 'DYED' && <div className="text-[10px] text-sky-700 mt-0.5">+ dyed rolls</div>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{b.origin}<div className="text-[10px] text-slate-400">{b.sourceDocumentNumber}</div></td>
                    <td className="px-3 py-2.5 text-slate-600">{b.ownership === 'OSCAR' ? (b.supplierName || '—') : `${b.ownerPartyName || b.ownership} (owned)`}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumberIN(q.received)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700">{formatNumberIN(q.available)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumberIN(q.qcHold)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumberIN(q.withJobWorker)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumberIN(q.sold)}</td>
                    {withCost && (
                      <>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(b.costing?.totalCost)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(b.costing?.costPerUnit)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(b.costing?.revenue)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${Number(b.costing?.realizedProfit) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatINR(b.costing?.realizedProfit)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(b.costing?.unsoldInventoryValue)}</td>
                      </>
                    )}
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_STYLE[b.status] || STATUS_STYLE.Closed}`}>{b.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1">
                      <button type="button" onClick={() => navigate(`/inventory/batches/${encodeURIComponent(b.batchCode)}`)} title="View details (Batch 360°)" aria-label={`View details of ${b.batchCode}`} className="p-1.5 rounded-md border border-slate-200 text-blue-700 hover:bg-blue-50 cursor-pointer">
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
