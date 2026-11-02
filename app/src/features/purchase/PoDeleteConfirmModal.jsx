import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

export function PoDeleteConfirmModal({
  po,
  formatCurrency,
  formatDateDDMMYYYY,
  onClose,
  onConfirm,
}) {
  if (!po) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-md w-full p-5 flex flex-col text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Delete Purchase Order</h3>
              <p className="text-[11px] text-slate-400">Confirmation required</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="py-4 space-y-3">
          <p className="text-[12.5px] text-slate-700">
            Are you sure you want to permanently delete purchase order{' '}
            <strong className="text-slate-900 font-mono">{po.poNumber}</strong>?
          </p>

          <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3 text-[11.5px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier:</span>
              <span className="font-semibold text-slate-800">{po.vendor}</span>
            </div>
            {po.date && (
              <div className="flex justify-between">
                <span className="text-slate-500">PO Date:</span>
                <span className="font-mono text-slate-800">{formatDateDDMMYYYY(po.date)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Order Amount:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(po.amount ?? po.total ?? 0)}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-rose-600 font-medium">
            This action cannot be undone. Draft order lines and allocations will be deleted.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(po);
              onClose();
            }}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 size={13} /> Delete Purchase Order
          </button>
        </div>
      </div>
    </div>
  );
}
