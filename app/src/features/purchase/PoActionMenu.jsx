import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye,
  Pencil,
  Copy,
  Package,
  PackageCheck,
  ShieldCheck,
  Truck,
  Receipt,
  CreditCard,
  IndianRupee,
  Clock,
  Printer,
  Ban,
  Trash2,
} from 'lucide-react';

const MENU_WIDTH = 230;

export function PoActionMenu({
  po,
  anchorRect,
  status,
  hasRemaining,
  receivedQty,
  orderedQty,
  onClose,
  onViewDetails,
  onEdit,
  onDuplicate,
  onBatchRegistry,
  onReceiveGoods,
  onPerformQc,
  onSupplierDispatch,
  onPayVendorBill,
  onMatchVendorBill,
  onViewLandedCosts,
  onMovementHistory,
  onPrint,
  onCancelPo,
  onDelete,
}) {
  const menuRef = useRef(null);

  // Close on outside pointer click, Escape key, or scroll outside menu
  useEffect(() => {
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    function handleScroll(e) {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      onClose();
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [onClose]);

  if (!anchorRect) return null;

  // Calculate coordinates with boundary safety
  const menuApproxHeight = 410;
  let left = anchorRect.right - MENU_WIDTH;
  if (left < 10) left = 10;
  if (left + MENU_WIDTH > window.innerWidth - 10) {
    left = window.innerWidth - MENU_WIDTH - 10;
  }

  let top = anchorRect.bottom + 6;
  if (top + menuApproxHeight > window.innerHeight && anchorRect.top > menuApproxHeight) {
    top = Math.max(10, anchorRect.top - menuApproxHeight - 6);
  }

  // Status-based permissions
  const isDraft = status === 'Draft';
  const isCancelled = status === 'Cancelled';
  const isPendingApproval = status === 'Pending Approval';
  const isApproved = status === 'Approved';
  const isPartiallyReceived = status === 'Partially Received';
  const isFullyReceived = status === 'Fully Received';

  const canEdit = isDraft;
  const canReceiveGoods = !isDraft && !isPendingApproval && !isCancelled && !isFullyReceived;
  const canPerformQc = !isDraft && !isPendingApproval && !isCancelled;
  const canDispatch = !isDraft && !isPendingApproval && !isCancelled;
  const canMatchBill = !isDraft && !isCancelled;
  const canDelete = isDraft;

  const handleAction = (actionFn) => {
    onClose();
    actionFn?.(po);
  };

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top,
        left,
        width: MENU_WIDTH,
        zIndex: 9999,
      }}
      className="rounded-xl border border-slate-200 bg-white py-1.5 shadow-2xl text-[12px] font-medium text-slate-700 animate-in fade-in zoom-in-95 duration-100 select-none overflow-hidden"
      role="menu"
      aria-label="Purchase Order Actions"
    >
      {/* ── Group 1: PO Information ── */}
      <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        PO Information
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onViewDetails)}
        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer text-slate-700"
      >
        <Eye size={13} className="text-slate-400 shrink-0" />
        <span>View PO Details</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!canEdit}
        onClick={() => handleAction(onEdit)}
        title={!canEdit ? 'Only draft purchase orders can be edited' : 'Edit this purchase order'}
        className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 transition-colors ${
          canEdit
            ? 'hover:bg-slate-50 hover:text-blue-600 cursor-pointer text-slate-700'
            : 'opacity-40 cursor-not-allowed text-slate-400'
        }`}
      >
        <span className="flex items-center gap-2">
          <Pencil size={13} className="text-slate-400 shrink-0" />
          <span>Edit Purchase Order</span>
        </span>
        {!canEdit && <span className="text-[9px] text-slate-400">Locked</span>}
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onDuplicate)}
        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer text-slate-700"
      >
        <Copy size={13} className="text-slate-400 shrink-0" />
        <span>Duplicate PO</span>
      </button>

      <div className="my-1 border-t border-slate-100" />

      {/* ── Group 2: Operations ── */}
      <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Operations
      </div>

      <button
        type="button"
        role="menuitem"
        disabled={isCancelled}
        onClick={() => handleAction(onBatchRegistry)}
        className={`w-full px-3 py-1.5 text-left flex items-center gap-2 transition-colors ${
          !isCancelled
            ? 'hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-slate-700'
            : 'opacity-40 cursor-not-allowed text-slate-400'
        }`}
      >
        <Package size={13} className="text-blue-500 shrink-0" />
        <span>Batch Registry</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!canReceiveGoods}
        onClick={() => handleAction(onReceiveGoods)}
        title={
          isDraft || isPendingApproval
            ? 'Order must be approved before receiving goods'
            : isCancelled
            ? 'Order cancelled'
            : isFullyReceived
            ? 'All ordered quantity has already been received'
            : 'Record inward goods receipt (GRN)'
        }
        className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 transition-colors ${
          canReceiveGoods
            ? 'hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer text-slate-700'
            : 'opacity-40 cursor-not-allowed text-slate-400'
        }`}
      >
        <span className="flex items-center gap-2">
          <PackageCheck size={13} className="text-emerald-600 shrink-0" />
          <span>Receive Goods (GRN)</span>
        </span>
        {isFullyReceived && <span className="text-[9.5px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Received</span>}
        {isPartiallyReceived && <span className="text-[9.5px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Partial</span>}
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!canDispatch}
        onClick={() => handleAction(onSupplierDispatch)}
        title={!canDispatch ? 'PO must be approved before logging dispatch' : 'Log vendor shipment / challan'}
        className={`w-full px-3 py-1.5 text-left flex items-center gap-2 transition-colors ${
          canDispatch
            ? 'hover:bg-amber-50 hover:text-amber-700 cursor-pointer text-slate-700'
            : 'opacity-40 cursor-not-allowed text-slate-400'
        }`}
      >
        <Truck size={13} className="text-amber-600 shrink-0" />
        <span>Supplier Dispatch</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={!canMatchBill}
        onClick={() => handleAction(onPayVendorBill || onMatchVendorBill)}
        title={!canMatchBill ? 'Unavailable for draft or cancelled POs' : 'Pay vendor bills & match actual batch costs'}
        className={`w-full px-3 py-1.5 text-left flex items-center gap-2 transition-colors ${
          canMatchBill
            ? 'hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer text-slate-700'
            : 'opacity-40 cursor-not-allowed text-slate-400'
        }`}
      >
        <CreditCard size={13} className="text-emerald-600 shrink-0" />
        <span>Pay Vendor Bill</span>
      </button>

      <div className="my-1 border-t border-slate-100" />

      {/* ── Group 3: Cost & Tracking ── */}
      <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Cost &amp; Tracking
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onViewLandedCosts)}
        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer text-slate-700"
      >
        <IndianRupee size={13} className="text-emerald-600 shrink-0" />
        <span>View Landed Costs</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onMovementHistory)}
        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer text-slate-700"
      >
        <Clock size={13} className="text-slate-400 shrink-0" />
        <span>Movement History</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onPrint)}
        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer text-slate-700"
      >
        <Printer size={13} className="text-slate-400 shrink-0" />
        <span>Print Purchase Order</span>
      </button>

      <div className="my-1 border-t border-slate-100" />

      {/* ── Cancel Purchase Order ── */}
      <button
        type="button"
        role="menuitem"
        disabled={isCancelled}
        onClick={() => handleAction(onCancelPo || onDelete)}
        title={isCancelled ? 'This purchase order is already cancelled' : 'Cancel this purchase order'}
        className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 transition-colors ${
          !isCancelled
            ? 'text-rose-600 hover:bg-rose-50 cursor-pointer font-medium'
            : 'opacity-40 cursor-not-allowed text-slate-400'
        }`}
      >
        <span className="flex items-center gap-2">
          <Ban size={13} className={!isCancelled ? 'text-rose-500 shrink-0' : 'text-slate-400 shrink-0'} />
          <span>{isCancelled ? 'Cancelled PO' : 'Cancel Purchase Order'}</span>
        </span>
        {isCancelled && <span className="text-[9.5px] text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Cancelled</span>}
      </button>
    </div>,
    document.body
  );
}
