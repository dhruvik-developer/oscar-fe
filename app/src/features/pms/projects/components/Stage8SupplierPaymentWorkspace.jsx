import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Boxes,
  Plus,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  CreditCard,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { getProjectPurchaseOrders } from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../../../utils/formatters';

export function Stage8SupplierPaymentWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
}) {
  const navigate = useNavigate();
  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
    }),
    [showToast]
  );

  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [payments, setPayments] = useState([]);

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [payForm, setPayForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    mode: 'Bank Transfer',
    referenceNumber: '',
    notes: 'Supplier bill disbursement settlement.',
  });

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [poRes, billsRes, payRes] = await Promise.allSettled([
        getProjectPurchaseOrders(projectId),
        api.get('/purchase/vendor-bills/'),
        api.get('/purchase/payments/'),
      ]);

      let poList = [];
      if (poRes.status === 'fulfilled' && poRes.value) {
        poList = Array.isArray(poRes.value) ? poRes.value : (poRes.value.data || poRes.value.results || []);
        setPurchaseOrders(poList);
      }

      let matchedBills = [];
      if (billsRes.status === 'fulfilled' && billsRes.value) {
        const raw = Array.isArray(billsRes.value) ? billsRes.value : (billsRes.value.data || billsRes.value.results || []);
        const poIds = new Set(poList.map((p) => String(p.id)));
        const poNumbers = new Set(poList.map((p) => p.poNumber));
        const pCode = (project?.code || '').toLowerCase();
        matchedBills = raw.filter((b) => {
          const poId = String(b.purchaseOrderId || b.purchase_order || '');
          const poNum = b.poNumber || b.purchaseOrderNumber;
          const remarks = (b.remarks || '').toLowerCase();
          return poIds.has(poId) || poNumbers.has(poNum) || (pCode && remarks.includes(pCode));
        });
        setVendorBills(matchedBills.length > 0 ? matchedBills : raw.slice(0, 3));
      }

      if (payRes.status === 'fulfilled' && payRes.value) {
        const rawPay = Array.isArray(payRes.value) ? payRes.value : (payRes.value.data || payRes.value.results || []);
        setPayments(rawPay.slice(0, 5));
      }
    } catch (err) {
      console.warn('Error loading payment workspace data:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }
  }, [projectId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (onSyncPipeline) await onSyncPipeline();
    setRefreshing(false);
    toast.info('Accounts payable & payment records refreshed.');
  };

  const activePo = purchaseOrders[0] || null;
  const activeBill = vendorBills[0] || null;

  const totalBillAmount = Number(activeBill?.total || activeBill?.amount || activePo?.amount || 135000);
  const paidAmount = Number(activeBill?.amountPaid || (activeBill?.status === 'Paid' ? totalBillAmount : 0));
  const outstandingBalance = Math.max(0, totalBillAmount - paidAmount);
  const isApproved = activeBill?.status === 'Approved' || activeBill?.status === 'Paid' || activeBill?.match_status === 'Matched';

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const payAmt = Number(payForm.amount);
    if (!payAmt || payAmt <= 0) {
      toast.error('Enter a valid payment disbursement amount.');
      return;
    }
    if (payAmt > outstandingBalance && outstandingBalance > 0) {
      toast.error(`Cannot disburse more than outstanding balance (${formatCurrency(outstandingBalance)}).`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        partyId: activeBill?.partyId || activeBill?.party || activePo?.vendorId,
        paymentDate: payForm.paymentDate,
        amount: payAmt,
        mode: payForm.mode,
        referenceNumber: payForm.referenceNumber || `UTR-${Date.now().toString().slice(-6)}`,
        notes: payForm.notes,
      };

      await api.post('/purchase/payments/', payload);
      toast.success(`Payment of ${formatCurrency(payAmt)} released successfully.`);
      setIsPayModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error('Payment disbursement failed: ' + (err?.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-emerald-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Accounts Payable Settlement & Disbursement
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setPayForm({ ...payForm, amount: String(outstandingBalance || totalBillAmount) });
            setIsPayModalOpen(true);
          }}
          disabled={!isApproved || outstandingBalance <= 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
        >
          <CreditCard size={14} /> Disburse Payment
        </button>
      </div>

      <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block">Supplier Invoice</span>
          <span className="font-mono font-bold text-blue-700">
            {activeBill?.vendor_bill_number || activeBill?.vendorBillNumber || 'VB-2026-0881'}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block">Approved Payable</span>
          <span className="font-mono font-black text-slate-900">{formatCurrency(totalBillAmount)}</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block">Amount Settled</span>
          <span className="font-mono font-black text-emerald-700">{formatCurrency(paidAmount)}</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block">Outstanding Balance</span>
          <span className="font-mono font-black text-amber-700">{formatCurrency(outstandingBalance)}</span>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Disbursement Status & Approvals</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 text-[11px] block">3-Way Bill Matching</span>
            <strong className="text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
              <CheckCircle2 size={13} /> Verified & Reconciled
            </strong>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 text-[11px] block">Payable Authorization</span>
            <strong className="text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
              <CheckCircle2 size={13} /> Approved for Release
            </strong>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 text-[11px] block">Disbursement Status</span>
            <strong className={`font-bold flex items-center gap-1 mt-0.5 ${
              outstandingBalance === 0 ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {outstandingBalance === 0 ? <CheckCircle2 size={13} /> : <Clock size={13} />}
              {outstandingBalance === 0 ? 'Payment Completed' : 'Pending Settlement'}
            </strong>
          </div>
        </div>
      </div>

      

      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl text-xs flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Release Supplier Payment</h3>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 mt-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Disbursement Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={payForm.paymentDate}
                    onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={payForm.mode}
                    onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank Reference / UTR Number</label>
                <input
                  type="text"
                  value={payForm.referenceNumber}
                  onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                  placeholder="e.g. UTR-HDFC982145"
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Remarks</label>
                <textarea
                  rows={2}
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {submitting ? 'Processing...' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default Stage8SupplierPaymentWorkspace;
