import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CreditCard,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  RefreshCw,
  Building2,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ShieldCheck,
  Ban,
  IndianRupee,
  Clock,
} from 'lucide-react';
import { api } from '../../services/api';
import { newIdempotencyKey } from '../../services/resourceSync';
import { useERP } from '../../context/ERPContext';
import { VendorBillInlineSlide } from './VendorBillInlineSlide';

// Values the backend's PaymentOut.mode accepts.
const PAYMENT_MODES = [
  { value: 'Bank Transfer', label: 'Bank Transfer (NEFT/RTGS)' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Cash', label: 'Cash' },
];

const STAGE_BADGES = {
  matching_required: 'bg-amber-50 text-amber-700 border-amber-200',
  matched: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  mismatch: 'bg-rose-50 text-rose-700 border-rose-200',
  approval_pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partially_paid: 'bg-amber-100 text-amber-800 border-amber-300',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
};

function formatIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function apiMessage(err, fallback) {
  const fieldErrors = err?.payload?.field_errors;
  const firstField = fieldErrors && Object.values(fieldErrors)[0];
  return err?.payload?.message || (Array.isArray(firstField) ? firstField[0] : firstField) || err?.message || fallback;
}

function InfoCell({ label, value }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
      <span className="text-[10px] text-slate-500 block uppercase font-medium">{label}</span>
      <span className="text-xs font-bold text-slate-900 mt-0.5 block">{value}</span>
    </div>
  );
}

export function PayVendorBillModal({ po, onClose, onBillUpdated }) {
  const { showToast, refreshCollections } = useERP() || {};

  const poId = po?.id;
  const poNumber = po?.poNumber || po?.po_number || poId;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [poDetails, setPoDetails] = useState(null);

  const [isCreatingBill, setIsCreatingBill] = useState(false);

  // Expanded lines per bill: { [billId]: boolean }
  const [expandedBills, setExpandedBills] = useState({});

  // Review Bill Matching: id of the bill under review and its comparison
  const [reviewBillId, setReviewBillId] = useState(null);
  const [reviewMatching, setReviewMatching] = useState(null);
  const [reviewingBillId, setReviewingBillId] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Pay Vendor form: bill object or null
  const [payBill, setPayBill] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES[0].value);
  const [bankAccountId, setBankAccountId] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [paymentRef, setPaymentRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [payError, setPayError] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);
  // One key per opened form: a retry replays the first voucher, never a second.
  const payKeyRef = useRef(null);

  const loadPoData = useCallback(async () => {
    if (!poId) return;
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get(`/purchase/vendor-bills/po-details/?poId=${poId}`);
      setPoDetails(res?.data || res);
    } catch (err) {
      console.error('Failed to load PO details for vendor billing:', err);
      setPoDetails(null);
      setErrorMsg(apiMessage(err, 'Failed to load vendor bills from the server.'));
    } finally {
      setLoading(false);
    }
  }, [poId]);

  const loadBankAccounts = useCallback(async () => {
    try {
      const res = await api.get('/accounts/bank-accounts/?page_size=100');
      const rows = Array.isArray(res) ? res : res?.results || res?.data || [];
      setBankAccounts(rows);
      if (rows.length > 0) setBankAccountId(rows[0].id);
    } catch (err) {
      console.warn('Failed to load bank accounts:', err);
    }
  }, []);

  useEffect(() => {
    loadPoData();
    loadBankAccounts();
  }, [loadPoData, loadBankAccounts]);

  const vendor = poDetails?.vendor || {};
  const poSummary = poDetails?.poSummary || {};
  const bills = poDetails?.bills || [];
  const batches = poDetails?.batches || [];
  const reviewBill = bills.find((b) => b.id === reviewBillId) || null;
  const reviewActions = reviewBill?.workflow?.actions || [];
  const reviewIsMismatch = reviewMatching?.overallStatus === 'Mismatch';

  const notifyChanged = () => {
    if (typeof onBillUpdated === 'function') onBillUpdated();
    if (typeof refreshCollections === 'function') {
      refreshCollections(['purchaseOrders', 'purchaseBills', 'vendorBills']);
    }
  };

  const toggleBillExpanded = (id) => {
    setExpandedBills((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const closeReview = () => {
    setReviewBillId(null);
    setReviewMatching(null);
    setReviewError('');
    setApprovalRemarks('');
    setRejectReason('');
  };

  // Runs the comparison on the server, which also records the bill's match status.
  const handleReviewMatching = async (bill) => {
    if (reviewingBillId) return;
    try {
      setReviewingBillId(bill.id);
      setErrorMsg('');
      const result = await api.post(`/purchase/vendor-bills/${bill.id}/recheck-matching/`, {});
      setReviewMatching(result?.data || result);
      setReviewBillId(bill.id);
      setReviewError('');
      await loadPoData();
      notifyChanged();
    } catch (err) {
      console.error('Matching review failed:', err);
      setErrorMsg(apiMessage(err, 'Could not compare this bill with the purchase order.'));
    } finally {
      setReviewingBillId(null);
    }
  };

  const handleApproveBill = async () => {
    if (!reviewBill || submittingReview) return;
    if (reviewIsMismatch && !approvalRemarks.trim()) {
      setReviewError('Enter approval remarks explaining the variance.');
      return;
    }
    try {
      setSubmittingReview(true);
      setReviewError('');
      await api.post(`/purchase/vendor-bills/${reviewBill.id}/approve/`, {
        remarks: approvalRemarks.trim(),
        createPayable: true,
      });
      showToast?.(`Vendor bill ${reviewBill.vendorBillNumber} approved.`);
      closeReview();
      await loadPoData();
      notifyChanged();
    } catch (err) {
      console.error('Approval failed:', err);
      // The approval request is open now, so the bill's state has moved on.
      if (err?.payload?.code === 'APPROVAL_REQUIRED') await loadPoData();
      setReviewError(apiMessage(err, 'Failed to approve vendor bill.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleRejectBill = async () => {
    if (!reviewBill || submittingReview) return;
    if (!rejectReason.trim()) {
      setReviewError('Enter a reason for rejecting this vendor bill.');
      return;
    }
    try {
      setSubmittingReview(true);
      setReviewError('');
      await api.post(`/purchase/vendor-bills/${reviewBill.id}/reject/`, { remarks: rejectReason.trim() });
      showToast?.(`Vendor bill ${reviewBill.vendorBillNumber} rejected.`);
      closeReview();
      await loadPoData();
      notifyChanged();
    } catch (err) {
      console.error('Rejection failed:', err);
      setReviewError(apiMessage(err, 'Failed to reject vendor bill.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleOpenPay = (bill) => {
    setPayBill(bill);
    setPayAmount(Number(bill.outstandingAmount || 0).toFixed(2));
    setPaymentRef('');
    setPayRemarks('');
    setPayError('');
    setPaymentMode(PAYMENT_MODES[0].value);
    payKeyRef.current = newIdempotencyKey();
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!payBill || submittingPay) return;

    const amt = parseFloat(payAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      setPayError('Enter a payment amount greater than 0.');
      return;
    }
    if (amt > Number(payBill.outstandingAmount || 0)) {
      setPayError(`Amount cannot exceed the outstanding ₹${formatIN(payBill.outstandingAmount)}.`);
      return;
    }
    if (paymentMode !== 'Cash' && !bankAccountId) {
      setPayError('Choose the bank account this payment is made from.');
      return;
    }

    try {
      setSubmittingPay(true);
      setPayError('');
      await api.post(
        `/purchase/vendor-bills/${payBill.id}/pay/`,
        {
          amount: amt,
          mode: paymentMode,
          bankAccountId: paymentMode === 'Cash' ? undefined : bankAccountId,
          reference: paymentRef.trim() || undefined,
          remarks: payRemarks.trim() || undefined,
        },
        { idempotencyKey: payKeyRef.current },
      );
      showToast?.(`Payment of ₹${formatIN(amt)} recorded for ${payBill.vendorBillNumber}.`);
      setPayBill(null);
      await loadPoData();
      notifyChanged();
    } catch (err) {
      console.error('Vendor payment failed:', err);
      setPayError(apiMessage(err, 'Payment failed.'));
      // A refused key is spent: a corrected attempt is a new request.
      payKeyRef.current = newIdempotencyKey();
    } finally {
      setSubmittingPay(false);
    }
  };

  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Vendor Linked to Selected PO</span>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            {vendor.vendorCode}
          </span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">{vendor.vendorName}</h3>
            <div className="text-xs text-slate-500 mt-1 space-y-0.5">
              <div>GSTIN: <span className="font-semibold text-slate-700">{vendor.vendorGstin}</span></div>
              <div>Contact: <span className="font-medium text-slate-700">{vendor.contactPerson}</span></div>
              <div>Phone: <span className="font-medium text-slate-700">{vendor.phone}</span></div>
              <div className="text-[11px] text-slate-400 truncate max-w-xs">{vendor.billingAddress}</div>
            </div>
          </div>
          <div className="text-right pl-3 border-l border-slate-100 min-w-[140px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Outstanding on this PO</span>
            <span className="text-base font-extrabold text-rose-600 block mt-0.5">₹{formatIN(poSummary.totalOutstandingAmount)}</span>
            <span className="text-[10px] text-slate-400">From linked bills</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">PO Commercial Baseline</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Expected Rate: <strong className="text-slate-800">₹{formatIN(poSummary.originalPoRate)}/m</strong>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <InfoCell label="Ordered Qty" value={`${formatIN(poSummary.orderedQty)} m`} />
          <InfoCell label="Received Qty" value={`${formatIN(poSummary.receivedQty)} m`} />
          <InfoCell label="Billed Qty" value={`${formatIN(poSummary.previouslyBilledQty)} m`} />
          <InfoCell label="Unbilled Qty" value={`${formatIN(poSummary.remainingBillableQty)} m`} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-600">
          <div>PO Amount: <strong className="text-slate-800">₹{formatIN(poSummary.originalPoAmount)}</strong></div>
          <div className="flex items-center gap-2">
            <span>Billed: <strong className="text-indigo-700">₹{formatIN(poSummary.totalBilledAmount)}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Paid: <strong className="text-emerald-700">₹{formatIN(poSummary.totalPaidAmount)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBillRequired = () => (
    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-10 shadow-sm">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Receipt size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Vendor Bill Required</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          No vendor bill has been created for this Purchase Order. Please create the vendor bill manually before proceeding with matching, approval, or payment.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl mx-auto mb-6">
        <InfoCell label="PO Number" value={poSummary.poNumber} />
        <InfoCell label="Vendor Name" value={poSummary.vendorName} />
        <InfoCell label="Fabric" value={poSummary.fabricQuality} />
        <InfoCell label="Ordered Quantity" value={`${formatIN(poSummary.orderedQty)} m`} />
        <InfoCell label="Received Quantity" value={`${formatIN(poSummary.receivedQty)} m`} />
        <InfoCell label="PO Expected Rate" value={`₹${formatIN(poSummary.originalPoRate)}/m`} />
        <InfoCell label="PO Expected Amount" value={`₹${formatIN(poSummary.originalPoAmount)}`} />
      </div>

      <div className="text-center">
        <button
          onClick={() => setIsCreatingBill(true)}
          disabled={!poSummary.canCreateBill}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          <span>Create Vendor Bill</span>
        </button>
        {poSummary.createBlockedReason && (
          <p className="text-xs text-amber-700 mt-3">{poSummary.createBlockedReason}</p>
        )}
      </div>
    </div>
  );

  const renderBillRow = (bill) => {
    const isExpanded = Boolean(expandedBills[bill.id]);
    const workflow = bill.workflow || { actions: [] };
    const can = (action) => workflow.actions.includes(action);

    return (
      <div key={bill.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-colors">
        <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <Receipt size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-slate-900">{bill.vendorBillNumber}</span>
                <span className="text-xs text-slate-400">{bill.billDate}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STAGE_BADGES[workflow.stage] || STAGE_BADGES.draft}`}>
                  {workflow.label}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-x-4 gap-y-0.5 flex-wrap">
                <span>Vendor: <strong className="text-slate-800">{bill.vendorName}</strong></span>
                <span>PO: <strong className="text-slate-800">{bill.poNumber}</strong></span>
                <span>Quantity: <strong className="text-slate-800">{formatIN(bill.billQuantity)} m</strong></span>
                <span>Bill Amount: <strong className="text-slate-900">₹{formatIN(bill.billAmount)}</strong></span>
                <span>Paid: <strong className="text-emerald-700">₹{formatIN(bill.amountPaid)}</strong></span>
                <span>Outstanding: <strong className={bill.outstandingAmount > 0 ? 'text-rose-600' : 'text-slate-500'}>₹{formatIN(bill.outstandingAmount)}</strong></span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-x-4 flex-wrap">
                <span>Matching: <strong className="text-slate-700">{bill.matchingStatus}</strong></span>
                <span>Approval: <strong className="text-slate-700">{bill.approvalStatus}</strong></span>
                <span>Payment: <strong className="text-slate-700">{bill.paymentStatus}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
            <button
              onClick={() => toggleBillExpanded(bill.id)}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{isExpanded ? 'Hide Bill' : 'View Bill'}</span>
            </button>
            {can('review') && (
              <button
                onClick={() => handleReviewMatching(bill)}
                disabled={Boolean(reviewingBillId)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {reviewingBillId === bill.id ? <RefreshCw size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                <span>{can('approve') ? 'Review & Approve' : 'Review Bill Matching'}</span>
              </button>
            )}
            {can('pay') && (
              <button
                onClick={() => handleOpenPay(bill)}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 rounded-lg flex items-center gap-1.5 transition-all"
              >
                <IndianRupee size={14} />
                <span>Pay Vendor</span>
              </button>
            )}
            {workflow.stage === 'paid' && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 px-2 py-1">
                <CheckCircle2 size={14} /> Paid
              </span>
            )}
            {workflow.stage === 'approval_pending' && (
              <span className="text-xs font-semibold text-amber-700 flex items-center gap-1 px-2 py-1" title="Waiting in the approvals inbox">
                <Clock size={14} /> In approvals inbox
              </span>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-slate-100 p-4 bg-slate-50/70 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Billed Lines (Actual vs PO Rate)
            </h4>
            {bill.lines.length === 0 ? (
              <p className="text-xs text-slate-400 italic">This bill has no lines.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-2 px-3">Batch / GRN</th>
                      <th className="py-2 px-3">Fabric</th>
                      <th className="py-2 px-3 text-right">Billed Qty</th>
                      <th className="py-2 px-3 text-right">PO Rate</th>
                      <th className="py-2 px-3 text-right">Bill Rate</th>
                      <th className="py-2 px-3 text-right">Line Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {bill.lines.map((ln) => (
                      <tr key={ln.lineNo} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-mono font-medium text-slate-900">
                          {[ln.batchCode, ln.grnNumber].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="py-2 px-3">{ln.itemName || '—'}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatIN(ln.qty)} m</td>
                        <td className="py-2 px-3 text-right text-slate-500">₹{formatIN(ln.poRate)}</td>
                        <td className={`py-2 px-3 text-right font-bold ${ln.rate === ln.poRate ? 'text-slate-900' : 'text-rose-600'}`}>
                          ₹{formatIN(ln.rate)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">₹{formatIN(ln.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-0.5">
              <span>Subtotal: <strong>₹{formatIN(bill.subtotal)}</strong></span>
              <span>GST ({formatIN(bill.gstPct)}%): <strong>₹{formatIN(bill.gstAmount)}</strong></span>
              {bill.otherCharges > 0 && <span>Other charges: <strong>₹{formatIN(bill.otherCharges)}</strong></span>}
              {bill.attachmentName && <span>Attachment: <strong>{bill.attachmentName}</strong></span>}
              {bill.purchaseBillNumber && <span>Payable: <strong>{bill.purchaseBillNumber}</strong></span>}
              {bill.remarks && <span>Remarks: <strong>{bill.remarks}</strong></span>}
              {bill.approvalRemarks && <span>Decision note: <strong>{bill.approvalRemarks}</strong></span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-slate-800">

        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <CreditCard size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Pay Vendor Bill Workspace</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {poSummary.poNumber || poNumber}
                </span>
                {poSummary.fabricQuality && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50">
                    {poSummary.fabricQuality}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Bills linked to this purchase order, with the next step each one allows.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            title="Close workspace"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50/50">
          {errorMsg && poDetails && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading && !poDetails ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
              <RefreshCw className="animate-spin text-emerald-600" size={32} />
              <p className="text-sm font-medium">Checking vendor bills for this purchase order...</p>
            </div>
          ) : !poDetails ? (
            /* No answer from the server is not the same as "no bills". */
            <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <AlertTriangle size={28} className="text-rose-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">Could not check vendor bills</h3>
              <p className="text-xs text-slate-500 mb-4">{errorMsg}</p>
              <button
                onClick={loadPoData}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RefreshCw size={14} />
                <span>Try Again</span>
              </button>
            </div>
          ) : isCreatingBill ? (
            <VendorBillInlineSlide
              po={po}
              createOnly
              poSummary={poSummary}
              vendor={vendor}
              billableLines={batches}
              onClose={() => setIsCreatingBill(false)}
              onBillSaved={async () => {
                setIsCreatingBill(false);
                await loadPoData();
                notifyChanged();
              }}
            />
          ) : bills.length === 0 ? (
            renderBillRequired()
          ) : (
            <>
              {renderSummaryCards()}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt size={18} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">Linked Vendor Bills ({bills.length})</h3>
                  </div>
                  {poSummary.canCreateBill && (
                    <button
                      onClick={() => setIsCreatingBill(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    >
                      <Plus size={14} />
                      <span>Create Another Bill</span>
                    </button>
                  )}
                </div>
                <div className="space-y-3">{bills.map(renderBillRow)}</div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            PO Status: <strong className="text-slate-800">{po?.status || '—'}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close Workspace
          </button>
        </div>
      </div>

      {/* ── Pay Vendor ── */}
      {payBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <IndianRupee size={18} className="text-emerald-600" />
                <span>Pay Vendor</span>
              </h3>
              <button onClick={() => setPayBill(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Vendor:</span>
                  <span className="font-bold text-slate-800">{payBill.vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bill Reference:</span>
                  <span className="font-bold text-slate-800">{payBill.vendorBillNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bill Total:</span>
                  <span className="font-semibold text-slate-800">₹{formatIN(payBill.billAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Already Paid:</span>
                  <span className="font-semibold text-emerald-700">₹{formatIN(payBill.amountPaid)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                  <span className="font-bold text-slate-900">Outstanding:</span>
                  <span className="font-extrabold text-rose-600">₹{formatIN(payBill.outstandingAmount)}</span>
                </div>
              </div>

              {payError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                  <span>{payError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Full or partial payment, up to the outstanding balance.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {paymentMode !== 'Cash' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account *</label>
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {bankAccounts.length === 0 && <option value="">No bank accounts found</option>}
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.bank_name} {b.account_number ? `(${b.account_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Reference / UTR Number</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-2026-HDFC-998822"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Narration / Remarks</label>
                <input
                  type="text"
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayBill(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPay}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingPay ? <RefreshCw className="animate-spin" size={14} /> : <IndianRupee size={14} />}
                  <span>{submittingPay ? 'Recording Payment...' : 'Record Payment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Review Bill Matching ── */}
      {reviewBill && reviewMatching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className={`px-5 py-4 border-b border-slate-200 flex items-center justify-between ${reviewIsMismatch ? 'bg-amber-50/60' : 'bg-emerald-50/60'}`}>
              <h3 className={`text-base font-bold flex items-center gap-2 ${reviewIsMismatch ? 'text-amber-900' : 'text-emerald-900'}`}>
                {reviewIsMismatch ? <ShieldAlert size={20} className="text-amber-600" /> : <CheckCircle2 size={20} className="text-emerald-600" />}
                <span>{reviewIsMismatch ? 'Mismatch — Approval Required' : 'Matched'}</span>
                <span className="text-xs font-semibold text-slate-500">{reviewBill.vendorBillNumber}</span>
              </h3>
              <button onClick={closeReview} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Fabric</th>
                      <th className="py-2.5 px-3 text-right">PO Ordered</th>
                      <th className="py-2.5 px-3 text-right">Received</th>
                      <th className="py-2.5 px-3 text-right">Prev. Billed</th>
                      <th className="py-2.5 px-3 text-right">Bill Qty</th>
                      <th className="py-2.5 px-3 text-right">PO Rate</th>
                      <th className="py-2.5 px-3 text-right">Bill Rate</th>
                      <th className="py-2.5 px-3 text-right">PO Amount</th>
                      <th className="py-2.5 px-3 text-right">Bill Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {(reviewMatching.lines || []).map((line) => (
                      <tr key={line.lineNo}>
                        <td className="py-2 px-3 font-medium">{line.fabric || '—'}</td>
                        <td className="py-2 px-3 text-right">{formatIN(line.poQty)}</td>
                        <td className="py-2 px-3 text-right">{formatIN(line.grnQty)}</td>
                        <td className="py-2 px-3 text-right">{formatIN(line.previouslyBilledQty)}</td>
                        <td className={`py-2 px-3 text-right font-bold ${line.qtyMatch ? '' : 'text-rose-600'}`}>{formatIN(line.billQty)}</td>
                        <td className="py-2 px-3 text-right">₹{formatIN(line.poRate)}</td>
                        <td className={`py-2 px-3 text-right font-bold ${line.rateMatch ? '' : 'text-rose-600'}`}>₹{formatIN(line.billRate)}</td>
                        <td className="py-2 px-3 text-right">₹{formatIN(line.poAmount)}</td>
                        <td className={`py-2 px-3 text-right font-bold ${line.amountMatch ? '' : 'text-rose-600'}`}>₹{formatIN(line.billAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(reviewMatching.reasons || []).length > 0 && (
                <ul className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1 list-disc list-inside">
                  {reviewMatching.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              )}

              {reviewError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                  <span>{reviewError}</span>
                </div>
              )}

              {reviewBill.workflow.stage === 'approval_pending' && (
                <p className="text-amber-800 font-medium">
                  This mismatch is waiting in the approvals inbox. Once accounts management approves it, open this review and approve the bill.
                </p>
              )}

              {reviewActions.includes('approve') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Approval Remarks {reviewIsMismatch ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Rejection Reason (if rejecting)</label>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={closeReview}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Close
                </button>
                {reviewActions.includes('approve') && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRejectBill}
                      disabled={submittingReview}
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow disabled:opacity-50 flex items-center gap-1"
                    >
                      <Ban size={14} />
                      <span>Reject Bill</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApproveBill}
                      disabled={submittingReview}
                      className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow disabled:opacity-50 flex items-center gap-1"
                    >
                      <ShieldCheck size={14} />
                      <span>{reviewIsMismatch ? 'Approve Mismatch' : 'Approve Bill'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
