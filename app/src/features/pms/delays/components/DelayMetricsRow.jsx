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
    <section className="grid gap-2.5 sm:gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" aria-label="Delay summary metrics">
      <KpiCard
        label="Delayed Projects"
        value={metrics?.delayedProjects ?? 0}
        icon={AlertCircle}
        index={0}
      />
      <KpiCard
        label="Delayed Stages"
        value={metrics?.delayedStages ?? 0}
        icon={Layers}
        index={1}
      />
      <KpiCard
        label="Avg Delay"
        value={metrics?.avgDelayLabel ?? '—'}
        icon={Timer}
        index={2}
      />
      <KpiCard
        label="Bottleneck Dept"
        value={bottleneck?.department ?? '—'}
        icon={Building2}
        index={3}
        sub={bottleneck ? `${bottleneck.count} ${bottleneck.count === 1 ? 'stage' : 'stages'} held up` : undefined}
      />
    </section>
  );
}

export default DelayMetricsRow;
