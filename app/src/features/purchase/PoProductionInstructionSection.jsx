import React, { useState, useEffect } from 'react';
import {
  Factory, Calendar, UserCheck, FileText, CheckCircle2, ArrowRight,
  Clock, Layers, AlertCircle, Save, Send, ShieldCheck, Lock, ExternalLink,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { purchaseService, hrmsService } from '../../services/domainServices';
import { Button } from '../../components/ui/Button';
import MasterSourceLink from '../../components/common/MasterSourceLink';

export function PoProductionInstructionSection({ po, onUpdated, navigate, defaultCollapsed = false, onOpenDailyProduction }) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState(null);

  const [poData, setPoData] = useState(null);
  const [nextInstructionNumber, setNextInstructionNumber] = useState('');
  const [instruction, setInstruction] = useState(null);
  const [supervisors, setSupervisors] = useState([]);

  // Form fields
  const [supervisorId, setSupervisorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Load PO production instruction data and supervisors
  const loadData = async () => {
    if (!po?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [piRes, empRes] = await Promise.allSettled([
        purchaseService.getPoProductionInstruction(po.id),
        hrmsService.getEmployees({ page_size: 200 }),
      ]);

      if (piRes.status === 'fulfilled') {
        const data = piRes.value;
        setPoData(data.po);
        setNextInstructionNumber(data.nextInstructionNumber || '');
        if (data.instruction) {
          setInstruction(data.instruction);
          setSupervisorId(data.instruction.supervisorId || '');
          setStartDate(data.instruction.startDate ? String(data.instruction.startDate).slice(0, 10) : '');
          setExpectedCompletionDate(data.instruction.expectedCompletionDate ? String(data.instruction.expectedCompletionDate).slice(0, 10) : '');
          setRemarks(data.instruction.remarks || '');
        } else {
          setInstruction(null);
          // Default dates from PO
          setStartDate(po.expectedDate ? String(po.expectedDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
          setExpectedCompletionDate('');
          setRemarks('');
        }
      } else {
        setError(piRes.reason?.message || 'Failed to load Production Instruction details.');
      }

      if (empRes.status === 'fulfilled') {
        const empList = empRes.value?.items || empRes.value?.results || empRes.value || [];
        setSupervisors(Array.isArray(empList) ? empList.filter(e => !e.status || e.status === 'Active' || e.status === 'Probation') : []);
      }
    } catch (err) {
      setError(err?.message || 'Error initializing Production Instruction.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [po?.id]);

  const handleSubmit = async (actionType) => {
    setError(null);
    setFieldErrors({});
    setSuccessMsg(null);

    const errors = {};
    if (!supervisorId) errors.supervisorId = 'Assigned Supervisor is required.';
    if (!startDate) errors.startDate = 'Production Start Date is required.';
    if (!expectedCompletionDate) errors.expectedCompletionDate = 'Expected Completion Date is required.';
    if (startDate && expectedCompletionDate && expectedCompletionDate < startDate) {
      errors.expectedCompletionDate = 'Completion date cannot precede start date.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        action: actionType, // 'save_draft' | 'submit_approval'
        supervisorId,
        startDate,
        expectedCompletionDate,
        remarks: remarks.trim(),
      };
      const res = await purchaseService.savePoProductionInstruction(po.id, payload);
      setSuccessMsg(res.message || `Production Instruction ${actionType === 'submit_approval' ? 'submitted successfully' : 'saved as draft'}.`);
      if (res.instruction) {
        setInstruction(res.instruction);
      }
      if (onUpdated) onUpdated(res);
    } catch (err) {
      if (err?.field_errors || err?.fieldErrors) {
        const fErrors = err.field_errors || err.fieldErrors;
        const mapped = {};
        Object.entries(fErrors).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        });
        setFieldErrors(mapped);
      } else {
        setError(err?.message || 'Failed to save Production Instruction.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500 text-xs">
        <Clock className="w-5 h-5 mx-auto mb-2 animate-spin text-blue-600" />
        Loading Production Instruction details...
      </div>
    );
  }

  // Linked PO read-only display values (strictly from PO; no editable instruction quantity)
  const displayPoNumber = poData?.poNumber || po?.poNumber || '—';
  const displayVendor = poData?.vendorName || po?.vendor || po?.partyName || '—';
  const displayFabric = poData?.fabricName || (po?.items && po.items[0]?.name) || po?.notes || 'Grey Fabric';
  const displayQty = poData?.poQuantity ?? po?.items?.reduce((s, it) => s + (Number(it.qty) || 0), 0) ?? 0;
  const displayRate = poData?.rate ?? (po?.items && po.items[0]?.rate) ?? 0;
  const displayAmount = poData?.poAmount ?? po?.amount ?? po?.total ?? 0;
  const instructionNum = instruction?.instructionNumber || nextInstructionNumber || 'Pending Auto-Generation';
  const isInstructionApproved = instruction?.status && instruction?.status !== 'Draft';

  return (
    <div className="bg-white border-2 border-indigo-100 rounded-xl shadow-xs overflow-hidden mt-4">
      {/* Header */}
      <div
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-400/30">
            <Factory size={16} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              Production Instruction
              <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Vendor A Manufacturing Only
              </span>
            </h4>
            <p className="text-[11px] text-slate-300">
              Grey fabric weaving job instruction linked directly to Purchase Order {displayPoNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {instruction?.status && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Status:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                instruction.status === 'Draft' ? 'bg-amber-100 text-amber-800' :
                instruction.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                instruction.status === 'Running' || instruction.status === 'In Progress' ? 'bg-indigo-100 text-indigo-800' :
                instruction.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' :
                'bg-slate-100 text-slate-800'
              }`}>
                {instruction.status}
              </span>
            </div>
          )}
          <button
            type="button"
            className="text-slate-300 hover:text-white p-1 rounded"
            aria-label={isCollapsed ? 'Expand Production Instruction' : 'Collapse Production Instruction'}
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 space-y-4">
        {/* Read-Only Linked PO Data Section */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-600" /> Linked Purchase Order Baseline (Read-Only)
            </span>
            <span className="text-[10.5px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              Quantity automatically bound to PO line items
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10.5px]">PO Number</span>
              <strong className="text-slate-800 font-mono">{displayPoNumber}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10.5px]">Vendor / Agency</span>
              <strong className="text-slate-800 truncate block" title={displayVendor}>{displayVendor}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10.5px]">Fabric Name</span>
              <strong className="text-slate-800 truncate block" title={displayFabric}>{displayFabric}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10.5px]">PO Quantity</span>
              <strong className="text-slate-900 font-mono text-sm">{Number(displayQty).toLocaleString()} m</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10.5px]">Agreed Rate</span>
              <strong className="text-slate-800 font-mono">₹{Number(displayRate || 0).toFixed(2)}/m</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10.5px]">PO Amount</span>
              <strong className="text-slate-900 font-mono text-sm">₹{Number(displayAmount || 0).toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Fields: Only the specified simple inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Instruction Number */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Production Instruction #
            </label>
            <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-700">
              {instructionNum}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Auto-generated</span>
          </div>

          {/* Assigned Supervisor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-600">
                Assigned Supervisor <span className="text-rose-500">*</span>
              </label>
              <MasterSourceLink source="employees" />
            </div>
            <select
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              className={`w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                fieldErrors.supervisorId ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
              }`}
            >
              <option value="">— Select Supervisor —</option>
              {supervisors.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.employee_code ? `(${emp.employee_code})` : ''} {emp.designation ? `— ${emp.designation}` : ''}
                </option>
              ))}
            </select>
            {fieldErrors.supervisorId && (
              <span className="text-[10px] text-rose-600 mt-0.5 block">{fieldErrors.supervisorId}</span>
            )}
          </div>

          {/* Production Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Production Start Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                fieldErrors.startDate ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {fieldErrors.startDate && (
              <span className="text-[10px] text-rose-600 mt-0.5 block">{fieldErrors.startDate}</span>
            )}
          </div>

          {/* Expected Completion Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Expected Completion Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={expectedCompletionDate}
              onChange={(e) => setExpectedCompletionDate(e.target.value)}
              className={`w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                fieldErrors.expectedCompletionDate ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
              }`}
            />
            {fieldErrors.expectedCompletionDate && (
              <span className="text-[10px] text-rose-600 mt-0.5 block">{fieldErrors.expectedCompletionDate}</span>
            )}
          </div>
        </div>

        {/* Remarks (optional) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Remarks <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Special manufacturing instructions, weaving specifications, or loom notes..."
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Completion & Verification Overview (if production recorded) */}
        {instruction?.completion && (Number(instruction.completion.totalProduced) > 0 || instruction.isVerified) && (
          <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-indigo-600" /> Completion & Verification Status
              </span>
              {instruction.isVerified && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10.5px] font-bold">
                  Verified for Job Work Billing
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-2 rounded border border-indigo-100">
                <span className="text-slate-400 block text-[10px]">Total Produced</span>
                <strong className="text-slate-900 font-mono">{Number(instruction.completion.totalProduced).toLocaleString()} m</strong>
              </div>
              <div className="bg-white p-2 rounded border border-indigo-100">
                <span className="text-slate-400 block text-[10px]">Accepted Qty</span>
                <strong className="text-emerald-700 font-mono">{Number(instruction.completion.acceptedQty).toLocaleString()} m</strong>
              </div>
              <div className="bg-white p-2 rounded border border-indigo-100">
                <span className="text-slate-400 block text-[10px]">Rejected Qty</span>
                <strong className="text-rose-700 font-mono">{Number(instruction.completion.rejectedQty).toLocaleString()} m</strong>
              </div>
              <div className="bg-white p-2 rounded border border-indigo-100">
                <span className="text-slate-400 block text-[10px]">Remaining Balance</span>
                <strong className="text-amber-700 font-mono">{Number(instruction.completion.shortageQty).toLocaleString()} m</strong>
              </div>
            </div>
            {instruction.finalPoNumber && (
              <div className="mt-2 text-xs text-indigo-900 font-medium flex items-center gap-1.5">
                <FileText size={13} className="text-indigo-600" />
                Final Job Work PO Generated: <strong className="font-mono text-indigo-700">{instruction.finalPoNumber}</strong>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="text-[11px] text-slate-500">
            Workflow: <span className="font-semibold text-slate-700">PO → Instruction → Daily Entry → Verification → Final JW PO</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* View Daily Production */}
            <button
              type="button"
              disabled={!instruction?.id}
              onClick={() => {
                if (onOpenDailyProduction) {
                  onOpenDailyProduction();
                } else if (instruction?.id && navigate) {
                  navigate(`/pms/daily-production?pi=${instruction.id}`);
                }
              }}
              title={instruction?.id ? 'Open Daily Production Entry' : 'Save instruction first to record daily production'}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                instruction?.id
                  ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 cursor-pointer'
                  : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Layers size={13} />
              View Daily Production
            </button>

            {/* Save Draft */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit('save_draft')}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Save size={13} />
              {submitting ? 'Saving...' : 'Save Draft'}
            </button>

            {/* Submit for Approval */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit('submit_approval')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Send size={13} />
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

export default PoProductionInstructionSection;
