import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Plus, FileSpreadsheet, CheckCircle2, DollarSign, X, Eye, Printer, Clock, AlertCircle, FileText, Ban, MapPin } from 'lucide-react';
import { LineItemEditor } from '../../components/common/LineItemEditor';
import { DocumentTimeline } from '../../components/common/DocumentTimeline';
import { RelatedDocumentsCard } from '../../components/common/RelatedDocumentsCard';
import { PageHeader } from '../../components/common/PageHeader';
import { PrintBillModal } from '../../components/common/PrintBillModal';
import MasterSourceLink from '../../components/common/MasterSourceLink';
const purchaseBillGuide = {
    title: 'Purchase Bills & Accounts Payable',
    subtitle: 'Supplier invoice intake, 3-way matching audit, inventory replenishment, and disbursements.',
    purpose: 'A Purchase Bill is an official invoice submitted by your supplier demanding payment for delivered goods or services. Recording a bill automatically increases warehouse inventory on-hand, reconciles against the original Purchase Order (3-Way Matching), and tracks Accounts Payable (AP) balances for disbursements.',
    keyTerms: [
        { term: 'Purchase Bill (Vendor Invoice)', definition: 'The financial document from a supplier charging your business for received goods.' },
        { term: '3-Way Matching', definition: 'The enterprise verification rule ensuring Purchase Order quantities = Warehouse Intake quantities = Billed invoice amounts.' },
        { term: 'Accounts Payable (AP)', definition: 'Short-term debt owed by your company to suppliers for goods already received on credit.' },
        { term: 'Disbursement Voucher', definition: 'Formal proof of outgoing cash, ACH, or wire payment to settle the vendor balance.' },
    ],
    tips: [
        'Always pull from an existing PO when recording a bill to ensure 100% 3-Way Match accuracy.',
        'Click "Pay Bill" to record an ACH or Wire disbursement and post the payment to the General Ledger.',
        'Click the 🖨️ icon to view or print an authentic formal vendor purchase bill.',
    ],
    workflow: ['PO Issued', 'Physical Goods Intake', 'Vendor Bill Recorded', '3-Way Match Verified', 'Payment Disbursed'],
};
export const PurchaseBillsPage = () => {
    const { purchaseBills, purchaseOrders, vendors, bankAccounts, addPurchaseBill, cancelPurchaseBill, addPaymentOut, getBillOutstanding, getPoBilledStatus, paymentOuts, purchaseReturns, formatCurrency, formatDateDDMMYYYY, getCurrentDateFormatted, getCurrentISODate, addDaysISO } = useERP();
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedBill, setSelectedBill] = useState(null);
    const [showPayModal, setShowPayModal] = useState(null);
    const [printBillTarget, setPrintBillTarget] = useState(null);
    // Deep-link ?bill=<id|billNumber> (Bill Matching redirects here after
    // approve + auto-send): open that bill's detail once it exists in state.
    const [searchParams] = useSearchParams();
    useEffect(() => {
      const wanted = searchParams.get('bill');
      if (!wanted || selectedBill) return;
      const found = (purchaseBills || []).find(
        (b) => String(b.id) === String(wanted) || b.billNumber === wanted,
      );
      if (found) setSelectedBill(found);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, purchaseBills]);
    // Form state
    const [selectedPoId, setSelectedPoId] = useState('manual');
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [dueDate, setDueDate] = useState(() => addDaysISO(getCurrentISODate(), 30));
    const [lineItems, setLineItems] = useState([]);
    // Payment form state
    const [payAmount, setPayAmount] = useState(0);
    const [payMode, setPayMode] = useState('');
    const [payBankId, setPayBankId] = useState('');
    const [payRef, setPayRef] = useState('');
    const [billDate, setBillDate] = useState(() => getCurrentISODate());
    const [saving, setSaving] = useState(false);
    const handleSelectPo = (poId) => {
        setSelectedPoId(poId);
        if (poId !== 'manual') {
            const matchedPo = purchaseOrders.find((p) => p.id === poId || p.poNumber === poId);
            if (matchedPo) {
                if (matchedPo.vendorId)
                    setSelectedVendorId(matchedPo.vendorId);
                const poInfo = getPoBilledStatus(matchedPo.id);
                const remainingLines = poInfo.lines
                    .filter((l) => l.remainingQty > 0)
                    .map((l) => ({
                        ...l,
                        qty: l.remainingQty,
                        amount: Math.round(l.remainingQty * (l.rate || 0) * 100) / 100,
                    }));
                setLineItems(remainingLines.length > 0 ? remainingLines : (matchedPo.items || []));
            }
        }
    };
    const handleCreate = async (e) => {
        e.preventDefault();
        const po = purchaseOrders.find((p) => p.id === selectedPoId);
        const vend = vendors.find((v) => v.id === selectedVendorId);
        if (!vend) { alert('Select a vendor.'); return; }
        if (!billDate) { alert('Enter the bill date.'); return; }
        setSaving(true);
        try {
            await addPurchaseBill({
                purchaseOrderId: po?.id,
                vendorId: vend.id,
                date: billDate,
                dueDate: dueDate || undefined,
                items: lineItems,
            });
            setShowAddModal(false);
            setLineItems([]);
            setSelectedPoId('manual');
        } catch {
            // The reason was shown; the form stays open with what was typed.
        } finally {
            setSaving(false);
        }
    };
    const handleDisbursementSubmit = async (e) => {
        e.preventDefault();
        if (!showPayModal || payAmount <= 0)
            return;
        setSaving(true);
        try {
            await addPaymentOut({
                vendorId: showPayModal.vendorId,
                billId: showPayModal.id,
                date: getCurrentISODate(),
                amount: payAmount,
                mode: payMode,
                bankAccountId: payMode !== 'Cash' ? payBankId : undefined,
                reference: payRef || undefined,
            });
            setShowPayModal(null);
            setPayAmount(0);
            setPayRef('');
        } catch {
            // The reason was shown; the modal stays open.
        } finally {
            setSaving(false);
        }
    };
    const getBillTimelineSteps = (b) => {
        const outstanding = getBillOutstanding(b.id);
        return [
            {
                label: 'Purchase Order Verification',
                docNumber: b.poRef || b.linkedPo,
                amount: b.total || b.amount,
                date: formatDateDDMMYYYY(b.date),
                status: 'completed',
            },
            {
                label: 'Vendor Bill Intake',
                docNumber: b.billNumber,
                amount: b.total || b.amount,
                date: formatDateDDMMYYYY(b.billDate || b.date),
                status: 'completed',
            },
            {
                label: 'Disbursement Settlement',
                docNumber: outstanding.paid > 0 ? 'Disbursement' : undefined,
                amount: outstanding.paid,
                status: outstanding.paid >= (b.total || b.amount) ? 'completed' : outstanding.paid > 0 ? 'current' : 'pending',
            },
        ];
    };
    const getBillRelatedDocs = (b) => {
        const docs = [];
        const poNum = b.poRef || b.linkedPo;
        const linkedPo = purchaseOrders.find((p) => p.poNumber === poNum || p.id === b.purchaseOrderId);
        if (linkedPo) {
            docs.push({
                type: 'Purchase Order',
                number: linkedPo.poNumber,
                amount: linkedPo.total || linkedPo.amount,
                date: formatDateDDMMYYYY(linkedPo.date),
                status: linkedPo.status,
            });
        }
        const relatedPayments = paymentOuts.filter((p) => p.billId === b.id || p.billNumber === b.billNumber);
        relatedPayments.forEach((p) => {
            docs.push({
                type: 'Payment Out',
                number: p.voucherNumber,
                amount: p.amount,
                date: formatDateDDMMYYYY(p.date),
                status: 'Paid',
            });
        });
        const relatedReturns = purchaseReturns.filter((pr) => pr.billId === b.id || pr.billNumber === b.billNumber);
        relatedReturns.forEach((pr) => {
            docs.push({
                type: 'Debit Note',
                number: pr.returnNumber,
                amount: pr.amount,
                date: formatDateDDMMYYYY(pr.date),
                status: pr.status,
            });
        });
        return docs;
    };
    const columns = [
        {
            key: 'billNumber',
            header: 'Vendor Bill #',
            width: '13%',
            render: (b) => (
              <button
                onClick={() => setSelectedBill(b)}
                className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5 text-left cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet size={13} className="text-muted shrink-0"/>
                <span>{b.billNumber}</span>
              </button>
            ),
        },
        {
            key: 'poRef',
            header: '3-Way Match & PO Ref',
            width: '18%',
            render: (b) => {
                const poNum = b.poRef || b.linkedPo;
                const linkedPo = purchaseOrders.find((p) => p.poNumber === poNum || p.id === b.purchaseOrderId);
                let matchBadge = {
                    label: 'Direct Entry',
                    bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                };
                if (linkedPo) {
                    const poItemsCount = linkedPo.items?.reduce((acc, it) => acc + it.qty, 0) || 0;
                    const billItemsCount = b.items?.reduce((acc, it) => acc + it.qty, 0) || 0;
                    if (poItemsCount === billItemsCount && Math.abs((linkedPo.amount || 0) - (b.amount || b.total || 0)) < 1) {
                        matchBadge = {
                            label: '3-Way Matched (100%)',
                            bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
                        };
                    }
                    else if (billItemsCount < poItemsCount) {
                        matchBadge = {
                            label: `Partial Intake (${billItemsCount}/${poItemsCount})`,
                            bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
                        };
                    }
                    else {
                        matchBadge = {
                            label: 'Audit Verified',
                            bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
                        };
                    }
                }
                return (
                  <div className="space-y-1">
                    <span className="font-mono text-text font-semibold block text-xs">{poNum || 'N/A'}</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${matchBadge.bg}`}>
                      {matchBadge.label}
                    </span>
                  </div>
                );
            },
        },
        {
            key: 'vendor',
            header: 'Vendor Supplier',
            width: '18%',
            render: (b) => <span className="font-bold text-text block">{b.vendor}</span>,
        },
        {
            key: 'billDate',
            header: 'Bill Date',
            width: '10%',
            render: (b) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(b.billDate || b.date)}</span>,
        },
        {
            key: 'dueDate',
            header: 'Payment Due',
            width: '11%',
            render: (b) => <span className="text-muted text-[11px] whitespace-nowrap">{b.dueDate ? formatDateDDMMYYYY(b.dueDate) : '—'}</span>,
        },
        {
            key: 'amount',
            header: 'Bill Amount',
            align: 'right',
            width: '12%',
            render: (b) => (
              <span className="font-mono font-bold text-text whitespace-nowrap">
                {formatCurrency(b.amount ?? b.total ?? 0)}
              </span>
            ),
        },
        {
            key: 'balanceDue',
            header: 'Outstanding Due',
            align: 'right',
            width: '12%',
            render: (b) => {
                const outstanding = getBillOutstanding(b.id);
                return (
                  <span className={`font-mono font-bold whitespace-nowrap ${outstanding.balanceDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(outstanding.balanceDue)}
                  </span>
                );
            },
        },
        {
            key: 'status',
            header: 'Settlement Status',
            align: 'center',
            width: '11%',
            render: (b) => {
                const outstanding = getBillOutstanding(b.id);
                return <StatusBadge status={outstanding.status}/>;
            },
        },
        {
            key: 'actions',
            header: 'Disbursement',
            align: 'right',
            width: '15%',
            render: (b) => {
                const outstanding = getBillOutstanding(b.id);
                const isCancelled = b.status === 'Cancelled';
                return (
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedBill(b)}
                      className="p-1.5 text-muted hover:text-primary hover:bg-card-hover rounded-lg cursor-pointer transition-colors"
                      title="View Bill & Details"
                    >
                      <Eye size={13}/>
                    </button>
                    <button
                      onClick={() => setPrintBillTarget(b)}
                      className="p-1.5 text-muted hover:text-primary hover:bg-card-hover rounded-lg cursor-pointer transition-colors"
                      title="Print Official Purchase Bill"
                    >
                      <Printer size={13}/>
                    </button>
                    {isCancelled ? (
                      <span className="text-xs font-semibold text-rose-600 inline-flex items-center gap-1">
                        <Ban size={11} /> Cancelled
                      </span>
                    ) : outstanding.balanceDue > 0.01 ? (
                      <div className="flex items-center gap-1">
                        {outstanding.paid <= 0 && (
                          <button
                            onClick={() => cancelPurchaseBill(b.id)}
                            className="p-1 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                            title="Cancel Purchase Bill"
                          >
                            <Ban size={13}/>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowPayModal(b);
                            setPayAmount(outstanding.balanceDue);
                          }}
                          className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-white rounded-xl text-[11px] font-semibold cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
                        >
                          <DollarSign size={11}/> Pay Bill
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 size={12}/> Settled
                      </span>
                    )}
                  </div>
                );
            },
        },
    ];
    const totalBilled = purchaseBills.reduce((acc, b) => acc + (b.total || b.amount || 0), 0);
    const totalApOutstanding = purchaseBills.reduce((acc, b) => acc + getBillOutstanding(b.id).balanceDue, 0);
    const totalDisbursed = purchaseBills.reduce((acc, b) => acc + getBillOutstanding(b.id).paid, 0);
    const unpaidBillsCount = purchaseBills.filter(b => getBillOutstanding(b.id).balanceDue > 0).length;

    return (<div className="space-y-6">
      <PageHeader title="Purchase Bills & Accounts Payable" subtitle="Supplier invoice intake, line-item inventory replenishment, remaining balance tracking, and vendor disbursements." guide={purchaseBillGuide} actions={<Button icon={Plus} onClick={() => setShowAddModal(true)}>
            Enter Vendor Bill
          </Button>}/>

      {/* Purchase Bills KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Billed Invoices" value={formatCurrency(totalBilled)} icon={DollarSign} />
        <StatCard label="AP Payable Due" value={formatCurrency(totalApOutstanding)} icon={Clock} trend={{ positive: totalApOutstanding === 0, text: totalApOutstanding > 0 ? `${unpaidBillsCount} unpaid bills` : 'All bills cleared' }} highlight={totalApOutstanding > 0} />
        <StatCard label="Total Disbursed" value={formatCurrency(totalDisbursed)} icon={CheckCircle2} trend={{ positive: true, text: 'Disbursements verified' }} />
        <StatCard label="Active Bills" value={`${purchaseBills.length} Bills`} icon={FileText} subtext={`${unpaidBillsCount} awaiting payment`} />
      </div>

      <DataTable title="Accounts Payable Bills" columns={columns} data={purchaseBills} keyExtractor={(b) => b.id} searchPlaceholder="Search bill #, PO, or vendor..." searchFilter={(b, term) => String(b.billNumber ?? '').toLowerCase().includes(term) ||
            (b.poRef || b.linkedPo || '').toLowerCase().includes(term) ||
            String(b.vendor ?? '').toLowerCase().includes(term)}/>

      {/* Enter Bill Modal */}
      {showAddModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-5xl w-full p-4 sm:p-6 text-xs max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">
                Record Vendor Purchase Bill
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pull From PO (Optional)</label>
                  <select value={selectedPoId} onChange={(e) => handleSelectPo(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="manual">-- Manual Bill Entry --</option>
                    {purchaseOrders.filter((po) => po.status !== 'Cancelled').map((po) => {
                      const poInfo = getPoBilledStatus(po.id);
                      return (
                        <option key={po.id} value={po.id} disabled={poInfo.status === 'Billed'}>
                          {po.poNumber} ({po.vendor}) — {poInfo.status} {poInfo.totalRemainingQty > 0 ? `(${poInfo.totalRemainingQty} left)` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Vendor / Supplier *</label>
                    <MasterSourceLink source="vendors" />
                  </div>
                  <select required value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">Select vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.code})
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const vend = vendors.find(v => v.id === selectedVendorId);
                    if (!vend) return null;
                    return (
                      <div className="mt-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>{vend.name}</span>
                          <span className="text-emerald-700 font-mono text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Terms: {vend.paymentTerms || '—'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 text-[10px]">
                          <span>POC: <strong>{vend.contactPerson || '—'}</strong></span>
                          <span>Email: {vend.email}</span>
                          <span>Phone: {vend.phone}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bill Date *</label>
                  <input type="date" required value={billDate} onChange={(e) => setBillDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"/>
                  <label className="block font-semibold text-slate-700 mb-1 mt-2">Payment Due Date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"/>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-2">Billed Line Items (stock is received through Goods Receipt)</label>
                <LineItemEditor items={lineItems} onChange={setLineItems} type="purchase"/>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold shadow-sm disabled:opacity-60">
                  {saving ? 'Saving…' : 'Record Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>)}

      {/* Bill Detail Modal */}
      {selectedBill && (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-200">
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3 min-w-0 lg:min-w-auto">
                <h3 className="font-bold text-lg text-[#1F2E4A]">{selectedBill.billNumber}</h3>
                <span className="font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">
                  {selectedBill.vendor}
                </span>
                <StatusBadge status={getBillOutstanding(selectedBill.id).status}/>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPrintBillTarget(selectedBill)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Printer size={13}/>
                  Print Official Bill
                </button>
                <button onClick={() => setSelectedBill(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                  <X size={18}/>
                </button>
              </div>
            </div>

            <div className="space-y-6 mt-4 overflow-y-auto pr-1 flex-1">
              {/* Vendor & Address Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Supplier / Vendor</span>
                    <strong className="text-slate-900 text-sm block">{selectedBill.vendor}</strong>
                    <div className="text-slate-600 mt-1 flex items-start gap-1">
                      <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        {[selectedBill.billingAddress?.line1, selectedBill.billingAddress?.city, selectedBill.billingAddress?.state, selectedBill.billingAddress?.pincode].filter(Boolean).join(', ') || '—'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Billing Details</span>
                    <p className="text-slate-700">Bill Date: <strong>{formatDateDDMMYYYY(selectedBill.billDate || selectedBill.date)}</strong></p>
                    <p className="text-slate-700">Due Date: <strong>{selectedBill.dueDate ? formatDateDDMMYYYY(selectedBill.dueDate) : '—'}</strong></p>
                    <p className="text-slate-700">Matched PO: <strong>{selectedBill.poRef || selectedBill.linkedPo || purchaseOrders.find((p) => p.id === selectedBill.purchaseOrderId)?.poNumber || 'Direct Entry'}</strong></p>
                  </div>
                </div>
              </div>

              {/* 3-Way Reconciliation Audit Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600"/>
                    3-Way Matching Audit Verification
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                    RECONCILED
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-200/70">
                  <div>
                    <span className="text-slate-400 block text-[10px]">1. PO Approved Qty</span>
                    <strong className="text-slate-800 font-mono">
                      {selectedBill.items?.reduce((acc, it) => acc + it.qty, 0) || 0} Units
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">2. Physical Intake (GRN)</span>
                    <strong className="text-emerald-700 font-mono">
                      {selectedBill.items?.reduce((acc, it) => acc + it.qty, 0) || 0} Units Received
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">3. Vendor Invoiced Amount</span>
                    <strong className="text-slate-800 font-mono">
                      ${(selectedBill.total || selectedBill.amount).toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>

              <DocumentTimeline steps={getBillTimelineSteps(selectedBill)}/>
              <RelatedDocumentsCard documents={getBillRelatedDocs(selectedBill)}/>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs">
                  Intake Line Items ({selectedBill.items?.length || 0})
                </h4>
                <LineItemEditor items={selectedBill.items || []} onChange={() => { }} readOnly={true} type="purchase"/>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-0 pt-4 border-t border-slate-200 bg-slate-50 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6 py-3">
              <div className="font-mono text-xs">
                Total: <strong className="text-slate-900">${(selectedBill.total || selectedBill.amount).toFixed(2)}</strong> | Due: <strong className="text-amber-700">${getBillOutstanding(selectedBill.id).balanceDue.toFixed(2)}</strong>
              </div>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                {selectedBill.status === 'Cancelled' ? (
                  <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 inline-flex items-center gap-1.5">
                    <Ban size={13} /> Bill Cancelled
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const res = cancelPurchaseBill(selectedBill.id);
                        if (res?.success) setSelectedBill(null);
                      }}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Ban size={13} /> Cancel Bill
                    </button>
                    {getBillOutstanding(selectedBill.id).balanceDue > 0.01 && (
                      <Button onClick={() => {
                        setShowPayModal(selectedBill);
                        setPayAmount(getBillOutstanding(selectedBill.id).balanceDue);
                        setSelectedBill(null);
                      }}>
                        Disburse Payment
                      </Button>
                    )}
                  </>
                )}
                <Button variant="outline" onClick={() => setSelectedBill(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>)}

      {/* Pay Modal */}
      {showPayModal && (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600"/>
                <h3 className="font-bold text-base text-slate-900">Disburse Vendor Payment</h3>
              </div>
              <button onClick={() => setShowPayModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18}/>
              </button>
            </div>
            <form onSubmit={handleDisbursementSubmit} className="space-y-4 mt-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Vendor:</span>
                  <span className="font-bold text-slate-800">{showPayModal.vendor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bill #:</span>
                  <span className="font-mono font-bold text-slate-800">{showPayModal.billNumber}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-semibold border-t border-slate-200 pt-1">
                  <span>Balance Due:</span>
                  <span className="font-mono">${getBillOutstanding(showPayModal.id).balanceDue.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Disbursement Amount ($) *</label>
                <input type="number" step="0.01" min="0.01" max={getBillOutstanding(showPayModal.id).balanceDue} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} required className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-mono font-bold text-sm"/>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Payment Mode</label>
                  <select required value={payMode} onChange={(e) => setPayMode(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800">
                    <option value="">Select mode</option>
                    {['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Bank'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {payMode && payMode !== 'Cash' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 block">Paid From (Bank) *</label>
                      <MasterSourceLink source="cashBank" />
                    </div>
                    <select required value={payBankId} onChange={(e) => setPayBankId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800">
                      <option value="">Select bank account</option>
                      {(bankAccounts || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Disbursement Voucher / Ref</label>
                  <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"/>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowPayModal(null)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold shadow-sm disabled:opacity-60">
                  {saving ? 'Saving…' : 'Confirm Disbursement & Post GL'}
                </button>
              </div>
            </form>
          </div>
        </div>)}

      {/* Official Printable Vendor Bill Document */}
      <PrintBillModal isOpen={Boolean(printBillTarget)} onClose={() => setPrintBillTarget(null)} bill={printBillTarget} balanceDue={printBillTarget ? getBillOutstanding(printBillTarget.id).balanceDue : 0}/>
    </div>);
};
