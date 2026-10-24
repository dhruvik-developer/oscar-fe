import React, { useMemo } from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import { usePmsStore, computeNavBadges } from '../../../stores/pmsStore';
import { Construction, CircleCheck } from 'lucide-react';

/**
 * Scaffold shared by every PMS route until its own implementation stage lands.
 *
 * Stage 2 delivers routing and navigation; each page below is replaced in the
 * stage named by `plannedStage`. The live counters come from the Stage 1 store,
 * which is what proves the route → store wiring actually works end to end.
 */
export function PmsModulePlaceholder({ title, subtitle, plannedStage, scope = [] }) {
  // Subscribe to stable slices, then derive. Selecting getNavBadges() directly
  // would hand useSyncExternalStore a new object every render.
  const projects = usePmsStore((s) => s.projects);
  const currentUserId = usePmsStore((s) => s.currentUserId);
  const badges = useMemo(
    () => computeNavBadges(projects, currentUserId),
    [projects, currentUserId]
  );

  const stats = [
    { label: 'Projects', value: projects.length },
    { label: 'Active', value: badges.pmsActiveCount },
    { label: 'Delayed', value: badges.pmsDelayedCount },
    { label: 'My open tasks', value: badges.pmsMyTasksPending },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />

      {/* Live store readout — confirms the route is bound to the PMS store */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs"
          >
            <div className="text-xs font-medium text-slate-500">{s.label}</div>
            <div className="text-2xl font-black text-slate-800 mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <Construction size={18} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">
              Route live — interface arrives in {plannedStage}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Navigation, lazy loading, the error boundary and the loading skeleton are
              wired for this path. The screen itself is built in {plannedStage}.
            </p>

            {scope.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {scope.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-xs text-slate-600">
                    <CircleCheck size={13} className="text-slate-300 mt-0.5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PmsModulePlaceholder;
