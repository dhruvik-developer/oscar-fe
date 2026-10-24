import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
  Boxes,
  Check,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  IndianRupee,
  Scale,
  Building2,
  Calendar,
  Layers,
  Paperclip,
  History,
  Eye,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import { useAppStore } from '../../stores/appStore';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  }
  const parts = String(d).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : String(d);
}

export function AgencyBillMatchingInlineSlide({
  po,
  instruction: propInstruction,
  onClose,
  onBillMatched,
  onNextStep,
  onPrevStep,
}) {
  const {
    formatCurrency,
    formatDateDDMMYYYY,
    getPoBilledStatus,
    showToast,
    refreshCollections,
  } = useERP() || {};

  const currentUser = useAppStore((s) => s.currentUser);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('reconciliation'); // 'reconciliation' | 'history'

  // Backend loaded records
  const [instructionData, setInstructionData] = useState(propInstruction || null);
  const [finalPoData, setFinalPoData] = useState(null);
  const [vendorBills, setVendorBills] = useState([]);
  const [activeBill, setActiveBill] = useState(null);
  const [matchingResult, setMatchingResult] = useState(null);

  // Form Fields for Panel C (Vendor / Agency Invoice)
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [invoiceQty, setInvoiceQty] = useState('');
  const [invoiceRate, setInvoiceRate] = useState('');
  const [gstPct, setGstPct] = useState('5.0');
  const [remarks, setRemarks] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  // UI status and variance states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [varianceReason, setVarianceReason] = useState('');

  const poId = po?.id;
  const poNumber = po?.poNumber || poId;

  // 1. Initial Data Fetching: Instruction, Final PO, Vendor Bills
  const loadData = async () => {
    if (!poId) return;
    try {
      setLoading(true);
      setErrorMsg('');

      // Fetch instruction & final PO details
      const [piRes, billsRes] = await Promise.all([
        api.get(`/purchase/orders/${poId}/production-instruction/`).catch(() => null),
        api.get('/purchase/vendor-bills/', { params: { purchaseOrderId: poId, limit: 20 } }).catch(() => []),
      ]);

      const inst = piRes?.instruction || propInstruction || null;
      setInstructionData(inst);

      let finalPo = null;
      const finalPoId = inst?.finalPoId || po?.finalPoId;
      if (finalPoId) {
        finalPo = await api.get(`/purchase/orders/${finalPoId}/`).catch(() => null);
        setFinalPoData(finalPo);
      }

      // Fetch vendor bills
      const rawBills = Array.isArray(billsRes) ? billsRes : (billsRes?.results || billsRes?.rows || billsRes?.data || []);
      const matched = rawBills.filter(
        (b) => String(b.purchaseOrderId || b.purchaseOrder || b.poId || '') === String(poId) ||
               (poNumber && (b.poNumber === poNumber || b.po_number === poNumber)) ||
               (finalPo?.poNumber && (b.poNumber === finalPo.poNumber || b.po_number === finalPo.poNumber))
      );
      setVendorBills(matched);

      const latestBill = matched[0] || null;
      if (latestBill) {
        setActiveBill(latestBill);
        setInvoiceNumber(latestBill.vendorBillNumber || latestBill.billNumber || '');
        setInvoiceDate(latestBill.billDate || new Date().toISOString().split('T')[0]);
        const line = latestBill.lineItems?.[0] || latestBill.lines?.[0] || {};
        setInvoiceQty(String(line.qty || latestBill.totalQuantity || ''));
        setInvoiceRate(String(line.rate || latestBill.rate || ''));
        setGstPct(String(latestBill.gstPct || '5.0'));
        setRemarks(latestBill.remarks || '');

        // Fetch live matching comparison
        const mRes = await api.get(`/purchase/vendor-bills/${latestBill.id}/matching/`).catch(() => null);
        if (mRes) {
          setMatchingResult(mRes);
        }
      } else {
        // Prefill form defaults from Final PO / Instruction
        const defaultQty = finalPo?.lineItems?.[0]?.qty || finalPo?.items?.[0]?.qty || inst?.completion?.acceptedQty || inst?.acceptedQty || po?.totalQuantity || '';
        const defaultRate = finalPo?.lineItems?.[0]?.rate || finalPo?.items?.[0]?.rate || inst?.agreed_job_rate || inst?.agreed_rate || po?.items?.[0]?.rate || '';
        setInvoiceQty(String(defaultQty));
        setInvoiceRate(String(defaultRate));
        // The agency's own invoice number is entered by the user, never generated.
        setInvoiceNumber('');
      }
    } catch (err) {
      console.warn('Failed to load agency bill matching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poId]);

  // Derived baseline values
  const origInstructedQty = Number(instructionData?.orderMeter || po?.totalQuantity || 0);
  const origAgreedRate = Number(instructionData?.agreed_job_rate || instructionData?.agreed_rate || po?.items?.[0]?.rate || 0);
  const origTaxable = origInstructedQty * origAgreedRate;
  const origTaxAmount = origTaxable * 0.05;
  const origTotal = origTaxable + origTaxAmount;

  const finalPoQty = Number(
    finalPoData?.lineItems?.[0]?.qty ||
    finalPoData?.items?.[0]?.qty ||
    instructionData?.completion?.acceptedQty ||
    0
  );
  const finalApprovedRate = Number(
    finalPoData?.lineItems?.[0]?.rate ||
    finalPoData?.items?.[0]?.rate ||
    origAgreedRate
  );
  const finalTaxable = finalPoQty * finalApprovedRate;
  const finalTaxAmount = finalTaxable * 0.05;
  const finalTotal = finalTaxable + finalTaxAmount;

  const verifiedAcceptedQty = Number(instructionData?.completion?.acceptedQty || finalPoQty);
  const productionShortage = origInstructedQty - finalPoQty;
  const productionShortagePct = origInstructedQty > 0 ? (productionShortage / origInstructedQty) * 100 : 0;

  // Invoice calculations
  const numInvQty = Number(invoiceQty) || 0;
  const numInvRate = Number(invoiceRate) || 0;
  const numGstPct = Number(gstPct) || 5;
  const invoiceTaxable = numInvQty * numInvRate;
  const invoiceGstAmount = (invoiceTaxable * numGstPct) / 100;
  const invoiceTotal = invoiceTaxable + invoiceGstAmount;

  // Real-time Discrepancy Analysis (vs Final Approved Job Work PO)
  const qtyDiff = numInvQty - finalPoQty;
  const rateDiff = numInvRate - finalApprovedRate;
  const taxableDiff = invoiceTaxable - finalTaxable;
  const totalDiff = invoiceTotal - finalTotal;

  const isQtyMatched = Math.abs(qtyDiff) <= 0.05;
  const isRateMatched = Math.abs(rateDiff) <= 0.05;
  const isTaxableMatched = Math.abs(taxableDiff) <= 1.0;
  const isTotalMatched = Math.abs(totalDiff) <= 1.0;

  const isReconciled = isQtyMatched && isRateMatched && isTaxableMatched && isTotalMatched;
  const exceptionCount = [!isQtyMatched, !isRateMatched, !isTaxableMatched, !isTotalMatched].filter(Boolean).length;

  const overallReconciliationStatus = activeBill?.status === 'Approved'
    ? 'Approved & Payable'
    : activeBill?.status === 'Pending Approval'
    ? 'Pending Approval'
    : isReconciled
    ? 'Matched'
    : (activeBill?.status === 'Draft' ? 'Draft' : 'Mismatch / On Hold');

  // Comparison Table (All 14 commercial fields required by OscarERP spec)
  const comparisonRows = useMemo(() => {
    return [
      {
        field: 'Vendor / Agency',
        origVal: po?.vendor || po?.partyName || 'Vendor A Agency',
        finalVal: finalPoData?.vendor || finalPoData?.vendorName || finalPoData?.partyName || instructionData?.agencyName || 'Vendor A Agency',
        invoiceVal: po?.vendor || 'Vendor A Agency',
        difference: '—',
        status: 'Matched',
      },
      {
        field: 'Original PO Reference',
        origVal: poNumber,
        finalVal: instructionData?.orderReference || poNumber,
        invoiceVal: poNumber,
        difference: '—',
        status: 'Matched',
      },
      {
        field: 'Final Job Work PO Reference',
        origVal: '— (Initial Stage)',
        finalVal: instructionData?.finalPoNumber || finalPoData?.poNumber || '—',
        invoiceVal: instructionData?.finalPoNumber || finalPoData?.poNumber || '—',
        difference: '—',
        status: (instructionData?.finalPoNumber || finalPoData?.poNumber) ? 'Matched' : 'Pending Final PO',
      },
      {
        field: 'Fabric Quality / Line Item',
        origVal: instructionData?.fabric || po?.lineItems?.[0]?.description || po?.items?.[0]?.name || '—',
        finalVal: instructionData?.fabric || finalPoData?.lineItems?.[0]?.itemName || finalPoData?.lineItems?.[0]?.description || finalPoData?.items?.[0]?.name || '—',
        invoiceVal: instructionData?.fabric || '—',
        difference: '—',
        status: 'Matched',
      },
      {
        field: 'Originally Instructed Quantity',
        origVal: `${fmtQty(origInstructedQty)} M`,
        finalVal: `${fmtQty(origInstructedQty)} M`,
        invoiceVal: '—',
        difference: '—',
        status: 'Baseline',
      },
      {
        field: 'Verified Eligible Accepted Quantity',
        origVal: '—',
        finalVal: `${fmtQty(verifiedAcceptedQty)} M`,
        invoiceVal: '—',
        difference: `${productionShortage > 0 ? '-' : '+'}${fmtQty(Math.abs(productionShortage))} M`,
        status: verifiedAcceptedQty > 0 ? 'Verified Yield' : 'Pending',
      },
      {
        field: 'Final PO Quantity',
        origVal: '—',
        finalVal: `${fmtQty(finalPoQty)} M`,
        invoiceVal: `${fmtQty(numInvQty)} M`,
        difference: `${qtyDiff > 0 ? '+' : ''}${fmtQty(qtyDiff)} M`,
        status: isQtyMatched ? 'Matched' : 'Mismatch',
      },
      {
        field: 'Invoice Quantity',
        origVal: '—',
        finalVal: `${fmtQty(finalPoQty)} M`,
        invoiceVal: `${fmtQty(numInvQty)} M`,
        difference: `${qtyDiff > 0 ? '+' : ''}${fmtQty(qtyDiff)} M`,
        status: isQtyMatched ? 'Matched' : 'Mismatch',
      },
      {
        field: 'Original Agreed Rate',
        origVal: `₹${numIN(origAgreedRate)} / M`,
        finalVal: `₹${numIN(origAgreedRate)} / M`,
        invoiceVal: '—',
        difference: '—',
        status: 'Baseline',
      },
      {
        field: 'Final Approved Rate',
        origVal: '—',
        finalVal: `₹${numIN(finalApprovedRate)} / M`,
        invoiceVal: `₹${numIN(numInvRate)} / M`,
        difference: `₹${rateDiff > 0 ? '+' : ''}${numIN(rateDiff)} / M`,
        status: isRateMatched ? 'Matched' : 'Mismatch',
      },
      {
        field: 'Invoice Rate',
        origVal: '—',
        finalVal: `₹${numIN(finalApprovedRate)} / M`,
        invoiceVal: `₹${numIN(numInvRate)} / M`,
        difference: `₹${rateDiff > 0 ? '+' : ''}${numIN(rateDiff)} / M`,
        status: isRateMatched ? 'Matched' : 'Mismatch',
      },
      {
        field: 'Taxable Amount',
        origVal: `₹${numIN(origTaxable)}`,
        finalVal: `₹${numIN(finalTaxable)}`,
        invoiceVal: `₹${numIN(invoiceTaxable)}`,
        difference: `₹${taxableDiff > 0 ? '+' : ''}${numIN(taxableDiff)}`,
        status: isTaxableMatched ? 'Matched' : 'Mismatch',
      },
      {
        field: 'Tax / GST Details',
        origVal: `5.0% (₹${numIN(origTaxAmount)})`,
        finalVal: `5.0% (₹${numIN(finalTaxAmount)})`,
        invoiceVal: `${numGstPct.toFixed(1)}% (₹${numIN(invoiceGstAmount)})`,
        difference: `₹${invoiceGstAmount - finalTaxAmount > 0 ? '+' : ''}${numIN(invoiceGstAmount - finalTaxAmount)}`,
        status: Math.abs(invoiceGstAmount - finalTaxAmount) <= 1.0 && numGstPct === 5.0 ? 'Matched' : 'Mismatch',
      },
      {
        field: 'Invoice Total',
        origVal: `₹${numIN(origTotal)}`,
        finalVal: `₹${numIN(finalTotal)}`,
        invoiceVal: `₹${numIN(invoiceTotal)}`,
        difference: `₹${totalDiff > 0 ? '+' : ''}${numIN(totalDiff)}`,
        status: isTotalMatched ? 'Matched' : 'Mismatch',
      },
    ];
  }, [
    po, poNumber, instructionData, finalPoData, origInstructedQty, origAgreedRate,
    origTaxable, origTaxAmount, origTotal, finalPoQty, finalApprovedRate, finalTaxable,
    finalTaxAmount, finalTotal, verifiedAcceptedQty, productionShortage, numInvQty,
    numInvRate, numGstPct, invoiceTaxable, invoiceGstAmount, invoiceTotal, qtyDiff,
    rateDiff, taxableDiff, totalDiff, isQtyMatched, isRateMatched, isTaxableMatched, isTotalMatched,
  ]);

  // Action Handlers
  const handleAction = async (actionType) => {
    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      if (!invoiceNumber.trim()) {
        setErrorMsg('Please enter the Vendor Invoice Number.');
        return;
      }
      if (numInvQty <= 0) {
        setErrorMsg('Invoice quantity must be greater than zero.');
        return;
      }
      if (numInvRate <= 0) {
        setErrorMsg('Invoice rate must be greater than zero.');
        return;
      }

      // If approving a mismatch, require an explanation
      if (actionType === 'approve' && !isReconciled && !remarks.trim() && !varianceReason.trim()) {
        setApprovalModalOpen(true);
        return;
      }

      const payload = {
        purchaseOrderId: poId,
        billId: activeBill?.id,
        vendorBillNumber: invoiceNumber.trim(),
        billDate: invoiceDate,
        qty: numInvQty,
        rate: numInvRate,
        gstPct: numGstPct,
        taxableAmount: invoiceTaxable,
        total: invoiceTotal,
        remarks: varianceReason.trim() || remarks.trim(),
        action: actionType,
      };

      const res = await api.post('/purchase/vendor-bills/agency-match/', payload);
      setApprovalModalOpen(false);
      setVarianceReason('');

      if (actionType === 'save_draft') {
        setSuccessMsg(`✓ Draft Invoice ${invoiceNumber} saved successfully.`);
        showToast?.('Draft invoice saved.');
      } else if (actionType === 'validate') {
        setSuccessMsg(isReconciled ? '✓ 3-Way Match Verified! Invoice matches Final Job Work PO.' : '⚠ Discrepancy detected. Invoice held for review.');
        showToast?.(isReconciled ? '3-Way Match Verified' : 'Discrepancy Detected');
      } else if (actionType === 'submit_approval') {
        setSuccessMsg(`✓ Invoice ${invoiceNumber} submitted for manager approval.`);
        showToast?.('Submitted for Approval');
      } else if (actionType === 'approve') {
        setSuccessMsg(`✓ Invoice ${invoiceNumber} Approved & Payable Released!`);
        showToast?.('Agency Bill Approved & Payable Created');
        if (onBillMatched) onBillMatched();
        if (refreshCollections) refreshCollections(['vendorBills', 'purchaseBills', 'purchaseOrders']);
      } else if (actionType === 'reject') {
        setSuccessMsg(`✓ Invoice ${invoiceNumber} returned / rejected with reason recorded.`);
        showToast?.('Invoice Rejected');
      }

      await loadData();
    } catch (err) {
      console.error('Agency bill match error:', err);
      const fieldErrors = err?.response?.data?.field_errors;
      const firstFieldErr = fieldErrors ? Object.values(fieldErrors).flat().join(', ') : '';
      const detail = firstFieldErr
        ? `${err?.response?.data?.message || 'Validation error'}: ${firstFieldErr}`
        : (err?.response?.data?.message || err?.message || 'Action failed.');
      setErrorMsg(detail);
      showToast?.(detail);
      if (
        fieldErrors?.remarks ||
        /approval remarks|variance/i.test(detail)
      ) {
        setApprovalModalOpen(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-6">
      {/* ── 1. Top Executive Reconciliation Summary Bar ── */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3.5 mb-3.5">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center font-black">
              <FileCheck2 size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight text-white">Agency Bill Match</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Vendor A Grey Production
                </span>
              </div>
              <p className="text-xs text-slate-400">
                3-Way Reconciliation: Original PO ({poNumber}) + Final Job Work PO ({instructionData?.finalPoNumber || '—'}) + Agency Invoice
              </p>
            </div>
          </div>

          {/* Overall Status Badge */}
          <div className="flex items-center gap-2.5">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              overallReconciliationStatus === 'Approved & Payable'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : overallReconciliationStatus === 'Matched'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
            }`}>
              {overallReconciliationStatus === 'Approved & Payable' ? (
                <ShieldCheck size={13} />
              ) : overallReconciliationStatus === 'Matched' ? (
                <Check size={13} />
              ) : (
                <AlertTriangle size={13} />
              )}
              {overallReconciliationStatus}
            </span>
          </div>
        </div>

        {/* Executive Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Original PO</span>
            <span className="font-extrabold text-slate-200">{po?.status || 'Approved'}</span>
          </div>
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Final PO Status</span>
            <span className="font-extrabold text-blue-300">{finalPoData?.status || instructionData?.status || 'Approved'}</span>
          </div>
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Invoice Status</span>
            <span className="font-extrabold text-slate-200">{activeBill?.status || 'Draft / New'}</span>
          </div>
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Quantity Match</span>
            <span className={`font-extrabold inline-flex items-center gap-1 ${isQtyMatched ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isQtyMatched ? <Check size={11} /> : <AlertTriangle size={11} />}
              {isQtyMatched ? 'Matched' : `${qtyDiff > 0 ? '+' : ''}${fmtQty(qtyDiff)} M`}
            </span>
          </div>
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Rate Match</span>
            <span className={`font-extrabold inline-flex items-center gap-1 ${isRateMatched ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isRateMatched ? <Check size={11} /> : <AlertTriangle size={11} />}
              {isRateMatched ? 'Matched' : `₹${numIN(rateDiff)}/M`}
            </span>
          </div>
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Tax & Amount</span>
            <span className={`font-extrabold inline-flex items-center gap-1 ${isTotalMatched ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isTotalMatched ? <Check size={11} /> : <AlertTriangle size={11} />}
              {isTotalMatched ? 'Matched' : `₹${numIN(totalDiff)}`}
            </span>
          </div>
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Exceptions</span>
            <span className={`font-black ${exceptionCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {exceptionCount === 0 ? '0 Discrepancies' : `${exceptionCount} Discrepancy`}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle size={15} /> {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')}><X size={14} /></button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2"><CheckCircle2 size={15} /> {successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')}><X size={14} /></button>
        </div>
      )}

      {/* ── 2. Three Linked Document Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Panel A: Original PO (Read Only) */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">A</span>
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">Original PO</h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">Read Only</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">PO Number:</span>
              <span className="font-mono font-bold text-slate-800">{poNumber}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">PO Date:</span>
              <span className="font-mono text-slate-700">{fmtDate(po?.date || po?.docDate)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Vendor / Agency:</span>
              <span className="font-semibold text-slate-800 truncate max-w-[150px]">{po?.vendor || po?.partyName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Fabric Quality:</span>
              <span className="font-semibold text-slate-800">{instructionData?.fabric || po?.items?.[0]?.name || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Instructed Quantity:</span>
              <span className="font-mono font-bold text-indigo-700">{fmtQty(origInstructedQty)} M</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Agreed Rate:</span>
              <span className="font-mono font-bold text-slate-800">₹{numIN(origAgreedRate)} / M</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-medium">Total Commitment:</span>
              <span className="font-mono font-extrabold text-slate-900">₹{numIN(origTotal)}</span>
            </div>
          </div>
          <div className="pt-1">
            <span className="text-[10px] text-slate-400 block italic leading-tight">
              Audit baseline from initial approved purchase contract.
            </span>
          </div>
        </div>

        {/* Panel B: Final Job Work PO (Read Only) */}
        <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-blue-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">B</span>
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-blue-900">Final Job Work PO</h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">Commercial Basis</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-blue-200/50">
              <span className="text-slate-600 font-medium">Final PO Number:</span>
              <span className="font-mono font-bold text-blue-900">{instructionData?.finalPoNumber || finalPoData?.poNumber || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-blue-200/50">
              <span className="text-slate-600 font-medium">Final PO Date:</span>
              <span className="font-mono text-slate-700">{fmtDate(finalPoData?.docDate || finalPoData?.date || new Date())}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-blue-200/50">
              <span className="text-slate-600 font-medium">PI & Verification Ref:</span>
              <span className="font-semibold text-slate-800">{instructionData?.instructionNumber || 'PROD-2026-0043'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-blue-200/50">
              <span className="text-slate-600 font-medium">Verified Accepted Qty:</span>
              <span className="font-mono font-bold text-emerald-700">{fmtQty(finalPoQty)} M</span>
            </div>
            <div className="flex justify-between py-1 border-b border-blue-200/50">
              <span className="text-slate-600 font-medium">Approved Final Rate:</span>
              <span className="font-mono font-bold text-blue-900">₹{numIN(finalApprovedRate)} / M</span>
            </div>
            <div className="flex justify-between py-1 border-b border-blue-200/50">
              <span className="text-slate-600 font-medium">Taxable Base Amount:</span>
              <span className="font-mono font-bold text-slate-800">₹{numIN(finalTaxable)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600 font-medium">Final PO Total (incl. GST):</span>
              <span className="font-mono font-extrabold text-blue-950">₹{numIN(finalTotal)}</span>
            </div>
          </div>
          <div className="pt-1 flex items-center justify-between text-[10px]">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 size={11} /> Approved by Production & Accounts
            </span>
            <span className="text-slate-500 font-mono">Status: {finalPoData?.status || 'Approved'}</span>
          </div>
        </div>

        {/* Panel C: Vendor / Agency Invoice (Entry Form) */}
        <div className="bg-white border-2 border-slate-300 rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">C</span>
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-900">Agency Invoice Entry</h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              Accounts Entry Form
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">
                  Vendor Invoice # <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-0043"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">
                  Invoice Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">
                  Invoice Qty (M) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={invoiceQty}
                  onChange={(e) => setInvoiceQty(e.target.value)}
                  className={`w-full px-2.5 py-1.5 border rounded-lg font-mono text-xs font-bold ${
                    isQtyMatched ? 'border-slate-300 text-slate-900' : 'border-rose-400 bg-rose-50 text-rose-800'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">
                  Invoice Rate (₹/M) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={invoiceRate}
                  onChange={(e) => setInvoiceRate(e.target.value)}
                  className={`w-full px-2.5 py-1.5 border rounded-lg font-mono text-xs font-bold ${
                    isRateMatched ? 'border-slate-300 text-slate-900' : 'border-rose-400 bg-rose-50 text-rose-800'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">GST %</label>
                <select
                  value={gstPct}
                  onChange={(e) => setGstPct(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="5.0">5.0% (Textile)</option>
                  <option value="12.0">12.0%</option>
                  <option value="18.0">18.0%</option>
                  <option value="0.0">0.0% (Nil)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">Taxable</label>
                <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-800 truncate">
                  ₹{numIN(invoiceTaxable)}
                </div>
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">Grand Total</label>
                <div className="px-2 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg font-mono text-xs font-black text-indigo-950 truncate">
                  ₹{numIN(invoiceTotal)}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">
                Remarks / Discrepancy Explanation {exceptionCount > 0 && <span className="text-amber-600 font-bold">* Required</span>}
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={exceptionCount > 0 ? "Explain variance before submitting for approval..." : "Optional commercial remarks..."}
                className={`w-full px-2.5 py-1.5 border rounded-lg text-xs ${
                  exceptionCount > 0 && !remarks.trim() ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Three-Document Reconciliation Table ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
              <Scale size={14} className="text-indigo-600" />
              Three-Document Commercial Reconciliation
            </h4>
            <p className="text-[11px] text-slate-500">
              Rigorous side-by-side audit: Original Authorized PO vs Verified Final Job Work PO vs Actual Agency Claim.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold text-[11px]">
              <Check size={11} /> Matched
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold text-[11px]">
              <AlertTriangle size={11} /> Mismatch / Discrepancy
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded font-medium text-[11px]">
              Baseline / Yield
            </span>
          </div>
        </div>

        {/* Shortage Audit Callout (Original PO vs Final PO) */}
        {productionShortage > 0 && (
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs flex items-start gap-2.5 text-amber-900">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-amber-950">
                Audited Production Shortage: {fmtQty(productionShortage)} M ({productionShortagePct.toFixed(2)}% variance from Original PO)
              </p>
              <p className="text-[11.5px] text-amber-800 mt-0.5 leading-relaxed">
                Actual grey fabric production yielded {fmtQty(finalPoQty)} M against initial order of {fmtQty(origInstructedQty)} M.
                This variance is commercially approved on Final Job Work PO ({instructionData?.finalPoNumber || '—'}).
                <strong> The agency invoice is matched against the verified Final PO quantity, not penalized as a shortage.</strong>
              </p>
            </div>
          </div>
        )}

        {/* 14-Field Grid */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[10.5px]">
                <th className="py-2.5 px-3">Commercial Field</th>
                <th className="py-2.5 px-3">Original PO (Commitment)</th>
                <th className="py-2.5 px-3">Final Job Work PO (Approved)</th>
                <th className="py-2.5 px-3">Agency Invoice (Billed)</th>
                <th className="py-2.5 px-3 text-right">Variance / Difference</th>
                <th className="py-2.5 px-3 text-center">Match Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {comparisonRows.map((row, idx) => (
                <tr key={idx} className={row.status === 'Mismatch' ? 'bg-rose-50/50' : 'hover:bg-slate-50/70 transition'}>
                  <td className="py-2 px-3 font-semibold text-slate-800">{row.field}</td>
                  <td className="py-2 px-3 font-mono text-slate-600">{row.origVal}</td>
                  <td className="py-2 px-3 font-mono font-bold text-blue-900">{row.finalVal}</td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-900">{row.invoiceVal}</td>
                  <td className="py-2 px-3 font-mono text-right font-semibold">
                    <span className={row.difference.startsWith('+') ? 'text-rose-600' : row.difference.startsWith('-') ? 'text-amber-600' : 'text-slate-400'}>
                      {row.difference}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold ${
                      row.status === 'Matched'
                        ? 'bg-emerald-100 text-emerald-800'
                        : row.status === 'Mismatch'
                        ? 'bg-rose-100 text-rose-800 font-black'
                        : row.status === 'Verified Yield'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {row.status === 'Matched' && <Check size={10} />}
                      {row.status === 'Mismatch' && <AlertTriangle size={10} />}
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. Action & Approval Bar ── */}
      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onPrevStep && (
            <button
              type="button"
              onClick={onPrevStep}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <ArrowLeft size={13} /> Back to Final PO
            </button>
          )}
          <button
            type="button"
            onClick={() => handleAction('save_draft')}
            disabled={submitting}
            className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleAction('validate')}
            disabled={submitting}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
          >
            <Scale size={13} /> Validate / Match
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeBill?.status === 'Pending' && !isReconciled && (
            <button
              type="button"
              onClick={() => handleAction('submit_approval')}
              disabled={submitting}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <ShieldAlert size={13} /> Submit for Approval
            </button>
          )}

          {activeBill?.status !== 'Approved' && (
            <button
              type="button"
              onClick={() => handleAction('approve')}
              disabled={submitting}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <ShieldCheck size={14} /> Approve Match & Create Payable
            </button>
          )}

          {activeBill?.status === 'Approved' && onNextStep && (
            <button
              type="button"
              onClick={() => onNextStep('disbursement_payment')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <CreditCardIcon size={14} /> Proceed to Disbursement Payment →
            </button>
          )}
        </div>
      </div>

      {/* ── 5. Audit History Drawer / Accordion ── */}
      {activeBill?.approvalHistory?.length > 0 && (
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <History size={13} className="text-slate-500" />
            <h5 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700">Audit & Matching History</h5>
          </div>
          <div className="space-y-1.5">
            {activeBill.approvalHistory.map((h, i) => (
              <div key={i} className="text-[11px] p-2 bg-slate-50 border border-slate-200/70 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{h.action}</span>
                  <span className="text-slate-500 ml-2">by {h.by}</span>
                  {h.remarks && <p className="text-slate-600 mt-0.5 italic">"{h.remarks}"</p>}
                </div>
                <span className="font-mono text-slate-400 text-[10px]">{new Date(h.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variance Explanation Modal (if approving a mismatch) */}
      {approvalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-700 border-b border-amber-100 pb-3">
              <AlertTriangle size={20} />
              <h3 className="font-bold text-base text-slate-900">Authorize Discrepancy Remarks</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Discrepancies exist between the Final Approved PO and the Agency Invoice. Under company governance policy,
              approving a mismatched invoice requires an authorized reason to be recorded permanently in the audit history.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Authorized Variance Explanation <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={varianceReason}
                onChange={(e) => setVarianceReason(e.target.value)}
                placeholder="e.g. Special freight charges absorbed, approved by Management on 22-Oct..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovalModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!varianceReason.trim() || submitting}
                onClick={() => handleAction('approve')}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Confirm & Approve Mismatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreditCardIcon({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
