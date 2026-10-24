import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Box,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Package,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Tag,
  Trash2,
  Truck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  fetchStage15QCStockData,
  submitStage15QCInspection,
  approveStage15QCInspection,
  allocateStage15Stock,
  releaseStage15Allocation,
  errorMessage,
} from '../../../../services/jobWorkSync';
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

const QC_STATUS_PILL = {
  Passed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'QC Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  'On Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  Hold: 'bg-amber-50 text-amber-700 border-amber-200',
  Pending: 'bg-slate-100 text-slate-700 border-slate-200',
  'Second Quality': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Reprocess: 'bg-orange-50 text-orange-700 border-orange-200',
  Reject: 'bg-rose-50 text-rose-700 border-rose-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ALLOC_STATUS_PILL = {
  'Fully Allocated': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Partially Allocated': 'bg-blue-50 text-blue-700 border-blue-200',
  Unallocated: 'bg-teal-50 text-teal-700 border-teal-200',
  'Not Eligible': 'bg-slate-100 text-slate-500 border-slate-200',
};

export function Stage15QualityStockWorkspace({
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
  const stageSeq = stage?.sequence || 15;
  const stageName = stage?.name || 'Stage 15 — Quality Check & Stock Allocation';

  // Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workspaceData, setWorkspaceData] = useState(null);

  // Tab navigation
  const [activeTab, setActiveTab] = useState('sectionA'); // sectionA | sectionB | sectionC | sectionD

  // Filters for Section A (Received Fabric & QC Inspection)
  const [searchFilter, setSearchFilter] = useState('');
  const [qcStatusFilter, setQcStatusFilter] = useState('ALL');
  const [allocStatusFilter, setAllocStatusFilter] = useState('ALL');

  // Modals state
  const [isQCModalOpen, setIsQCModalOpen] = useState(false);
  const [isAllocModalOpen, setIsAllocModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [releasingAllocationId, setReleasingAllocationId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // QC Inspection Form State
  const [qcInspectionMode, setQcInspectionMode] = useState('astm'); // 'astm' | 'standard'
  const [qcSelectedTakaId, setQcSelectedTakaId] = useState('');
  const [qcInspectionDate, setQcInspectionDate] = useState(todayISO());
  const [qcRollMeter, setQcRollMeter] = useState('');
  const [qcRollWidth, setQcRollWidth] = useState('44');
  const [qcDefects, setQcDefects] = useState([]);
  const [qcNotes, setQcNotes] = useState('');
  const [qcQualityGrade, setQcQualityGrade] = useState('Grade A');

  // Standard QC Form State
  const [stdGoodQty, setStdGoodQty] = useState('');
  const [stdSecondQty, setStdSecondQty] = useState('0');
  const [stdReprocessQty, setStdReprocessQty] = useState('0');
  const [stdRejectQty, setStdRejectQty] = useState('0');
  const [stdHoldQty, setStdHoldQty] = useState('0');

  // Stock Allocation Form State
  const [allocTakaId, setAllocTakaId] = useState('');
  const [allocType, setAllocType] = useState('Customer Project');
  const [allocQuantity, setAllocQuantity] = useState('');
  const [allocRemarks, setAllocRemarks] = useState('');

  // Load Stage 15 workspace data from backend
  const loadWorkspaceData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchStage15QCStockData(projectId);
      setWorkspaceData(res);
    } catch (err) {
      console.error('Failed to load Stage 15 workspace data:', err);
      setError(errorMessage(err, 'Failed to load Quality Check & Stock Allocation workspace data.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Derived summaries from backend dataset
  const summary = workspaceData?.summary || {
    totalInwardQty: 0,
    qcPendingQty: 0,
    qcPassedQty: 0,
    qcHoldQty: 0,
    qcRejectedQty: 0,
    customerAllocatedQty: 0,
    ownAllocatedQty: 0,
    availableForAllocation: 0,
    targetRequirementMeters: Number(project?.requirement_meters || project?.quantity || 3000),
    uom: 'Meters',
  };

  const inwardTakas = useMemo(() => workspaceData?.inwardTakas || [], [workspaceData]);
  const inspections = useMemo(() => workspaceData?.inspections || [], [workspaceData]);
  const allocations = useMemo(() => workspaceData?.allocations || [], [workspaceData]);
  const defectMaster = useMemo(() => workspaceData?.defectMaster || [], [workspaceData]);

  // ASTM 4-Point Penalty Calculation
  const calcASTM = useCallback((actualMeterVal, widthVal, defectsArr) => {
    const actualMeter = Number(actualMeterVal) || 0;
    const widthInches = Number(widthVal) || 44;
    const widthMeters = widthInches * 0.0254;
    const area = actualMeter * widthMeters;
    const totalPoints = (defectsArr || []).reduce(
      (acc, d) => acc + (Number(d.points) || 1) * (Number(d.count) || 1),
      0
    );
    const ptsPer100M = area > 0 ? Number(((totalPoints * 100) / area).toFixed(2)) : 0;
    let grade = 'A';
    let disposition = 'Pass';
    if (ptsPer100M <= 20) {
      grade = 'A';
      disposition = 'Pass';
    } else if (ptsPer100M <= 28) {
      grade = 'B';
      disposition = 'Pass';
    } else if (ptsPer100M <= 40) {
      grade = 'C';
      disposition = 'Second Quality';
    } else {
      grade = 'Second Quality';
      disposition = 'Reject';
    }
    return { totalPoints, ptsPer100M, grade, disposition, areaM2: area.toFixed(2) };
  }, []);

  // Filtered inward takas for Section A
  const filteredTakas = useMemo(() => {
    return inwardTakas.filter((t) => {
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        const matches =
          t.takaNumber?.toLowerCase().includes(q) ||
          t.lotNumber?.toLowerCase().includes(q) ||
          t.takaId?.toLowerCase().includes(q) ||
          t.inwardNumber?.toLowerCase().includes(q) ||
          t.jwoNumber?.toLowerCase().includes(q) ||
          t.vendorName?.toLowerCase().includes(q) ||
          t.fabricName?.toLowerCase().includes(q) ||
          t.fabricQuality?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (qcStatusFilter !== 'ALL') {
        const isMatch =
          qcStatusFilter === 'Passed'
            ? t.qcStatus === 'Passed' || t.qcStatus === 'Pass'
            : qcStatusFilter === 'Hold'
            ? t.qcStatus === 'QC Hold' || t.qcStatus === 'Hold' || t.qcStatus === 'On Hold'
            : qcStatusFilter === 'Rejected'
            ? t.qcStatus === 'Reject' || t.qcStatus === 'Rejected'
            : t.qcStatus === 'Pending';
        if (!isMatch) return false;
      }
      if (allocStatusFilter !== 'ALL') {
        if (t.allocationStatus !== allocStatusFilter) return false;
      }
      return true;
    });
  }, [inwardTakas, searchFilter, qcStatusFilter, allocStatusFilter]);

  // Open QC Inspection modal for specific taka
  const handleOpenQCForTaka = (taka) => {
    setQcSelectedTakaId(taka.lotTakaId || taka.id);
    setQcRollMeter(String(taka.receivedMeters || taka.availableQuantity || 100));
    setQcRollWidth(String(taka.width || 44));
    setQcDefects([]);
    setQcNotes('');
    setQcInspectionDate(todayISO());
    setStdGoodQty(String(taka.receivedMeters || taka.availableQuantity || 100));
    setStdSecondQty('0');
    setStdReprocessQty('0');
    setStdRejectQty('0');
    setStdHoldQty('0');
    setIsQCModalOpen(true);
  };

  // Open Stock Allocation modal for specific taka
  const handleOpenAllocForTaka = (taka) => {
    setAllocTakaId(taka.lotTakaId || taka.id);
    setAllocQuantity(String(taka.remainingEligibleQty || taka.availableQuantity || 0));
    setAllocType('Customer Project');
    setAllocRemarks('');
    setIsAllocModalOpen(true);
  };

  // Add Defect Row to ASTM inspector
  const handleAddDefect = (defectItem) => {
    setQcDefects((prev) => [
      ...prev,
      {
        defectId: defectItem.id,
        defectCode: defectItem.code,
        defectName: defectItem.name,
        category: defectItem.category,
        severity: defectItem.severity,
        points: defectItem.defaultPoints || (defectItem.severity === 'Critical' ? 4 : defectItem.severity === 'Major' ? 3 : 1),
        count: 1,
        distanceMeter: '',
      },
    ]);
  };

  // Submit QC Inspection (Save Draft vs Approve)
  const handleSubmitQCInspection = async (approveImmediate) => {
    if (!qcSelectedTakaId) {
      toast.error('Please select a fabric roll/taka to inspect.');
      return;
    }
    const selTaka = inwardTakas.find((t) => (t.lotTakaId || t.id) === qcSelectedTakaId);
    if (!selTaka) {
      toast.error('Selected taka record was not found.');
      return;
    }

    setSubmitting(true);
    try {
      let linesPayload = [];
      let qualGrade = qcQualityGrade;
      let notes = qcNotes;

      if (qcInspectionMode === 'astm') {
        const actualM = Number(qcRollMeter) || selTaka.receivedMeters || 100;
        const calc = calcASTM(actualM, qcRollWidth, qcDefects);
        qualGrade = `Grade ${calc.grade}`;
        linesPayload = [
          {
            lotTakaId: selTaka.lotTakaId || selTaka.id,
            takaNo: selTaka.takaNumber || '1',
            lotNo: selTaka.lotNumber || 'LOT-1',
            actualMeter: actualM,
            width: Number(qcRollWidth) || 44,
            grade: calc.grade,
            disposition: calc.disposition,
            penaltyPoints: calc.totalPoints,
            pointsPer100SqMeter: calc.ptsPer100M,
            remarks: qcNotes,
            defects: qcDefects.map((d) => ({
              defect_id: d.defectId,
              defect_count: Number(d.count) || 1,
              points: Number(d.points) || 1,
              distance_meter: d.distanceMeter ? Number(d.distanceMeter) : null,
              remarks: `${d.defectName} (${d.severity})`,
            })),
          },
        ];
      } else {
        // Standard QC mode
        const gQty = Number(stdGoodQty) || 0;
        const secQty = Number(stdSecondQty) || 0;
        const repQty = Number(stdReprocessQty) || 0;
        const rejQty = Number(stdRejectQty) || 0;
        const hldQty = Number(stdHoldQty) || 0;
        const tot = gQty + secQty + repQty + rejQty + hldQty;

        let disp = 'Pass';
        if (gQty > 0 && rejQty === 0 && secQty === 0) disp = 'Pass';
        else if (secQty > 0) disp = 'Second Quality';
        else if (repQty > 0) disp = 'Reprocess';
        else if (rejQty > 0) disp = 'Reject';
        else if (hldQty > 0) disp = 'Hold';

        linesPayload = [
          {
            lotTakaId: selTaka.lotTakaId || selTaka.id,
            takaNo: selTaka.takaNumber || '1',
            lotNo: selTaka.lotNumber || 'LOT-1',
            actualMeter: tot || selTaka.receivedMeters,
            width: Number(qcRollWidth) || 44,
            grade: qualGrade,
            disposition: disp,
            remarks: qcNotes,
          },
        ];
      }

      const payload = {
        inward_id: selTaka.inwardId,
        inspection_date: qcInspectionDate,
        inspection_method: qcInspectionMode === 'astm' ? 'ASTM 4-Point Inspection (D5430)' : 'Standard Receipt QC',
        quality_grade: qualGrade,
        notes: notes,
        lines: linesPayload,
        approve: approveImmediate,
      };

      if (approveImmediate) {
        await approveStage15QCInspection(projectId, payload);
        toast.success(`QC Approved! Stock moved from QC Hold to Warehouse (WH-MAIN) and marked available for allocation.`);
      } else {
        await submitStage15QCInspection(projectId, payload);
        toast.success(`QC Inspection draft saved successfully.`);
      }

      setIsQCModalOpen(false);
      await loadWorkspaceData();
      onUpdated?.();
    } catch (err) {
      console.error('Failed to post QC inspection:', err);
      toast.error(errorMessage(err, 'Failed to submit QC inspection.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Stock Allocation
  const handleSubmitStockAllocation = async () => {
    if (!allocTakaId) {
      toast.error('Please select an eligible QC-passed taka.');
      return;
    }
    const selTaka = inwardTakas.find((t) => (t.lotTakaId || t.id) === allocTakaId);
    if (!selTaka) {
      toast.error('Selected taka was not found.');
      return;
    }

    const qty = Number(allocQuantity);
    if (!qty || qty <= 0) {
      toast.error('Allocation quantity must be greater than zero.');
      return;
    }

    const maxEligible = Number(selTaka.remainingEligibleQty || selTaka.availableQuantity || 0);
    if (qty > maxEligible) {
      toast.error(`Cannot allocate ${n(qty)} M. Maximum unallocated eligible yardage on this roll is ${n(maxEligible)} M.`);
      return;
    }

    setSubmitting(true);
    try {
      await allocateStage15Stock(projectId, {
        lot_taka_id: selTaka.lotTakaId || selTaka.id,
        quantity: qty,
        allocation_type: allocType,
        remarks: allocRemarks,
      });

      toast.success(`${n(qty)} Meters successfully allocated to ${allocType}!`);
      setIsAllocModalOpen(false);
      await loadWorkspaceData();
      onUpdated?.();
    } catch (err) {
      console.error('Failed to allocate stock:', err);
      toast.error(errorMessage(err, 'Stock allocation failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Release Allocation
  const handleReleaseAllocation = async (allocationId) => {
    if (!window.confirm('Are you sure you want to release this allocation? The reserved meters will return to unallocated available stock.')) {
      return;
    }
    setSubmitting(true);
    try {
      await releaseStage15Allocation(projectId, allocationId);
      toast.info('Allocation released successfully.');
      await loadWorkspaceData();
      onUpdated?.();
    } catch (err) {
      console.error('Failed to release allocation:', err);
      toast.error(errorMessage(err, 'Failed to release allocation.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Progress metrics
  const targetReq = Number(summary.targetRequirementMeters || 3000);
  const custAlloc = Number(summary.customerAllocatedQty || 0);
  const allocPct = targetReq > 0 ? Math.min(100, Math.round((custAlloc / targetReq) * 100)) : 0;

  // Active Stage Status
  const stageStatus =
    custAlloc >= targetReq && targetReq > 0 && summary.qcPassedQty > 0
      ? 'Completed'
      : custAlloc > 0
      ? 'Partially Allocated'
      : summary.qcPassedQty > 0
      ? 'QC Passed'
      : summary.totalInwardQty > 0
      ? 'In Progress'
      : 'Pending';

  return (
    <div className="space-y-4">
      {/* 1. STAGE 15 LIFECYCLE HEADER (Matches Stage 11 & Stage 14 exactly) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Stage {stageSeq}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                QC_STOCK_ALLOCATION
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                Warehouse Godown (WH-MAIN)
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  stageStatus === 'Completed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : stageStatus === 'Partially Allocated'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : stageStatus === 'QC Passed'
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : stageStatus === 'In Progress'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {stageStatus}
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-emerald-600" size={22} />
              Stage {stageSeq} — Quality Check & Stock Allocation
            </h2>
            <p className="text-xs text-slate-500">
              Project <span className="font-semibold text-slate-800">{code}</span> &bull; Finished Goods piece-by-piece QC inspection (ASTM 4-Point), dock disposition, and customer vs own project stock allocation.
            </p>

            {/* Refresh */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={loadWorkspaceData}
                disabled={loading}
                className="text-xs h-7 px-2.5"
              >
                <RefreshCw size={13} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Right Metrics & Progress Bar */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 min-w-[280px]">
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
              <span className="font-medium">QC Status:</span>
              <span className="font-semibold text-emerald-700 font-mono">
                {n(summary.qcPassedQty)} / {n(summary.totalInwardQty)} M Passed
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-medium">Allocated:</span>
              <span className="font-semibold text-indigo-700 font-mono">
                {n(summary.customerAllocatedQty)} M
              </span>
            </div>

            <div className="w-full space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-600">Customer Allocation Progress</span>
                <span className="font-mono font-bold text-slate-900">{allocPct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${allocPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 text-right">
                Target Requirement: <span className="font-semibold text-slate-800">{n(targetReq)} M</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY KPI CARDS (8 Cards matching exact layout of Stage 11 & Stage 14) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* Card 1: Total Inward Qty */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between text-blue-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Total Inward Qty</span>
            <Box size={16} />
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">{n(summary.totalInwardQty)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Stage 14 dock received</div>
        </div>

        {/* Card 2: QC Pending Qty */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">QC Pending</span>
            <Clock size={16} />
          </div>
          <div className="text-lg font-bold font-mono text-amber-700">{n(summary.qcPendingQty)}</div>
          <div className="text-[11px] text-amber-600/80 mt-0.5 font-medium">Awaiting inspection</div>
        </div>

        {/* Card 3: QC Passed Qty */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">QC Passed</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-700">{n(summary.qcPassedQty)}</div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5 font-medium">Accepted (Grade A/B)</div>
        </div>

        {/* Card 4: QC Hold Qty */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-orange-300 transition-colors">
          <div className="flex items-center justify-between text-orange-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">QC Hold</span>
            <AlertTriangle size={16} />
          </div>
          <div className="text-lg font-bold font-mono text-orange-700">{n(summary.qcHoldQty)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">In SYS-QC-HOLD</div>
        </div>

        {/* Card 5: QC Rejected Qty */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-rose-300 transition-colors">
          <div className="flex items-center justify-between text-rose-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">QC Rejected</span>
            <XCircle size={16} />
          </div>
          <div className="text-lg font-bold font-mono text-rose-700">{n(summary.qcRejectedQty)}</div>
          <div className="text-[11px] text-rose-600/80 mt-0.5 font-medium">Failed grading</div>
        </div>

        {/* Card 6: Customer Project Allocated */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between text-indigo-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Customer Alloc.</span>
            <User size={16} />
          </div>
          <div className="text-lg font-bold font-mono text-indigo-700">{n(summary.customerAllocatedQty)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ready for Dispatch</div>
        </div>

        {/* Card 7: Own Project Allocated */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-purple-300 transition-colors">
          <div className="flex items-center justify-between text-purple-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Own Project Alloc.</span>
            <Building size={16} />
          </div>
          <div className="text-lg font-bold font-mono text-purple-700">{n(summary.ownAllocatedQty)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Internal / Stock</div>
        </div>

        {/* Card 8: Available for Allocation */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between text-teal-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Available to Alloc.</span>
            <Layers size={16} />
          </div>
          <div className="text-lg font-bold font-mono text-teal-700">{n(summary.availableForAllocation)}</div>
          <div className="text-[11px] text-teal-600/80 mt-0.5 font-medium">QC passed unreserved</div>
        </div>
      </div>

      {/* 3. MAIN OPERATIONAL CARD & TABBED WORKSPACE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header with Title, Action Buttons */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Quality Check & Stock Allocation Workspace
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect inward rolls with ASTM 4-point grading, post dock disposition, and manage customer versus own-project stock reservations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (inwardTakas.length > 0) {
                  handleOpenQCForTaka(inwardTakas[0]);
                } else {
                  toast.warning('No inward fabric rolls found for this project.');
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 shadow-xs"
            >
              <ShieldCheck size={14} className="mr-1.5" />
              Perform QC Inspection
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const passedTaka = inwardTakas.find((t) => (t.qcStatus === 'Passed' || t.qcStatus === 'Pass') && (t.remainingEligibleQty > 0));
                if (passedTaka) {
                  handleOpenAllocForTaka(passedTaka);
                } else {
                  toast.warning('No unallocated QC-passed fabric rolls currently available to allocate.');
                }
              }}
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs h-8 px-3 shadow-xs"
            >
              <Package size={14} className="mr-1.5" />
              Allocate QC-Passed Stock
            </Button>
          </div>
        </div>

        {/* Tab Navigation (Matching Stage 11 & Stage 14) */}
        <div className="border-b border-slate-200 px-4 sm:px-5 flex gap-2 sm:gap-4 overflow-x-auto text-xs font-semibold bg-slate-50/30">
          <button
            onClick={() => setActiveTab('sectionA')}
            className={`py-3 px-2 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'sectionA'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert size={14} />
            Section A — Received Fabric & Quality Inspection ({inwardTakas.length})
          </button>
          <button
            onClick={() => setActiveTab('sectionB')}
            className={`py-3 px-2 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'sectionB'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck size={14} />
            Section B — QC Results & Inspection History ({inspections.length})
          </button>
          <button
            onClick={() => setActiveTab('sectionC')}
            className={`py-3 px-2 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'sectionC'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={14} />
            Section C — QC-Passed Fabric & Stock Allocation
          </button>
          <button
            onClick={() => setActiveTab('sectionD')}
            className={`py-3 px-2 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'sectionD'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award size={14} />
            Section D — Allocation History ({allocations.length})
          </button>
        </div>

        {/* Tab 1: Section A — Received Fabric & Quality Inspection */}
        {activeTab === 'sectionA' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between text-xs">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search fabric, lot, taka, JWO, inward, vendor..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px] font-medium">QC Status:</span>
                  <select
                    value={qcStatusFilter}
                    onChange={(e) => setQcStatusFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white text-slate-700"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Pending">Pending Inspection</option>
                    <option value="Passed">QC Passed</option>
                    <option value="Hold">On Hold</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px] font-medium">Allocation:</span>
                  <select
                    value={allocStatusFilter}
                    onChange={(e) => setAllocStatusFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white text-slate-700"
                  >
                    <option value="ALL">All Allocations</option>
                    <option value="Fully Allocated">Fully Allocated</option>
                    <option value="Partially Allocated">Partially Allocated</option>
                    <option value="Unallocated">Unallocated (Eligible)</option>
                    <option value="Not Eligible">Not Eligible (Pending/Hold)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Inward Takas Table */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Inward Receipt</th>
                    <th className="py-2.5 px-3">JWO & Vendor</th>
                    <th className="py-2.5 px-3">Fabric & Quality</th>
                    <th className="py-2.5 px-3">Design / Shade</th>
                    <th className="py-2.5 px-3">Lot / Taka No</th>
                    <th className="py-2.5 px-3 text-right">Received (M)</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3 text-center">QC Status</th>
                    <th className="py-2.5 px-3 text-center">Allocation Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTakas.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-slate-400">
                        No inward rolls match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTakas.map((taka, idx) => {
                      const isQCApproved = taka.qcStatus === 'Passed' || taka.qcStatus === 'Pass';
                      const isQCPending = taka.qcStatus === 'Pending' || taka.qcStatus === 'QC Hold';
                      const hasUnallocated = taka.remainingEligibleQty > 0;

                      return (
                        <tr key={taka.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            <div>{taka.inwardNumber}</div>
                            <div className="text-[10px] font-sans font-normal text-slate-400">{taka.inwardDate}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{taka.jwoNumber}</div>
                            <div className="text-[11px] text-slate-500">{taka.vendorName}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{taka.fabricName}</div>
                            <div className="text-[11px] text-slate-500">{taka.fabricQuality}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-slate-700">{taka.shade || 'Natural'}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <div className="font-semibold text-slate-900">{taka.lotNumber}</div>
                            <div className="text-[11px] text-slate-500">Taka: {taka.takaNumber}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {n(taka.receivedMeters)} M
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                              {taka.locationCode || 'SYS-QC-HOLD'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                QC_STATUS_PILL[taka.qcStatus] || QC_STATUS_PILL['Pending']
                              }`}
                            >
                              {taka.qcStatus || 'Pending'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                ALLOC_STATUS_PILL[taka.allocationStatus] || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {taka.allocationStatus}
                            </span>
                            {taka.totalAllocatedQty > 0 && (
                              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                {n(taka.customerAllocatedQty)}M Cust &bull; {n(taka.ownAllocatedQty)}M Own
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isQCPending && (
                                <button
                                  onClick={() => handleOpenQCForTaka(taka)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                                >
                                  <ShieldCheck size={12} />
                                  Start QC
                                </button>
                              )}
                              {isQCApproved && hasUnallocated && (
                                <button
                                  onClick={() => handleOpenAllocForTaka(taka)}
                                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                                >
                                  <Package size={12} />
                                  Allocate
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenQCForTaka(taka)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                                title="Inspect or re-check roll"
                              >
                                <Eye size={13} />
                              </button>
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
        )}

        {/* Tab 2: Section B — QC Results & Inspection History */}
        {activeTab === 'sectionB' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                Showing all saved inspection runs, penalty scoring, and dock dispositions:
              </span>
              <span className="text-slate-400 font-mono">{inspections.length} Inspection Records</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-xs text-left border-collapse min-w-[950px]">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">QC Inspection No</th>
                    <th className="py-2.5 px-3">Inward Receipt</th>
                    <th className="py-2.5 px-3">Inspection Date</th>
                    <th className="py-2.5 px-3">Inspector</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3 text-right">Inspected (M)</th>
                    <th className="py-2.5 px-3 text-right">Passed (M)</th>
                    <th className="py-2.5 px-3 text-right">Hold (M)</th>
                    <th className="py-2.5 px-3 text-right">Rejected (M)</th>
                    <th className="py-2.5 px-3 text-center">Quality Grade</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {inspections.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-8 text-slate-400">
                        No inspection records logged yet. Click &ldquo;Perform QC Inspection&rdquo; to start.
                      </td>
                    </tr>
                  ) : (
                    inspections.map((insp) => (
                      <tr key={insp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {insp.inspectionNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {insp.sourceDocumentNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{insp.inspectionDate}</td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">{insp.inspectorName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{insp.inspectionMethod}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {n(insp.totalInspectedQty)} M
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {n(insp.passedQty)} M
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                          {n(insp.holdQty)} M
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                          {n(insp.rejectedQty)} M
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {insp.qualityGrade || 'Grade A'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              insp.status === 'Approved'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {insp.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedInspection(insp);
                              setIsDetailsModalOpen(true);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-xs ml-auto cursor-pointer"
                          >
                            <Eye size={12} />
                            View Lines
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Section C — QC-Passed Fabric & Stock Allocation */}
        {activeTab === 'sectionC' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Customer Requirement vs Allocation Balance Banner */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                  <User size={14} />
                  Customer Order Requirement Balance:
                </div>
                <div className="text-base font-bold text-slate-900">
                  Target Requirement: <span className="font-mono text-indigo-800">{n(targetReq)} Meters</span>
                </div>
                <div className="text-xs text-slate-600">
                  Allocated to Customer Project: <span className="font-semibold text-emerald-700 font-mono">{n(custAlloc)} M</span> &bull; Remaining Target Balance: <span className="font-semibold text-rose-700 font-mono">{n(Math.max(0, targetReq - custAlloc))} M</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Unreserved QC Passed Stock</div>
                  <div className="text-base font-bold font-mono text-teal-700">{n(summary.availableForAllocation)} M</div>
                </div>
              </div>
            </div>

            {/* Eligible QC Passed Takas Ready for Allocation */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-xs text-left border-collapse min-w-[950px]">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Fabric & Quality</th>
                    <th className="py-2.5 px-3">Source Lot / Taka</th>
                    <th className="py-2.5 px-3">Source Inward</th>
                    <th className="py-2.5 px-3 text-right">QC Accepted (M)</th>
                    <th className="py-2.5 px-3 text-right">Customer Alloc (M)</th>
                    <th className="py-2.5 px-3 text-right">Own Alloc (M)</th>
                    <th className="py-2.5 px-3 text-right">Remaining Eligible (M)</th>
                    <th className="py-2.5 px-3 text-center">Allocation Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {inwardTakas.filter((t) => t.qcStatus === 'Passed' || t.qcStatus === 'Pass').length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-400">
                        No QC-passed fabric rolls currently available. Complete QC inspection in Section A first.
                      </td>
                    </tr>
                  ) : (
                    inwardTakas
                      .filter((t) => t.qcStatus === 'Passed' || t.qcStatus === 'Pass')
                      .map((taka, idx) => (
                        <tr key={taka.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{taka.fabricName}</div>
                            <div className="text-[11px] text-slate-500">{taka.fabricQuality}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                            <div>{taka.lotNumber}</div>
                            <div className="text-[11px] text-slate-500">Taka: {taka.takaNumber}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{taka.inwardNumber}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {n(taka.receivedMeters || taka.availableQuantity)} M
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-indigo-700">
                            {n(taka.customerAllocatedQty)} M
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-purple-700">
                            {n(taka.ownAllocatedQty)} M
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700">
                            {n(taka.remainingEligibleQty)} M
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                ALLOC_STATUS_PILL[taka.allocationStatus] || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {taka.allocationStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {taka.remainingEligibleQty > 0 ? (
                              <button
                                onClick={() => handleOpenAllocForTaka(taka)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-xs ml-auto cursor-pointer"
                              >
                                <Plus size={12} />
                                Allocate Stock
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Fully Reserved</span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Section D — Allocation History */}
        {activeTab === 'sectionD' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                Showing all recorded stock reservations and project allocation lines:
              </span>
              <span className="text-slate-400 font-mono">{allocations.length} Allocation Transactions</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Allocation Ref</th>
                    <th className="py-2.5 px-3">Fabric & Quality</th>
                    <th className="py-2.5 px-3">Lot / Taka No</th>
                    <th className="py-2.5 px-3">Destination</th>
                    <th className="py-2.5 px-3 text-right">Allocated Qty</th>
                    <th className="py-2.5 px-3">Allocation Date</th>
                    <th className="py-2.5 px-3">Created By</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-400">
                        No stock allocations recorded yet. Allocate QC-passed rolls in Section C.
                      </td>
                    </tr>
                  ) : (
                    allocations.map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {alloc.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{alloc.fabricName}</td>
                        <td className="py-2.5 px-3 font-mono">
                          {alloc.lotNumber} / Taka {alloc.takaNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              DEST_PILL[alloc.allocationType] || 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {alloc.allocationType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                          {n(alloc.quantity)} {alloc.uom}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{alloc.createdAt}</td>
                        <td className="py-2.5 px-3 text-slate-800">{alloc.createdBy}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              alloc.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {alloc.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {alloc.status === 'Active' ? (
                            <button
                              onClick={() => handleReleaseAllocation(alloc.id)}
                              disabled={submitting}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-xs ml-auto cursor-pointer"
                            >
                              <Trash2 size={12} />
                              Release
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Released</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. SECTION E — STAGE 16 CUSTOMER DISPATCH HANDOVER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Next Stage Ready
            </span>
            <span className="text-xs text-slate-300">Stage 16 &bull; Customer Dispatch</span>
          </div>
          <h4 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Truck size={18} className="text-emerald-400" />
            Customer-Allocated Fabric Ready for Outbound Dispatch: <span className="font-mono text-emerald-400">{n(summary.customerAllocatedQty)} Meters</span>
          </h4>
          <p className="text-xs text-slate-300 max-w-2xl">
            Only QC-passed fabric allocated to Customer Project is eligible for Stage 16 Delivery Challans and transporter manifest generation. Own-project stock ({n(summary.ownAllocatedQty)} M) remains in internal warehouse stock.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            onClick={() => onSelectStage && onSelectStage(stageSeq + 1)}
            disabled={summary.customerAllocatedQty <= 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 px-4 font-bold shadow-md cursor-pointer disabled:opacity-50"
          >
            Proceed to Stage {stageSeq + 1} (Customer Dispatch)
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </div>
      </div>

      {/* 5. MODAL: QC INSPECTION FORM (ASTM 4-Point & Standard QC) */}
      <Modal
        isOpen={isQCModalOpen}
        onClose={() => setIsQCModalOpen(false)}
        title="Perform Quality Inspection & Stock Disposition"
        size="2xl"
      >
        <div className="p-5 space-y-4 text-xs">
          {/* Method selector tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQcInspectionMode('astm')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  qcInspectionMode === 'astm'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ASTM 4-Point Inspection (D5430)
              </button>
              <button
                type="button"
                onClick={() => setQcInspectionMode('standard')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  qcInspectionMode === 'standard'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Standard Receipt QC
              </button>
            </div>

            <div className="text-[11px] text-slate-500">
              Project: <span className="font-semibold text-slate-800">{code}</span>
            </div>
          </div>

          {/* Roll Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Taka / Roll</label>
              <select
                value={qcSelectedTakaId}
                onChange={(e) => {
                  setQcSelectedTakaId(e.target.value);
                  const sel = inwardTakas.find((t) => (t.lotTakaId || t.id) === e.target.value);
                  if (sel) {
                    setQcRollMeter(String(sel.receivedMeters || 100));
                    setQcRollWidth(String(sel.width || 44));
                    setStdGoodQty(String(sel.receivedMeters || 100));
                  }
                }}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
              >
                {inwardTakas.map((t) => (
                  <option key={t.lotTakaId || t.id} value={t.lotTakaId || t.id}>
                    Taka {t.takaNumber} &bull; {t.lotNumber} &bull; {n(takaMeters(t))} M ({t.qcStatus})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Inspection Date</label>
              <input
                type="date"
                value={qcInspectionDate}
                onChange={(e) => setQcInspectionDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quality Grade</label>
              <select
                value={qcQualityGrade}
                onChange={(e) => setQcQualityGrade(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold"
              >
                <option value="Grade A">Grade A (Passed Export Quality)</option>
                <option value="Grade B">Grade B (Standard Commercial)</option>
                <option value="Second Quality">Second Quality (Discounted)</option>
              </select>
            </div>
          </div>

          {/* ASTM 4-Point Specific Inspector */}
          {qcInspectionMode === 'astm' && (
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Roll Length (M)</label>
                  <input
                    type="number"
                    value={qcRollMeter}
                    onChange={(e) => setQcRollMeter(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Roll Width (Inches)</label>
                  <input
                    type="number"
                    value={qcRollWidth}
                    onChange={(e) => setQcRollWidth(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold"
                  />
                </div>
                <div className="col-span-2 flex items-end">
                  {/* Defect Quick Adder Dropdown */}
                  <div className="w-full">
                    <label className="block font-semibold text-slate-700 mb-1">Log Defect from Master</label>
                    <select
                      onChange={(e) => {
                        const def = defectMaster.find((d) => d.id === e.target.value);
                        if (def) handleAddDefect(def);
                        e.target.value = '';
                      }}
                      defaultValue=""
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    >
                      <option value="" disabled>+ Add Defect (Shade, Stain, Hole, Slub, etc.)...</option>
                      {defectMaster.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} &bull; {d.category} ({d.severity})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Logged Defects Table */}
              <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-2.5">Defect Name</th>
                      <th className="py-1.5 px-2.5">Category</th>
                      <th className="py-1.5 px-2.5">Severity</th>
                      <th className="py-1.5 px-2.5 w-24">Points (1-4)</th>
                      <th className="py-1.5 px-2.5 w-20">Count</th>
                      <th className="py-1.5 px-2.5 w-24">Distance (M)</th>
                      <th className="py-1.5 px-2.5 text-right w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {qcDefects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-slate-400">
                          No defects logged yet. A clean roll gets 0 penalty points (Grade A Pass).
                        </td>
                      </tr>
                    ) : (
                      qcDefects.map((def, dIdx) => (
                        <tr key={dIdx}>
                          <td className="py-1.5 px-2.5 font-medium text-slate-800">{def.defectName}</td>
                          <td className="py-1.5 px-2.5 text-slate-500">{def.category}</td>
                          <td className="py-1.5 px-2.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {def.severity}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5">
                            <input
                              type="number"
                              min="1"
                              max="4"
                              value={def.points}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setQcDefects((prev) =>
                                  prev.map((d, i) => (i === dIdx ? { ...d, points: val } : d))
                                );
                              }}
                              className="w-16 px-1.5 py-0.5 border border-slate-200 rounded font-mono font-bold"
                            />
                          </td>
                          <td className="py-1.5 px-2.5">
                            <input
                              type="number"
                              min="1"
                              value={def.count}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setQcDefects((prev) =>
                                  prev.map((d, i) => (i === dIdx ? { ...d, count: val } : d))
                                );
                              }}
                              className="w-14 px-1.5 py-0.5 border border-slate-200 rounded font-mono font-bold"
                            />
                          </td>
                          <td className="py-1.5 px-2.5">
                            <input
                              type="number"
                              placeholder="Meter"
                              value={def.distanceMeter}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQcDefects((prev) =>
                                  prev.map((d, i) => (i === dIdx ? { ...d, distanceMeter: val } : d))
                                );
                              }}
                              className="w-20 px-1.5 py-0.5 border border-slate-200 rounded font-mono text-xs"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setQcDefects((prev) => prev.filter((_, i) => i !== dIdx))}
                              className="text-rose-500 hover:text-rose-700 p-1"
                            >
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Dynamic ASTM Calculation Summary */}
              {(() => {
                const calc = calcASTM(qcRollMeter, qcRollWidth, qcDefects);
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-sans block">Total Penalty Pts</span>
                      <span className="font-bold text-slate-900">{calc.totalPoints} pts</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-sans block">Area Inspected</span>
                      <span className="font-bold text-slate-900">{calc.areaM2} m²</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-sans block">Pts / 100 m²</span>
                      <span className="font-bold text-indigo-700">{calc.ptsPer100M}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-sans block">Verdict</span>
                      <span className={`font-bold ${calc.disposition === 'Pass' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        Grade {calc.grade} &bull; {calc.disposition}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Standard QC Inputs */}
          {qcInspectionMode === 'standard' && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Good Qty (M)</label>
                <input
                  type="number"
                  value={stdGoodQty}
                  onChange={(e) => setStdGoodQty(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold text-emerald-700"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Second Quality (M)</label>
                <input
                  type="number"
                  value={stdSecondQty}
                  onChange={(e) => setStdSecondQty(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold text-indigo-700"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reprocess (M)</label>
                <input
                  type="number"
                  value={stdReprocessQty}
                  onChange={(e) => setStdReprocessQty(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold text-orange-700"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rejected (M)</label>
                <input
                  type="number"
                  value={stdRejectQty}
                  onChange={(e) => setStdRejectQty(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold text-rose-700"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">On Hold (M)</label>
                <input
                  type="number"
                  value={stdHoldQty}
                  onChange={(e) => setStdHoldQty(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold text-amber-700"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Inspector Notes & Defect Details</label>
            <textarea
              rows={2}
              value={qcNotes}
              onChange={(e) => setQcNotes(e.target.value)}
              placeholder="e.g. Warp and weft tensile strength tested. 4-point penalty within export commercial tolerance."
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsQCModalOpen(false)}
              className="px-4 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmitQCInspection(false)}
              disabled={submitting}
              className="px-4 py-1.5 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-semibold cursor-pointer disabled:opacity-60"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmitQCInspection(true)}
              disabled={submitting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Approving...' : 'Approve QC & Move Stock'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 6. MODAL: STOCK ALLOCATION FORM */}
      <Modal
        isOpen={isAllocModalOpen}
        onClose={() => setIsAllocModalOpen(false)}
        title="Allocate QC-Passed Stock to Project"
        size="lg"
      >
        <div className="p-5 space-y-4 text-xs">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-indigo-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Package size={14} className="text-indigo-600" />
              Earmark Usable Finished Fabric:
            </div>
            <p className="text-[11px] text-indigo-700">
              Only rolls that passed QC into WH-MAIN can be allocated. Once earmarked for this Customer Project, the fabric becomes available for Stage 16 Customer Dispatch.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select QC-Passed Taka / Roll</label>
            <select
              value={allocTakaId}
              onChange={(e) => {
                setAllocTakaId(e.target.value);
                const sel = inwardTakas.find((t) => (t.lotTakaId || t.id) === e.target.value);
                if (sel) {
                  setAllocQuantity(String(sel.remainingEligibleQty || sel.availableQuantity || 0));
                }
              }}
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
            >
              {inwardTakas
                .filter((t) => t.qcStatus === 'Passed' || t.qcStatus === 'Pass')
                .map((t) => (
                  <option key={t.lotTakaId || t.id} value={t.lotTakaId || t.id}>
                    Taka {t.takaNumber} &bull; {t.lotNumber} &bull; {n(t.remainingEligibleQty)} M Available ({t.fabricName})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Allocation Destination</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  allocType === 'Customer Project'
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="allocDestination"
                  checked={allocType === 'Customer Project'}
                  onChange={() => setAllocType('Customer Project')}
                  className="mr-2"
                />
                Customer Project
                <span className="block text-[11px] font-normal text-slate-500 mt-0.5">
                  Fulfills project requirement ({n(targetReq)} M). Eligible for dispatch.
                </span>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  allocType === 'Own Project'
                    ? 'border-purple-500 bg-purple-50/50 text-purple-900 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="allocDestination"
                  checked={allocType === 'Own Project'}
                  onChange={() => setAllocType('Own Project')}
                  className="mr-2"
                />
                Own Project
                <span className="block text-[11px] font-normal text-slate-500 mt-0.5">
                  Retained as internal company inventory / buffer stock.
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Allocation Quantity (Meters)</label>
            <input
              type="number"
              step="0.01"
              value={allocQuantity}
              onChange={(e) => setAllocQuantity(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold text-sm text-indigo-700"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Remarks / Authorization Reference</label>
            <input
              type="text"
              value={allocRemarks}
              onChange={(e) => setAllocRemarks(e.target.value)}
              placeholder="e.g. Allocation authorized against Purchase Order / Customer contract"
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAllocModalOpen(false)}
              className="px-4 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitStockAllocation}
              disabled={submitting}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Allocating...' : 'Confirm Stock Allocation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 7. MODAL: INSPECTION DETAILS & LINES BREAKDOWN */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`QC Inspection Breakdown: ${selectedInspection?.inspectionNumber || ''}`}
        size="xl"
      >
        {selectedInspection && (
          <div className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">Inward Receipt</span>
                <span className="font-mono font-bold text-slate-900">{selectedInspection.sourceDocumentNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">Inspection Date</span>
                <span className="font-semibold text-slate-800">{selectedInspection.inspectionDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">Inspector</span>
                <span className="font-semibold text-slate-800">{selectedInspection.inspectorName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-sans block">Method</span>
                <span className="font-semibold text-slate-800">{selectedInspection.inspectionMethod}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="font-bold text-slate-900">Inspected Roll / Taka Lines:</h5>
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5">Lot / Taka</th>
                      <th className="py-2 px-2.5 text-right">Length (M)</th>
                      <th className="py-2 px-2.5 text-right">Width (In)</th>
                      <th className="py-2 px-2.5 text-right">Penalty Pts</th>
                      <th className="py-2 px-2.5 text-right">Pts/100m²</th>
                      <th className="py-2 px-2.5 text-center">Grade</th>
                      <th className="py-2 px-2.5 text-center">Disposition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInspection.lines?.map((line, lIdx) => (
                      <tr key={lIdx}>
                        <td className="py-2 px-2.5 font-mono">
                          {line.lotNumber} / Taka {line.takaNumber}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold">{n(line.actualMeter)}</td>
                        <td className="py-2 px-2.5 text-right font-mono">{line.width || 44}&quot;</td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold">{line.penaltyPoints || 0}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-indigo-700">{line.pointsPer100SqMeter || 0}</td>
                        <td className="py-2 px-2.5 text-center">
                          <span className="px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-800">
                            {line.grade}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              line.disposition === 'Pass'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {line.disposition}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedInspection.notes && (
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="font-semibold text-slate-800 block text-[11px] mb-0.5">Inspector Notes:</span>
                <p className="text-slate-600 text-xs">{selectedInspection.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function takaMeters(t) {
  return t.receivedMeters || t.availableQuantity || 0;
}
