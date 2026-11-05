import React, { useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowDownLeft, AlertCircle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';

/**
 * Modal to record vendor return of reprocessed fabric.
 * Automatically populates PO, Batch, Vendor, Reprocess Record, Sent Qty, Previously Returned Qty, Outstanding Qty.
 * User only enters Return Quantity, Return Date, Vendor Return Challan, Optional Reprocess Charges, and Remarks.
 */
export default function ReceiveReturnModal({ record, onClose, onDone }) {
  const formUid = useId();
  const uom = record.uom || 'MTR';
  const sentQty = Number(record.sentQty || 0);
  const previouslyReturnedQty = Number(record.returnedQty ?? record.previouslyReturnedQty ?? 0);
  const outstandingQty = Number(record.outstandingQty ?? (sentQty - previouslyReturnedQty));

  const [returnQty, setReturnQty] = useState(outstandingQty > 0 ? String(outstandingQty) : '');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorReturnChallan, setVendorReturnChallan] = useState('');
  const [reprocessCharges, setReprocessCharges] = useState('');
  const [remarks, setRemarks] = useState('');
  const [allowOverride, setAllowOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Unique idempotency key to prevent double submissions
  const [idempotencyKey] = useState(() => `idemp-ret-${record.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

  const numReturnQty = parseFloat(returnQty);
  const isOverReceipt = numReturnQty > outstandingQty;

  const submit = async (e, andPerformQc = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!numReturnQty || numReturnQty <= 0) {
      setError('Please enter a valid return quantity greater than 0.');
      return;
    }

    if (isOverReceipt && !allowOverride) {
      setError(
        `Return quantity (${numReturnQty} ${uom}) exceeds the outstanding quantity (${outstandingQty} ${uom}). If vendor sent excess fabric, check "Authorize Excess Quantity Override" below.`
      );
      return;
    }

    if (!vendorReturnChallan.trim()) {
      setError('Vendor return challan number is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        returnQty: numReturnQty,
        returnDate,
        vendorReturnChallan: vendorReturnChallan.trim(),
        reprocessCharges: reprocessCharges ? parseFloat(reprocessCharges) : 0,
        remarks: remarks.trim(),
        idempotencyKey,
      };

      const res = await inventoryService.receiveReprocessReturn(record.id, payload);
      if (onDone) onDone(res, andPerformQc);
      onClose();
    } catch (err) {
      setError(describeApiError(err) || 'Failed to process reprocess return.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receive-return-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ArrowDownLeft size={18} />
            </div>
            <div>
              <h3 id="receive-return-title" className="text-sm font-bold text-slate-900">
                Receive Reprocess Return (GRN)
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Record: {record.reprocessNo} · Batch: {record.originalBatchCode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Automatically Populated Context */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">
              Reprocess Record Details (Auto-Populated)
            </span>
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Original PO</span>
                <span className="font-semibold text-slate-800">{record.originalPoNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Original Batch</span>
                <span className="font-semibold text-slate-800 font-mono">{record.originalBatchCode || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Vendor</span>
                <span className="font-semibold text-slate-800 truncate block" title={record.vendorName}>
                  {record.vendorName || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Quantity Sent</span>
                <span className="font-semibold text-slate-800">
                  {formatNumberIN(sentQty)} {uom}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Previously Returned</span>
                <span className="font-semibold text-slate-800">
                  {formatNumberIN(previouslyReturnedQty)} {uom}
                </span>
              </div>
              <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-amber-800 block text-[10px] font-bold uppercase">Outstanding Quantity</span>
                <span className="font-extrabold text-amber-900 text-sm">
                  {formatNumberIN(outstandingQty)} {uom}
                </span>
              </div>
            </div>
          </div>

          {/* User Input Section */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-semibold text-slate-700 mb-1">
                  Return Quantity ({uom}) <span className="text-rose-500">*</span>
                </span>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  className={`w-full h-9 px-3 rounded-lg border font-semibold text-slate-900 focus:outline-none focus:ring-2 ${
                    isOverReceipt
                      ? 'border-rose-300 bg-rose-50/40 focus:ring-rose-400/20 focus:border-rose-500'
                      : 'border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-600'
                  }`}
                  placeholder="0.00"
                />
                {outstandingQty > 0 && (
                  <span className="mt-1 block text-[10px] text-slate-500">
                    Max outstanding: {formatNumberIN(outstandingQty)} {uom}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="block font-semibold text-slate-700 mb-1">
                  Return Date <span className="text-rose-500">*</span>
                </span>
                <input
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </label>
            </div>

            {isOverReceipt && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <ShieldAlert size={16} />
                  <span>Entered quantity exceeds outstanding quantity ({outstandingQty} {uom})</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-amber-900">
                  <input
                    type="checkbox"
                    checked={allowOverride}
                    onChange={(e) => setAllowOverride(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Authorize receiving excess quantity from vendor</span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-semibold text-slate-700 mb-1">
                  Vendor Return Challan No. <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={vendorReturnChallan}
                  onChange={(e) => setVendorReturnChallan(e.target.value)}
                  placeholder="e.g. VRET-2026-901"
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </label>

              <label className="block">
                <span className="block font-semibold text-slate-700 mb-1">
                  Reprocess Charges (Optional, ₹)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={reprocessCharges}
                  onChange={(e) => setReprocessCharges(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </label>
            </div>

            <label className="block">
              <span className="block font-semibold text-slate-700 mb-1">Remarks</span>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes regarding condition, shade check, or delivery..."
                className="w-full p-2.5 rounded-lg border border-slate-300 font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none"
              />
            </label>
          </div>

          {/* Workflow & QC Notice */}
          <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <strong>Automated Receipt & QC Pending Routing:</strong>
              <p className="mt-0.5 text-emerald-800">
                A Return GRN will be generated and linked to <strong>{record.reprocessBatchCode || `${record.originalBatchCode}-RP`}</strong>. Returned fabric is placed in <strong>QC Pending (SYS-QC-HOLD)</strong> and will NOT be added to usable stock until passed through Reprocess QC.
              </p>
            </div>
          </div>

          {error && (
            <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2 text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50/60">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 px-3.5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={(e) => submit(e, false)}
            disabled={saving || !returnQty || parseFloat(returnQty) <= 0 || (isOverReceipt && !allowOverride)}
            className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <ArrowDownLeft size={14} />
            {saving ? 'Processing GRN Receipt…' : 'Receive Return'}
          </button>
          <button
            type="button"
            onClick={(e) => submit(e, true)}
            disabled={saving || !returnQty || parseFloat(returnQty) <= 0 || (isOverReceipt && !allowOverride)}
            className="h-9 px-4 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:via-indigo-700 hover:to-indigo-800 text-white font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            title="Receive returned fabric and immediately open Reprocess QC inspection"
          >
            <ShieldCheck size={14} className="stroke-[2.5] text-indigo-100" />
            {saving ? 'Processing…' : 'Receive & Reprocess QC'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
