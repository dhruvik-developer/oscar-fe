import React, { useEffect } from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, FileText } from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from './SignatureSlot';
export const PrintBillModal = ({ isOpen, onClose, bill, balanceDue = 0, }) => {
  const docSigs = useDocumentSignatures('PurchaseBill', bill?.id, `Bill ${bill?.billNumber || bill?.number || ""}`);
    // UX only: Esc dismisses. No logic changes.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);
    if (!isOpen || !bill)
        return null;
    const handlePrint = () => {
        window.print();
    };
    const totalAmount = bill.total || bill.amount || 0;
    const isPaid = (balanceDue <= 0.01) || bill.status === 'Paid';
    const paidAmount = isPaid ? totalAmount : Math.max(0, totalAmount - balanceDue);
    return (<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
        {/* Top Control Bar (Screen Only) */}
        <div className="bg-[#1F2E4A] text-white px-4 sm:px-6 py-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 no-print shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-300"/>
            <span className="font-bold text-sm tracking-tight">
              Official Vendor Bill Document — {bill.billNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm">
              <Printer size={14}/>
              Print / Save as PDF
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer" title="Close Preview">
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Real Document Sheet (A4 Proportion) */}
        <div className="overflow-x-auto p-2 sm:p-6 lg:p-0 print:p-0 print:overflow-visible">
        <div className="p-8 sm:p-12 min-w-[720px] lg:min-w-0 print:min-w-0 text-slate-800 bg-white font-sans text-xs space-y-6 printable-document">
          {/* Document Header / Company Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#1F2E4A] text-white flex items-center justify-center font-bold text-lg font-mono">
                  H
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-[#1F2E4A] tracking-tight uppercase">
                    HORIZON ENTERPRISE LOGISTICS
                  </h1>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                    Commercial Intake & Inventory Management
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
                <p>Corporate HQ: 742 Industrial Technology Way, Bldg 4</p>
                <p>San Jose, CA 95134 • GST/Tax Reg: US-8849201-CORP</p>
                <p>Email: finance@horizon-enterprise.internal | Tel: +1 (800) 555-0199</p>
              </div>
            </div>

            {/* Document Meta Block */}
            <div className="text-right space-y-1">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 font-bold font-mono text-xs uppercase tracking-wider rounded border border-slate-300">
                VENDOR PURCHASE BILL
              </span>
              <div className="pt-2 font-mono">
                <p className="text-lg font-black text-slate-900">{bill.billNumber}</p>
                <p className="text-xs text-slate-600">
                  Bill Date: <strong className="text-slate-900">{bill.date || bill.billDate || new Date().toLocaleDateString()}</strong>
                </p>
                <p className="text-xs text-slate-600">
                  Due Date: <strong className="text-slate-900">{bill.dueDate || 'Net 30 Days'}</strong>
                </p>
                <p className="text-xs text-blue-700 font-semibold">
                  Matched PO: {bill.poRef || bill.linkedPo || '—'}
                </p>
              </div>

              {/* Status Stamp */}
              <div className="pt-1">
                {isPaid ? (<span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border-2 border-emerald-600 px-3 py-0.5 rounded uppercase tracking-wider">
                    <CheckCircle2 size={12}/> SETTLED & PAID
                  </span>) : (<span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border-2 border-amber-600 px-3 py-0.5 rounded uppercase tracking-wider">
                    PAYMENT PENDING
                  </span>)}
              </div>
            </div>
          </div>

          {/* Two-Column Billing Parties Info */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            {/* Vendor Details */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                SUPPLIER / VENDOR (BILLED BY)
              </span>
              <p className="text-sm font-bold text-slate-900">{bill.vendor}</p>
              {bill.billingAddress && (bill.billingAddress.street || bill.billingAddress.city) ? (
                <div className="text-slate-600 text-[11px] leading-tight space-y-0.5 pt-0.5">
                  <p>{bill.billingAddress.street}</p>
                  <p>{bill.billingAddress.city}{bill.billingAddress.state ? `, ${bill.billingAddress.state}` : ''}{bill.billingAddress.pincode ? ` - ${bill.billingAddress.pincode}` : ''}</p>
                  <p>{bill.billingAddress.country || 'India'}</p>
                </div>
              ) : (
                <>
                  <p className="text-slate-600 text-[11px]">Authorized Enterprise Hardware Supplier</p>
                  <p className="text-slate-500 text-[11px]">Payment Terms: {bill.dueDate || 'Net 30'}</p>
                  <p className="text-slate-500 text-[11px]">Account ID: VEND-{String(bill.vendor || 'VEN').slice(0, 3).toUpperCase()}-901</p>
                </>
              )}
            </div>

            {/* Buyer / Receiving Dock */}
            <div className="space-y-1 border-l border-slate-200 pl-6">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                CONSIGNEE / SHIP TO
              </span>
              <p className="text-sm font-bold text-slate-900">Horizon Enterprise Corp.</p>
              {bill.shippingAddress && (bill.shippingAddress.street || bill.shippingAddress.city) ? (
                <div className="text-slate-600 text-[11px] leading-tight space-y-0.5 pt-0.5">
                  <p>{bill.shippingAddress.street}</p>
                  <p>{bill.shippingAddress.city}{bill.shippingAddress.state ? `, ${bill.shippingAddress.state}` : ''}{bill.shippingAddress.pincode ? ` - ${bill.shippingAddress.pincode}` : ''}</p>
                  <p>{bill.shippingAddress.country || 'India'}</p>
                </div>
              ) : (
                <>
                  <p className="text-slate-600 text-[11px]">Receiving Dock: Central Warehouse Bay A-1</p>
                  <p className="text-slate-500 text-[11px]">Intake Verification: GRN 3-Way Matched (100%)</p>
                  <p className="text-slate-500 text-[11px]">GL Account: 2010 - Accounts Payable Liability</p>
                </>
              )}
            </div>
          </div>

          {/* Itemized Commercial Table */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Intake Line Items & Valuation Breakdown
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-y-2 border-slate-800 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item SKU & Description</th>
                  <th className="py-2.5 px-3 text-center">Qty Received</th>
                  <th className="py-2.5 px-3 text-right">Unit Rate ($)</th>
                  <th className="py-2.5 px-3 text-center">Tax</th>
                  <th className="py-2.5 px-3 text-right">Total Amount ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(!bill.items || bill.items.length === 0) ? (<tr>
                    <td className="py-2.5 px-3 text-center font-mono">1</td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900">Enterprise Hardware Intake</p>
                      <p className="text-[10px] text-slate-500 font-mono">SKU-HW-DEFAULT • Storage Bay A-1</p>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold">1</td>
                    <td className="py-2.5 px-3 text-right font-mono">${totalAmount.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-center text-slate-500">0%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      ${totalAmount.toFixed(2)}
                    </td>
                  </tr>) : ((bill?.items || []).map((it, idx) => (<tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900">{it.description || it.itemSku || 'Part Item'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">SKU: {it.itemSku || `SKU-PART-${idx + 1}`}</p>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">{it.qty}</td>
                      <td className="py-2.5 px-3 text-right font-mono">${it.rate.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{it.tax || 0}%</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ${(it.amount || it.qty * it.rate).toFixed(2)}
                      </td>
                    </tr>)))}
              </tbody>
            </table>
          </div>

          {/* Subtotals and Net Payable Summary */}
          <div className="flex items-start justify-between pt-3 border-t-2 border-slate-800">
            {/* 3-Way Match Audit Verification Note */}
            <div className="max-w-xs space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-[10px] uppercase text-slate-600 flex items-center gap-1 tracking-wider">
                <ShieldCheck size={13} className="text-emerald-600"/>
                Audit Verification Details
              </span>
              <p className="text-[10px] text-slate-500 leading-normal">
                This bill has been matched against Purchase Order <strong>{bill.poRef || bill.linkedPo || '—'}</strong> and verified at the warehouse goods receiving dock. All items entered into physical stock.
              </p>
            </div>

            {/* Calculations Box */}
            <div className="w-72 space-y-1.5 font-mono text-xs text-right">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Net Excl. Tax):</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax / VAT (0.0%):</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Freight & Handling:</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-300">
                <span>Total Billed Amount:</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-emerald-700">
                <span>Total Disbursed (Paid):</span>
                <span>-${paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-rose-700 pt-1 border-t-2 border-slate-900 bg-slate-50 p-1.5 rounded">
                <span>Outstanding Balance Due:</span>
                <span>${balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Legal Signatures & Authorization Blocks */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-xs">
            <div className="space-y-8">
              <div className="border-b border-slate-400 pb-1">
                <SignatureSlot doc={docSigs} signatory="inspector" label="GRN Intake Verification" modalType="authorized" defaultDesignation="Warehouse Receiving Dock Inspector"
                  placeholder={<span className="font-mono text-slate-400 text-[10px] italic">GRN Intake Verified & Stamped</span>} />
              </div>
              <div>
                <p className="font-bold text-slate-900">Warehouse Receiving Dock Inspector</p>
                <p className="text-[10px] text-slate-500">Horizon Logistics Receiving Authority</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="border-b border-slate-400 pb-1">
                <SignatureSlot doc={docSigs} signatory="authorized" label="Accounts Payable Authorization" modalType="authorized" defaultDesignation="Corporate Finance & Comptroller"
                  placeholder={<span className="font-mono text-slate-400 text-[10px] italic">Accounts Payable Authorization</span>} />
              </div>
              <div>
                <p className="font-bold text-slate-900">Corporate Finance & Comptroller</p>
                <p className="text-[10px] text-slate-500">Horizon Enterprise Finance Department</p>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
            Official Enterprise Record generated by Horizon ERP v2.0 • Retain this voucher for tax compliance & financial auditing.
          </div>
        </div>
        </div>

        {/* Modal Footer (Screen Only) */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex flex-wrap lg:flex-nowrap justify-between items-center gap-2 lg:gap-0 no-print shrink-0">
          <span className="text-xs text-slate-500">
            Press <strong>Ctrl+P</strong> or click <strong>Print</strong> to generate a clean A4 PDF.
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white font-semibold text-xs transition cursor-pointer">
              Close
            </button>
            <button onClick={handlePrint} className="px-5 py-2 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm">
              <Printer size={14}/>
              Print Bill
            </button>
          </div>
        </div>
      </div>
    </div>);
};
