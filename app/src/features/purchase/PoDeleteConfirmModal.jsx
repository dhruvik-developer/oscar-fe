import React from 'react';
import { GlobalModal } from '../../components/ui/GlobalModal';

export function PoDeleteConfirmModal({
  po,
  formatCurrency,
  formatDateDDMMYYYY,
  onClose,
  onConfirm,
}) {
  if (!po) return null;

  return (
    <GlobalModal
      isOpen={!!po}
      onClose={onClose}
      onConfirm={() => {
        onConfirm(po);
        onClose();
      }}
      title="Delete Purchase Order"
      variant="danger"
      confirmText="Delete Purchase Order"
      cancelText="Cancel"
      itemName={po.poNumber}
      message={`Are you sure you want to permanently delete purchase order ${po.poNumber}?`}
    >
      <div className="py-2 space-y-3 text-xs">
        <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3 text-[11.5px] space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Supplier:</span>
            <span className="font-semibold text-slate-800">{po.vendor}</span>
          </div>
          {po.date && (
            <div className="flex justify-between">
              <span className="text-slate-500">PO Date:</span>
              <span className="font-mono text-slate-800">{formatDateDDMMYYYY ? formatDateDDMMYYYY(po.date) : po.date}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Order Amount:</span>
            <span className="font-mono font-bold text-slate-900">
              {formatCurrency ? formatCurrency(po.amount ?? po.total ?? 0) : `₹${po.amount ?? po.total ?? 0}`}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-rose-600 font-medium">
          This action cannot be undone. Draft order lines and allocations will be deleted.
        </p>
      </div>
    </GlobalModal>
  );
}
