import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
  Building2,
  Package,
  Layers,
  IndianRupee,
  RefreshCw,
  Printer,
  Plus,
  Send,
  ExternalLink,
  ShieldCheck,
  Receipt,
  MapPin,
  Calendar,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
  Eye,
  FileCheck2,
  Paperclip,
} from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from '../../components/common/SignatureSlot';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import { useAppStore } from '../../stores/appStore';

function fmtM(n) {
  if (n === null || n === undefined || n === '') return '0.00';
  const num = Number(n);
  return isNaN(num) ? '0.00' : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtINR(n) {
  if (n === null || n === undefined || n === '') return '0.00';
  const num = Number(n);
  return isNaN(num) ? '0.00' : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  const parts = String(d).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : d;
}

export function FinalJobWorkPoInlineSlide({
  po,
  instruction: propInstruction,
  onClose,
  onUpdated,
  onNextStep,
  onPrevStep,
}) {
  const { showToast, formatCurrency } = useERP() || {};
  const currentUser = useAppStore((s) => s.currentUser);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Backend loaded records
  const [completionData, setCompletionData] = useState(null);
  const [instructionDetail, setInstructionDetail] = useState(null);
  const [finalPoRecord, setFinalPoRecord] = useState(null);

  // Form Fields
  const [poNumber, setPoNumber] = useState('');
  const poSigs = useDocumentSignatures('FinalJobWorkPO', propInstruction?.id || po?.id, `Final Job Work PO ${poNumber}`);
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedCompletionDate, setExpectedCompletionDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });
  const [vendorName, setVendorName] = useState('');
  const [fabricQuality, setFabricQuality] = useState('');
  const [approvedRate, setApprovedRate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState('Draft');

  // Line items state
  const [lineItems, setLineItems] = useState([
    {
      id: 1,
      fabric: '',
      hsn: '540752',
      uom: 'Mtr',
      finalQty: '',
      rate: '',
      amount: 0,
    },
  ]);

  // Attachments
  const [attachments, setAttachments] = useState([]);
  const [showAttachments, setShowAttachments] = useState(true);
  const fileInputRef = useRef(null);

  // Preview Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const piId = propInstruction?.id || po?.instructionId;

  // Load all linked data: Completion, Instruction, Next PO Number
  const loadData = async () => {
    if (!piId && !po?.id) return;
    try {
      setLoading(true);
      setError(null);

      const [compRes, instRes, nextNumRes] = await Promise.all([
        piId ? api.get(`/production/instructions/${piId}/completion/`).catch(() => null) : null,
        piId ? api.get(`/production/instructions/${piId}/`).catch(() => null) : null,
        api.get('/purchase/orders/next-jwpo-number/').catch(() => null),
      ]);

      setCompletionData(compRes);
      setInstructionDetail(instRes);

      const nextNo = nextNumRes?.nextPoNumber || nextNumRes?.poNo || '';
      const existingPoNo = instRes?.finalPoNumber || compRes?.finalPoNumber;
      if (existingPoNo) {
        setPoNumber(existingPoNo);
      } else {
        setPoNumber(nextNo);
      }

      // Pre-fill vendor & fabric
      const vName = po?.partyName || po?.vendor || compRes?.agency || instRes?.agency_name || '';
      setVendorName(vName);
      const fQual = (po?.items && po.items[0]?.name) || compRes?.fabric || instRes?.fabric || '';
      setFabricQuality(fQual);

      // Pre-fill rate from PO or Instruction
      const defaultRate = po?.items?.[0]?.rate || instRes?.agreed_job_rate || instRes?.agreed_rate || compRes?.jobRate || 0;
      setApprovedRate(Number(defaultRate) ? String(Number(defaultRate)) : '');

      // Calculate final accepted qty: min(qcAccepted, physicallyVerified)
      const qcAccepted = Number(compRes?.qcSummary?.acceptedQty ?? 0);
      const physVerified = Number(compRes?.physicallyVerifiedQty ?? 0);
      const eligibleQty = qcAccepted > 0 && physVerified > 0 ? Math.min(qcAccepted, physVerified) : (qcAccepted || physVerified || 0);

      // Status
      if (instRes?.final_po_id || compRes?.finalPoId) {
        const poStatus = instRes?.status === 'PO Created' ? 'Approved' : (instRes?.status === 'PO Pending' ? 'Pending Approval' : 'Draft');
        setStatus(poStatus);
      } else {
        setStatus('Draft');
      }

      // Check if draft metadata exists
      const fjwMeta = compRes?.fjwpoMetadata || {};
      if (fjwMeta.poNumber) setPoNumber(fjwMeta.poNumber);
      if (fjwMeta.poDate) setPoDate(fjwMeta.poDate);
      if (fjwMeta.expectedCompletionDate) setExpectedCompletionDate(fjwMeta.expectedCompletionDate);
      if (fjwMeta.rate) setApprovedRate(fjwMeta.rate);
      if (fjwMeta.remarks) setRemarks(fjwMeta.remarks);
      if (fjwMeta.status) setStatus(fjwMeta.status);
      if (Array.isArray(fjwMeta.attachments)) setAttachments(fjwMeta.attachments);

      // Line items init
      if (Array.isArray(fjwMeta.items) && fjwMeta.items.length > 0) {
        setLineItems(fjwMeta.items);
      } else {
        const unitRate = Number(defaultRate) || 0;
        const lineAmt = eligibleQty * unitRate;
        setLineItems([
          {
            id: 1,
            fabric: fQual,
            hsn: (po?.items && po.items[0]?.hsn) || '540752',
            uom: 'Mtr',
            finalQty: String(eligibleQty),
            rate: String(unitRate),
            amount: lineAmt,
          },
        ]);
      }

      // If existing final PO is created, load its record
      const finalPoNum = existingPoNo || instRes?.finalPoNumber;
      if (finalPoNum) {
        try {
          const poRes = await api.get('/purchase/orders/', { query: { search: finalPoNum, page_size: 5 } });
          const list = Array.isArray(poRes) ? poRes : poRes?.results || [];
          const matched = list.find((p) => p.po_number === finalPoNum || p.poNumber === finalPoNum);
          if (matched) {
            setFinalPoRecord(matched);
            if (matched.status) setStatus(matched.status);
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Failed to load Final Job Work PO details:', err);
      setError(err?.message || 'Failed to load details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [piId, po?.id]);

  // Derived Summary Quantities
  const originalPoNumber = po?.poNumber || completionData?.orderReference || '—';
  const originalPoDate = po?.date || '';
  const originalPoRate = po?.items?.[0]?.rate || 0;
  const originalPoQty = Number(po?.items?.[0]?.qty || completionData?.orderQty || 0);
  const totalProducedQty = Number(completionData?.totalProduced || 0);
  const qcAcceptedQty = Number(completionData?.qcSummary?.acceptedQty ?? 0);
  const physicallyVerifiedQty = Number(completionData?.physicallyVerifiedQty ?? 0);

  // Accounting Rule: Final Accepted Quantity is capped at physical verification and QC accepted
  const finalAcceptedQty = useMemo(() => {
    if (qcAcceptedQty > 0 && physicallyVerifiedQty > 0) {
      return Math.min(qcAcceptedQty, physicallyVerifiedQty);
    }
    return qcAcceptedQty || physicallyVerifiedQty || 0;
  }, [qcAcceptedQty, physicallyVerifiedQty]);

  // Amount auto-calculated
  const currentRateNum = Number(approvedRate) || 0;
  const calculatedPoAmount = useMemo(() => {
    return finalAcceptedQty * currentRateNum;
  }, [finalAcceptedQty, currentRateNum]);

  // Total from line items
  const lineItemsTotalQty = useMemo(() => {
    return lineItems.reduce((acc, it) => acc + (Number(it.finalQty) || 0), 0);
  }, [lineItems]);

  const lineItemsTotalAmount = useMemo(() => {
    return lineItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  }, [lineItems]);

  // Discrepancy warning check
  const hasDiscrepancy = physicallyVerifiedQty > 0 && qcAcceptedQty > 0 && physicallyVerifiedQty !== qcAcceptedQty;

  // Add line item
  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        fabric: fabricQuality,
        hsn: '540752',
        uom: 'Mtr',
        finalQty: '0.00',
        rate: String(currentRateNum),
        amount: 0,
      },
    ]);
  };

  // Update line item
  const handleUpdateLine = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'finalQty' || field === 'rate') {
            const q = Number(field === 'finalQty' ? value : item.finalQty) || 0;
            const r = Number(field === 'rate' ? value : item.rate) || 0;
            updated.amount = q * r;
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Remove line item
  const handleRemoveLine = (id) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Attachment upload
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

  // Save / Submit / Approve Action Handler
  const handleAction = async (actionType) => {
    if (!piId) return;
    if (actionType !== 'save_draft' && (!(currentRateNum > 0) || !(finalAcceptedQty > 0))) {
      setError('Enter the agreed job rate and make sure a verified accepted quantity exists before submitting the Final Job Work PO.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const payload = {
        action: actionType,
        finalPoNo: poNumber,
        poDate,
        expectedCompletionDate,
        vendorId: po?.partyId || po?.vendorId || instructionDetail?.agency_id,
        fabric: fabricQuality,
        acceptedQty: finalAcceptedQty,
        rate: currentRateNum,
        remarks,
        items: lineItems.map((it) => ({
          fabric: it.fabric,
          hsn: it.hsn,
          uom: it.uom,
          qty: Number(it.finalQty) || finalAcceptedQty,
          rate: Number(it.rate) || currentRateNum,
          amount: Number(it.amount) || calculatedPoAmount,
        })),
        attachments,
      };

      const res = await api.post(`/production/instructions/${piId}/generate-po/`, payload);
      setInstructionDetail(res);

      if (actionType === 'save_draft') {
        setStatus('Draft');
        setSuccessMsg(`Draft saved successfully for Final Job Work PO ${poNumber}.`);
        if (showToast) showToast('Draft saved successfully.', 'success');
      } else if (actionType === 'submit_for_approval') {
        setStatus('Pending Approval');
        setSuccessMsg(`Final Job Work PO ${poNumber} submitted for approval.`);
        if (showToast) showToast(`Submitted for approval: ${poNumber}`, 'success');
      } else if (actionType === 'approve_complete' || actionType === 'approve_generate') {
        setStatus('Approved');
        const genNum = res?.finalPoNumber || poNumber;
        setSuccessMsg(`Final Job Work PO ${genNum} approved & generated successfully! Ready for Agency Bill matching.`);
        if (showToast) showToast(`PO Approved & Generated: ${genNum}`, 'success');
      }

      await loadData();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Failed to process Final Job Work PO action:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to process Final Job Work PO action.');
      if (showToast) showToast(err?.message || 'Action failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#f8fafd] border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
      
      {/* 1. TOP CONTEXT STRIP (MATCHES REFERENCE IMAGE) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          
          {/* Supplier / Vendor */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Supplier / Vendor
            </span>
            <strong className="text-slate-900 text-[13px] block mt-0.5">
              {vendorName || '—'}
            </strong>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin size={11} className="text-slate-400" /> Maharashtra
            </span>
          </div>

          {/* Fabric Quality */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Fabric Quality
            </span>
            <strong className="text-slate-900 text-[13px] block mt-0.5">
              {fabricQuality || '—'}
            </strong>
          </div>

          {/* Original PO Details */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Original PO Details
            </span>
            <div className="text-[11.5px] text-slate-600 space-y-0.5 mt-0.5">
              <div>
                PO No: <strong className="text-slate-900 font-mono">{originalPoNumber}</strong>
              </div>
              <div>
                PO Date: <strong className="text-slate-800">{fmtDate(originalPoDate)}</strong>
              </div>
              <div>
                UOM: <strong className="text-slate-800">Mtr</strong>
              </div>
              <div>
                Rate: <strong className="text-slate-800 font-mono">₹{Number(originalPoRate).toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Completion Verification */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Completion Verification
            </span>
            <div className="text-[11.5px] text-slate-600 space-y-0.5 mt-0.5">
              <div>
                Verified Date: <strong className="text-slate-800">{fmtDate(completionData?.verificationDate || '')}</strong>
              </div>
              <div>
                Verified By: <strong className="text-slate-800">{completionData?.verifiedBy || 'Rajesh'}</strong>
              </div>
              <div>
                Physically Verified Qty: <strong className="text-slate-900 font-mono">{fmtM(physicallyVerifiedQty)} Mtr</strong>
              </div>
              <div>
                Status: <strong className="text-emerald-700 font-bold">Approved</strong>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Discrepancy & Reassurance Banners */}
      {hasDiscrepancy && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
          <div className="flex-1">
            <strong>Quantity Accounting Notice:</strong> Physically verified quantity ({fmtM(physicallyVerifiedQty)} Mtr) differs from QC Accepted quantity ({fmtM(qcAcceptedQty)} Mtr). Per Oscar ERP commercial rules, Final Accepted Quantity is capped at the verified eligible quantity of <strong>{fmtM(finalAcceptedQty)} Mtr</strong>.
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2.5 text-emerald-900 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <div className="font-semibold">{successMsg}</div>
          </div>
          {onNextStep && status === 'Approved' && (
            <button
              type="button"
              onClick={() => onNextStep('agency_bill_match')}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Receipt size={13} /> Proceed to Agency Bill Match <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* 2. MAIN TWO-COLUMN BODY (MATCHES REFERENCE IMAGE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* LEFT COLUMN: FINAL JOB WORK PO DETAILS (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
          
          {/* Card Header with Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                Final Job Work PO Details
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Auto-filled from Verified Data
              </span>
            </div>

            <div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                status === 'Approved'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : status === 'Pending Approval'
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {status}
              </span>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="space-y-3.5 text-xs">
            
            {/* Row 1: Final Job Work PO No. & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Final Job Work PO No.
                </label>
                <input
                  type="text"
                  readOnly
                  value={poNumber}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 bg-slate-50 cursor-not-allowed shadow-2xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Auto Generated</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-medium bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                  />
                  <Calendar size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 2: Vendor / Agency & Fabric Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Vendor / Agency <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-semibold bg-white appearance-none pr-8 shadow-2xs"
                  >
                    <option value={vendorName}>{vendorName || '—'}</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Fabric Quality
                </label>
                <div className="relative">
                  <select
                    value={fabricQuality}
                    onChange={(e) => setFabricQuality(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-semibold bg-white appearance-none pr-8 shadow-2xs"
                  >
                    <option value={fabricQuality}>{fabricQuality || '—'}</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 3: Final Accepted Qty, Approved Rate, Amount (3 Columns Inline) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Final Accepted Quantity (Mtr)
                </label>
                <input
                  type="text"
                  readOnly
                  value={fmtM(finalAcceptedQty)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 bg-slate-50 cursor-not-allowed shadow-2xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">From QC & Verification</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Approved Rate (₹/Mtr) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={approvedRate}
                  onChange={(e) => setApprovedRate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">From Original PO (editable if permitted)</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="text"
                  readOnly
                  value={fmtINR(calculatedPoAmount)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-extrabold text-slate-900 bg-slate-50 cursor-not-allowed shadow-2xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Auto-calculated</span>
              </div>
            </div>

            {/* Row 4: Expected Completion Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Expected Completion Date
              </label>
              <div className="relative sm:w-1/2">
                <input
                  type="date"
                  value={expectedCompletionDate}
                  onChange={(e) => setExpectedCompletionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-medium bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                />
                <Calendar size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Row 5: Remarks (Optional) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Remarks (Optional)
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks for final job work PO..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs resize-none"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {remarks.length}/500
              </span>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: QUANTITY REFERENCE & COMMERCIAL SUMMARY (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Card A: QUANTITY REFERENCE (READ ONLY) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Quantity Reference (Read Only)
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Original PO Quantity</span>
                <span className="font-mono font-bold text-slate-900">{fmtM(originalPoQty)} Mtr</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Total Produced (From Daily Entry)</span>
                <span className="font-mono font-bold text-slate-900">{fmtM(totalProducedQty)} Mtr</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>QC Accepted Quantity</span>
                <span className="font-mono font-bold text-slate-900">{fmtM(qcAcceptedQty)} Mtr</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Physically Verified Quantity</span>
                <span className="font-mono font-bold text-slate-900">{fmtM(physicallyVerifiedQty)} Mtr</span>
              </div>

              {/* Highlighted Row: Final Accepted Quantity */}
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="font-bold text-emerald-800 text-[11px]">
                  Final Accepted Quantity (Used for FJW PO)
                </span>
                <span className="font-mono font-black text-emerald-900 text-xs">
                  {fmtM(finalAcceptedQty)} Mtr
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600 pt-1">
                <span>Rate (₹/Mtr)</span>
                <span className="font-mono font-bold text-slate-900">{Number(approvedRate).toFixed(2)}</span>
              </div>

              {/* Highlighted Row: Final PO Amount */}
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                <span className="font-extrabold text-emerald-800 text-[11.5px]">
                  Final PO Amount (₹)
                </span>
                <span className="font-mono font-black text-emerald-950 text-sm">
                  {fmtINR(calculatedPoAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Card B: COMMERCIAL SUMMARY */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Commercial Summary
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Rate Source</span>
                <span className="font-semibold text-slate-800">From Original PO</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Is Rate Editable?</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Yes (as per permission)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tax Applicable</span>
                <span className="font-semibold text-slate-800">As per existing rules</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Payment Terms</span>
                <span className="font-semibold text-slate-800">As per original PO</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Remarks</span>
                <span className="font-semibold text-slate-400">{remarks || '-'}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 3. FABRIC LINE ITEMS (FINAL JOB WORK PO) (MATCHES REFERENCE IMAGE) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
            Fabric Line Items (Final Job Work PO)
          </h4>

          <button
            type="button"
            onClick={handleAddLineItem}
            className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50/60 hover:bg-blue-100 border border-blue-200 rounded-lg inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
          >
            <Plus size={13} /> Add Line Item
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 w-12 text-center">#</th>
                <th className="px-3 py-2.5">Fabric</th>
                <th className="px-3 py-2.5">HSN</th>
                <th className="px-3 py-2.5">UOM</th>
                <th className="px-3 py-2.5 text-right">Final Quantity (Mtr)</th>
                <th className="px-3 py-2.5 text-right">Rate (₹/Mtr)</th>
                <th className="px-3 py-2.5 text-right">Amount (₹)</th>
                <th className="px-2 py-2.5 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {lineItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={item.fabric}
                      onChange={(e) => handleUpdateLine(item.id, 'fabric', e.target.value)}
                      className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded font-semibold text-slate-800 bg-transparent text-xs"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-600">
                    <input
                      type="text"
                      value={item.hsn}
                      onChange={(e) => handleUpdateLine(item.id, 'hsn', e.target.value)}
                      className="w-20 px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded font-mono text-slate-600 bg-transparent text-xs"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 font-mono">
                    {item.uom}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                    <input
                      type="number"
                      step="0.01"
                      value={item.finalQty}
                      onChange={(e) => handleUpdateLine(item.id, 'finalQty', e.target.value)}
                      className="w-28 px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded font-mono font-bold text-right text-slate-900 bg-transparent text-xs"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-800">
                    <input
                      type="number"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => handleUpdateLine(item.id, 'rate', e.target.value)}
                      className="w-20 px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded font-mono text-right text-slate-800 bg-transparent text-xs"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-slate-900">
                    {fmtINR(item.amount)}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(item.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 rounded transition"
                        title="Remove row"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {lineItems.length > 1 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-bold text-xs">
                  <td colSpan={4} className="px-3 py-2 text-right text-slate-600">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-900">
                    {fmtM(lineItemsTotalQty)} Mtr
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-900 font-black">
                    {fmtINR(lineItemsTotalAmount)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. ATTACHMENTS (OPTIONAL) (MATCHES REFERENCE IMAGE) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div
          onClick={() => setShowAttachments(!showAttachments)}
          className="flex items-center justify-between pb-1 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <Paperclip size={14} className="text-slate-400" />
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
              Attachments (Optional)
            </h4>
          </div>

          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            {showAttachments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showAttachments && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            {/* Hidden Input */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            />

            {/* Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl bg-blue-50/20 hover:bg-blue-50/40 p-5 text-center cursor-pointer transition-colors"
            >
              <div className="flex flex-col items-center justify-center gap-1.5">
                <UploadCloud size={24} className="text-blue-600" />
                <span className="font-bold text-xs text-slate-800">Upload Documents</span>
                <p className="text-[11px] text-slate-400">
                  Final Job Work PO, approval documents, or other supporting files (JPG, PNG, PDF up to 10 MB)
                </p>
              </div>
            </div>

            {/* Uploaded Files List */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <FileText size={13} className="text-blue-600" />
                    <span className="font-medium text-slate-800 max-w-[200px] truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({file.size})</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. BOTTOM ACTION BUTTONS BAR (MATCHES REFERENCE IMAGE) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-200 bg-white p-3 rounded-xl shadow-2xs">
        
        {/* Left Action: Save Draft */}
        <div>
          <button
            type="button"
            disabled={submitting || status === 'Approved'}
            onClick={() => handleAction('save_draft')}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText size={14} className="text-slate-500" /> Save Draft
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Submit for Approval */}
          <button
            type="button"
            disabled={submitting || status === 'Approved'}
            onClick={() => handleAction('submit_for_approval')}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={14} /> Submit for Approval
          </button>

          {/* Approve & Generate PO */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleAction('approve_generate')}
            className={`px-4 py-2 border text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer ${
              status === 'Approved'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Check size={14} className={status === 'Approved' ? 'text-emerald-600' : 'text-slate-500'} />
            {status === 'Approved' ? 'PO Generated & Approved' : 'Approve & Generate PO'}
          </button>

          {/* Preview Final Job Work PO */}
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Printer size={14} className="text-slate-500" /> Preview Final Job Work PO
          </button>

        </div>

      </div>

      {/* 6. FULL HIGH-FIDELITY PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <FileSpreadsheet size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Official Final Job Work Purchase Order Preview
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Document Ref: <strong className="text-indigo-700">{poNumber}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer size={13} /> Print Document
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white text-slate-800 text-xs printable-document">
              
              {/* Document Letterhead */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900">OSCAR TEXTILES & APPAREL ERP</h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">Commercial Job Work & Production Processing Subsystem</p>
                  <p className="text-slate-500 text-[11px]">Maharashtra Industrial Development Corporation (MIDC), India</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded font-black text-xs uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                    FINAL JOB WORK PO
                  </span>
                  <div className="font-mono font-black text-base text-slate-900 mt-1">{poNumber}</div>
                  <div className="text-slate-500 text-[11px]">Date: {fmtDate(poDate)}</div>
                </div>
              </div>

              {/* Vendor & Order Details 2-Column Box */}
              <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">ISSUED TO / AGENCY</span>
                  <strong className="text-slate-900 text-sm block mt-1">{vendorName}</strong>
                  <span className="text-slate-500 block mt-0.5">Vendor State: Maharashtra</span>
                  <span className="text-slate-500 block">GSTIN / Ref: Approved Vendor</span>
                </div>
                <div className="space-y-1">
                  <div><span className="text-slate-500">Original PO Reference:</span> <strong className="font-mono text-slate-900">{originalPoNumber}</strong></div>
                  <div><span className="text-slate-500">Production Instruction:</span> <strong className="font-mono text-slate-900">{propInstruction?.instruction_number || completionData?.piNo || '—'}</strong></div>
                  <div><span className="text-slate-500">Completion Verification:</span> <strong className="text-emerald-700 font-bold">Approved ({fmtM(physicallyVerifiedQty)} Mtr)</strong></div>
                  <div><span className="text-slate-500">Expected Completion:</span> <strong className="text-slate-900">{fmtDate(expectedCompletionDate)}</strong></div>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h4 className="font-bold text-xs uppercase text-slate-700 tracking-wide mb-2">Fabric Line Items</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-600">
                        <th className="px-3 py-2 text-center w-10">#</th>
                        <th className="px-3 py-2">Fabric Quality</th>
                        <th className="px-3 py-2">HSN</th>
                        <th className="px-3 py-2 text-center">UOM</th>
                        <th className="px-3 py-2 text-right">Eligible Accepted Qty</th>
                        <th className="px-3 py-2 text-right">Rate (₹)</th>
                        <th className="px-3 py-2 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-bold text-slate-800">{item.fabric}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{item.hsn}</td>
                          <td className="px-3 py-2 text-center font-mono text-slate-600">{item.uom}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{fmtM(item.finalQty)}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700">₹{Number(item.rate).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono font-black text-slate-900">{fmtINR(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200 font-extrabold text-xs">
                        <td colSpan={4} className="px-3 py-2 text-right text-slate-600">Grand Total:</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900">{fmtM(lineItemsTotalQty)} Mtr</td>
                        <td></td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-950 font-black text-sm">₹{fmtINR(lineItemsTotalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Terms & Signatures */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-slate-600 text-[11px]">
                <div>
                  <h5 className="font-bold uppercase text-[10px] text-slate-700 mb-1">Commercial Notes & Terms</h5>
                  <p>1. Job Work payment subject to verified grey fabric receipt and 3-way matching.</p>
                  <p>2. Rate confirmed as per authorized Purchase Order schedule.</p>
                  <p>3. Tax treatment as per GST textile regulations.</p>
                  {remarks && <p className="mt-1 font-semibold text-slate-800">Remarks: {remarks}</p>}
                </div>
                <div className="flex flex-col justify-end items-end text-right">
                  <div className="border-b border-slate-300 w-48 mb-1 pb-1">
                    <SignatureSlot doc={poSigs} signatory="authorized" label="Authorized Signatory" modalType="authorized" className="h-10"
                      defaultName={currentUser?.name || ''} defaultDesignation="Authorized Signatory — Commercial Operations" />
                  </div>
                  <span className="font-bold text-slate-900">Authorized Signatory</span>
                  <span className="text-[10px] text-slate-400">OSCAR ERP Commercial Operations</span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
