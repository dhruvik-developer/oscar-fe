import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Printer, ScanLine, IndianRupee, Eye, SlidersHorizontal, X, Plus, Users, Layers, PackageOpen,
  Boxes, CheckCircle2, Bookmark, ClipboardCheck, RefreshCcw, XCircle, Truck, UserRound, ShoppingCart,
  Factory, GitMerge, PenLine, ArrowLeft, ShieldCheck, History, Wallet, ExternalLink, PackageCheck,
  AlertCircle, Droplets, ChevronRight, Package, FileText, Ban, Receipt, Check,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import AppPagination from '../../../components/ui/AppPagination';
import KpiCard from '../../../components/ui/KpiCard';
import { inventoryService } from '../../../services/domainServices';
import { formatINR, formatNumberIN, describeApiError } from '../../accounts/accountingShared';
import { printBatchTags } from './printBatchTag';
import BatchChargeModal from './BatchChargeModal';
import { CustomerReceiptModal, PhysicalStockSummary } from './CustomerMaterialPanels';
import AddBatchModal, { useTextileMasters } from './AddBatchModal';
import { useERP } from '../../../context/ERPContext';
import { GoodsReceiptInlineSlide } from '../../purchase/GoodsReceiptInlineSlide';
import { SupplierDeliveryInlineSlide } from '../../purchase/SupplierDeliveryInlineSlide';
import { GreyQcInlineSlide } from '../../purchase/GreyQcInlineSlide';
import { VendorBillInlineSlide } from '../../purchase/VendorBillInlineSlide';
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
const BLANK = {
  q: '', origin: '', fabricType: '', status: '', qcStatus: '', poId: '',
  poStatus: '', receiptStatus: '', billStatus: '', vendorId: '',
  from: '', to: '', itemId: '', designId: '', shadeId: '', locationId: '',
  holding: '', vendorQ: '',
};
const inputCls = 'h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500';
const ghostBtn = 'h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer';
const QC_STATUSES = ['Passed', 'Pending', 'On Hold', 'Reprocess', 'Rejected', 'Not Inspected'];
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
  onViewBatches,
  onOpenBatch,
  onReceiveGoods,
  onMatchBill,
  onPerformQc,
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
  const qcPendingQty = group.qcPendingQty !== undefined
    ? Number(group.qcPendingQty)
    : batches.reduce((sum, b) => sum + (['Pending', 'QC Hold', 'Mixed', 'Not Inspected'].includes(b.qcStatus) ? Number(b.batchQty || 0) : 0), 0);

  const qcAcceptedQty = (group.qcPassedQty !== undefined || group.qcAcceptedQty !== undefined)
    ? Number(group.qcPassedQty || group.qcAcceptedQty)
    : batches.reduce((sum, b) => sum + (b.qcStatus === 'Passed' ? Number(b.availableQty || b.batchQty || 0) : 0), 0);

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
    <section className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs transition-shadow hover:shadow-xs">
      <div className="p-4 space-y-3">
        {/* Main PO Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
              className="grid place-items-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer font-bold text-base transition-colors"
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

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {isPo && (
              <>
                {onReceiveGoods && (
                  <button
                    type="button"
                    onClick={onReceiveGoods}
                    className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  >
                    <PackageCheck size={14} /> + Receive Goods
                  </button>
                )}
                {onPerformQc && qcPendingQty > 0 && (
                  <button
                    type="button"
                    onClick={onPerformQc}
                    className="h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-800 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ShieldCheck size={13} /> QC Pending ({formatNumberIN(qcPendingQty)})
                  </button>
                )}
                {onMatchBill && (
                  <button
                    type="button"
                    onClick={onMatchBill}
                    className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Receipt size={13} className="text-slate-500" /> Match Bill
                  </button>
                )}
                <button
                  type="button"
                  onClick={onViewBatches}
                  className={ghostBtn}
                >
                  View Batches
                </button>
                <button
                  type="button"
                  onClick={onOpenPo}
                  className={ghostBtn}
                >
                  Open PO
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quantity Metrics Ribbon */}
        {isPo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">Ordered</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatNumberIN(orderedQty)} {uom}</span>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">Received</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatNumberIN(receivedQty)} {uom}</span>
            </div>
            <div className={`rounded-lg p-2 border ${remainingQty > 0 ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100 text-slate-900'}`}>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">Remaining</span>
              <span className="font-bold tabular-nums">{formatNumberIN(remainingQty)} {uom}</span>
            </div>
            <div className={`rounded-lg p-2 border ${qcPendingQty > 0 ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100 text-slate-900'}`}>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">QC Pending</span>
              <span className="font-bold tabular-nums">{formatNumberIN(qcPendingQty)} {uom}</span>
            </div>
            <div className="rounded-lg bg-emerald-50/60 p-2 border border-emerald-100">
              <span className="text-[10px] font-semibold uppercase text-emerald-700 block">QC Accepted</span>
              <span className="font-bold text-emerald-800 tabular-nums">{formatNumberIN(qcAcceptedQty)} {uom}</span>
            </div>
            <div className="rounded-lg bg-emerald-50/80 p-2 border border-emerald-200">
              <span className="text-[10px] font-semibold uppercase text-emerald-800 block">Available Stock</span>
              <span className="font-bold text-emerald-900 tabular-nums">{formatNumberIN(availableQty)} {uom}</span>
            </div>
            <div className="rounded-lg bg-blue-50/60 p-2 border border-blue-100">
              <span className="text-[10px] font-semibold uppercase text-blue-700 block">Batches</span>
              <span className="font-bold text-blue-900 tabular-nums">{batches.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Child Batch Rows Table */}
      {expanded && (
        <div className="overflow-x-auto border-t border-slate-200 bg-slate-50/40">
          <table className="w-full min-w-[920px] text-xs">
            <thead className="bg-slate-100/80 text-[10px] uppercase tracking-wide text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left">Batch No.</th>
                <th className="px-4 py-2.5 text-left">Receipt / GRN</th>
                <th className="px-4 py-2.5 text-left">Receipt Date</th>
                <th className="px-4 py-2.5 text-right">Received Qty</th>
                <th className="px-4 py-2.5 text-left">QC Status</th>
                <th className="px-4 py-2.5 text-right">Accepted</th>
                <th className="px-4 py-2.5 text-right">Rejected</th>
                <th className="px-4 py-2.5 text-left">Stock Status</th>
                <th className="px-4 py-2.5 text-left">Location</th>
                <th className="px-4 py-2.5 text-left">Dispatch</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {batches.map((batch) => {
                const bReceiptDate = batch.receiptDate || batch.createdAt
                  ? new Date(batch.receiptDate || batch.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—';
                const bRejectedQty = Number(batch.rejectedQty || batch.quantities?.rejected || 0);
                const bAcceptedQty = Number(batch.availableQty || (batch.qcStatus === 'Passed' ? batch.batchQty : 0));
                const bLocation = batch.locationName || batch.godown || 'Main Godown';
                const bDispatchStatus = batch.dispatchStatus || (
                  batch.status === 'Sold Out' ? 'Dispatched' :
                  (Number(batch.quantities?.reserved || 0) > 0 ? 'Reserved' : 'In Godown')
                );

                return (
                  <tr key={batch.id || batch.batchCode} onClick={() => onOpenBatch(batch.batchCode)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-blue-700 hover:underline">{batch.batchCode}</span>
                      <div className="text-[10px] text-slate-500 mt-0.5">{batch.item || '—'} · {batch.fabricType === 'DYED' ? 'Dyed' : 'Grey'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                      {(batch.receiptNumbers || []).join(', ') || batch.sourceDocumentNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{bReceiptDate}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                      {formatNumberIN(batch.batchQty)} {batch.uom || uom}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        batch.qcStatus === 'Passed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        batch.qcStatus === 'Pending' || batch.qcStatus === 'QC Hold' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        batch.qcStatus === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {batch.qcStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">
                      {formatNumberIN(bAcceptedQty)} {batch.uom || uom}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                      {bRejectedQty > 0 ? `${formatNumberIN(bRejectedQty)} ${batch.uom || uom}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLE[batch.status] || STATUS_STYLE.Closed}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[batch.status] || STATUS_DOT.Closed}`} />
                        {batch.status || 'In Stock'}
                      </span>
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
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onOpenBatch(batch.batchCode)}
                        className="px-2 py-1 rounded border border-slate-200 text-blue-700 hover:bg-blue-50 font-semibold cursor-pointer text-xs"
                      >
                        Batch 360°
                      </button>
                    </td>
                  </tr>
                );
              })}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    {isPo ? 'No batches have been created for this PO yet. Click "+ Receive Goods" to inward fabric.' : 'No batches in this group.'}
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

/** Cost Breakdown and Expense Management Section for PO */
function PoCostsPanel({ flowData, poId, onAllocate, allocating, onAddExpense, formatCurrency }) {
  const [expenseForm, setExpenseForm] = useState(null);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const costs = flowData?.costs || {};
  const expenses = flowData?.expenses || [];
  const yarnLines = flowData?.yarnLines || [];
  const money = (v) => formatINR(v);

  // Compute yarn costs from planned PO yarn lines or booked expenses
  const yarnLinesTotal = yarnLines.reduce((sum, y) => {
    const amt = y.amount != null ? Number(y.amount) : (Number(y.requiredQty || 0) * Number(y.rate || 0));
    return sum + (Number.isFinite(amt) ? amt : 0);
  }, 0);
  const yarnExpense = Number(costs.yarnExpense || 0);
  const yarnCostNum = Number(costs.yarn || 0);
  const yarnAmount = yarnCostNum > 0 ? yarnCostNum : (yarnLinesTotal > 0 ? yarnLinesTotal : 0);
  const hasYarn = costs.hasYarnDetails ?? (yarnLines.length > 0 || yarnExpense > 0);
  const yarnSubtitle = yarnAmount > 0
    ? (yarnExpense > 0 ? 'Booked expense' : (yarnLines.length > 0 ? `${yarnLines.length} yarn line${yarnLines.length > 1 ? 's' : ''} planned` : 'Planned yarn cost'))
    : (hasYarn ? 'Zero rate recorded' : 'No yarn details recorded');

  const mfgCharges = Number(costs.manufacturingCharges || 0);

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setSubmittingExpense(true);
    try {
      await onAddExpense(expenseForm);
      setExpenseForm(null);
    } finally {
      setSubmittingExpense(false);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Landed Cost Breakdown &amp; Expenses
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Cost allocation distributes fabric value, manufacturing, yarn, dyeing, and freight to batch lot cost entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!expenseForm && (
            <button
              type="button"
              onClick={() => setExpenseForm({
                category: 'MANUFACTURING',
                expenseType: 'Manufacturing charges',
                amount: '',
                expenseDate: new Date().toISOString().slice(0, 10),
                billReference: '',
                status: 'ACTUAL',
                allocationBasis: 'QUANTITY',
                remarks: '',
              })}
              className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus size={13} /> Add Expense
            </button>
          )}
          {Number(costs.unallocated || 0) > 0 && (
            <button
              type="button"
              disabled={allocating}
              onClick={onAllocate}
              className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <Layers size={13} /> {allocating ? 'Allocating...' : 'Allocate Costs to Batches'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        <div className="rounded-lg bg-white border border-slate-200 p-2.5">
          <span className="block text-[10px] uppercase font-bold text-slate-400">Order Value</span>
          <strong className="text-slate-900 text-sm">{money(costs.orderValue || 0)}</strong>
          <span className="block text-[10px] text-slate-400 mt-0.5">PO Total (contracted)</span>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-2.5">
          <span className="block text-[10px] uppercase font-bold text-slate-400">Fabric Received</span>
          <strong className="text-slate-900 text-sm">{money(costs.fabricReceivedValue || 0)}</strong>
          <span className="block text-[10px] text-slate-400 mt-0.5">GRN intake value</span>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-2.5">
          <div className="flex items-center justify-between">
            <span className="block text-[10px] uppercase font-bold text-slate-400">Manufacturing</span>
            {mfgCharges > 0 && (
              <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1 rounded">Direct</span>
            )}
          </div>
          <strong className="text-slate-900 text-sm">
            {mfgCharges > 0 ? money(mfgCharges) : '—'}
          </strong>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {mfgCharges > 0 ? 'Production charges' : 'Included in fabric rate'}
          </span>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-2.5">
          <div className="flex items-center justify-between">
            <span className="block text-[10px] uppercase font-bold text-slate-400">Yarn Cost</span>
            {hasYarn && (
              <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-1 rounded">PO Plan</span>
            )}
          </div>
          <strong className="text-slate-900 text-sm">
            {yarnAmount > 0 ? money(yarnAmount) : (hasYarn ? money(0) : '—')}
          </strong>
          <span className="block text-[10px] text-slate-400 mt-0.5 truncate" title={yarnSubtitle}>
            {yarnSubtitle}
          </span>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-2.5">
          <span className="block text-[10px] uppercase font-bold text-slate-400">Dyeing Charges</span>
          <strong className="text-slate-900 text-sm">
            {Number(costs.dyeing || 0) > 0 ? money(costs.dyeing) : '—'}
          </strong>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {Number(costs.dyeing || 0) > 0 ? 'Mill processing charges' : (flowData?.fabricFlow === 'FACTORY_TO_MILL' ? 'Pending mill invoice' : 'Not applicable (Flow A)')}
          </span>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-2.5">
          <span className="block text-[10px] uppercase font-bold text-slate-400">Freight &amp; Other</span>
          <strong className="text-slate-900 text-sm">
            {(Number(costs.freight || 0) + Number(costs.other || 0)) > 0
              ? money(Number(costs.freight || 0) + Number(costs.other || 0))
              : '—'}
          </strong>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {(Number(costs.freight || 0) + Number(costs.other || 0)) > 0 ? 'Direct transport & misc' : 'No freight recorded'}
          </span>
        </div>
      </div>

      {/* Planned Yarn Specification Details from PO (if present) */}
      {yarnLines.length > 0 && (
        <div className="overflow-x-auto border border-blue-200 rounded-xl bg-blue-50/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-[11.5px] font-bold text-blue-900 flex items-center gap-1.5">
              <span>Planned Yarn Specification (from PO)</span>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                {yarnLines.length} Quality Line{yarnLines.length > 1 ? 's' : ''}
              </span>
            </h5>
            <span className="text-xs font-mono font-bold text-blue-950">
              Total Yarn Plan: {money(yarnAmount)}
            </span>
          </div>
          <table className="w-full text-xs bg-white rounded-lg border border-blue-100 overflow-hidden">
            <thead className="bg-blue-50 text-[10px] uppercase font-bold text-blue-800 border-b border-blue-100">
              <tr>
                <th className="px-3 py-1.5 text-left">Yarn Quality</th>
                <th className="px-3 py-1.5 text-left">Supplier / Lot</th>
                <th className="px-3 py-1.5 text-right">Required Qty</th>
                <th className="px-3 py-1.5 text-right">Rate</th>
                <th className="px-3 py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {yarnLines.map((yl, idx) => (
                <tr key={yl.id || idx} className="hover:bg-blue-50/30">
                  <td className="px-3 py-1.5 font-semibold text-slate-800">{yl.yarnQuality || yl.item || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-600">
                    {yl.supplierName ? `${yl.supplierName}${yl.yarnLot ? ` (Lot: ${yl.yarnLot})` : ''}` : (yl.yarnLot ? `Lot: ${yl.yarnLot}` : '—')}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-700">{yl.requiredQty} {yl.uom || 'Kg'}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-700">{money(yl.rate)} / {yl.uom || 'Kg'}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900">{money(yl.amount != null ? yl.amount : (Number(yl.requiredQty || 0) * Number(yl.rate || 0)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expenseForm && (
        <form onSubmit={handleExpenseSubmit} className="p-3 bg-white rounded-xl border border-blue-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h5 className="text-xs font-bold text-blue-900">Add PO Expense / Direct Charge</h5>
            <button type="button" onClick={() => setExpenseForm(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">Category *</label>
              <select
                required
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="w-full h-8 px-2 border border-slate-300 rounded-lg text-xs"
              >
                <option value="MANUFACTURING">Manufacturing Charges</option>
                <option value="YARN">Yarn / Raw Material</option>
                <option value="DYEING">Dyeing / Mill Processing</option>
                <option value="FREIGHT">Freight / Transport</option>
                <option value="OTHER">Other Direct</option>
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">Expense Type</label>
              <input
                value={expenseForm.expenseType}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseType: e.target.value })}
                placeholder="e.g. Weaving charges"
                className="w-full h-8 px-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="0.00"
                className="w-full h-8 px-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">Expense Date *</label>
              <input
                type="date"
                required
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                className="w-full h-8 px-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">Bill / Reference</label>
              <input
                value={expenseForm.billReference}
                onChange={(e) => setExpenseForm({ ...expenseForm, billReference: e.target.value })}
                placeholder="Challan / Bill #"
                className="w-full h-8 px-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="col-span-1 sm:col-span-3">
              <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">Remarks</label>
              <input
                value={expenseForm.remarks}
                onChange={(e) => setExpenseForm({ ...expenseForm, remarks: e.target.value })}
                placeholder="Optional description"
                className="w-full h-8 px-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setExpenseForm(null)} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button type="submit" disabled={submittingExpense} className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white cursor-pointer disabled:opacity-50">
              {submittingExpense ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      )}

      {expenses.length > 0 ? (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Type / Description</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Reference</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Allocated</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp, i) => (
                <tr key={exp.id || i} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 font-semibold text-slate-800">{exp.category}</td>
                  <td className="px-3 py-2 text-slate-600">{exp.expenseType || exp.description || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{exp.expenseDate}</td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">{exp.billReference || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900">{money(exp.amount)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{money(exp.allocatedAmount || 0)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${exp.status === 'ACTUAL' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {exp.status || 'ACTUAL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic text-center py-3 bg-white rounded-xl border border-slate-200">
          No expenses recorded for this purchase order yet.
        </p>
      )}
    </div>
  );
}

/** PO Movement History & Traceability Timeline */
function PoMovementHistoryPanel({ flowData, selectedPoGroup }) {
  const dispatches = flowData?.dispatches || [];
  const millProcesses = flowData?.millProcesses || [];
  const receipts = flowData?.receipts || [];
  const flowB = flowData?.fabricFlow === 'FACTORY_TO_MILL';
  const batches = selectedPoGroup?.batches || [];

  return (
    <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
      <div className="border-b border-slate-200 pb-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
          Purchase Order Movement &amp; Traceability Timeline
        </h4>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Chronological audit trail from factory dispatch, through processing, warehouse arrival, and QC batch inward.
        </p>
      </div>

      <div className="relative pl-6 border-l-2 border-blue-200 space-y-6">
        {/* Step 1: PO */}
        <div className="relative">
          <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 flex items-center justify-center text-white text-[9px]">1</span>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-blue-700">Order Origin</span>
            <h5 className="font-bold text-slate-900 mt-0.5">{selectedPoGroup?.poNumber}</h5>
            <p className="text-slate-600 mt-1">
              Ordered <strong>{selectedPoGroup?.orderedQty} {selectedPoGroup?.uom || 'm'}</strong> from factory <strong>{selectedPoGroup?.vendorName}</strong>.
            </p>
          </div>
        </div>

        {/* Step 2: Supplier Dispatches */}
        <div className="relative">
          <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-indigo-100 flex items-center justify-center text-white text-[9px]">2</span>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-indigo-700">Factory Dispatches ({dispatches.length})</span>
            {dispatches.length > 0 ? (
              <div className="mt-2 space-y-2">
                {dispatches.map((d, i) => (
                  <div key={d.id || i} className="p-2 rounded bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong className="text-slate-800">{d.deliveryNumber || `Dispatch #${i + 1}`}</strong>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="text-slate-600">Qty: <strong>{d.dispatchedQty}</strong></span>
                      {d.challanNo && <span className="ml-2 font-mono text-[11px] text-slate-500">Challan: {d.challanNo}</span>}
                    </div>
                    <span className="text-slate-500">{d.dispatchDate || 'Date not recorded'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic mt-1">No supplier dispatches recorded yet.</p>
            )}
          </div>
        </div>

        {/* Step 3: Mill Processing (Flow B) */}
        {flowB && (
          <div className="relative">
            <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-violet-600 ring-4 ring-violet-100 flex items-center justify-center text-white text-[9px]">3</span>
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-violet-700">Dyeing Mill Processing ({millProcesses.length})</span>
              {millProcesses.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {millProcesses.map((m, i) => (
                    <div key={m.id || i} className="p-2 rounded bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong className="text-slate-800">{m.millName}</strong>: {m.processType || 'Dyeing'} {m.shade && `(${m.shade})`}
                        <span className="mx-2 text-slate-300">·</span>
                        <span>Processed: <strong>{m.processedQty}</strong></span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span>Sent to OSCAR: <strong>{m.millDispatchedQty}</strong></span>
                      </div>
                      <span className="text-slate-500">{m.millReceiptDate}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic mt-1">No mill processing recorded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Goods Receipts at OSCAR */}
        <div className="relative">
          <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-sky-600 ring-4 ring-sky-100 flex items-center justify-center text-white text-[9px]">{flowB ? 4 : 3}</span>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-sky-700">Warehouse Receipts at OSCAR ({receipts.length})</span>
            {receipts.length > 0 ? (
              <div className="mt-2 space-y-2">
                {receipts.map((r, i) => (
                  <div key={r.id || i} className="p-2 rounded bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong className="font-mono text-blue-700">{r.grnNumber}</strong>
                      <span className="mx-2 text-slate-300">·</span>
                      <span>Received: <strong>{r.receivedQty} {r.uom || 'm'}</strong></span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="font-mono text-emerald-700">{r.batchCode}</span>
                    </div>
                    <span className="text-slate-500">{r.receiptDate}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic mt-1">No warehouse receipts recorded yet.</p>
            )}
          </div>
        </div>

        {/* Step 5: Batches & QC Inward */}
        <div className="relative">
          <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-600 ring-4 ring-emerald-100 flex items-center justify-center text-white text-[9px]">{flowB ? 5 : 4}</span>
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-emerald-700">Batches &amp; QC Stock ({batches.length})</span>
            {batches.length > 0 ? (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {batches.map((b) => (
                  <div key={b.id} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-blue-700">{b.batchCode}</span>
                      <div className="text-[10px] text-slate-500 mt-0.5">QC: {b.qcStatus} · Available: {b.availableQty} {b.uom}</div>
                    </div>
                    <Link to={`/inventory/batches/${encodeURIComponent(b.batchCode)}`} className="text-xs text-blue-600 hover:underline font-semibold">
                      Batch 360° &rarr;
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic mt-1">No batches inwarded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Batch Registry: every permanent batch ID with its live quantities. */
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

  // PO Hub states
  const [activePoSlide, setActivePoSlide] = useState(null); // 'receive_goods' | 'perform_qc' | 'dispatch' | 'costs' | 'movement'
  const [poDetails, setPoDetails] = useState(null);
  const [flowData, setFlowData] = useState(null);
  const [loadingFlow, setLoadingFlow] = useState(false);
  const [allocatingCost, setAllocatingCost] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { poId, action }

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
        setExpandedGroups((current) => Object.fromEntries(groups.map((group) => [group.key, current[group.key] ?? true])));
      }
    } catch (err) {
      setError(describeApiError(err) || 'Batch Registry could not be loaded.');
      setData({ results: [], groups: [], count: 0, batchCount: 0 });
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, withCost, showAwaitingQc, view]);
  useEffect(() => { load(); }, [load]);

  // Filters apply as they change; typing in search waits a moment.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(filters); setPage(1); }, filters.q !== query.q ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const poParam = searchParams.get('po') || searchParams.get('poId') || searchParams.get('poNumber') || '';
    if (poParam && poParam !== filters.poId) {
      setView('po');
      setFilters((prev) => ({ ...prev, poId: poParam }));
      setQuery((prev) => ({ ...prev, poId: poParam }));
      setPage(1);
    }
  }, [searchParams, filters.poId]);

  const setF = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === 'poId') {
      const next = new URLSearchParams(searchParams);
      if (value) {
        next.set('po', value);
      } else {
        next.delete('po');
        next.delete('poId');
        next.delete('poNumber');
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

  const viewBatchesForPo = (poId) => {
    setView('po');
    setF('poId', poId);
    setPage(1);
  };

  // A barcode/QR scanner types the code and presses Enter
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

  // Real KPI summary metrics
  const pendingReceiptVal = useMemo(() => {
    if (s?.pendingReceipt !== undefined && s?.pendingReceipt !== null) return Number(s.pendingReceipt);
    return (data.groups || [])
      .filter((g) => g.type === 'po')
      .reduce((acc, g) => acc + Math.max(0, Number(g.remainingQty || 0)), 0);
  }, [s?.pendingReceipt, data.groups]);

  const qcPendingVal = useMemo(() => {
    if (s?.qcHold !== undefined && s?.qcHold !== null) return Number(s.qcHold);
    return (data.groups || []).reduce((acc, g) => {
      return acc + (g.batches || []).reduce((bAcc, b) => {
        return bAcc + (['Pending', 'QC Hold', 'Mixed', 'Not Inspected'].includes(b.qcStatus) ? Number(b.batchQty || 0) : 0);
      }, 0);
    }, 0);
  }, [s?.qcHold, data.groups]);

  const availableStockVal = useMemo(() => {
    if (s?.available !== undefined && s?.available !== null) return Number(s.available);
    return (data.groups || []).reduce((acc, g) => {
      return acc + (g.batches || []).reduce((bAcc, b) => bAcc + Number(b.availableQty || 0), 0);
    }, 0);
  }, [s?.available, data.groups]);

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
      setActivePoSlide(null);
    }
  }, [selectedPoGroup?.poId, reloadPoDetails]);

  // When a pending action is set and the selected PO group has loaded, trigger the slide
  useEffect(() => {
    if (pendingAction && selectedPoGroup && String(selectedPoGroup.poId) === String(pendingAction.poId)) {
      setActivePoSlide(pendingAction.action);
      setPendingAction(null);
    }
  }, [pendingAction, selectedPoGroup]);

  // Refresh everything after an action (GRN, QC, Delivery) saves
  const handleActionSaved = useCallback(async () => {
    await load();
    if (selectedPoGroup?.poId) {
      await reloadPoDetails(selectedPoGroup.poId);
    }
  }, [load, selectedPoGroup?.poId, reloadPoDetails]);

  // Allocate costs action
  const handleAllocateCosts = async () => {
    if (!selectedPoGroup?.poId) return;
    setAllocatingCost(true);
    try {
      await api.post(`/purchase/orders/${selectedPoGroup.poId}/fabric-flow/allocate-costs/`);
      setNotice('Costs allocated to batches successfully.');
      await handleActionSaved();
    } catch (err) {
      setError(describeApiError(err) || 'Failed to allocate costs.');
    } finally {
      setAllocatingCost(false);
    }
  };

  // Add expense action
  const handleAddExpense = async (body) => {
    if (!selectedPoGroup?.poId) return;
    try {
      await api.post(`/purchase/orders/${selectedPoGroup.poId}/fabric-flow/expenses/`, body);
      setNotice('Expense recorded successfully.');
      await handleActionSaved();
    } catch (err) {
      setError(describeApiError(err) || 'Failed to record expense.');
    }
  };

  // Effective PO object to pass to action slides
  const effectivePo = useMemo(() => {
    if (poDetails) {
      return {
        ...poDetails,
        items: poDetails.lineItems || poDetails.items || [],
        lineItems: poDetails.lineItems || poDetails.items || [],
        vendor: poDetails.partyName || poDetails.vendorName || selectedPoGroup?.vendorName || '',
        vendorId: poDetails.vendorId || poDetails.partyId || '',
      };
    }
    if (!selectedPoGroup) return null;
    return {
      id: selectedPoGroup.poId,
      poNumber: selectedPoGroup.poNumber,
      vendorId: '',
      vendor: selectedPoGroup.vendorName,
      partyName: selectedPoGroup.vendorName,
      status: selectedPoGroup.status,
      fabricFlow: selectedPoGroup.fabricFlow,
      items: (selectedPoGroup.fabricNames || []).map((name, i) => ({
        id: `line-${i + 1}`,
        itemId: '',
        itemName: name,
        name,
        qty: Number(selectedPoGroup.remainingQty || selectedPoGroup.orderedQty || 0),
        rate: 0,
        uom: selectedPoGroup.uom || 'MTR',
      })),
      lineItems: (selectedPoGroup.fabricNames || []).map((name, i) => ({
        id: `line-${i + 1}`,
        itemId: '',
        itemName: name,
        name,
        qty: Number(selectedPoGroup.remainingQty || selectedPoGroup.orderedQty || 0),
        rate: 0,
        uom: selectedPoGroup.uom || 'MTR',
      })),
    };
  }, [poDetails, selectedPoGroup]);

  // Context-sensitive status calculations
  const poStatus = selectedPoGroup?.status || poDetails?.status || '';
  const canReceive = ['Approved', 'Issued', 'Partially Received', 'Fully Received'].includes(poStatus);
  const isDraftOrPending = ['Draft', 'Pending Approval'].includes(poStatus);
  const qcPendingMetres = Number(selectedPoGroup?.qcPendingQty || flowData?.quantities?.awaitingQc || 0);
  const hasPendingQc = qcPendingMetres > 0 || (selectedPoGroup?.batches || []).some((b) => ['QC Hold', 'Pending', 'Mixed', 'Not Inspected'].includes(b.qcStatus));
  const hasBatches = (selectedPoGroup?.batches || []).length > 0;

  return (
    <div className="space-y-4">
      {/* Back to Purchase Orders Bar when viewing a specific PO */}
      {selectedPoGroup && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/purchase/orders')}
              className="h-8 px-3 rounded-lg bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              title="Return to Purchase Orders list"
            >
              <ArrowLeft size={14} className="text-blue-600" /> Back to Purchase Orders
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-700 font-medium">
              Managing operations &amp; batches for: <strong className="font-mono text-slate-900">{selectedPoGroup.poNumber}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setF('poId', ''); setSearchParams({}); }}
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
          : "Every grey and dyed fabric batch — its ID, QR tag, where its metres are now and its status. Click a batch for its Batch 360° view."}
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
              <button
                type="button"
                onClick={() => navigate(`/purchase/orders?po=${encodeURIComponent(selectedPoGroup.poId)}`)}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="View full Purchase Order document"
              >
                <ExternalLink size={13} className="text-slate-500" /> Open Full PO
              </button>
            </div>
          </div>

          {/* 6 Backend KPI Metric Tiles */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ['Ordered Quantity', selectedPoGroup.orderedQty, 'text-slate-900', 'bg-slate-50'],
              ['Received at OSCAR', selectedPoGroup.receivedQty, 'text-slate-900', 'bg-slate-50'],
              ['Remaining to Receive', selectedPoGroup.remainingQty, Number(selectedPoGroup.remainingQty || 0) > 0 ? 'text-amber-800' : 'text-slate-900', Number(selectedPoGroup.remainingQty || 0) > 0 ? 'bg-amber-50/50 border border-amber-200/60' : 'bg-slate-50'],
              ['Linked Batches', selectedPoGroup.batches?.length || selectedPoGroup.batchCount || 0, 'text-blue-700', 'bg-blue-50/50 border border-blue-200/60'],
              ['QC Pending Quantity', selectedPoGroup.qcPendingQty, qcPendingMetres > 0 ? 'text-amber-700' : 'text-slate-700', qcPendingMetres > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'],
              ['QC Passed Quantity', selectedPoGroup.qcPassedQty, 'text-emerald-700', 'bg-emerald-50 border border-emerald-200'],
            ].map(([label, value, txtCls, bgCls]) => (
              <div key={label} className={`rounded-xl p-3 ${bgCls}`}>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
                <dd className={`mt-1 text-base font-extrabold tabular-nums ${txtCls}`}>
                  {label === 'Linked Batches' ? value : `${formatNumberIN(value)} ${selectedPoGroup.uom || 'm'}`}
                </dd>
              </div>
            ))}
          </dl>

          {/* Context-Sensitive Operations Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {/* 1. Receive Goods (GRN) */}
            <button
              type="button"
              disabled={!canReceive}
              onClick={() => setActivePoSlide(activePoSlide === 'receive_goods' ? null : 'receive_goods')}
              className={`h-9 px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                activePoSlide === 'receive_goods'
                  ? 'bg-blue-700 text-white ring-2 ring-blue-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={!canReceive ? (isDraftOrPending ? 'Submit and approve the PO before recording goods receipts' : 'Receipts not allowed for this PO status') : 'Record inward delivery: GRN, Roll/Taka breakdown & automatic batch opening'}
            >
              <PackageCheck size={14} /> Receive Goods (GRN)
            </button>

            {/* 2. Perform QC */}
            <button
              type="button"
              disabled={!hasPendingQc}
              onClick={() => setActivePoSlide(activePoSlide === 'perform_qc' ? null : 'perform_qc')}
              className={`h-9 px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                activePoSlide === 'perform_qc'
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-300'
                  : hasPendingQc
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
              title={!hasPendingQc ? 'No receipts or fabric currently awaiting QC inspection' : 'Inspect rolls, accept/reject, and transition accepted fabric to available stock'}
            >
              <ShieldCheck size={14} /> Perform QC
              {qcPendingMetres > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-900 text-[10px] font-bold">
                  {formatNumberIN(qcPendingMetres)} {selectedPoGroup.uom || 'm'}
                </span>
              )}
            </button>

            {/* 3. Supplier Dispatch */}
            <button
              type="button"
              onClick={() => setActivePoSlide(activePoSlide === 'dispatch' ? null : 'dispatch')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                activePoSlide === 'dispatch'
                  ? 'bg-indigo-700 text-white ring-2 ring-indigo-300'
                  : 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
              }`}
              title="Record or track supplier delivery challan, vehicle, transporter and in-transit dispatch"
            >
              <Truck size={14} /> Supplier Dispatch
            </button>

            {/* 4. Costs & Expenses */}
            <button
              type="button"
              onClick={() => setActivePoSlide(activePoSlide === 'costs' ? null : 'costs')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                activePoSlide === 'costs'
                  ? 'bg-violet-700 text-white ring-2 ring-violet-300'
                  : 'bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100'
              }`}
              title="View fabric, manufacturing, yarn, dyeing, and freight costs, and allocate landed expenses to batches"
            >
              <Wallet size={14} /> View Costs
            </button>

            {/* 5. Movement History */}
            <button
              type="button"
              onClick={() => setActivePoSlide(activePoSlide === 'movement' ? null : 'movement')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                activePoSlide === 'movement'
                  ? 'bg-slate-800 text-white ring-2 ring-slate-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="View full end-to-end movement audit trail for this PO and its batches"
            >
              <History size={14} /> Movement History
            </button>

            {/* 6. Match Bill */}
            <button
              type="button"
              onClick={() => setActivePoSlide(activePoSlide === 'match_bill' ? null : 'match_bill')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                activePoSlide === 'match_bill'
                  ? 'bg-amber-700 text-white ring-2 ring-amber-300'
                  : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
              }`}
              title="3-Way PO Bill Matching: check billed vs received quantities, rates, and approval"
            >
              <Receipt size={14} /> Match Bill
            </button>
          </div>

          {/* ACTIVE ACTION SLIDE CONTAINER */}
          {activePoSlide && (
            <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    {activePoSlide === 'receive_goods' && 'Receive Goods — Goods Receipt (GRN)'}
                    {activePoSlide === 'perform_qc' && 'Quality Control Inspection — QC Inward'}
                    {activePoSlide === 'dispatch' && 'Supplier Delivery & Dispatch Tracking'}
                    {activePoSlide === 'costs' && 'Purchase Order Landed Costs & Direct Expenses'}
                    {activePoSlide === 'movement' && 'Purchase Order Traceability & Movement History'}
                    {activePoSlide === 'match_bill' && 'Vendor Bill Matching & 3-Way Reconciliation'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePoSlide(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Close active drawer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Render Active Operation Component */}
              {activePoSlide === 'receive_goods' && effectivePo && (
                <GoodsReceiptInlineSlide
                  po={effectivePo}
                  onClose={() => setActivePoSlide(null)}
                  onReceiptSaved={handleActionSaved}
                />
              )}

              {activePoSlide === 'perform_qc' && effectivePo && (
                <GreyQcInlineSlide
                  po={effectivePo}
                  onClose={() => setActivePoSlide(null)}
                  onQcSaved={handleActionSaved}
                />
              )}

              {activePoSlide === 'dispatch' && effectivePo && (
                <SupplierDeliveryInlineSlide
                  po={effectivePo}
                  onClose={() => setActivePoSlide(null)}
                  onDeliverySaved={handleActionSaved}
                />
              )}

              {activePoSlide === 'costs' && (
                <PoCostsPanel
                  flowData={flowData}
                  poId={selectedPoGroup.poId}
                  onAllocate={handleAllocateCosts}
                  allocating={allocatingCost}
                  onAddExpense={handleAddExpense}
                  formatCurrency={formatINR}
                />
              )}

              {activePoSlide === 'match_bill' && effectivePo && (
                <VendorBillInlineSlide
                  po={effectivePo}
                  onClose={() => setActivePoSlide(null)}
                  onBillSaved={handleActionSaved}
                />
              )}

              {activePoSlide === 'movement' && (
                <PoMovementHistoryPanel
                  flowData={flowData}
                  selectedPoGroup={selectedPoGroup}
                />
              )}
            </div>
          )}
        </section>
      )}

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

      {/* Top 4 Summary Cards — Real Backend Data */}
      {!selectedPoGroup && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Purchase workflow summary">
          <KpiCard
            label="Active Purchase Orders"
            value={String(view === 'po' ? (data.count || (data.groups || []).filter((g) => g.type === 'po').length) : (purchaseOrders.length || 0))}
            subtitle="Open POs with batch tracking"
            icon={FileText}
            tone="blue"
          />
          <KpiCard
            label="Pending Receipt"
            value={`${formatNumberIN(pendingReceiptVal)} m`}
            subtitle="Metres remaining to receive"
            icon={PackageOpen}
            tone="amber"
          />
          <KpiCard
            label="QC Pending"
            value={`${formatNumberIN(qcPendingVal)} m`}
            subtitle="Metres awaiting inspection"
            icon={ClipboardCheck}
            tone="amber"
          />
          <KpiCard
            label="Available Stock"
            value={`${formatNumberIN(availableStockVal)} m`}
            subtitle="Accepted and ready for dispatch"
            icon={CheckCircle2}
            tone="emerald"
          />
        </section>
      )}

      {/* Stock summary tiles when viewing all or broad search */}
      {!selectedPoGroup && s && (
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
                {key === 'totalPhysical' && <div className="text-[10px] text-slate-400">{data.batchCount} batch{data.batchCount === 1 ? '' : 'es'} · metres</div>}
              </button>
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
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {canReceive ? (
                    <button
                      type="button"
                      onClick={() => setActivePoSlide('receive_goods')}
                      className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <PackageCheck size={14} /> Record First Goods Receipt (GRN)
                    </button>
                  ) : isDraftOrPending ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/purchase/orders?po=${encodeURIComponent(selectedPoGroup.poId)}`)}
                      className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <ExternalLink size={14} /> Open PO to Submit / Approve
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setActivePoSlide('dispatch')}
                    className="h-9 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Truck size={14} /> Record Supplier Dispatch
                  </button>
                </div>
              </div>
            ) : (
              /* TABLE OF BATCHES */
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left">Batch No.</th>
                      <th className="px-4 py-3 text-left">Receipt / GRN</th>
                      <th className="px-4 py-3 text-right">Batch Qty</th>
                      <th className="px-4 py-3 text-left">QC Status</th>
                      <th className="px-4 py-3 text-right">Available (Passed)</th>
                      <th className="px-4 py-3 text-left">Stock Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPoGroup.batches.map((batch) => (
                      <tr key={batch.id} onClick={() => open(batch.batchCode)} className="hover:bg-slate-50/80 cursor-pointer">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-blue-700 hover:underline inline-flex items-center gap-1">
                            <Package size={13} /> {batch.batchCode}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {batch.item || '—'} · {batch.fabricType === 'DYED' ? 'Dyed' : 'Grey'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                          {(batch.receiptNumbers || []).join(', ') || batch.sourceDocumentNumber || '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                          {formatNumberIN(batch.batchQty)} {batch.uom}
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
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">
                          {formatNumberIN(batch.availableQty)} {batch.uom}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLE[batch.status] || STATUS_STYLE.Closed}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[batch.status] || STATUS_DOT.Closed}`} />
                            {batch.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => open(batch.batchCode)}
                            className="px-2.5 py-1 rounded-md border border-slate-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold cursor-pointer"
                            title="Open 360° traceability"
                          >
                            Batch 360°
                          </button>
                          <button
                            type="button"
                            onClick={() => printTag(batch)}
                            className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                            title="Print QR Tag"
                          >
                            <Printer size={13} />
                          </button>
                        </td>
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
                          <tr key={b.id} onClick={() => open(b.batchCode)} className={`hover:bg-slate-50/80 cursor-pointer ${isChecked ? 'bg-blue-50/40' : ''}`}>
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={isChecked} onChange={() => toggle(b)} aria-label={`Select ${b.batchCode}`} className="cursor-pointer" />
                            </td>
                            <td className="px-3 py-3">
                              <span className="font-mono font-bold text-blue-700 hover:underline">{b.batchCode}</span>
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
                              {b.awaitingQc
                                ? <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200">Waiting for QC</span>
                                : <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLE[b.status] || STATUS_STYLE.Closed}`}><span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[b.status] || STATUS_DOT.Closed}`} />{b.status}</span>}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap space-x-1" onClick={(e) => e.stopPropagation()}>
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
                      onOpenPo={() => navigate(`/purchase/orders?po=${encodeURIComponent(group.poId)}`)}
                      onViewBatches={() => viewBatchesForPo(group.poId)}
                      onOpenBatch={open}
                      onReceiveGoods={group.type === 'po' ? () => {
                        viewBatchesForPo(group.poId);
                        setPendingAction({ poId: group.poId, action: 'receive_goods' });
                      } : undefined}
                      onMatchBill={group.type === 'po' ? () => {
                        viewBatchesForPo(group.poId);
                        setPendingAction({ poId: group.poId, action: 'match_bill' });
                      } : undefined}
                      onPerformQc={group.type === 'po' ? () => {
                        viewBatchesForPo(group.poId);
                        setPendingAction({ poId: group.poId, action: 'perform_qc' });
                      } : undefined}
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
