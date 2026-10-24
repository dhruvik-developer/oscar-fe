import React from 'react';
import { ChevronRight } from 'lucide-react';
import { EmptyStatePms } from '../../components/EmptyStatePms';
import { formatMeters } from '../format';

/**
 * StageOverviewFlow — one card per pipeline stage, in sequence, showing the
 * meters of fabric whose project currently sits in that stage and how many of
 * the projects in scope that is. Stages come from the configured templates
 * plus any stage names used on projects (server-side).
 */

const TINTS = [
  { bg: '#eaf2ff', border: '#c9dcff', accent: '#1f6bff' },
  { bg: '#e8f1ff', border: '#c3d7fb', accent: '#2563eb' },
  { bg: '#eaf8ef', border: '#c5ebd3', accent: '#16a34a' },
  { bg: '#f3edff', border: '#ddd0fb', accent: '#7c3aed' },
  { bg: '#fff3e6', border: '#fbd9b4', accent: '#ea580c' },
  { bg: '#e8f8f1', border: '#bfe9d6', accent: '#059669' },
  { bg: '#e9f1ff', border: '#c7d9fb', accent: '#1d4ed8' },
  { bg: '#f4eeff', border: '#dfd2fb', accent: '#6d28d9' },
  { bg: '#ffecec', border: '#f9c9c9', accent: '#dc2626' },
];

export function StageOverviewFlow({ stages = [] }) {
  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
      <header className="mb-4">
        <h3 className="text-sm font-bold text-slate-800">
          Project Stage Overview{' '}
          <span className="font-medium text-slate-400">(Quantity in Meters)</span>
        </h3>
      </header>

      {stages.length === 0 ? (
        <EmptyStatePms
          variant="projects"
          title="No stages configured"
          description="Configure stages under PMS → Stages, or add stages to a project, to see the flow here."
        />
      ) : (
        <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
          {stages.map((stage, index) => {
            const tint = TINTS[index % TINTS.length];
            return (
              <React.Fragment key={stage.key}>
                <div
                  className="flex min-w-[124px] flex-1 flex-col items-center rounded-lg border px-2 pt-2.5 pb-3 text-center"
                  style={{ background: tint.bg, borderColor: tint.border }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: tint.accent }}
                  >
                    {stage.sequence}
                  </span>
                  <p
                    className="mt-1.5 line-clamp-2 min-h-[32px] text-[12px] font-semibold leading-4"
                    style={{ color: tint.accent }}
                    title={stage.name}
                  >
                    {stage.name}
                  </p>
                  <div className="my-2 h-px w-full bg-white/80" />
                  <p className="text-[15px] font-bold text-slate-900">{formatMeters(stage.quantity)}</p>
                  <p className="text-[11px] font-medium text-slate-500">
                    {stage.projectCount} / {stage.totalProjects}
                  </p>
                </div>
                {index < stages.length - 1 && (
                  <ChevronRight size={16} className="shrink-0 self-center text-slate-300" aria-hidden />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default StageOverviewFlow;
