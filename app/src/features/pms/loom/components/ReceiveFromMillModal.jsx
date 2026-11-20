import React, { useState, useMemo } from 'react';
import {
  X,
  Layers,
  ArrowRight,
  Truck,
  Building,
  CheckCircle2,
  AlertCircle,
  Receipt,
  FileCheck,
  Coins,
} from 'lucide-react';
import { loomService } from '../../../../services/loomService';
import { formatNum, preventNegativeInput } from '../../utils/loomCalculations';

export default function ReceiveFromMillModal({ dispatch, onClose, onSuccess }) {
  const [inwardMeters, setInwardMeters] = useState(() => String(dispatch?.meters || ''));
  const [inwardTaka, setInwardTaka] = useState(() => String(dispatch?.taka || '1'));
  const [inwardChallan, setInwardChallan] = useState('');
  const [inwardDate, setInwardDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weavingRate, setWeavingRate] = useState(() => String(dispatch?.weaving_rate || ''));
  const [yarnRate, setYarnRate] = useState(() => String(dispatch?.yarn_rate || ''));
  const [dyeingRate, setDyeingRate] = useState(() => String(dispatch?.dyeing_rate || ''));
  const [logisticRate, setLogisticRate] = useState(() => String(dispatch?.logistic_rate || ''));
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const wRate = Number(weavingRate) || 0;
  const yRate = Number(yarnRate) || 0;
  const dRate = Number(dyeingRate) || 0;
  const lRate = Number(logisticRate) || 0;
  const landedRate = Number((wRate + yRate + dRate + lRate).toFixed(2));

  const metersNum = Number(inwardMeters) || 0;
  const totalAmount = Number((landedRate * metersNum).toFixed(2));

  const origMeters = Number(dispatch?.meters || 0);
  const shrinkagePct = useMemo(() => {
    if (!origMeters || !metersNum || origMeters === metersNum) return '0.00';
    return (((origMeters - metersNum) / origMeters) * 100).toFixed(2);
  }, [origMeters, metersNum]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!metersNum || metersNum <= 0) {
      setErrorMsg('Please enter valid inward meters.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await loomService.receiveFromMill(dispatch.id, {
        inward_meters: metersNum,
        inward_taka: Number(inwardTaka) || 1,
        inward_challan: inwardChallan,
        inward_date: inwardDate,
        weaving_rate: wRate,
        yarn_rate: yRate,
        dyeing_rate: dRate,
        logistic_rate: lRate,
      });
      onSuccess(res?.passport || {});
    } catch (err) {
      setErrorMsg(err?.payload?.detail || err?.message || 'Failed to record mill inward');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Receive Fabric from Mill & Calculate Landed Cost
              </h3>
              <p className="text-xs text-slate-500">
                Inward finished rolls, calculate full composite rate (Weaving + Dyeing + Logistics), and post to Accounts.
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

        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Origin Summary Badge */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Weaving Factory</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{dispatch.factory_name || 'Factory'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Processing Mill</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">{dispatch.mill_name || 'Dyeing Mill'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Quality</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{dispatch.quality_name}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Dispatched</span>
            <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{formatNum(dispatch.meters)} m ({dispatch.taka} takas)</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Inward Quantities */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              1. Mill Return Challan & Receipt
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="pms-label">Inward Date</label>
                <input
                  type="date"
                  value={inwardDate}
                  onChange={(e) => setInwardDate(e.target.value)}
                  className="pms-input w-full"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Mill Return Challan No</label>
                <input
                  type="text"
                  placeholder="e.g. MILL/IN/104"
                  value={inwardChallan}
                  onChange={(e) => setInwardChallan(e.target.value)}
                  className="pms-input w-full font-mono"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="pms-label">Received Meters</label>
                  {Number(shrinkagePct) !== 0 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-semibold">
                      Shrinkage: {shrinkagePct}%
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="e.g. 1960"
                  value={inwardMeters}
                  onChange={(e) => setInwardMeters(e.target.value)}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono font-bold text-blue-600 dark:text-blue-400"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Received Takas (Rolls)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 20"
                  value={inwardTaka}
                  onChange={(e) => setInwardTaka(e.target.value)}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Rate Breakdown per Meter */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              2. Cost Components per Linear Meter (₹ / meter)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="pms-label">Weaving Job Rate (₹/m)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="8.50"
                  value={weavingRate}
                  onChange={(e) => setWeavingRate(e.target.value)}
                  className="pms-input w-full font-mono"
                />
              </div>
              <div>
                <label className="pms-label">Raw Yarn Cost (₹/m)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="45.00"
                  value={yarnRate}
                  onChange={(e) => setYarnRate(e.target.value)}
                  className="pms-input w-full font-mono"
                />
              </div>
              <div>
                <label className="pms-label text-purple-600 dark:text-purple-400 font-semibold">Dyeing Rate (₹/m)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="14.00"
                  value={dyeingRate}
                  onChange={(e) => setDyeingRate(e.target.value)}
                  className="pms-input w-full font-mono font-semibold text-purple-600 dark:text-purple-400"
                />
              </div>
              <div>
                <label className="pms-label text-amber-600 dark:text-amber-400 font-semibold">Logistics / Freight (₹/m)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="1.50"
                  value={logisticRate}
                  onChange={(e) => setLogisticRate(e.target.value)}
                  className="pms-input w-full font-mono font-semibold text-amber-600 dark:text-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Live Landed Cost & Accounts Preview */}
          <div className="p-4 bg-gradient-to-r from-purple-50/70 to-blue-50/70 dark:from-slate-800/60 dark:to-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100 dark:border-purple-900/40 pb-2">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Landed Fabric Rate
                </span>
                <span className="text-2xl font-black font-mono text-purple-700 dark:text-purple-300">
                  ₹ {landedRate.toFixed(2)} <span className="text-xs font-normal text-slate-500">/ meter</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Landed Valuation ({formatNum(metersNum)} m)
                </span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
                  ₹ {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Receipt size={14} className="text-emerald-600" />
                <span>Automated Double-Entry Accounts Posting:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                <div className="p-2 bg-white/70 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-emerald-600 font-bold block">Debit (Asset):</span>
                  <div>Dr. Finished Goods Inventory: ₹{totalAmount.toFixed(2)}</div>
                </div>
                <div className="p-2 bg-white/70 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-blue-600 font-bold block">Credit (Payables & WIP):</span>
                  <div>Cr. Weaving Payable: ₹{(wRate * metersNum).toFixed(2)}</div>
                  <div>Cr. Dyeing Mill Payable: ₹{(dRate * metersNum).toFixed(2)}</div>
                  {lRate > 0 && <div>Cr. Freight Transporter: ₹{(lRate * metersNum).toFixed(2)}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="pms-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="pms-btn-primary bg-purple-600 hover:bg-purple-700"
            >
              <CheckCircle2 size={16} className={submitting ? 'animate-spin' : ''} />
              {submitting ? 'Inwarding & Posting...' : 'Confirm Mill Inward & Post to Accounts'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
