import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * StageSequenceReorder — the up/down control that sets a template's position.
 *
 * Sequence is the execution order every future project inherits, so the ends
 * of the list are hard stops rather than wrapping.
 */
export function StageSequenceReorder({ sequence, isFirst, isLast, onMove, stageName }) {
  const btn =
    'p-0.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-6 h-6 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">
        {sequence}
      </span>
      <div className="flex flex-col -space-y-0.5">
        <button
          type="button"
          className={btn}
          disabled={isFirst}
          onClick={() => onMove(-1)}
          aria-label={`Move ${stageName} earlier`}
          title="Move earlier"
        >
          <ChevronUp size={13} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className={btn}
          disabled={isLast}
          onClick={() => onMove(1)}
          aria-label={`Move ${stageName} later`}
          title="Move later"
        >
          <ChevronDown size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

export default StageSequenceReorder;
