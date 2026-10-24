import React from 'react';
import { Check, Circle, Clock, ShieldCheck, ArrowRight } from 'lucide-react';

function TimelineConnector({ isCompleted, isCurrent, isNextCurrent, isPartial }) {
  if (isCompleted) {
    return (
      <div className="hidden sm:flex items-center justify-center shrink-0 -mt-6 sm:-mt-7 px-0.5 select-none w-5 sm:w-8">
        <svg className="w-5 sm:w-8 h-4 overflow-visible" viewBox="0 0 32 16" fill="none">
          <line x1="2" y1="8" x2="24" y2="8" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M19 4 L26 8 L19 12" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  if (isCurrent || isPartial) {
    return (
      <div className="hidden sm:flex items-center justify-center shrink-0 -mt-6 sm:-mt-7 px-0.5 select-none w-5 sm:w-8">
        <svg className="w-5 sm:w-8 h-4 overflow-visible" viewBox="0 0 32 16" fill="none">
          <line x1="2" y1="8" x2="24" y2="8" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
          <path d="M19 4 L26 8 L19 12" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="hidden sm:flex items-center justify-center shrink-0 -mt-6 sm:-mt-7 px-0.5 select-none w-5 sm:w-8">
      <svg className="w-5 sm:w-8 h-4 overflow-visible" viewBox="0 0 32 16" fill="none">
        <line x1="2" y1="8" x2="24" y2="8" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
        <path d="M19 5 L25 8 L19 11" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export const DocumentTimeline = ({ steps, onStepClick, className = '' }) => {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs ${className}`}>
      <style>{`
        @keyframes flowDash {
          to { stroke-dashoffset: -14; }
        }
        .animate-flow-dash {
          animation: flowDash 0.9s linear infinite;
        }
        .timeline-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .timeline-scroll::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 9999px;
        }
        .timeline-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .timeline-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Document Lifecycle Progression
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium">Click any node to navigate stage</span>
          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
            {steps.length} Stages
          </span>
        </div>
      </div>

      <div className="timeline-scroll overflow-x-auto pb-1.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 min-w-max px-1">
          {steps.map((step, idx) => {
            const isApprovedStatus = ['APPROVED', 'VERIFIED', 'COMPLETED', 'PAID', 'PASSED'].includes(
              String(step.statusLabel || '').trim().toUpperCase()
            );
            const isCompleted = step.status === 'completed' || isApprovedStatus;
            const isPartial = !isCompleted && (step.status === 'partial' || step.isPartial);
            const isCurrent = !isCompleted && !isPartial && step.status === 'current';
            const isHighlighted = Boolean(step.highlightCard || (step.key === 'grey_fabric_qc' && step.isHighlighted));
            const isLast = idx === steps.length - 1;
            const nextStep = steps[idx + 1];
            const isNextCompleted =
              nextStep?.status === 'completed' ||
              ['APPROVED', 'VERIFIED', 'COMPLETED', 'PAID', 'PASSED'].includes(
                String(nextStep?.statusLabel || '').trim().toUpperCase()
              );
            const isNextCurrent = !isNextCompleted && (nextStep?.status === 'current' || nextStep?.status === 'partial');

            return (
              <React.Fragment key={idx}>
                <div
                  role={onStepClick ? 'button' : undefined}
                  tabIndex={onStepClick ? 0 : undefined}
                  onClick={() => onStepClick && onStepClick(step, idx)}
                  className={`group flex items-start sm:flex-col sm:items-center gap-2.5 sm:gap-1.5 flex-1 min-w-[90px] sm:min-w-[100px] max-w-[130px] p-1.5 sm:p-2 rounded-xl transition-all select-none ${
                    isCompleted
                      ? (isHighlighted
                        ? 'bg-emerald-50/70 ring-2 ring-emerald-400 shadow-2xs'
                        : onStepClick
                        ? 'hover:bg-slate-50 cursor-pointer active:scale-95'
                        : '')
                      : (isCurrent || isHighlighted)
                      ? 'bg-blue-50/70 ring-1 ring-blue-300 shadow-2xs'
                      : onStepClick
                      ? 'hover:bg-slate-50 cursor-pointer active:scale-95'
                      : ''
                  }`}
                  title={onStepClick ? `Navigate to: ${step.label}` : undefined}
                >
                  {/* Clean Uniform Circular Node */}
                  <div className="relative flex items-center justify-center shrink-0">
                    {isCompleted ? (
                      <div className={`w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md ${isHighlighted ? 'ring-4 ring-emerald-100 scale-105' : 'shadow-xs'} group-hover:scale-105 transition-transform`}>
                        {step.key?.includes('qc') ? (
                          <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </div>
                    ) : isCurrent || isHighlighted ? (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 border-2 border-white text-white flex items-center justify-center shadow-md ring-4 ring-blue-100 group-hover:scale-105 transition-transform">
                        {step.key?.includes('qc') ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4 animate-spin-slow" />
                        )}
                      </div>
                    ) : isPartial ? (
                      <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs ring-3 ring-amber-100 group-hover:scale-105 transition-transform">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <span className="text-[10px] font-bold font-mono text-slate-400">{idx + 1}</span>
                      </div>
                    )}
                  </div>

                  {/* Text Details with Consistent Sizing */}
                  <div className="text-left sm:text-center min-w-0 w-full">
                    <p
                      className={`text-[11px] font-bold leading-tight line-clamp-2 transition-colors ${
                        isCompleted
                          ? 'text-emerald-950 font-bold'
                          : isCurrent || isHighlighted
                          ? 'text-blue-950 font-black'
                          : isPartial
                          ? 'text-amber-900 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </p>

                    {/* Stage status indicator pill */}
                    {(step.statusLabel || isCurrent || isHighlighted || isCompleted) && (
                      <span
                        className={`inline-block mt-1 px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider truncate max-w-full border ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isPartial
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : isCurrent || isHighlighted
                            ? 'bg-blue-100/90 text-blue-800 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {step.statusLabel || (isCompleted ? 'Completed' : (isCurrent || isHighlighted ? 'Active Stage' : 'Pending'))}
                      </span>
                    )}

                    {step.docNumber && (
                      <p className="text-[10px] font-mono text-slate-600 font-semibold truncate mt-0.5">
                        {step.docNumber}
                      </p>
                    )}

                    {step.amount !== undefined && step.amount !== null && (
                      <p className="text-[10px] font-mono font-bold text-slate-800 mt-0.5">
                        ₹{Number(step.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                </div>

                {!isLast && (
                  <TimelineConnector
                    isCompleted={isCompleted}
                    isPartial={isPartial}
                    isCurrent={isCurrent || isHighlighted}
                    isNextCurrent={isNextCurrent}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
