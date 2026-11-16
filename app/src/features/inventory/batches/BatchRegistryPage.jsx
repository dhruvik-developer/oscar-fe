import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Printer, ScanLine, IndianRupee, Eye, SlidersHorizontal, X, Plus, Users, Layers, PackageOpen,
  Boxes, CheckCircle2, Bookmark, ClipboardCheck, RefreshCcw, XCircle, Truck, UserRound, ShoppingCart,
  Factory, GitMerge, PenLine, ArrowLeft, ShieldCheck, History, Wallet, ExternalLink, PackageCheck,
  AlertCircle, Droplets, ChevronRight, Package, FileText, Ban, Receipt, Check, RefreshCw,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import AppPagination from '../../../components/ui/AppPagination';
import { inventoryService } from '../../../services/domainServices';
import { formatINR, formatNumberIN, describeApiError } from '../../accounts/accountingShared';
import { printBatchTags } from './printBatchTag';
import BatchChargeModal from './BatchChargeModal';
import { PhysicalStockSummary } from './CustomerMaterialPanels';
import AddBatchModal, { useTextileMasters } from './AddBatchModal';
import { useERP } from '../../../context/ERPContext';
import { ColourChip } from '../../purchase/DyeingColourField';
import SendForReprocessModal from './SendForReprocessModal';
import BatchQrModal from './BatchQrModal';
import { api } from '../../../services/api';

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
/** Where a batch came from, with its icon. */
const ORIGIN_ICON = { PURCHASE: ShoppingCart, PRODUCTION: Factory, JOB_WORK: Truck, MERGE: GitMerge, MANUAL: PenLine };
/** Status tabs above the table ('' = all). */
const STATUS_TABS = ['', 'In Stock', 'At Job Worker', 'Blocked', 'Sold Out'];
const STATUS_DOT = {
  'In Stock': 'bg-emerald-500', 'QC Hold': 'bg-amber-500', 'At Job Worker': 'bg-violet-500',
  Blocked: 'bg-rose-500', 'Sold Out': 'bg-slate-400', Closed: 'bg-slate-300',
};
const HOLDING_LABEL = {
  available: 'Available',
  reserved: 'Reserved',
  qcHold: 'QC hold',
  rework: 'Rework',
  rejected: 'Rejected',
  withJobWorker: 'At job worker',
};
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
const BLANK = {
  q: '', origin: '', fabricType: '', status: '', qcStatus: '', poId: '',
  poStatus: '', receiptStatus: '', billStatus: '', vendorId: '',
  from: '', to: '', itemId: '', designId: '', shadeId: '', locationId: '',
  holding: '', vendorQ: '',
};
const inputCls = 'h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500';
const ghostBtn = 'h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer';
const QC_STATUSES = ['Passed'];
const PO_STATUS_OPTIONS = ['Draft', 'Pending Approval', 'Approved', 'Issued', 'Partially Received', 'Fully Received', 'Closed'];
const RECEIPT_STATUS_OPTIONS = [
  ['', 'All receipt statuses'],
  ['PENDING', 'Pending Receipt'],
  ['PARTIAL', 'Partially Received'],
  ['COMPLETE', 'Fully Received'],
];
const BILL_STATUS_OPTIONS = [
  'Bill Not Received',
  'Pending Matching',
  'Matched',
  'Mismatch — Approval Required',
  'Approved',
  'Rejected',
  'Partially Matched',
];
const VIEWS = [['po', 'Group by PO'], ['all', 'All Batches'], ['fabric', 'Group by Fabric']];

/** One bar per row: where the batch\'s metres are now, plus what was sold. */
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

function BatchGroupCard({
  group,
  expanded,
  onToggle,
  onOpenPo,
  onOpenBatch,
}) {
  const isPo = group.type === 'po';
  const isUnlinked = group.type === 'unlinked';
  const title = isPo ? group.poNumber : group.title;
  const fabricNames = (group.fabricNames || []).join(', ') || group.item || '—';
  const uom = group.uom || 'm';

  const orderedQty = Number(group.orderedQty || 0);
  const receivedQty = Number(group.receivedQty || 0);
  const remainingQty = isPo
    ? (group.remainingQty !== undefined ? Number(group.remainingQty) : Math.max(0, orderedQty - receivedQty))
    : 0;

  const batches = group.batches || [];
  const qcAcceptedQty = (group.qcPassedQty !== undefined || group.qcAcceptedQty !== undefined)
    ? Number(group.qcPassedQty || group.qcAcceptedQty)
    : batches.reduce((sum, b) => sum + Number(b.acceptedQty || 0), 0);

  const availableQty = group.availableQty !== undefined
    ? Number(group.availableQty)
    : batches.reduce((sum, b) => sum + Number(b.availableQty || 0), 0);

  const poDateFormatted = group.poDate || group.createdAt
    ? new Date(group.poDate || group.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const billStatus = group.billStatus || group.billMatchingStatus || (
    receivedQty === 0 ? 'Bill Not Received' :
    remainingQty === 0 ? 'Matched' : 'Pending Matching'
  );

  const billBadgeStyle = {
    'Matched': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Pending Matching': 'bg-amber-50 text-amber-700 border-amber-200',
    'Partially Matched': 'bg-sky-50 text-sky-700 border-sky-200',
    'Mismatch — Approval Required': 'bg-rose-50 text-rose-700 border-rose-200',
    'Mismatch': 'bg-rose-50 text-rose-700 border-rose-200',
    'Rejected': 'bg-rose-50 text-rose-700 border-rose-200',
    'Bill Not Received': 'bg-slate-100 text-slate-600 border-slate-200',
  }[billStatus] || 'bg-slate-100 text-slate-600 border-slate-200';

  const poBadgeStyle = {
    'Approved': 'bg-blue-50 text-blue-700 border-blue-200',
    'Issued': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Partially Received': 'bg-amber-50 text-amber-700 border-amber-200',
    'Fully Received': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Draft': 'bg-slate-100 text-slate-700 border-slate-200',
    'Closed': 'bg-slate-100 text-slate-500 border-slate-200',
  }[group.status] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <section className="border border-blue-100 rounded-xl bg-slate-50/70 overflow-hidden shadow-2xs transition-shadow hover:shadow-xs">
      <div className="p-4 space-y-3">
        {/* Main PO Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
              className="grid place-items-center w-8 h-8 rounded-lg border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 cursor-pointer font-bold text-base transition-colors"
            >
              {expanded ? '−' : '+'}
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-bold text-slate-900">{title}</span>
                {isUnlinked && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800">
                    Unlinked / Legacy
                  </span>
                )}
                {isPo && group.status && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${poBadgeStyle}`}>
                    {group.status}
                  </span>
                )}
                {isPo && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${billBadgeStyle}`}>
                    Bill: {billStatus}
                  </span>
                )}
                {isPo && group.fabricFlowLabel && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-200">
                    {group.fabricFlowLabel}
                  </span>
                )}
                {isPo && <ColourChip name={group.dyeingColourName} hex={group.dyeingColourHex} />}
              </div>
              <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-2">
                {isPo ? (
                  <>
                    <span>Vendor: <strong className="text-slate-800">{group.vendorName || '—'}</strong></span>
                    <span className="text-slate-300">·</span>
                    <span>Fabric: <strong className="text-slate-800">{fabricNames}</strong></span>
                    {poDateFormatted && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span>Date: <strong className="text-slate-700">{poDateFormatted}</strong></span>
                      </>
                    )}
                  </>
                ) : (
                  <span>{group.type === 'fabric' ? 'Batches grouped by fabric' : 'No reliable PO reference'}</span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Quantity Metrics Ribbon */}
        {isPo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-blue-100 text-xs">
            <div className="rounded-lg bg-white/80 p-2 border border-slate-200/80">
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">Ordered</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatNumberIN(orderedQty)} {uom}</span>
            </div>
            <div className="rounded-lg bg-emerald-50/60 p-2 border border-emerald-100">
              <span className="text-[10px] font-semibold uppercase text-emerald-700 block">QC-Passed Quantity</span>
              <span className="font-bold text-emerald-800 tabular-nums">{formatNumberIN(qcAcceptedQty)} {uom}</span>
            </div>
            <div className="rounded-lg bg-emerald-50/80 p-2 border border-emerald-200">
              <span className="text-[10px] font-semibold uppercase text-emerald-800 block">Available Stock</span>
              <span className="font-bold text-emerald-900 tabular-nums">{formatNumberIN(availableQty)} {uom}</span>
            </div>
            <div className="rounded-lg bg-blue-50/60 p-2 border border-blue-100">
              <span className="text-[10px] font-semibold uppercase text-blue-700 block">Eligible Batch Count</span>
              <span className="font-bold text-blue-900 tabular-nums">{group.batchCount ?? batches.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Child Batch Rows Table */}
      {expanded && (
        <div className="overflow-x-auto border-t border-slate-200 bg-slate-50/40">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-100/80 text-[10px] uppercase tracking-wide text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left">Batch Number</th>
                <th className="px-4 py-2.5 text-left">GRN Number</th>
                <th className="px-4 py-2.5 text-left">Fabric</th>
                <th className="px-4 py-2.5 text-right">QC-Passed Quantity</th>
                <th className="px-4 py-2.5 text-right">Available Quantity</th>
                <th className="px-4 py-2.5 text-left">Location</th>
                <th className="px-4 py-2.5 text-left">Dispatch Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {batches.map((batch) => {
                const bAcceptedQty = Number(batch.acceptedQty || 0);
                const bLocation = (batch.locationNames || []).join(', ') || '—';
                const bDispatchStatus = batch.dispatchStatus || (
                  batch.status === 'Sold Out' ? 'Dispatched' :
                  (Number(batch.quantities?.reserved || 0) > 0 ? 'Reserved' : 'In Godown')
                );

                return (
                  <tr key={batch.id || batch.batchCode} onClick={() => onOpenBatch(batch)} title="Show QR code" className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-blue-700 hover:underline">{batch.batchCode}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                      {(batch.receiptNumbers || []).join(', ') || batch.sourceDocumentNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="font-semibold">{batch.item || '—'}</span>
                      <span className="ml-1.5 text-[10px] text-slate-500">{batch.fabricType === 'DYED' ? 'Dyed' : 'Grey'}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">
                      {formatNumberIN(bAcceptedQty)} {batch.uom || uom}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                      {formatNumberIN(batch.availableQty)} {batch.uom || uom}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{bLocation}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        bDispatchStatus === 'Dispatched' ? 'bg-slate-100 text-slate-700' :
                        bDispatchStatus === 'Reserved' ? 'bg-blue-50 text-blue-700' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {bDispatchStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {isPo ? 'No QC-passed batches posted to inventory are linked to this PO.' : 'No batches in this group.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Batch Registry: permanent batch IDs with passed QC and posted stock. */
export default function BatchRegistryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { items = [], locations = [], purchaseOrders: erpPurchaseOrders = [], vendors = [] } = useERP() || {};
  const { designs, shades } = useTextileMasters();
  const fabrics = items.filter((i) => ['LOT', 'TAKA'].includes(String(i.trackingType || '').toUpperCase()) || /fabric/i.test(i.itemKind || ''));
  const godowns = locations.filter((l) => !String(l.code || '').startsWith('SYS-'));
  const initialPoId = searchParams.get('po') || searchParams.get('poId') || searchParams.get('poNumber') || '';
  const [view, setView] = useState('po');
  const [filters, setFilters] = useState(() => ({ ...BLANK, poId: initialPoId }));
  const [query, setQuery] = useState(() => ({ ...BLANK, poId: initialPoId }));
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ results: [], groups: [], count: 0, batchCount: 0, canSeeCost: false });
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  // Batch profitability report: cost / revenue / profit columns (ledger access only).
  const [withCost, setWithCost] = useState(false);
  const [reprocessBatch, setReprocessBatch] = useState(null);
  const [qrBatch, setQrBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scan, setScan] = useState('');
  const [selected, setSelected] = useState({});
  const [chargeOpen, setChargeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [showPhysical, setShowPhysical] = useState(false);

  // PO Hub states
  const [poDetails, setPoDetails] = useState(null);
  const [flowData, setFlowData] = useState(null);
  const [loadingFlow, setLoadingFlow] = useState(false);

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
      if (view === 'all') {
        const [res, poOptions] = await Promise.all([
          inventoryService.getBatches(params),
          inventoryService.getBatchGroups({ optionsOnly: 1 }),
        ]);
        setData({ results: res?.results || [], groups: [], count: res?.count || 0, batchCount: res?.count || 0, canSeeCost: Boolean(res?.canSeeCost), summary: res?.summary || null, awaitingQcCount: res?.awaitingQcCount || 0 });
        setPurchaseOrders(poOptions?.purchaseOrders || []);
      } else {
        const res = await inventoryService.getBatchGroups({ ...params, groupBy: view });
        const groups = res?.groups || [];
        setData({ results: [], groups, count: res?.groupCount || 0, batchCount: res?.batchCount || 0, canSeeCost: Boolean(res?.canSeeCost), summary: res?.summary || null, awaitingQcCount: 0 });
        setPurchaseOrders(res?.purchaseOrders || []);
        setExpandedGroups((current) => Object.fromEntries(groups.map((group) => [group.key, current[group.key] ?? false])));
      }
    } catch (err) {
      setError(describeApiError(err) || 'Batch Registry could not be loaded.');
      setData({ results: [], groups: [], count: 0, batchCount: 0 });
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, withCost, view]);
  useEffect(() => { load(); }, [load]);

  // Filters apply as they change; typing in search waits a moment.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(filters); setPage(1); }, filters.q !== query.q ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const poParam = searchParams.get('po') || searchParams.get('poId') || searchParams.get('poNumber') || '';
    if (poParam !== (filters.poId || '')) {
      if (poParam) {
        setView('po');
      }
      setFilters((prev) => ({ ...prev, poId: poParam }));
      setQuery((prev) => ({ ...prev, poId: poParam }));
      setPage(1);
    }
  }, [searchParams, filters.poId]);

  const setF = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === 'poId') {
      setQuery((prev) => ({ ...prev, poId: value }));
      const next = new URLSearchParams(searchParams);
      if (value) {
        next.set('po', value);
      } else {
        next.delete('po');
        next.delete('poId');
        next.delete('poNumber');
        next.delete('view');
      }
      setSearchParams(next, { replace: true });
    }
  };

  const changeView = (nextView) => {
    setView(nextView);
    setPage(1);
    setSelected({});
  };

  const toggleGroup = (key) => setExpandedGroups((current) => ({ ...current, [key]: !current[key] }));

  // A barcode/QR scanner types the code and presses Enter
  const openScanned = (e) => {
    e.preventDefault();
    const raw = scan.trim();
    if (!raw) return;
    const code = decodeURIComponent(raw.split('/').filter(Boolean).pop() || raw);
    setScan('');
    navigate(`/inventory/batches/${encodeURIComponent(code)}/a-to-z`);
  };

  const open = (batch) => setQrBatch(batch);

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
    filters.poId && ['poId', `PO: ${purchaseOrders.find((po) => String(po.id) === String(filters.poId))?.poNumber || filters.poId}`],
    filters.vendorId && ['vendorId', `Vendor: ${vendors.find((v) => String(v.id) === String(filters.vendorId))?.name || filters.vendorId}`],
    filters.poStatus && ['poStatus', `PO Status: ${filters.poStatus}`],
    filters.receiptStatus && ['receiptStatus', `Receipt: ${RECEIPT_STATUS_OPTIONS.find(([v]) => v === filters.receiptStatus)?.[1] || filters.receiptStatus}`],
    filters.billStatus && ['billStatus', `Bill: ${filters.billStatus}`],
    filters.qcStatus && ['qcStatus', `QC: ${filters.qcStatus}`],
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

  // Client-filtered groups for real-time responsiveness across toolbar filters
  const displayedGroups = useMemo(() => {
    if (!data.groups) return [];
    return data.groups.filter((group) => {
      if (filters.poStatus && group.type === 'po' && group.status !== filters.poStatus) {
        return false;
      }
      if (filters.vendorId && group.type === 'po') {
        const vendor = vendors.find((v) => String(v.id) === String(filters.vendorId));
        if (vendor && group.vendorName && !group.vendorName.toLowerCase().includes(vendor.name.toLowerCase())) {
          return false;
        }
      }
      if (filters.vendorQ && group.vendorName && !group.vendorName.toLowerCase().includes(filters.vendorQ.toLowerCase())) {
        return false;
      }
      if (filters.receiptStatus && group.type === 'po') {
        const rem = Number(group.remainingQty || 0);
        const rec = Number(group.receivedQty || 0);
        if (filters.receiptStatus === 'PENDING' && rec > 0) return false;
        if (filters.receiptStatus === 'PARTIAL' && (rec === 0 || rem === 0)) return false;
        if (filters.receiptStatus === 'COMPLETE' && rem > 0) return false;
      }
      if (filters.billStatus && group.type === 'po') {
        const bStatus = group.billStatus || (Number(group.receivedQty || 0) === 0 ? 'Bill Not Received' : Number(group.remainingQty || 0) === 0 ? 'Matched' : 'Pending Matching');
        if (bStatus !== filters.billStatus) return false;
      }
      return true;
    });
  }, [data.groups, filters.poStatus, filters.vendorId, filters.vendorQ, filters.receiptStatus, filters.billStatus, vendors]);

  // Selected PO Group identification
  const currentPoFilter = query.poId || filters.poId || searchParams.get('po') || searchParams.get('poId') || searchParams.get('poNumber') || '';
  const selectedPoGroup = currentPoFilter
    ? (data.groups.find((group) => group.type === 'po' && (String(group.poId) === String(currentPoFilter) || String(group.poNumber).toLowerCase() === String(currentPoFilter).toLowerCase()))
       || (data.groups.length === 1 && data.groups[0].type === 'po' ? data.groups[0] : null))
    : null;

  // Reload PO details and Fabric Flow data
  const reloadPoDetails = useCallback(async (poId) => {
    if (!poId) return;
    setLoadingFlow(true);
    try {
      const [poRes, flowRes] = await Promise.allSettled([
        api.get(`/purchase/orders/${poId}/`),
        api.get(`/purchase/orders/${poId}/fabric-flow/`),
      ]);
      if (poRes.status === 'fulfilled' && poRes.value) {
        setPoDetails(poRes.value);
      }
      if (flowRes.status === 'fulfilled' && flowRes.value) {
        setFlowData(flowRes.value);
      }
    } catch (e) {
      console.error('Failed to load PO details/flow:', e);
    } finally {
      setLoadingFlow(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPoGroup?.poId) {
      reloadPoDetails(selectedPoGroup.poId);
    } else {
      setPoDetails(null);
      setFlowData(null);
    }
  }, [selectedPoGroup?.poId, reloadPoDetails]);


  // Refresh everything after an action (GRN, QC, Delivery) saves
  const handleActionSaved = useCallback(async () => {
    await load();
    if (selectedPoGroup?.poId) {
      await reloadPoDetails(selectedPoGroup.poId);
    }
  }, [load, selectedPoGroup?.poId, reloadPoDetails]);

  const reprocessModal = reprocessBatch && (
    <SendForReprocessModal
      batch={reprocessBatch}
      onClose={() => setReprocessBatch(null)}
      onDone={async () => { setReprocessBatch(null); await handleActionSaved(); }}
    />
  );

  // Context-sensitive status calculations
  const poStatus = selectedPoGroup?.status || poDetails?.status || '';
  const isDraftOrPending = ['Draft', 'Pending Approval'].includes(poStatus);
  const qcPendingMetres = Number(selectedPoGroup?.qcPendingQty || flowData?.quantities?.awaitingQc || 0);
  const hasPendingQc = qcPendingMetres > 0 || (selectedPoGroup?.batches || []).some((b) => ['QC Hold', 'Pending', 'Mixed', 'Not Inspected'].includes(b.qcStatus));
  const hasBatches = (selectedPoGroup?.batches || []).length > 0;

  return (
    <div className="space-y-4">
      {/* Navigation Bar when viewing a specific PO */}
      {selectedPoGroup && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-200 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setF('poId', '');
                setQuery((prev) => ({ ...prev, poId: '' }));
                setSearchParams({});
              }}
              className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="Return to full Batch Registry showing all batches and orders"
            >
              <ArrowLeft size={14} /> Back to Batch Registry
            </button>
            <button
              type="button"
              onClick={() => navigate('/purchase/orders')}
              className="h-8 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              title="Return to Purchase Orders list"
            >
              <ExternalLink size={13} className="text-slate-500" /> Back to Purchase Orders
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-700 font-medium">
              Managing operations &amp; batches for: <strong className="font-mono text-slate-900">{selectedPoGroup.poNumber}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setF('poId', '');
              setQuery((prev) => ({ ...prev, poId: '' }));
              setSearchParams({});
            }}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
          >
            Clear PO Filter (View all POs) &rarr;
          </button>
        </div>
      )}

      <PageHeader
        title={selectedPoGroup ? `Batch Registry — ${selectedPoGroup.poNumber}` : 'Batch Registry'}
        subtitle={selectedPoGroup
          ? `Central hub for managing goods receipts, batch tracking, quality control inspections, and dispatches for ${selectedPoGroup.poNumber}.`
          : "Every grey and dyed fabric batch — its ID, QR tag, where its metres are now and its status. Click a batch for its QR code."}
        breadcrumb={selectedPoGroup ? [
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Inventory', path: '/inventory/dashboard' },
          { label: 'Batch Registry', path: '/inventory/batches' },
          { label: selectedPoGroup.poNumber },
        ] : undefined}
        actions={(
          !selectedPoGroup && <button type="button" onClick={() => setAdding(true)} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
            <Plus size={14} /> Create Batch
          </button>
        )}
      />

      {/* PO-SPECIFIC WORKSPACE: CENTRAL HUB FOR RECEIPTS, QC, BATCHES, DISPATCH & COSTS */}
      {view === 'po' && selectedPoGroup && (
        <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-xs space-y-4" aria-label="Purchase order operations hub">
          {/* Header Row */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Purchase Order Operations Hub</span>
                {poStatus && (
                  <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
                    poStatus === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    poStatus === 'Partially Received' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    poStatus === 'Fully Received' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    poStatus === 'Draft' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                    'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {poStatus}
                  </span>
                )}
                {(selectedPoGroup.fabricFlowLabel || selectedPoGroup.fabricFlow) && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[10.5px] font-semibold text-indigo-700 inline-flex items-center gap-1">
                    <Truck size={11} />
                    {selectedPoGroup.fabricFlowLabel || (selectedPoGroup.fabricFlow === 'FACTORY_TO_MILL' ? 'Factory → Dyeing Mill → OSCAR' : 'Factory → OSCAR Warehouse')}
                  </span>
                )}
                <ColourChip name={selectedPoGroup.dyeingColourName} hex={selectedPoGroup.dyeingColourHex} />
              </div>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900 font-mono tracking-tight">{selectedPoGroup.poNumber}</h2>
              <div className="mt-1 text-xs text-slate-600 flex flex-wrap items-center gap-x-2">
                <span>Vendor / Factory: <strong className="text-slate-800">{selectedPoGroup.vendorName || '—'}</strong></span>
                {selectedPoGroup.dyeingMillName && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span>Dyeing Mill: <strong className="text-slate-800">{selectedPoGroup.dyeingMillName}</strong></span>
                  </>
                )}
                <span className="text-slate-300">|</span>
                <span>Fabric: <strong className="text-slate-800">{selectedPoGroup.fabricNames?.join(', ') || '—'}</strong></span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* [DISABLED] Open Full PO button commented out as requested
              <button
                type="button"
                onClick={() => navigate(`/purchase/orders?po=${encodeURIComponent(selectedPoGroup.poId)}`)}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="View full Purchase Order document"
              >
                <ExternalLink size={13} className="text-slate-500" /> Open Full PO
              </button>
              */}
            </div>
          </div>

          {/* Backend KPI Metric Tiles */}
          {(() => {
            const tiles = [
              ['Ordered Quantity', selectedPoGroup.orderedQty, 'text-slate-900', 'bg-slate-50'],
              ['Received at OSCAR', selectedPoGroup.receivedQty, 'text-slate-900', 'bg-slate-50'],
              ['Remaining to Receive', selectedPoGroup.remainingQty, Number(selectedPoGroup.remainingQty || 0) > 0 ? 'text-amber-800' : 'text-slate-900', Number(selectedPoGroup.remainingQty || 0) > 0 ? 'bg-amber-50/50 border border-amber-200/60' : 'bg-slate-50'],
              ['Eligible Batches', selectedPoGroup.batches?.length || selectedPoGroup.batchCount || 0, 'text-blue-700', 'bg-blue-50/50 border border-blue-200/60'],
              ['QC-Passed Quantity', selectedPoGroup.qcPassedQty, 'text-emerald-700', 'bg-emerald-50 border border-emerald-200'],
              ['Available Stock Quantity', selectedPoGroup.availableQty, 'text-emerald-800', 'bg-emerald-50/80 border border-emerald-200'],
            ];
            const gridColsCls = tiles.length >= 7 ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6';
            return (
              <dl className={gridColsCls}>
                {tiles.map(([label, value, txtCls, bgCls]) => (
                  <div key={label} className={`rounded-xl p-3 ${bgCls}`}>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
                    <dd className={`mt-1 text-base font-extrabold tabular-nums ${txtCls}`}>
                      {label === 'Eligible Batches' ? value : `${formatNumberIN(value)} ${selectedPoGroup.uom || 'm'}`}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          })()}
        </section>
      )}

      {showPhysical && <PhysicalStockSummary />}
      {reprocessModal}
      {qrBatch && <BatchQrModal batch={qrBatch} onClose={() => setQrBatch(null)} />}
      {adding && (
        <AddBatchModal
          onClose={() => setAdding(false)}
          onDone={(batch) => {
            setAdding(false);
            setQrBatch(batch);
            load();
          }}
        />
      )}

      {/* Eligible-batch stock summary from the registry API */}
      {!selectedPoGroup && s && (
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Batch registry summary">
          {[
            ['QC-Passed Batches', data.batchCount, 'QC passed and posted', Boxes, 'text-blue-700', 'bg-blue-50'],
            ['Available Stock', s.available, 'Ready to use', CheckCircle2, 'text-emerald-700', 'bg-emerald-50'],
            ['Reserved Stock', s.reserved, 'Held for orders', Bookmark, 'text-indigo-700', 'bg-indigo-50'],
            ['At Job Worker', s.withJobWorker, 'Currently with job worker', Truck, 'text-slate-700', 'bg-slate-100'],
          ].map(([label, value, subtitle, Icon, tone, tint]) => {
            const isBatchCount = label === 'QC-Passed Batches';
            const numericValue = Number(value || 0);
            return (
              <article key={label} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className={`grid place-items-center w-8 h-8 rounded-lg ${tint}`}><Icon size={16} /></span>
                  <div className="min-w-0">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</h2>
                    <div className={`mt-0.5 text-lg leading-5 font-bold tabular-nums ${tone}`}>
                      {formatNumberIN(numericValue)}{!isBatchCount && <span className="ml-1 text-[11px] font-medium text-slate-500">m</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Toolbar: Search, Filters, Vendor/Factory, PO, Status */}
      {!selectedPoGroup && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200" role="tablist" aria-label="Batch Registry view">
              {VIEWS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => changeView(key)}
                  className={`h-8 px-3 rounded-md text-xs font-semibold cursor-pointer transition-colors ${view === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* PO Filter Select */}
              <select
                value={filters.poId}
                onChange={(e) => setF('poId', e.target.value)}
                className={`${inputCls} min-w-44`}
                aria-label="Filter by purchase order"
              >
                <option value="">All purchase orders</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>{po.poNumber}</option>
                ))}
              </select>

              {/* Vendor / Factory Select */}
              {vendors.length > 0 && (
                <select
                  value={filters.vendorId || ''}
                  onChange={(e) => setF('vendorId', e.target.value)}
                  className={`${inputCls} min-w-40`}
                  aria-label="Filter by vendor or factory"
                >
                  <option value="">All vendors / factories</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-2">
            {/* Tag / Code Barcode Scanner */}
            <form onSubmit={openScanned} className="relative lg:w-72">
              <ScanLine size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-600" />
              <input
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="Scan QR or batch ID, Enter"
                aria-label="Scan or enter batch or taka ID"
                className={`${inputCls} w-full pl-8 font-mono`}
                autoComplete="off"
              />
            </form>

            {/* General Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.q}
                onChange={(e) => setF('q', e.target.value)}
                placeholder="Search PO number, batch code, vendor, fabric quality, GRN…"
                aria-label="Search batches and purchase orders"
                className={`${inputCls} w-full pl-8`}
              />
            </div>

            {/* Grey / Dyed Fabric Type Filter */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 self-start" role="radiogroup" aria-label="Fabric type">
              {FABRIC_TYPES.map(([v, l]) => (
                <button
                  key={v || 'all'}
                  type="button"
                  role="radio"
                  aria-checked={filters.fabricType === v}
                  onClick={() => setF('fabricType', v)}
                  className={`h-8 px-3 rounded-md text-xs font-semibold cursor-pointer ${filters.fabricType === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Advanced Filters Button */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`${ghostBtn} self-start ${showFilters || advancedCount ? 'border-blue-300 text-blue-700 bg-blue-50/50' : ''}`}
            >
              <SlidersHorizontal size={14} /> Filters{advancedCount ? ` (${advancedCount})` : ''}
            </button>

            {view === 'all' && data.canSeeCost && (
              <label className={`${ghostBtn} self-start ${withCost ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : ''}`}>
                <input type="checkbox" className="sr-only" checked={withCost} onChange={(e) => { setWithCost(e.target.checked); setPage(1); }} />
                <IndianRupee size={14} /> {withCost ? 'Hide' : 'Show'} cost &amp; profit
              </label>
            )}
          </div>

          {/* Expanded Secondary Filters Grid */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-3 border-t border-slate-100">
              {/* PO Status Filter */}
              <select
                value={filters.poStatus || ''}
                onChange={(e) => setF('poStatus', e.target.value)}
                className={inputCls}
                aria-label="Filter by PO status"
              >
                <option value="">All PO statuses</option>
                {PO_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* Receipt Status Filter */}
              <select
                value={filters.receiptStatus || ''}
                onChange={(e) => setF('receiptStatus', e.target.value)}
                className={inputCls}
                aria-label="Filter by receipt status"
              >
                {RECEIPT_STATUS_OPTIONS.map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>

              {/* QC Status Filter */}
              <select
                value={filters.qcStatus}
                onChange={(e) => setF('qcStatus', e.target.value)}
                className={inputCls}
                aria-label="QC status"
              >
                <option value="">All QC statuses</option>
                {QC_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              {/* Bill Matching Status Filter */}
              <select
                value={filters.billStatus || ''}
                onChange={(e) => setF('billStatus', e.target.value)}
                className={inputCls}
                aria-label="Filter by bill-matching status"
              >
                <option value="">All bill statuses</option>
                {BILL_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* Fabric Quality / Item */}
              <select
                value={filters.itemId}
                onChange={(e) => setF('itemId', e.target.value)}
                className={inputCls}
                aria-label="Fabric"
              >
                <option value="">All fabrics</option>
                {fabrics.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>

              {/* Godown / Warehouse */}
              <select
                value={filters.locationId}
                onChange={(e) => setF('locationId', e.target.value)}
                className={inputCls}
                aria-label="Godown"
              >
                <option value="">All godowns</option>
                {godowns.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>

              {/* Date From */}
              <label className="flex items-center gap-2 text-xs text-slate-500">
                From
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setF('from', e.target.value)}
                  className={`${inputCls} flex-1 min-w-0`}
                  aria-label="Created from"
                />
              </label>

              {/* Date To */}
              <label className="flex items-center gap-2 text-xs text-slate-500">
                To
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setF('to', e.target.value)}
                  className={`${inputCls} flex-1 min-w-0`}
                  aria-label="Created to"
                />
              </label>
            </div>
          )}

          {/* Active Chips & Clear All */}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {chips.map(([key, label]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-800"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => setF(key, '')}
                    aria-label={`Remove ${label}`}
                    className="p-0.5 rounded-full hover:bg-blue-100 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => {
                  setFilters({ ...BLANK, q: filters.q, fabricType: filters.fabricType });
                  setSearchParams({});
                }}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}
      {notice && <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">{notice}</div>}

      {/* Batches Table & Groups */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {selectedPoGroup ? (
          /* PO-FOCUSED BATCHES VIEW */
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Batches Linked to {selectedPoGroup.poNumber} ({selectedPoGroup.batches?.length || 0})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every batch created from warehouse receipt of this Purchase Order. Click a batch code to open its 360° traceability view.
                </p>
              </div>
            </div>

            {/* EMPTY STATE IF 0 BATCHES */}
            {(!selectedPoGroup.batches || selectedPoGroup.batches.length === 0) ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center my-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <PackageOpen size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Batches Inwarded Yet for {selectedPoGroup.poNumber}</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  A batch is opened when fabric physically arrives at the warehouse and is recorded under Goods Receipt (GRN).
                </p>
              </div>
            ) : (
              /* TABLE OF BATCHES */
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[1080px] text-xs">
                  <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left">Batch No.</th>
                      <th className="px-4 py-3 text-left">Receipt / GRN</th>
                      {selectedPoGroup.dyeingColourName && <th className="px-4 py-3 text-left">Dyeing Colour</th>}
                      <th className="px-4 py-3 text-right">Batch Qty</th>
                      <th className="px-4 py-3 text-right">Rate / Amount</th>
                      <th className="px-4 py-3 text-left">QC Status</th>
                      <th className="px-4 py-3 text-right">Accepted</th>
                      <th className="px-4 py-3 text-right">Available (Passed)</th>
                      <th className="px-4 py-3 text-left">Stock Status</th>
                      <th className="px-4 py-3 text-left">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPoGroup.batches.map((batch) => (
                      <tr key={batch.id} onClick={() => setQrBatch(batch)} title="Show QR code" className="hover:bg-slate-50/80 cursor-pointer">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-blue-700 hover:underline inline-flex items-center gap-1">
                            <Package size={13} /> {batch.batchCode}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {batch.item || '—'} · {batch.fabricType === 'DYED' ? 'Dyed' : 'Grey'}{batch.supplierName ? ` · ${batch.supplierName}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                          {(batch.receiptNumbers || []).join(', ') || batch.sourceDocumentNumber || '—'}
                        </td>
                        {selectedPoGroup.dyeingColourName && (
                          <td className="px-4 py-3"><ColourChip name={batch.dyeingColourName} hex={batch.dyeingColourHex} /></td>
                        )}
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                          {formatNumberIN(batch.batchQty)} {batch.uom}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <div className="font-semibold text-slate-800">{formatINR(batch.batchAmount)}</div>
                          <div className="text-[10px] text-slate-500">@ {formatINR(batch.actualRate)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            batch.qcStatus === 'Passed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            batch.qcStatus === 'Pending' || batch.qcStatus === 'QC Hold' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            batch.qcStatus === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            batch.qcStatus === 'Mixed' || batch.qcStatus === 'Partially Approved' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {batch.qcStatus === 'Mixed' ? 'Partially Approved' : batch.qcStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                          {formatNumberIN(batch.acceptedQty)} {batch.uom}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <div className="font-bold text-emerald-700">
                            {formatNumberIN(batch.availableQty)} {batch.uom}
                          </div>
                          {Number(batch.reworkQty || 0) > 0 && (
                            <div className="text-[10px] font-semibold text-purple-700 mt-0.5" title="Defective quantity moved to Reprocess stock">
                              {formatNumberIN(batch.reworkQty)} {batch.uom} Reprocess
                            </div>
                          )}
                          {Number(batch.rejectedQty || 0) > 0 && (
                            <div className="text-[10px] font-semibold text-rose-600 mt-0.5" title="Defective quantity rejected">
                              {formatNumberIN(batch.rejectedQty)} {batch.uom} Rejected
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLE[batch.status] || STATUS_STYLE.Closed}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[batch.status] || STATUS_DOT.Closed}`} />
                            {batch.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{(batch.locationNames || []).join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* GENERAL MULTI-PO / FABRIC / ALL VIEW */
          <>
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
            {view === 'all' ? (
              <>
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
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.results.map((b) => {
                        const q = b.quantities || {};
                        const isChecked = Boolean(selected[b.batchCode]);
                        return (
                          <tr key={b.id} onClick={() => open(b)} title="Show QR code" className={`hover:bg-slate-50/80 cursor-pointer ${isChecked ? 'bg-blue-50/40' : ''}`}>
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={isChecked} onChange={() => toggle(b)} aria-label={`Select ${b.batchCode}`} className="cursor-pointer" />
                            </td>
                            <td className="px-3 py-3">
                              <span className="font-mono font-bold text-blue-700 hover:underline">{b.batchCode}</span>
                              <ColourChip name={b.dyeingColourName} hex={b.dyeingColourHex} className="ml-1.5" />
                              <div className="text-[10px] text-slate-500 mt-0.5">{b.designName || '—'} {b.shadeName ? `· ${b.shadeName}` : ''}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-medium text-slate-900">{b.itemName || '—'}</div>
                              <span className="text-[10px] text-slate-400 font-mono">{b.sku}</span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-slate-800">{ORIGIN_LABEL[b.origin] || b.origin || '—'}</div>
                              <div className="text-[10px] text-slate-500">{b.sourceDocumentNumber || b.supplierName || '—'}</div>
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
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLE[b.status] || STATUS_STYLE.Closed}`}><span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[b.status] || STATUS_DOT.Closed}`} />{b.status}</span>
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap space-x-1" onClick={(e) => e.stopPropagation()}>
                              {(b.qcStatus === 'Rejected' || Number(b.rejectedQty || 0) > 0) && (
                                <button
                                  type="button"
                                  onClick={() => setReprocessBatch(b)}
                                  className="p-1.5 rounded-md border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold cursor-pointer"
                                  title="Send rejected fabric for reprocessing"
                                >
                                  <RefreshCw size={12} />
                                </button>
                              )}
                              <button type="button" onClick={() => open(b)} title="Show QR code" aria-label={`Show QR code of ${b.batchCode}`} className="p-1.5 rounded-md border border-slate-200 text-blue-700 hover:bg-blue-50 cursor-pointer">
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
              </>
            ) : (
              <>
                <div className="p-3 space-y-3">
                  {loading && <div className="h-20 rounded-lg bg-slate-100 animate-pulse" />}
                  {!loading && data.groups.length === 0 && (
                    <div className="py-12 text-center">
                      <PackageOpen size={30} className="mx-auto text-slate-300" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">No batches match these filters</p>
                      <p className="text-xs text-slate-500">Clear a filter or select another view to see more.</p>
                    </div>
                  )}
                  {!loading && displayedGroups.map((group) => (
                    <BatchGroupCard
                      key={group.key}
                      group={group}
                      expanded={Boolean(expandedGroups[group.key])}
                      onToggle={() => toggleGroup(group.key)}
                      onOpenBatch={open}
                    />
                  ))}
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
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
