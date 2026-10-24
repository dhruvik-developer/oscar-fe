import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Truck,
  User,
  X,
} from 'lucide-react';
import {
  approvePlan,
  createJWOFromPlan,
  createPlan,
  errorMessage,
  fetchJWOs,
  fetchPlans,
} from '../../../../services/jobWorkSync';
import { getGreyStockAllocation } from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useJobWorkLookups } from '../../../jobwork/ProcessPlanListPage';
import MasterSourceLink from '../../../../components/common/MasterSourceLink';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_PILL = {
  Draft: 'bg-amber-50 text-amber-700 border-amber-200',
  Active: 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const PRIORITY_PILL = {
  Normal: 'bg-slate-50 text-slate-700 border-slate-200',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Urgent: 'bg-rose-50 text-rose-700 border-rose-200',
};

const DEST_PILL = {
  'Customer Project': 'bg-blue-50 text-blue-700 border-blue-200',
  'Own Project': 'bg-purple-50 text-purple-700 border-purple-200',
  Mixed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function ProcessPlanStageWorkspace({
  project,
  stage,
  onUpdated,
  onSelectStage,
}) {
  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
    }),
    [showToast]
  );

  const code = project?.code || '';
  const projectId = project?.id;
  const { vendors = [], employees = [], processes = [] } = useJobWorkLookups();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [lots, setLots] = useState([]);
  const [summaryData, setSummaryData] = useState({
    requiredMeters: 0,
    allocatedMeters: 0,
    customerAllocatedMeters: 0,
    ownAllocatedMeters: 0,
    availableMeters: 0,
  });

  // Taka selection state
  const [selectedTakas, setSelectedTakas] = useState({}); // { lotId: selectedQty }
  const [takaSearch, setTakaSearch] = useState('');
  const [takaFabricFilter, setTakaFabricFilter] = useState('ALL');
  const [takaQcFilter, setTakaQcFilter] = useState('Passed'); // default to Passed only for safety
  const [takaDestFilter, setTakaDestFilter] = useState('ALL');
  const [availableOnly, setAvailableOnly] = useState(true);

  // Form state for Section B
  const [form, setForm] = useState({
    processor: '',
    process: '',
    processCategory: '',
    targetShade: '',
    rate: '',
    rateUom: '/ meter',
    expectedLoss: '',
    expectedReturnDate: '',
    assignedCoordinator: '',
    priority: 'Normal',
    remarks: '',
  });

  const [busyAction, setBusyAction] = useState(false);
  const [viewPlanModal, setViewPlanModal] = useState(null);
  const [confirmJwoModal, setConfirmJwoModal] = useState(null);

  // Load backend records
  const loadRecords = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [allPlans, allOrders, allocRes] = await Promise.all([
        fetchPlans().catch(() => []),
        fetchJWOs().catch(() => []),
        getGreyStockAllocation(projectId).catch(() => null),
      ]);

      // Filter plans belonging to this project (by projectId or code in remarks)
      const projectPlans = (allPlans || []).filter(
        (p) => p.projectId === projectId || (p.remarks || '').includes(code)
      );
      setPlans(projectPlans);

      // Filter orders belonging to this project
      const projectOrders = (allOrders || []).filter(
        (o) => o.projectId === projectId || (o.remarks || '').includes(code)
      );
      setOrders(projectOrders);

      // Grey stock lots
      const payload = allocRes?.data || allocRes || {};
      const lotList = Array.isArray(payload.lots) ? payload.lots : [];
      setLots(lotList);

      const totalPhysicalStock = (payload.fabrics || []).reduce(
        (acc, f) => acc + (Number(f.physicalStock) || 0),
        0
      );
      const totalUsableStock = (payload.fabrics || []).reduce(
        (acc, f) => acc + (Number(f.usableStock) || 0),
        0
      );

      setSummaryData({
        requiredMeters: Number(
          payload.requiredMeters || project?.requirementMeters || project?.quantity || 0
        ),
        allocatedMeters: Number(payload.allocatedMeters || 0),
        customerAllocatedMeters: Number(payload.customerAllocatedMeters || 0),
        ownAllocatedMeters: Number(payload.ownAllocatedMeters || 0),
        availableMeters: totalUsableStock || totalPhysicalStock,
      });
    } catch (err) {
      setError(errorMessage(err, 'Failed to load process planning data.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, code, project?.requirementMeters, project?.quantity]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Available filter options
  const fabricOptions = useMemo(() => {
    return Array.from(
      new Set(lots.map((l) => l.fabricName || l.fabricQuality).filter(Boolean))
    );
  }, [lots]);

  // Filtered eligible grey stock
  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      const fName = lot.fabricName || lot.fabricQuality;
      if (takaFabricFilter !== 'ALL' && fName !== takaFabricFilter && lot.fabricQuality !== takaFabricFilter)
        return false;

      const qc = (lot.qcStatus || '').toLowerCase();
      if (takaQcFilter === 'Passed' && qc !== 'passed') return false;
      if (takaQcFilter === 'QC Hold' && (qc === 'passed' || qc.includes('reject'))) return false;

      const dest = lot.allocationType || 'Customer Project';
      if (takaDestFilter !== 'ALL' && dest !== takaDestFilter) return false;

      const usable = Number(lot.usable || 0);
      if (availableOnly && usable <= 0) return false;

      if (takaSearch.trim()) {
        const q = takaSearch.toLowerCase();
        const mFabric = (fName || '').toLowerCase().includes(q);
        const mLot = (lot.lotNumber || '').toLowerCase().includes(q);
        const mTaka = (lot.takaId || '').toLowerCase().includes(q) || String(lot.takaNumber || '').includes(q);
        const mPo = (lot.sourcePoNumber || '').toLowerCase().includes(q);
        const mLoc = (lot.location || '').toLowerCase().includes(q);
        if (!mFabric && !mLot && !mTaka && !mPo && !mLoc) return false;
      }
      return true;
    });
  }, [lots, takaFabricFilter, takaQcFilter, takaDestFilter, availableOnly, takaSearch]);

  // Selected takas calculation
  const selectedTakaList = useMemo(() => {
    return lots
      .filter((l) => (selectedTakas[l.id] || 0) > 0)
      .map((l) => ({
        ...l,
        selectedQty: selectedTakas[l.id] || 0,
      }));
  }, [lots, selectedTakas]);

  const totalSelectedMeters = useMemo(() => {
    return selectedTakaList.reduce((acc, t) => acc + (Number(t.selectedQty) || 0), 0);
  }, [selectedTakaList]);

  // Breakdown of selected takas by destination
  const selectedDestinationBreakdown = useMemo(() => {
    let customer = 0;
    let own = 0;
    selectedTakaList.forEach((t) => {
      const d = t.allocationType || 'Customer Project';
      if (d === 'Own Project') own += t.selectedQty;
      else customer += t.selectedQty;
    });
    let composite = 'Customer Project';
    if (customer > 0 && own > 0) composite = 'Mixed';
    else if (own > 0) composite = 'Own Project';

    return { customer, own, composite };
  }, [selectedTakaList]);

  // Handle process change and auto-fill expected loss % from process master
  const handleProcessChange = (e) => {
    const processName = e.target.value;
    const master = processes.find((p) => p.name === processName);
    const defaultLoss = master?.expectedLossPct ?? master?.expected_loss_pct ?? '';
    setForm((prev) => ({
      ...prev,
      process: processName,
      processCategory: prev.processCategory || master?.category || '',
      expectedLoss: defaultLoss !== '' ? String(defaultLoss) : prev.expectedLoss,
    }));
  };

  // Expected return qty formula: plannedQty * (1 - loss/100)
  const lossPct = Number(form.expectedLoss || 0);
  const plannedQty = totalSelectedMeters;
  const expectedReturnMeters = useMemo(() => {
    if (plannedQty <= 0) return 0;
    return Math.max(0, plannedQty * (1 - lossPct / 100));
  }, [plannedQty, lossPct]);

  // Toggle single taka selection
  const handleToggleTaka = (lot) => {
    const isEligible = lot.isAllocatable ?? (lot.qcStatus === 'Passed');
    if (!isEligible) {
      toast.error(`Taka ${lot.takaNumber || lot.takaId} is in QC Hold and cannot be selected.`);
      return;
    }
    const current = selectedTakas[lot.id] || 0;
    setSelectedTakas((prev) => {
      const next = { ...prev };
      if (current > 0) {
        delete next[lot.id];
      } else {
        next[lot.id] = Number(lot.usable || lot.available || lot.totalStock || 0);
      }
      return next;
    });
  };

  // Change individual taka selected quantity
  const handleTakaQtyChange = (lotId, value, maxVal) => {
    const numVal = Math.max(0, Math.min(Number(maxVal) || 0, Number(value) || 0));
    setSelectedTakas((prev) => {
      const next = { ...prev };
      if (numVal > 0) next[lotId] = numVal;
      else delete next[lotId];
      return next;
    });
  };

  // Select all eligible filtered takas
  const handleSelectAllEligible = () => {
    const eligible = filteredLots.filter((l) => (l.isAllocatable ?? (l.qcStatus === 'Passed')) && l.usable > 0);
    const next = { ...selectedTakas };
    eligible.forEach((l) => {
      next[l.id] = Number(l.usable || 0);
    });
    setSelectedTakas(next);
  };

  const handleClearSelection = () => {
    setSelectedTakas({});
  };

  // Calculations for 8 KPI cards
  const projectReq = summaryData.requiredMeters;
  const availableGrey = summaryData.availableMeters;
  const customerAllocated = summaryData.customerAllocatedMeters;
  const ownAllocated = summaryData.ownAllocatedMeters;
  const plannedProcessing = plans.reduce((acc, p) => acc + (Number(p.expectedQty) || 0), 0);

  // Dispatched qty to processor derived from JWO outward records
  const dispatchedQty = useMemo(() => {
    let sum = 0;
    orders.forEach((o) => {
      (o.outwards || []).forEach((out) => {
        sum += Number(out.qty || 0);
      });
    });
    return sum;
  }, [orders]);

  const remainingGrey = Math.max(0, availableGrey - (customerAllocated + ownAllocated));

  // Stage progress derived from actual saved records
  const stageProgressPct = useMemo(() => {
    if (dispatchedQty > 0 || orders.some((o) => o.status === 'Closed' || o.status === 'Completed')) {
      return 100;
    }
    if (orders.length > 0 || plans.some((p) => p.status === 'Active' || p.status === 'Completed')) {
      return 100;
    }
    if (plans.length > 0) return 50;
    return 0;
  }, [dispatchedQty, orders, plans]);

  // Validation (Example 2 compliance: strict shortage check)
  const validatePlanFields = () => {
    if (selectedTakaList.length === 0) {
      return 'Please select at least one eligible taka from Section A.';
    }
    const maxAvailable = summaryData.allocatedMeters > 0 ? summaryData.allocatedMeters : summaryData.availableMeters;
    if (plannedQty > maxAvailable && maxAvailable > 0) {
      const shortage = plannedQty - maxAvailable;
      return `Proposed processing quantity (${plannedQty.toLocaleString('en-IN')} M) exceeds available stock (${maxAvailable.toLocaleString('en-IN')} M). Shortage: ${shortage.toLocaleString('en-IN')} M.`;
    }
    if (!form.processor.trim()) {
      return 'Please select a Processor / Job Worker.';
    }
    if (!form.process.trim()) {
      return 'Please select a Process Type.';
    }
    if (!form.expectedReturnDate) {
      return 'Please set the Expected Return Date.';
    }
    return null;
  };

  // Save Plan action
  const handleSavePlan = async (asStatus = 'Draft') => {
    const err = validatePlanFields();
    if (err) {
      toast.error(err);
      return null;
    }

    setBusyAction(true);
    try {
      const firstTaka = selectedTakaList[0] || {};
      const rateVal = Number(form.rate) || 0;
      const rateAmount = rateVal > 0 ? Math.round(rateVal * plannedQty * 100) / 100 : 0;

      const payload = {
        projectId,
        projectDestination: selectedDestinationBreakdown.composite,
        date: todayISO(),
        process: form.process,
        processCategory: form.processCategory,
        vendor: form.processor,
        fabricItem: firstTaka.fabricName || firstTaka.fabricQuality || 'Grey Fabric',
        fabricQuality: firstTaka.fabricQuality || '',
        greyLotNo: [...new Set(selectedTakaList.map((t) => t.lotNumber).filter(Boolean))].join(', '),
        takaRollNo: selectedTakaList.map((t) => t.takaNumber || t.takaId).filter(Boolean).join(', '),
        shade: form.targetShade || firstTaka.shade || '',
        expectedQty: plannedQty,
        plannedQty: plannedQty,
        expectedLoss: lossPct,
        expectedReturnQty: Math.round(expectedReturnMeters * 100) / 100,
        noOfRolls: selectedTakaList.length,
        startDate: todayISO(),
        expectedCompletionDate: form.expectedReturnDate,
        assignedEmployee: form.assignedCoordinator,
        priority: form.priority,
        status: asStatus,
        remarks: [`Project ${code}`, form.remarks].filter(Boolean).join(' — '),
        selectedTakas: selectedTakaList.map((t) => ({
          id: t.id,
          takaId: t.takaId,
          takaNumber: t.takaNumber,
          lotNumber: t.lotNumber,
          meters: t.selectedQty,
          weightKg: t.weightKg,
          sourcePoNumber: t.sourcePoNumber,
          allocationType: t.allocationType || 'Customer Project',
          fabricItem: t.fabricName || t.fabricQuality,
          fabricQuality: t.fabricQuality,
          shade: t.shade,
        })),
        charges: rateVal > 0 ? [
          {
            type: form.process,
            description: `${form.process} processing (${form.rateUom})`,
            rate: rateVal,
            qty: plannedQty,
            amount: rateAmount,
          },
        ] : [],
      };

      const saved = await createPlan(payload);
      toast.success(
        asStatus === 'Draft'
          ? `Process Plan ${saved.planNo} saved as Draft.`
          : `Process Plan ${saved.planNo} submitted and active.`
      );

      // Reset selection and form
      setSelectedTakas({});
      setForm((prev) => ({
        ...prev,
        targetShade: '',
        rate: '',
        remarks: '',
      }));

      await loadRecords();
      if (onUpdated) onUpdated();
      return saved;
    } catch (apiErr) {
      toast.error(errorMessage(apiErr, 'Failed to save Process Plan.'));
      return null;
    } finally {
      setBusyAction(false);
    }
  };

  // Approve a draft plan
  const handleApprovePlan = async (plan) => {
    setBusyAction(true);
    try {
      await approvePlan(plan.id);
      toast.success(`Process Plan ${plan.planNo} approved and activated.`);
      await loadRecords();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to approve plan.'));
    } finally {
      setBusyAction(false);
    }
  };

  // Convert plan to JWO and continue to Stage 12
  const handleCreateJWOAndContinue = async (plan) => {
    setBusyAction(true);
    try {
      const jwo = await createJWOFromPlan(plan.id);
      toast.success(`Job Work Order ${jwo.jwoNo} created successfully! Continuing to Stage 12...`);
      setConfirmJwoModal(null);
      await loadRecords();
      if (onUpdated) onUpdated();
      // Seamlessly navigate or hand off to Stage 12
      if (onSelectStage) {
        onSelectStage(12);
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create Job Work Order.'));
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* =========================================================================
          LIFECYCLE HEADER (18-STAGE PMS LIFECYCLE CONTEXT)
         ========================================================================= */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-blue-200 bg-blue-50/70 text-blue-600 shadow-2xs">
              <Layers size={26} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {code}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {project?.name || 'Textile Manufacturing Project'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${DEST_PILL[selectedDestinationBreakdown.composite]}`}>
                  {selectedDestinationBreakdown.composite}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  stageProgressPct === 100
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : stageProgressPct > 0
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {stageProgressPct === 100 ? 'Completed' : stageProgressPct > 0 ? 'In Progress' : 'Pending'}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight mt-1">
                Stage 11: Processing Plan & Vendor Assignment
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Allocate traceable grey rolls, configure process specifications, assign active dye/print processors, and generate Stage 12 Job Work Orders without premature stock deduction.
              </p>
            </div>
          </div>

          {/* Navigation & Context Badges */}
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

        {/* Linked Documents & Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-600 flex-wrap">
            <span className="flex items-center gap-1.5">
              <FileText size={14} className="text-blue-600" />
              <span><strong>{plans.length}</strong> Process Plans</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Truck size={14} className="text-purple-600" />
              <span><strong>{orders.length}</strong> Job Work Orders</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Box size={14} className="text-emerald-600" />
              <span><strong>{lots.length}</strong> Grey Takas in OSCAR</span>
            </span>
          </div>

          <div className="flex items-center gap-3 min-w-[200px]">
            <span className="text-[11px] font-bold text-slate-500">Stage Progress</span>
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${stageProgressPct}%` }}
              />
            </div>
            <span className="font-mono font-bold text-emerald-700">{stageProgressPct}%</span>
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
          8 QUANTITY SUMMARY CARDS
         ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* 1. Project Requirement */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Requirement</p>
          <p className="text-base font-black text-slate-900 mt-1 font-mono">{n(projectReq)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Customer target</p>
        </div>

        {/* 2. Available Grey Stock */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Available Grey</p>
          <p className="text-base font-black text-slate-900 mt-1 font-mono">{n(availableGrey)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Warehouse physical</p>
        </div>

        {/* 3. Allocated to Customer Project */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Customer Alloc</p>
          <p className="text-base font-black text-sky-800 mt-1 font-mono">{n(customerAllocated)}</p>
          <p className="text-[10px] text-sky-600 mt-0.5">Earmarked</p>
        </div>

        {/* 4. Allocated to Own Project */}
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Own Project Alloc</p>
          <p className="text-base font-black text-purple-800 mt-1 font-mono">{n(ownAllocated)}</p>
          <p className="text-[10px] text-purple-600 mt-0.5">Extra / Internal</p>
        </div>

        {/* 5. Planned for Processing */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Planned Qty</p>
          <p className="text-base font-black text-indigo-800 mt-1 font-mono">{n(plannedProcessing)}</p>
          <p className="text-[10px] text-indigo-600 mt-0.5">{plans.length} active plans</p>
        </div>

        {/* 6. Already Dispatched to Processor */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Dispatched (WIP)</p>
          <p className="text-base font-black text-amber-800 mt-1 font-mono">{n(dispatchedQty)}</p>
          <p className="text-[10px] text-amber-600 mt-0.5">Stage 12 outward</p>
        </div>

        {/* 7. Remaining Unallocated Grey Stock */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Remaining Grey</p>
          <p className="text-base font-black text-slate-800 mt-1 font-mono">{n(remainingGrey)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Free balance</p>
        </div>

        {/* 8. Stage Progress */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Stage Progress</p>
          <p className="text-base font-black text-emerald-800 mt-1 font-mono">{stageProgressPct}%</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            {stageProgressPct === 100 ? 'Verified' : 'Processing'}
          </p>
        </div>
      </div>

      {/* =========================================================================
          SECTION A & SECTION B SPLIT WORKSPACE
         ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* -----------------------------------------------------------------------
            SECTION A: SOURCE GREY STOCK & TAKA SELECTION (7 COLS)
           ----------------------------------------------------------------------- */}
        <div className="xl:col-span-7 rounded-2xl border border-[#dce5f4] bg-white p-4 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Box size={16} className="text-blue-600" />
                <span>Section A — Source Grey Stock & Taka Selection</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Select QC-passed takas to include in this processing plan. Zero physical stock is deducted at Stage 11.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllEligible}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                Select All Eligible
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="relative sm:col-span-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search PO, Lot, Taka..."
                value={takaSearch}
                onChange={(e) => setTakaSearch(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <select
              value={takaFabricFilter}
              onChange={(e) => setTakaFabricFilter(e.target.value)}
              className="py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Fabrics</option>
              {fabricOptions.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <select
              value={takaDestFilter}
              onChange={(e) => setTakaDestFilter(e.target.value)}
              className="py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Destinations</option>
              <option value="Customer Project">Customer Project</option>
              <option value="Own Project">Own Project</option>
            </select>

            <div className="flex items-center gap-1.5 justify-end">
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Available Only</span>
              </label>
            </div>
          </div>

          {/* Searchable Taka Selection Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="py-2.5 px-2.5 w-8 text-center" />
                  <th className="py-2.5 px-2.5">Source PO</th>
                  <th className="py-2.5 px-2.5">Fabric / Quality</th>
                  <th className="py-2.5 px-2">Design / Shade</th>
                  <th className="py-2.5 px-2">Lot & Taka #</th>
                  <th className="py-2.5 px-2 text-right">Available (m)</th>
                  <th className="py-2.5 px-2 text-center">QC Status</th>
                  <th className="py-2.5 px-2 text-center">Destination</th>
                  <th className="py-2.5 px-2 text-center">Selected (m)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLots.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No matching grey takas found. Ensure stock is received and QC passed.
                    </td>
                  </tr>
                ) : (
                  filteredLots.map((lot) => {
                    const isSelected = (selectedTakas[lot.id] || 0) > 0;
                    const isEligible = lot.isAllocatable ?? (lot.qcStatus === 'Passed');
                    const dest = lot.allocationType || 'Customer Project';
                    const maxQty = Number(lot.usable || lot.available || lot.totalStock || 0);

                    return (
                      <tr
                        key={lot.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-blue-50/40'
                            : !isEligible
                            ? 'bg-slate-50/50 text-slate-400 opacity-60'
                            : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-2 px-2.5 text-center">
                          <input
                            type="checkbox"
                            disabled={!isEligible || maxQty <= 0}
                            checked={isSelected}
                            onChange={() => handleToggleTaka(lot)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-2 px-2.5 font-mono text-slate-600 whitespace-nowrap">
                          {lot.sourcePoNumber || 'PO-GRN'}
                        </td>
                        <td className="py-2 px-2.5 font-medium text-slate-900 whitespace-nowrap">
                          <span>{lot.fabricName || lot.fabricQuality}</span>
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {lot.fabricQuality || 'Grey Standard'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                          <span>{lot.design || 'Plain'}</span>
                          <span className="text-[10px] text-slate-400 ml-1">({lot.shade || 'Grey'})</span>
                        </td>
                        <td className="py-2 px-2 font-mono whitespace-nowrap">
                          <span className="font-bold text-slate-800">{lot.lotNumber}</span>
                          <span className="text-slate-400 block text-[10px]">
                            {lot.takaNumber ? `Roll #${lot.takaNumber}` : lot.takaId || '—'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {n(maxQty)} m
                          {lot.weightKg && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {lot.weightKg} kg
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          {isEligible ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={10} />
                              <span>Passed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock size={10} />
                              <span>{lot.qcStatus || 'QC Hold'}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${DEST_PILL[dest] || DEST_PILL['Customer Project']}`}>
                            {dest === 'Customer Project' ? 'Customer' : 'Own'}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-center whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            max={maxQty}
                            disabled={!isEligible || maxQty <= 0}
                            value={selectedTakas[lot.id] || ''}
                            placeholder="0"
                            onChange={(e) => handleTakaQtyChange(lot.id, e.target.value, maxQty)}
                            className="w-16 text-center text-xs font-semibold py-1 px-1 rounded border border-slate-300 focus:border-blue-500 focus:outline-none bg-white shadow-2xs font-mono disabled:bg-slate-100 disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Taka Selection Subtotal & Destination Summary */}
          <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                Selected: {selectedTakaList.length} Takas / Rolls
              </span>
              <span className="font-mono font-extrabold text-blue-700 text-sm">
                ({n(totalSelectedMeters)} m)
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Customer: <strong>{n(selectedDestinationBreakdown.customer)} m</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>Own: <strong>{n(selectedDestinationBreakdown.own)} m</strong></span>
              </span>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------------
            SECTION B: PROCESSING DETAILS & VENDOR ASSIGNMENT (5 COLS)
           ----------------------------------------------------------------------- */}
        <div className="xl:col-span-5 rounded-2xl border border-[#dce5f4] bg-white p-4 shadow-2xs space-y-4">
          <div className="pb-1 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>Section B — Processing Details & Vendor Assignment</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Specify active agency masters, rate, loss formula, target shade, and responsible coordinator.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* 1. Processor / Vendor */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">
                  Processor / Vendor <span className="text-rose-500">*</span>
                </label>
                <MasterSourceLink source="vendors" />
              </div>
              <select
                value={form.processor}
                onChange={(e) => setForm((p) => ({ ...p, processor: e.target.value }))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
              >
                <option value="">Select Processor / Dyeing Mill…</option>
                {vendors.map((v) => (
                  <option key={v.id || v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Process Type */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">
                  Process Type <span className="text-rose-500">*</span>
                </label>
                <MasterSourceLink source="processes" />
              </div>
              <select
                value={form.process}
                onChange={handleProcessChange}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
              >
                <option value="">Select Process…</option>
                {processes.map((pr) => (
                  <option key={pr.id || pr.name} value={pr.name}>
                    {pr.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Target Shade */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Target Shade / Colour
              </label>
              <input
                type="text"
                placeholder="e.g. Navy Blue #19-4024"
                value={form.targetShade}
                onChange={(e) => setForm((p) => ({ ...p, targetShade: e.target.value }))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* 4. Processing Rate & UOM */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Processing Rate (₹)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.rate}
                  onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
                  className="flex-1 p-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={form.rateUom}
                  onChange={(e) => setForm((p) => ({ ...p, rateUom: e.target.value }))}
                  className="w-24 p-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 text-xs focus:outline-none"
                >
                  <option value="/ meter">/ meter</option>
                  <option value="/ kg">/ kg</option>
                </select>
              </div>
            </div>

            {/* 5. Expected Loss / Tolerance % */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Expected Loss %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="e.g. 2.50"
                value={form.expectedLoss}
                onChange={(e) => setForm((p) => ({ ...p, expectedLoss: e.target.value }))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* 6. Expected Return Date */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Expected Return Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                min={todayISO()}
                value={form.expectedReturnDate}
                onChange={(e) => setForm((p) => ({ ...p, expectedReturnDate: e.target.value }))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* 7. Responsible Production Coordinator */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">
                  Production Coordinator
                </label>
                <MasterSourceLink source="employees" />
              </div>
              <select
                value={form.assignedCoordinator}
                onChange={(e) => setForm((p) => ({ ...p, assignedCoordinator: e.target.value }))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Select Coordinator…</option>
                {employees.map((em) => (
                  <option key={em.id || em.name} value={em.name}>
                    {em.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 8. Priority */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-semibold"
              >
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* 10. Expected Return Quantity (Calculated) */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Calculated Return Qty
              </label>
              <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50/70 font-mono font-bold text-emerald-800 flex items-center justify-between">
                <span>{n(expectedReturnMeters)} m</span>
                <span className="text-[10px] text-emerald-600 font-sans font-normal">
                  (Loss: {lossPct}%)
                </span>
              </div>
            </div>

            {/* 9. Processing Instructions / Remarks */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Processing Instructions / Remarks
              </label>
              <textarea
                rows={2}
                placeholder="Enter specific shade reference, chemical tolerance, packaging specifications..."
                value={form.remarks}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* =========================================================================
              PROCESSING PLAN ACTIONS BAR (PART 2.F)
             ========================================================================= */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={busyAction}
              onClick={() => {
                const validationMsg = validatePlanFields();
                if (validationMsg) toast.error(validationMsg);
                else toast.success('Plan validation passed! Ready to save or dispatch.');
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              Validate Plan
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => handleSavePlan('Draft')}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Save Draft
              </button>

              <button
                type="button"
                disabled={busyAction}
                onClick={() => handleSavePlan('Active')}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              >
                Submit / Approve Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PART 3 — ACTIVE PROCESS PLANS TABLE (14 COLUMNS)
         ========================================================================= */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              <span>Part 3 — Active Process Plans for Project {code}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              14-column traceable register. Convert approved plans into Stage 12 Job Work Orders with physical dispatch tracking.
            </p>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {plans.length} Registered Plans
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="p-3">Plan No</th>
                <th className="p-3">Project</th>
                <th className="p-3">Source PO</th>
                <th className="p-3">Source Lot / Taka</th>
                <th className="p-3">Fabric / Quality</th>
                <th className="p-3">Destination</th>
                <th className="p-3 text-center">Rolls</th>
                <th className="p-3 text-right">Planned (m)</th>
                <th className="p-3">Process</th>
                <th className="p-3">Processor</th>
                <th className="p-3">Target Shade</th>
                <th className="p-3 text-right">Rate & UOM</th>
                <th className="p-3">Return Date</th>
                <th className="p-3 text-center">Status & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-10 text-center text-slate-400">
                    No processing plans created for {code} yet. Complete Sections A & B above to generate one.
                  </td>
                </tr>
              ) : (
                plans.map((p) => {
                  const rateVal = (p.charges || []).reduce((s, c) => s + Number(c.rate || 0), 0);
                  const linkedJwo = orders.find((o) => o.processPlanId === p.id);
                  const takasCount = Array.isArray(p.selectedTakas)
                    ? p.selectedTakas.length
                    : p.noOfRolls || 1;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* 1. Plan Number */}
                      <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {p.planNo}
                      </td>

                      {/* 2. Project Code */}
                      <td className="p-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {p.projectCode || code}
                      </td>

                      {/* 3. Source PO */}
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {(p.selectedTakas?.[0]?.sourcePoNumber) || 'PO-GRN'}
                      </td>

                      {/* 4. Source Lot / Taka */}
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                        <span className="font-bold text-slate-800">{p.greyLotNo || '—'}</span>
                        {p.takaRollNo && (
                          <span className="block text-[10px] text-slate-400">
                            Takas: {p.takaRollNo}
                          </span>
                        )}
                      </td>

                      {/* 5. Fabric / Quality */}
                      <td className="p-3 font-medium whitespace-nowrap">
                        <span>{p.fabricItem || 'Grey Fabric'}</span>
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {p.fabricQuality}
                        </span>
                      </td>

                      {/* 6. Destination */}
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${DEST_PILL[p.projectDestination] || DEST_PILL['Customer Project']}`}>
                          {p.projectDestination || 'Customer Project'}
                        </span>
                      </td>

                      {/* 7. Rolls Count */}
                      <td className="p-3 text-center font-mono font-bold whitespace-nowrap">
                        {takasCount}
                      </td>

                      {/* 8. Planned Quantity */}
                      <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {n(p.expectedQty)} m
                      </td>

                      {/* 9. Process Type */}
                      <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                        {p.process || '—'}
                      </td>

                      {/* 10. Processor */}
                      <td className="p-3 font-medium text-slate-800 whitespace-nowrap">
                        {p.vendor || '—'}
                      </td>

                      {/* 11. Target Shade */}
                      <td className="p-3 text-slate-700 whitespace-nowrap">
                        {p.shade || '—'}
                      </td>

                      {/* 12. Rate & UOM */}
                      <td className="p-3 text-right font-mono whitespace-nowrap">
                        {rateVal > 0 ? `₹${n(rateVal)} / m` : '—'}
                      </td>

                      {/* 13. Return Date */}
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {p.expectedCompletionDate || '—'}
                      </td>

                      {/* 14. Status & Actions */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_PILL[p.status] || STATUS_PILL.Draft}`}>
                            {p.status}
                          </span>

                          <button
                            type="button"
                            onClick={() => setViewPlanModal(p)}
                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                            title="View Plan Details"
                          >
                            <Eye size={14} />
                          </button>

                          {p.status === 'Draft' && (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => handleApprovePlan(p)}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                              title="Approve Plan"
                            >
                              Approve
                            </button>
                          )}

                          {linkedJwo ? (
                            <button
                              type="button"
                              onClick={() => onSelectStage && onSelectStage(12)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[10px] font-bold cursor-pointer"
                              title={`Linked to JWO: ${linkedJwo.jwoNo}`}
                            >
                              <span>{linkedJwo.jwoNo}</span>
                              <ExternalLink size={10} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => setConfirmJwoModal(p)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shadow-2xs cursor-pointer"
                              title="Create Stage 12 JWO"
                            >
                              <Send size={10} />
                              <span>Create JWO</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          VIEW PLAN DETAILS MODAL
         ========================================================================= */}
      {viewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  <span>Processing Plan Details — {viewPlanModal.planNo}</span>
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Linked to Project {code} ({viewPlanModal.projectDestination || 'Customer Project'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewPlanModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">PROCESSOR</span>
                <span className="font-bold text-slate-800">{viewPlanModal.vendor || '—'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">PROCESS TYPE</span>
                <span className="font-bold text-slate-800">{viewPlanModal.process || '—'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">TARGET SHADE</span>
                <span className="font-bold text-slate-800">{viewPlanModal.shade || '—'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">PLANNED METRES</span>
                <span className="font-bold text-blue-700 font-mono">{n(viewPlanModal.expectedQty)} m</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">EXPECTED LOSS</span>
                <span className="font-bold text-amber-700 font-mono">{viewPlanModal.expectedLoss}%</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">EXPECTED RETURN</span>
                <span className="font-bold text-emerald-700 font-mono">{n(viewPlanModal.expectedReturnQty)} m</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">RETURN DATE</span>
                <span className="font-bold text-slate-800">{viewPlanModal.expectedCompletionDate || '—'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">COORDINATOR</span>
                <span className="font-bold text-slate-800">{viewPlanModal.assignedEmployee || '—'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">PRIORITY</span>
                <span className="font-bold text-slate-800">{viewPlanModal.priority || 'Normal'}</span>
              </div>
            </div>

            {/* Selected Takas Table in Modal */}
            {Array.isArray(viewPlanModal.selectedTakas) && viewPlanModal.selectedTakas.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Assigned Grey Takas / Rolls ({viewPlanModal.selectedTakas.length})
                </span>
                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 font-bold text-slate-600">
                      <tr>
                        <th className="p-2">PO #</th>
                        <th className="p-2">Lot #</th>
                        <th className="p-2">Taka / Roll #</th>
                        <th className="p-2">Destination</th>
                        <th className="p-2 text-right">Metres</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {viewPlanModal.selectedTakas.map((tk, idx) => (
                        <tr key={idx}>
                          <td className="p-2 text-slate-600">{tk.sourcePoNumber || 'PO-GRN'}</td>
                          <td className="p-2 font-bold">{tk.lotNumber}</td>
                          <td className="p-2">{tk.takaNumber || tk.takaId || '—'}</td>
                          <td className="p-2 font-sans">
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${DEST_PILL[tk.allocationType] || DEST_PILL['Customer Project']}`}>
                              {tk.allocationType || 'Customer Project'}
                            </span>
                          </td>
                          <td className="p-2 text-right font-bold text-blue-700">{n(tk.meters)} m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewPlanModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONFIRM JWO CREATION MODAL
         ========================================================================= */}
      {confirmJwoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex items-center gap-3 text-blue-600">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <Truck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Generate Stage 12 Job Work Order?
                </h3>
                <p className="text-[11px] text-slate-500">
                  Plan: <span className="font-mono font-bold text-blue-700">{confirmJwoModal.planNo}</span>
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span>Processor:</span>
                <strong className="text-slate-900">{confirmJwoModal.vendor}</strong>
              </div>
              <div className="flex justify-between">
                <span>Process Type:</span>
                <strong className="text-slate-900">{confirmJwoModal.process}</strong>
              </div>
              <div className="flex justify-between">
                <span>Planned Quantity:</span>
                <strong className="text-blue-700 font-mono">{n(confirmJwoModal.expectedQty)} m</strong>
              </div>
              <div className="flex justify-between">
                <span>Destination:</span>
                <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${DEST_PILL[confirmJwoModal.projectDestination] || DEST_PILL['Customer Project']}`}>
                  {confirmJwoModal.projectDestination || 'Customer Project'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              This will create a Job Work Order linked to this project and navigate directly to Stage 12 (Job Work Outward) for dispatch confirmation.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmJwoModal(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => handleCreateJWOAndContinue(confirmJwoModal)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Send size={13} />
                <span>Confirm & Open Stage 12</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProcessPlanStageWorkspace;