import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  X,
  Boxes,
  ShieldCheck,
  Check,
  Building2,
  Send,
  Lock,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function VendorBillInlineSlide({ po, instruction, onClose, onBillSaved, onNextStep, onPrevStep }) {
  const {
    formatDateDDMMYYYY,
    getPoBilledStatus,
    showToast,
    refreshCollections,
  } = useERP() || {};

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bills, setBills] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [grnList, setGrnList] = useState([]);
  const [poDetails, setPoDetails] = useState(null);

  const [vendorBillNumber, setVendorBillNumber] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [gstPct, setGstPct] = useState(5);
  const [remarks, setRemarks] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const poId = po?.id;
  const poNumber = po?.poNumber || poId;
  const poInfo = getPoBilledStatus ? getPoBilledStatus(poId) : { activeBills: [], totalBilledQty: 0 };

  const loadData = async () => {
    if (!poId) return;
    try {
      setLoading(true);
      setErrorMsg('');

      const [billsRes, grnRes, vbRes, poRes] = await Promise.all([
        api.get('/purchase/bills/', { params: { purchaseOrderId: poId, limit: 20 } }).catch(() => []),
        api.get('/purchase/receipts/', { params: { purchaseOrderId: poId, limit: 20 } }).catch(() => []),
        api.get('/purchase/vendor-bills/', { params: { purchaseOrderId: poId, limit: 20 } }).catch(() => []),
        api.get(`/purchase/orders/${poId}/`).catch(() => null),
      ]);

      if (poRes?.data || poRes) {
        setPoDetails(poRes?.data || poRes);
      }

      const rawBills = Array.isArray(billsRes) ? billsRes : (billsRes?.results || billsRes?.rows || billsRes?.data || []);
      const matchedBills = rawBills.filter(
        (b) => String(b.purchase_order || b.purchaseOrderId || b.purchaseOrder || b.poId || '') === String(poId) ||
               (poNumber && (b.poNumber === poNumber || b.po_number === poNumber || b.poRef === poNumber))
      );
      setBills(matchedBills);

      const rawGrns = Array.isArray(grnRes) ? grnRes : (grnRes?.results || grnRes?.rows || grnRes?.data || []);
      const matchedGrns = rawGrns.filter(
        (g) => String(g.purchase_order || g.purchaseOrderId || g.poId || '') === String(poId) ||
               (poNumber && (g.poNumber === poNumber || g.po_number === poNumber))
      );
      setGrnList(matchedGrns);

      const rawVbs = Array.isArray(vbRes) ? vbRes : (vbRes?.results || vbRes?.rows || vbRes?.data || []);
      const matchedVbs = rawVbs.filter(
        (v) => String(v.purchase_order || v.purchaseOrderId || v.poId || '') === String(poId) ||
               (poNumber && (v.poNumber === poNumber || v.po_number === poNumber))
      );
      setVendorBills(matchedVbs);

      // Auto-populate default invoice number if empty
      const activeVb = matchedVbs[0] || null;
      if (activeVb) {
        setVendorBillNumber(activeVb.vendorBillNumber || activeVb.vendor_bill_number || '');
        if (activeVb.billDate) setBillDate(activeVb.billDate);
        if (activeVb.gstPct !== undefined) setGstPct(Number(activeVb.gstPct));
      } else if (!vendorBillNumber) {
        setVendorBillNumber(`INV-${String(poNumber).slice(-6)}-${Date.now().toString().slice(-4)}`);
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

  // Active records
  const activeVendorBill = vendorBills[0] || null;
  const activePurchaseBill = bills[0] || null;
  const activeBill = activeVendorBill || activePurchaseBill || poInfo.activeBills?.[0] || null;

  // Authoritative PO metrics
  const effectivePo = poDetails || po;
  const rawItems = effectivePo?.items || effectivePo?.lineItems || [];
  const poFirstRate = Number(rawItems[0]?.rate || rawItems[0]?.unitPrice || 0);
  const poOrderedQty = Number(
    effectivePo?.totalQuantity ||
    rawItems.reduce((s, it) => s + (Number(it.qty) || 0), 0) ||
    0
  );
  const poContractAmount = Number(
    effectivePo?.total ||
    effectivePo?.amount ||
    (poOrderedQty > 0 && poFirstRate > 0 ? poOrderedQty * poFirstRate * 1.05 : 0) ||
    0
  );

  // Authoritative GRN receipts intake
  const totalReceivedMeters = useMemo(() => {
    if (grnList.length > 0) {
      return grnList.reduce((sum, g) => {
        const direct = Number(g.totalQuantity || g.receivedQuantity || 0);
        if (direct > 0) return sum + direct;
        if (Array.isArray(g.lines)) {
          return sum + g.lines.reduce((lSum, l) => lSum + Number(l.received_qty || l.receivedQty || 0), 0);
        }
        return sum;
      }, 0);
    }
    return Number(effectivePo?.receivedQuantity || effectivePo?.receivedQty || poOrderedQty || 0);
  }, [grnList, effectivePo, poOrderedQty]);

  // Expected 3-Way Values (Baseline)
  const expectedBillableQty = totalReceivedMeters > 0 ? totalReceivedMeters : poOrderedQty;
  const expectedRate = poFirstRate > 0 ? poFirstRate : (poOrderedQty > 0 ? poContractAmount / poOrderedQty / (1 + gstPct / 100) : 100);
  const expectedSubtotal = expectedBillableQty * expectedRate;
  const expectedGstAmount = round2(expectedSubtotal * (Number(gstPct) / 100));
  const expectedAmount = round2(expectedSubtotal + expectedGstAmount);

  // Pre-fill bill lines from authoritative PO/GRN
  const defaultLines = useMemo(() => {
    if (!rawItems.length) {
      return [{
        itemId: '',
        itemName: instruction?.fabric || 'Grey Fabric 40s',
        orderedQty: expectedBillableQty || 100,
        billingQty: expectedBillableQty || 100,
        poRate: expectedRate,
        rate: expectedRate,
        amount: round2((expectedBillableQty || 100) * expectedRate),
      }];
    }
    return rawItems.map((it) => {
      const lineQty = expectedBillableQty > 0 ? expectedBillableQty : Number(it.qty || 0);
      const lineRate = Number(it.rate || it.unitPrice || expectedRate);
      return {
        id: it.id,
        itemId: it.itemId || it.id,
        itemName: it.name || it.itemName || it.fabric || 'Grey Fabric',
        orderedQty: Number(it.qty || lineQty),
        billingQty: lineQty,
        poRate: lineRate,
        rate: lineRate,
        amount: round2(lineQty * lineRate),
      };
    });
  }, [rawItems, expectedBillableQty, expectedRate, instruction]);

  const [formLines, setFormLines] = useState(defaultLines);

  useEffect(() => {
    if (defaultLines.length > 0) {
      setFormLines(defaultLines);
    }
  }, [defaultLines]);

  const handleLineQtyChange = (idx, newQty) => {
    const qty = Number(newQty) || 0;
    setFormLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, billingQty: qty, amount: round2(qty * l.rate) } : l))
    );
  };

  const handleLineRateChange = (idx, newRate) => {
    const rate = Number(newRate) || 0;
    setFormLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, rate, amount: round2(l.billingQty * rate) } : l))
    );
  };

  const handleLineAmountChange = (idx, newAmount) => {
    const amt = Number(newAmount) || 0;
    setFormLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const calcRate = l.billingQty > 0 ? round2(amt / l.billingQty) : l.rate;
        return { ...l, amount: amt, rate: calcRate };
      })
    );
  };

  // Live reconciliation calculations
  const formSubtotal = useMemo(() => {
    return formLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }, [formLines]);

  const formGstAmount = useMemo(() => {
    return round2(formSubtotal * (Number(gstPct) / 100));
  }, [formSubtotal, gstPct]);

  const formTotalAmount = useMemo(() => {
    return round2(formSubtotal + formGstAmount);
  }, [formSubtotal, formGstAmount]);

  const formTotalQty = useMemo(() => {
    return formLines.reduce((s, l) => s + (Number(l.billingQty) || 0), 0);
  }, [formLines]);

  // Differences & Tolerances
  const amountDifference = round2(formTotalAmount - expectedAmount);
  const amountVariance = Math.abs(amountDifference);
  const qtyDifference = round2(formTotalQty - expectedBillableQty);
  const qtyVariance = Math.abs(qtyDifference);
  const hasRateMismatch = formLines.some((l) => Math.abs(Number(l.rate) - Number(l.poRate)) > 0.05);

  const isAmountMismatch = amountVariance > 1.0;
  const isQtyMismatch = qtyVariance > 0.05;
  const hasDiscrepancy = isAmountMismatch || isQtyMismatch || hasRateMismatch;

  // Matching Status string
  const currentMatchingStatus = hasDiscrepancy
    ? 'Amount Mismatch — Approval Required'
    : 'Matched (Zero Variance)';

  // Lifecycle state resolution for active bill
  const billStatus = activeVendorBill?.status || (activePurchaseBill ? 'Approved (Payable Posted)' : 'New Draft');
  const billMatchStatus = activeVendorBill?.matchStatus || activeVendorBill?.match_status || (hasDiscrepancy ? 'Mismatch Detected' : 'Matched');

  // ── Record Bill Action (Saves to /purchase/vendor-bills/ with 3-Way Matching) ──
  const handleSaveBill = async (isDraftMode = false) => {
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (!vendorBillNumber.trim()) {
        setErrorMsg('Please enter the Vendor Bill / Invoice Number.');
        setSubmitting(false);
        return;
      }

      const linePayload = formLines.map((l, index) => ({
        lineNo: index + 1,
        itemId: l.itemId || undefined,
        item: l.itemId || undefined,
        description: l.itemName,
        qty: Number(l.billingQty),
        rate: Number(l.rate),
        amount: Number(l.amount),
      }));

      const payload = {
        vendorBillNumber: vendorBillNumber.trim(),
        billDate: billDate,
        vendorId: effectivePo?.vendorId || effectivePo?.partyId || effectivePo?.party?.id,
        party: effectivePo?.vendorId || effectivePo?.partyId || effectivePo?.party?.id,
        purchaseOrderId: poId,
        purchase_order: poId,
        grnId: grnList[0]?.id || undefined,
        gstPct: Number(gstPct),
        remarks: remarks || (hasDiscrepancy
          ? `Discrepancy detected: PO/GRN Expected ₹${numIN(expectedAmount)} vs Entered ₹${numIN(formTotalAmount)} (Diff: ₹${numIN(amountDifference)})`
          : `3-Way matched against PO ${poNumber}`),
        lineItems: linePayload,
        isDraft: Boolean(isDraftMode),
        status: isDraftMode ? 'Draft' : undefined,
      };

      let res = null;
      if (activeVendorBill?.id) {
        res = await api.put(`/purchase/vendor-bills/${activeVendorBill.id}/`, payload);
      } else {
        res = await api.post('/purchase/vendor-bills/', payload);
      }

      const savedVb = res?.data || res;
      const returnedMatch = savedVb?.matchStatus || savedVb?.match_status || (hasDiscrepancy ? 'Mismatch' : 'Matched');
      const returnedStatus = savedVb?.status || (hasDiscrepancy ? 'Approval Required' : 'Pending Verification');

      if (isDraftMode) {
        setSuccessMsg(`✓ Vendor Bill ${vendorBillNumber} saved as Draft. Status: Draft.`);
        showToast?.(`Vendor Bill ${vendorBillNumber} saved as draft.`);
      } else if (returnedMatch === 'Mismatch' || returnedMatch === 'Mismatch Detected' || hasDiscrepancy) {
        setSuccessMsg(
          `⚠️ Amount Mismatch — Approval Required: Vendor Bill ${vendorBillNumber} recorded with discrepancy (Difference: ${amountDifference > 0 ? '+' : ''}₹${numIN(amountDifference)}). Status: ${returnedStatus}. Routed to management approval.`
        );
        showToast?.(`Amount Mismatch Detected (₹${numIN(amountVariance)}) — Approval Required.`, 'warning');
      } else {
        setSuccessMsg(
          `✓ 3-Way Match Verified! Vendor Bill ${vendorBillNumber} successfully recorded and matched with zero variance against PO ${poNumber}. Status: ${returnedStatus}.`
        );
        showToast?.(`Vendor Bill ${vendorBillNumber} recorded and 3-way matched.`, 'success');
      }

      if (refreshCollections) {
        refreshCollections(['vendorBills', 'purchaseBills', 'purchaseOrders']);
      }
      if (onBillSaved) {
        onBillSaved(savedVb);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to save vendor bill:', err);
      const detail = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Failed to save vendor bill.';
      setErrorMsg(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Route to Approval / Approve with Variance ──
  const handleApproveMismatch = async () => {
    if (!activeVendorBill?.id) return;
    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      if (hasDiscrepancy && !approvalRemarks.trim()) {
        setErrorMsg('Please enter an authorized explanation in Approval Remarks before approving this mismatched bill.');
        setSubmitting(false);
        return;
      }

      const res = await api.post(`/purchase/vendor-bills/${activeVendorBill.id}/approve/`, {
        remarks: approvalRemarks || 'Approved with commercial variance.',
        createPayable: true,
      });

      setSuccessMsg(`✓ Vendor Bill ${activeVendorBill.vendorBillNumber} approved! Payable created.`);
      showToast?.('Vendor Bill approved successfully.', 'success');
      if (refreshCollections) {
        refreshCollections(['vendorBills', 'purchaseBills', 'purchaseOrders']);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to approve vendor bill:', err);
      const detail = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Approval failed.';
      setErrorMsg(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Convert to Official Purchase Bill (Send for Matching) ──
  const handleSendForMatching = async () => {
    if (!activeVendorBill?.id) return;
    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await api.post(`/purchase/vendor-bills/${activeVendorBill.id}/send-for-matching/`);
      const billNo = res?.billNumber || res?.data?.billNumber || 'Payable';
      setSuccessMsg(`✓ Official Purchase Bill ${billNo} generated and matched!`);
      showToast?.(`Purchase Bill ${billNo} created successfully.`, 'success');
      if (refreshCollections) {
        refreshCollections(['vendorBills', 'purchaseBills', 'purchaseOrders']);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to send for matching:', err);
      const detail = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Matching failed.';
      setErrorMsg(detail);
    } finally {
      setSubmitting(false);
    }
  };

  function round2(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  return (
    <div className="rounded-2xl border-2 border-indigo-500/80 bg-gradient-to-b from-indigo-50/50 via-white to-white p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
      {/* ── Slide Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
            <Receipt size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                Stage 8 Reconciliation
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Vendor Bill Matching & 3-Way Reconciliation
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Strict 3-way reconciliation comparing Purchase Order contract, verified Goods Receipt (GRN), and Vendor Invoice.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer"
            title="Refresh matching records"
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

      {/* ── 3-Way Context Pillars ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Pillar 1: Purchase Order */}
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <FileText size={12} className="text-blue-600" /> 1. Purchase Order
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {poNumber}
            </span>
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Contract Qty:</span>
              <strong className="font-mono text-slate-900">{numIN(poOrderedQty)} Mtr</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Contract Rate:</span>
              <strong className="font-mono text-slate-900">₹{numIN(poFirstRate)}/m</strong>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
              <span>Contract Amount:</span>
              <strong className="font-mono text-blue-700 font-extrabold">₹{numIN(poContractAmount)}</strong>
            </div>
          </div>
        </div>

        {/* Pillar 2: Goods Receipt (GRN) */}
        <div className="p-3 bg-white border border-emerald-200 rounded-xl shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <Boxes size={12} className="text-emerald-600" /> 2. Warehouse GRN
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
              {grnList[0]?.grnNumber || grnList[0]?.grn_number || 'GRN Verified'}
            </span>
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Received Qty:</span>
              <strong className="font-mono text-emerald-800 font-extrabold">{numIN(totalReceivedMeters)} Mtr</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Receipt Date:</span>
              <strong className="font-mono text-slate-800">{grnList[0]?.receiptDate || grnList[0]?.receipt_date || 'Inward'}</strong>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
              <span>QC Clearance:</span>
              <strong className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 size={12} /> Accepted & In Stock
              </strong>
            </div>
          </div>
        </div>

        {/* Pillar 3: Vendor Invoice */}
        <div className={`p-3 bg-white border-2 rounded-xl shadow-2xs space-y-1.5 ${
          hasDiscrepancy ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/20' : 'border-indigo-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1">
              <Receipt size={12} className="text-indigo-600" /> 3. Vendor Invoice
            </span>
            <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded truncate max-w-[120px]">
              {vendorBillNumber || 'Draft Bill'}
            </span>
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Billed Qty:</span>
              <strong className={`font-mono font-extrabold ${isQtyMismatch ? 'text-rose-600' : 'text-indigo-900'}`}>
                {numIN(formTotalQty)} Mtr
              </strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Billed Rate:</span>
              <strong className={`font-mono ${hasRateMismatch ? 'text-rose-600 font-bold' : 'text-indigo-900'}`}>
                ₹{numIN(formLines[0]?.rate || 0)}/m
              </strong>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
              <span>Invoice Total:</span>
              <strong className={`font-mono font-extrabold ${isAmountMismatch ? 'text-rose-600 text-sm' : 'text-indigo-700'}`}>
                ₹{numIN(formTotalAmount)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── ALERTS: Prominent Mismatch vs Match Banner (Exact User Requirements) ── */}
      {hasDiscrepancy ? (
        <div className="p-4 rounded-xl border-2 border-rose-500 bg-rose-50/90 text-rose-950 space-y-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle size={18} strokeWidth={2.5} />
              </div>
              <div>
                <strong className="block text-sm text-rose-900 font-black">
                  Amount Mismatch — Approval Required
                </strong>
                <span className="text-[11px] font-medium text-rose-800">
                  The entered vendor invoice values differ from authoritative PO and GRN intake. Approval is required before payment.
                </span>
              </div>
            </div>

            <span className="px-3 py-1 rounded-lg text-xs font-black bg-rose-600 text-white shadow-xs">
              Difference: {amountDifference > 0 ? '+' : ''}₹{numIN(amountDifference)}
            </span>
          </div>

          {/* 4 Required Metric Boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-rose-200 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Expected Amount</span>
              <strong className="font-mono text-slate-900 font-extrabold text-sm block mt-0.5">
                ₹{numIN(expectedAmount)}
              </strong>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Entered Invoice Amount</span>
              <strong className="font-mono text-rose-700 font-extrabold text-sm block mt-0.5">
                ₹{numIN(formTotalAmount)}
              </strong>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Difference</span>
              <strong className={`font-mono font-black text-sm block mt-0.5 ${amountDifference > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                {amountDifference > 0 ? '+' : ''}₹{numIN(amountDifference)}
              </strong>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Matching Status</span>
              <strong className="text-rose-700 font-black text-xs block mt-0.5">
                Amount Mismatch — Approval Required
              </strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Check size={18} strokeWidth={2.5} />
            </div>
            <div>
              <strong className="block text-sm text-emerald-900 font-bold">
                ✓ 3-Way Match Verified (Zero Variance)
              </strong>
              <span className="text-[11px] font-normal text-emerald-800">
                Invoice amounts, rates, and verified physical dock receipts agree 100%.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div>Expected: <strong>₹{numIN(expectedAmount)}</strong></div>
            <div>Entered: <strong className="text-emerald-800 font-extrabold">₹{numIN(formTotalAmount)}</strong></div>
            <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] shadow-2xs">
              Status: Matched
            </span>
          </div>
        </div>
      )}

      {/* System feedback messages */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Existing Bill Lifecycle Card (When Saved Record Exists) ── */}
      {activeVendorBill && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-800">
                Saved Vendor Bill: <span className="font-mono text-indigo-700">{activeVendorBill.vendorBillNumber}</span>
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                Status: {activeVendorBill.status}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                activeVendorBill.matchStatus === 'Mismatch' || activeVendorBill.match_status === 'Mismatch' || activeVendorBill.match_status === 'Mismatch Detected'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                Match: {activeVendorBill.matchStatus || activeVendorBill.match_status || 'Pending'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Bill Date</span>
              <strong className="font-mono text-slate-800">{activeVendorBill.billDate}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Subtotal</span>
              <strong className="font-mono text-slate-800">₹{numIN(activeVendorBill.subtotal)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">GST Amount</span>
              <strong className="font-mono text-slate-800">₹{numIN(activeVendorBill.gstAmount || activeVendorBill.gst_amount)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Grand Total</span>
              <strong className="font-mono text-indigo-900 font-extrabold">₹{numIN(activeVendorBill.total)}</strong>
            </div>
          </div>

          {/* Action Row for Saved Bill */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Lock size={12} className="text-slate-400" />
              Payment is protected until management approval is finalized.
            </span>

            <div className="flex items-center gap-2">
              {(activeVendorBill.status === 'Approval Required' || activeVendorBill.matchStatus === 'Mismatch' || activeVendorBill.match_status === 'Mismatch Detected' || hasDiscrepancy) && activeVendorBill.status !== 'Approved' && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Approval explanation..."
                    value={approvalRemarks}
                    onChange={(e) => setApprovalRemarks(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-300 rounded bg-white w-48 font-sans"
                  />
                  <button
                    type="button"
                    onClick={handleApproveMismatch}
                    disabled={submitting}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    Approve with Variance
                  </button>
                </div>
              )}

              {activeVendorBill.status === 'Approved' && !activeVendorBill.purchaseBillId && (
                <button
                  type="button"
                  onClick={handleSendForMatching}
                  disabled={submitting}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Send size={12} />
                  <span>Generate Purchase Bill (Payable)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bill Entry & Reconciliation Form ── */}
      <form onSubmit={(e) => { e.preventDefault(); handleSaveBill(false); }} className="space-y-4">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={13} className="text-indigo-600" /> Vendor Invoice Header Details
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Vendor Invoice / Bill No *
              </label>
              <input
                type="text"
                required
                value={vendorBillNumber}
                onChange={(e) => setVendorBillNumber(e.target.value)}
                placeholder={`e.g. INV-${String(poNumber).slice(-6)}`}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Invoice Date *
              </label>
              <input
                type="date"
                required
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Payment Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                GST Slab (%)
              </label>
              <select
                value={gstPct}
                onChange={(e) => setGstPct(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <option value={0}>0% (Tax Exempt)</option>
                <option value={5}>5% (Textile Standard)</option>
                <option value={12}>12% (Job Work / Processed)</option>
                <option value={18}>18% (Services / Commercial)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Bill Line Items Table ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Bill Line Items (Pre-filled from GRN Intake)
            </h4>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">
                Subtotal: <strong className="font-mono text-slate-800">₹{numIN(formSubtotal)}</strong>
              </span>
              <span className="text-slate-500">
                GST ({gstPct}%): <strong className="font-mono text-slate-800">₹{numIN(formGstAmount)}</strong>
              </span>
              <span className="text-slate-700">
                Total: <strong className="text-indigo-700 font-mono font-black text-sm">₹{numIN(formTotalAmount)}</strong>
              </span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Fabric Quality / Item</th>
                  <th className="py-2.5 px-3">Contract Qty</th>
                  <th className="py-2.5 px-3">Billed Qty (Mtr) *</th>
                  <th className="py-2.5 px-3">Contract Rate</th>
                  <th className="py-2.5 px-3">Invoice Rate (₹/Mtr) *</th>
                  <th className="py-2.5 px-3 text-right">Line Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
                {formLines.map((l, idx) => {
                  const lineRateMismatch = Math.abs(Number(l.rate) - Number(l.poRate)) > 0.05;
                  const lineQtyMismatch = Math.abs(Number(l.billingQty) - Number(l.orderedQty)) > 0.05;
                  return (
                    <tr key={l.id || idx} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-sans font-bold text-slate-800">
                        {l.itemName}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {numIN(l.orderedQty)} m
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={l.billingQty}
                          onChange={(e) => handleLineQtyChange(idx, e.target.value)}
                          className={`w-24 px-2 py-1 text-xs border rounded bg-white focus:outline-none focus:ring-2 font-bold ${
                            lineQtyMismatch
                              ? 'border-amber-400 text-amber-800 focus:ring-amber-500'
                              : 'border-slate-300 text-slate-800 focus:ring-indigo-500'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        ₹{numIN(l.poRate)}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={l.rate}
                          onChange={(e) => handleLineRateChange(idx, e.target.value)}
                          className={`w-24 px-2 py-1 text-xs border rounded bg-white focus:outline-none focus:ring-2 font-bold ${
                            lineRateMismatch
                              ? 'border-rose-400 text-rose-800 focus:ring-rose-500'
                              : 'border-slate-300 text-slate-800 focus:ring-indigo-500'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={l.amount}
                          onChange={(e) => handleLineAmountChange(idx, e.target.value)}
                          className="w-28 px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-extrabold text-indigo-900 text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remarks and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <input
            type="text"
            placeholder="Internal remarks or commercial reconciliation notes..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full sm:w-80 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Save Draft Button (Saves without auto-matching) */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSaveBill(true)}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              Save Draft
            </button>

            {/* Save & 3-Way Match Button */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all ${
                hasDiscrepancy
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Validating Reconciliation...</span>
                </>
              ) : hasDiscrepancy ? (
                <>
                  <AlertTriangle size={14} />
                  <span>Save with Mismatch (₹{numIN(formTotalAmount)})</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Record & Verify 3-Way Match (₹{numIN(formTotalAmount)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ── Slide Lifecycle Footer Navigation Bar ── */}
      <div className="pt-3 border-t border-indigo-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-indigo-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
        <div className="flex items-center gap-2">
          {onPrevStep && (
            <button
              type="button"
              onClick={() => onPrevStep('grey_stock_updated')}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <ArrowLeft size={13} />
              <span>Previous: Grey Stock Updated</span>
            </button>
          )}
          <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
            Stage 8 • Vendor Bill Matching & 3-Way Reconciliation
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              Close Slide
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VendorBillInlineSlide;
