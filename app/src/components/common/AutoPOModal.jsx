import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { getCurrentISODate } from '../../utils/dateUtils';
import MasterSourceLink from './MasterSourceLink';
export const AutoPOModal = ({
  isOpen,
  onClose,
  shortageItem,
  item,
  requiredDeficitQty,
  defaultDeficitQty,
  sourceRef,
  sourceDocNumber,
}) => {
  const { vendors = [], items: masterItems = [], addPurchaseOrder } = useERP() || {};
  const activeItem = shortageItem || item;
  const initialQty = Number(requiredDeficitQty || defaultDeficitQty) || 0;
  const activeSource = sourceRef || sourceDocNumber || '';
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [orderQty, setOrderQty] = useState(initialQty);
  const [unitCost, setUnitCost] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeItem) {
      const targetId =
        'sku' in activeItem
          ? masterItems.find((m) => m.sku === activeItem.sku)?.id || ''
          : activeItem.itemId || '';
      const matched = masterItems.find(
        (m) => m.id === targetId || m.sku === activeItem.sku || m.sku === activeItem.itemSku
      );
      if (matched) {
        setSelectedItemId(matched.id);
        setUnitCost(matched.costPrice ?? matched.unitCost ?? '');
      }
      setOrderQty(initialQty);
      setNotes(activeSource ? `Replenishment for ${activeSource}` : '');
    }
  }, [activeItem, initialQty, activeSource, masterItems, selectedItemId]);

  // UX only: Esc dismisses. No logic changes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const targetMasterItem = masterItems.find((m) => m.id === selectedItemId);
  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);
  const totalPOAmount = (Number(orderQty) || 0) * (Number(unitCost) || 0);

  const handleCreatePO = async (e) => {
    e.preventDefault();
    if (!targetMasterItem || !selectedVendor || !(Number(orderQty) > 0)) return;
    const lineItem = {
      id: `li-po-${Date.now()}`,
      itemId: targetMasterItem.id,
      itemSku: targetMasterItem.sku,
      description: targetMasterItem.name,
      qty: Number(orderQty),
      rate: Number(unitCost) || 0,
      discount: 0,
      tax: 0,
      amount: totalPOAmount,
    };
    setSaving(true);
    try {
      await addPurchaseOrder({
        vendorId: selectedVendor.id,
        date: getCurrentISODate(),
        expectedDate: expectedDate || undefined,
        status: 'Issued',
        items: [lineItem],
        notes,
      });
      onClose();
    } catch {
      // The reason was shown; keep the requisition open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150 overflow-y-auto" onClick={onClose} role="dialog" aria-modal="true" aria-label="Auto-PO shortage requisition">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-4 sm:p-6 text-xs flex flex-col overflow-hidden my-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1F2E4A]">Auto-PO Shortage Requisition</h3>
              <p className="text-[11px] text-slate-500">Procuring deficit stock for {activeSource}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortage Context Banner */}
        <div className="my-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-900">
              Shortage Detected: {targetMasterItem?.name || activeItem?.description || 'Item'}
            </p>
            <p className="text-[11px] text-amber-800">
              Pre-filling purchase requisition for{' '}
              <strong className="font-mono">{orderQty} units</strong> to eliminate warehouse
              deficit.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreatePO} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700">
                Target Inventory Item / SKU *
              </label>
              <MasterSourceLink source="items" />
            </div>
            <select
              autoFocus
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                const m = masterItems.find((it) => it.id === e.target.value);
                if (m) setUnitCost(m.costPrice ?? m.unitCost ?? '');
              }}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium"
              required
            >
              <option value="">Select item</option>
              {(masterItems || []).map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.sku}] {m.name} (Stock: {m.availableQty ?? m.stock ?? 0} Avail)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  Target Supplier / Vendor *
                </label>
                <MasterSourceLink source="vendors" />
              </div>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium"
                required
              >
                <option value="">Select vendor</option>
                {(vendors || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.paymentTerms ? ` (${v.paymentTerms})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Intake Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Requisition Qty *</label>
              <input
                type="number"
                min="1"
                required
                value={orderQty}
                onChange={(e) => setOrderQty(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Requisition Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Expedited PO for client order fulfillment"
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
            <div className="font-mono text-xs text-slate-600">
              Total PO:{' '}
              <strong className="text-slate-900 font-bold">
                ₹{totalPOAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Issue Purchase Order
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
