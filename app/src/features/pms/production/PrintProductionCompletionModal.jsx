import React, { useEffect } from 'react';
import { X, Printer, CheckCircle2, FileText, AlertTriangle, Building2 } from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from '../../../components/common/SignatureSlot';
import { useERP } from '../../../context/ERPContext';

function fmtM(n) {
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  return isNaN(num) ? '—' : `${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Mtr`;
}

function fmtINR(n) {
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  return isNaN(num) ? '—' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  const parts = String(d).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : d;
}

export function PrintProductionCompletionModal({ isOpen, onClose, completionData, detail }) {
  const docSigs = useDocumentSignatures('ProductionCompletion', completionData?.id || completionData?.piNo || detail?.id, `Production Completion ${completionData?.piNo || detail?.instructionNumber || ''}`);
  const { companyProfile } = useERP();
  const companyName = companyProfile?.name || 'OSCAR TEXTILES & APPAREL ERP';
  const companyAddress = companyProfile?.address || 'MIDC Industrial Area, Weaving & Processing Zone, India';
  const gstin = companyProfile?.gstin || '';
  const pan = companyProfile?.pan || '';
  const phone = companyProfile?.phone || '+91 98765 43210';

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !completionData) return null;

  const handlePrint = () => {
    window.print();
  };

  const piNumber = completionData?.piNo || detail?.instructionNumber || '—';
  const piDate = completionData?.piDate || '';
  const vendor = completionData?.agency || '—';
  const fabric = completionData?.fabric || '—';
  const processType = completionData?.processType || '—';
  const assignedEmployee = completionData?.assignedEmployee || '—';
  const orderQty = completionData.orderQty;
  const totalProduced = Number(completionData.totalProduced) || 0;
  const rejectedQty = completionData.rejectedQty;
  const acceptedQty = completionData.acceptedQty;
  const shortage = completionData.shortageQty;
  const jobRate = Number(completionData?.jobRate) || 0;
  const finalAmount = completionData.finalAmount;
  const status = completionData?.status || detail?.status || 'Completed';
  const greyLotNo = detail?.greyLotNo || null;
  const finalPoNumber = detail?.finalPoNumber || null;
  const rows = completionData?.dailySummary || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Screen Only - Hidden during print) */}
        <div className="bg-[#1F2E4A] text-white px-5 py-3.5 flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <FileText size={16} />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight block">
                Completion & Verification Certificate
              </span>
              <span className="text-[11px] text-blue-200 font-mono">
                Instruction Ref: {piNumber}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Download clean PDF or Print"
            >
              <Printer size={15} />
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable A4 Document Sheet */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100 flex-1 print:bg-white print:p-0 print:overflow-visible">
          <div className="p-8 sm:p-12 text-slate-800 bg-white font-sans text-xs space-y-6 printable-document shadow-sm print:shadow-none border border-slate-200 print:border-none rounded-xl print:rounded-none max-w-3xl mx-auto print:max-w-none">
            
            {/* Header Letterhead */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#1F2E4A] text-white flex items-center justify-center font-bold text-base font-mono">
                    {companyName.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-lg font-black text-[#1F2E4A] tracking-tight uppercase leading-tight">
                      {companyName}
                    </h1>
                    <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                      Textile Manufacturing & Quality Verification
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
                  <p>{companyAddress}</p>
                  <p>
                    {gstin ? `GSTIN: ${gstin}` : ''}
                    {pan ? ` • PAN: ${pan}` : ''}
                    {phone ? ` • Tel: ${phone}` : ''}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {status}
                </span>
                <p className="font-mono font-bold text-sm text-slate-900 mt-2">{piNumber}</p>
                <p className="text-[11px] text-slate-500">Date: {fmtDate(piDate)}</p>
                {finalPoNumber && (
                  <p className="text-[11px] font-semibold text-blue-700 mt-0.5">
                    Final JW PO: {finalPoNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="text-center py-2 border-b border-slate-200 bg-slate-50 rounded-lg">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Production Completion & Physical Quantity Verification Certificate
              </h2>
            </div>

            {/* Instruction Details 2-Column Grid */}
            <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  AGENCY / PROCESSING VENDOR
                </span>
                <strong className="text-slate-900 text-xs block">{vendor}</strong>
                <p className="text-slate-600 text-[11px]">Process Stage: <strong>{processType}</strong></p>
                <p className="text-slate-600 text-[11px]">Fabric Quality: <strong>{fabric}</strong></p>
              </div>

              <div className="space-y-1 text-right sm:text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  VERIFICATION DETAILS
                </span>
                <p className="text-slate-600 text-[11px]">Supervisor / Assigned: <strong>{assignedEmployee}</strong></p>
                {greyLotNo && (
                  <p className="text-slate-600 text-[11px]">Grey Lot Ref: <strong className="font-mono">{greyLotNo}</strong></p>
                )}
                <p className="text-slate-600 text-[11px]">Commercial Rate: <strong>{jobRate > 0 ? `₹ ${jobRate} / Mtr` : '—'}</strong></p>
              </div>
            </div>

            {/* Quantitative Reconciliation Table */}
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-2">
                1. Quantitative Reconciliation Summary
              </h3>
              <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden text-xs">
                <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Metric</th>
                    <th className="px-3 py-2 text-right">Quantity (Mtr)</th>
                    <th className="px-3 py-2 text-right">Variance / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr>
                    <td className="px-3 py-2 font-sans font-medium text-slate-700">Instructed PO Quantity</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">{fmtM(orderQty)}</td>
                    <td className="px-3 py-2 text-right font-sans text-slate-500">Authorized Target</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-sans font-medium text-slate-700">Total Produced (From Daily Register)</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">{fmtM(totalProduced)}</td>
                    <td className="px-3 py-2 text-right font-sans text-slate-500">Gross Physical Output</td>
                  </tr>
                  <tr className="bg-emerald-50/50">
                    <td className="px-3 py-2 font-sans font-bold text-emerald-900">QC Accepted Quantity</td>
                    <td className="px-3 py-2 text-right font-black text-emerald-700">{fmtM(acceptedQty)}</td>
                    <td className="px-3 py-2 text-right font-sans font-bold text-emerald-700">Eligible for Final PO</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-sans font-medium text-rose-700">QC Rejected Quantity</td>
                    <td className="px-3 py-2 text-right font-bold text-rose-700">{fmtM(rejectedQty)}</td>
                    <td className="px-3 py-2 text-right font-sans text-rose-600">Disallowed</td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="px-3 py-2 font-sans font-bold text-amber-900">Shortage / Difference</td>
                    <td className="px-3 py-2 text-right font-black text-amber-700">{fmtM(shortage)}</td>
                    <td className="px-3 py-2 text-right font-sans text-amber-800">
                      {Number(shortage) > 0 ? 'Shortage Recorded' : 'Reconciled'}
                    </td>
                  </tr>
                  {finalAmount && (
                    <tr className="bg-blue-50/50 font-sans font-bold">
                      <td className="px-3 py-2 text-blue-900">Estimated Commercial Job Value</td>
                      <td className="px-3 py-2 text-right text-blue-900 font-mono" colSpan={2}>{fmtINR(finalAmount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Daily Production Summary Table */}
            {rows.length > 0 && (
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-2">
                  2. Daily Production & QC Inspection Log
                </h3>
                <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2 text-right">Produced (Mtr)</th>
                      <th className="px-3 py-2 text-right">Accepted (Mtr)</th>
                      <th className="px-3 py-2 text-right">Rejected (Mtr)</th>
                      <th className="px-3 py-2">Loom / Shift</th>
                      <th className="px-3 py-2">QC Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-sans font-medium text-slate-700">{r.displayDate || r.date}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-slate-800">{fmtM(r.producedQty ?? r.qty)}</td>
                        <td className="px-3 py-1.5 text-right text-emerald-700 font-semibold">{fmtM(r.acceptedQty)}</td>
                        <td className="px-3 py-1.5 text-right text-rose-600">{fmtM(r.rejectedQty)}</td>
                        <td className="px-3 py-1.5 font-sans text-slate-500">{r.shift || r.loomNo || '—'}</td>
                        <td className="px-3 py-1.5 font-sans text-slate-500 truncate max-w-[150px]">{r.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Physical Verification Certificate Statement */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-[11px] leading-relaxed text-slate-700">
              <p>
                <strong>Verification Declaration:</strong> It is certified that the quantities above have been physically inspected, counted, and cross-verified against production logs and loom records. The accepted quantity of <strong className="font-mono">{fmtM(acceptedQty)}</strong> conforms to Oscar ERP textile quality norms and is commercially approved for generation of the Final Job Work Purchase Order and vendor disbursement.
              </p>
            </div>

            {/* Official Signatures Grid */}
            <div className="pt-8 grid grid-cols-3 gap-6 text-center border-t border-slate-200">
              <div className="space-y-1">
                <div className="border-b border-dashed border-slate-300 pb-1">
                  <SignatureSlot doc={docSigs} signatory="supervisor" label="Floor Supervisor" modalType="authorized" className="h-10" defaultDesignation="Floor Supervisor" />
                </div>
                <p className="font-bold text-slate-800 text-xs">Floor Supervisor</p>
                <p className="text-[10px] text-slate-400">Daily Production Signatory</p>
              </div>

              <div className="space-y-1">
                <div className="border-b border-dashed border-slate-300 pb-1">
                  <SignatureSlot doc={docSigs} signatory="qc" label="QC Verification Manager" modalType="authorized" className="h-10" defaultDesignation="QC Verification Manager" />
                </div>
                <p className="font-bold text-slate-800 text-xs">QC Verification Manager</p>
                <p className="text-[10px] text-slate-400">Quality Inspection Officer</p>
              </div>

              <div className="space-y-1">
                <div className="border-b border-dashed border-slate-300 pb-1">
                  <SignatureSlot doc={docSigs} signatory="commercial" label="Commercial Authority" modalType="authorized" className="h-10" defaultDesignation="Commercial Authority" />
                </div>
                <p className="font-bold text-slate-800 text-xs">Commercial Authority</p>
                <p className="text-[10px] text-slate-400">Accounts & Procurement Desk</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintProductionCompletionModal;
