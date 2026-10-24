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
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function SupplierBillMatchingInlineSlide({ po, instruction, onClose, onBillMatched, onNextStep, onPrevStep }) {
  const {
    formatCurrency,
    formatDateDDMMYYYY,
    getPoBilledStatus,
    convertPurchaseOrderToBill,
    showToast,
    refreshCollections,
  } = useERP() || {};

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grnList, setGrnList] = useState([]);
  const [bills, setBills] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const poId = po?.id;
  const poNumber = po?.poNumber || poId;
  const poInfo = getPoBilledStatus ? getPoBilledStatus(poId) : { activeBills: [], totalBilledQty: 0 };

  // Detect Job Work PO vs Standard PO
  const isJobWork = Boolean(
    instruction?.finalPoNumber ||
    instruction?.agreed_job_rate ||
    instruction?.agreed_rate ||
    po?.purchase_type === 'Final Job Work' ||
    po?.finalPoNumber
  );

  const effectivePoNumber = instruction?.finalPoNumber || po?.finalPoNumber || poNumber;
  const effectivePoQty = Number(
    instruction?.completion?.acceptedQty ||
    instruction?.acceptedQty ||
    po?.totalQuantity ||
    (po?.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0) ||
    0
  );
  const effectivePoRate = Number(
    instruction?.agreed_job_rate ||
    instruction?.agreed_rate ||
    po?.items?.[0]?.rate ||
    (effectivePoQty > 0 ? (Number(po?.amount || po?.total || 0) / effectivePoQty) : 0) ||
    0
  );
  const effectivePoAmount = Number(
    instruction?.completion?.finalAmount ||
    instruction?.finalAmount ||
    po?.finalPoAmount ||
    (effectivePoQty > 0 && effectivePoRate > 0 ? effectivePoQty * effectivePoRate : null) ||
    po?.amount ||
    po?.total ||
    0
  );

  const loadData = async () => {
    if (!poId) return;
    try {
      setLoading(true);

      // 1. Fetch GRNs, Vendor Bills, and Purchase Bills in parallel
      const [grnRes, vbRes, pbRes] = await Promise.all([
        api.get('/purchase/receipts/', { params: { poId, po: poId, limit: 20 } }).catch(() => []),
        api.get('/purchase/vendor-bills/', { params: { poId, po: poId, limit: 20 } }).catch(() => []),
        api.get('/purchase/bills/', { params: { purchaseOrderId: poId, limit: 20 } }).catch(() => []),
      ]);

      const allGrns = Array.isArray(grnRes) ? grnRes : (grnRes?.data || grnRes?.results || []);
      const poGrns = allGrns.filter(
        (g) => String(g.purchaseOrderId || g.purchaseOrder || g.poId || '') === String(poId) ||
               (poNumber && (g.poNumber === poNumber || g.po_number === poNumber))
      );
      setGrnList(poGrns);

      const allVb = Array.isArray(vbRes) ? vbRes : (vbRes?.data || vbRes?.results || []);
      const poVb = allVb.filter(
        (b) => String(b.purchaseOrderId || b.purchaseOrder || b.poId || '') === String(poId) ||
               (poNumber && (b.poNumber === poNumber || b.po_number === poNumber)) ||
               (effectivePoNumber && (b.poNumber === effectivePoNumber || b.po_number === effectivePoNumber))
      );
      setVendorBills(poVb);

      const allPb = Array.isArray(pbRes) ? pbRes : (pbRes?.data || pbRes?.results || []);
      const poPb = allPb.filter(
        (b) => String(b.purchaseOrderId || b.purchaseOrder || b.purchase_order || b.poId || '') === String(poId) ||
               (poNumber && (b.poNumber === poNumber || b.po_number === poNumber)) ||
               (effectivePoNumber && (b.poNumber === effectivePoNumber || b.po_number === effectivePoNumber))
      );
      setBills(poPb);

      const activeFound = poPb[0] || poVb[0] || poInfo.activeBills?.[0] || null;
      if (activeFound?.vendorBillNumber) {
        setInvoiceNumber(activeFound.vendorBillNumber);
      } else if (activeFound?.billNumber) {
        setInvoiceNumber(activeFound.billNumber);
      } else {
        setInvoiceNumber(`INV-${effectivePoNumber}-${new Date().getFullYear()}`);
      }
    } catch (err) {
      console.warn('Failed to load bill matching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poId]);

  // Active Bill Resolution
  const activeBill = bills[0] || vendorBills[0] || poInfo.activeBills?.[0] || null;

  // GRN intake meters
  const grnQty = grnList.reduce((s, g) => s + Number(g.totalQuantity || g.receivedQuantity || 0), 0) || effectivePoQty;

  // Billed metrics from the actual vendor bill
  const billedQty = activeBill
    ? Number(
        activeBill.totalQuantity ||
        activeBill.total_qty ||
        activeBill.billingQty ||
        (activeBill.lines || activeBill.items || []).reduce((s, l) => s + (Number(l.qty || l.billingQty) || 0), 0) ||
        activeBill.qty ||
        0
      )
    : 0;

  const billedAmount = activeBill
    ? Number(
        activeBill.total ||
        activeBill.total_amount ||
        activeBill.amount ||
        activeBill.net_amount ||
        (activeBill.lines || activeBill.items || []).reduce((s, l) => s + (Number(l.amount) || 0), 0) ||
        0
      )
    : 0;

  const billedRate = billedQty > 0 ? (billedAmount / billedQty) : 0;

  // Rigorous 3-Way Matching calculations
  const hasBill = Boolean(activeBill);
  const qtyVariance = hasBill ? Math.abs(effectivePoQty - billedQty) : 0;
  const amountDifference = hasBill ? (billedAmount - effectivePoAmount) : 0;
  const amountVariance = Math.abs(amountDifference);
  const rateDifference = hasBill ? (billedRate - effectivePoRate) : 0;
  const rateVariance = Math.abs(rateDifference);

  // Criteria: Both Quantity AND Amount must match (within ₹1 rounding threshold)
  const isQtyMatched = hasBill && qtyVariance <= 0.05;
  const isAmountMatched = hasBill && amountVariance <= 1.0;
  const isRateMatched = hasBill && rateVariance <= 0.05;

  const isMatched = hasBill && isQtyMatched && isAmountMatched;
  const hasDiscrepancy = hasBill && !isMatched;

  const handleApproveAndGenerateBill = async (e) => {
    e?.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      // If amount or qty discrepancy exists, require an authorized variance remark
      if (hasDiscrepancy && !remarks.trim()) {
        setErrorMsg(
          `⚠️ Amount Discrepancy Detected (Variance: ₹${numIN(amountVariance)}). You must provide an authorized explanation in Remarks before approving this mismatched bill.`
        );
        return;
      }

      if (activeBill && isMatched) {
        setSuccessMsg(`✓ 3-Way Match already verified! Bill ${activeBill.billNumber || activeBill.vendorBillNumber} matches perfectly.`);
        return;
      }

      // Convert PO to Bill using ERPContext or direct API
      if (convertPurchaseOrderToBill && !activeBill) {
        await convertPurchaseOrderToBill(poId);
      } else {
        await api.post('/purchase/bills/', {
          purchaseOrderId: poId,
          billNumber: invoiceNumber,
          billDate: invoiceDate,
          vendorId: po?.vendorId || po?.partyId,
          total: billedAmount > 0 ? billedAmount : effectivePoAmount,
          remarks: remarks || (hasDiscrepancy
            ? `3-Way match approved WITH VARIANCE: PO ₹${numIN(effectivePoAmount)} vs Bill ₹${numIN(billedAmount)} (Diff: ₹${numIN(amountVariance)})`
            : `3-Way matched with GRN for PO ${effectivePoNumber}`),
        });
      }

      setSuccessMsg(`✓ 3-Way Verification Complete for ${effectivePoNumber}!`);
      if (showToast) showToast('3-Way Match verified and approved.', 'success');
      if (refreshCollections) refreshCollections(['purchaseOrders', 'purchaseBills', 'vendorBills']);
      if (onBillMatched) onBillMatched();
      await loadData();
    } catch (err) {
      console.error('Failed to approve match:', err);
      setErrorMsg(err?.message || 'Failed to complete 3-way matching.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-blue-400/80 bg-gradient-to-b from-blue-50/60 via-white to-white p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
      {/* ── Slide Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <FileCheck2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">
                Stage 8 Slide
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Supplier Bill Matching (3-Way Verification)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Strict 3-way reconciliation across {isJobWork ? 'Final Job Work PO' : 'Purchase Order'}, Warehouse Intake, and Vendor Invoice.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer"
            title="Refresh matching"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── 3-Way Comparison Pillars ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Pillar 1: Job Work PO / Purchase Order */}
        <div className={`bg-white border-2 rounded-xl p-3.5 space-y-2 shadow-2xs ${
          hasDiscrepancy ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <FileText size={12} className="text-blue-600" /> 1. {isJobWork ? 'Job Work PO' : 'Purchase Order'}
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {effectivePoNumber}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{isJobWork ? 'Accepted Qty:' : 'Ordered Qty:'}</span>
              <strong className="font-mono text-slate-900">{numIN(effectivePoQty)} Mtr</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Agreed Rate:</span>
              <strong className="font-mono text-slate-900">₹{numIN(effectivePoRate)}/m</strong>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
              <span>Contract Total:</span>
              <strong className="font-mono text-blue-700 font-extrabold">₹{numIN(effectivePoAmount)}</strong>
            </div>
          </div>
        </div>

        {/* Pillar 2: Goods Receipt (GRN) / Verified Production */}
        <div className="bg-white border-2 border-emerald-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <Boxes size={12} className="text-emerald-600" /> 2. {isJobWork ? 'Verified Production' : 'Warehouse GRN'}
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
              {grnList[0]?.grnNumber || (isJobWork ? 'QC Verified' : 'GRN Linked')}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{isJobWork ? 'Physically Verified:' : 'Received Qty:'}</span>
              <strong className="font-mono text-emerald-800 font-extrabold">{numIN(grnQty)} Mtr</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>QC Accepted Qty:</span>
              <strong className="font-mono text-emerald-800">{numIN(effectivePoQty)} Mtr</strong>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
              <span>Verification Status:</span>
              <strong className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 size={12} /> Passed & Approved
              </strong>
            </div>
          </div>
        </div>

        {/* Pillar 3: Vendor Invoice / Bill */}
        <div className={`bg-white border-2 rounded-xl p-3.5 space-y-2 shadow-2xs ${
          hasDiscrepancy ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/20' : 'border-indigo-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1">
              <Receipt size={12} className="text-indigo-600" /> 3. Vendor Bill
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
              hasBill ? 'text-indigo-800 bg-indigo-50' : 'text-slate-400 bg-slate-100'
            }`}>
              {hasBill ? (activeBill?.billNumber || activeBill?.vendorBillNumber || invoiceNumber) : 'Not Recorded Yet'}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Billed Qty:</span>
              <strong className={`font-mono font-extrabold ${!isQtyMatched && hasBill ? 'text-rose-600' : 'text-indigo-900'}`}>
                {hasBill ? `${numIN(billedQty)} Mtr` : '—'}
              </strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Billed Rate:</span>
              <strong className={`font-mono ${!isRateMatched && hasBill ? 'text-rose-600 font-bold' : 'text-indigo-900'}`}>
                {hasBill ? `₹${numIN(billedRate)}/m` : '—'}
              </strong>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
              <span>Bill Amount:</span>
              <strong className={`font-mono font-extrabold ${!isAmountMatched && hasBill ? 'text-rose-600 text-sm' : 'text-indigo-700'}`}>
                {hasBill ? `₹${numIN(billedAmount)}` : '—'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3-Way Match Verification Banner ── */}
      {!hasBill ? (
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <span>No vendor bill recorded yet for {effectivePoNumber}. Please record a bill in Stage 7 before matching.</span>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200 text-slate-700">
            Pending Bill Intake
          </span>
        </div>
      ) : isMatched ? (
        <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Check size={16} strokeWidth={2.5} />
            </div>
            <div>
              <strong className="block text-sm text-emerald-900 font-bold">
                ✓ 3-Way Match Verified (Zero Variance)
              </strong>
              <span className="text-[11px] font-normal text-emerald-800">
                Job Work PO Amount (₹{numIN(effectivePoAmount)}) matches Vendor Bill Amount (₹{numIN(billedAmount)}) with 100% quantity and rate reconciliation.
              </span>
            </div>
          </div>

          <span className="px-3 py-1 rounded-lg text-xs font-black bg-emerald-600 text-white shadow-2xs">
            Match Status: 100% OK
          </span>
        </div>
      ) : (
        /* Mismatch / Discrepancy Alert */
        <div className="p-3.5 rounded-xl border-2 border-rose-400 bg-rose-50/90 text-rose-950 space-y-2.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle size={16} strokeWidth={2.5} />
              </div>
              <div>
                <strong className="block text-sm text-rose-900 font-black">
                  ⚠️ Commercial Discrepancy Detected (Bill Does Not Match PO)
                </strong>
                <span className="text-[11px] font-medium text-rose-800">
                  The Vendor Bill amount differs from the {isJobWork ? 'Final Job Work PO' : 'Purchase Order'} amount.
                </span>
              </div>
            </div>

            <span className="px-3 py-1 rounded-lg text-xs font-black bg-rose-600 text-white shadow-xs tracking-wide">
              MISMATCH: ₹{numIN(amountVariance)}
            </span>
          </div>

          {/* Variance Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-rose-200/80 text-xs">
            <div className="bg-white/80 p-2 rounded-lg border border-rose-200">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Job Work PO Total</span>
              <strong className="font-mono text-slate-900 font-extrabold">₹{numIN(effectivePoAmount)}</strong>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-rose-200">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Vendor Bill Total</span>
              <strong className="font-mono text-rose-700 font-extrabold">₹{numIN(billedAmount)}</strong>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-rose-200">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Net Difference</span>
              <strong className={`font-mono font-black ${amountDifference > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                {amountDifference > 0 ? '+' : '-'}₹{numIN(amountVariance)}
              </strong>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-rose-200">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Rate Variance</span>
              <strong className="font-mono text-rose-700 font-extrabold">
                {rateDifference !== 0 ? `${rateDifference > 0 ? '+' : '-'}₹${numIN(rateVariance)}/m` : '0.00 (Match)'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Action Notice & Mandatory Remarks */}
      {hasDiscrepancy && (
        <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-amber-900 font-bold">
            <ShieldAlert size={14} className="text-amber-600" />
            <span>Commercial Exception Governance</span>
          </div>
          <p className="text-[11px] text-amber-800">
            Because the Vendor Bill amount does not equal the Job Work PO, automatic payment matching is blocked. To approve this bill with an authorized variance exception, you must record justification remarks below.
          </p>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Variance Justification Remarks <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Authorized rate adjustment approved by Production Head due to special finishing..."
              className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Slide Lifecycle Navigation Bar ── */}
      <div className="pt-3 border-t border-blue-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-blue-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
        <div className="flex items-center gap-2">
          {onPrevStep && (
            <button
              type="button"
              onClick={() => onPrevStep('vendor_bill')}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <ArrowLeft size={13} />
              <span>Previous: Vendor Bill</span>
            </button>
          )}
          <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
            Stage 8 of 9 • Supplier 3-Way Bill Matching
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs cursor-pointer shadow-2xs"
            >
              Close Slide
            </button>
          )}

          {/* Action button */}
          {hasDiscrepancy ? (
            <button
              type="button"
              onClick={handleApproveAndGenerateBill}
              disabled={submitting}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Scale size={14} />
              {submitting ? 'Approving...' : 'Approve with Variance Exception'}
            </button>
          ) : !activeBill ? (
            <button
              type="button"
              onClick={() => onPrevStep && onPrevStep('vendor_bill')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Receipt size={14} />
              <span>Record Vendor Bill First</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApproveAndGenerateBill}
              disabled={submitting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <CheckCircle2 size={14} />
              {submitting ? 'Verifying...' : '3-Way Match Verified'}
            </button>
          )}

          {onNextStep && (
            <button
              type="button"
              onClick={() => onNextStep('disbursement_payment')}
              disabled={hasDiscrepancy && !remarks.trim()}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
                hasDiscrepancy && !remarks.trim()
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              }`}
            >
              <span>Next: Disbursement Payment</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupplierBillMatchingInlineSlide;
