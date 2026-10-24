import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  IndianRupee,
  Layers,
  MapPin,
  Package,
  Percent,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  fetchStage17InvoiceData,
  createStage17Proforma,
  convertStage17Proforma,
  cancelStage17Proforma,
  createStage17FinalInvoice,
  recordStage17Payment,
  errorMessage,
} from '../../../../services/jobWorkSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_PILL = {
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-200',
  Unpaid: 'bg-rose-50 text-rose-700 border-rose-200',
  Issued: 'bg-blue-50 text-blue-700 border-blue-200',
  Converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function Stage17InvoicePaymentWorkspace({
  project,
  stage,
  onUpdated,
  onSelectStage,
  totalStages = 18,
}) {
  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
      warning: (msg) => showToast?.(msg, 'warning'),
    }),
    [showToast]
  );

  const code = project?.code || '';
  const projectId = project?.id;
  const stageSeq = stage?.sequence || 17;
  const stageName = stage?.name || 'Stage 17 — Invoice & Payment Collection';

  // Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workspaceData, setWorkspaceData] = useState(null);

  // Tab navigation: proformas | finalInvoices | payments | audit | handover
  const [activeTab, setActiveTab] = useState('proformas');

  // Search & filter states
  const [piSearch, setPiSearch] = useState('');
  const [piStatusFilter, setPiStatusFilter] = useState('ALL');
  const [invSearch, setInvSearch] = useState('');
  const [invStatusFilter, setInvStatusFilter] = useState('ALL');
  const [paySearch, setPaySearch] = useState('');

  // Modals state
  const [isProformaModalOpen, setIsProformaModalOpen] = useState(false);
  const [isFinalInvoiceModalOpen, setIsFinalInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active document for printable modal
  const [printDoc, setPrintDoc] = useState(null); // { type: 'PROFORMA' | 'INVOICE' | 'RECEIPT', data: ... }

  // Form states: Create Proforma
  const [piDocDate, setPiDocDate] = useState(todayISO());
  const [piValidUntil, setPiValidUntil] = useState('');
  const [piChallanId, setPiChallanId] = useState('');
  const [piQty, setPiQty] = useState('');
  const [piRate, setPiRate] = useState('150');
  const [piTaxPct, setPiTaxPct] = useState('5');
  const [piNotes, setPiNotes] = useState('Commercial proforma for customer approval & advance');

  // Form states: Create Direct Final Invoice
  const [invDocDate, setInvDocDate] = useState(todayISO());
  const [invChallanId, setInvChallanId] = useState('');
  const [invQty, setInvQty] = useState('');
  const [invRate, setInvRate] = useState('150');
  const [invTaxPct, setInvTaxPct] = useState('5');
  const [invNotes, setInvNotes] = useState('GST Tax Invoice against Stage 16 Delivery Challan');

  // Form states: Record Payment
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Bank');
  const [payBankAccountId, setPayBankAccountId] = useState('');
  const [payReferenceNo, setPayReferenceNo] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Load Stage 17 workspace data from backend
  const loadWorkspaceData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchStage17InvoiceData(projectId);
      setWorkspaceData(res);
      // Pre-select first bank if available
      if (res?.bankAccounts?.length > 0 && !payBankAccountId) {
        setPayBankAccountId(res.bankAccounts[0].id);
      }
    } catch (err) {
      console.error('Failed to load Stage 17 Invoice & Payment data:', err);
      setError(errorMessage(err, 'Failed to load Invoice & Payment workspace data.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, payBankAccountId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Extract structured data with robust fallbacks
  const summary = workspaceData?.summary || {
    targetRequirementMeters: Number(project?.requirement_meters || project?.quantity || 3000),
    totalDispatchedQty: 0,
    totalProformaAmount: 0,
    totalFinalInvoiceAmount: 0,
    totalPaymentReceived: 0,
    totalOutstandingBalance: 0,
    invoicedQuantity: 0,
    pendingInvoicingQty: 0,
    uom: 'Meters',
  };

  const customer = workspaceData?.customer || {
    id: null,
    name: project?.customer_name || 'Customer',
    shippingAddress: '',
    gstin: '',
    phone: '',
    currentBalance: 0,
  };

  const salesOrder = workspaceData?.salesOrder || {
    id: null,
    orderNumber: '—',
    orderDate: '—',
    stage: '—',
    total: 0,
  };

  const dispatches = useMemo(() => workspaceData?.dispatches || [], [workspaceData]);
  const proformas = useMemo(() => workspaceData?.proformas || [], [workspaceData]);
  const finalInvoices = useMemo(() => workspaceData?.finalInvoices || [], [workspaceData]);
  const payments = useMemo(() => workspaceData?.payments || [], [workspaceData]);
  const bankAccounts = useMemo(() => workspaceData?.bankAccounts || [], [workspaceData]);

  const targetReq = summary.targetRequirementMeters || 3000;
  const dispatchedQty = summary.totalDispatchedQty || 0;
  const invoicedQty = summary.invoicedQuantity || 0;
  const totalBilled = summary.totalFinalInvoiceAmount || 0;
  const totalCollected = summary.totalPaymentReceived || 0;
  const outstandingBal = summary.totalOutstandingBalance || 0;

  // Percentage calculations
  const billingFulfillmentPct = dispatchedQty > 0
    ? Math.min(100, Math.round((invoicedQty / dispatchedQty) * 100))
    : 0;

  const collectionPct = totalBilled > 0
    ? Math.min(100, Math.round((totalCollected / totalBilled) * 100))
    : 100;

  // Stage overall status
  const currentStatus = useMemo(() => {
    if (totalBilled > 0 && outstandingBal <= 0 && invoicedQty >= (dispatchedQty || targetReq)) {
      return 'Completed';
    }
    if (totalBilled > 0 && outstandingBal <= 0) {
      return 'Partially Invoiced & Settled';
    }
    if (totalBilled > 0 && totalCollected > 0) {
      return 'Partially Paid';
    }
    if (totalBilled > 0) {
      return 'Invoiced (Pending Payment)';
    }
    if (proformas.length > 0) {
      return 'Proforma Issued';
    }
    return 'Pending Invoicing';
  }, [totalBilled, outstandingBal, invoicedQty, dispatchedQty, targetReq, totalCollected, proformas]);

  // Pre-fill quantities when opening modals
  const handleOpenProformaModal = () => {
    const unbilled = Math.max(0, dispatchedQty - invoicedQty);
    setPiQty(String(unbilled > 0 ? unbilled : 100));
    setPiChallanId(dispatches[0]?.id || '');
    setIsProformaModalOpen(true);
  };

  const handleOpenDirectInvoiceModal = () => {
    const unbilled = Math.max(0, dispatchedQty - invoicedQty);
    setInvQty(String(unbilled > 0 ? unbilled : 100));
    setInvChallanId(dispatches[0]?.id || '');
    setIsFinalInvoiceModalOpen(true);
  };

  const handleOpenPaymentModal = (invoice = null) => {
    const inv = invoice || finalInvoices.find((i) => i.outstandingBalance > 0) || finalInvoices[0];
    setSelectedInvoiceForPayment(inv || null);
    if (inv) {
      setPayAmount(String(inv.outstandingBalance || ''));
    } else {
      setPayAmount('');
    }
    setPayReferenceNo('');
    setPayNotes('');
    setIsPaymentModalOpen(true);
  };

  // Submit Proforma Creation
  const handleCreateProforma = async () => {
    const q = Number(piQty);
    const r = Number(piRate);
    if (!q || q <= 0) {
      toast.warning('Please enter a valid quantity greater than zero.');
      return;
    }
    if (!r || r <= 0) {
      toast.warning('Please enter a valid rate per meter.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doc_date: piDocDate,
        valid_until: piValidUntil || undefined,
        quantity: q,
        rate: r,
        tax_pct: Number(piTaxPct || 5),
        notes: piNotes.trim(),
        challan_id: piChallanId || undefined,
      };
      const res = await createStage17Proforma(projectId, payload);
      toast.success(`Proforma Invoice ${res.proforma_number || ''} issued successfully! (Total: ₹ ${n(res.total)})`);
      setIsProformaModalOpen(false);
      await loadWorkspaceData();
      onUpdated?.();
    } catch (err) {
      console.error('Failed to create proforma invoice:', err);
      toast.error(errorMessage(err, 'Failed to create Proforma Invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Convert Proforma to Final Invoice
  const handleConvertProforma = async (pi) => {
    if (!window.confirm(`Are you sure you want to convert Proforma ${pi.proformaNumber} into an official GST Tax Invoice? This will post to Accounts Receivable and update customer ledger balances.`)) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await convertStage17Proforma(projectId, pi.id, {
        override_credit_limit: true,
      });
      toast.success(`Tax Invoice ${res.invoice_number || ''} generated successfully from Proforma ${pi.proformaNumber}!`);
      await loadWorkspaceData();
      onUpdated?.();
      setActiveTab('finalInvoices');
    } catch (err) {
      console.error('Failed to convert proforma:', err);
      toast.error(errorMessage(err, 'Failed to convert Proforma Invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Proforma
  const handleCancelProforma = async (pi) => {
    const reason = window.prompt(`Enter reason for cancelling Proforma ${pi.proformaNumber}:`, 'Customer revised specifications');
    if (reason === null) return;

    setSubmitting(true);
    try {
      await cancelStage17Proforma(projectId, pi.id, reason);
      toast.success(`Proforma ${pi.proformaNumber} cancelled.`);
      await loadWorkspaceData();
      onUpdated?.();
    } catch (err) {
      console.error('Failed to cancel proforma:', err);
      toast.error(errorMessage(err, 'Failed to cancel Proforma Invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Direct Final Invoice Creation
  const handleCreateDirectInvoice = async () => {
    const q = Number(invQty);
    const r = Number(invRate);
    if (!q || q <= 0) {
      toast.warning('Please enter a valid quantity greater than zero.');
      return;
    }
    if (!r || r <= 0) {
      toast.warning('Please enter a valid rate per meter.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doc_date: invDocDate,
        quantity: q,
        rate: r,
        tax_pct: Number(invTaxPct || 5),
        notes: invNotes.trim(),
        challan_id: invChallanId || undefined,
        override_credit_limit: true,
      };
      const res = await createStage17FinalInvoice(projectId, payload);
      toast.success(`GST Tax Invoice ${res.invoice_number || ''} generated successfully! (Total: ₹ ${n(res.total)})`);
      setIsFinalInvoiceModalOpen(false);
      await loadWorkspaceData();
      onUpdated?.();
      setActiveTab('finalInvoices');
    } catch (err) {
      console.error('Failed to create direct invoice:', err);
      toast.error(errorMessage(err, 'Failed to create GST Tax Invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Payment Collection
  const handleRecordPayment = async () => {
    if (!selectedInvoiceForPayment) {
      toast.warning('Please select a target invoice to allocate payment against.');
      return;
    }
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast.warning('Please enter a valid payment amount greater than zero.');
      return;
    }
    const maxBal = Number(selectedInvoiceForPayment.outstandingBalance || 0);
    if (amt > maxBal + 0.05) {
      toast.error(`Payment amount (₹ ${n(amt)}) cannot exceed outstanding invoice balance (₹ ${n(maxBal)}).`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        invoice_id: selectedInvoiceForPayment.id,
        amount: amt,
        payment_date: payDate,
        mode: payMode,
        bank_account_id: payBankAccountId || undefined,
        reference_number: payReferenceNo.trim(),
        notes: payNotes.trim(),
      };
      const res = await recordStage17Payment(projectId, payload);
      toast.success(`Payment voucher ${res.payment_number || ''} recorded successfully! ₹ ${n(res.amount)} collected.`);
      setIsPaymentModalOpen(false);
      await loadWorkspaceData();
      onUpdated?.();
      setActiveTab('payments');
    } catch (err) {
      console.error('Failed to record payment:', err);
      toast.error(errorMessage(err, 'Failed to record payment.'));
    } finally {
      setSubmitting(false);
    }
  };

  // View & Print Documents
  const handleViewPrintDoc = (type, data) => {
    setPrintDoc({ type, data });
    setIsPrintModalOpen(true);
  };

  // Filtered lists
  const filteredProformas = useMemo(() => {
    return proformas.filter((pi) => {
      if (piStatusFilter !== 'ALL' && pi.status !== piStatusFilter) return false;
      if (piSearch.trim()) {
        const s = piSearch.toLowerCase();
        const num = (pi.proformaNumber || '').toLowerCase();
        const notes = (pi.notes || '').toLowerCase();
        return num.includes(s) || notes.includes(s);
      }
      return true;
    });
  }, [proformas, piStatusFilter, piSearch]);

  const filteredFinalInvoices = useMemo(() => {
    return finalInvoices.filter((inv) => {
      if (invStatusFilter !== 'ALL' && inv.status !== invStatusFilter) return false;
      if (invSearch.trim()) {
        const s = invSearch.toLowerCase();
        const num = (inv.invoiceNumber || '').toLowerCase();
        const ch = (inv.challanNumber || '').toLowerCase();
        const piNum = (inv.proformaNumber || '').toLowerCase();
        return num.includes(s) || ch.includes(s) || piNum.includes(s);
      }
      return true;
    });
  }, [finalInvoices, invStatusFilter, invSearch]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (paySearch.trim()) {
        const s = paySearch.toLowerCase();
        const num = (p.paymentNumber || '').toLowerCase();
        const inv = (p.invoiceNumber || '').toLowerCase();
        const ref = (p.referenceNumber || '').toLowerCase();
        return num.includes(s) || inv.includes(s) || ref.includes(s);
      }
      return true;
    });
  }, [payments, paySearch]);

  // Live modal math
  const piBaseAmt = Number(piQty || 0) * Number(piRate || 0);
  const piTaxAmt = piBaseAmt * (Number(piTaxPct || 0) / 100);
  const piTotalAmt = piBaseAmt + piTaxAmt;

  const invBaseAmt = Number(invQty || 0) * Number(invRate || 0);
  const invTaxAmt = invBaseAmt * (Number(invTaxPct || 0) / 100);
  const invTotalAmt = invBaseAmt + invTaxAmt;

  const payBalRemaining = selectedInvoiceForPayment
    ? Math.max(0, Number(selectedInvoiceForPayment.outstandingBalance || 0) - Number(payAmount || 0))
    : 0;

  return (
    <div className="space-y-6">
      {/* 1. LIFECYCLE HEADER (Matching Stage 11, Stage 15 & Stage 16 design) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                Stage {stageSeq} of {totalStages}
              </span>
              <span className="text-slate-400">•</span>
              <span className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                INVOICE_PAYMENT
              </span>
              <span className="text-slate-400">•</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  currentStatus === 'Completed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : currentStatus.includes('Partially')
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : currentStatus.includes('Invoiced')
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : currentStatus.includes('Proforma')
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {currentStatus}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {stageName}
              </h2>
              <span className="text-sm font-medium text-slate-500">
                ({code} — {customer.name})
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage Proforma Invoices, convert to GST Tax Invoices against Stage 16 Delivery Challans, post Accounts Receivable journal entries, and track settlement payment collections.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            

            <Button
              variant="outline"
              size="sm"
              onClick={loadWorkspaceData}
              disabled={loading}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Progress Bar & Key Context Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <User size={15} className="text-slate-400 shrink-0" />
            <div>
              <span className="text-slate-400">Customer:</span>{' '}
              <span className="font-semibold text-slate-800">{customer.name}</span>
              {customer.gstin && <span className="font-mono text-[11px] text-slate-500 ml-1">({customer.gstin})</span>}
              <div className="text-[11px] text-slate-500 mt-0.5">
                Current AR Ledger: <span className="font-mono font-bold text-slate-800">₹ {n(customer.currentBalance)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <FileText size={15} className="text-slate-400 shrink-0" />
            <div>
              <span className="text-slate-400">Order Reference:</span>{' '}
              <span className="font-semibold text-slate-800">{salesOrder.orderNumber}</span>
              {salesOrder.orderDate !== '—' && (
                <span className="text-[11px] text-slate-500 ml-1">({salesOrder.orderDate})</span>
              )}
              <div className="text-[11px] text-slate-500 mt-0.5">
                Dispatched Fabric: <span className="font-mono font-bold text-slate-800">{n(dispatchedQty)} M</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-600">Commercial Settlement</span>
              <span className="font-mono font-bold text-slate-900">{collectionPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  collectionPct === 100 ? 'bg-emerald-600' : 'bg-purple-600'
                }`}
                style={{ width: `${collectionPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 text-right">
              Collected: <span className="font-semibold text-emerald-700">₹ {n(totalCollected)}</span> of <span className="font-semibold text-slate-800">₹ {n(totalBilled)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY KPI CARDS (5 Cards matching Stage 11 & Stage 16 design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Dispatched Qty */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold text-slate-600">Total Dispatched</span>
            <Truck size={17} />
          </div>
          <div className="text-xl font-bold font-mono text-blue-700">
            {n(dispatchedQty)} <span className="text-xs font-normal text-slate-500">M</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Stage 16 DC</span>
            <span className="font-medium text-blue-600">{n(summary.pendingInvoicingQty)} M pending</span>
          </div>
        </div>

        {/* Card 2: Total Proforma Value */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between text-teal-600 mb-1">
            <span className="text-xs font-semibold text-slate-600">Proforma Invoiced</span>
            <FileSpreadsheet size={17} />
          </div>
          <div className="text-xl font-bold font-mono text-teal-700">
            ₹ {n(summary.totalProformaAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{proformas.length} Proformas</span>
            <span className="font-medium text-teal-600">No AR Post</span>
          </div>
        </div>

        {/* Card 3: Final Tax Invoices */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-purple-300 transition-colors">
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-xs font-semibold text-slate-600">Final Tax Invoices</span>
            <FileText size={17} />
          </div>
          <div className="text-xl font-bold font-mono text-purple-700">
            ₹ {n(totalBilled)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{finalInvoices.length} Invoices</span>
            <span className="font-medium text-purple-600">{n(invoicedQty)} M Billed</span>
          </div>
        </div>

        {/* Card 4: Payments Received */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold text-slate-600">Payment Collected</span>
            <CheckCircle2 size={17} />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">
            ₹ {n(totalCollected)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{payments.length} Vouchers</span>
            <span className="font-medium text-emerald-600">{collectionPct}% Paid</span>
          </div>
        </div>

        {/* Card 5: Total Outstanding Balance */}
        <div className={`bg-white p-3.5 rounded-xl border shadow-xs transition-colors ${
          outstandingBal <= 0 ? 'border-emerald-200 hover:border-emerald-300' : 'border-rose-200 hover:border-rose-300'
        }`}>
          <div className={`flex items-center justify-between mb-1 ${
            outstandingBal <= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            <span className="text-xs font-semibold text-slate-600">Outstanding Due</span>
            <IndianRupee size={17} />
          </div>
          <div className={`text-xl font-bold font-mono ${
            outstandingBal <= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            ₹ {n(outstandingBal)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Customer AR</span>
            <span className={`font-semibold ${outstandingBal <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {outstandingBal <= 0 ? 'Cleared ✓' : 'Payment Due'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. WORKSPACE TABS */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold text-slate-600 overflow-x-auto">
        <button
          onClick={() => setActiveTab('proformas')}
          className={`pb-3.5 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'proformas'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <FileSpreadsheet size={16} />
          <span>Section A — Proforma Invoices</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-purple-100 text-purple-800">
            {proformas.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('finalInvoices')}
          className={`pb-3.5 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'finalInvoices'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <FileText size={16} />
          <span>Section B — Final Tax Invoices</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-purple-100 text-purple-800">
            {finalInvoices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3.5 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'payments'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Receipt size={16} />
          <span>Section C — Payment Collections</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-purple-100 text-purple-800">
            {payments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3.5 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Activity size={16} />
          <span>Section D — Commercial Audit Trail</span>
        </button>

        <button
          onClick={() => setActiveTab('handover')}
          className={`pb-3.5 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'handover'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <CheckCircle2 size={16} />
          <span>Section E — Stage 18 Handover</span>
          {outstandingBal <= 0 && totalBilled > 0 && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* 4. TAB CONTENTS */}
      {/* ----------------- TAB A: PROFORMA INVOICES ----------------- */}
      {activeTab === 'proformas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search proforma # or notes..."
                  value={piSearch}
                  onChange={(e) => setPiSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <select
                value={piStatusFilter}
                onChange={(e) => setPiStatusFilter(e.target.value)}
                className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Issued">Issued</option>
                <option value="Converted">Converted</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenProformaModal}
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shrink-0"
            >
              <Plus size={14} />
              <span>Create Proforma Invoice</span>
            </Button>
          </div>

          <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2.5">
            <HelpCircle size={16} className="text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Accounting Rule:</span> Proforma Invoices represent preliminary commercial estimations for customer approval or advance collection. They <strong className="font-semibold underline">never</strong> post to Accounts Receivable, affect the customer ledger, or duplicate inventory deductions.
            </div>
          </div>

          {/* Proformas Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">Proforma No</th>
                    <th className="py-3 px-3.5">Date / Validity</th>
                    <th className="py-3 px-3.5">Items / Lines</th>
                    <th className="py-3 px-3.5 text-right">Taxable Value</th>
                    <th className="py-3 px-3.5 text-right">Total Tax</th>
                    <th className="py-3 px-3.5 text-right">Total Amount</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProformas.length > 0 ? (
                    filteredProformas.map((pi) => {
                      const totalQty = pi.lines?.reduce((s, l) => s + (l.qty || 0), 0) || 0;
                      return (
                        <tr key={pi.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3.5">
                            <div className="font-mono font-bold text-purple-700">{pi.proformaNumber}</div>
                            {pi.notes && (
                              <div className="text-[11px] text-slate-500 max-w-xs truncate" title={pi.notes}>
                                {pi.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-medium text-slate-800">{pi.docDate}</div>
                            {pi.validUntil && (
                              <div className="text-[11px] text-slate-500">Valid: {pi.validUntil}</div>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-medium text-slate-800">
                              {pi.lines?.[0]?.itemName || 'Finished Fabric'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {n(totalQty)} M @ ₹ {n(pi.lines?.[0]?.rate || 150)}/M
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-medium text-slate-700">
                            ₹ {n(pi.taxableValue || pi.subtotal)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-600">
                            ₹ {n(pi.totalTax)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-purple-700">
                            ₹ {n(pi.total)}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                STATUS_PILL[pi.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {pi.status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleViewPrintDoc('PROFORMA', pi)}
                              className="text-xs text-slate-600 hover:text-purple-700"
                              title="View & Print Proforma"
                            >
                              <Eye size={13} className="mr-1" />
                              <span>View</span>
                            </Button>

                            {pi.status === 'Issued' && (
                              <>
                                <Button
                                  variant="primary"
                                  size="xs"
                                  disabled={submitting}
                                  onClick={() => handleConvertProforma(pi)}
                                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  title="Convert to Final GST Tax Invoice"
                                >
                                  <FileCheck size={13} className="mr-1" />
                                  <span>Convert</span>
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="xs"
                                  disabled={submitting}
                                  onClick={() => handleCancelProforma(pi)}
                                  className="text-xs text-rose-600 hover:text-rose-800"
                                  title="Cancel this Proforma"
                                >
                                  <XCircle size={13} />
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {loading ? 'Loading proformas...' : 'No proforma invoices found. Click "+ Create Proforma Invoice" to issue one.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB B: FINAL TAX INVOICES ----------------- */}
      {activeTab === 'finalInvoices' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice #, challan, or proforma..."
                  value={invSearch}
                  onChange={(e) => setInvSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <select
                value={invStatusFilter}
                onChange={(e) => setInvStatusFilter(e.target.value)}
                className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenDirectInvoiceModal}
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shrink-0"
            >
              <Plus size={14} />
              <span>Direct Tax Invoice</span>
            </Button>
          </div>

          <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Statutory Integration:</span> Final Invoices are posted directly to Accounts Receivable with complete double-entry Journal Entries. Customer Ledger and Sales Order billed meters update automatically. Stock deduction is tied to Stage 16 Delivery Challans.
            </div>
          </div>

          {/* Final Invoices Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">Invoice No</th>
                    <th className="py-3 px-3.5">Date / Ref</th>
                    <th className="py-3 px-3.5">Challan / PI</th>
                    <th className="py-3 px-3.5 text-right">Billed Qty</th>
                    <th className="py-3 px-3.5 text-right">Taxable</th>
                    <th className="py-3 px-3.5 text-right">Grand Total</th>
                    <th className="py-3 px-3.5 text-right">Amount Paid</th>
                    <th className="py-3 px-3.5 text-right">Balance Due</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFinalInvoices.length > 0 ? (
                    filteredFinalInvoices.map((inv) => {
                      const totalQty = inv.lines?.reduce((s, l) => s + (l.qty || 0), 0) || 0;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3.5">
                            <div className="font-mono font-bold text-purple-700">{inv.invoiceNumber}</div>
                            {inv.journalEntryId && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                JE: {inv.journalEntryId.slice(0, 8)}...
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-medium text-slate-800">{inv.docDate}</div>
                            {inv.dueDate && (
                              <div className="text-[11px] text-slate-500">Due: {inv.dueDate}</div>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            {inv.challanNumber ? (
                              <div className="font-mono text-blue-700 font-semibold">{inv.challanNumber}</div>
                            ) : (
                              <div className="text-slate-400">—</div>
                            )}
                            {inv.proformaNumber && (
                              <div className="text-[11px] text-teal-600 font-mono">From {inv.proformaNumber}</div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-800">
                            {n(totalQty)} M
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-600">
                            ₹ {n(inv.taxableValue || inv.subtotal)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                            ₹ {n(inv.total)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700">
                            ₹ {n(inv.amountPaid)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold">
                            <span className={inv.outstandingBalance > 0 ? 'text-rose-700' : 'text-slate-400'}>
                              ₹ {n(inv.outstandingBalance)}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                STATUS_PILL[inv.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleViewPrintDoc('INVOICE', inv)}
                              className="text-xs text-slate-600 hover:text-purple-700"
                              title="View & Print Tax Invoice"
                            >
                              <Eye size={13} className="mr-1" />
                              <span>View</span>
                            </Button>

                            {inv.outstandingBalance > 0 && (
                              <Button
                                variant="primary"
                                size="xs"
                                onClick={() => handleOpenPaymentModal(inv)}
                                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                title="Record Payment for this Invoice"
                              >
                                <IndianRupee size={12} className="mr-1" />
                                <span>Pay</span>
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        {loading ? 'Loading invoices...' : 'No final tax invoices recorded yet. Click "+ Direct Tax Invoice" or convert an existing Proforma.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB C: PAYMENT COLLECTIONS ----------------- */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search payment #, invoice, UTR/ref..."
                value={paySearch}
                onChange={(e) => setPaySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenPaymentModal()}
              disabled={finalInvoices.length === 0}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shrink-0"
            >
              <Plus size={14} />
              <span>Record Payment Collection</span>
            </Button>
          </div>

          {/* Payments Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">Payment Voucher</th>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Allocated Invoice</th>
                    <th className="py-3 px-3.5">Mode</th>
                    <th className="py-3 px-3.5">Bank / Account</th>
                    <th className="py-3 px-3.5">Reference / UTR</th>
                    <th className="py-3 px-3.5 text-right">Amount Received</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.length > 0 ? (
                    filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-bold text-emerald-700">
                          {p.paymentNumber}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-slate-800">
                          {p.paymentDate}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-purple-700 font-semibold">
                          {p.invoiceNumber}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                            {p.mode}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-700">
                          {p.bankAccountName}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-600">
                          {p.referenceNumber || '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 text-sm">
                          ₹ {n(p.amount)}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleViewPrintDoc('RECEIPT', p)}
                            className="text-xs text-slate-600 hover:text-emerald-700"
                            title="View Payment Receipt"
                          >
                            <Eye size={13} className="mr-1" />
                            <span>Receipt</span>
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        {loading ? 'Loading payment records...' : 'No payments collected yet. Click "+ Record Payment Collection" to log customer receipts.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB D: COMMERCIAL AUDIT TRAIL ----------------- */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Complete Commercial Lifecycle Lineage</h3>
            <p className="text-xs text-slate-500">
              End-to-end trace from Sales Order, through Stage 16 Dispatches, Proformas, Final Tax Invoices, Journal Entries, and Bank Settlement Vouchers.
            </p>
          </div>

          <div className="space-y-4">
            {/* 1. Sales Order */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  SO
                </div>
                <div>
                  <div className="font-bold text-slate-900">Sales Order: {salesOrder.orderNumber}</div>
                  <div className="text-slate-500">Customer: {customer.name} • Target: {n(targetReq)} M</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {salesOrder.stage}
              </span>
            </div>

            {/* 2. Stage 16 Delivery Challans */}
            <div className="pl-6 border-l-2 border-slate-200 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Stage 16 Dispatches ({dispatches.length} Challans)
              </div>
              {dispatches.map((dc) => (
                <div key={dc.id} className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-blue-600" />
                    <span className="font-mono font-bold text-slate-800">{dc.challanNumber}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">{dc.dispatchDate}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono font-bold text-blue-700">{n(dc.totalQty)} M</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Transporter: {dc.transporter} ({dc.lrNumber || 'Direct'})
                  </span>
                </div>
              ))}
            </div>

            {/* 3. Invoices Generated */}
            <div className="pl-6 border-l-2 border-purple-200 space-y-2">
              <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                Stage 17 Billed Tax Invoices ({finalInvoices.length} Invoices)
              </div>
              {finalInvoices.map((inv) => (
                <div key={inv.id} className="p-3 rounded-lg border border-purple-200 bg-purple-50/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-purple-600" />
                    <span className="font-mono font-bold text-purple-800">{inv.invoiceNumber}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono font-bold text-slate-800">₹ {n(inv.total)}</span>
                    {inv.journalEntryId && (
                      <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        JE Linked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-700 font-mono font-semibold">
                      Paid: ₹ {n(inv.amountPaid)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_PILL[inv.status]}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 4. Payment Receipts */}
            <div className="pl-6 border-l-2 border-emerald-200 space-y-2">
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                Commercial Collections ({payments.length} Payments)
              </div>
              {payments.map((p) => (
                <div key={p.id} className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Receipt size={14} className="text-emerald-600" />
                    <span className="font-mono font-bold text-emerald-800">{p.paymentNumber}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">Against {p.invoiceNumber}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{p.mode} ({p.referenceNumber || 'Cash'})</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ₹ {n(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB E: STAGE 18 CLOSURE HANDOVER ----------------- */}
      {activeTab === 'handover' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Stage 18 — Project Closure Readiness Assessment</h3>
              <p className="text-xs text-slate-500">
                To proceed to final formal project closure, ensure all goods have been dispatched, customer invoices issued, and all receivables fully settled.
              </p>
            </div>

            {/* Verification Checklist Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Check 1: Dispatch Fulfillment */}
              <div className={`p-4 rounded-xl border ${
                dispatchedQty >= targetReq ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">1. Customer Dispatch</span>
                  {dispatchedQty >= targetReq ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <Clock size={18} className="text-amber-600" />
                  )}
                </div>
                <div className="text-lg font-bold font-mono text-slate-900">
                  {n(dispatchedQty)} / {n(targetReq)} M
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {dispatchedQty >= targetReq ? '100% Goods Dispatched' : `${n(targetReq - dispatchedQty)} M remaining to dispatch`}
                </div>
              </div>

              {/* Check 2: Invoicing Clearance */}
              <div className={`p-4 rounded-xl border ${
                invoicedQty >= (dispatchedQty || targetReq) && finalInvoices.length > 0
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-amber-200 bg-amber-50/40'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">2. Tax Invoicing</span>
                  {invoicedQty >= (dispatchedQty || targetReq) && finalInvoices.length > 0 ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <Clock size={18} className="text-amber-600" />
                  )}
                </div>
                <div className="text-lg font-bold font-mono text-slate-900">
                  {n(invoicedQty)} / {n(dispatchedQty || targetReq)} M
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {invoicedQty >= (dispatchedQty || targetReq) && finalInvoices.length > 0
                    ? '100% Dispatches Invoiced'
                    : `${n(Math.max(0, (dispatchedQty || targetReq) - invoicedQty))} M pending invoice`}
                </div>
              </div>

              {/* Check 3: Payment Settlement */}
              <div className={`p-4 rounded-xl border ${
                outstandingBal <= 0 && totalBilled > 0
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-rose-200 bg-rose-50/40'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">3. Commercial Settlement</span>
                  {outstandingBal <= 0 && totalBilled > 0 ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <AlertCircle size={18} className="text-rose-600" />
                  )}
                </div>
                <div className="text-lg font-bold font-mono text-slate-900">
                  ₹ {n(outstandingBal)} Due
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {outstandingBal <= 0 && totalBilled > 0
                    ? '100% Payment Collected'
                    : `₹ ${n(outstandingBal)} balance awaiting collection`}
                </div>
              </div>
            </div>

            {/* Handover Banner */}
            {outstandingBal <= 0 && totalBilled > 0 ? (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Check size={22} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">Commercial Settlement Complete!</h4>
                    <p className="text-xs text-emerald-700">
                      All sales orders have been billed, all accounts receivable settled, and ledger balances balanced. This project is ready for formal Stage 18 Project Closure.
                    </p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => onSelectStage?.(18)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shrink-0 flex items-center gap-2 shadow-sm"
                >
                  <span>Proceed to Stage 18: Project Closure</span>
                  <ArrowRight size={15} />
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-900">
                <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Pending Commercial Settlement:</span> Invoices totaling ₹ {n(totalBilled)} have an outstanding receivable balance of ₹ {n(outstandingBal)}. Please record payment collections before closing the project in Stage 18.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: CREATE PROFORMA INVOICE */}
      {/* ============================================================ */}
      {isProformaModalOpen && (
        <Modal
          isOpen={isProformaModalOpen}
          onClose={() => setIsProformaModalOpen(false)}
          title="Create Proforma Invoice"
          className="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900">
              Customer: <span className="font-bold">{customer.name}</span> • Project: <span className="font-mono font-bold">{code}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Issue Date</label>
                <input
                  type="date"
                  value={piDocDate}
                  onChange={(e) => setPiDocDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={piValidUntil}
                  onChange={(e) => setPiValidUntil(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Link Delivery Challan (Optional)</label>
              <select
                value={piChallanId}
                onChange={(e) => setPiChallanId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none"
              >
                <option value="">No specific challan (Direct Order Estimate)</option>
                {dispatches.map((dc) => (
                  <option key={dc.id} value={dc.id}>
                    {dc.challanNumber} — {dc.dispatchDate} ({n(dc.totalQty)} M)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity (M)</label>
                <input
                  type="number"
                  step="0.01"
                  value={piQty}
                  onChange={(e) => setPiQty(e.target.value)}
                  placeholder="Meters"
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rate (₹ / M)</label>
                <input
                  type="number"
                  step="0.01"
                  value={piRate}
                  onChange={(e) => setPiRate(e.target.value)}
                  placeholder="Rate"
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">GST Rate (%)</label>
                <select
                  value={piTaxPct}
                  onChange={(e) => setPiTaxPct(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold focus:outline-none"
                >
                  <option value="0">0% (Nil)</option>
                  <option value="5">5% (Fabric Standard)</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                </select>
              </div>
            </div>

            {/* Calculations Box */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value:</span>
                <span>₹ {n(piBaseAmt)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST Tax ({piTaxPct}%):</span>
                <span>₹ {n(piTaxAmt)}</span>
              </div>
              <div className="flex justify-between font-bold text-purple-800 pt-1 border-t border-slate-200">
                <span>Total Estimated:</span>
                <span>₹ {n(piTotalAmt)}</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Terms</label>
              <textarea
                rows={2}
                value={piNotes}
                onChange={(e) => setPiNotes(e.target.value)}
                placeholder="Payment terms, delivery notes, quotation reference..."
                className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsProformaModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submitting || Number(piQty) <= 0}
                onClick={handleCreateProforma}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {submitting ? 'Issuing...' : 'Issue Proforma Invoice'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: CREATE DIRECT TAX INVOICE */}
      {/* ============================================================ */}
      {isFinalInvoiceModalOpen && (
        <Modal
          isOpen={isFinalInvoiceModalOpen}
          onClose={() => setIsFinalInvoiceModalOpen(false)}
          title="Generate GST Tax Invoice"
          className="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900">
              Customer: <span className="font-bold">{customer.name}</span> • Consignee GSTIN: <span className="font-mono font-bold">{customer.gstin || 'Unregistered'}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invDocDate}
                  onChange={(e) => setInvDocDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Challan Reference</label>
                <select
                  value={invChallanId}
                  onChange={(e) => setInvChallanId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none"
                >
                  <option value="">Direct Billing (No Challan)</option>
                  {dispatches.map((dc) => (
                    <option key={dc.id} value={dc.id}>
                      {dc.challanNumber} — {dc.dispatchDate} ({n(dc.totalQty)} M)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Billed Qty (M)</label>
                <input
                  type="number"
                  step="0.01"
                  value={invQty}
                  onChange={(e) => setInvQty(e.target.value)}
                  placeholder="Meters"
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rate (₹ / M)</label>
                <input
                  type="number"
                  step="0.01"
                  value={invRate}
                  onChange={(e) => setInvRate(e.target.value)}
                  placeholder="Rate"
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">GST Rate (%)</label>
                <select
                  value={invTaxPct}
                  onChange={(e) => setInvTaxPct(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold focus:outline-none"
                >
                  <option value="0">0% (Nil)</option>
                  <option value="5">5% (Fabric Standard)</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                </select>
              </div>
            </div>

            {/* Calculations Box */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount:</span>
                <span>₹ {n(invBaseAmt)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST ({invTaxPct}%):</span>
                <span>₹ {n(invTaxAmt)}</span>
              </div>
              <div className="flex justify-between font-bold text-purple-900 pt-1 border-t border-slate-200">
                <span>Invoice Total:</span>
                <span>₹ {n(invTotalAmt)}</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Remarks / Dispatch Notes</label>
              <textarea
                rows={2}
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
                placeholder="Invoice notes, vehicle info, bank terms..."
                className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsFinalInvoiceModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submitting || Number(invQty) <= 0}
                onClick={handleCreateDirectInvoice}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {submitting ? 'Generating...' : 'Generate Tax Invoice'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: RECORD PAYMENT COLLECTION */}
      {/* ============================================================ */}
      {isPaymentModalOpen && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Record Customer Payment Receipt"
          className="max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Target Tax Invoice</label>
              <select
                value={selectedInvoiceForPayment?.id || ''}
                onChange={(e) => {
                  const inv = finalInvoices.find((i) => i.id === e.target.value);
                  setSelectedInvoiceForPayment(inv || null);
                  if (inv) setPayAmount(String(inv.outstandingBalance || ''));
                }}
                className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 font-semibold focus:outline-none"
              >
                {finalInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — Total ₹ {n(inv.total)} (Bal Due: ₹ {n(inv.outstandingBalance)})
                  </option>
                ))}
              </select>
            </div>

            {selectedInvoiceForPayment && (
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Invoice Amount:</span>
                  <span className="font-mono font-bold text-slate-800">₹ {n(selectedInvoiceForPayment.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Already Paid:</span>
                  <span className="font-mono font-bold text-emerald-700">₹ {n(selectedInvoiceForPayment.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-700 pt-1 border-t border-purple-200">
                  <span>Current Outstanding Balance:</span>
                  <span className="font-mono">₹ {n(selectedInvoiceForPayment.outstandingBalance)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold focus:outline-none"
                >
                  <option value="Bank">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI Payment</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </div>

            {payMode !== 'Cash' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Receiving Bank Account</label>
                <select
                  value={payBankAccountId}
                  onChange={(e) => setPayBankAccountId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.bankName} (A/C: {b.accountNumber || 'Primary'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">UTR / Cheque / Ref Number</label>
                <input
                  type="text"
                  value={payReferenceNo}
                  onChange={(e) => setPayReferenceNo(e.target.value)}
                  placeholder="e.g. UTR-HDFC-991823"
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {selectedInvoiceForPayment && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] flex justify-between items-center">
                <span className="text-slate-600">Remaining Balance after this payment:</span>
                <span className="font-mono font-bold text-slate-900">₹ {n(payBalRemaining)}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Payment memo or bank transaction notes"
                className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submitting || Number(payAmount) <= 0}
                onClick={handleRecordPayment}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? 'Recording...' : 'Record Payment Receipt'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: VIEW & PRINT DOCUMENT (PROFORMA / TAX INVOICE / RECEIPT) */}
      {/* ============================================================ */}
      {isPrintModalOpen && printDoc && (
        <Modal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title={
            printDoc.type === 'PROFORMA'
              ? `Proforma Invoice: ${printDoc.data.proformaNumber}`
              : printDoc.type === 'INVOICE'
              ? `Tax Invoice: ${printDoc.data.invoiceNumber}`
              : `Payment Receipt: ${printDoc.data.paymentNumber}`
          }
          className="max-w-3xl"
        >
          <div className="space-y-6 text-xs p-2">
            {/* Printable Document Sheet */}
            <div id="printable-commercial-doc" className="bg-white p-6 border border-slate-300 rounded-xl space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">OSCAR ERP TEXTILE MILLS</h2>
                  <p className="text-slate-500 text-[11px]">Industrial Area, Phase II, Textile Hub, Gujarat, India</p>
                  <p className="text-slate-500 text-[11px]">GSTIN: <span className="font-mono font-bold text-slate-800">24AABCO1234F1Z5</span></p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-purple-100 text-purple-800 uppercase">
                    {printDoc.type === 'PROFORMA'
                      ? 'PROFORMA INVOICE'
                      : printDoc.type === 'INVOICE'
                      ? 'TAX INVOICE'
                      : 'PAYMENT RECEIPT'}
                  </span>
                  <div className="font-mono font-bold text-sm text-slate-900 mt-2">
                    {printDoc.type === 'PROFORMA'
                      ? printDoc.data.proformaNumber
                      : printDoc.type === 'INVOICE'
                      ? printDoc.data.invoiceNumber
                      : printDoc.data.paymentNumber}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Date: {printDoc.data.docDate || printDoc.data.paymentDate}
                  </div>
                </div>
              </div>

              {/* Customer & Order Context */}
              <div className="grid grid-cols-2 gap-6 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Billed To (Customer):</div>
                  <div className="font-bold text-slate-900 mt-1">{customer.name}</div>
                  <div className="text-slate-600 text-[11px]">{customer.shippingAddress || 'Registered Office Address'}</div>
                  <div className="text-slate-600 text-[11px]">GSTIN: <span className="font-mono">{customer.gstin || 'Unregistered'}</span></div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Project / Order Ref:</div>
                  <div className="font-mono font-bold text-slate-900">{code}</div>
                  <div className="text-slate-600 text-[11px]">Sales Order: {salesOrder.orderNumber}</div>
                  {printDoc.data.challanNumber && (
                    <div className="text-blue-700 font-mono text-[11px]">Challan: {printDoc.data.challanNumber}</div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              {printDoc.type !== 'RECEIPT' ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Item Description</th>
                        <th className="p-2.5 text-right">Quantity</th>
                        <th className="p-2.5 text-right">Rate (₹)</th>
                        <th className="p-2.5 text-right">Taxable (₹)</th>
                        <th className="p-2.5 text-right">GST</th>
                        <th className="p-2.5 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(printDoc.data.lines || []).map((l, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-sans font-medium text-slate-800">{l.itemName}</td>
                          <td className="p-2.5 text-right">{n(l.qty)} {l.uom}</td>
                          <td className="p-2.5 text-right">₹ {n(l.rate)}</td>
                          <td className="p-2.5 text-right">₹ {n(l.amount)}</td>
                          <td className="p-2.5 text-right">{l.taxPct}% (₹{n(l.taxAmount)})</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">₹ {n(l.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex justify-between font-mono">
                    <span className="font-semibold text-emerald-900">Amount Received:</span>
                    <span className="text-lg font-bold text-emerald-700">₹ {n(printDoc.data.amount)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Payment Mode:</span>
                    <span className="font-semibold text-slate-800">{printDoc.data.mode}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Bank Account:</span>
                    <span>{printDoc.data.bankAccountName}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Reference / UTR:</span>
                    <span className="font-mono">{printDoc.data.referenceNumber || '—'}</span>
                  </div>
                </div>
              )}

              {/* Total Calculation Summary */}
              {printDoc.type !== 'RECEIPT' && (
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span>₹ {n(printDoc.data.subtotal || printDoc.data.taxableValue)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Total Tax (GST):</span>
                      <span>₹ {n(printDoc.data.totalTax)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-purple-900 pt-2 border-t border-slate-200">
                      <span>Grand Total:</span>
                      <span>₹ {n(printDoc.data.total)}</span>
                    </div>
                    {printDoc.type === 'INVOICE' && (
                      <>
                        <div className="flex justify-between text-emerald-700 font-semibold pt-1">
                          <span>Amount Paid:</span>
                          <span>₹ {n(printDoc.data.amountPaid)}</span>
                        </div>
                        <div className="flex justify-between text-rose-700 font-bold">
                          <span>Balance Due:</span>
                          <span>₹ {n(printDoc.data.outstandingBalance)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Remittance & Signatory */}
              <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-[11px] text-slate-500">
                <div>
                  <div className="font-bold text-slate-700 uppercase text-[10px]">Bank Remittance Details:</div>
                  <div>Bank: HDFC Bank Limited • Current A/C: 50200012345678</div>
                  <div>IFSC: HDFC0001234 • Branch: Textile Market Branch</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800">For OSCAR ERP TEXTILE MILLS</div>
                  <div className="h-10"></div>
                  <div className="text-[10px] text-slate-400">Authorized Signatory</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsPrintModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.print()}
                className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Print Document</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
