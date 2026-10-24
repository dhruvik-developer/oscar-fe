import React from 'react';
import { X, Printer, Tag, PackageX } from 'lucide-react';

/**
 * [PHASE-4] Consolidated barcode/label printer.
 *   Replaces the duplicated BarcodeLabelModal (shelf tag) and
 *   PrintLabelModal (RMA shipping label) with one implementation.
 *
 *   - variant 'shelf' (default): warehouse bin / shelf tag showing SKU barcode.
 *   - variant 'rma': return-merchandise-authorization shipping label.
 *
 *   NOTE: this file was rewritten in place (no delete). The old PrintLabelModal
 *   in features/inventory now acts as a thin adapter to this modal.
 */
export const BarcodeLabelModal = ({ item, onClose, variant = 'shelf', rmaNumber, product, vendor, serialNumber, qty, notes, date }) => {
    if (!item)
        return null;
    const isRma = variant === 'rma';
    const brand = isRma ? 'Sweven Fabricators — RMA Logistics' : 'Sweven Warehouse Asset';
    const title = isRma ? 'Return Merchandise Auth Label' : 'Warehouse Shelf Tag & Barcode';
    const subtitle = isRma ? 'Ready-to-print return shipping label' : 'Ready-to-print standard bin label';
    const barcodeValue = isRma ? (rmaNumber || item.rmaNumber || 'RMA-0001') : (item.sku || 'SKU-0001');
    const price = Number(item.sellingPrice) || Number(item.price) || 0;
    // Shared printable label card body; fields depend on variant.
    return (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 printable-document">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-4 sm:p-6 shadow-2xl text-xs flex flex-col overflow-hidden print:max-h-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {isRma ? <PackageX className="w-5 h-5 text-rose-600"/> : <Tag className="w-5 h-5 text-blue-600"/>}
            <div>
              <h3 className="font-bold text-base text-[#1F2E4A]">{title}</h3>
              <p className="text-[11px] text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18}/>
          </button>
        </div>

        {/* Printable Label Card */}
        <div className="py-6 flex justify-center">
          <div className="border-2 border-slate-400 rounded-xl p-4 bg-white shadow-sm w-full max-w-80 space-y-3 print:border-black text-center">
            <div className="border-b border-slate-200 pb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{brand}</span>
              <h4 className="font-bold text-sm text-slate-900 truncate">{isRma ? (item.name || product || 'RMA Return') : item.name}</h4>
              {isRma && (
                <div className="mt-1 inline-flex items-center gap-1">
                  <span className="inline-block px-1.5 py-0.5 bg-black text-white font-mono font-bold text-[10px]">
                    PRIORITY RETURN
                  </span>
                </div>
              )}
              {!isRma && <p className="text-[11px] text-slate-500">Category: {item.category || 'General Hardware'}</p>}
            </div>

            {/* Barcode Graphic */}
            <div className="py-1 flex flex-col items-center justify-center">
              <div className="flex items-center justify-center gap-0.5 h-12 w-56 bg-white px-2">
                {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1].map((w, i) => (<div key={i} className="bg-slate-900 h-full" style={{ width: `${w * 1.5}px` }}/>))}
              </div>
              <span className="font-mono font-bold text-xs tracking-widest text-slate-800 mt-1">
                *{barcodeValue}*
              </span>
            </div>

            {/* Info Grid */}
            {isRma ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-gray-200 pt-2 text-left bg-slate-50 p-2 rounded-lg">
                <div>
                  <span className="text-[9px] text-slate-400 font-semibold block uppercase">Vendor / Return To</span>
                  <strong className="font-mono text-[11px] text-slate-800">{vendor || 'Replacement Supplier'}</strong>
                  <span className="text-[9px] text-slate-400 block">RMA Warranty Ingestion</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-semibold block uppercase">Serial No.</span>
                  <strong className="font-mono text-[11px] text-slate-800">{serialNumber || '—'}</strong>
                  <span className="text-[9px] text-slate-400 block">Qty: {qty || 1} UNIT(S)</span>
                </div>
                <div className="col-span-2 border-t border-dashed border-slate-300 pt-2">
                  <span className="text-[9px] text-slate-400 font-semibold block uppercase">Diagnostic Notes</span>
                  <p className="font-mono text-[10px] text-slate-700 truncate">Diag: {notes || 'System diagnostic check attached.'}</p>
                  <p className="text-[9px] text-slate-400 mt-1">Issued: {date || new Date().toLocaleDateString('en-GB')} • Sweven Warehouse Dept.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-left bg-slate-50 p-2 rounded-lg">
                <div>
                  <span className="text-[9px] text-slate-400 font-semibold block uppercase">Bin Location</span>
                  <strong className="font-mono text-[11px] text-blue-900">
                    {item.category === 'Electronics' ? 'BIN-E04-R2' : 'BIN-A12-R1'}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-semibold block uppercase">Selling Price</span>
                  <strong className="font-mono text-[11px] text-emerald-800">
                    ₹{price.toFixed(2)}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-4 border-t border-slate-200">
          <span className="text-[11px] text-slate-500">
            {isRma ? 'Barcode verified' : `Current Stock: <strong>${Number(item.stock) || 0} ${item.unit || 'pcs'}</strong>`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-3.5 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs">
              <Printer size={13}/> {isRma ? 'Print RMA Label' : 'Print Shelf Tag'}
            </button>
            <button onClick={onClose} className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium cursor-pointer">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>);
};