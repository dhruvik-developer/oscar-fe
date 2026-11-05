import React from 'react';
import { X, IndianRupee, ExternalLink, Calculator, Layers, Truck, Factory } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PoLandedCostsModal({
  po,
  formatCurrency,
  onClose,
}) {
  const navigate = useNavigate();

  if (!po) return null;

  const lines = po.items || po.lineItems || [];
  const basePurchaseTotal = lines.reduce((s, l) => s + ((Number(l.qty) || 0) * (Number(l.rate) || 0)), 0);
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const uom = lines[0]?.uom || 'Mtr';

  const yarnRows = po.yarnLines || po.yarnRows || [];
  const yarnTotal = yarnRows.reduce((s, y) => s + ((Number(y.qty) || 0) * (Number(y.rate) || 0)), 0);

  const expenseRows = po.expenses || po.costRows || [];
  const expenseTotal = expenseRows.reduce((s, e) => s + (Number(e.amount) || (Number(e.costPerMtr || e.rate || 0) * totalQty) || 0), 0);

  const totalLandedCost = basePurchaseTotal + yarnTotal + expenseTotal;
  const landedPerUnit = totalQty > 0 ? (totalLandedCost / totalQty) : 0;
  const baseRatePerUnit = totalQty > 0 ? (basePurchaseTotal / totalQty) : 0;
  const additionalCostPerUnit = landedPerUnit - baseRatePerUnit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-2xl w-full p-4 sm:p-6 max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
              <IndianRupee size={15} />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1F2E4A]">Landed Costs &amp; Unit Economics</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {po.poNumber} • {po.vendor} • {totalQty.toLocaleString('en-IN')} {uom}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
          {/* Headline Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Base PO Value</span>
              <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
                {formatCurrency(basePurchaseTotal)}
              </span>
              <span className="text-[10.5px] text-slate-500 mt-0.5 block">₹{baseRatePerUnit.toFixed(2)} / {uom}</span>
            </div>
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Additional Expenses</span>
              <span className="text-base font-extrabold text-amber-950 font-mono mt-0.5 block">
                {formatCurrency(yarnTotal + expenseTotal)}
              </span>
              <span className="text-[10.5px] text-amber-700 mt-0.5 block">+₹{additionalCostPerUnit.toFixed(2)} / {uom}</span>
            </div>
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Total Landed Cost</span>
              <span className="text-base font-extrabold text-emerald-950 font-mono mt-0.5 block">
                {formatCurrency(totalLandedCost)}
              </span>
              <span className="text-[10.5px] font-bold text-emerald-800 mt-0.5 block">₹{landedPerUnit.toFixed(2)} / {uom} landed</span>
            </div>
          </div>

          {/* Cost Components Breakdown */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-xs">
              Cost Allocation Breakdown
            </div>
            <div className="divide-y divide-slate-100 text-[11.5px]">
              <div className="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <Factory size={13} className="text-slate-400" />
                  <div>
                    <span className="font-semibold text-slate-800">1. Grey Fabric Procurement</span>
                    <p className="text-[10px] text-slate-400">{lines[0]?.name || 'Base supplier contract'}</p>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-slate-900">{formatCurrency(basePurchaseTotal)}</span>
                  <span className="text-[10px] text-slate-400 block">{totalQty > 0 ? `${Math.round((basePurchaseTotal / totalLandedCost) * 100)}%` : '100%'}</span>
                </div>
              </div>

              {yarnRows.length > 0 && (
                <div className="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <Layers size={13} className="text-slate-400" />
                    <div>
                      <span className="font-semibold text-slate-800">2. Yarn Supply Costs</span>
                      <p className="text-[10px] text-slate-400">{yarnRows.length} yarn allocation{yarnRows.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-slate-900">{formatCurrency(yarnTotal)}</span>
                    <span className="text-[10px] text-slate-400 block">{totalLandedCost > 0 ? `${Math.round((yarnTotal / totalLandedCost) * 100)}%` : '0%'}</span>
                  </div>
                </div>
              )}

              {expenseRows.map((e, idx) => (
                <div key={e.id || idx} className="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <Truck size={13} className="text-slate-400" />
                    <div>
                      <span className="font-semibold text-slate-800">{e.name || e.category || 'Freight / Processing Expense'}</span>
                      <p className="text-[10px] text-slate-400">{e.vendor || e.stage || 'Associated landed charge'}</p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-slate-900">{formatCurrency(e.amount || 0)}</span>
                    <span className="text-[10px] text-slate-400 block">{totalLandedCost > 0 ? `${Math.round(((e.amount || 0) / totalLandedCost) * 100)}%` : '0%'}</span>
                  </div>
                </div>
              ))}

              {expenseRows.length === 0 && yarnRows.length === 0 && (
                <div className="px-3.5 py-4 text-center text-slate-400 italic">
                  No additional yarn or freight expenses booked. Estimated landed rate equals base purchase rate.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/inventory/lot-costing');
            }}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold flex items-center gap-1.5 text-xs shadow-2xs transition cursor-pointer"
          >
            <ExternalLink size={13} /> View Full Lot Costing Ledger
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
