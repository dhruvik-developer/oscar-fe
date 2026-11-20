import React, { useEffect } from 'react';
import { X, Printer, CheckCircle2, ShieldCheck } from 'lucide-react';

export const PaymentReceiptModal = ({ receipt, onClose }) => {

  useEffect(() => {
    if (!receipt) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [receipt, onClose]);

  if (!receipt) return null;

  const totalReceived = Number(receipt.amount || 0);
  const appliedToInvoice = receipt.appliedToInvoice !== undefined
    ? Number(receipt.appliedToInvoice)
    : (receipt.allocatedAmount !== undefined
      ? Number(receipt.allocatedAmount)
      : (receipt.allocated_amount !== undefined ? Number(receipt.allocated_amount) : totalReceived));
  const customerAdvance = receipt.customerAdvance !== undefined
    ? Number(receipt.customerAdvance)
    : (receipt.unallocatedAmount !== undefined
      ? Number(receipt.unallocatedAmount)
      : Math.max(0, Math.round((totalReceived - appliedToInvoice) * 100) / 100));
  const discountTotal = Number(receipt.discountTotal || 0);
  const totalSettled = Number(receipt.totalSettled || (appliedToInvoice + discountTotal));

  const fmt = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150" onClick={onClose} role="dialog" aria-modal="true" aria-label="Official payment receipt">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-4 sm:p-6 shadow-2xl text-xs flex flex-col max-h-[95vh] overflow-y-auto printable-document" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center border border-emerald-200">
              <CheckCircle2 size={18}/>
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1F2E4A]">Official Payment Receipt</h3>
              <span className="font-mono text-[11px] text-slate-500 font-semibold">{receipt.receiptNumber}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18}/>
          </button>
        </div>

        {/* Receipt Voucher Body */}
        <div className="py-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start border-b border-slate-200 pb-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Received From (Customer)</span>
                <p className="font-bold text-base text-slate-900 mt-0.5">{receipt.customer}</p>
                {receipt.invoiceNumber && (
                  <p className="text-[11px] text-slate-500">Target Invoice: <span className="font-mono font-semibold text-slate-700">{receipt.invoiceNumber}</span></p>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Date Received</span>
                <p className="font-semibold text-slate-800 mt-0.5 font-mono">{receipt.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Payment Mode</span>
                <p className="font-semibold text-slate-800">{receipt.paymentMode || 'Bank Transfer'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Transaction Reference</span>
                <p className="font-mono font-semibold text-slate-800">{receipt.reference || '—'}</p>
              </div>
            </div>

            {/* Total Amount Received Prominent Card */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between mt-2">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total Amount Received</span>
                <span className="text-[11px] text-emerald-700">Debited to Bank/Cash account</span>
              </div>
              <span className="font-mono font-bold text-xl text-emerald-800">
                ₹{fmt(totalReceived)}
              </span>
            </div>

            {/* Breakdown: Applied to Invoice, Discounts, and Customer Advance */}
            <div className="space-y-2 mt-3 border-t border-slate-200 pt-3 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-medium">Amount Applied to Invoice{receipt.invoiceNumber ? ` (${receipt.invoiceNumber})` : ''}:</span>
                <span className="font-mono font-semibold text-slate-900">₹{fmt(appliedToInvoice)}</span>
              </div>

              {discountTotal > 0 && (
                <div className="flex justify-between items-center text-amber-700">
                  <span className="font-medium">Sales Discount Granted:</span>
                  <span className="font-mono font-semibold">₹{fmt(discountTotal)}</span>
                </div>
              )}

              {customerAdvance > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-indigo-900 block">Customer Advance:</span>
                    <span className="text-[10.5px] text-indigo-700">Held on customer account for future invoices</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-indigo-800">
                    ₹{fmt(customerAdvance)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-dashed border-slate-200 text-[11px]">
                <span>Total Invoice Settlement:</span>
                <span className="font-mono font-semibold text-slate-700">₹{fmt(totalSettled)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
            <ShieldCheck size={12} className="text-emerald-600"/>
            OSCAR ERP System Generated Voucher
          </span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold flex items-center gap-1 cursor-pointer">
              <Printer size={13}/> Print Voucher
            </button>
            <button onClick={onClose} className="px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/95 font-semibold cursor-pointer">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
