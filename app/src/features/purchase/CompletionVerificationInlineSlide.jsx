import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Factory,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PauseCircle,
  Clock,
  Calendar,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  RotateCcw,
  Check,
  Trash2,
  Paperclip,
  BarChart2,
  AlertCircle,
  X,
  Printer,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Building2,
  MapPin,
  Layers,
  Lock,
  ClipboardCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import { useAppStore } from '../../stores/appStore';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import { PrintProductionCompletionModal } from '../pms/production/PrintProductionCompletionModal';

function fmtM(n) {
  if (n === null || n === undefined || n === '') return '0.00';
  const num = Number(n);
  return isNaN(num) ? '0.00' : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  const parts = String(d).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : d;
}

export function CompletionVerificationInlineSlide({
  po,
  instruction: propInstruction,
  onClose,
  onUpdated,
  onNextStep,
  onPrevStep,
}) {
  const { showToast } = useERP() || {};
  const currentUser = useAppStore((s) => s.currentUser);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Backend Data
  const [completionData, setCompletionData] = useState(null);
  const [instructionDetail, setInstructionDetail] = useState(null);
  const [qcData, setQcData] = useState(null);
  const [employees, setEmployees] = useState([]);

  // Form Fields
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [verificationDate, setVerificationDate] = useState(todayStr);
  const [verifiedByEmployeeId, setVerifiedByEmployeeId] = useState('');
  const [physicallyVerifiedQty, setPhysicallyVerifiedQty] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  const fileInputRef = useRef(null);
  const piId = propInstruction?.id || po?.instructionId;

  // Load all required data: Completion, Instruction, QC, and Active Employees
  const loadData = async () => {
    if (!piId && !po?.id) return;
    try {
      setLoading(true);
      setError(null);

      const [compRes, instRes, qcRes, empRes] = await Promise.all([
        piId ? api.get(`/production/instructions/${piId}/completion/`).catch(() => null) : null,
        piId ? api.get(`/production/instructions/${piId}/`).catch(() => null) : null,
        po?.id ? api.get(`/purchase/orders/${po.id}/qc-inspection/`, { params: piId ? { instructionId: piId } : {} }).catch(() => null) : null,
        api.get('/hrms/employees/', { query: { page_size: 100 } }).catch(() => null),
      ]);

      setCompletionData(compRes);
      setInstructionDetail(instRes);
      setQcData(qcRes);

      const empList = Array.isArray(empRes) ? empRes : empRes?.results || empRes?.data || [];
      setEmployees(empList);

      // Pre-fill form if existing verification metadata exists
      if (compRes) {
        if (compRes.verificationRemarks) {
          setRemarks(compRes.verificationRemarks);
        }
        if (compRes.verificationDate) {
          setVerificationDate(compRes.verificationDate.slice(0, 10));
        }
        if (compRes.verifiedByEmployeeId) {
          setVerifiedByEmployeeId(String(compRes.verifiedByEmployeeId));
        } else if (compRes.assignedEmployeeId) {
          setVerifiedByEmployeeId(String(compRes.assignedEmployeeId));
        } else if (empList.length > 0 && !verifiedByEmployeeId) {
          setVerifiedByEmployeeId(String(empList[0].id));
        }

        if (compRes.physicallyVerifiedQty !== undefined && compRes.physicallyVerifiedQty !== null) {
          setPhysicallyVerifiedQty(String(Number(compRes.physicallyVerifiedQty)));
        } else {
          // Default to QC accepted or total produced
          const defaultQty = Number(compRes.qcSummary?.acceptedQty || compRes.acceptedQty || compRes.totalProduced || 0);
          setPhysicallyVerifiedQty(defaultQty > 0 ? String(defaultQty) : '');
        }

        if (Array.isArray(compRes.attachments)) {
          setAttachments(compRes.attachments);
        }
      } else if (empList.length > 0 && !verifiedByEmployeeId) {
        setVerifiedByEmployeeId(String(empList[0].id));
      }
    } catch (err) {
      console.warn('Failed to load completion verification details:', err);
      setError(err?.message || 'Failed to load completion verification details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [piId, po?.id]);

  // Derived Values
  const piNumber = completionData?.piNo || instructionDetail?.instructionNumber || propInstruction?.instructionNumber || '—';
  const piDate = completionData?.piDate || instructionDetail?.pi_date || instructionDetail?.createdAt || '';
  const vendorName = completionData?.agency || propInstruction?.vendor || po?.vendor || '—';
  const fabricQuality = completionData?.fabric || propInstruction?.fabric || po?.fabric || '';
  const status = instructionDetail?.status || completionData?.status || propInstruction?.status || 'In Progress';
  const finalPoNumber = instructionDetail?.finalPoNumber || propInstruction?.finalPoNumber || completionData?.finalPoNumber || null;

  // Quantities
  const poQty = Number(completionData?.orderQty ?? propInstruction?.orderMeter ?? po?.order_meter ?? 0);
  const totalProduced = Number(completionData?.totalProduced ?? propInstruction?.totalProduced ?? 0);
  
  // QC breakdown: pull from completionData.qcSummary or fallback to qcData
  const qcInspected = Number(completionData?.qcSummary?.totalInspected ?? qcData?.summary?.totalInspected ?? 0);
  const qcAccepted = Number(completionData?.qcSummary?.acceptedQty ?? qcData?.summary?.acceptedQty ?? completionData?.acceptedQty ?? 0);
  const qcRejected = Number(completionData?.qcSummary?.rejectedQty ?? qcData?.summary?.rejectedQty ?? completionData?.rejectedQty ?? 0);
  const qcReprocess = Number(completionData?.qcSummary?.reprocessQty ?? qcData?.summary?.reprocessQty ?? 0);
  const qcHold = Number(completionData?.qcSummary?.holdQty ?? qcData?.summary?.holdQty ?? 0);
  const pendingQc = Number(completionData?.qcSummary?.pendingQcQty ?? Math.max(0, totalProduced - qcInspected));

  // Physical Verification & Shortage Calculation
  const physicallyVerified = parseFloat(physicallyVerifiedQty) || 0;
  const shortageDifference = Math.max(0, Math.round((totalProduced - physicallyVerified) * 100) / 100);
  const hasDiscrepancy = shortageDifference > 0;

  // Status mapping
  const isPendingApproval = status === 'Verification Pending' || status === 'Pending Approval';
  const isApproved = ['Verified', 'PO Pending', 'PO Created', 'Closed'].includes(status);
  const isCompleted = ['PO Created', 'Closed', 'Completed'].includes(status);
  const isDraftOrInProgress = status === 'Draft' || status === 'In Progress' || status === 'Running';

  // Handle Form Actions
  const handleAction = async (actionType) => {
    setError(null);
    setSuccessMsg(null);
    setFieldErrors({});

    const errors = {};
    if (!verificationDate) errors.verificationDate = 'Verification Date is required.';
    if (!verifiedByEmployeeId) errors.verifiedByEmployeeId = 'Verified By employee is required.';
    
    if (actionType !== 'save_draft') {
      if (physicallyVerifiedQty === '' || isNaN(physicallyVerified) || physicallyVerified < 0) {
        errors.physicallyVerifiedQty = 'Valid physically verified quantity is required.';
      }
      if (hasDiscrepancy && !remarks.trim()) {
        errors.remarks = `A reason is required because there is a shortage of ${fmtM(shortageDifference)} Mtr.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please review and resolve the required validation errors.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        action: actionType,
        verificationDate,
        verifiedByEmployeeId,
        physicallyVerifiedQty: physicallyVerified,
        rejectedQty: qcRejected,
        reason: remarks.trim(),
        attachments,
      };

      const res = await api.post(`/production/instructions/${piId}/verify/`, payload);
      setInstructionDetail(res);

      let msg = 'Action completed successfully.';
      if (actionType === 'save_draft') msg = 'Draft completion verification saved successfully.';
      else if (actionType === 'return_for_correction') msg = 'Verification returned for correction.';
      else if (actionType === 'submit_for_approval') msg = 'Completion verification submitted for approval.';
      else if (actionType === 'approve_complete') msg = 'Completion verification approved & completed successfully!';

      setSuccessMsg(msg);
      if (showToast) showToast(msg, 'success');

      await loadData();
      if (onUpdated) onUpdated();
    } catch (err) {
      const respErr = err?.response?.data || err;
      setError(respErr?.detail || respErr?.message || err?.message || 'Failed to submit verification.');
      if (respErr?.field_errors) {
        setFieldErrors(respErr.field_errors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle File Attachment Upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        if (showToast) showToast(`File ${file.name} exceeds 10MB limit.`, 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: `${(file.size / 1024).toFixed(0)} KB`,
            data: event.target.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-[#f8fafd] border border-emerald-200/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <ClipboardCheck size={18} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2">
              Completion Verification
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                Stage 4
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Physical quantity verification & grey fabric production reconciliation
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Minimize Completion Verification Section"
          >
            <X size={13} /> Minimize Stage
          </button>
        )}
      </div>
      
      {/* Read-Only PO & Production Context Strip (Header Context from Reference) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Supplier / Vendor</span>
            <strong className="text-slate-900 text-[13px] block mt-0.5">{vendorName}</strong>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin size={11} className="text-slate-400" /> Maharashtra
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Fabric Quality</span>
            <strong className="text-slate-900 text-[13px] block mt-0.5">{fabricQuality || '—'}</strong>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">PO Details</span>
            <div className="text-[11.5px] text-slate-600 space-y-0.5 mt-0.5">
              <div>PO No: <strong className="text-slate-900 font-mono">{po?.poNumber || '—'}</strong></div>
              <div>PO Date: <strong className="text-slate-800">{fmtDate(po?.date)}</strong></div>
              <div>UOM: <strong className="text-slate-800">Mtr</strong></div>
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Production Instruction</span>
            <div className="text-[11.5px] text-slate-600 space-y-0.5 mt-0.5">
              <div>PI No: <strong className="text-indigo-700 font-mono">{piNumber}</strong></div>
              <div>Issue Date: <strong className="text-slate-800">{fmtDate(piDate)}</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* Error & Success Feedback Banners */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <div className="flex-1 font-medium">{successMsg}</div>
        </div>
      )}

      {/* CARD 1: PRODUCTION & QC SUMMARY (AUTO PULLED) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
          <Layers size={15} className="text-blue-600 shrink-0" />
          <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
            Production & QC Summary (Auto Pulled)
          </h4>
        </div>

        {/* 7-Box Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
          {/* 1. PO Quantity */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <FileText size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] uppercase font-bold text-slate-400 block truncate">PO Quantity</span>
              <span className="font-mono font-bold text-slate-900 text-xs block leading-tight">{fmtM(poQty)}</span>
              <span className="text-[9px] text-slate-400">Mtr</span>
            </div>
          </div>

          {/* 2. Total Produced */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Factory size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] uppercase font-bold text-slate-400 block truncate">Total Produced</span>
              <span className="font-mono font-bold text-blue-900 text-xs block leading-tight">{fmtM(totalProduced)}</span>
              <span className="text-[9px] text-slate-400">Mtr</span>
            </div>
          </div>

          {/* 3. Total Inspected (QC) */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <ShieldCheck size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] uppercase font-bold text-slate-400 block truncate">Total Inspected (QC)</span>
              <span className="font-mono font-bold text-blue-900 text-xs block leading-tight">{fmtM(qcInspected)}</span>
              <span className="text-[9px] text-slate-400">Mtr</span>
            </div>
          </div>

          {/* 4. Accepted (QC) */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <CheckCircle2 size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] uppercase font-bold text-emerald-700 block truncate">Accepted (QC)</span>
              <span className="font-mono font-black text-emerald-800 text-xs block leading-tight">{fmtM(qcAccepted)}</span>
              <span className="text-[9px] text-emerald-600">Mtr</span>
            </div>
          </div>

          {/* 5. Rejected */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-2.5 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <XCircle size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] uppercase font-bold text-rose-700 block truncate">Rejected</span>
              <span className="font-mono font-bold text-rose-700 text-xs block leading-tight">{fmtM(qcRejected)}</span>
              <span className="text-[9px] text-rose-600">Mtr</span>
            </div>
          </div>

          {/* 6. Reprocess */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <RefreshCw size={13} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] uppercase font-bold text-amber-700 block truncate">Reprocess</span>
              <span className="font-mono font-bold text-amber-800 text-xs block leading-tight">{fmtM(qcReprocess)}</span>
              <span className="text-[9px] text-amber-600">Mtr</span>
            </div>
          </div>

          {/* 7. Hold */}
          <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-2.5 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <PauseCircle size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] uppercase font-bold text-rose-700 block truncate">Hold</span>
              <span className="font-mono font-bold text-rose-800 text-xs block leading-tight">{fmtM(qcHold)}</span>
              <span className="text-[9px] text-rose-600">Mtr</span>
            </div>
          </div>

          {/* 8. Pending QC */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
              <Clock size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] uppercase font-bold text-slate-500 block truncate">Pending QC</span>
              <span className="font-mono font-bold text-slate-700 text-xs block leading-tight">{fmtM(pendingQc)}</span>
              <span className="text-[9px] text-slate-400">Mtr</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid: Left Column (Cards 2 & 3), Right Column (Cards 4, 5, 6) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT COLUMN (approx 68% width on desktop) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* CARD 2: COMPLETION VERIFICATION (Form Card) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ClipboardCheck size={15} className="text-blue-600 shrink-0" />
              <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
                Completion Verification
              </h4>
            </div>

            {/* Row 1: Verification Date & Verified By */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Verification Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={verificationDate}
                    onChange={(e) => setVerificationDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                {fieldErrors.verificationDate && (
                  <p className="text-[10px] text-rose-600 font-semibold mt-1">{fieldErrors.verificationDate}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Verified By <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="employees" />
                </div>
                <select
                  required
                  value={verifiedByEmployeeId}
                  onChange={(e) => setVerifiedByEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.full_name} {emp.designation ? `(${emp.designation})` : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.verifiedByEmployeeId && (
                  <p className="text-[10px] text-rose-600 font-semibold mt-1">{fieldErrors.verifiedByEmployeeId}</p>
                )}
              </div>
            </div>

            {/* Row 2: Physically Verified Quantity (Mtr) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Physically Verified Quantity (Mtr) <span className="text-rose-500">*</span>
              </label>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={physicallyVerifiedQty}
                  onChange={(e) => setPhysicallyVerifiedQty(e.target.value)}
                  placeholder="e.g. 7780.00"
                  className="flex-1 px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-white focus:outline-hidden"
                />
                <span className="bg-slate-100 px-3 py-2 text-xs text-slate-600 font-semibold border-l border-slate-300 select-none">
                  Mtr
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 mt-1">
                Enter actual quantity verified at vendor end.
              </p>
              {fieldErrors.physicallyVerifiedQty && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{fieldErrors.physicallyVerifiedQty}</p>
              )}
            </div>

            {/* Row 3: Verification Result (Mtr) - 4 Read-Only Result Blocks */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10.5px] uppercase font-bold text-slate-600 block tracking-wide">
                Verification Result (Mtr)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                  <span className="text-[9.5px] uppercase font-bold text-emerald-700 block">Accepted</span>
                  <span className="font-mono font-bold text-emerald-900 text-sm mt-0.5 block">{fmtM(qcAccepted)}</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                  <span className="text-[9.5px] uppercase font-bold text-rose-700 block">Rejected</span>
                  <span className="font-mono font-bold text-rose-900 text-sm mt-0.5 block">{fmtM(qcRejected)}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  <span className="text-[9.5px] uppercase font-bold text-amber-700 block">Reprocess</span>
                  <span className="font-mono font-bold text-amber-900 text-sm mt-0.5 block">{fmtM(qcReprocess)}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <span className="text-[9.5px] uppercase font-bold text-slate-600 block">Hold</span>
                  <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">{fmtM(qcHold)}</span>
                </div>
              </div>
            </div>

            {/* Row 4: Shortage / Difference & Reason / Remarks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Shortage / Difference (Mtr)
                </label>
                <div className={`rounded-xl border p-2.5 ${
                  hasDiscrepancy ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <span className="font-mono font-bold text-base block">{fmtM(shortageDifference)}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Auto-calculated (Produced - Verified)
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Reason / Remarks {hasDiscrepancy && <span className="text-rose-500">*</span>}
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">{remarks.length}/500</span>
                </div>
                <textarea
                  rows={2}
                  maxLength={500}
                  required={hasDiscrepancy}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="20 mtr shortage due to end cut and weaving defect."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
                {fieldErrors.remarks && (
                  <p className="text-[10px] text-rose-600 font-semibold mt-1">{fieldErrors.remarks}</p>
                )}
              </div>
            </div>
          </div>

          {/* CARD 3: PRODUCTION & QC DETAILS (Comparison Table) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <FileSpreadsheet size={15} className="text-blue-600 shrink-0" />
              <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
                Production & QC Details
              </h4>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[550px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2.5">Source</th>
                    <th className="px-3 py-2.5 text-right">Total Quantity (Mtr)</th>
                    <th className="px-3 py-2.5 text-right">Accepted (Mtr)</th>
                    <th className="px-3 py-2.5 text-right">Rejected (Mtr)</th>
                    <th className="px-3 py-2.5 text-right">Reprocess (Mtr)</th>
                    <th className="px-3 py-2.5 text-right">Hold (Mtr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Row 1: Daily Production Total */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-slate-800">Daily Production Total</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{fmtM(totalProduced)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">—</td>
                  </tr>

                  {/* Row 2: QC Total */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-slate-800">QC Total</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-900">{fmtM(qcInspected)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700 font-bold">{fmtM(qcAccepted)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-600 font-bold">{fmtM(qcRejected)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-600 font-bold">{fmtM(qcReprocess)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 font-bold">{fmtM(qcHold)}</td>
                  </tr>

                  {/* Row 3: Physically Verified */}
                  <tr className="bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-slate-900">Physically Verified</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-slate-950">{fmtM(physicallyVerified)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-800 font-bold">{fmtM(qcAccepted)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-700 font-bold">{fmtM(qcRejected)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-700 font-bold">{fmtM(qcReprocess)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700 font-bold">{fmtM(qcHold)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (approx 32% width on desktop) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* CARD 4: RECONCILIATION SUMMARY */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <BarChart2 size={15} className="text-blue-600 shrink-0" />
              <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
                Reconciliation Summary
              </h4>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600">PO Quantity (Instructed)</span>
                <span className="font-mono font-bold text-slate-900">{fmtM(poQty)} Mtr</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-600">Total Produced (From Daily Entry)</span>
                <span className="font-mono font-bold text-slate-900">{fmtM(totalProduced)} Mtr</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-600">QC Accepted Quantity</span>
                <span className="font-mono font-bold text-emerald-700">{fmtM(qcAccepted)} Mtr</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-600">Physically Verified Quantity</span>
                <span className="font-mono font-bold text-slate-900">{fmtM(physicallyVerified)} Mtr</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-slate-800">Shortage / Difference</span>
                <span className={`font-mono font-black ${hasDiscrepancy ? 'text-rose-600 text-[13px]' : 'text-emerald-700'}`}>
                  {fmtM(shortageDifference)} Mtr
                </span>
              </div>
            </div>

            {/* Reconciliation Warning Banner */}
            {hasDiscrepancy ? (
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-[11px]">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  There is a shortage of <strong className="font-mono">{fmtM(shortageDifference)} Mtr</strong> compared to total produced quantity. Please verify the reason before approval.
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900 text-[11px]">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                <div>
                  Physical quantity reconciles with production. Ready for approval.
                </div>
              </div>
            )}
          </div>

          {/* CARD 5: ATTACHMENTS (OPTIONAL) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Paperclip size={15} className="text-blue-600 shrink-0" />
              <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
                Attachments (Optional)
              </h4>
            </div>

            {/* Upload Zone */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
              accept="image/*,.pdf"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/30 hover:bg-blue-50/60 rounded-xl p-4 text-center cursor-pointer transition-colors"
            >
              <UploadCloud size={24} className="mx-auto text-blue-600" />
              <p className="font-bold text-xs text-slate-800 mt-1">Upload Documents</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Photos, reports, or other supporting files (JPG, PNG, PDF up to 10 MB)
              </p>
            </div>

            {/* Attachment Items List */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip size={12} className="text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-800 truncate" title={file.name}>{file.name}</span>
                      <span className="text-[10px] text-slate-400">({file.size})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Remove file"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CARD 6: APPROVAL STATUS */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
              <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
                Approval Status
              </h4>
            </div>

            {/* Stepper Node List */}
            <div className="relative pl-6 space-y-4 text-xs before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Step 1: Pending Approval */}
              <div className="relative">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${
                  isPendingApproval || isDraftOrInProgress
                    ? 'bg-amber-500 text-white shadow-xs'
                    : isApproved
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {isApproved ? <Check size={11} /> : <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <strong className={`block ${isPendingApproval || isDraftOrInProgress ? 'text-amber-800' : 'text-slate-800'}`}>
                    {status === 'Draft' ? 'Draft' : 'Pending Approval'}
                  </strong>
                  <span className="text-[10.5px] text-slate-500 block mt-0.5">
                    {status === 'Draft' ? 'Draft created; pending verification.' : 'Verify quantity and approve to proceed.'}
                  </span>
                </div>
              </div>

              {/* Step 2: Approved */}
              <div className="relative">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${
                  isApproved
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-white border-2 border-slate-300 text-slate-300'
                }`}>
                  {isApproved ? <Check size={11} /> : null}
                </div>
                <div>
                  <strong className={`block ${isApproved ? 'text-emerald-800' : 'text-slate-400'}`}>
                    Approved
                  </strong>
                  {isApproved && (
                    <span className="text-[10.5px] text-emerald-700 block mt-0.5">
                      Verified and approved for Job Work PO.
                    </span>
                  )}
                </div>
              </div>

              {/* Step 3: Completed */}
              <div className="relative">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-white border-2 border-slate-300 text-slate-300'
                }`}>
                  {isCompleted ? <Check size={11} /> : null}
                </div>
                <div>
                  <strong className={`block ${isCompleted ? 'text-emerald-800' : 'text-slate-400'}`}>
                    Completed
                  </strong>
                  {isCompleted && (
                    <span className="text-[10.5px] text-emerald-700 block mt-0.5">
                      Instruction closed with Final Job Work PO.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* BOTTOM ACTION BUTTONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-200 bg-white p-3 rounded-xl shadow-2xs">
        
        {/* Left Action: Save Draft */}
        <div>
          <button
            type="button"
            disabled={submitting || isApproved}
            onClick={() => handleAction('save_draft')}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText size={14} className="text-slate-500" /> Save Draft
          </button>
        </div>

        {/* Center / Right Actions */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Return for Correction */}
          <button
            type="button"
            disabled={submitting || isApproved}
            onClick={() => handleAction('return_for_correction')}
            className="px-4 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} /> Return for Correction
          </button>

          {/* Submit for Approval */}
          <button
            type="button"
            disabled={submitting || isApproved}
            onClick={() => handleAction('submit_for_approval')}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={14} /> Submit for Approval
          </button>

          {/* Print Certificate */}
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Download clean PDF or Print"
          >
            <Printer size={14} className="text-slate-500" /> Print Certificate
          </button>

          {/* Approve & Complete */}
          <button
            type="button"
            disabled={submitting || isApproved}
            onClick={() => handleAction('approve_complete')}
            className={`px-4 py-2 border text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition shadow-2xs ${
              isApproved
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 cursor-default'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer'
            }`}
          >
            <Check size={14} className={isApproved ? 'text-emerald-600' : 'text-slate-500'} />
            {isApproved ? 'Approved & Completed' : 'Approve & Complete'}
          </button>

          {/* Generate Final Job Work PO */}
          {onNextStep && (
            <button
              type="button"
              onClick={() => onNextStep('final_job_work_po')}
              className={`px-4 py-2 border text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer ${
                isApproved
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-sm'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet size={14} /> Generate Final Job Work PO
            </button>
          )}

        </div>

      </div>

      {/* Print Completion & Verification Certificate Modal */}
      <PrintProductionCompletionModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        completionData={{
          piNo: piNumber,
          piDate: piDate,
          agency: vendorName,
          fabric: fabricQuality,
          processType: completionData?.processType || 'Processing',
          assignedEmployee: completionData?.assignedEmployee || '-',
          orderQty: poQty,
          totalProduced: totalProduced,
          rejectedQty: qcRejected,
          acceptedQty: qcAccepted,
          shortageQty: shortageDifference,
          jobRate: completionData?.jobRate,
          finalAmount: completionData?.finalAmount,
          status: isApproved ? 'Approved & Completed' : isPendingApproval ? 'Pending Approval' : 'In Progress',
          dailySummary: completionData?.dailySummary || [],
        }}
        detail={{
          instructionNumber: piNumber,
          greyLotNo: completionData?.greyLotNo,
          finalPoNumber,
        }}
      />

    </div>
  );
}
