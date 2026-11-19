import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, Boxes, CheckCircle2, ChevronDown, Clock, Download, Factory, FileCode, FileSpreadsheet, FileText, FlaskConical, Hourglass, IndianRupee, Loader2, Lock, MapPin, PackageCheck,
  PackageX, Plus, Recycle, RefreshCw, RotateCcw, Ruler, Scissors, Search, ShoppingBag, Trash2, Truck, Undo2, Unlock, Warehouse, X,
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
import { getExportColumns, exportStockCSV, exportStockExcel, exportStockPDF } from './stockExportUtils';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

/** `?type=` values the sidebar already links to -> screen keys. */
const TYPE_TO_SCREEN = {
  good: 'usable',
  finished: 'usable',
  usable: 'usable',
  sample: 'samples',
  samples: 'samples',
  shortage: 'scrap',
  scrap: 'scrap',
  rejected: 'scrap',
  wastage: 'scrap',
  reprocess: 'reprocessing',
  reprocessing: 'reprocessing',
  'customer-return': 'customer-returns',
  'customer-returns': 'customer-returns',
  '': 'usable',
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
  { key: 'batchCode', label: 'Batch', render: batchCell },
  { key: 'fabric', label: 'Fabric', render: (r) => strong(r.fabric), sub: (r) => r.fabricQuality },
  { key: 'design', label: 'Design / Colour', sub: (r) => r.shade },
  { key: 'location', label: 'Location', render: (r) => place(r.location) },
  { key: 'quantity', label: 'Qty', align: 'right', render: (r) => qty(r.quantity, r.uom) },
  { key: 'qcStatus', label: 'QC', render: (r) => pill(r.qcStatus) },
  { key: 'stockStatus', label: 'Status', render: (r) => pill(r.stockStatus) },
  ...(withCost ? [{ key: 'value', label: 'Value', align: 'right', render: (r) => money(r.value), sub: (r) => (r.rate ? `@ ${formatINR(r.rate)}` : null) }] : []),
];

const STORE_COLUMNS = [
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
      { key: 'batchCode', label: 'Original batch', render: batchCell },
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
      { key: 'batchCode', label: 'Original batch', render: batchCell },
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
    columns: (withCost, actions) => [
      { key: 'sampleNumber', label: 'Sample ID', render: (r) => <span className="font-mono font-bold text-slate-800">{r.sampleNumber}</span> },
      { key: 'batchCode', label: 'Original Batch', render: batchCell },
      { key: 'fabricQuality', label: 'Fabric / Shade', render: (r) => strong(r.fabricQuality || r.fabric), sub: (r) => [r.shade, r.design].filter(Boolean).join(' · ') || '—' },
      { key: 'customer', label: 'Customer', render: (r) => <span className="font-medium text-slate-700">{r.customer || r.party || '—'}</span> },
      { key: 'quantity', label: 'Issued Qty', align: 'right', render: (r) => qty(r.quantity, r.uom) },
      { key: 'returned', label: 'Returned Qty', align: 'right', render: (r) => <span className={Number(r.returned) > 0 ? 'text-emerald-700 font-semibold' : ''}>{qty(r.returned, r.uom)}</span> },
      { key: 'consumed', label: 'Consumed Qty', align: 'right', render: (r) => <span className={Number(r.consumed) > 0 ? 'text-slate-500' : ''}>{qty(r.consumed, r.uom)}</span> },
      { key: 'outstanding', label: 'Available Qty', align: 'right', render: (r) => <span className={Number(r.outstanding) > 0 ? 'text-blue-700 font-bold' : 'text-slate-400'}>{qty(r.outstanding, r.uom)}</span> },
      { key: 'unitCost', label: 'Unit Cost', align: 'right', render: (r) => money(r.unitCost || 0) },
      { key: 'totalValue', label: 'Total Value', align: 'right', render: (r) => <span className="font-bold text-slate-800">{money(r.totalValue || r.estimatedCost || 0)}</span> },
      { key: 'date', label: 'Issue Date', render: (r) => r.issueDate || r.date || '—' },
      { key: 'dueDate', label: 'Due Date', render: (r) => r.dueDate || '—' },
      { key: 'status', label: 'Status', render: (r) => pill(r.status) },
      {
        key: 'actions',
        label: 'Actions',
        align: 'center',
        render: (r) => {
          const bal = Number(r.outstanding || 0);
          if (bal <= 0 || ['Returned', 'Consumed'].includes(r.status)) return <span className="text-slate-300 text-xs">—</span>;
          return (
            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); actions?.onReturn?.(r); }}
                className="px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer transition-colors"
                title="Return Sample back to Stock"
              >
                Return
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); actions?.onConsume?.(r); }}
                className="px-2 py-0.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer transition-colors"
                title="Consume Sample (Book Expense)"
              >
                Consume
              </button>
            </div>
          );
        },
      },
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
  const [showIssueSampleModal, setShowIssueSampleModal] = useState(false);
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);
  const batchDropdownRef = useRef(null);
  const [returnModalData, setReturnModalData] = useState({ open: false, sample: null, returnQuantity: '', condition: 'Good', remarks: '', submitting: false, error: null });
  const [consumeModalData, setConsumeModalData] = useState({ open: false, sample: null, consumeQuantity: '', remarks: '', submitting: false, error: null });

  const [sampleForm, setSampleForm] = useState({
    partyId: '',
    sourceLotTakaId: '',
    batchCode: '',
    fabricName: '',
    shade: '',
    design: '',
    salespersonId: '',
    brokerId: '',
    sampleType: 'CUT_PIECE',
    quantity: '1',
    uom: 'MTR',
    unitCost: '0',
    editCostUnlocked: false,
    isReturnable: true,
    dueDate: '',
    remarks: '',
  });
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [sampleParties, setSampleParties] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [sampleSubmitting, setSampleSubmitting] = useState(false);
  const [sampleError, setSampleError] = useState(null);

  // Close batch dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(e.target)) {
        setBatchDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Route grey, qc-hold, and external-wip to their respective dedicated pages
  useEffect(() => {
    const rawType = (searchParams.get('type') || '').toLowerCase();
    if (rawType === 'grey') {
      navigate('/inventory/grey', { replace: true });
    } else if (rawType === 'qc-hold' || rawType === 'qchold' || rawType === 'hold') {
      navigate('/inventory/qc/dashboard?tab=On+Hold', { replace: true });
    } else if (rawType === 'wip' || rawType === 'external-wip') {
      navigate('/job-work/pending-register', { replace: true });
    }
  }, [searchParams, navigate]);

  const screen = TYPE_TO_SCREEN[searchParams.get('type') || ''] || 'overview';
  const config = SCREENS[screen];
  const { items = [], locations = [] } = useERP() || {};
  const godowns = useMemo(() => {
    return (locations || []).filter((l) => {
      if (l.is_active === false || l.isActive === false) return false;
      const code = String(l.code || '');
      const type = String(l.type || '');
      const name = String(l.name || '');
      if (code.startsWith('SYS-')) return false;
      if (['Transit', 'Scrap', 'Zone'].includes(type)) return false;
      if (name.startsWith('WIP -')) return false;
      if (['QC Hold', 'Goods In Transit', 'Reject / Scrap', 'Reprocess Stock', 'Second Quality Stock'].includes(name)) return false;
      return true;
    });
  }, [locations]);
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

  useEffect(() => {
    if (showIssueSampleModal) {
      if (!sampleParties.length) {
        api.get('/parties/', { query: { page_size: 200 } }).then((res) => {
          const p = res?.data || res?.results || res || [];
          setSampleParties(Array.isArray(p) ? p : []);
        }).catch(() => {});
      }
      setLoadingBatches(true);
      api.get('/inventory/samples/available-batches/').then((res) => {
        const b = res?.data || res || [];
        setAvailableBatches(Array.isArray(b) ? b : []);
      }).catch(() => {
        setAvailableBatches([]);
      }).finally(() => {
        setLoadingBatches(false);
      });
    }
  }, [showIssueSampleModal, sampleParties.length]);

  const handleBatchSelect = (lotTakaId) => {
    const found = availableBatches.find((b) => b.lotTakaId === lotTakaId);
    setSelectedBatch(found || null);
    if (found) {
      const cost = found.unitCost != null ? found.unitCost : (found.rate || 0);
      setSampleForm((prev) => ({
        ...prev,
        sourceLotTakaId: lotTakaId,
        batchCode: found.batchCode || '',
        fabricName: found.fabricName || '',
        shade: found.shade || '',
        design: found.design || '',
        uom: found.uom || 'MTR',
        unitCost: String(cost),
        quantity: prev.quantity && Number(prev.quantity) <= found.availableQuantity ? prev.quantity : (found.availableQuantity >= 1 ? '1' : String(found.availableQuantity)),
      }));
    } else {
      setSampleForm((prev) => ({
        ...prev,
        sourceLotTakaId: '',
        batchCode: '',
        fabricName: '',
        shade: '',
        design: '',
        unitCost: '0',
      }));
    }
  };

  const resetSampleForm = () => {
    setShowIssueSampleModal(false);
    setBatchDropdownOpen(false);
    setSelectedBatch(null);
    setBatchSearchTerm('');
    setSampleError(null);
    setSampleForm({
      partyId: '',
      sourceLotTakaId: '',
      batchCode: '',
      fabricName: '',
      shade: '',
      design: '',
      salespersonId: '',
      brokerId: '',
      sampleType: 'CUT_PIECE',
      quantity: '1',
      uom: 'MTR',
      unitCost: '0',
      editCostUnlocked: false,
      isReturnable: true,
      dueDate: '',
      remarks: '',
    });
  };

  const filteredBatches = useMemo(() => {
    if (!batchSearchTerm.trim()) return availableBatches;
    const term = batchSearchTerm.toLowerCase();
    return availableBatches.filter((b) =>
      (b.batchCode && b.batchCode.toLowerCase().includes(term)) ||
      (b.fabricName && b.fabricName.toLowerCase().includes(term)) ||
      (b.shade && b.shade.toLowerCase().includes(term)) ||
      (b.locationName && b.locationName.toLowerCase().includes(term))
    );
  }, [availableBatches, batchSearchTerm]);

  const totalSampleValue = useMemo(() => {
    const qtyVal = Number(sampleForm.quantity) || 0;
    const rateVal = Number(sampleForm.unitCost) || 0;
    return (qtyVal * rateVal).toFixed(2);
  }, [sampleForm.quantity, sampleForm.unitCost]);

  const handleIssueSampleSubmit = async (e) => {
    e.preventDefault();
    if (!sampleForm.partyId) {
      setSampleError('Customer / Party is required.');
      return;
    }
    if (!sampleForm.sourceLotTakaId || !selectedBatch) {
      setSampleError('Please select a valid fabric batch / sample stock.');
      return;
    }
    const issueQty = Number(sampleForm.quantity);
    if (!issueQty || issueQty <= 0) {
      setSampleError('Issue quantity must be greater than zero.');
      return;
    }
    if (issueQty > Number(selectedBatch.availableQuantity)) {
      setSampleError(`Cannot issue ${issueQty} ${sampleForm.uom}. Only ${selectedBatch.availableQuantity} ${selectedBatch.uom} available in stock.`);
      return;
    }

    try {
      setSampleSubmitting(true);
      setSampleError(null);
      await api.post('/inventory/samples/', {
        partyId: sampleForm.partyId,
        sourceLotTakaId: sampleForm.sourceLotTakaId,
        batchCode: sampleForm.batchCode,
        quantity: issueQty,
        uom: sampleForm.uom || 'MTR',
        unitCost: Number(sampleForm.unitCost) || 0,
        sampleType: sampleForm.sampleType,
        isReturnable: sampleForm.isReturnable,
        dueDate: sampleForm.isReturnable && sampleForm.dueDate ? sampleForm.dueDate : undefined,
        remarks: sampleForm.remarks,
      });
      resetSampleForm();
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Failed to issue sample.';
      setSampleError(msg);
    } finally {
      setSampleSubmitting(false);
    }
  };

  const handleReturnSampleSubmit = async (e) => {
    e.preventDefault();
    const retQty = Number(returnModalData.returnQuantity);
    if (!retQty || retQty <= 0) {
      setReturnModalData((p) => ({ ...p, error: 'Return quantity must be greater than zero.' }));
      return;
    }
    const maxRet = Number(returnModalData.sample?.outstanding || returnModalData.sample?.quantity || 0);
    if (retQty > maxRet) {
      setReturnModalData((p) => ({ ...p, error: `Cannot return ${retQty}. Maximum outstanding is ${maxRet}.` }));
      return;
    }
    try {
      setReturnModalData((p) => ({ ...p, submitting: true, error: null }));
      await api.post(`/inventory/samples/${returnModalData.sample.sampleId}/return-sample/`, {
        returnQuantity: retQty,
        condition: returnModalData.condition || 'Good',
        remarks: returnModalData.remarks,
      });
      setReturnModalData({ open: false, sample: null, returnQuantity: '', condition: 'Good', remarks: '', submitting: false, error: null });
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Failed to process sample return.';
      setReturnModalData((p) => ({ ...p, error: msg, submitting: false }));
    }
  };

  const handleConsumeSampleSubmit = async (e) => {
    e.preventDefault();
    const cQty = Number(consumeModalData.consumeQuantity);
    if (!cQty || cQty <= 0) {
      setConsumeModalData((p) => ({ ...p, error: 'Consumed quantity must be greater than zero.' }));
      return;
    }
    const maxC = Number(consumeModalData.sample?.outstanding || consumeModalData.sample?.quantity || 0);
    if (cQty > maxC) {
      setConsumeModalData((p) => ({ ...p, error: `Cannot consume ${cQty}. Maximum outstanding is ${maxC}.` }));
      return;
    }
    try {
      setConsumeModalData((p) => ({ ...p, submitting: true, error: null }));
      await api.post(`/inventory/samples/${consumeModalData.sample.sampleId}/consume-sample/`, {
        consumeQuantity: cQty,
        remarks: consumeModalData.remarks,
      });
      setConsumeModalData({ open: false, sample: null, consumeQuantity: '', remarks: '', submitting: false, error: null });
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Failed to record sample consumption.';
      setConsumeModalData((p) => ({ ...p, error: msg, submitting: false }));
    }
  };


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
  const sampleActions = useMemo(() => ({
    onReturn: (row) => setReturnModalData({ open: true, sample: row, returnQuantity: row.outstanding || row.quantity, condition: 'Good', remarks: '', submitting: false, error: null }),
    onConsume: (row) => setConsumeModalData({ open: true, sample: row, consumeQuantity: row.outstanding || row.quantity, remarks: '', submitting: false, error: null }),
  }), []);
  const columns = config.columns(withCost, sampleActions);
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

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format) => {
    setIsExporting(true);
    setError('');
    try {
      const { page: _p, page_size: _s, ...rest } = query;
      const exportData = await inventoryService.getStockPosition(screen, { ...rest, export: '1' });
      const exportRows = (screen === 'reprocessing' && reprocessView === 'store')
        ? (exportData?.inStoreLots || inStoreLots || [])
        : (exportData?.results || rows || []);

      if (!exportRows || !exportRows.length) {
        throw new Error('No stock records to export.');
      }

      const headers = getExportColumns(screen, reprocessView, withCost);
      const dateStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      const filename = `Stock_Position_${screen}_${reprocessView !== 'store' ? '' : 'store_'}${new Date().toISOString().slice(0, 10)}`;

      const exportKpis = shownKpis.map(([key, label, kind]) => {
        const val = exportData?.kpis?.[key] ?? kpis[key] ?? 0;
        const formatted = kind === 'money' ? formatINR(val) : kind === 'count' ? String(val) : `${formatNumberIN(val)} m`;
        return { label, value: formatted };
      });

      if (format === 'csv') {
        exportStockCSV({
          screenTitle: config.title,
          filename,
          headers,
          rows: exportRows,
        });
      } else if (format === 'excel') {
        exportStockExcel({
          title: 'OSCAR TEXTILE ERP',
          screenTitle: config.title,
          filename: `${filename}.xls`,
          dateStr,
          kpis: exportKpis,
          headers,
          rows: exportRows,
        });
      } else if (format === 'pdf') {
        await exportStockPDF({
          title: 'OSCAR TEXTILE ERP',
          screenTitle: config.title,
          filename: `${filename}.pdf`,
          dateStr,
          kpis: exportKpis,
          headers,
          rows: exportRows,
          screen,
          reprocessView,
          withCost,
        });
      }
    } catch (err) {
      console.error('Export error:', err);
      setError(err?.message || 'Failed to export records.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={(
          <div className="flex gap-2">
            {screen === 'samples' ? (
              <button
                type="button"
                onClick={() => setShowIssueSampleModal(true)}
                className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 !text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={15} className="text-white" />
                <span className="text-white font-semibold">Issue sample</span>
              </button>
            ) : (
              config.headerAction && (
                <Link
                  to={config.headerAction.to}
                  className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 !text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <span className="text-white font-semibold">{config.headerAction.label}</span>
                </Link>
              )
            )}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((prev) => !prev)}
                disabled={isExporting || (!rows.length && !inStoreLots.length)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
                title="Export stock position data"
              >
                {isExporting ? (
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                ) : (
                  <Download size={14} className="text-slate-500" />
                )}
                <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                <ChevronDown size={13} className={`text-slate-400 transition-transform duration-150 ${exportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Export Format
                  </div>
                  <button
                    type="button"
                    onClick={() => { setExportMenuOpen(false); handleExport('excel'); }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800 hover:text-emerald-700">Excel Spreadsheet</div>
                      <div className="text-[10px] text-slate-400">Microsoft Excel (.xlsx / .xls)</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setExportMenuOpen(false); handleExport('pdf'); }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FileText size={15} className="text-rose-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800 hover:text-rose-700">PDF Document</div>
                      <div className="text-[10px] text-slate-400">Formatted Report (.pdf)</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setExportMenuOpen(false); handleExport('csv'); }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FileCode size={15} className="text-blue-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800 hover:text-blue-700">CSV File</div>
                      <div className="text-[10px] text-slate-400">Comma-separated values (.csv)</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
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
          <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search batch, fabric, order, customer…" className={`${inputCls} w-full pl-8`} aria-label="Search" />
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
            {godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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
              In Reprocess Store ({formatNumberIN(kpis.awaitingReprocessInStore ?? 0)} m · {inStoreLots.length} batches)
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
          emptyText="No fabric batches currently waiting in the in-house reprocess store."
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

      {/*  Redesigned Issue New Sample Modal */}
      {showIssueSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Issue New Sample to Customer</h2>
                  <p className="text-xs text-slate-500">Issue fabric sample from batch/sample stock with inventory ledger tracking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetSampleForm}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueSampleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {sampleError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="font-medium">{sampleError}</span>
                </div>
              )}

              {/* 1. Customer / Party */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Customer / Party <span className="text-rose-500">*</span></label>
                  <MasterSourceLink source="parties" />
                </div>
                <select
                  required
                  value={sampleForm.partyId}
                  onChange={(e) => setSampleForm({ ...sampleForm, partyId: e.target.value })}
                  className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                >
                  <option value="">-- Choose Customer / Party --</option>
                  {sampleParties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''} {p.city ? `· ${p.city}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* 2. Select Sample Stock / Batch Number */}
              <div ref={batchDropdownRef} className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Select Sample Stock Batch <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-medium text-slate-500">
                    {loadingBatches
                      ? 'Loading stock...'
                      : `${availableBatches.length} sample ${availableBatches.length === 1 ? 'batch' : 'batches'} in stock`}
                  </span>
                </div>

                {/* Dropdown Trigger Button with Resizable/Chevron Indicator */}
                <button
                  type="button"
                  onClick={() => setBatchDropdownOpen((prev) => !prev)}
                  className={`w-full text-left text-xs sm:text-sm border rounded-lg p-2.5 bg-white transition-all flex items-center justify-between gap-2 shadow-xs cursor-pointer ${
                    batchDropdownOpen
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : sampleForm.sourceLotTakaId
                      ? 'border-slate-300 hover:border-slate-400'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  aria-expanded={batchDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {selectedBatch ? (
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0 text-xs">
                          {selectedBatch.batchCode}
                        </span>
                        <span className="text-slate-800 font-medium truncate text-xs sm:text-sm">
                          {selectedBatch.fabricName}
                          {selectedBatch.shade ? ` (${selectedBatch.shade})` : ''}
                        </span>
                        <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                          {formatNumberIN(selectedBatch.availableQuantity)} {selectedBatch.uom} avail
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-normal">
                        {loadingBatches
                          ? 'Loading sample batches from stock...'
                          : '-- Select from Available Sample Stock Batches --'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedBatch && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBatchSelect('');
                        }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Clear batch selection"
                      >
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        batchDropdownOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Dropdown Menu Popup */}
                {batchDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          autoFocus
                          value={batchSearchTerm}
                          onChange={(e) => setBatchSearchTerm(e.target.value)}
                          placeholder="Search by batch code, fabric name, or shade..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 px-0.5 text-[11px] text-slate-500">
                        <span>
                          Showing {filteredBatches.length} of {availableBatches.length} sample stock batches
                        </span>
                        {batchSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setBatchSearchTerm('')}
                            className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Batch List */}
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {loadingBatches ? (
                        <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Loading available sample stock...</span>
                        </div>
                      ) : filteredBatches.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          {batchSearchTerm
                            ? `No sample batches match "${batchSearchTerm}"`
                            : 'No sample batches currently available in Sample Stock.'}
                        </div>
                      ) : (
                        filteredBatches.map((b) => {
                          const isSelected = sampleForm.sourceLotTakaId === b.lotTakaId;
                          return (
                            <div
                              key={b.lotTakaId}
                              onClick={() => {
                                handleBatchSelect(b.lotTakaId);
                                setBatchDropdownOpen(false);
                              }}
                              className={`p-2.5 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-mono font-bold text-xs text-slate-900">
                                    {b.batchCode}
                                  </span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    Sample Stock
                                  </span>
                                </div>
                                <div className="text-xs text-slate-600 truncate">
                                  <span className="font-medium text-slate-800">{b.fabricName}</span>
                                  {b.shade && (
                                    <span className="text-slate-500 ml-1">· Shade: {b.shade}</span>
                                  )}
                                  {b.design && (
                                    <span className="text-slate-400 ml-1">({b.design})</span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="text-xs font-extrabold text-emerald-700">
                                  {formatNumberIN(b.availableQuantity)} {b.uom}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {formatINR(b.unitCost || b.rate)} / {b.uom}
                                </div>
                              </div>

                              {isSelected && (
                                <div className="shrink-0 text-blue-600 pl-1">
                                  <Check className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Auto-filled Fabric Details Card */}
              {selectedBatch ? (
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Fabric Quality</span>
                    <span className="font-bold text-slate-800">{selectedBatch.fabricName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Shade / Design</span>
                    <span className="font-bold text-slate-800">{[selectedBatch.shade, selectedBatch.design].filter(Boolean).join(' · ') || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Available Sample Qty</span>
                    <span className="font-extrabold text-emerald-700">{formatNumberIN(selectedBatch.availableQuantity)} {selectedBatch.uom}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Location</span>
                    <span className="font-semibold text-slate-700">{selectedBatch.locationName || 'Sample Stock'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Stock Status</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${selectedBatch.isSampleStock ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                      {selectedBatch.stockType || 'Sample Stock'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Original Batch Cost</span>
                    <span className="font-bold text-slate-800">{formatINR(selectedBatch.unitCost || selectedBatch.rate)} / {selectedBatch.uom}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                  Select a batch above to auto-fill fabric, shade, unit cost and available sample quantity.
                </div>
              )}

              {/* 4. Issue Quantity & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Issue Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedBatch ? selectedBatch.availableQuantity : undefined}
                    required
                    value={sampleForm.quantity}
                    onChange={(e) => setSampleForm({ ...sampleForm, quantity: e.target.value })}
                    className={`w-full text-sm border rounded-lg p-2.5 font-bold transition-all ${
                      selectedBatch && Number(sampleForm.quantity) > selectedBatch.availableQuantity
                        ? 'border-rose-300 bg-rose-50 text-rose-700 focus:ring-rose-200'
                        : 'border-slate-200 bg-white focus:ring-blue-100 focus:border-blue-500'
                    }`}
                  />
                  {selectedBatch && Number(sampleForm.quantity) > selectedBatch.availableQuantity && (
                    <span className="text-[11px] text-rose-600 font-semibold block mt-1">
                      Exceeds available stock ({formatNumberIN(selectedBatch.availableQuantity)} {selectedBatch.uom})
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                  <select
                    value={sampleForm.uom}
                    onChange={(e) => setSampleForm({ ...sampleForm, uom: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white font-medium"
                  >
                    <option value="MTR">Meter (MTR)</option>
                    <option value="PCS">Pieces (PCS)</option>
                    <option value="YDS">Yards (YDS)</option>
                  </select>
                </div>
              </div>

              {/* 5. Unit Cost & Automatically Calculated Total Value */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Unit Cost (Rate / {sampleForm.uom})</label>
                    <button
                      type="button"
                      onClick={() => setSampleForm((p) => ({ ...p, editCostUnlocked: !p.editCostUnlocked }))}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                      title={sampleForm.editCostUnlocked ? 'Lock rate' : 'Override rate with permission'}
                    >
                      {sampleForm.editCostUnlocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{sampleForm.editCostUnlocked ? 'Lock' : 'Edit Rate'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">Rs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      readOnly={!sampleForm.editCostUnlocked}
                      value={sampleForm.unitCost}
                      onChange={(e) => setSampleForm({ ...sampleForm, unitCost: e.target.value })}
                      className={`w-full pl-8 pr-3 py-2 text-sm border rounded-lg font-mono font-semibold ${
                        sampleForm.editCostUnlocked ? 'bg-white border-blue-300 ring-1 ring-blue-100' : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                  <span className="text-[11px] font-semibold text-emerald-800 block">Total Sample Value</span>
                  <span className="text-base font-extrabold text-emerald-700 font-mono tracking-tight">
                    {formatINR(totalSampleValue)}
                  </span>
                  <span className="text-[10px] text-emerald-600 block">
                    ({sampleForm.quantity || 0} {sampleForm.uom} × Rs. {sampleForm.unitCost || 0})
                  </span>
                </div>
              </div>

              {/* 6. Sample Type & Returnable Flag */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sample Type</label>
                  <select
                    value={sampleForm.sampleType}
                    onChange={(e) => setSampleForm({ ...sampleForm, sampleType: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white font-medium"
                  >
                    <option value="CUT_PIECE">Cut Piece</option>
                    <option value="SAMPLE_FOLDER">Fabric Sample / Swatch</option>
                    <option value="FULL_TAKA">Full Taka</option>
                    <option value="HANGER">Hanger / Folder</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Returnable / Non-Returnable</label>
                  <select
                    value={sampleForm.isReturnable ? 'true' : 'false'}
                    onChange={(e) => setSampleForm({ ...sampleForm, isReturnable: e.target.value === 'true' })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white font-medium"
                  >
                    <option value="true">Returnable (Stock return expected)</option>
                    <option value="false">Non-Returnable (Direct expense)</option>
                  </select>
                </div>
              </div>

              {/* 7. Due Date (for returnable samples) */}
              {sampleForm.isReturnable && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date for Return</label>
                  <input
                    type="date"
                    value={sampleForm.dueDate}
                    onChange={(e) => setSampleForm({ ...sampleForm, dueDate: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white"
                  />
                </div>
              )}

              {/* 8. Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks &amp; Purpose</label>
                <textarea
                  rows="3"
                  value={sampleForm.remarks}
                  onChange={(e) => setSampleForm({ ...sampleForm, remarks: e.target.value })}
                  placeholder="Enter purpose, design notes, shade card references, or client meeting details..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white placeholder:text-slate-400 resize-y min-h-[60px] focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-500">
                  {selectedBatch?.isSampleStock ? 'Deducts from Sample Stock bucket' : 'Moves from Good stock with SAMPLE_ISSUE ledger entry'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetSampleForm}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sampleSubmitting || !sampleForm.partyId || !selectedBatch || Number(sampleForm.quantity) <= 0 || (selectedBatch && Number(sampleForm.quantity) > selectedBatch.availableQuantity)}
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {sampleSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{sampleSubmitting ? 'Issuing Sample...' : 'Issue Sample'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*  Return Sample Modal */}
      {returnModalData.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-emerald-50/70">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-md">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Return Sample to Stock</h3>
                  <p className="text-[11px] text-slate-500">{returnModalData.sample?.sampleNumber} · {returnModalData.sample?.batchCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalData({ open: false, sample: null, returnQuantity: '', condition: 'Good', remarks: '', submitting: false, error: null })}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSampleSubmit} className="p-4 space-y-3">
              {returnModalData.error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {returnModalData.error}
                </div>
              )}

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block">Customer</span>
                  <span className="font-semibold text-slate-800">{returnModalData.sample?.customer || returnModalData.sample?.party || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Outstanding Qty</span>
                  <span className="font-bold text-blue-700">{returnModalData.sample?.outstanding} {returnModalData.sample?.uom}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Return Quantity ({returnModalData.sample?.uom || 'MTR'}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(returnModalData.sample?.outstanding || returnModalData.sample?.quantity || 999999)}
                  required
                  value={returnModalData.returnQuantity}
                  onChange={(e) => setReturnModalData({ ...returnModalData, returnQuantity: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 font-bold focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Return Condition</label>
                <select
                  value={returnModalData.condition}
                  onChange={(e) => setReturnModalData({ ...returnModalData, condition: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white"
                >
                  <option value="Good">Good (Restore to Sample Stock)</option>
                  <option value="Reject">Damaged (Route to Reject / Scrap)</option>
                  <option value="Hold">Under Review (Route to QC Hold)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Return Remarks</label>
                <input
                  type="text"
                  value={returnModalData.remarks}
                  onChange={(e) => setReturnModalData({ ...returnModalData, remarks: e.target.value })}
                  placeholder="Return condition, notes..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnModalData({ open: false, sample: null, returnQuantity: '', condition: 'Good', remarks: '', submitting: false, error: null })}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnModalData.submitting || !Number(returnModalData.returnQuantity) || Number(returnModalData.returnQuantity) > Number(returnModalData.sample?.outstanding || 0)}
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {returnModalData.submitting ? 'Returning...' : 'Accept Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*  Consume Sample Modal */}
      {consumeModalData.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-200 text-slate-800 rounded-md">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Mark Sample as Consumed</h3>
                  <p className="text-[11px] text-slate-500">{consumeModalData.sample?.sampleNumber} · Expense write-off</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConsumeModalData({ open: false, sample: null, consumeQuantity: '', remarks: '', submitting: false, error: null })}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConsumeSampleSubmit} className="p-4 space-y-3">
              {consumeModalData.error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {consumeModalData.error}
                </div>
              )}

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block">Customer</span>
                  <span className="font-semibold text-slate-800">{consumeModalData.sample?.customer || consumeModalData.sample?.party || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Outstanding Qty</span>
                  <span className="font-bold text-slate-700">{consumeModalData.sample?.outstanding} {consumeModalData.sample?.uom}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Consume Quantity ({consumeModalData.sample?.uom || 'MTR'}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(consumeModalData.sample?.outstanding || consumeModalData.sample?.quantity || 999999)}
                  required
                  value={consumeModalData.consumeQuantity}
                  onChange={(e) => setConsumeModalData({ ...consumeModalData, consumeQuantity: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 font-bold focus:ring-1 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  value={consumeModalData.remarks}
                  onChange={(e) => setConsumeModalData({ ...consumeModalData, remarks: e.target.value })}
                  placeholder="Customer retained sample / cut for shade card..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                Marks fabric as consumed and posts accounting entry to Sample Expense ledger account.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConsumeModalData({ open: false, sample: null, consumeQuantity: '', remarks: '', submitting: false, error: null })}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consumeModalData.submitting || !Number(consumeModalData.consumeQuantity) || Number(consumeModalData.consumeQuantity) > Number(consumeModalData.sample?.outstanding || 0)}
                  className="px-4 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {consumeModalData.submitting ? 'Processing...' : 'Confirm Consumption'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
