import React, { useState, useEffect } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, AlertTriangle, Layers, Sliders, ShieldCheck, Award, QrCode, Eye } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatDisplayDate, formatWarrantyPeriod, getWarrantyStatusStyle } from '../../utils/warrantyUtils';
// Display unit without double-pluralizing ("Pcs" -> "Pcs", "Unit" -> "Units").
const pluralizeUom = (uom) => {
    if (!uom) return '';
    return /s$/i.test(uom) ? uom : `${uom}s`;
};
export const ItemStockDetailModal = ({ item, isOpen, onClose, }) => {
    const { calculateItemStock, getItemMovements, adjustItemStock, formatCurrency } = useERP();
    const [showAdjust, setShowAdjust] = useState(false);
    const [adjAmount, setAdjAmount] = useState(0);
    const [adjReason, setAdjReason] = useState('Cycle Count Verification');
    // UX only: Esc dismisses. Hooks before early return to keep order stable.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    const stock = calculateItemStock(item.id);
    const movements = getItemMovements(item.id);
    const handleApplyAdjustment = (e) => {
        e.preventDefault();
        if (adjAmount === 0)
            return;
        adjustItemStock(item.id, adjAmount, false, adjReason);
        setShowAdjust(false);
        setAdjAmount(0);
    };
    const getMovementTypeBadge = (type, qty) => {
        switch (type) {
            case 'PURCHASE':
                return (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <ArrowDownLeft className="w-3 h-3"/> Purchase In
          </span>);
            case 'SALE':
                return (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            <ArrowUpRight className="w-3 h-3"/> Sales Dispatch
          </span>);
            case 'SALES_RETURN':
                return (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
            <ArrowDownLeft className="w-3 h-3"/> Customer Return
          </span>);
            case 'PURCHASE_RETURN':
                return (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <ArrowUpRight className="w-3 h-3"/> Vendor Return
          </span>);
            case 'TRANSFER_IN':
            case 'TRANSFER_OUT':
                return (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
            <Layers className="w-3 h-3"/> {type.replace('_', ' ')}
          </span>);
            case 'FAULTY':
                return (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
            <AlertTriangle className="w-3 h-3"/> Faulty Defect
          </span>);
            case 'SERVICE_USAGE':
            case 'ZONE_ISSUE':
                return (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
            Internal Issue
          </span>);
            default:
                return (<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
            {qty > 0 ? '+' : ''}{type}
          </span>);
        }
    };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${item.name} stock detail`}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2 lg:gap-0 bg-slate-50">
          <div className="min-w-0 lg:min-w-auto">
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-3">
              <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
              <span className="font-mono text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                {item.sku}
              </span>
              <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                {item.category}
              </span>
              {item.trackingMode === 'Batch' && item.batchNumber && (
                <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                  Batch: {item.batchNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Primary Location: {item.location} • UOM: {item.uom} • Reorder Threshold: {item.reorderLevel} {pluralizeUom(item.uom)}
              {item.expiryDate ? ` • Expiry: ${item.expiryDate}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer" aria-label="Close stock detail">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Stock Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-xs text-slate-500 font-medium">Physical On Hand</span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {stock.onHand} <span className="text-xs font-normal text-slate-400">{pluralizeUom(item.uom)}</span>
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
              <span className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5"/> Available to Sell
              </span>
              <p className="text-2xl font-bold font-mono text-emerald-800 mt-1">
                {stock.available} <span className="text-xs font-normal text-emerald-600">{pluralizeUom(item.uom)}</span>
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              <span className="text-xs text-amber-700 font-medium">SO Reserved</span>
              <p className="text-2xl font-bold font-mono text-amber-800 mt-1">
                {stock.reserved} <span className="text-xs font-normal text-amber-600">{pluralizeUom(item.uom)}</span>
              </p>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5">
              <span className="text-xs text-rose-700 font-medium">Defective / Damaged</span>
              <p className="text-2xl font-bold font-mono text-rose-800 mt-1">
                {stock.damaged} <span className="text-xs font-normal text-rose-600">{pluralizeUom(item.uom)}</span>
              </p>
            </div>
          </div>

          {/* Quick Stock Adjustment Trigger */}
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Physical Inventory Adjustment</h4>
              <p className="text-xs text-slate-500 mt-0.5">Need to record cycle count discrepancy or write-off?</p>
            </div>
            <button onClick={() => setShowAdjust(!showAdjust)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg shadow-sm transition-colors cursor-pointer">
              <Sliders className="w-3.5 h-3.5"/>
              {showAdjust ? 'Cancel Adjustment' : 'Adjust Stock Quantity'}
            </button>
          </div>

          {showAdjust && (<form onSubmit={handleApplyAdjustment} className="bg-blue-50/50 border border-blue-200 p-4 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quantity Delta (+ Add / - Subtract)
                  </label>
                  <input type="number" value={adjAmount} onChange={(e) => setAdjAmount(Number(e.target.value))} placeholder="e.g. +5 or -2" className="w-full text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" required/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adjustment Reason / Reference
                  </label>
                  <input type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Cycle count, damaged write-off..." className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" required/>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdjust(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm cursor-pointer">
                  Confirm & Post to Ledger
                </button>
              </div>
            </form>)}

          {/* Warranty Policy & Physical Asset Registry Section */}
          <div className="bg-gradient-to-r from-emerald-50/60 to-teal-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Equipment Warranty Policy & Asset Registry
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Product Master default coverage & active serial number registry
                  </p>
                </div>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                item.warrantyApplicable !== false
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {item.warrantyApplicable !== false ? 'Warranty Applicable' : 'No Warranty Policy'}
              </span>
            </div>

            {item.warrantyApplicable !== false ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-3 rounded-lg border border-emerald-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Standard Warranty</span>
                    <p className="font-bold text-emerald-700">{formatWarrantyPeriod(item.warrantyPeriod || 3, item.warrantyUnit || 'Years')}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Start Trigger</span>
                    <p className="font-medium text-slate-800">{item.warrantyStartEvent || 'Delivery (Challan Dispatch)'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Manufacturer OEM</span>
                    <p className="font-medium text-slate-700">
                      {item.manufacturerWarrantyPeriod ? formatWarrantyPeriod(item.manufacturerWarrantyPeriod, item.manufacturerWarrantyUnit) : 'Included in Standard'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Coverage Type</span>
                    <p className="font-semibold text-blue-700">Standard OEM Warranty</p>
                  </div>
                </div>

                {/* Serial Number Coverage Table */}
                {(item.trackingMode === 'Serial' || (item.serialNumbers && item.serialNumbers.length > 0)) && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                      Physical Serial Numbers ({item.serialNumbers?.length || 0} units)
                    </span>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full min-w-[560px] lg:min-w-0 text-left text-xs">
                        <thead className="bg-slate-50 font-semibold text-slate-500 text-[10px] uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Serial #</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Standard Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(item.serialNumbers || []).map((sn) => (
                            <tr key={sn} className="hover:bg-slate-50/60">
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 flex items-center gap-1">
                                <QrCode size={11} className="text-blue-600" />
                                {sn}
                              </td>
                              <td className="py-2 px-3">
                                <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  In Warehouse
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600">
                                {item.warrantyPeriod || 3} {item.warrantyUnit || 'Years'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Standard consumable / non-warranted item.
              </p>
            )}
          </div>

          {/* Movement Audit History Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Inventory Movement Audit Ledger ({movements.length} events)
              </h4>
              <span className="text-[11px] text-slate-400">Strict chronological order</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] lg:min-w-0 text-left text-xs text-slate-600">
                <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Reference #</th>
                    <th className="py-2.5 px-3 text-right">Qty Change</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Details / Serials</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {movements.length === 0 ? (<tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No ledger movements recorded for this item yet.
                      </td>
                    </tr>) : (movements.map((m) => (<tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{m.date}</td>
                        <td className="py-2 px-3">{getMovementTypeBadge(m.type, m.quantity)}</td>
                        <td className="py-2 px-3 font-mono font-medium text-slate-800">
                          {m.referenceNumber || m.referenceType}
                        </td>
                        <td className={`py-2 px-3 text-right font-mono font-bold ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {item.uom}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{m.locationName || 'Main Warehouse'}</td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] max-w-xs">
                          {m.serials && m.serials.length > 0 ? (
                            <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              SN: {m.serials.join(', ')}
                            </span>
                          ) : m.notes || '-'}
                        </td>
                      </tr>)))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
          <div className="text-xs text-slate-500">
            Total Asset Value: <span className="font-mono font-bold text-slate-900">{formatCurrency(stock.onHand * (item.costPrice || item.unitCost || 0))}</span> (Cost: {formatCurrency(item.costPrice || item.unitCost || 0)} | Price: {formatCurrency(item.sellingPrice || 0)})
          </div>
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-sm transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>

    </div>);
};
