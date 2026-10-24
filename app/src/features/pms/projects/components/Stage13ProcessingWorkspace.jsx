import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Box,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Layers,
  Percent,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  User,
  X,
} from 'lucide-react';
import { fetchJWOs, fetchPlans, errorMessage } from '../../../../services/jobWorkSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const DEST_PILL = {
  'Customer Project': 'bg-blue-50 text-blue-700 border-blue-200',
  'Own Project': 'bg-purple-50 text-purple-700 border-purple-200',
  Mixed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const ORDER_STATUS_PILL = {
  'In-Process': 'bg-blue-50 text-blue-700 border-blue-200',
  'Partially Received': 'bg-teal-50 text-teal-700 border-teal-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Delayed: 'bg-rose-50 text-rose-700 border-rose-200',
  Overdue: 'bg-rose-50 text-rose-700 border-rose-200',
  'Pending Outward': 'bg-amber-50 text-amber-700 border-amber-200',
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function Stage13ProcessingWorkspace({
  project,
  stage,
  onUpdated,
  onSelectStage,
  totalStages = 18,
}) {
  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
      warning: (msg) => showToast?.(msg, 'warning'),
    }),
    [showToast]
  );

  const code = project?.code || '';
  const projectId = project?.id;
  const stageSeq = stage?.sequence || 13;
  const stageName = stage?.name || 'Stage 13 — Processing';

  // Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [plans, setPlans] = useState([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [destFilter, setDestFilter] = useState('ALL');

  // Modal State
  const [selectedOrderModal, setSelectedOrderModal] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('overview'); // 'overview' | 'outwards' | 'inwards' | 'losses' | 'history'

  // Load backend records
  const loadRecords = useCallback(async () => {
    if (!projectId && !code) return;
    setLoading(true);
    setError('');
    try {
      const [allOrders, allPlans] = await Promise.all([
        fetchJWOs().catch(() => []),
        fetchPlans().catch(() => []),
      ]);

      // Filter orders belonging to this project (by projectId or code in remarks/projectCode)
      const projectOrders = (allOrders || []).filter(
        (o) =>
          o.projectId === projectId ||
          (o.projectCode && o.projectCode === code) ||
          (o.remarks || '').includes(code)
      );
      setOrders(projectOrders);

      // Filter plans belonging to this project
      const projectPlans = (allPlans || []).filter(
        (p) =>
          p.projectId === projectId ||
          (p.projectCode && p.projectCode === code) ||
          (p.remarks || '').includes(code)
      );
      setPlans(projectPlans);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load processing transactions.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, code]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Derived aggregate calculations for Stage 13
  const projectReq = Number(project?.requirementMeters || project?.quantity || 0);

  // Per-order calculated values
  const augmentedOrders = useMemo(() => {
    return orders.map((ord) => {
      const planned = Number(ord.plannedQty || 0);
      const outwardsList = ord.outwards || [];
      const inwardsList = ord.inwards || [];
      const lossList = ord.lossEntries || [];

      const outwardQty = outwardsList.reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
      const inwardQty = inwardsList.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
      const approvedLoss = lossList
        .filter((l) => (l.status || '').toLowerCase() === 'approved')
        .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
      const recordedLoss = lossList.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

      // Expected loss calculation: planned * (expected_loss_pct / 100)
      const expectedLossPct = Number(ord.expectedLossPct || 0);
      const expectedLossQty = (planned * expectedLossPct) / 100;

      // Pending quantity = outward - inward - approved loss
      const pendingQty = Math.max(0, outwardQty - inwardQty - approvedLoss);

      // Overdue check
      const isPastExpected =
        Boolean(ord.expectedCompletion) && ord.expectedCompletion < todayISO();
      const isDelayed = pendingQty > 0 && isPastExpected;

      // Effective Display Status
      let displayStatus = ord.status || 'In-Process';
      if (outwardQty === 0) {
        displayStatus = 'Pending Outward';
      } else if (pendingQty === 0 && outwardQty > 0) {
        displayStatus = 'Completed';
      } else if (isDelayed) {
        displayStatus = 'Delayed';
      } else if (inwardQty > 0 && pendingQty > 0) {
        displayStatus = 'Partially Received';
      } else if (outwardQty > 0) {
        displayStatus = 'In-Process';
      }

      // Latest return date from inwards
      const latestInwardDate = inwardsList
        .map((i) => i.date)
        .filter(Boolean)
        .sort()
        .reverse()[0] || '';

      // Linked plan information
      const linkedPlan = plans.find(
        (p) => p.id === ord.processPlanId || p.planNo === ord.processPlanNo
      );
      const effectivePlanNo =
        ord.processPlanNo || linkedPlan?.planNo || (linkedPlan ? `PP-${linkedPlan.id.slice(0, 6)}` : '—');

      // Primary material details
      const primaryMaterial = ord.materials?.[0] || {};
      const fabricItem = primaryMaterial.fabricItem || linkedPlan?.fabricItem || 'Grey Fabric';
      const fabricQuality = primaryMaterial.fabricQuality || linkedPlan?.fabricQuality || '';
      const shade = primaryMaterial.shade || linkedPlan?.shade || '—';
      const lotNo = primaryMaterial.lotNo || linkedPlan?.greyLotNo || '—';

      // Source PO / GRN
      const sourcePo =
        linkedPlan?.selectedTakas?.[0]?.sourcePoNumber ||
        linkedPlan?.sourcePoNumber ||
        ord.remarks?.match(/(PO-[^\s,]+|GRN-[^\s,]+)/)?.[0] ||
        'PO-GRN';

      // Taka count
      const takasCount =
        ord.outwards?.reduce((sum, o) => sum + (o.takas?.length || 0), 0) ||
        linkedPlan?.selectedTakas?.length ||
        linkedPlan?.noOfRolls ||
        1;

      // Charges
      const rateVal = Number(ord.rate || 0);
      const totalCharges =
        Number(ord.totalAmount || 0) ||
        (ord.charges || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0) ||
        rateVal * planned;

      return {
        ...ord,
        effectivePlanNo,
        sourcePo,
        fabricItem,
        fabricQuality,
        shade,
        lotNo,
        takasCount,
        outwardQty,
        inwardQty,
        pendingQty,
        expectedLossQty,
        recordedLoss,
        approvedLoss,
        isDelayed,
        displayStatus,
        latestInwardDate,
        totalCharges,
      };
    });
  }, [orders, plans]);

  // Aggregate metrics across project
  const totalProcessingQty = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + Number(o.plannedQty || 0), 0);
  }, [augmentedOrders]);

  const totalOutwardQty = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.outwardQty, 0);
  }, [augmentedOrders]);

  const totalInwardQty = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.inwardQty, 0);
  }, [augmentedOrders]);

  const totalPendingQty = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.pendingQty, 0);
  }, [augmentedOrders]);

  const totalExpectedLoss = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.expectedLossQty, 0);
  }, [augmentedOrders]);

  const totalRecordedLoss = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.recordedLoss, 0);
  }, [augmentedOrders]);

  const activeOrdersCount = useMemo(() => {
    return augmentedOrders.filter((o) => o.displayStatus !== 'Completed' && o.displayStatus !== 'Closed').length;
  }, [augmentedOrders]);

  const assignedVendorsCount = useMemo(() => {
    const vSet = new Set(augmentedOrders.map((o) => o.vendor).filter(Boolean));
    return vSet.size;
  }, [augmentedOrders]);

  // Distinct vendors for filter
  const vendorOptions = useMemo(() => {
    return Array.from(new Set(augmentedOrders.map((o) => o.vendor).filter(Boolean)));
  }, [augmentedOrders]);

  // Project destination breakdown
  const projectDestination = useMemo(() => {
    let customer = 0;
    let own = 0;
    augmentedOrders.forEach((o) => {
      const dest = o.projectDestination || 'Customer Project';
      if (dest === 'Own Project') own += o.plannedQty;
      else customer += o.plannedQty;
    });
    if (customer > 0 && own > 0) return 'Mixed';
    if (own > 0) return 'Own Project';
    return project?.project_types || 'Customer Project';
  }, [augmentedOrders, project]);

  // Stage overall progress percentage:
  // Derived from Inward Received Qty / Total Outward Qty (capped at 100%)
  const stageProgressPct = useMemo(() => {
    if (totalOutwardQty <= 0) return 0;
    return Math.min(100, Math.round((totalInwardQty / totalOutwardQty) * 100));
  }, [totalInwardQty, totalOutwardQty]);

  // Stage overall status
  const stageStatus = useMemo(() => {
    if (stageProgressPct === 100 && totalOutwardQty > 0) return 'Completed';
    const hasDelayed = augmentedOrders.some((o) => o.isDelayed);
    if (hasDelayed) return 'Delayed';
    if (totalInwardQty > 0) return 'Partially Completed';
    if (totalOutwardQty > 0) return 'In Progress';
    return 'Pending';
  }, [stageProgressPct, totalOutwardQty, totalInwardQty, augmentedOrders]);

  // Filtered orders list for the Active Transactions & Records table
  const filteredOrders = useMemo(() => {
    return augmentedOrders.filter((ord) => {
      // Vendor filter
      if (vendorFilter !== 'ALL' && ord.vendor !== vendorFilter) return false;

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Delayed / Overdue' && !ord.isDelayed) return false;
        if (statusFilter !== 'Delayed / Overdue' && ord.displayStatus !== statusFilter) return false;
      }

      // Destination filter
      if (destFilter !== 'ALL') {
        const dest = ord.projectDestination || 'Customer Project';
        if (dest !== destFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchJwo = (ord.jwoNo || '').toLowerCase().includes(q);
        const matchPlan = (ord.effectivePlanNo || '').toLowerCase().includes(q);
        const matchFabric = (ord.fabricItem || '').toLowerCase().includes(q) || (ord.fabricQuality || '').toLowerCase().includes(q);
        const matchVendor = (ord.vendor || '').toLowerCase().includes(q);
        const matchLot = (ord.lotNo || '').toLowerCase().includes(q);
        const matchPo = (ord.sourcePo || '').toLowerCase().includes(q);
        const matchShade = (ord.shade || '').toLowerCase().includes(q);
        const matchProcess = (ord.process || '').toLowerCase().includes(q);

        if (!matchJwo && !matchPlan && !matchFabric && !matchVendor && !matchLot && !matchPo && !matchShade && !matchProcess) {
          return false;
        }
      }
      return true;
    });
  }, [augmentedOrders, vendorFilter, statusFilter, destFilter, searchQuery]);

  // Document counts
  const totalOutwardChallansCount = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.outwards?.length || 0), 0);
  }, [orders]);

  const totalInwardReceiptsCount = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.inwards?.length || 0), 0);
  }, [orders]);

  return (
    <div className="space-y-5">
      {/* =========================================================================
          1. LIFECYCLE HEADER (MATCHING STAGE 11 LAYOUT EXACTLY)
         ========================================================================= */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-200 bg-indigo-50/70 text-indigo-600 shadow-2xs">
              <Activity size={26} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  {code || 'PMS-PROJECT'}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {project?.product_name || project?.name || 'Textile Manufacturing Project'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${DEST_PILL[projectDestination] || DEST_PILL['Customer Project']}`}>
                  {projectDestination}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${ORDER_STATUS_PILL[stageStatus] || ORDER_STATUS_PILL['In-Process']}`}>
                  {stageStatus}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight mt-1">
                Stage {stageSeq}: {stage?.name || 'Processing'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Track real-time mill progress, monitor vendor outward-inward balance, inspect loss tolerance, and coordinate returns.
              </p>
            </div>
          </div>

          {/* Navigation & Action Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            

            <button
              type="button"
              onClick={loadRecords}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Refresh records"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Linked Documents & Stage Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-600 flex-wrap">
            <span className="flex items-center gap-1.5">
              <FileText size={14} className="text-blue-600" />
              <span><strong>{orders.length}</strong> Job Work Orders</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-600" />
              <span><strong>{plans.length}</strong> Process Plans</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Truck size={14} className="text-amber-600" />
              <span><strong>{totalOutwardChallansCount}</strong> Outward Challans</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ArrowDownToLine size={14} className="text-teal-600" />
              <span><strong>{totalInwardReceiptsCount}</strong> Inward Receipts</span>
            </span>
          </div>

          <div className="flex items-center gap-3 min-w-[220px]">
            <span className="text-[11px] font-bold text-slate-500">Stage Progress</span>
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-teal-600 rounded-full transition-all duration-300"
                style={{ width: `${stageProgressPct}%` }}
              />
            </div>
            <span className="font-mono font-bold text-teal-700">{stageProgressPct}%</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* =========================================================================
          2. 8 PROCESSING SUMMARY CARDS (EXACT STAGE 11 SPECIFICATION)
         ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* 1. Total Processing Quantity */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Processing Qty</p>
          <p className="text-base font-black text-slate-900 mt-1 font-mono">{n(totalProcessingQty)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Assigned in JWO</p>
        </div>

        {/* 2. Total Outward Quantity */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Total Outward</p>
          <p className="text-base font-black text-amber-800 mt-1 font-mono">{n(totalOutwardQty)}</p>
          <p className="text-[10px] text-amber-600 mt-0.5">Dispatched to mill</p>
        </div>

        {/* 3. Total Inward Quantity */}
        <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Total Inward</p>
          <p className="text-base font-black text-teal-800 mt-1 font-mono">{n(totalInwardQty)}</p>
          <p className="text-[10px] text-teal-600 mt-0.5">Received back</p>
        </div>

        {/* 4. Processing Pending at Mill */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Pending at Mill</p>
          <p className="text-base font-black text-indigo-800 mt-1 font-mono">{n(totalPendingQty)}</p>
          <p className="text-[10px] text-indigo-600 mt-0.5">Outstanding WIP</p>
        </div>

        {/* 5. Expected Loss */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Expected Loss</p>
          <p className="text-base font-black text-slate-900 mt-1 font-mono">{n(totalExpectedLoss)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Approved tolerance</p>
        </div>

        {/* 6. Actual Recorded Loss */}
        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Recorded Loss</p>
          <p className="text-base font-black text-rose-800 mt-1 font-mono">{n(totalRecordedLoss)}</p>
          <p className="text-[10px] text-rose-600 mt-0.5">Reconciled loss</p>
        </div>

        {/* 7. Active Job Work Orders */}
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Active JWOs</p>
          <p className="text-base font-black text-purple-800 mt-1 font-mono">{activeOrdersCount}</p>
          <p className="text-[10px] text-purple-600 mt-0.5">Linked to project</p>
        </div>

        {/* 8. Assigned Vendors */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Assigned Vendors</p>
          <p className="text-base font-black text-emerald-800 mt-1 font-mono">{assignedVendorsCount}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Active processors</p>
        </div>
      </div>

      {/* =========================================================================
          3. PROCESSING ORDERS — ACTIVE TRANSACTIONS & RECORDS (18 COLUMNS)
         ========================================================================= */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-4">
        {/* Header with Title and Counter */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-indigo-600" />
              <span>Processing Orders — Active Transactions & Records</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              18-column live register. Real-time batch WIP, return dates, process specifications, and dock inward readiness.
            </p>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {filteredOrders.length} of {augmentedOrders.length} Processing Orders
          </span>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
          {/* Search */}
          <div className="relative sm:col-span-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search JWO, Plan, Fabric, Lot, Vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>

          {/* Vendor Filter */}
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
          >
            <option value="ALL">All Processors / Vendors</option>
            {vendorOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
          >
            <option value="ALL">All Order Statuses</option>
            <option value="In-Process">In-Process</option>
            <option value="Partially Received">Partially Received</option>
            <option value="Completed">Completed</option>
            <option value="Delayed / Overdue">Delayed / Overdue</option>
            <option value="Pending Outward">Pending Outward</option>
          </select>

          {/* Destination Filter */}
          <div className="flex items-center gap-2">
            <select
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
              className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
            >
              <option value="ALL">All Destinations</option>
              <option value="Customer Project">Customer Project</option>
              <option value="Own Project">Own Project</option>
            </select>

            {(searchQuery || vendorFilter !== 'ALL' || statusFilter !== 'ALL' || destFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVendorFilter('ALL');
                  setStatusFilter('ALL');
                  setDestFilter('ALL');
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                title="Reset filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* 18-Column Live Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-3">JWO No</th>
                <th className="p-3">Plan No</th>
                <th className="p-3">Source PO / GRN</th>
                <th className="p-3">Fabric & Quality</th>
                <th className="p-3">Design / Shade</th>
                <th className="p-3">Source Lot & Taka</th>
                <th className="p-3">Process</th>
                <th className="p-3">Processor</th>
                <th className="p-3 text-right">Planned (m)</th>
                <th className="p-3 text-right">Outward (m)</th>
                <th className="p-3 text-right">Inward (m)</th>
                <th className="p-3 text-right">Pending (m)</th>
                <th className="p-3 text-right">Rate & Unit</th>
                <th className="p-3 text-right">Charges</th>
                <th className="p-3">Expected Return</th>
                <th className="p-3">Actual Return</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-10 text-center text-slate-400">
                    {augmentedOrders.length === 0
                      ? `No processing orders linked to project ${code} yet. Complete Stage 11 (Processing Plan) to generate Job Work Orders.`
                      : 'No processing orders match the applied search or filters.'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* 1. Job Work Order Number */}
                    <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderModal(ord);
                          setActiveModalTab('overview');
                        }}
                        className="hover:underline flex items-center gap-1 cursor-pointer"
                        title="Click to view full order details"
                      >
                        <span>{ord.jwoNo}</span>
                      </button>
                    </td>

                    {/* 2. Process Plan Number */}
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {ord.effectivePlanNo}
                    </td>

                    {/* 3. Source PO / GRN */}
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {ord.sourcePo}
                    </td>

                    {/* 4. Fabric & Quality */}
                    <td className="p-3 font-medium whitespace-nowrap">
                      <span className="text-slate-900 font-semibold">{ord.fabricItem}</span>
                      {ord.fabricQuality && (
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {ord.fabricQuality}
                        </span>
                      )}
                    </td>

                    {/* 5. Design & Shade / Colour */}
                    <td className="p-3 text-slate-700 whitespace-nowrap">
                      {ord.shade || '—'}
                    </td>

                    {/* 6. Source Lot & Taka Number */}
                    <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                      <span className="font-bold text-slate-800">{ord.lotNo}</span>
                      <span className="block text-[10px] text-slate-400">
                        Takas: {ord.takasCount} roll{ord.takasCount === 1 ? '' : 's'}
                      </span>
                    </td>

                    {/* 7. Processing Type */}
                    <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                      {ord.process || 'Dyeing'}
                    </td>

                    {/* 8. Vendor / Processor */}
                    <td className="p-3 font-medium text-slate-800 whitespace-nowrap">
                      {ord.vendor || '—'}
                    </td>

                    {/* 9. Planned Quantity */}
                    <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {n(ord.plannedQty)} m
                    </td>

                    {/* 10. Outward Quantity */}
                    <td className="p-3 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                      {n(ord.outwardQty)} m
                    </td>

                    {/* 11. Inward Quantity */}
                    <td className="p-3 text-right font-mono font-bold text-teal-700 whitespace-nowrap">
                      {n(ord.inwardQty)} m
                    </td>

                    {/* 12. Pending Quantity */}
                    <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                      <span className={ord.pendingQty > 0 ? 'text-indigo-700' : 'text-slate-400'}>
                        {n(ord.pendingQty)} m
                      </span>
                    </td>

                    {/* 13. Processing Rate & Unit */}
                    <td className="p-3 text-right font-mono text-slate-700 whitespace-nowrap">
                      {ord.rate > 0 ? `₹${n(ord.rate)} / m` : '—'}
                    </td>

                    {/* 14. Processing Charges */}
                    <td className="p-3 text-right font-mono text-slate-800 whitespace-nowrap">
                      {ord.totalCharges > 0 ? `₹${n(ord.totalCharges)}` : '—'}
                    </td>

                    {/* 15. Expected Return Date */}
                    <td className="p-3 whitespace-nowrap">
                      <span className={ord.isDelayed ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                        {ord.expectedCompletion || '—'}
                      </span>
                      {ord.isDelayed && (
                        <span className="block text-[10px] text-rose-500 font-semibold">Overdue</span>
                      )}
                    </td>

                    {/* 16. Actual Return Date */}
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      {ord.latestInwardDate || '—'}
                    </td>

                    {/* 17. Status */}
                    <td className="p-3 whitespace-nowrap text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ORDER_STATUS_PILL[ord.displayStatus] || ORDER_STATUS_PILL['In-Process']}`}>
                        {ord.displayStatus}
                      </span>
                    </td>

                    {/* 18. Actions */}
                    <td className="p-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderModal(ord);
                            setActiveModalTab('overview');
                          }}
                          className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                          title="View Order Details & History"
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderModal(ord);
                            setActiveModalTab('outwards');
                          }}
                          className="p-1 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 cursor-pointer"
                          title="View Outward Challans"
                        >
                          <Truck size={14} />
                        </button>

                        {ord.pendingQty > 0 ? (
                          <button
                            type="button"
                            onClick={() => onSelectStage && onSelectStage(stageSeq + 1)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 text-[10px] font-bold cursor-pointer"
                            title="Receive returned fabric in Stage 14"
                          >
                            <span>Receive</span>
                            <ArrowRight size={10} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-600 px-1.5 py-0.5">
                            Reconciled
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          4. STAGE 14 DOCK RECEIVING BANNER
         ========================================================================= */}
      {totalOutwardQty > 0 && totalPendingQty > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs shadow-2xs">
          <div className="flex items-center gap-3 text-teal-900">
            <div className="w-9 h-9 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center shrink-0 text-teal-700">
              <ArrowDownToLine size={18} />
            </div>
            <div>
              <p className="font-bold text-slate-900">
                Material is actively processing at the mill ({n(totalPendingQty)} M outstanding).
              </p>
              <p className="text-slate-600 mt-0.5">
                When physical fabric arrives back at the godown, proceed to <strong>Stage 14 — Job Work Inward</strong> to record dock receiving, check rolls, and reconcile balances.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectStage && onSelectStage(14)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer shadow-xs whitespace-nowrap text-xs transition-colors shrink-0"
          >
            <span>Proceed to Stage 14 (Job Work Inward)</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* =========================================================================
          5. PROCESSING DETAILS AND PROGRESS MODAL (PART 5 SPECIFICATION)
         ========================================================================= */}
      {selectedOrderModal && (
        <Modal
          isOpen={Boolean(selectedOrderModal)}
          onClose={() => setSelectedOrderModal(null)}
          title={`Job Work Order ${selectedOrderModal.jwoNo} — Processing Details & WIP`}
          subtitle={`Traceable order breakdown for ${selectedOrderModal.vendor || 'Assigned Vendor'} (${selectedOrderModal.process || 'Process'}).`}
          size="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Pending at Mill:</span>
                <span className="font-mono font-bold text-indigo-700">{n(selectedOrderModal.pendingQty)} m</span>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" type="button" onClick={() => setSelectedOrderModal(null)}>
                  Close
                </Button>

                {selectedOrderModal.pendingQty > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderModal(null);
                      if (onSelectStage) onSelectStage(14);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <ArrowDownToLine size={13} />
                    <span>Receive in Stage 14</span>
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Top KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Planned Quantity</span>
                <span className="text-sm font-mono font-bold text-slate-900 mt-0.5 block">{n(selectedOrderModal.plannedQty)} m</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-700 uppercase font-bold block">Dispatched (Outward)</span>
                <span className="text-sm font-mono font-bold text-amber-800 mt-0.5 block">{n(selectedOrderModal.outwardQty)} m</span>
              </div>
              <div>
                <span className="text-[10px] text-teal-700 uppercase font-bold block">Received (Inward)</span>
                <span className="text-sm font-mono font-bold text-teal-800 mt-0.5 block">{n(selectedOrderModal.inwardQty)} m</span>
              </div>
              <div>
                <span className="text-[10px] text-indigo-700 uppercase font-bold block">Outstanding WIP</span>
                <span className="text-sm font-mono font-bold text-indigo-800 mt-0.5 block">{n(selectedOrderModal.pendingQty)} m</span>
              </div>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-200 pb-1">
              <button
                type="button"
                onClick={() => setActiveModalTab('overview')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  activeModalTab === 'overview'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Overview & Specs
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('outwards')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeModalTab === 'outwards'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Outward Challans</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {selectedOrderModal.outwards?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('inwards')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeModalTab === 'inwards'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Inward Receipts</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {selectedOrderModal.inwards?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('losses')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  activeModalTab === 'losses'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Loss & Reconciliation</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {selectedOrderModal.lossEntries?.length || 0}
                </span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW & SPECS */}
            {activeModalTab === 'overview' && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-slate-200 bg-white">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Processor / Vendor</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 block">{selectedOrderModal.vendor || '—'}</span>
                    <span className="text-[11px] text-slate-500">Destination: {selectedOrderModal.projectDestination || 'Customer Project'}</span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-white">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Fabric & Quality</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 block">{selectedOrderModal.fabricItem}</span>
                    <span className="text-[11px] text-slate-500">{selectedOrderModal.fabricQuality || 'Grey Quality'}</span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-white">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Processing & Target Shade</span>
                    <span className="text-xs font-bold text-indigo-700 mt-1 block">{selectedOrderModal.process}</span>
                    <span className="text-[11px] text-slate-500">Target Shade: {selectedOrderModal.shade || 'Standard'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Process Plan No</span>
                    <span className="font-mono font-bold text-slate-800 mt-0.5 block">{selectedOrderModal.effectivePlanNo}</span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Source PO / GRN</span>
                    <span className="font-mono font-bold text-slate-800 mt-0.5 block">{selectedOrderModal.sourcePo}</span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Processing Rate</span>
                    <span className="font-mono font-bold text-slate-800 mt-0.5 block">
                      {selectedOrderModal.rate > 0 ? `₹${n(selectedOrderModal.rate)} / m` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Expected Return Date</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{selectedOrderModal.expectedCompletion || '—'}</span>
                  </div>
                </div>

                {/* Instructions / Remarks */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Processing Instructions & Remarks
                  </span>
                  <p className="text-slate-700 font-medium whitespace-pre-wrap">
                    {selectedOrderModal.remarks || 'No special processing instructions recorded.'}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: OUTWARD CHALLANS */}
            {activeModalTab === 'outwards' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Outward Delivery Challans (Dispatched to Mill)</span>
                  <span className="text-slate-500 font-mono">Total Sent: {n(selectedOrderModal.outwardQty)} m</span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Challan No</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5 text-right">Dispatched (m)</th>
                        <th className="p-2.5">Transporter</th>
                        <th className="p-2.5">Vehicle No</th>
                        <th className="p-2.5">LR No</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(selectedOrderModal.outwards || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400 font-sans">
                            No outward challans recorded for this order yet.
                          </td>
                        </tr>
                      ) : (
                        selectedOrderModal.outwards.map((out) => (
                          <tr key={out.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-bold text-blue-700">{out.challanNo || out.no}</td>
                            <td className="p-2.5 font-sans text-slate-600">{out.date}</td>
                            <td className="p-2.5 text-right font-bold text-amber-700">{n(out.qty)}</td>
                            <td className="p-2.5 font-sans text-slate-700">{out.transporter || '—'}</td>
                            <td className="p-2.5 text-slate-700">{out.vehicleNo || '—'}</td>
                            <td className="p-2.5 text-slate-600">{out.lrNo || '—'}</td>
                            <td className="p-2.5 text-center font-sans">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {out.status || 'Sent'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: INWARD RECEIPTS */}
            {activeModalTab === 'inwards' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Inward Dock Receipts (Returned from Mill)</span>
                  <span className="text-slate-500 font-mono">Total Received: {n(selectedOrderModal.inwardQty)} m</span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Receipt No</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5 text-right">Received (m)</th>
                        <th className="p-2.5 text-right">Accepted (m)</th>
                        <th className="p-2.5 text-right">Rejected (m)</th>
                        <th className="p-2.5">Vendor Challan</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(selectedOrderModal.inwards || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400 font-sans">
                            No inward receipts recorded yet. Use Stage 14 to receive finished fabric.
                          </td>
                        </tr>
                      ) : (
                        selectedOrderModal.inwards.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-bold text-teal-700">{inv.no}</td>
                            <td className="p-2.5 font-sans text-slate-600">{inv.date}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">{n(inv.qty)}</td>
                            <td className="p-2.5 text-right font-bold text-emerald-700">{n(inv.accepted || inv.qty)}</td>
                            <td className="p-2.5 text-right font-bold text-rose-700">{n(inv.rejected || 0)}</td>
                            <td className="p-2.5 text-slate-600">{inv.challanNo || '—'}</td>
                            <td className="p-2.5 text-center font-sans">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                {inv.status || 'Received'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: LOSS & RECONCILIATION */}
            {activeModalTab === 'losses' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Expected Loss Tolerance</span>
                    <span className="text-sm font-mono font-bold text-slate-800 mt-0.5 block">
                      {n(selectedOrderModal.expectedLossQty)} m ({selectedOrderModal.expectedLossPct || 0}%)
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rose-600 uppercase font-bold block">Recorded Loss Entries</span>
                    <span className="text-sm font-mono font-bold text-rose-800 mt-0.5 block">
                      {n(selectedOrderModal.recordedLoss)} m
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-emerald-600 uppercase font-bold block">Approved Reconciled Loss</span>
                    <span className="text-sm font-mono font-bold text-emerald-800 mt-0.5 block">
                      {n(selectedOrderModal.approvedLoss)} m
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Loss Reason</th>
                        <th className="p-2.5 text-right">Quantity (m)</th>
                        <th className="p-2.5 text-center">Status</th>
                        <th className="p-2.5">Approved By</th>
                        <th className="p-2.5">Approved Date</th>
                        <th className="p-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedOrderModal.lossEntries || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">
                            No loss entries recorded for this order. Reconciliation is within normal tolerance.
                          </td>
                        </tr>
                      ) : (
                        selectedOrderModal.lossEntries.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-medium text-slate-800">{l.lossReasonName || 'Loss Entry'}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-rose-700">{n(l.qty)}</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                l.status === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {l.status || 'Pending'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-600">{l.approvedBy || '—'}</td>
                            <td className="p-2.5 text-slate-600 font-mono text-[11px]">{l.approvedAt ? l.approvedAt.slice(0, 10) : '—'}</td>
                            <td className="p-2.5 text-slate-500">{l.remarks || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Stage13ProcessingWorkspace;
