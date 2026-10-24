import React, { useEffect } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from './SignatureSlot';
export const PaymentReceiptModal = ({ receipt, onClose }) => {
  const docSigs = useDocumentSignatures('PaymentReceipt', receipt?.id || receipt?.receiptNumber, `Payment Receipt ${receipt?.receiptNumber || ''}`);
    // UX only: Esc dismisses. No logic changes.
    useEffect(() => {
        if (!receipt) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [receipt, onClose]);
    if (!receipt)
        return null;
    return (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150" onClick={onClose} role="dialog" aria-modal="true" aria-label="Official payment receipt">
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
                <p className="text-[11px] text-slate-500">Settlement for Invoice #{receipt.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Date Received</span>
                <p className="font-semibold text-slate-800 mt-0.5">{receipt.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Payment Mode</span>
                <p className="font-semibold text-slate-800">{receipt.paymentMode}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Transaction Ref / Cheque #</span>
                <p className="font-mono font-semibold text-slate-800">{receipt.reference}</p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between mt-2">
              <span className="font-bold text-emerald-900">Total Amount Settled:</span>
              <span className="font-mono font-bold text-lg text-emerald-800">
                ${receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="border border-dashed border-slate-200 rounded-xl p-3 text-center space-y-2">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Horizon Accounts Department</span>
              <div className="border-b border-slate-300 pb-1">
                <SignatureSlot doc={docSigs} signatory="authorized" label="Accounts — Authorized Signatory" modalType="authorized" className="h-10"
                  defaultDesignation="Accounts Department — Authorized Signatory"
                  placeholder={<span className="font-mono text-[10px] text-slate-600">Authorized Signatory</span>} />
              </div>
            </div>
            <div className="border border-dashed border-slate-200 rounded-xl p-3 text-center space-y-2">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Customer Acknowledgment</span>
              <div className="border-b border-slate-300 pb-1">
                <SignatureSlot doc={docSigs} signatory="customer" label="Customer Acknowledgment" modalType="receiver" className="h-10"
                  defaultName={receipt?.customer || ''} defaultDesignation="Customer — Received & Verified"
                  placeholder={<span className="font-mono text-[10px] text-slate-600">Received & Verified</span>} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-3 border-t border-slate-200">
          <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 size={12}/> Ledger GL Posted & Invoice Settled
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-3.5 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs">
              <Printer size={13}/> Print Receipt
            </button>
            <button onClick={onClose} className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium cursor-pointer">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>);
};
