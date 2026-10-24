import React from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { BarcodeLabelModal } from '../../components/common/BarcodeLabelModal';

/**
 * [PHASE-4] CONSOLIDATED — this component now delegates to the shared
 *   BarcodeLabelModal (components/common) with variant="rma".
 *   The original RMA-label implementation is retained below (commented out)
 *   as the restore-info under the no-delete rule. Both modals now print from
 *   one implementation.
 */
export const PrintLabelModal = ({ isOpen, onClose, part, }) => {
    if (!isOpen || !part)
        return null;
    return (
        <BarcodeLabelModal
            variant="rma"
            item={{ name: part.product || part.name, sku: part.sku || part.rmaNumber, category: part.category, stock: part.qty, unit: 'UNIT(S)', sellingPrice: part.sellingPrice || 0 }}
            rmaNumber={part.rmaNumber}
            product={part.product || part.name}
            vendor={part.vendor}
            serialNumber={part.serialNumber}
            qty={part.qty}
            notes={part.notes}
            date={part.date}
            onClose={onClose}
        />
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RESTORE-INFO (original PrintLabelModal RB89-2026 implementation, superseded
   by the consolidated BarcodeLabelModal in [PHASE-4]; uncomment + remove the
   adapter above to restore the standalone RMA modal).

const PrintLabelModalOriginal = ({ isOpen, onClose, part, }) => {
    if (!isOpen)
        return null;
    const handlePrint = () => {
        window.print();
    };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-lg border border-[#CED4DA] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 printable-document">
        <div className="px-5 py-3 border-b border-[#CED4DA] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#1F2E4A]"/>
            <span className="font-bold text-sm text-[#1F2E4A]">RMA Shipping & Inventory Label</span>
          </div>
          <button onClick={onClose} className="text-[#767c7e] hover:text-[#1F2E4A] p-1 rounded transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>
        <div className="p-4 sm:p-6 bg-slate-50 flex justify-center">
          <div className="w-full bg-white border-2 border-black p-4 rounded text-black font-sans text-xs space-y-3 shadow-md print:shadow-none">
            <div className="flex justify-between items-start border-b-2 border-black pb-2">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-gray-600">Horizon RMA Logistics</p>
                <h4 className="text-base font-extrabold tracking-tight">RETURN MERCHANDISE AUTH</h4>
              </div>
              <div className="text-right">
                <span className="inline-block px-1.5 py-0.5 bg-black text-white font-mono font-bold text-[10px]">PRIORITY RETURN</span>
              </div>
            </div>
            <div className="py-2 text-center border-b border-gray-300">
              <div className="h-10 mx-auto flex items-stretch justify-center gap-[2px] px-2">
                {[3,1,2,4,1,3,2,1,4,2,1,3,1,2,4,1,2,3,1,4,2,1,3,2,4,1,2,3,1,2,4,1,3,2,1,4,1,2,3,1,2,4,1,3,2].map((w, idx) => (<div key={idx} style={{ width: `${w}px` }} className={`bg-black ${idx % 7 === 0 ? 'bg-transparent' : ''}`}/>))}
              </div>
              <p className="font-mono text-[11px] font-bold tracking-widest mt-1">*{part.rmaNumber}*</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-semibold">Product / SKU</p>
                <p className="font-bold leading-tight">{part.product}</p>
                {part.sku && <p className="font-mono text-[10px] text-gray-700">{part.sku}</p>}
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-semibold">Destination Vendor</p>
                <p className="font-bold leading-tight">{part.vendor}</p>
                <p className="text-[10px] text-gray-600">RMA Warranty Ingestion</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-gray-200 pt-2">
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-semibold">Hardware Serial Number</p>
                <p className="font-mono font-bold text-xs">{part.serialNumber}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-semibold">Quantity</p>
                <p className="font-mono font-bold text-xs">{part.qty} UNIT(S)</p>
              </div>
            </div>
            <div className="border-t border-dashed border-gray-400 pt-2 text-[10px] text-gray-600">
              <p className="truncate font-mono">Diag: {part.notes || 'System diagnostic check attached.'}</p>
              <p className="text-[9px] text-gray-500 mt-1">Issued: {part.date} • Horizon Warehouse Dept.</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#CED4DA] bg-white flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
          <span className="text-[11px] text-green-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5"/> Barcode verified
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 border border-[#CED4DA] text-xs font-medium rounded text-[#343A40] hover:bg-gray-100">Close</button>
            <button onClick={handlePrint} className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152036] text-white text-xs font-medium rounded flex items-center gap-1.5 shadow-sm">
              <Printer className="w-3.5 h-3.5"/> Print Label
            </button>
          </div>
        </div>
      </div>
    </div>);
};
═══════════════════════════════════════════════════════════════════════════ */