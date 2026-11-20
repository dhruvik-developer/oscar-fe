import React from 'react';
import {
  X,
  ShieldCheck,
  Printer,
  Factory,
  Layers,
  Truck,
  Coins,
  Receipt,
  CheckCircle2,
  Calendar,
  Building,
} from 'lucide-react';
import { formatNum } from '../../utils/loomCalculations';

export default function FabricPassportModal({ passport, onClose }) {
  if (!passport) return null;

  const origin = passport.origin_factory || {};
  const mill = passport.processing_mill || {};
  const logistics = passport.logistics || {};
  const landed = passport.landed_cost || {};
  const je = passport.accounts_journal_entry || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Fabric Traceability Passport
                </h3>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  {passport.passport_id || 'PASSPORT-VERIFIED'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                End-to-end manufacturing lineage: Factory Weaving → Mill Dyeing → Landed Rate → Accounts Ledger
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Passport Body */}
        <div id="fabric-passport-printable" className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-800/30 text-xs">
          {/* Top Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Fabric Quality Specification</span>
              <span className="text-base font-black text-slate-900 dark:text-slate-100">{passport.quality || 'Standard Fabric'}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Passport Batch Code</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">{passport.batch_code || 'BATCH-PROD'}</span>
            </div>
          </div>

          {/* Step 1: Weaving Origin */}
          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1">
              <span className="flex items-center gap-1.5">
                <Factory size={14} className="text-blue-600" />
                1. Weaving Origin & Grey Off-Loom
              </span>
              <span className="font-mono text-blue-600">Off-Loom Grey Cost: ₹{origin.grey_cost_m || '0.00'}/m</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400 block">Weaving Factory:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{origin.name || 'Weaving Shed'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Weaving Job Rate:</span>
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-200">₹{origin.weaving_rate || '0.00'} / m</span>
              </div>
              <div>
                <span className="text-slate-400 block">Raw Yarn Cost:</span>
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-200">₹{origin.yarn_cost || '0.00'} / m</span>
              </div>
              <div>
                <span className="text-slate-400 block">Dispatched to Mill:</span>
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-200">{formatNum(origin.dispatch_meters)} m ({origin.dispatch_taka} rolls)</span>
              </div>
            </div>
          </div>

          {/* Step 2: Mill Processing */}
          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1">
              <span className="flex items-center gap-1.5">
                <Layers size={14} className="text-purple-600" />
                2. Dyeing / Processing Mill
              </span>
              <span className="font-mono text-purple-600">Dyeing Rate: ₹{mill.dyeing_rate || '0.00'}/m</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400 block">Processing Mill:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">{mill.name || 'Dyeing Mill'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Process Type:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{mill.process_type || 'Dyeing'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Received Fabric:</span>
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-200">{formatNum(mill.inward_meters)} m ({mill.inward_taka} rolls)</span>
              </div>
              <div>
                <span className="text-slate-400 block">Shrinkage %:</span>
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-200">{mill.shrinkage_pct || '0.00'}%</span>
              </div>
            </div>
          </div>

          {/* Step 3: Logistics & Freight */}
          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1">
              <span className="flex items-center gap-1.5">
                <Truck size={14} className="text-amber-600" />
                3. Logistics & Transit Handling
              </span>
              <span className="font-mono text-amber-600">Freight Rate: ₹{logistics.logistic_rate || '0.00'}/m</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400 block">Transporter:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{logistics.transporter || 'Transporter'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Vehicle No:</span>
                <span className="font-semibold font-mono uppercase text-slate-700 dark:text-slate-200">{logistics.vehicle_no || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Freight Amount:</span>
                <span className="font-semibold font-mono text-slate-700 dark:text-slate-200">₹{logistics.total_freight || '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Step 4: Final Landed Fabric Valuation */}
          <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-blue-500/10 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Final Landed Fabric Rate (Composite)
                </span>
                <span className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300">
                  ₹ {landed.total_rate_m || '0.00'} <span className="text-xs font-normal text-slate-500">/ meter</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Landed Fabric Valuation
                </span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
                  ₹ {Number(landed.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 flex flex-wrap gap-2 pt-1 border-t border-emerald-200 dark:border-emerald-900/50">
              <span>Weaving: ₹{landed.weaving_rate_m || '0.00'}</span> +
              <span>Yarn: ₹{landed.yarn_cost_m || '0.00'}</span> +
              <span>Dyeing: ₹{landed.dyeing_rate_m || '0.00'}</span> +
              <span>Logistics: ₹{landed.logistic_rate_m || '0.00'}</span>
            </div>
          </div>

          {/* Step 5: Accounts Integration */}
          {je.entry_number && (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-blue-600" />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                    Posted in Accounts General Ledger
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Journal Voucher #{je.entry_number} • Date: {je.date}
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 size={12} /> {je.status || 'Posted'}
              </span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="pms-btn-secondary"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="pms-btn-primary"
          >
            <Printer size={15} />
            Print Passport
          </button>
        </div>
      </div>
    </div>
  );
}
