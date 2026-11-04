import React, { useEffect } from 'react';
import { X, Printer, FileText, Calendar, Building2, Phone, Mail, CreditCard } from 'lucide-react';
import { numIN, toDDMMYYYY } from '../../utils/formatters';
import { useBrandName } from '../../components/common/BrandLogo';

export function PrintSupplierStatementModal({
  isOpen,
  onClose,
  supplier,
  ledger,
  dateFrom,
  dateTo,
}) {
  const brandName = useBrandName('OSCAR TEXTILES & ERP');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !supplier) return null;

  const handlePrint = () => {
    window.print();
  };

  const isCustomer = supplier.type === 'Customer';
  const partyLabel = isCustomer ? 'Customer' : 'Supplier';

  const summary = ledger?.summary || {};
  const entries = ledger?.entries || [];
  const openingBalance = Number(summary.openingBalance ?? ledger?.openingBalance ?? supplier.opening_balance ?? 0);
  const totalDebits = Number(summary.totalDebits ?? 0);
  const totalCredits = Number(summary.totalCredits ?? 0);
  const closingBalance = Number(summary.closingBalance ?? ledger?.closingBalance ?? supplier.balance ?? 0);
  
  const defaultBalType = isCustomer
    ? (closingBalance >= 0 ? 'Dr' : 'Cr')
    : (closingBalance >= 0 ? 'Cr' : 'Dr');
  const balanceType = summary.balanceType || ledger?.balanceType || defaultBalType;

  const dateRangeStr = dateFrom && dateTo
    ? `${toDDMMYYYY(dateFrom)} to ${toDDMMYYYY(dateTo)}`
    : dateFrom
    ? `From ${toDDMMYYYY(dateFrom)}`
    : dateTo
    ? `Up to ${toDDMMYYYY(dateTo)}`
    : 'All Historic Transactions';

  const printedOn = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-5xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Screen Only) */}
        <div className="bg-[#1F2E4A] text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-300" />
            <span className="font-bold text-sm tracking-tight">
              {partyLabel} Statement of Account — {supplier.name} ({supplier.code || (isCustomer ? 'CUST' : 'VEND')})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Printer size={14} />
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

        {/* Printable Document (A4 sheet) */}
        <div className="overflow-x-auto p-4 sm:p-8 print:p-0 print:overflow-visible">
          <div className="printable-document p-8 min-w-[760px] text-slate-800 bg-white font-sans text-xs space-y-6">
            {/* Header / Letterhead */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div>
                <h1 className="text-xl font-extrabold text-[#1F2E4A] tracking-tight uppercase">
                  {brandName}
                </h1>
                <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
                  Accounts & Commercial Finance Division
                </p>
                <p className="text-[11px] text-slate-600 font-medium mt-1">
                  Statement of Account ({partyLabel} Ledger)
                </p>
              </div>

              <div className="text-right space-y-1">
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 font-bold font-mono text-xs uppercase tracking-wider rounded border border-slate-300">
                  STATEMENT OF ACCOUNT
                </span>
                <p className="text-[11px] text-slate-500">
                  Period: <strong className="text-slate-800">{dateRangeStr}</strong>
                </p>
                <p className="text-[10px] text-slate-400">Printed On: {printedOn}</p>
              </div>
            </div>

            {/* Party & Statement Summary Info Grid */}
            <div className="grid grid-cols-2 gap-6 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              {/* Left: Party Info */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {partyLabel} Details
                </span>
                <h2 className="font-bold text-base text-slate-900">{supplier.name}</h2>
                <div className="text-[11px] text-slate-600 space-y-0.5">
                  <p>
                    <span className="text-slate-400 font-medium">Code:</span>{' '}
                    <strong className="font-mono text-slate-800">{supplier.code || '—'}</strong>
                  </p>
                  {supplier.gstin && (
                    <p>
                      <span className="text-slate-400 font-medium">GSTIN:</span>{' '}
                      <strong className="font-mono text-slate-800">{supplier.gstin}</strong>
                    </p>
                  )}
                  {supplier.phone && (
                    <p>
                      <span className="text-slate-400 font-medium">Phone:</span> {supplier.phone}
                    </p>
                  )}
                  {supplier.email && (
                    <p>
                      <span className="text-slate-400 font-medium">Email:</span> {supplier.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Balance Snapshot */}
              <div className="space-y-2 border-l border-slate-200 pl-6">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Balance Snapshot
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Opening Balance</span>
                    <strong className="font-mono text-slate-800 text-xs">
                      ₹{numIN(Math.abs(openingBalance))}{' '}
                      {isCustomer
                        ? (openingBalance >= 0 ? 'Dr (Receivable)' : 'Cr (Advance)')
                        : (openingBalance >= 0 ? 'Cr (Payable)' : 'Dr (Advance)')}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Closing Balance</span>
                    <strong className="font-mono text-slate-900 text-xs font-bold">
                      ₹{numIN(Math.abs(closingBalance))} {balanceType}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Total Debits</span>
                    <strong className="font-mono text-rose-600 text-xs">
                      ₹{numIN(totalDebits)}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Total Credits</span>
                    <strong className="font-mono text-emerald-600 text-xs">
                      ₹{numIN(totalCredits)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div>
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b-2 border-slate-800 bg-slate-100/80 text-[10px] uppercase tracking-wider text-slate-700">
                    <th className="py-2 px-2 font-bold">Date</th>
                    <th className="py-2 px-2 font-bold">Voucher Type</th>
                    <th className="py-2 px-2 font-bold">Doc #</th>
                    <th className="py-2 px-2 font-bold">Narration / Particulars</th>
                    <th className="py-2 px-2 font-bold text-right">Debit (₹)</th>
                    <th className="py-2 px-2 font-bold text-right">Credit (₹)</th>
                    <th className="py-2 px-2 font-bold text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/50 font-semibold text-slate-600">
                    <td className="py-2 px-2 font-mono text-[10px]">—</td>
                    <td className="py-2 px-2 font-mono text-[10px]">OPENING</td>
                    <td className="py-2 px-2 font-mono text-[10px]">—</td>
                    <td className="py-2 px-2 italic text-slate-500">Balance Brought Forward</td>
                    <td className="py-2 px-2 text-right">—</td>
                    <td className="py-2 px-2 text-right">—</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">
                      ₹{numIN(Math.abs(openingBalance))}{' '}
                      {isCustomer
                        ? (openingBalance >= 0 ? 'Dr' : 'Cr')
                        : (openingBalance >= 0 ? 'Cr' : 'Dr')}
                    </td>
                  </tr>

                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                        No transactions found for this {partyLabel.toLowerCase()} within the selected period.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-2 font-mono text-[10px] text-slate-600">
                          {toDDMMYYYY(entry.date)}
                        </td>
                        <td className="py-2 px-2 font-mono text-[10px] text-slate-700 font-semibold">
                          {entry.documentType || 'Journal'}
                        </td>
                        <td className="py-2 px-2 font-mono text-[10px] text-slate-800">
                          {entry.documentNumber || '—'}
                        </td>
                        <td className="py-2 px-2 text-slate-700 max-w-[220px] truncate" title={entry.description}>
                          {entry.description || '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-semibold text-rose-600">
                          {Number(entry.debit) > 0 ? `₹${numIN(entry.debit)}` : '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600">
                          {Number(entry.credit) > 0 ? `₹${numIN(entry.credit)}` : '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          ₹{numIN(Math.abs(Number(entry.balance || 0)))} {entry.balanceType || (isCustomer ? 'Dr' : 'Cr')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-800 bg-slate-50 font-bold text-[11px] text-slate-900">
                    <td colSpan={4} className="py-2.5 px-2 text-right uppercase tracking-wider">
                      Period Totals / Closing Balance:
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-rose-600">
                      ₹{numIN(totalDebits)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-600">
                      ₹{numIN(totalCredits)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-extrabold text-slate-900">
                      ₹{numIN(Math.abs(closingBalance))} {balanceType}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer Notice */}
            <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
              <p>This statement of account is automatically generated by {brandName}.</p>
              <p>For accounts reconciliation inquiries, contact Finance & Accounts.</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar (Screen Only) */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between no-print shrink-0">
          <p className="text-xs text-slate-500">
            Click <strong>Print / Save as PDF</strong> to generate clean A4 statement.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer size={13} /> Print Statement
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintSupplierStatementModal;
