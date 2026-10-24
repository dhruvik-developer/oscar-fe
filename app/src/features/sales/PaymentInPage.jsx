import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Plus, ArrowDownLeft, CreditCard, X, Receipt, DollarSign, CheckCircle2, TrendingUp } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
const paymentInGuide = {
    title: 'Payment In & Customer Receipts',
    subtitle: 'Cash inflow reconciliation and Accounts Receivable settlement',
    purpose: 'Use this page to record customer payments (cash, check, card, or bank transfer). Recording a payment credits the customer’s open invoice and reduces their Accounts Receivable (AR) balance.',
    workflow: ['Issue Invoice', 'Customer Sends Funds', 'Record Payment In', 'AR Settled & Receipt Issued'],
    keyTerms: [
        {
            term: 'Payment In / Receipt Voucher',
            definition: 'An official accounting document proving funds have been received and applied to a customer invoice.',
        },
        {
            term: 'Accounts Receivable (AR)',
            definition: 'Money owed to your business by customers for goods or services delivered on credit.',
        },
        {
            term: 'Invoice Reconciliation',
            definition: 'The process of matching incoming bank payments against outstanding open sales invoices.',
        },
        {
            term: 'Settlement Status',
            definition: 'Indicates whether an invoice is Unpaid, Partially Paid, or Fully Paid.',
        },
    ],
    tips: [
        'You can also click "⚡ Settle" directly from the Sales Invoices screen to record payment with 1 click!',
        'Each recorded payment immediately adjusts the customer’s live credit balance in Customer 360°.',
    ],
};
export const PaymentInPage = () => {
    const { paymentIns, invoices, customers, addPaymentIn, getInvoiceOutstanding, formatCurrency, formatDateDDMMYYYY, getCurrentDateFormatted } = useERP();
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoices[0]?.id || '');
    const [amount, setAmount] = useState(0);
    const [mode, setMode] = useState('Bank Transfer');
    const [reference, setReference] = useState('');
    // [PHASE-4] live outstanding for overpay guard
    const selectedInv = invoices.find((i) => i.id === selectedInvoiceId) || invoices[0];
    const selectedOutstanding = selectedInv ? getInvoiceOutstanding(selectedInv.id) : { balanceDue: 0, paid: 0 };
    const handleInvoiceChange = (invId) => {
        setSelectedInvoiceId(invId);
        const inv = invoices.find((i) => i.id === invId);
        if (inv) {
            const outstanding = getInvoiceOutstanding(inv.id);
            setAmount(outstanding.balanceDue > 0 ? outstanding.balanceDue : inv.total);
        }
    };
    const handleRecord = (e) => {
        e.preventDefault();
        const inv = invoices.find((i) => i.id === selectedInvoiceId);
        if (!inv) return; // the invoice must be chosen explicitly
        const cust = customers.find((c) => c.id === inv.customerId || c.name === inv.customer);
        addPaymentIn({
            customerId: cust?.id || inv.customerId,
            customer: inv.customer || cust?.name,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            date: getCurrentDateFormatted(),
            mode,
            amount: Number(amount) || 0,
            // The receipt number is allocated by the server.
            reference: reference || undefined,
        });
        setShowAddModal(false);
    };
    const totalCollected = paymentIns.reduce((sum, p) => sum + (p.amount || 0), 0);
    const columns = [
        {
            key: 'receiptNumber',
            header: 'Receipt Ref',
            width: '14%',
            render: (p) => (
              <span className="font-mono font-bold text-text flex items-center gap-1.5 whitespace-nowrap">
                <ArrowDownLeft size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0"/>
                <span>{p.receiptNumber}</span>
              </span>
            ),
        },
        {
            key: 'customer',
            header: 'Customer Account',
            width: '24%',
            render: (p) => <span className="font-bold text-text block">{p.customer}</span>,
        },
        {
            key: 'invoiceNumber',
            header: 'Settled Invoice',
            width: '14%',
            render: (p) => <span className="font-mono font-semibold text-primary whitespace-nowrap">{p.invoiceNumber}</span>,
        },
        {
            key: 'date',
            header: 'Payment Date',
            width: '12%',
            render: (p) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(p.date)}</span>,
        },
        {
            key: 'mode',
            header: 'Payment Mode',
            align: 'center',
            width: '14%',
            render: (p) => (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-border whitespace-nowrap">
                <CreditCard size={11} className="text-muted"/> {p.mode}
              </span>
            ),
        },
        {
            key: 'reference',
            header: 'Transaction / Wire Ref',
            width: '12%',
            render: (p) => (
              <span className="font-mono text-[11px] text-muted whitespace-nowrap">{p.reference}</span>
            ),
        },
        {
            key: 'amount',
            header: 'Amount Received',
            align: 'right',
            width: '14%',
            render: (p) => (
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                +{formatCurrency(p.amount ?? 0)}
              </span>
            ),
        },
    ];
    const avgReceipt = paymentIns.length > 0 ? (totalCollected / paymentIns.length) : 0;
    const wireCount = paymentIns.filter(p => (p.mode || '').toLowerCase().includes('wire') || (p.mode || '').toLowerCase().includes('bank')).length;

    return (<div className="space-y-6">
      <PageHeader title="Payment Receipts & AR Collections" subtitle="Record incoming payments, allocate across customer open invoices, automatically credit cash/bank, and post double-entry General Ledger receipts." guide={paymentInGuide} actions={<Button icon={Plus} onClick={() => {
                if (invoices.length > 0) {
                    handleInvoiceChange(invoices[0].id);
                }
                setShowAddModal(true);
            }}>
            Record Payment In
          </Button>}/>

      {/* Payment In KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Received Collections" value={formatCurrency(totalCollected)} icon={DollarSign} highlight />
        <StatCard label="Total Vouchers Issued" value={`${paymentIns.length} Receipts`} icon={Receipt} trend={{ positive: true, text: 'Cleared to Ledger' }} />
        <StatCard label="Avg Receipt Amount" value={formatCurrency(avgReceipt)} icon={TrendingUp} />
        <StatCard label="Bank & Wire Transfers" value={`${wireCount} Settlements`} icon={CheckCircle2} subtext="Direct Treasury intake" />
      </div>

      <DataTable title="Cleared Customer Collections" columns={columns} data={paymentIns} keyExtractor={(p) => p.id} searchPlaceholder="Search receipt #, customer, or invoice..." searchFilter={(p, term) => String(p.receiptNumber ?? '').toLowerCase().includes(term) ||
            String(p.customer ?? '').toLowerCase().includes(term) ||
            (p.invoiceNumber && String(p.invoiceNumber ?? '').toLowerCase().includes(term)) ||
            (p.reference && String(p.reference ?? '').toLowerCase().includes(term))}/>

      {showAddModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 text-xs max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600"/>
                <h3 className="font-bold text-base text-slate-900">Record Customer Receipt</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleRecord} className="space-y-4 mt-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Sales Invoice *</label>
                <select value={selectedInvoiceId} onChange={(e) => handleInvoiceChange(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                  {invoices.map((inv) => {
                const outstanding = getInvoiceOutstanding(inv.id);
                return (<option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} - {inv.customer} (Due: {formatCurrency(outstanding.balanceDue)})
                      </option>);
            })}
                </select>
              </div>

              {/* [PHASE-4] Live outstanding badge + overpay guard */}
              {selectedInv && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Total:</span>
                    <span className="font-mono text-slate-800">{formatCurrency(selectedInv.grandTotal || selectedInv.total || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Already Collected:</span>
                    <span className="font-mono text-slate-600">{formatCurrency(selectedOutstanding.paid)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 font-semibold border-t border-slate-200 pt-1">
                    <span>Remaining Balance Due:</span>
                    <span className="font-mono font-bold">{formatCurrency(selectedOutstanding.balanceDue)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Settlement Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  max={Math.max(0.01, selectedOutstanding.balanceDue)}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-mono font-bold text-sm text-slate-900"
                />
                {amount > selectedOutstanding.balanceDue + 0.01 && selectedOutstanding.balanceDue > 0 && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    ⚠ Overpayment: amount exceeds outstanding balance by {formatCurrency(amount - selectedOutstanding.balanceDue)}.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800">
                    <option value="Bank Transfer">Bank Wire / ACH</option>
                    <option value="Corporate Card">Corporate Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reference / UTR / Ref #</label>
                  <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"/>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={amount <= 0 || amount > selectedOutstanding.balanceDue + 0.01}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm"
                >
                  {amount > selectedOutstanding.balanceDue + 0.01 ? '⚠ Amount Exceeds Balance' : 'Post Payment & Update Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </div>);
};
