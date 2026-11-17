import React, { useState } from 'react';
import { RotateCcw, X, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function RestoreLeadModal({
  lead,
  leads = [],
  stages = [],
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}) {
  if (!isOpen) return null;

  const isBulk = Boolean(leads && leads.length > 0 && !lead);
  const targetLeads = isBulk ? leads : (lead ? [lead] : []);

  // Filter out any lost stages to ensure we only restore to active stages
  const activeStages = stages.filter((s) => s && !s.is_lost && !s.isLost && (s.is_active ?? s.isActive ?? true));
  const defaultStageId = activeStages[0]?.id || '';

  const [selectedStageId, setSelectedStageId] = useState(defaultStageId);
  const [dealStage, setDealStage] = useState('Draft');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      stageId: selectedStageId || defaultStageId,
      dealStage,
      leadIds: targetLeads.map((l) => l.id),
      targetLeads,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isBulk ? `Restore ${targetLeads.length} Lost Leads` : 'Restore Lead to Pipeline'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Bring lost lead{targetLeads.length > 1 ? 's' : ''} back into the active sales pipeline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Leads Summary */}
          {!isBulk && lead && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 text-xs">{lead.name}</span>
                {lead.amount ? (
                  <span className="text-xs font-bold text-emerald-600">
                    ₹ {Number(lead.amount).toLocaleString('en-IN')}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                {lead.company && lead.company !== '—' && (
                  <span>{lead.company}</span>
                )}
                {lead.leadNumber && (
                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                    {lead.leadNumber}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 font-semibold">
                  Lost ({lead.reasonLabel || lead.status || 'Lost'})
                </span>
              </div>
            </div>
          )}

          {isBulk && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{targetLeads.length} leads</span> will be restored to the active pipeline and removed from the Lost list.
            </div>
          )}

          {/* Explanation notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-blue-900 text-[11px]">
            <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Active Pipeline Restoration:</p>
              <p className="text-blue-700/90 mt-0.5">
                The lead will return to your active Leads list. Any linked deals in "Lost" stage will also be reopened so your sales team can re-engage with revised quotes.
              </p>
            </div>
          </div>

          {/* Target Lead Stage */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700" htmlFor="restore-stage">
              Move to Stage
            </label>
            <select
              id="restore-stage"
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              className="h-9.5 w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              required
            >
              {activeStages.length === 0 && (
                <option value="">Default Active Stage</option>
              )}
              {activeStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Deal Stage */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700" htmlFor="restore-deal-stage">
              Linked Deal Stage
            </label>
            <select
              id="restore-deal-stage"
              value={dealStage}
              onChange={(e) => setDealStage(e.target.value)}
              className="h-9.5 w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            >
              <option value="Draft">Draft (New opportunity)</option>
              <option value="Open">Open (In discussion / negotiation)</option>
              <option value="Sent">Sent (Quotation sent)</option>
              <option value="Revised">Revised (Revised quote / terms)</option>
            </select>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-60"
            >
              <RotateCcw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Restoring...' : isBulk ? `Restore ${targetLeads.length} Leads` : 'Restore to Active Leads'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
