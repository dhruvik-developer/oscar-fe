import React from 'react';
import KpiCard from '../../../../components/ui/KpiCard';
import { AlertCircle, Layers, Timer, Building2 } from 'lucide-react';

/**
 * DelayMetricsRow — the Delay Center's four summary metrics.
 *
 * The bottleneck department is ranked by accumulated delay rather than by count,
 * so one badly stuck stage outranks several that slipped by an hour.
 */
export function DelayMetricsRow({ metrics }) {
  const bottleneck = metrics?.bottleneck;

  return (
    <section className="grid gap-4 grid-cols-2 lg:grid-cols-4" aria-label="Delay summary metrics">
      <KpiCard
        label="Delayed Projects"
        value={metrics?.delayedProjects ?? 0}
        icon={AlertCircle}
        tone="rose"
      />
      <KpiCard
        label="Delayed Stages"
        value={metrics?.delayedStages ?? 0}
        icon={Layers}
        tone="orange"
      />
      <KpiCard
        label="Avg Delay"
        value={metrics?.avgDelayLabel ?? '—'}
        icon={Timer}
        tone="amber"
      />
      <KpiCard
        label="Bottleneck Dept"
        value={bottleneck?.department ?? '—'}
        icon={Building2}
        tone="purple"
      >
        {bottleneck && (
          <span className="block text-[10px] text-slate-500 mt-0.5">
            {bottleneck.count} {bottleneck.count === 1 ? 'stage' : 'stages'} held up
          </span>
        )}
      </KpiCard>
    </section>
  );
}

export default DelayMetricsRow;
