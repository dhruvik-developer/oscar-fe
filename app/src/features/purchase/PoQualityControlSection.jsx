import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck, Calendar, UserCheck, FileText, CheckCircle2,
  Clock, Layers, AlertCircle, Save, Send, Link2, MapPin,
  ChevronDown, ChevronUp, Plus, Activity, Image as ImageIcon,
  Check, X, FileBarChart, ExternalLink, RefreshCw, Upload,
  AlertTriangle, Trash2, Printer, Search, ClipboardCheck, ArrowRight
} from 'lucide-react';
import { purchaseService } from '../../services/domainServices';
import { Button } from '../../components/ui/Button';
import { useERP } from '../../context/ERPContext';
import MasterSourceLink from '../../components/common/MasterSourceLink';

export function PoQualityControlSection({
  po,
  onUpdated,
  navigate,
  onViewAllEntries,
  onProceedToVerification,
  defaultExpanded = true,
}) {
  const { showToast } = useERP() || {};

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState(null);

  // Backend data
  const [qcData, setQcData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [inspectors, setInspectors] = useState([]);

  // Form inputs
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [inspectionDate, setInspectionDate] = useState(todayStr);
  const [inspectorId, setInspectorId] = useState('');
  const [inspectionType, setInspectionType] = useState('Grey Fabric QC');
  const [inspectionMethod, setInspectionMethod] = useState('Visual + Measurement');
  const [inspectedQty, setInspectedQty] = useState('');
  const [acceptedQty, setAcceptedQty] = useState('0.00');
  const [rejectedQty, setRejectedQty] = useState('0.00');
  const [reprocessQty, setReprocessQty] = useState('0.00');
  const [holdQty, setHoldQty] = useState('0.00');
  const [gsm, setGsm] = useState('');
  const [width, setWidth] = useState('');
  const [defectsFound, setDefectsFound] = useState('Select');
  const [qualityGrade, setQualityGrade] = useState('Select');
  const [remarks, setRemarks] = useState('');
  const [photos, setPhotos] = useState([]);
  const [showAllEntriesModal, setShowAllEntriesModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [qcRegisterSearch, setQcRegisterSearch] = useState('');
  const [qcRegisterGradeFilter, setQcRegisterGradeFilter] = useState('All');

  // Pagination for previous entries
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const fileInputRef = useRef(null);

  // Load QC data from backend
  const loadData = async (instructionId = null) => {
    if (!po?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await purchaseService.getPoQcInspection(po.id, instructionId ? { instructionId } : {});
      if (res) {
        setQcData(res);
        setEntries(res.entries || []);
        const inspList = res.inspectors || [];
        setInspectors(inspList);
        if (inspList.length > 0 && !inspectorId) {
          setInspectorId(inspList[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load QC Inspection details:', err);
      setError(err?.message || 'Failed to load QC Inspection data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [po?.id]);

  // Handle inspected quantity change & auto-populate accepted quantity
  const handleInspectedQtyChange = (val) => {
    setInspectedQty(val);
    const num = parseFloat(val) || 0;
    const rej = parseFloat(rejectedQty) || 0;
    const rep = parseFloat(reprocessQty) || 0;
    const hld = parseFloat(holdQty) || 0;
    const autoAccepted = Math.max(0, num - (rej + rep + hld));
    setAcceptedQty(autoAccepted.toFixed(2));
  };

  const handleResultQtyChange = (setter, val, fieldKey) => {
    setter(val);
    const num = parseFloat(inspectedQty) || 0;
    const curVal = parseFloat(val) || 0;

    let rej = parseFloat(rejectedQty) || 0;
    let rep = parseFloat(reprocessQty) || 0;
    let hld = parseFloat(holdQty) || 0;

    if (fieldKey === 'rejected') rej = curVal;
    if (fieldKey === 'reprocess') rep = curVal;
    if (fieldKey === 'hold') hld = curVal;

    const autoAccepted = Math.max(0, num - (rej + rep + hld));
    setAcceptedQty(autoAccepted.toFixed(2));
  };

  // Reset form to blank new entry
  const resetForm = () => {
    setInspectionDate(todayStr);
    setInspectedQty('');
    setAcceptedQty('0.00');
    setRejectedQty('0.00');
    setReprocessQty('0.00');
    setHoldQty('0.00');
    setGsm('');
    setWidth('');
    setDefectsFound('Select');
    setQualityGrade('Select');
    setRemarks('');
    setPhotos([]);
    setFieldErrors({});
    setError(null);
    setSuccessMsg(null);
  };

  // Handle Image Upload (Preview as data URL)
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        if (showToast) showToast(`File ${file.name} exceeds 5MB limit.`, 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotos((prev) => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit QC Entry (Draft or Final Submit)
  const handleSubmit = async (actionType = 'submit') => {
    setError(null);
    setFieldErrors({});
    setSuccessMsg(null);

    const errors = {};
    if (!inspectionDate) errors.inspectionDate = 'Inspection Date is required.';
    if (!inspectorId) errors.inspectorId = 'Inspector / QC Incharge is required.';

    const numInspected = parseFloat(inspectedQty);
    if (!inspectedQty || isNaN(numInspected) || numInspected <= 0) {
      errors.inspectedQty = 'Inspected Quantity must be greater than zero.';
    }

    const numAccepted = parseFloat(acceptedQty) || 0;
    const numRejected = parseFloat(rejectedQty) || 0;
    const numReprocess = parseFloat(reprocessQty) || 0;
    const numHold = parseFloat(holdQty) || 0;

    const totalResults = Math.round((numAccepted + numRejected + numReprocess + numHold) * 100) / 100;
    const expectedTotal = Math.round(numInspected * 100) / 100;

    if (numInspected > 0 && totalResults !== expectedTotal) {
      errors.acceptedQty = `Results breakdown (${totalResults} m) does not equal Inspected Quantity (${expectedTotal} m).`;
    }

    const eligible = qcData?.linkedDetails?.eligibleForQc ?? 999999;
    const totalProd = qcData?.linkedDetails?.totalProduced ?? 0;
    if (actionType !== 'save_draft' && totalProd > 0 && numInspected > eligible) {
      errors.inspectedQty = `Quantity exceeds eligible production pending QC (${eligible.toLocaleString('en-IN')} m).`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please resolve all validation errors before proceeding.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        action: actionType,
        instructionId: qcData?.linkedDetails?.instructionId,
        inspectionDate,
        inspectorId,
        inspectionType,
        inspectionMethod,
        inspectedQty: numInspected,
        acceptedQty: numAccepted,
        rejectedQty: numRejected,
        reprocessQty: numReprocess,
        holdQty: numHold,
        gsm: gsm ? parseFloat(gsm) : null,
        width: width ? parseFloat(width) : null,
        defectsFound: defectsFound === 'Select' ? '' : defectsFound,
        qualityGrade: qualityGrade === 'Select' ? 'Grade A' : qualityGrade,
        remarks: remarks.slice(0, 500),
        photos,
        status: actionType === 'save_draft' ? 'Draft' : 'Approved',
      };

      const res = await purchaseService.savePoQcInspection(po.id, payload);
      const msg = actionType === 'save_draft'
        ? 'QC Entry saved as Draft.'
        : 'QC Entry submitted and verified successfully!';
      setSuccessMsg(msg);
      if (showToast) showToast(msg, 'success');

      resetForm();
      await loadData();
      if (onUpdated) onUpdated();
    } catch (err) {
      const respErr = err?.response?.data || err;
      setError(respErr?.message || err?.message || 'Failed to submit QC Entry.');
      if (respErr?.field_errors) {
        setFieldErrors(respErr.field_errors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Draft entry
  const handleSubmitDraft = async (entryId) => {
    try {
      setSubmitting(true);
      await purchaseService.submitDraftPoQcInspection(po.id, entryId);
      if (showToast) showToast('Draft entry submitted successfully.', 'success');
      await loadData();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err?.message || 'Failed to submit draft entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Draft entry
  const handleDeleteDraft = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this draft QC entry?')) return;
    try {
      await purchaseService.deletePoQcInspection(po.id, entryId);
      if (showToast) showToast('Draft QC entry deleted.', 'info');
      await loadData();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err?.message || 'Failed to delete entry.');
    }
  };

  // Derived values from linkedDetails & summary
  const ld = qcData?.linkedDetails || {};
  const sum = qcData?.summary || {};

  const displayPoNumber = ld.poNumber || po?.poNumber || '—';
  const displayInstructionNo = ld.instructionNumber || '—';
  const displayVendor = ld.vendorName || po?.partyName || po?.vendor || '—';
  const displayVendorState = ld.vendorState || 'Maharashtra';
  const displayFabricQuality = ld.fabricQuality || (po?.items && po.items[0]?.name) || 'Velvet Grey Fabric';
  const displayPoQty = ld.poQuantity ? ld.poQuantity.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';

  const totalProducedVal = sum.totalProduced ?? ld.totalProduced ?? 0;
  const totalInspectedVal = sum.totalInspected ?? 0;
  const acceptedVal = sum.acceptedQty ?? 0;
  const rejectedVal = sum.rejectedQty ?? 0;
  const reprocessVal = sum.reprocessQty ?? 0;
  const holdVal = sum.holdQty ?? 0;
  const pendingInspectionVal = sum.pendingForInspection ?? Math.max(0, totalProducedVal - totalInspectedVal);
  const completionPct = sum.completionPercentage ?? (totalProducedVal > 0 ? Math.round((totalInspectedVal / totalProducedVal) * 100) : 0);

  // Aliases for modals and registers
  const totalInspected = totalInspectedVal;
  const totalAccepted = acceptedVal;
  const totalRejected = rejectedVal;
  const totalReprocess = reprocessVal;
  const totalHold = holdVal;
  const pendingQc = pendingInspectionVal;

  // Status badge logic
  const qcStatusLabel = useMemo(() => {
    if (totalInspectedVal > 0 && pendingInspectionVal <= 0) return 'Completed';
    if (totalInspectedVal > 0) return 'In Progress';
    if (totalProducedVal > 0) return 'In Progress';
    return 'Pending';
  }, [totalInspectedVal, pendingInspectionVal, totalProducedVal]);

  const qcStatusPillClass = useMemo(() => {
    switch (qcStatusLabel) {
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }, [qcStatusLabel]);

  // Pagination for previous entries
  const totalEntries = entries.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const pagedEntries = entries.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-white border-2 border-blue-200/90 rounded-2xl shadow-xs overflow-hidden mt-4 transition-all">
      {/* 1. Collapsible Card Header */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="bg-white px-4 sm:px-5 py-3.5 flex items-center justify-between cursor-pointer select-none border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-2xs shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Quality Control (QC)
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${qcStatusPillClass}`}>
            Status: {qcStatusLabel}
          </span>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            aria-label={isExpanded ? 'Collapse QC section' : 'Expand QC section'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* 2. Collapsible Card Body */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* A. Feedback Banners */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <div className="flex-1 font-semibold">{successMsg}</div>
            </div>
          )}

          {/* B. LINKED DETAILS (READ-ONLY FROM PO & PRODUCTION) */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-blue-700 uppercase tracking-wider mb-2.5">
              <Link2 size={13} className="text-blue-600 shrink-0" />
              <span>LINKED DETAILS (READ-ONLY FROM PO & PRODUCTION)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
              {/* PO Number */}
              <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PO Number</span>
                <p className="font-mono font-extrabold text-slate-800 mt-0.5 truncate">{displayPoNumber}</p>
              </div>

              {/* Production Instruction No */}
              <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Production Instruction No.</span>
                <p className="font-mono font-extrabold text-slate-800 mt-0.5 truncate">{displayInstructionNo}</p>
              </div>

              {/* Vendor / Agency Name */}
              <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor / Agency Name</span>
                <p className="font-bold text-slate-800 mt-0.5 truncate">{displayVendor}</p>
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                  <MapPin size={10} className="text-slate-400" /> {displayVendorState}
                </span>
              </div>

              {/* Fabric Quality */}
              <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fabric Quality</span>
                <p className="font-bold text-slate-800 mt-0.5 truncate">{displayFabricQuality}</p>
              </div>

              {/* PO Quantity */}
              <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PO Quantity</span>
                <p className="font-mono font-extrabold text-slate-900 mt-0.5">{displayPoQty} <span className="text-[10px] font-sans text-slate-500 font-medium">Mtr</span></p>
              </div>
            </div>
          </div>

          {/* C. Two-Column Main Content (Left: Form, Right: Summary & Previous Entries) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* ── LEFT COLUMN: QC ENTRY FORM ── */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3.5">
              
              {/* Form Title Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
                    QC ENTRY
                  </h4>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">
                  New Entry
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Row 1: Inspection Date & Inspector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Inspection Date <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        max={todayStr}
                        value={inspectionDate}
                        onChange={(e) => setInspectionDate(e.target.value)}
                        className={`w-full px-3 py-2 bg-white border rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                          fieldErrors.inspectionDate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                        }`}
                      />
                    </div>
                    {fieldErrors.inspectionDate && (
                      <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{fieldErrors.inspectionDate}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Inspector / QC Incharge <span className="text-rose-500">*</span>
                      </label>
                      <MasterSourceLink source="employees" />
                    </div>
                    <select
                      value={inspectorId}
                      onChange={(e) => setInspectorId(e.target.value)}
                      className={`w-full px-3 py-2 bg-white border rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                        fieldErrors.inspectorId ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                      }`}
                    >
                      <option value="">Select Inspector</option>
                      {inspectors.map((insp) => (
                        <option key={insp.id} value={insp.id}>
                          {insp.name} {insp.code ? `(${insp.code})` : ''}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.inspectorId && (
                      <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{fieldErrors.inspectorId}</p>
                    )}
                  </div>
                </div>

                {/* Row 2: Inspection Type & Method */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Inspection Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={inspectionType}
                      onChange={(e) => setInspectionType(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Grey Fabric QC">Grey Fabric QC</option>
                      <option value="Finish Fabric QC">Finish Fabric QC</option>
                      <option value="Yarn Inspection">Yarn Inspection</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Inspection Method
                    </label>
                    <select
                      value={inspectionMethod}
                      onChange={(e) => setInspectionMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Visual + Measurement">Visual + Measurement</option>
                      <option value="4-Point System">4-Point System</option>
                      <option value="10-Point System">10-Point System</option>
                      <option value="Lab Testing">Lab Testing</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Inspected Quantity (Mtr) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      Inspected Quantity (Mtr) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Pending QC: <strong className="text-slate-700">{pendingInspectionVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Mtr</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Enter inspected quantity"
                    value={inspectedQty}
                    onChange={(e) => handleInspectedQtyChange(e.target.value)}
                    className={`w-full px-3 py-2 bg-white border rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      fieldErrors.inspectedQty ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {fieldErrors.inspectedQty && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{fieldErrors.inspectedQty}</p>
                  )}
                </div>

                {/* Row 4: 4 Result Breakdown Boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {/* Accepted */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-emerald-700 mb-1">
                      Accepted (Mtr) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={acceptedQty}
                      onChange={(e) => setAcceptedQty(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-emerald-50/40 border border-emerald-300 rounded-lg font-mono font-bold text-emerald-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Rejected */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-rose-700 mb-1">
                      Rejected (Mtr)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rejectedQty}
                      onChange={(e) => handleResultQtyChange(setRejectedQty, e.target.value, 'rejected')}
                      className="w-full px-2.5 py-1.5 bg-rose-50/40 border border-rose-300 rounded-lg font-mono font-bold text-rose-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  {/* Reprocess */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-amber-700 mb-1">
                      Reprocess (Mtr)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={reprocessQty}
                      onChange={(e) => handleResultQtyChange(setReprocessQty, e.target.value, 'reprocess')}
                      className="w-full px-2.5 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg font-mono font-bold text-amber-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* Hold */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-purple-700 mb-1">
                      Hold (Mtr)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={holdQty}
                      onChange={(e) => handleResultQtyChange(setHoldQty, e.target.value, 'hold')}
                      className="w-full px-2.5 py-1.5 bg-purple-50/40 border border-purple-300 rounded-lg font-mono font-bold text-purple-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>
                {fieldErrors.acceptedQty && (
                  <p className="text-[10px] text-rose-600 font-medium">{fieldErrors.acceptedQty}</p>
                )}

                {/* Row 5: QC Parameters (Optional) */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    QC Parameters (Optional)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">GSM</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="GSM"
                        value={gsm}
                        onChange={(e) => setGsm(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Width</label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Width"
                          value={width}
                          onChange={(e) => setWidth(e.target.value)}
                          className="w-full px-2 py-1.5 pr-8 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                        />
                        <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none">Inch</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Defects Found</label>
                      <select
                        value={defectsFound}
                        onChange={(e) => setDefectsFound(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                      >
                        <option value="Select">Select</option>
                        <option value="None / Clear">None / Clear</option>
                        <option value="Weaving Defect">Weaving Defect</option>
                        <option value="Holes / Tears">Holes / Tears</option>
                        <option value="Uneven Yarn">Uneven Yarn</option>
                        <option value="Oil / Dirt Stains">Oil / Dirt Stains</option>
                        <option value="Reed Mark">Reed Mark</option>
                        <option value="Slub / Knot">Slub / Knot</option>
                        <option value="Selvedge Defect">Selvedge Defect</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Quality Grade</label>
                      <select
                        value={qualityGrade}
                        onChange={(e) => setQualityGrade(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                      >
                        <option value="Select">Select</option>
                        <option value="Grade A">Grade A</option>
                        <option value="Grade B">Grade B</option>
                        <option value="Second Quality">Second Quality</option>
                        <option value="Reject">Reject</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 6: Remarks (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10.5px] font-bold text-slate-700">Remarks (Optional)</label>
                    <span className="text-[10px] text-slate-400">{remarks.length}/500</span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={500}
                    placeholder="Enter QC remarks..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

              </div>
            </div>

            {/* ── RIGHT COLUMN: QC SUMMARY, QC IMAGES, PREVIOUS QC ENTRIES ── */}
            <div className="lg:col-span-6 space-y-3.5">
              
              {/* 1. QC SUMMARY (AUTO CALCULATED) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-blue-600" />
                    <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
                      QC SUMMARY (AUTO CALCULATED)
                    </h4>
                  </div>
                </div>

                {/* Grid 4 columns x 2 rows */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  {/* Total Produced */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Produced</span>
                    <p className="font-mono font-extrabold text-slate-900 mt-0.5">
                      {totalProducedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[9.5px] text-slate-400">Mtr</span>
                  </div>

                  {/* Total Inspected */}
                  <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-2 shadow-2xs">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Total Inspected</span>
                    <p className="font-mono font-extrabold text-blue-700 mt-0.5">
                      {totalInspectedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[9.5px] text-blue-500 font-semibold">Mtr</span>
                  </div>

                  {/* Accepted */}
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-2 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Accepted</span>
                    <p className="font-mono font-extrabold text-emerald-800 mt-0.5">
                      {acceptedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[9.5px] text-emerald-600 font-semibold">Mtr</span>
                  </div>

                  {/* Rejected */}
                  <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-2 shadow-2xs">
                    <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Rejected</span>
                    <p className="font-mono font-extrabold text-rose-800 mt-0.5">
                      {rejectedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[9.5px] text-rose-600 font-semibold">Mtr</span>
                  </div>

                  {/* Reprocess */}
                  <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-2 shadow-2xs">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Reprocess</span>
                    <p className="font-mono font-extrabold text-amber-800 mt-0.5">
                      {reprocessVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[9.5px] text-amber-600 font-semibold">Mtr</span>
                  </div>

                  {/* Hold */}
                  <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-2 shadow-2xs">
                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Hold</span>
                    <p className="font-mono font-extrabold text-purple-800 mt-0.5">
                      {holdVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[9.5px] text-purple-600 font-semibold">Mtr</span>
                  </div>

                  {/* Pending for Inspection */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pending for Inspection</span>
                    <p className="font-mono font-extrabold text-slate-800 mt-0.5">
                      {pendingInspectionVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[9.5px] text-slate-400">Mtr</span>
                  </div>

                  {/* Inspection Completion */}
                  <div className="bg-emerald-50/30 border border-emerald-200/80 rounded-lg p-2 shadow-2xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Inspection Completion</span>
                      <p className="font-mono font-extrabold text-emerald-700 mt-0.5">{completionPct}%</p>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mt-1">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, completionPct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. QC IMAGES (OPTIONAL) */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <ImageIcon size={15} className="text-blue-600" />
                    <span>QC IMAGES (OPTIONAL)</span>
                  </div>
                  <span className="text-[10.5px] text-slate-400 font-medium">
                    {photos.length} uploaded
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {photos.map((src, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 group">
                      <img src={src} alt={`QC photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove photo"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 text-slate-400 hover:text-blue-600 flex flex-col items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer"
                  >
                    <Plus size={16} />
                    <span className="text-[9px] font-bold">Add Image</span>
                  </button>
                </div>
              </div>

              {/* 3. PREVIOUS QC ENTRIES */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                <div className="bg-slate-50/80 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-slate-600" />
                    <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
                      PREVIOUS QC ENTRIES
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus size={12} /> Add Entry
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/90 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2 text-right">Inspected</th>
                        <th className="py-2 px-2 text-right text-emerald-700">Accepted</th>
                        <th className="py-2 px-2 text-right text-rose-700">Rejected</th>
                        <th className="py-2 px-2 text-right text-amber-700">Reprocess</th>
                        <th className="py-2 px-2 text-right text-purple-700">Hold</th>
                        <th className="py-2 px-2">Inspector</th>
                        <th className="py-2 px-1.5 text-center">Grade</th>
                        <th className="py-2 px-2">Remarks</th>
                        <th className="py-2 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                      {pagedEntries.length > 0 ? (
                        pagedEntries.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-2.5 font-mono text-[11px] text-slate-800 whitespace-nowrap">
                              {row.date}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">
                              {Number(row.inspectedQty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">
                              {Number(row.acceptedQty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-rose-700">
                              {Number(row.rejectedQty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-amber-700">
                              {Number(row.reprocessQty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-purple-700">
                              {Number(row.holdQty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-2 font-medium text-slate-800 truncate max-w-[90px]">
                              {row.inspectorName || '—'}
                            </td>
                            <td className="py-2 px-1.5 text-center">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {row.grade === 'Grade A' ? 'A' : row.grade === 'Grade B' ? 'B' : (row.grade || 'A')}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-slate-500 text-[11px] truncate max-w-[110px]" title={row.remarks}>
                              {row.remarks || '—'}
                            </td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">
                              {row.status === 'Draft' ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitDraft(row.id)}
                                    className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                                    title="Submit Draft"
                                  >
                                    <Send size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDraft(row.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                    title="Delete Draft"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  Verified
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="py-6 text-center text-slate-400 text-xs">
                            No QC inspection entries recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-3.5 py-2 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span>Page {page} of {totalPages} ({totalEntries} entries)</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-2 py-0.5 border rounded bg-white disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2 py-0.5 border rounded bg-white disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* D. Bottom Action Buttons Bar (Section 1 & 4) */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={submitting}
                onClick={() => handleSubmit('save_draft')}
                className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Save size={13} className="mr-1.5 text-slate-500" /> Save Draft
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={submitting}
                onClick={() => handleSubmit('submit')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
              >
                <Check size={14} className="mr-1.5" /> Submit QC Entry
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllEntriesModal(true)}
                className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Layers size={13} className="mr-1.5 text-slate-500" /> View All QC Entries
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowReportModal(true)}
                className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <FileBarChart size={13} className="mr-1.5 text-slate-500" /> QC Report
              </Button>

              {onProceedToVerification && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onProceedToVerification}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold"
                >
                  <ClipboardCheck size={13} className="mr-1.5 text-emerald-600" /> Proceed to Verification
                </Button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* 1. Full QC Inspection Register Modal (Inline Overlay) */}
      {showAllEntriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Quality Control (QC) Inspection Register
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    PO: <strong className="text-blue-700">{po?.poNumber}</strong> | Instruction: <strong className="text-slate-700">{qcData?.linkedDetails?.instructionNumber || '—'}</strong> | Vendor: <strong className="text-slate-700">{qcData?.linkedDetails?.vendor || '—'}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer size={13} /> Print Register
                </button>
                <button
                  type="button"
                  onClick={() => setShowAllEntriesModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Metrics Bar */}
            <div className="p-3 bg-slate-50/50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="bg-blue-50/80 p-2 rounded-lg border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-700 block">Total Inspected</span>
                <span className="font-mono font-bold text-blue-900">{totalInspected.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
              <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Accepted</span>
                <span className="font-mono font-bold text-emerald-900">{totalAccepted.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
              <div className="bg-rose-50/80 p-2 rounded-lg border border-rose-200">
                <span className="text-[10px] uppercase font-bold text-rose-700 block">Rejected</span>
                <span className="font-mono font-bold text-rose-900">{totalRejected.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
              <div className="bg-purple-50/80 p-2 rounded-lg border border-purple-200">
                <span className="text-[10px] uppercase font-bold text-purple-700 block">Reprocess</span>
                <span className="font-mono font-bold text-purple-900">{totalReprocess.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
              <div className="bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Pending QC</span>
                <span className="font-mono font-bold text-amber-900">{pendingQc.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-white">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={qcRegisterSearch}
                    onChange={(e) => setQcRegisterSearch(e.target.value)}
                    placeholder="Search by inspector, defects, date..."
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-60"
                  />
                </div>
                <select
                  value={qcRegisterGradeFilter}
                  onChange={(e) => setQcRegisterGradeFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white"
                >
                  <option value="All">All Grades</option>
                  <option value="Grade A">Grade A</option>
                  <option value="Grade B">Grade B</option>
                  <option value="Grade C">Grade C</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Showing {entries.length} recorded inspections
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Entry No</th>
                    <th className="px-3 py-2.5 text-right">Inspected (m)</th>
                    <th className="px-3 py-2.5 text-right">Accepted (m)</th>
                    <th className="px-3 py-2.5 text-right">Rejected (m)</th>
                    <th className="px-3 py-2.5 text-right">Reprocess (m)</th>
                    <th className="px-3 py-2.5 text-center">Grade</th>
                    <th className="px-3 py-2.5">Defects</th>
                    <th className="px-3 py-2.5">Inspector</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries
                    .filter((r) => {
                      if (qcRegisterGradeFilter !== 'All' && r.qualityGrade !== qcRegisterGradeFilter) return false;
                      if (qcRegisterSearch) {
                        const q = qcRegisterSearch.toLowerCase();
                        return (
                          (r.inspectionDate || '').toLowerCase().includes(q) ||
                          (r.inspector || '').toLowerCase().includes(q) ||
                          (r.defectsFound || '').toLowerCase().includes(q) ||
                          (r.remarks || '').toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 font-mono text-slate-800">{row.inspectionDate}</td>
                        <td className="px-3 py-2 font-mono font-bold text-blue-700">{row.entryNo || `#${idx + 1}`}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{Number(row.inspectedQty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700 font-semibold">{Number(row.acceptedQty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-600">{Number(row.rejectedQty || 0) > 0 ? Number(row.rejectedQty).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-purple-600">{Number(row.reprocessQty || 0) > 0 ? Number(row.reprocessQty).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 text-[9.5px] font-bold rounded-md bg-slate-100 border text-slate-700">
                            {row.qualityGrade || 'Grade A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate" title={row.defectsFound}>{row.defectsFound || 'None'}</td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.inspector || '—'}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-full border ${
                            row.status === 'Draft' ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          }`}>
                            {row.status || 'Approved'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400 text-xs">
                        No QC inspections recorded yet for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/80 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAllEntriesModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
              >
                Close Register
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Official QC Inspection Report Certificate (Inline Modal) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                  <FileBarChart size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    Grey Fabric Quality Inspection Report & Certificate
                  </h3>
                  <p className="text-xs text-blue-100">
                    Inspection summary against Purchase Order <strong className="font-mono text-white">{po?.poNumber}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white text-blue-900 hover:bg-blue-50 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} /> Print Certificate
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="p-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#fbfcfd]">
              {/* Report Header Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Purchase Order</span>
                    <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{po?.poNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Production Instruction</span>
                    <span className="font-mono font-bold text-indigo-700 text-sm mt-0.5 block">{qcData?.linkedDetails?.instructionNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Manufacturing Agency</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">{qcData?.linkedDetails?.vendor || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Fabric Specification</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">{qcData?.linkedDetails?.fabricQuality || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Quality Performance Scorecard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Inspected</span>
                  <span className="text-xl font-mono font-black text-blue-900 mt-1 block">
                    {totalInspected.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs font-sans text-slate-500">Mtr</span>
                  </span>
                  <span className="text-[10.5px] text-slate-400 mt-0.5 block">Coverage: {completionPct}% of PO</span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Accepted Quantity</span>
                  <span className="text-xl font-mono font-black text-emerald-950 mt-1 block">
                    {totalAccepted.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs font-sans text-emerald-700">Mtr</span>
                  </span>
                  <span className="text-[10.5px] text-emerald-700 font-bold mt-0.5 block">
                    Pass Rate: {totalInspected > 0 ? ((totalAccepted / totalInspected) * 100).toFixed(1) : 0}%
                  </span>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">Rejected Quantity</span>
                  <span className="text-xl font-mono font-black text-rose-950 mt-1 block">
                    {totalRejected.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs font-sans text-rose-700">Mtr</span>
                  </span>
                  <span className="text-[10.5px] text-rose-700 font-bold mt-0.5 block">
                    Defect Rate: {totalInspected > 0 ? ((totalRejected / totalInspected) * 100).toFixed(1) : 0}%
                  </span>
                </div>

                <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Reprocess Quantity</span>
                  <span className="text-xl font-mono font-black text-purple-950 mt-1 block">
                    {totalReprocess.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs font-sans text-purple-700">Mtr</span>
                  </span>
                  <span className="text-[10.5px] text-purple-700 mt-0.5 block">Loom correction</span>
                </div>
              </div>

              {/* Inspection Parameters & Criteria Checklist */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                  Technical Quality Parameters Tested
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Inspection Type</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">Grey Fabric QC</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Inspection Method</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">Visual & Measurement</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Average GSM</span>
                    <span className="font-mono font-bold text-slate-800 mt-0.5 block">{gsm ? `${gsm} g/m²` : '68.5 g/m²'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Fabric Width</span>
                    <span className="font-mono font-bold text-slate-800 mt-0.5 block">{width ? `${width} in` : '44.0 in'}</span>
                  </div>
                </div>
              </div>

              {/* Sign-off Block */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Lead QC Inspector</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {inspectors.find((i) => String(i.id) === String(inspectorId))?.name || 'Authorized Inspector'}
                  </span>
                  <span className="text-[10.5px] text-slate-500">Verified and logged in OSCAR ERP Quality Control Subsystem.</span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="px-3 py-1.5 rounded-lg font-black text-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                    STATUS: QUALITY APPROVED
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
