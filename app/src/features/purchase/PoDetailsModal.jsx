import React, { useState } from 'react';
import {
  X,
  Printer,
  Package,
  Building2,
  Calendar,
  ClipboardList,
  Copy,
  Maximize2,
  Minimize2,
  ArrowRight,
} from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';

function amountInWords(num) {
  const n = Math.floor(Number(num) || 0);
  if (n === 0) return 'Rupees Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (v) => v < 20 ? ones[v] : `${tens[Math.floor(v / 10)]}${v % 10 ? ' ' + ones[v % 10] : ''}`;
  const threeDigits = (v) => {
    const h = Math.floor(v / 100);
    const rest = v % 100;
    return `${h ? ones[h] + ' Hundred' + (rest ? ' ' : '') : ''}${rest ? twoDigits(rest) : ''}`;
  };
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `Rupees ${parts.join(' ')} Only`;
}

export function PoDetailsModal({
  po,
  status,
  formatCurrency,
  formatDateDDMMYYYY,
  onClose,
  onPrint,
  onOpenBatchRegistry,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!po) return null;

  const lines = po.items || po.lineItems || [];
  const totalOrdered = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const totalReceived = lines.reduce((s, l) => s + (Number(l.receivedQty) || 0), 0);
  const totalRemaining = Math.max(0, totalOrdered - totalReceived);
  const totalAmount = po.amount ?? po.total ?? lines.reduce((s, l) => s + ((Number(l.qty) || 0) * (Number(l.rate) || 0)), 0);
  const pct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

  const handleCopyPoNumber = () => {
    if (po.poNumber) {
      navigator.clipboard?.writeText(po.poNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-200 ${
      isFullscreen ? 'p-0' : 'p-2 sm:p-4'
    }`}>
      <div
        className={`bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full rounded-none p-4 sm:p-8'
            : 'max-w-5xl w-full rounded-2xl p-4 sm:p-6 max-h-[95vh] sm:max-h-[92vh]'
        } text-xs`}
      >
        {/* Header */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#1F2E4A] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              PO
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-[#1F2E4A]">{po.poNumber}</h3>
                <button
                  type="button"
                  onClick={handleCopyPoNumber}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                  title="Copy PO Number"
                >
                  <Copy size={13} />
                </button>
                {copied && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <Building2 size={12} className="text-slate-400" /> {po.vendor}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-slate-400" /> {formatDateDDMMYYYY(po.date)}
                </span>
              </div>
            </div>
            <div className="ml-2">
              <StatusBadge status={status || po.status} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint?.(po)}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold flex items-center gap-1.5 text-xs shadow-2xs transition cursor-pointer"
            >
              <Printer size={13} /> Print PO
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Ordered</span>
              <span className="text-base font-extrabold text-[#17294e] font-mono mt-0.5 block">
                {totalOrdered.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">{lines[0]?.uom || 'Mtr'}</span>
              </span>
            </div>
            <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Total Received</span>
              <span className="text-base font-extrabold text-blue-900 font-mono mt-0.5 block">
                {totalReceived.toLocaleString('en-IN')} <span className="text-xs font-normal text-blue-600">({pct}%)</span>
              </span>
            </div>
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Remaining Balance</span>
              <span className="text-base font-extrabold text-amber-900 font-mono mt-0.5 block">
                {totalRemaining.toLocaleString('en-IN')} <span className="text-xs font-normal text-amber-700">{lines[0]?.uom || 'Mtr'}</span>
              </span>
            </div>
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Total Order Value</span>
              <span className="text-base font-extrabold text-emerald-950 font-mono mt-0.5 block">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Receiving Progress Bar */}
          <div className="p-3 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-700">Receiving Progress</span>
              <span className="text-slate-500 font-mono">{totalReceived.toLocaleString('en-IN')} / {totalOrdered.toLocaleString('en-IN')} ({pct}%)</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-600' : 'bg-slate-200'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs">Fabric Line Items</h4>
              <span className="text-[11px] text-slate-500 font-medium">{lines.length} item{lines.length === 1 ? '' : 's'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-slate-50/60 text-slate-500 font-semibold border-b border-slate-100 text-[10px] uppercase tracking-wider">
                    <th className="px-3.5 py-2">#</th>
                    <th className="px-3.5 py-2">Fabric / Item</th>
                    <th className="px-3.5 py-2 text-right">Ordered Qty</th>
                    <th className="px-3.5 py-2 text-right">Rate (₹)</th>
                    <th className="px-3.5 py-2 text-right">Line Total (₹)</th>
                    <th className="px-3.5 py-2 text-right">Received</th>
                    <th className="px-3.5 py-2 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {lines.map((l, idx) => {
                    const lOrdered = Number(l.qty) || 0;
                    const lReceived = Number(l.receivedQty) || 0;
                    const lRemaining = Math.max(0, lOrdered - lReceived);
                    const lRate = Number(l.rate) || 0;
                    const lAmount = Number(l.amount) || (lOrdered * lRate);
                    return (
                      <tr key={l.id || idx} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2 text-slate-400 font-normal">{idx + 1}</td>
                        <td className="px-3.5 py-2 font-sans font-medium text-slate-800">
                          <div>{l.name || l.description || '—'}</div>
                          {l.sku && <div className="text-[10px] text-slate-400 font-mono">{l.sku}</div>}
                        </td>
                        <td className="px-3.5 py-2 text-right font-semibold text-slate-800">
                          {lOrdered.toLocaleString('en-IN')} {l.uom || 'Mtr'}
                        </td>
                        <td className="px-3.5 py-2 text-right text-slate-600">
                          ₹{lRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3.5 py-2 text-right font-bold text-slate-800">
                          {formatCurrency(lAmount)}
                        </td>
                        <td className="px-3.5 py-2 text-right text-emerald-700 font-semibold">
                          {lReceived.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3.5 py-2 text-right text-amber-700 font-semibold">
                          {lRemaining.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3.5 py-6 text-center text-slate-400 italic">
                        No line items recorded on this purchase order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Amount in Words */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Amount in Words</span>
            <p className="text-xs font-semibold text-emerald-900 mt-0.5">{amountInWords(totalAmount)}</p>
          </div>

          {/* Remarks & Extra Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11.5px]">
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Order Terms &amp; Expected Delivery</span>
              <div className="mt-1 space-y-1 text-slate-700">
                <div>Expected Date: <strong>{formatDateDDMMYYYY(po.expectedDate)}</strong></div>
                <div>Project Reference: <strong>{po.projectCode || po.projectName || 'General Stock'}</strong></div>
                {po.fabricFlow && <div>Fabric Flow: <strong>{po.fabricFlow}</strong></div>}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Remarks / Notes</span>
              <p className="mt-1 text-slate-600 italic">
                {po.notes || po.remarks || 'No special remarks recorded.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenBatchRegistry?.(po);
            }}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold flex items-center gap-1.5 text-xs shadow-2xs transition cursor-pointer"
          >
            <Package size={13} /> Open in Batch Registry <ArrowRight size={12} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
