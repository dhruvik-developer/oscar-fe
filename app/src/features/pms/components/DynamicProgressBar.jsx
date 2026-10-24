import React, { useState } from 'react';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { formatDuration, MS_PER_HOUR, durationToMs } from '../../../stores/pmsStore';

/**
 * DynamicProgressBar — completion bar whose colour tracks delivery health.
 *
 * Wraps the shared components/ui/ProgressBar (which already handles the track,
 * fill and CSS transition) and layers on the two things PMS needs: a marker
 * showing how much of the planned window has elapsed, and a hover tooltip with
 * the remaining time against the planned duration.
 *
 * Green = on track, amber = at risk, red = delayed.
 */

const HEALTH_COLORS = {
  onTrack: '#1bb878',
  atRisk: '#ef9b06',
  delayed: '#f43f5e',
};

/**
 * Pick the bar colour from the stage status, falling back to the timing.
 *
 * Finished work is always green: once a stage is done, elapsed time and
 * overdue-ness say nothing about the bar, and how late it ran is already shown
 * by the status badge and the delay figure in the analytics grid.
 */
export function resolveHealth(status, { isOverdue = false, elapsedPct = 0 } = {}, atRiskThresholdPct = 80) {
  if (status === 'Completed' || status === 'Approved') return 'onTrack';
  if (status === 'Delayed' || status === 'Blocked' || isOverdue) return 'delayed';
  if (status === 'At Risk' || elapsedPct >= atRiskThresholdPct) return 'atRisk';
  return 'onTrack';
}

export function DynamicProgressBar({
  value = 0,
  status,
  timing = null,
  plannedDuration,
  durationUnit = 'Days',
  atRiskThresholdPct = 80,
  height = 8,
  showLabel = true,
  className = '',
}) {
  const [hovered, setHovered] = useState(false);

  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const isOverdue = Boolean(timing?.isOverdue);
  const elapsedPct = timing?.elapsedPct ?? 0;
  const health = resolveHealth(status, { isOverdue, elapsedPct }, atRiskThresholdPct);
  const barColor = HEALTH_COLORS[health];

  // Where the planned window currently sits — a fill short of this marker means
  // the stage is running behind its own schedule.
  const markerPct = Math.min(100, Math.max(0, elapsedPct));
  const showMarker = markerPct > 0 && markerPct < 100 && pct < 100;

  const plannedMs = durationToMs(plannedDuration, durationUnit);
  const tooltipLines = [
    timing?.remainingMs > 0
      ? `${formatDuration(timing.remainingMs)} remaining`
      : isOverdue
        ? `Overdue by ${formatDuration(timing?.delayMs)}`
        : null,
    plannedMs > 0
      ? `Planned: ${plannedDuration} ${durationUnit} (${Math.round(plannedMs / MS_PER_HOUR)}h)`
      : null,
  ].filter(Boolean);

  return (
    <div
      className={`w-full ${className}`}
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-slate-500">Progress</span>
          <span className="text-[11px] font-bold" style={{ color: barColor }}>
            {pct}%
          </span>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <ProgressBar value={pct} max={100} color={barColor} height={height} />

        {showMarker && (
          <span
            title="Planned schedule position"
            style={{
              position: 'absolute',
              top: -2,
              left: `${markerPct}%`,
              width: 2,
              height: height + 4,
              background: isOverdue ? HEALTH_COLORS.delayed : '#475569',
              borderRadius: 1,
              transform: 'translateX(-1px)',
              transition: 'left 0.3s ease',
            }}
          />
        )}
      </div>

      {hovered && tooltipLines.length > 0 && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: `calc(100% + 6px)`,
            left: 0,
            zIndex: 30,
            background: '#0f172a',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(15,23,42,0.18)',
          }}
        >
          {tooltipLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DynamicProgressBar;
