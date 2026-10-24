import React, { useEffect } from 'react';
import { X, Printer, RotateCcw, Building2, Calendar, FileText } from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from './SignatureSlot';

export const PrintDebitNoteModal = ({
  isOpen,
  onClose,
  debitNote,
}) => {
  const docSigs = useDocumentSignatures('DebitNote', debitNote?.id, `Debit Note ${debitNote?.debitNoteNumber || ''}`);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !debitNote) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalAmount = debitNote.totalCredit || debitNote.total || 0;
  const items = debitNote.items || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
        {/* Top Control Bar (Screen Only) */}
        <div className="bg-[#1F2E4A] text-white px-4 sm:px-6 py-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 no-print shrink-0">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-sm tracking-tight">
              Official Commercial Debit Note / Purchase Return Voucher — {debitNote.debitNoteNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Printer size={14} />
              Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Real Document Sheet (A4 Proportion) */}
        <div className="overflow-x-auto p-2 sm:p-6 lg:p-0 print:p-0 print:overflow-visible">
        <div className="p-8 sm:p-12 min-w-[720px] lg:min-w-0 print:min-w-0 text-slate-800 bg-white font-sans text-xs space-y-6 printable-document">
          {/* Header / Corporate Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#1F2E4A] text-white flex items-center justify-center font-bold text-lg font-mono">
                  E
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-[#1F2E4A] tracking-tight uppercase">
                    EVENMORE ERP MEDICAL & SYSTEMS
                  </h1>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                    Enterprise Healthcare & Surgical Equipment Division
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
                <p>Corporate Towers, Sector 62, Electronic City • Bengaluru, Karnataka 560100</p>
                <p>Tax Registration / GSTIN: <strong className="text-slate-700">29AABCU8912E1ZB</strong> • PAN: <strong className="text-slate-700">AABCU8912E</strong></p>
                <p>Accounts Payable Desk: ap-reconciliation@evenmore.internal | +91 80 4920 1100</p>
              </div>
            </div>

            {/* Document Meta Block */}
            <div className="text-right space-y-1">
              <span className="inline-block px-3 py-1 bg-rose-900 text-white font-bold font-mono text-xs uppercase tracking-wider rounded">
                COMMERCIAL DEBIT NOTE
              </span>
              <div className="pt-2 font-mono">
                <p className="text-lg font-black text-slate-900">{debitNote.debitNoteNumber}</p>
                <p className="text-xs text-slate-600">
                  Voucher Date: <strong className="text-slate-900">{debitNote.date}</strong>
                </p>
                <p className="text-xs text-slate-600">
                  Original Purchase Bill: <strong className="text-blue-900">{debitNote.billRef || 'N/A'}</strong>
                </p>
                <p className="text-xs text-slate-600">
                  Ledger Impact: <strong className="text-rose-700">Vendor AP Write-Down</strong>
                </p>
              </div>

              <div className="pt-1">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-0.5 rounded uppercase tracking-wider border ${
                  debitNote.status === 'Settled'
                    ? 'text-emerald-800 bg-emerald-50 border-emerald-600'
                    : 'text-amber-800 bg-amber-50 border-amber-600'
                }`}>
                  {debitNote.status || 'Pending Credit'}
                </span>
              </div>
            </div>
          </div>

          {/* Two-Column Buyer & Vendor Info */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                ISSUED BY (BUYER / PURCHASER)
              </span>
              <p className="font-bold text-sm text-slate-900">EVENMORE SYSTEMS PRIVATE LIMITED</p>
              <p className="text-slate-600">Central Warehouse & Receiving Dock 4</p>
              <p className="text-slate-600">Electronic City, Phase 1, Bengaluru, KA 560100</p>
              <p className="text-slate-600">GSTIN: 29AABCU8912E1ZB</p>
            </div>

            <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-6">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                SUPPLIER / VENDOR (BENEFICIARY)
              </span>
              <p className="font-bold text-sm text-blue-900">{debitNote.vendor}</p>
              <p className="text-slate-600">Vendor Code / Accounts Payable Profile</p>
              <p className="text-slate-600">Original Tax Bill Reference: <strong>{debitNote.billRef}</strong></p>
              <p className="text-slate-600">Reason for Reversal: <span className="italic text-rose-800 font-medium">{debitNote.reason}</span></p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Returned Hardware & Components ({items.length} Lines)
            </span>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Description / Item SKU</th>
                    <th className="py-2.5 px-2 text-center">Intake Condition</th>
                    <th className="py-2.5 px-3 text-right">Returned Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right">Credit Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const rate = Number(item.rate || item.unitRate || 0);
                    const qty = Number(item.qty || item.returnedQty || 1);
                    const lineTotal = Number(item.total || rate * qty);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-800">{item.name || item.description || item.sku}</p>
                          {item.sku && <p className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</p>}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.condition === 'Good'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {item.condition || 'Damaged'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{qty}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Financial Breakdown */}
          <div className="grid grid-cols-2 gap-6 pt-2">
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-[11px]">
              <span className="font-bold text-slate-700 uppercase tracking-wider block">
                Accounting & AP Adjustment Instructions
              </span>
              <p className="text-slate-600 leading-relaxed">
                This Debit Note certifies the physical return / rejection of aforementioned items. Kindly credit our open account or issue a corresponding Credit Memo against bill <strong>{debitNote.billRef}</strong>.
              </p>
              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                <p>• Goods Inspection Authority: Quality Assurance & Intake Team</p>
                <p>• Reverse Logistics Docket: Assigned upon return dispatch</p>
              </div>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-2 font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Line Items Credit):</span>
                <span>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax Reversal Adjustment:</span>
                <span>Included in Item Value</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Restocking Fee / Deductions:</span>
                <span>₹0.00</span>
              </div>
              <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                <span className="text-xs uppercase tracking-wider">Total Debit / Credit Claimed:</span>
                <span className="text-base text-rose-700">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Commercial Terms & Conditions */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-[10px] text-slate-500 bg-slate-50/50">
            <p className="font-bold uppercase tracking-wider text-slate-700">Terms of Debit Memo Adjustment</p>
            <ol className="list-decimal pl-4 space-y-0.5 leading-normal">
              <li>Debit note value shall be directly adjusted against outstanding payables for bill ref: <strong>{debitNote.billRef}</strong>.</li>
              <li>Replaced items or vendor credit memo should reference Debit Note # <strong>{debitNote.debitNoteNumber}</strong>.</li>
              <li>Discrepancies in quantities or intake condition inspection must be reported within 5 business days of document receipt.</li>
            </ol>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 pt-6 border-t border-slate-200 text-center text-xs">
            <div className="space-y-10">
              <p className="text-slate-400 uppercase text-[10px] font-bold">QA Intake Inspector / Prepared By</p>
              <div className="border-b border-slate-300 w-3/4 mx-auto pb-1">
                <SignatureSlot doc={docSigs} signatory="prepared" label="QA Intake Inspector / Prepared By" modalType="authorized" defaultDesignation="QA Intake Inspector" />
              </div>
              <p className="font-semibold text-slate-700 text-[11px]">Quality Control Department</p>
            </div>
            <div className="space-y-10">
              <p className="text-slate-400 uppercase text-[10px] font-bold">Commercial Accounts & Authorized Signatory</p>
              <div className="border-b border-slate-300 w-3/4 mx-auto pb-1">
                <SignatureSlot doc={docSigs} signatory="authorized" label="Commercial Accounts & Authorized Signatory" modalType="authorized" defaultDesignation="Commercial Accounts — Authorized Signatory" />
              </div>
              <p className="font-semibold text-slate-700 text-[11px]">Evenmore Systems Private Limited</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
            Commercial document generated by Evenmore ERP Unified Platform • Official Legal & Tax Document
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
