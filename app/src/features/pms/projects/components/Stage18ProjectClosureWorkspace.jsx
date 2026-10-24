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
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  IndianRupee,
  Layers,
  MapPin,
  Package,
  Percent,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  User,
  Warehouse,
  X,
  XCircle,
} from 'lucide-react';
import { fetchClosureAuditData, closePmsProject, errorMessage } from '../../../../services/jobWorkSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { formatCurrency } from '../../../../utils/currencyUtils';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export function Stage18ProjectClosureWorkspace({
  project,
  stage,
  onSyncPipeline,
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
  const stageSeq = stage?.sequence || 18;
  const stageName = stage?.name || 'Stage 18 — Project Closure';

  // Audit state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [auditData, setAuditData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load audit data from backend
  const loadAuditData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchClosureAuditData(projectId);
      setAuditData(res?.data || res);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load project closure audit data.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  // Handle final close action
  const handleConfirmClose = async (force = false) => {
    if (!window.confirm(`Are you sure you want to sign off and close Project ${code}?`)) {
      return;
    }
    setSubmitting(true);
    try {
      await closePmsProject(projectId, { force });
      toast.success(`Project ${code} successfully audited, signed off, and closed!`);
      await loadAuditData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Project closure blocked. Unresolved balances exist.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isClosed = project?.status === 'Completed' || auditData?.status === 'Completed' || stage?.status === 'Completed';
  const canClose = auditData?.canClose && !isClosed;
  const blockers = auditData?.blockers || [];

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 1. Header Banner */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Stage {stageSeq} of {totalStages}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${isClosed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {isClosed ? 'Completed & Closed' : (stage?.status || 'In Progress')}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 mt-0.5">{stageName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Commercial and inventory reconciliation audit across all 18 lifecycle stages prior to final project archiving.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={loadAuditData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Audit</span>
            </button>

            {isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-extrabold border border-emerald-300">
                <Check size={14} /> Project Signed Off & Archived
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                disabled={submitting || !canClose}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer ${canClose ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                title={canClose ? 'Complete and archive project' : 'Resolve all audit blockers first'}
              >
                <CheckCircle2 size={14} />
                <span>Confirm Sign-off & Close Project</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Audit Navigation & Status Summary */}
        <div className="flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Project:</span>
            <span className="font-mono font-bold text-blue-600">{code}</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-slate-700">Customer:</span>
            <span className="font-semibold text-slate-900">{project?.customerName || auditData?.customerName || 'Direct Customer'}</span>
          </div>
          <div className="flex items-center gap-2">
            
          </div>
        </div>
      </div>

      {/* 2. Audit Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 block">Customer Target</span>
          <span className="text-base font-black text-blue-600 mt-0.5 block">{n(auditData?.customerRequirement)} m</span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Target Order</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 block">Customer Dispatched</span>
          <span className="text-base font-black text-emerald-600 mt-0.5 block">{n(auditData?.dispatchedQuantity)} m</span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Delivery Challans</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 block">Pending Fulfillment</span>
          <span className={`text-base font-black mt-0.5 block ${(auditData?.customerBalance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {n(auditData?.customerBalance)} m
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">{(auditData?.customerBalance || 0) === 0 ? '100% Fulfilled' : 'Shortfall Pending'}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 block">Processor Balance</span>
          <span className={`text-base font-black mt-0.5 block ${(auditData?.vendorPending || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {n(auditData?.vendorPending)} m
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Sent vs Received</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 block">Payment Balance</span>
          <span className={`text-base font-black mt-0.5 block ${(auditData?.paymentOutstanding || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {formatCurrency(auditData?.paymentOutstanding || 0)}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Customer Receivables</span>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 block">Retained Own Stock</span>
          <span className="text-base font-black text-purple-600 mt-0.5 block">{n(auditData?.retainedOwnStock)} m</span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">In Warehouse Buffer</span>
        </div>
      </div>

      {/* 3. Pre-Closure Checklist & Blockers Notice */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>9-Point Lifecycle Audit & Reconciliation Verification</span>
          </h3>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${canClose ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {canClose ? 'All Audit Checks Passed' : `${blockers.length} Unresolved Issues`}
          </span>
        </div>

        {/* Blockers Alert if any */}
        {blockers.length > 0 && !isClosed && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertTriangle size={15} />
              <span>Project closure blocked by the following outstanding transactions:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-amber-800">
              {blockers.map((b, idx) => (
                <li key={idx} className="font-medium">{b}</li>
              ))}
            </ul>
            <p className="text-[11px] text-amber-700 pt-1">
              Complete the relevant stage transactions (dispatch, payment, or inward receipt) before signing off.
            </p>
          </div>
        )}

        {/* 9-Point Checklist Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* 1. Customer Requirement */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 block">1. Customer Requirement & Fulfilment</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                Target: {n(auditData?.customerRequirement)} m | Delivered: {n(auditData?.dispatchedQuantity)} m
              </span>
            </div>
            {(auditData?.customerBalance || 0) === 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold text-[11px]">
                <CheckCircle2 size={16} /> Balanced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[11px]">
                <Clock size={15} /> {n(auditData?.customerBalance)} m Pending
              </span>
            )}
          </div>

          {/* 2. Mill Stock Reconciled */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 block">2. Processor Stock Reconciliation (Vendor B)</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                Sent: {n(auditData?.vendorSent)} m | Received: {n(auditData?.vendorReceived)} m
              </span>
            </div>
            {(auditData?.vendorPending || 0) === 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold text-[11px]">
                <CheckCircle2 size={16} /> Reconciled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[11px]">
                <Clock size={15} /> {n(auditData?.vendorPending)} m with Mill
              </span>
            )}
          </div>

          {/* 3. QC & Quality Acceptance */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 block">3. QC Inspection & Defect Clearance</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                QC Passed: {n(auditData?.qcPassed)} m | Hold: {n(auditData?.qcHold)} m
              </span>
            </div>
            {(auditData?.qcHold || 0) === 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold text-[11px]">
                <CheckCircle2 size={16} /> QC Passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px]">
                <AlertTriangle size={15} /> {n(auditData?.qcHold)} m on Hold
              </span>
            )}
          </div>

          {/* 4. Customer Invoice & Payment */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 block">4. Final Invoice & Payment Settlement</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                Invoiced: {formatCurrency(auditData?.invoicedAmount || 0)} | Paid: {formatCurrency(auditData?.paidAmount || 0)}
              </span>
            </div>
            {(auditData?.paymentOutstanding || 0) === 0 && (auditData?.invoicedAmount || 0) > 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold text-[11px]">
                <CheckCircle2 size={16} /> Settled
              </span>
            ) : (auditData?.paymentOutstanding || 0) === 0 ? (
              <span className="inline-flex items-center gap-1 text-slate-500 font-bold text-[11px]">
                Pending Invoice
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px]">
                <AlertCircle size={15} /> {formatCurrency(auditData?.paymentOutstanding || 0)} Unpaid
              </span>
            )}
          </div>

          {/* 5. Retained Own Stock */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 block">5. Retained Own Project Buffer Stock</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                {n(auditData?.retainedOwnStock)} m verified in warehouse. Company asset (NOT customer shortfall).
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-purple-700 font-extrabold text-[11px]">
              <CheckCircle2 size={16} /> Verified Asset
            </span>
          </div>

          {/* 6. Lifecycle Stages Completed */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 block">6. Lifecycle Stages Execution</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                All upstream stages 1 through 17 executed according to workflow.
              </span>
            </div>
            {(auditData?.openStagesCount || 0) === 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold text-[11px]">
                <CheckCircle2 size={16} /> 100% Complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[11px]">
                <Clock size={15} /> {auditData?.openStagesCount} Open Stages
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default Stage18ProjectClosureWorkspace;
