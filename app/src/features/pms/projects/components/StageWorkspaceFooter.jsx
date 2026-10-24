import React from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

/**
 * Standard Unified Stage Workspace Footer
 * Provides identical bottom navigation across ALL stages in the PMS cycle.
 */
export function StageWorkspaceFooter({
  currentSeq,
  totalStages = 18,
  prevStage,
  nextStage,
  onSelectStage,
  stage,
}) {
  const seq = Number(stage?.sequence ?? currentSeq ?? 1);
  const prevSeq = prevStage ? Number(prevStage.sequence) : seq > 1 ? seq - 1 : null;
  const nextSeq = nextStage ? Number(nextStage.sequence) : seq < totalStages ? seq + 1 : null;

  const prevName =
    prevStage?.name?.replace(/^Stage\s*\d+\s*[:\-\.]\s*/i, '') || (prevSeq ? `Stage ${prevSeq}` : '');
  const nextName =
    nextStage?.name?.replace(/^Stage\s*\d+\s*[:\-\.]\s*/i, '') || (nextSeq ? `Stage ${nextSeq}` : '');

  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs mt-4">
      {/* Previous Stage Button */}
      {prevSeq ? (
        <button
          type="button"
          onClick={() => onSelectStage && onSelectStage(prevSeq)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#dce5f4] bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowLeft size={14} className="text-slate-400" />
          <span>
            Back to Stage {prevSeq}: <span className="font-normal text-slate-500">{prevName}</span>
          </span>
        </button>
      ) : (
        <div className="text-xs text-slate-400 italic">First project stage</div>
      )}

      {/* Stage Indicator Pill */}
      <div className="text-[11px] font-bold text-slate-400 text-center">
        Stage {seq} of {totalStages}
        {stage?.status === 'Completed' && (
          <span className="ml-1.5 text-emerald-600 inline-flex items-center gap-0.5">
            <Check size={11} strokeWidth={3} /> Completed
          </span>
        )}
      </div>

      {/* Next Stage Button */}
      {nextSeq ? (
        <button
          type="button"
          onClick={() => onSelectStage && onSelectStage(nextSeq)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
        >
          <span>
            Proceed to Stage {nextSeq}: <span className="font-normal opacity-90">{nextName}</span>
          </span>
          <ArrowRight size={14} />
        </button>
      ) : (
        <div className="text-xs text-slate-400 italic">Final project stage</div>
      )}
    </div>
  );
}

export default StageWorkspaceFooter;
