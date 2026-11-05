import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, AlertCircle, ArrowUpRight } from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';

/**
 * Modal to dispatch rejected fabric from a batch to a vendor for reprocessing.
 */
export default function SendForReprocessModal({ batch, onClose, onDone }) {
  // Calculate available rejected quantity
  const rejectedTakas = (batch.takas || []).filter(
    (t) => (t.locationCode === 'SYS-REJECT' || t.status === 'Reject' || t.qcStatus === 'Rejected') && Number(t.availableQuantity) > 0
  );
  const totalRejectedFromTakas = rejectedTakas.reduce((acc, t) => acc + Number(t.availableQuantity || 0), 0);
  const availableRejectedQty = totalRejectedFromTakas > 0
    ? totalRejectedFromTakas
    : Number(batch.rejectedQuantity || batch.rejectedQty || batch.totalMeters || batch.receivedQuantity || 0);

  const poNumber = batch.purchaseOrderNumber || batch.poNumber || batch.sourceDocumentNumber || '—';
  const vendorName = batch.supplierName || batch.partyName || batch.supplier?.name || '—';
  const itemName = batch.itemName || batch.fabricType || batch.item?.name || '—';
  const uom = batch.uom || 'MTR';

  const [sentQty, setSentQty] = useState(availableRejectedQty > 0 ? String(availableRejectedQty) : '');
  const [outwardChallan, setOutwardChallan] = useState(`CHL-RP-${Date.now().toString().slice(-6)}`);
  const [sentDate, setSentDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [reason, setReason] = useState('Dyeing unevenness & shade variance');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const numQty = parseFloat(sentQty);
    if (!numQty || numQty <= 0) {
      setError('Please enter a valid quantity greater than 0.');
      return;
    }
    if (availableRejectedQty > 0 && numQty > availableRejectedQty) {
      setError(`Sent quantity (${numQty} ${uom}) cannot exceed available rejected stock (${availableRejectedQty} ${uom}).`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await inventoryService.sendBatchForReprocess({
        batchCode: batch.batchCode,
        sentQty: numQty,
        outwardChallan: outwardChallan.trim(),
        sentDate,
        expectedReturnDate: expectedReturnDate || undefined,
        reason: reason.trim(),
        vendorId: batch.supplierId || batch.supplier?.id || undefined,
        poId: batch.purchaseOrderId || batch.purchaseOrder?.id || undefined,
      });
      if (onDone) onDone(res);
      onClose();
    } catch (err) {
      setError(describeApiError(err) || 'Failed to send batch for reprocessing.');
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
        aria-labelledby="send-reprocess-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <RefreshCw size={17} className="animate-spin-reverse" />
            </div>
            <div>
              <h3 id="send-reprocess-title" className="text-sm font-bold text-slate-900">
                Send Batch for Reprocess
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">Batch: {batch.batchCode}</p>
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

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Read-only Context Summary */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Original PO</span>
              <span className="font-semibold text-slate-800">{poNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Vendor</span>
              <span className="font-semibold text-slate-800 truncate block" title={vendorName}>{vendorName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Fabric Item</span>
              <span className="font-semibold text-slate-800 truncate block" title={itemName}>{itemName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Rejected Available</span>
              <span className="font-bold text-amber-700">
                {formatNumberIN(availableRejectedQty)} {uom}
              </span>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-semibold text-slate-700 mb-1">
                  Sent Quantity ({uom}) <span className="text-rose-500">*</span>
                </span>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  max={availableRejectedQty > 0 ? availableRejectedQty : undefined}
                  value={sentQty}
                  onChange={(e) => setSentQty(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  placeholder="0.00"
                />
              </label>

              <label className="block">
                <span className="block font-semibold text-slate-700 mb-1">
                  Outward Challan No. <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={outwardChallan}
                  onChange={(e) => setOutwardChallan(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  placeholder="CHL-OUT-XXXX"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-semibold text-slate-700 mb-1">
                  Sent Date <span className="text-rose-500">*</span>
                </span>
                <input
                  type="date"
                  required
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </label>

              <label className="block">
                <span className="block font-semibold text-slate-700 mb-1">
                  Expected Return Date
                </span>
                <input
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </label>
            </div>

            <label className="block">
              <span className="block font-semibold text-slate-700 mb-1">
                Reason / Defect Details <span className="text-rose-500">*</span>
              </span>
              <textarea
                rows={2}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none"
                placeholder="Explain the QC rejection reason and reprocessing instructions for vendor..."
              />
            </label>
          </div>

          <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-800 text-[11px] leading-relaxed flex items-start gap-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-blue-600" />
            <span>
              This will create a <strong>Reprocess Record</strong> linked to the original PO and Batch. When returned by vendor, you will be able to receive partial or full returns without re-entering PO or batch details manually.
            </span>
          </div>

          {error && (
            <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2 text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50/60">
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
            disabled={saving || !sentQty || parseFloat(sentQty) <= 0}
            className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <ArrowUpRight size={14} />
            {saving ? 'Creating Record…' : 'Send for Reprocess'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
