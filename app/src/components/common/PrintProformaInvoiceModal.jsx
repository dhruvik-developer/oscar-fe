import React, { useEffect } from 'react';
import { X, Printer, FileSpreadsheet, Clock, Info } from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from './SignatureSlot';
import { useERP } from '../../context/ERPContext';

export const PrintProformaInvoiceModal = ({
  isOpen,
  onClose,
  proforma,
}) => {
  const docSigs = useDocumentSignatures('ProformaInvoice', proforma?.id, `Proforma Invoice ${proforma?.proformaNumber || ''}`);
  // [PHASE-2E.1] company profile drives letterhead; GSTIN was hardcoded 29AABCU9912E1Z8
  const { companyProfile } = useERP();
  const companyName = companyProfile?.name || 'EVENMORE ERP MEDICAL & SYSTEMS';
  const companyShort = (companyName || 'E').trim().charAt(0).toUpperCase() || 'E';
  const gstin = companyProfile?.gstin || '';
  const pan = companyProfile?.pan || '';
  const companyAddress = companyProfile?.address || 'Corporate Towers, Sector 62, Electronic City • Bengaluru, Karnataka 560100';
  const phone = companyProfile?.phone || '+91 80 4920 1100';
  const companyStateCode = (gstin || '').slice(0, 2).toUpperCase();
  // Same as PrintInvoiceModal: evaluated while `proforma` is still null.
  const posRaw = String(proforma?.placeOfSupplyState || proforma?.placeOfSupply || proforma?.billingAddress?.state || '');
  const posMatch = posRaw.match(/(\d{2})/);
  const posStateCode = posMatch ? posMatch[1] : posRaw.slice(0, 2).toUpperCase();
  const hasStates = Boolean(companyStateCode && posStateCode);
  const isIntraState = hasStates && companyStateCode === posStateCode;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !proforma) return null;

  const handlePrint = () => {
    window.print();
  };

  const items = proforma.items || [];
  const taxableAmount = proforma.taxableAmount || items.reduce((sum, it) => sum + (Number(it.rate || 0) * Number(it.qty || 1)), 0);
  const calculatedTax = items.reduce((sum, it) => {
    const rate = Number(it.rate || 0);
    const qty = Number(it.qty || 1);
    const tr = Number(it.tax ?? it.taxRate ?? 5);
    return sum + ((rate * qty * tr) / 100);
  }, 0);
  const taxAmount = proforma.taxAmount || calculatedTax || (taxableAmount * 0.05);
  const grandTotal = proforma.grandTotal || proforma.total || (taxableAmount + taxAmount);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
        {/* Top Control Bar (Screen Only) */}
        <div className="bg-[#1F2E4A] text-white px-4 sm:px-6 py-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 no-print shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-300" />
            <span className="font-bold text-sm tracking-tight">
              Official Proforma Invoice Document — {proforma.proformaNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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

        {/* Real Proforma Sheet (A4 Proportion) */}
        <div className="overflow-x-auto p-2 sm:p-6 lg:p-0 print:p-0 print:overflow-visible">
        <div className="p-8 sm:p-12 min-w-[720px] lg:min-w-0 print:min-w-0 text-slate-800 bg-white font-sans text-xs space-y-6 printable-document">
          {/* Header / Corporate Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#1F2E4A] text-white flex items-center justify-center font-bold text-lg font-mono">
                  {companyShort}
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-[#1F2E4A] tracking-tight uppercase">
                    {companyName}
                  </h1>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                    Steel Fabrication &amp; MS Table Manufacturing
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
                <p>{companyAddress}</p>
                <p>Tax Registration / GSTIN: <strong className="text-slate-700">{gstin || '—'}</strong>{pan ? <> • PAN: <strong className="text-slate-700">{pan}</strong></> : ''}</p>
                <p>Commercial Billing Desk: billing@sweven.in | {phone}</p>
              </div>
            </div>

            {/* Proforma Meta Block */}
            <div className="text-right space-y-1">
              <span className="inline-block px-3 py-1 bg-blue-900 text-white font-bold font-mono text-xs uppercase tracking-wider rounded">
                PROFORMA INVOICE
              </span>
              <div className="pt-2 font-mono">
                <p className="text-lg font-black text-slate-900">{proforma.proformaNumber}</p>
                <p className="text-xs text-slate-600">
                  Proforma Date: <strong className="text-slate-900">{proforma.date}</strong>
                </p>
                <p className="text-xs text-slate-600">
                  Validity Window: <strong className="text-slate-900">{proforma.validUntil || '30 Days'}</strong>
                </p>
                <p className="text-xs text-blue-700 font-semibold">
                  Linked SO / Ref: {proforma.linkedSo || 'Direct PI'}
                </p>
              </div>
            </div>
          </div>

          {/* Legal Notice Banner */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-blue-900 text-[11px]">
            <div className="flex items-center gap-2">
              <Info size={15} className="text-blue-600 shrink-0" />
              <span>
                <strong>PRELIMINARY COMMERCIAL PROFORMA INVOICE:</strong> This is a preliminary commercial quote and payment demand. Not an official tax invoice for GST credit claiming.
              </span>
            </div>
            <span className="font-mono text-[9px] font-bold uppercase bg-blue-200/70 text-blue-900 px-2 py-0.5 rounded shrink-0">
              Non-Accounting Voucher
            </span>
          </div>

          {/* Two-Column Buyer & Seller Info */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                ISSUED BY (SUPPLIER)
              </span>
              {/* [PHASE-2E.1] GSTIN from companyProfile (was hardcoded 29AABCU9912E1Z8) */}
              <p className="font-bold text-sm text-slate-900">{companyName}</p>
              <p className="text-slate-600">{companyAddress}</p>
              <p className="text-slate-600">GSTIN: {gstin || '—'}</p>
            </div>

            <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-6">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                PROFORMA INVOICE RECIPIENT (CUSTOMER)
              </span>
              <p className="font-bold text-sm text-blue-900">{proforma.customer}</p>
              <p className="text-slate-600">{proforma.billingAddress?.line1 || 'Main Facility Center'}</p>
              <p className="text-slate-600">
                {proforma.billingAddress?.city || 'Mumbai'}, {proforma.billingAddress?.state || 'Maharashtra'} - {proforma.billingAddress?.pincode || '400001'}
              </p>
              <p className="text-slate-600">Contact: <strong>{proforma.customerContact || 'Primary Procurement Desk'}</strong></p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Product & Machine Deliverables ({items.length} Lines)
            </span>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Product Description</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                    <th className="py-2.5 px-2 text-center">GST</th>
                    <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                    <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const rate = Number(item.rate || 0);
                    const qty = Number(item.qty || 1);
                    const taxRate = Number(item.tax ?? item.taxRate ?? 5);
                    const taxAmt = (rate * qty * taxRate) / 100;
                    const total = rate * qty + taxAmt;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-800">{item.name || item.description}</p>
                          <p className="text-[10px] font-mono text-slate-400">SKU: {item.sku || item.itemSku || 'GEN-SKU'}</p>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900">{qty} {item.unit || 'Unit'}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-600">{taxRate}%</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">₹{taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown & Milestones */}
          <div className="grid grid-cols-2 gap-6 pt-2">
            {/* Proposed Milestones */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-[11px]">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <Clock size={13} className="text-blue-600" /> Proposed Milestone Schedule
              </span>
              <div className="space-y-1.5">
                {(proforma.paymentSchedule || [
                  { milestone: 'Advance Booking Deposit', due: 'Upon Commercial Acceptance', pct: 50 },
                  { milestone: 'Pre-Dispatch Balance', due: 'Before Warehouse Dispatch', pct: 50 }
                ]).map((s, idx) => {
                  const milestoneAmt = (grandTotal * (Number(s.pct || 0) / 100));
                  return (
                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                      <div>
                        <span className="font-semibold text-slate-800 block">{s.milestone}</span>
                        <span className="text-[10px] text-slate-500">Trigger: {s.due || 'Standard'}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-blue-700 block">
                          ₹{milestoneAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400">({s.pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bank Remittance Details */}
              <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200/80 text-[10px] text-blue-900">
                <p className="font-bold uppercase tracking-wider text-blue-800 mb-0.5">Bank Wire Details for Advance Deposit:</p>
                <p>Bank: <strong>HDFC Bank Ltd</strong> • A/C: <strong>092810029311</strong> • IFSC: <strong>HDFC0001245</strong></p>
                <p>Beneficiary: <strong>{companyName}</strong></p>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-2 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount (Pre-Tax):</span>
                <span>₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {/* [PHASE-2E.1] state-aware GST summary — intra-state splits CGST+SGST, inter-state shows IGST */}
              {hasStates ? (
                isIntraState ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST ({((taxAmount * 0.5) / taxableAmount * 100).toFixed(1)}%):</span>
                      <span>₹{(taxAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST ({((taxAmount * 0.5) / taxableAmount * 100).toFixed(1)}%):</span>
                      <span>₹{(taxAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST ({taxableAmount > 0 ? ((taxAmount / taxableAmount) * 100).toFixed(1) : 0}%) [inter-state]:</span>
                    <span>₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>CGST + SGST ({taxableAmount > 0 ? ((taxAmount / taxableAmount) * 100).toFixed(1) : 0}%):</span>
                  <span>₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Other Charges (Freight/Logistics):</span>
                <span>₹0.00</span>
              </div>
              <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                <span className="text-xs uppercase tracking-wider">Grand Total (INR):</span>
                <span className="text-base text-blue-900">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-[10px] text-slate-500 bg-slate-50/50">
            <p className="font-bold uppercase tracking-wider text-slate-700">Commercial Terms & Conditions</p>
            <ol className="list-decimal pl-4 space-y-0.5 leading-normal">
              <li>This Proforma Invoice is a preliminary commercial offer and not a final tax invoice.</li>
              <li>Prices and discounts quoted are valid for 30 calendar days from the proforma date.</li>
              <li>Equipment warranty becomes active only upon Final Tax Invoicing and clinical commissioning.</li>
            </ol>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 pt-6 border-t border-slate-200 text-center text-xs">
            <div className="space-y-10">
              <p className="text-slate-400 uppercase text-[10px] font-bold">Prepared By / Sales Account Exec</p>
              <div className="border-b border-slate-300 w-3/4 mx-auto pb-1">
                <SignatureSlot doc={docSigs} signatory="prepared" label="Prepared By / Sales Account Exec" modalType="authorized" defaultDesignation="Sales Account Executive" />
              </div>
              <p className="font-semibold text-slate-700 text-[11px]">Commercial Operations Desk</p>
            </div>
            <div className="space-y-10">
              <p className="text-slate-400 uppercase text-[10px] font-bold">Authorized Signatory & Seal</p>
              <div className="border-b border-slate-300 w-3/4 mx-auto pb-1">
                <SignatureSlot doc={docSigs} signatory="authorized" label="Authorized Signatory & Seal" modalType="authorized" defaultName={companyName} />
              </div>
              <p className="font-semibold text-slate-700 text-[11px]">{companyName}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
            Commercial document • Created via Evenmore ERP Unified Platform
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
