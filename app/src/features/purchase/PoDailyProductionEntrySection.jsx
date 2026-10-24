import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Factory, Calendar, UserCheck, FileText, CheckCircle2, ArrowRight,
  Clock, Layers, AlertCircle, Save, Send, ShieldCheck, Lock, ExternalLink,
  Plus, ChevronLeft, ChevronRight, Activity, AlertTriangle, RefreshCw,
  Check, Info, Sparkles, Filter, Trash2, X, Printer, Search
} from 'lucide-react';
import { purchaseService } from '../../services/domainServices';
import { Button } from '../../components/ui/Button';
import { useERP } from '../../context/ERPContext';
import { useAppStore } from '../../stores/appStore';

export function PoDailyProductionEntrySection({ po, onUpdated, navigate, onSwitchToInstruction, onProceedToQc }) {
  const { showToast } = useERP() || {};
  const currentUser = useAppStore((s) => s.currentUser);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState(null);

  const [poData, setPoData] = useState(null);
  const [instruction, setInstruction] = useState(null);
  const [instructionsList, setInstructionsList] = useState([]);
  const [selectedInstructionId, setSelectedInstructionId] = useState('');
  const [entries, setEntries] = useState([]);

  // Form fields
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [entryDate, setEntryDate] = useState(todayStr);
  const [producedMeters, setProducedMeters] = useState('');
  const [rejectedMeters, setRejectedMeters] = useState('');
  const [reprocessMeters, setReprocessMeters] = useState('');
  const [remarks, setRemarks] = useState('');

  // Pagination for previous entries table
  const [page, setPage] = useState(1);
  const [showAllEntriesModal, setShowAllEntriesModal] = useState(false);
  const [registerSearch, setRegisterSearch] = useState('');
  const [registerStatusFilter, setRegisterStatusFilter] = useState('All');
  const pageSize = 5;

  const formRef = useRef(null);

  // Load PO production instruction data and entries
  const loadData = async (instId = null) => {
    if (!po?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await purchaseService.getPoProductionInstruction(po.id, instId ? { instructionId: instId } : {});
      setPoData(res.po || null);
      const list = res.instructions || [];
      setInstructionsList(list);

      if (res.instruction) {
        setInstruction(res.instruction);
        setSelectedInstructionId(res.instruction.id);
        setEntries(res.instruction.entries || []);
      } else {
        setInstruction(null);
        setEntries([]);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load Daily Production details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [po?.id]);

  const handleSelectInstruction = (id) => {
    setSelectedInstructionId(id);
    loadData(id);
  };

  // Calculate live preview of accepted quantity from the form values
  const liveProduced = Number(producedMeters) || 0;
  const liveRejected = Number(rejectedMeters) || 0;
  const liveReprocess = Number(reprocessMeters) || 0;
  const liveAccepted = Math.max(0, liveProduced - liveRejected - liveReprocess);

  // Summary Metrics from linked instruction
  const comp = instruction?.completion || {};
  const instructedQty = Number(instruction?.orderMeter || poData?.poQuantity || 0);
  const totalProduced = Number(comp.totalProduced || 0);
  const acceptedQty = Number(comp.acceptedQty || (totalProduced - Number(comp.rejectedQty || 0) - Number(comp.reprocessQty || 0)));
  const rejectedQty = Number(comp.rejectedQty || 0);
  const reprocessQty = Number(comp.reprocessQty || 0);
  const balanceQty = Math.max(0, instructedQty - totalProduced);
  const completionPct = comp.completionPercentage !== undefined
    ? Number(comp.completionPercentage)
    : (instructedQty > 0 ? Math.min(100, Math.round((totalProduced / instructedQty) * 1000) / 10) : 0);

  // Form submission: save draft vs submit entry
  const handleSubmitEntry = async (actionType = 'Submitted') => {
    setError(null);
    setFieldErrors({});
    setSuccessMsg(null);

    const errors = {};
    if (!instruction?.id) {
      errors.instruction = 'No approved Production Instruction found. Please approve the instruction first.';
    }
    if (!entryDate) {
      errors.entryDate = 'Production Date is required.';
    } else if (entryDate > todayStr) {
      errors.entryDate = 'Production Date cannot be in the future.';
    }

    const numProduced = Number(producedMeters);
    if (!numProduced || numProduced <= 0 || isNaN(numProduced)) {
      errors.producedMeters = "Today's Produced Quantity must be greater than zero.";
    } else if (balanceQty > 0 && numProduced > (balanceQty * 1.25)) {
      errors.producedMeters = `Produced quantity exceeds remaining balance (${balanceQty.toLocaleString('en-IN')} Mtr) by more than 25%.`;
    }

    const numRejected = Number(rejectedMeters) || 0;
    if (numRejected < 0) {
      errors.rejectedMeters = 'Rejected quantity cannot be negative.';
    } else if (numRejected > numProduced) {
      errors.rejectedMeters = 'Rejected quantity cannot exceed today\'s produced quantity.';
    }

    const numReprocess = Number(reprocessMeters) || 0;
    if (numReprocess < 0) {
      errors.reprocessMeters = 'Reprocess quantity cannot be negative.';
    } else if (numReprocess > numProduced) {
      errors.reprocessMeters = 'Reprocess quantity cannot exceed today\'s produced quantity.';
    }

    if ((numRejected + numReprocess) > numProduced) {
      errors.rejectedMeters = 'Sum of rejected and reprocess quantities cannot exceed today\'s produced quantity.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        instructionId: instruction.id,
        instruction_id: instruction.id,
        enteredByEmployeeId: instruction?.employeeId || instruction?.supervisorId || undefined,
        entry_date: entryDate,
        entryDate: entryDate,
        meters: numProduced,
        reject_meter: numRejected,
        rejectMeter: numRejected,
        reprocess_meter: numReprocess,
        reprocessMeter: numReprocess,
        good_meter: liveAccepted,
        goodMeter: liveAccepted,
        remarks: remarks.trim(),
        status: actionType, // 'Draft' or 'Submitted'
      };

      const res = await purchaseService.createDailyProductionEntry(payload);
      const isDraft = actionType === 'Draft';
      const msg = isDraft ? 'Daily production entry saved as Draft.' : 'Daily production entry submitted successfully!';
      setSuccessMsg(msg);
      if (showToast) showToast(msg, 'success');

      // Reset form
      setProducedMeters('');
      setRejectedMeters('');
      setReprocessMeters('');
      setRemarks('');
      setEntryDate(todayStr);

      // Reload fresh data from backend
      await loadData(instruction.id);
      if (onUpdated) onUpdated();
    } catch (err) {
      const fErrors = err?.field_errors || err?.fieldErrors;
      if (fErrors && Object.keys(fErrors).length > 0) {
        const mapped = {};
        const errorList = [];
        Object.entries(fErrors).forEach(([k, v]) => {
          const val = Array.isArray(v) ? v.join(', ') : v;
          mapped[k] = val;
          errorList.push(val);
        });
        setFieldErrors(mapped);
        setError(err?.message && err.message !== 'Some fields need attention.' ? err.message : (errorList.length ? errorList.join('; ') : 'Validation failed. Please review your entries.'));
      } else {
        setError(err?.message || 'Failed to record daily production entry.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Submit an existing draft entry
  const handleSubmitExistingDraft = async (entryId) => {
    if (!entryId) return;
    try {
      await purchaseService.submitDailyProductionEntry(entryId);
      if (showToast) showToast('Draft entry submitted successfully!', 'success');
      await loadData(instruction?.id);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err?.message || 'Failed to submit draft entry.');
    }
  };

  // Delete entry (draft only)
  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this daily production entry?')) return;
    try {
      await purchaseService.deleteDailyProductionEntry(entryId);
      if (showToast) showToast('Entry deleted successfully.', 'info');
      await loadData(instruction?.id);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err?.message || 'Failed to delete entry.');
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs mt-4">
        <Clock className="w-6 h-6 mx-auto mb-2 animate-spin text-teal-600" />
        Loading Daily Production Entry details...
      </div>
    );
  }

  // Linked Details — Read Only values (strictly from PO & Instruction)
  const displayPoNumber = poData?.poNumber || po?.poNumber || '—';
  const displayInstructionNumber = instruction?.instructionNumber || '—';
  const displayVendor = poData?.vendorName || po?.vendor || po?.partyName || instruction?.agencyName || '—';
  const displayFabric = instruction?.fabric || poData?.fabricName || (po?.items && po.items[0]?.name) || po?.notes || 'Grey Fabric';
  const displayRate = poData?.rate ?? (po?.items && po.items[0]?.rate) ?? 0;
  const displayAmount = poData?.poAmount ?? po?.amount ?? po?.total ?? (instructedQty * Number(displayRate));

  // Pagination calculation
  const totalEntries = entries.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const pagedEntries = entries.slice((page - 1) * pageSize, page * pageSize);

  // Status badge styling helper
  const getInstructionStatusBadge = (st) => {
    switch (st) {
      case 'Completed':
      case 'Verified':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'Running':
      case 'In Progress':
      case 'Partially Completed':
        return 'bg-teal-50 text-teal-700 border-teal-300';
      case 'Approved':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'Draft':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="bg-white border-2 border-teal-100 rounded-xl shadow-xs overflow-hidden mt-4">
      {/* 1. Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-teal-500/20 text-teal-300 rounded-lg border border-teal-400/30">
            <Factory size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-wide text-white">Daily Production Entry</h3>
              {instruction?.status && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getInstructionStatusBadge(instruction.status)}`}>
                  {instruction.status}
                </span>
              )}
            </div>
            <p className="text-[11px] text-teal-200/80">Grey Fabric Daily Output Tracking for Vendor A</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchToInstruction && (
            <button
              type="button"
              onClick={onSwitchToInstruction}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileText size={12} /> View Instruction
            </button>
          )}
          {onProceedToQc && (
            <button
              type="button"
              onClick={onProceedToQc}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ShieldCheck size={12} /> QC Stage
            </button>
          )}
          {instruction?.id && (
            <button
              type="button"
              onClick={() => setShowAllEntriesModal(true)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-teal-500 hover:bg-teal-600 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Layers size={12} /> Full Register View
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Error and Success Feedback Banners */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1">{error}</div>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <div className="flex-1 font-semibold">{successMsg}</div>
          </div>
        )}

        {/* 2. Multiple Instruction / Line Selector (Requirement 1: Do not mix quantities) */}
        {instructionsList.length > 1 && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-indigo-900">
                Multiple Fabric Instructions Linked to this PO ({instructionsList.length}):
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="inst-select" className="text-[11px] text-indigo-700 font-medium">Select Active Instruction:</label>
              <select
                id="inst-select"
                value={selectedInstructionId}
                onChange={(e) => handleSelectInstruction(e.target.value)}
                className="text-xs bg-white border border-indigo-300 rounded-lg px-2.5 py-1 font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
              >
                {instructionsList.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.instructionNumber} — {inst.fabric || 'Grey Fabric'} ({Number(inst.orderMeter).toLocaleString('en-IN')} Mtr) [{inst.status}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 3. Linked Details — Read Only (Section 3: strictly from PO & Instruction) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-200/80">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Lock size={13} className="text-slate-400" />
              <span>Linked Details (Read Only from PO & Instruction)</span>
            </div>
            <span className="text-[10.5px] text-slate-400 italic">Values automatically linked & non-editable</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">PO Number</p>
              <p className="font-mono font-bold text-slate-800 truncate" title={displayPoNumber}>{displayPoNumber}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Instruction No.</p>
              <p className="font-mono font-bold text-teal-700 truncate" title={displayInstructionNumber}>{displayInstructionNumber}</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">Vendor / Agency</p>
              <p className="font-semibold text-slate-800 truncate" title={displayVendor}>{displayVendor}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Fabric Quality</p>
              <p className="font-semibold text-slate-800 truncate" title={displayFabric}>{displayFabric}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">PO Quantity</p>
              <p className="font-mono font-bold text-slate-900">{instructedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Mtr</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">PO Rate</p>
              <p className="font-mono font-semibold text-slate-700">₹{Number(displayRate).toFixed(2)}/Mtr</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">PO Amount</p>
              <p className="font-mono font-bold text-slate-900">₹{Number(displayAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* 4 & 5. Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column: Daily Production Entry Form */}
          <div ref={formRef} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-teal-600" />
                <h4 className="font-bold text-xs uppercase tracking-wide text-slate-800">Daily Production Form</h4>
              </div>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                Vendor A Grey Output
              </span>
            </div>

            <div className="p-4 space-y-3.5">
              {/* Production Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Production Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={entryDate}
                    max={todayStr}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className={`w-full text-xs font-mono border rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 ${
                      fieldErrors.entryDate ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-teal-200'
                    }`}
                  />
                </div>
                {fieldErrors.entryDate ? (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.entryDate}</p>
                ) : (
                  <p className="text-[10.5px] text-slate-400 mt-1">Date of actual production (future dates restricted)</p>
                )}
              </div>

              {/* Today's Produced Quantity (Mtr) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Today's Produced Quantity (Mtr) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10.5px] font-mono text-slate-500">
                    Remaining: <strong className="text-slate-800">{balanceQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Mtr</strong>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 450.00"
                    value={producedMeters}
                    onChange={(e) => setProducedMeters(e.target.value)}
                    className={`w-full text-xs font-mono font-bold border rounded-lg px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 ${
                      fieldErrors.producedMeters ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-teal-200'
                    }`}
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">Mtr</span>
                </div>
                {fieldErrors.producedMeters ? (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.producedMeters}</p>
                ) : (
                  <p className="text-[10.5px] text-slate-400 mt-1">Total grey fabric produced today (not the total PO qty)</p>
                )}
              </div>

              {/* Rejected & Reprocess Quantities in 2 Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Rejected Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rejected Quantity (Mtr)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={rejectedMeters}
                      onChange={(e) => setRejectedMeters(e.target.value)}
                      className={`w-full text-xs font-mono border rounded-lg px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 ${
                        fieldErrors.rejectedMeters ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-rose-200'
                      }`}
                    />
                    <span className="absolute right-3 top-1.5 text-xs text-slate-400">Mtr</span>
                  </div>
                  {fieldErrors.rejectedMeters && (
                    <p className="text-[10.5px] text-rose-600 mt-1">{fieldErrors.rejectedMeters}</p>
                  )}
                </div>

                {/* Reprocess Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reprocess Quantity (Mtr)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={reprocessMeters}
                      onChange={(e) => setReprocessMeters(e.target.value)}
                      className={`w-full text-xs font-mono border rounded-lg px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 ${
                        fieldErrors.reprocessMeters ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-purple-200'
                      }`}
                    />
                    <span className="absolute right-3 top-1.5 text-xs text-slate-400">Mtr</span>
                  </div>
                  {fieldErrors.reprocessMeters && (
                    <p className="text-[10.5px] text-rose-600 mt-1">{fieldErrors.reprocessMeters}</p>
                  )}
                </div>
              </div>

              {/* Live Quantity Partitioning Calculation Box */}
              {liveProduced > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Today's Total Output:</span>
                    <span className="font-mono font-bold text-slate-800">{liveProduced.toFixed(2)} Mtr</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 font-semibold">
                    <span>Good / Accepted Output:</span>
                    <span className="font-mono font-bold">{liveAccepted.toFixed(2)} Mtr</span>
                  </div>
                  {(liveRejected > 0 || liveReprocess > 0) && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                      <span>Breakdown:</span>
                      <span className="font-mono">
                        {liveAccepted.toFixed(1)} acc + {liveRejected.toFixed(1)} rej + {liveReprocess.toFixed(1)} repr
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks / Production Observations
                </label>
                <textarea
                  rows={2}
                  placeholder="Note delays, loom issues, defect descriptions, differences..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-200 resize-none"
                />
              </div>

              {/* Metadata Bar */}
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-[10.5px] text-slate-500 flex flex-wrap items-center justify-between gap-1 border border-slate-100">
                <span>Entered By: <strong className="text-slate-700">{currentUser?.name || currentUser?.email || 'Authenticated User'}</strong></span>
                <span>Time: <strong className="text-slate-700 font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
              </div>

              {/* Bottom Actions inside the form card */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => handleSubmitEntry('Draft')}
                  className="text-xs"
                >
                  <Save size={13} className="mr-1" />
                  Save Draft
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={submitting}
                  onClick={() => handleSubmitEntry('Submitted')}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {submitting ? (
                    <>
                      <Clock size={13} className="animate-spin mr-1" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={13} className="mr-1" /> Submit Entry
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Auto-Calculated Production Summary + Previous Entries Table */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Auto-Calculated Production Summary Card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-teal-600" />
                  <h4 className="font-bold text-xs uppercase tracking-wide text-slate-800">
                    Auto-Calculated Production Summary
                  </h4>
                </div>
                <div className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
                  <span>{completionPct}% Complete</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden border border-slate-200">
                <div
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, completionPct)}%` }}
                />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {/* 1. PO / Instructed Quantity */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                  <p className="text-[10px] uppercase font-bold text-slate-400">PO / Instructed</p>
                  <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                    {instructedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-sans">Mtr</span>
                  </p>
                </div>

                {/* 2. Total Produced Till Date */}
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5">
                  <p className="text-[10px] uppercase font-bold text-blue-600">Produced Till Date</p>
                  <p className="text-sm font-mono font-bold text-blue-900 mt-0.5">
                    {totalProduced.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] text-blue-600 font-sans">Mtr</span>
                  </p>
                </div>

                {/* 3. Accepted Quantity */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5">
                  <p className="text-[10px] uppercase font-bold text-emerald-600">Accepted Qty</p>
                  <p className="text-sm font-mono font-bold text-emerald-900 mt-0.5">
                    {acceptedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] text-emerald-600 font-sans">Mtr</span>
                  </p>
                </div>

                {/* 4. Rejected Quantity */}
                <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2.5">
                  <p className="text-[10px] uppercase font-bold text-rose-600">Rejected Qty</p>
                  <p className="text-sm font-mono font-bold text-rose-900 mt-0.5">
                    {rejectedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] text-rose-600 font-sans">Mtr</span>
                  </p>
                </div>

                {/* 5. Reprocess Quantity */}
                <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-2.5">
                  <p className="text-[10px] uppercase font-bold text-purple-600">Reprocess Qty</p>
                  <p className="text-sm font-mono font-bold text-purple-900 mt-0.5">
                    {reprocessQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] text-purple-600 font-sans">Mtr</span>
                  </p>
                </div>

                {/* 6. Balance Quantity */}
                <div className={`border rounded-xl p-2.5 ${balanceQty <= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50/70 border-amber-200/80'}`}>
                  <p className={`text-[10px] uppercase font-bold ${balanceQty <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {balanceQty <= 0 ? 'Production Met' : 'Balance Qty'}
                  </p>
                  <p className={`text-sm font-mono font-bold ${balanceQty <= 0 ? 'text-emerald-800' : 'text-amber-900'} mt-0.5`}>
                    {balanceQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] font-sans">Mtr</span>
                  </p>
                </div>
              </div>

              {/* Next Stage Indicator: Grey Fabric QC */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-600 shrink-0" />
                  <span>Subsequent Stage: <strong className="text-slate-800">Grey Fabric QC</strong></span>
                </span>
                {onProceedToQc ? (
                  <button
                    type="button"
                    onClick={onProceedToQc}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    Open QC Inspection <ArrowRight size={12} />
                  </button>
                ) : (
                  <span className="font-bold text-indigo-700">Pending Review</span>
                )}
              </div>
            </div>

            {/* Previous Entries Table Card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
              <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-slate-600" />
                  <h4 className="font-bold text-xs uppercase tracking-wide text-slate-800">
                    Previous Entries ({totalEntries})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-[11px] text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Add Entry
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2 text-right">Produced (m)</th>
                      <th className="px-3 py-2 text-right">Accepted</th>
                      <th className="px-3 py-2 text-right">Rejected</th>
                      <th className="px-3 py-2 text-right">Reprocess</th>
                      <th className="px-3 py-2 text-right">Cumulative</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2">Entered By</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2">Remarks</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedEntries.length > 0 ? (
                      pagedEntries.map((row, idx) => {
                        const isDraft = row.status === 'Draft';
                        return (
                          <tr key={row.id || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-3 py-2 font-mono whitespace-nowrap text-slate-700">{row.date || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{Number(row.produced || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-700 font-semibold">{Number(row.accepted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right font-mono text-rose-600">{Number(row.rejected ?? row.rejectMeter ?? row.reject_meter ?? 0) > 0 ? Number(row.rejected ?? row.rejectMeter ?? row.reject_meter).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-purple-600">{Number(row.reprocess ?? row.reprocessMeter ?? row.reprocess_meter ?? 0) > 0 ? Number(row.reprocess ?? row.reprocessMeter ?? row.reprocess_meter).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-blue-700 font-semibold">{Number(row.cumulative || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right font-mono text-amber-800">{Number(row.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.enteredBy || '—'}</td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-full border ${
                                isDraft ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              }`}>
                                {row.status || 'Submitted'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate" title={row.remarks}>{row.remarks || '—'}</td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              {isDraft ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitExistingDraft(row.id)}
                                    title="Submit this draft"
                                    className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                                  >
                                    <Send size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(row.id)}
                                    title="Delete draft"
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-slate-400 text-xs">
                          No daily production entries recorded yet for this instruction.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>Page {page} of {totalPages} ({totalEntries} total records)</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1 border rounded bg-white disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1 border rounded bg-white disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 7. Bottom Action Bar (Section 7) */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info size={14} className="text-teal-600 shrink-0" />
            <span>Records daily output of <strong>Vendor A grey fabric production</strong>. Dyeing/finishing is handled in Vendor B Job Work.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={submitting}
              onClick={() => handleSubmitEntry('Draft')}
            >
              <Save size={13} className="mr-1" /> Save Draft
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={submitting}
              onClick={() => handleSubmitEntry('Submitted')}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold"
            >
              <Send size={13} className="mr-1" /> Submit Entry
            </Button>

            {onProceedToQc && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onProceedToQc}
                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold"
              >
                <ShieldCheck size={13} className="mr-1 text-indigo-600" /> Proceed to QC Stage
              </Button>
            )}

            {instruction?.id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllEntriesModal(true)}
              >
                <Layers size={13} className="mr-1" /> View All Daily Entries
              </Button>
            )}
          </div>
        </div>


      {/* Daily Production Full Register Modal (Inline Overlay) */}
      {showAllEntriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Factory size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Daily Production Register — {instruction?.instructionNumber || 'Instruction'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    PO: <strong className="text-teal-700">{po?.poNumber}</strong> | Agency: <strong className="text-slate-700">{displayVendor}</strong> | Quality: <strong className="text-slate-700">{displayFabric}</strong>
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

            {/* Modal Metrics Bar */}
            <div className="p-3 bg-slate-50/50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ordered / Instructed</span>
                <span className="font-mono font-bold text-slate-900">{instructedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
              <div className="bg-blue-50/80 p-2 rounded-lg border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-600 block">Total Produced</span>
                <span className="font-mono font-bold text-blue-900">{totalProduced.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
              <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Accepted</span>
                <span className="font-mono font-bold text-emerald-900">{acceptedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
              <div className="bg-rose-50/80 p-2 rounded-lg border border-rose-200">
                <span className="text-[10px] uppercase font-bold text-rose-600 block">Rejected</span>
                <span className="font-mono font-bold text-rose-900">{rejectedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
              <div className="bg-purple-50/80 p-2 rounded-lg border border-purple-200">
                <span className="text-[10px] uppercase font-bold text-purple-600 block">Reprocess</span>
                <span className="font-mono font-bold text-purple-900">{reprocessQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
              <div className="bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-600 block">Balance Remaining</span>
                <span className="font-mono font-bold text-amber-900">{balanceQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} m</span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-white">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={registerSearch}
                    onChange={(e) => setRegisterSearch(e.target.value)}
                    placeholder="Search by date, employee, remarks..."
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-60"
                  />
                </div>
                <select
                  value={registerStatusFilter}
                  onChange={(e) => setRegisterStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white"
                >
                  <option value="All">All Statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Showing {entries.length} recorded production logs
              </span>
            </div>

            {/* Full Entries Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5 text-right">Produced (m)</th>
                    <th className="px-3 py-2.5 text-right">Accepted (m)</th>
                    <th className="px-3 py-2.5 text-right">Rejected (m)</th>
                    <th className="px-3 py-2.5 text-right">Reprocess (m)</th>
                    <th className="px-3 py-2.5 text-right">Cumulative (m)</th>
                    <th className="px-3 py-2.5 text-right">Balance (m)</th>
                    <th className="px-3 py-2.5">Entered By</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries
                    .filter((r) => {
                      if (registerStatusFilter !== 'All' && r.status !== registerStatusFilter) return false;
                      if (registerSearch) {
                        const q = registerSearch.toLowerCase();
                        return (
                          (r.date || '').toLowerCase().includes(q) ||
                          (r.enteredBy || '').toLowerCase().includes(q) ||
                          (r.remarks || '').toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 font-mono text-slate-800">{row.date || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{Number(row.produced || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700 font-semibold">{Number(row.accepted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-600">{Number(row.rejected ?? row.rejectMeter ?? row.reject_meter ?? 0) > 0 ? Number(row.rejected ?? row.rejectMeter ?? row.reject_meter).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-purple-600">{Number(row.reprocess ?? row.reprocessMeter ?? row.reprocess_meter ?? 0) > 0 ? Number(row.reprocess ?? row.reprocessMeter ?? row.reprocess_meter).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-blue-700 font-semibold">{Number(row.cumulative || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono text-amber-800">{Number(row.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.enteredBy || '—'}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-full border ${
                            row.status === 'Draft' ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          }`}>
                            {row.status || 'Submitted'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500 max-w-[150px] truncate" title={row.remarks}>{row.remarks || '—'}</td>
                      </tr>
                    ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400 text-xs">
                        No production logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
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

      </div>
    </div>
  );
}
