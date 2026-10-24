import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Plus, RotateCcw, CheckCircle2, X, Ban, AlertCircle, Eye, Printer, MapPin } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { PrintDebitNoteModal } from '../../components/common/PrintDebitNoteModal';
const purchaseReturnGuide = {
    title: 'Purchase Returns & Debit Notes',
    subtitle: 'Supplier RMA, debit memo issuance, selective item returns, and payables write-down',
    purpose: 'Use this page when purchased items arrive damaged, defective, or incorrect. Issuing a Debit Note reduces your stock quantity (or flags damaged quarantine) and deducts the amount from your vendor Accounts Payable balance.',
    workflow: ['Inspect Intake Goods', 'Detect Defect / Issue', 'Select Items & Quantities', 'Issue Debit Note', 'AP Balance Reduced'],
    keyTerms: [
        {
            term: 'Debit Note / Debit Memo',
            definition: 'A commercial document issued by a buyer to notify a supplier that their payable balance is being debited/reduced.',
        },
        {
            term: 'Selective Return',
            definition: 'Return specific line items and quantities rather than an entire purchase bill.',
        },
        {
            term: 'Return Condition',
            definition: 'Good items reduce regular available stock; Damaged or Scrap items are recorded without reducing sellable on-hand inventory.',
        },
        {
            term: 'Stock Reversal',
            definition: 'Automatically decreasing on-hand inventory when components are shipped back to the vendor.',
        },
    ],
    tips: [
        'Select the target purchase bill to inspect line items and specify the exact return quantities and condition.',
        'Once a debit note is settled, it automatically reconciles in the Vendor 360° Statement.',
    ],
};
export const PurchaseReturnsPage = () => {
    const { purchaseReturns, vendors, purchaseBills, addPurchaseReturn, cancelPurchaseReturn, updatePurchaseReturnStatus, formatCurrency, formatDateDDMMYYYY, getCurrentISODate } = useERP();
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedBillId, setSelectedBillId] = useState('');
    const [reason, setReason] = useState('');
    const [returnDate, setReturnDate] = useState(() => getCurrentISODate());
    const [saving, setSaving] = useState(false);
    const [returnItems, setReturnItems] = useState([]);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [printReturnTarget, setPrintReturnTarget] = useState(null);

    const handleBillSelect = (billId) => {
        setSelectedBillId(billId);
        const bill = purchaseBills.find((b) => b.id === billId);
        if (!bill) {
            setReturnItems([]);
            return;
        }

        const prevReturns = purchaseReturns.filter((pr) => pr.billId === bill.id && pr.status !== 'Cancelled');

        const initialLines = (bill.items || []).map((line, idx) => {
            const billedQty = Number(line.qty || 0);
            // The server tracks what each bill line has had returned.
            const prevReturned = line.returnedQty !== undefined
                ? Number(line.returnedQty) || 0
                : prevReturns.reduce((sum, pr) => {
                    const match = (pr.items || []).find((it) => it.purchaseBillLineId === line.id);
                    return sum + Number(match?.qty || 0);
                }, 0);
            const returnableQty = Math.max(0, billedQty - prevReturned);
            const isSerial = Boolean(line.selectedSerials?.length || line.serialNumbers?.length || line.serialNumber);
            const availableSerials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : []);
            // [PHASE-2A] weight-item return: carry kg meta + default returned weight = theoretical × qty
            const isWeightItem = Boolean(line.isWeightItem);
            const theoreticalWeight = Number(line.theoreticalWeight) || 0;
            return {
                id: line.id || `prt-line-${idx}`,
                purchaseBillLineId: line.id,
                itemId: line.itemId,
                sku: line.sku || line.itemSku || '',
                description: line.name || line.description || '',
                uom: line.uom,
                tax: line.tax,
                discount: line.discount,
                isWeightItem,
                theoreticalWeight,
                returnedWeight: isWeightItem ? 0 : undefined,
                billedQty,
                previouslyReturnedQty: prevReturned,
                returnableQty,
                qty: 0,
                rate: Number(line.rate || line.unitCost || 0),
                condition: 'Good',
                isSerial,
                availableSerials,
                selectedSerials: [],
            };
        });

        setReturnItems(initialLines);
    };

    const handleItemChange = (idx, field, value) => {
        setReturnItems((prev) => prev.map((item, i) => {
            if (i !== idx) return item;
            const updated = { ...item, [field]: value };
            if (field === 'qty') {
                const num = Math.max(0, Math.min(Number(value) || 0, item.returnableQty));
                updated.qty = num;
                if (updated.isSerial) {
                    updated.selectedSerials = (updated.availableSerials || []).slice(0, num);
                }
                // [PHASE-2A] keep returned weight in sync with returned qty for steel lines
                if (updated.isWeightItem && updated.theoreticalWeight) {
                    updated.returnedWeight = Number((updated.theoreticalWeight * num).toFixed(3));
                }
            }
            return updated;
        }));
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const bill = purchaseBills.find((b) => b.id === selectedBillId);
        if (!bill) {
            alert('Select the purchase bill being returned against.');
            return;
        }
        const activeLines = returnItems.filter((it) => Number(it.qty) > 0);
        if (activeLines.length === 0) {
            alert('Please specify at least 1 item with return quantity > 0.');
            return;
        }
        if (!reason.trim()) {
            alert('Enter the reason for the return.');
            return;
        }
        setSaving(true);
        try {
            await addPurchaseReturn({
                billId: bill.id,
                date: returnDate,
                reason: reason.trim(),
                items: activeLines,
            });
            setShowAddModal(false);
            setReturnItems([]);
            setReason('');
        } catch {
            // The reason was shown; the form stays open.
        } finally {
            setSaving(false);
        }
    };

    const billNumberOf = (r) => r?.billRef || purchaseBills.find((b) => b.id === r?.billId)?.billNumber || '';

    const markSettled = (id) => {
        updatePurchaseReturnStatus(id, 'Settled');
    };

    const activeTotalAmount = returnItems.filter(it => it.qty > 0).reduce((sum, it) => sum + (it.qty * it.rate), 0);

    const columns = [
        {
            key: 'debitNoteNumber',
            header: 'Debit Note #',
            width: '15%',
            render: (r) => (
              <button onClick={() => setSelectedReturn(r)} className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5 whitespace-nowrap cursor-pointer text-left">
                <RotateCcw size={13} className="text-rose-600 dark:text-rose-400 shrink-0"/>
                <span>{r.debitNoteNumber}</span>
              </button>
            ),
        },
        {
            key: 'vendor',
            header: 'Vendor Supplier',
            width: '20%',
            render: (r) => <span className="font-bold text-text block">{r.vendor}</span>,
        },
        {
            key: 'billRef',
            header: 'Matched Bill Ref',
            width: '14%',
            render: (r) => <span className="font-mono text-primary font-semibold whitespace-nowrap">{billNumberOf(r) || '—'}</span>,
        },
        {
            key: 'date',
            header: 'Issue Date',
            width: '12%',
            render: (r) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(r.date)}</span>,
        },
        {
            key: 'reason',
            header: 'Defect / Return Reason',
            width: '15%',
            render: (r) => <span className="text-muted text-[11px] block">{r.reason}</span>,
        },
        {
            key: 'amount',
            header: 'Debit Amount',
            align: 'right',
            width: '12%',
            render: (r) => (
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                {formatCurrency(r.amount ?? 0)}
              </span>
            ),
        },
        {
            key: 'status',
            header: 'Settlement Status',
            align: 'center',
            width: '11%',
            render: (r) => <StatusBadge status={r.status}/>,
        },
        {
            key: 'actions',
            header: 'Reconciliation',
            align: 'right',
            width: '15%',
            render: (r) => {
                const isCancelled = r.status === 'Cancelled';
                return (
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedReturn(r)}
                      className="p-1.5 text-muted hover:text-primary hover:bg-card-hover rounded-lg cursor-pointer transition-colors"
                      title="View Return Details"
                    >
                      <Eye size={13}/>
                    </button>
                    <button
                      onClick={() => setPrintReturnTarget(r)}
                      className="p-1.5 text-muted hover:text-primary hover:bg-card-hover rounded-lg cursor-pointer transition-colors"
                      title="Print Official Debit Note Voucher"
                    >
                      <Printer size={13}/>
                    </button>
                    {isCancelled ? (
                      <span className="text-xs font-semibold text-rose-600 inline-flex items-center gap-1">
                        <Ban size={11} /> Cancelled
                      </span>
                    ) : r.status !== 'Settled' ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => cancelPurchaseReturn(r.id)}
                          className="p-1 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title="Cancel Debit Note & Restore Stock"
                        >
                          <Ban size={13} />
                        </button>
                        <button
                          onClick={() => markSettled(r.id)}
                          className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-white rounded-xl text-[11px] font-semibold cursor-pointer flex items-center gap-1 shadow-2xs whitespace-nowrap transition-colors"
                        >
                          <CheckCircle2 size={11}/> Mark Credit
                        </button>
                      </div>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1 justify-end whitespace-nowrap">
                        <CheckCircle2 size={12}/> Settled
                      </span>
                    )}
                  </div>
                );
            },
        },
    ];

    return (<div className="space-y-6">
      <PageHeader title="Purchase Returns & Debit Notes" subtitle="Supplier debit memos, selective line-item returns, condition tracking, inventory reductions, and Accounts Payable ledger write-downs." guide={purchaseReturnGuide} actions={<Button icon={Plus} onClick={() => {
                handleBillSelect('');
                setReason('');
                setReturnDate(getCurrentISODate());
                setShowAddModal(true);
            }}>
            Create Debit Note
          </Button>}/>

      <DataTable title="Vendor Return Debit Notes" columns={columns} data={purchaseReturns} keyExtractor={(r) => r.id} searchPlaceholder="Search debit note # or vendor..." searchFilter={(r, term) => String(r.debitNoteNumber ?? '').toLowerCase().includes(term) ||
            String(r.vendor ?? '').toLowerCase().includes(term) ||
            String(billNumberOf(r) ?? '').toLowerCase().includes(term) ||
            String(r.reason ?? '').toLowerCase().includes(term)}/>

      {/* Create Debit Note Modal */}
      {showAddModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full p-4 sm:p-6 text-xs max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-[#1F2E4A]">
                  Issue Selective Vendor Debit Note
                </h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Vendor Bill *</label>
                  <select required value={selectedBillId} onChange={(e) => handleBillSelect(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">Select bill</option>
                    {purchaseBills.filter((b) => b.status !== 'Cancelled').map((b) => (<option key={b.id} value={b.id}>
                        {b.billNumber} - {b.vendor} ({formatCurrency(b.total || b.amount)})
                      </option>))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reason for Return / Rejection</label>
                  <input type="text" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Shade mismatch, short width..." className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"/>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Return Date *</label>
                  <input type="date" required value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"/>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-3 lg:gap-x-0 gap-y-1 lg:gap-y-0 mb-2">
                  <label className="font-semibold text-slate-700 block">
                    Selective Item Quantities & Conditions
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Specify return quantity for each item (Max = Returnable Qty)
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full min-w-[820px] lg:min-w-0 text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3">Item Description / SKU</th>
                        <th className="py-2.5 px-2 text-center w-20">Billed</th>
                        <th className="py-2.5 px-2 text-center w-24">Prev. Ret</th>
                        <th className="py-2.5 px-2 text-center w-24">Returnable</th>
                        <th className="py-2.5 px-2 text-center w-28">Return Qty</th>
                        <th className="py-2.5 px-2 text-center w-28">Returned Wt (kg)</th>
                        <th className="py-2.5 px-2 text-center w-36">Condition</th>
                        <th className="py-2.5 px-3 text-right w-28">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {returnItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-400">
                            No line items found on selected bill.
                          </td>
                        </tr>
                      ) : (
                        returnItems.map((line, idx) => (
                          <tr key={idx} className={line.qty > 0 ? 'bg-rose-50/30' : ''}>
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-slate-800">{line.description}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{line.sku}</p>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700">
                              {line.billedQty}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-500">
                              {line.previouslyReturnedQty}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-700">
                              {line.returnableQty}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={line.returnableQty}
                                value={line.qty}
                                disabled={line.returnableQty <= 0}
                                onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                                className="w-20 p-1 text-center font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900 disabled:bg-slate-100"
                              />
                            </td>
                            {/* [PHASE-2A] weighed kg returned (steel) */}
                            <td className="py-2.5 px-2 text-center">
                              {line.isWeightItem ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.returnedWeight ?? ''}
                                  disabled={line.qty <= 0}
                                  onChange={(e) => handleItemChange(idx, 'returnedWeight', e.target.value)}
                                  className="w-24 p-1 text-center font-mono font-bold border border-blue-200 rounded-lg bg-white text-slate-900 disabled:bg-slate-100"
                                  title="Weighed kg returned on the weighbridge"
                                />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <select
                                value={line.condition}
                                onChange={(e) => handleItemChange(idx, 'condition', e.target.value)}
                                className="w-full p-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                              >
                                <option value="Good">Good (Restock)</option>
                                <option value="Damaged">Damaged (Quarantine)</option>
                                <option value="Scrap">Scrap / Dispose</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(line.qty * line.rate)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-0 pt-3 border-t border-slate-200">
                <div className="font-mono text-xs">
                  Total Debit Amount: <strong className="text-rose-600 text-sm">{formatCurrency(activeTotalAmount)}</strong>
                </div>
                <div className="flex flex-wrap lg:flex-nowrap gap-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || activeTotalAmount <= 0} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-sm cursor-pointer">
                    Issue Debit Note & Post AP Reduction
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>)}

      {/* Return Detail Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-200">
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3 min-w-0 lg:min-w-auto">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-lg text-[#1F2E4A]">{selectedReturn.debitNoteNumber}</h3>
                <span className="font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">
                  {selectedReturn.vendor}
                </span>
                <StatusBadge status={selectedReturn.status}/>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintReturnTarget(selectedReturn)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={13} /> Print Debit Note
                </button>
                <button onClick={() => setSelectedReturn(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                  <X size={18}/>
                </button>
              </div>
            </div>

            <div className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Vendor & Matched Bill</span>
                    <strong className="text-slate-900 text-sm block">{selectedReturn.vendor}</strong>
                    <p className="text-slate-600 text-xs mt-1">Matched Bill: <strong>{billNumberOf(selectedReturn) || '—'}</strong></p>
                    <p className="text-slate-600 text-xs">Return Date: <strong>{formatDateDDMMYYYY(selectedReturn.date)}</strong></p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Defect Reason</span>
                    <p className="text-slate-800 bg-white p-2 rounded-lg border border-slate-200">{selectedReturn.reason}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs mb-2">
                  Returned Line Items ({selectedReturn.items?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[560px] lg:min-w-0 text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-2 text-center">Condition</th>
                        <th className="py-2 px-2 text-center">Returned Qty</th>
                        <th className="py-2 px-3 text-right">Unit Rate</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedReturn.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {it.name || it.description || it.sku}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              it.condition === 'Good' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {it.condition || 'Good'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-900">{it.qty}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCurrency(it.rate || 0)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                            {formatCurrency((it.qty || 1) * (it.rate || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-0 pt-4 border-t border-slate-200 bg-slate-50 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6 py-3">
              <div className="font-mono text-xs">
                Total Credit Value: <strong className="text-rose-600 text-sm">{formatCurrency(selectedReturn.amount || 0)}</strong>
              </div>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                {selectedReturn.status !== 'Cancelled' && selectedReturn.status !== 'Settled' && (
                  <button
                    type="button"
                    onClick={() => {
                      cancelPurchaseReturn(selectedReturn.id);
                      setSelectedReturn(null);
                    }}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Ban size={13} /> Cancel Debit Note
                  </button>
                )}
                {selectedReturn.status !== 'Cancelled' && selectedReturn.status !== 'Settled' && (
                  <Button onClick={() => {
                    markSettled(selectedReturn.id);
                    setSelectedReturn(null);
                  }}>
                    Acknowledge Supplier Credit
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedReturn(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Executive Debit Note Print Voucher */}
      <PrintDebitNoteModal
        isOpen={Boolean(printReturnTarget)}
        onClose={() => setPrintReturnTarget(null)}
        debitNote={printReturnTarget}
      />
    </div>);
};
