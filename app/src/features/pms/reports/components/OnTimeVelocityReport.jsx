import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * OnTimeVelocityReport — delivery reliability across completed projects.
 *
 * Deliberately a hero number plus a two-segment proportion bar rather than the
 * donut the brief sketched: a two-slice pie is the textbook case where the
 * number *is* the chart. The split still reads at a glance, and every segment
 * carries an icon and a label, because the good/critical pair is not separable
 * under red-green colour blindness on hue alone.
 */

const GOOD = '#0ca30c';
const CRITICAL = '#d03b3b';

export function OnTimeVelocityReport({ report }) {
  const { completed = 0, onTime = 0, delayed = 0, onTimePct = 0 } = report ?? {};

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs h-full">
      <header className="mb-4">
        <h3 className="text-sm font-bold text-slate-800">Project Velocity</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">On-time versus delayed delivery</p>
      </header>

      {completed === 0 ? (
        <p className="text-[11px] text-slate-400 py-8 text-center">
          No completed projects yet — velocity appears once the first one is signed off.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span
              className="text-4xl font-black tabular-nums"
              style={{ color: onTimePct >= 50 ? GOOD : CRITICAL }}
              data-test="ontime-pct"
            >
              {onTimePct}%
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              delivered on time ({completed} completed)
            </span>
          </div>

          {/* Proportion bar — 2px surface gap between the two segments */}
          <div className="flex mt-4 mb-3" style={{ height: 12 }} role="img"
            aria-label={`${onTime} on time, ${delayed} delayed`}>
            {onTime > 0 && (
              <div
                style={{
                  width: `${(onTime / completed) * 100}%`,
                  background: GOOD,
                  borderRadius: delayed > 0 ? '4px 0 0 4px' : 4,
                  marginRight: delayed > 0 ? 2 : 0,
                }}
              />
            )}
            {delayed > 0 && (
              <div
                style={{
                  width: `${(delayed / completed) * 100}%`,
                  background: CRITICAL,
                  backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.5) 0 2px, transparent 2px 4px)',
                  borderRadius: onTime > 0 ? '0 4px 4px 0' : 4,
                }}
              />
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} style={{ color: GOOD }} className="shrink-0" />
              <div className="min-w-0">
                <dt className="text-[10px] text-slate-500">On time</dt>
                <dd className="text-sm font-bold text-slate-800 tabular-nums">{onTime}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: CRITICAL }} className="shrink-0" />
              <div className="min-w-0">
                <dt className="text-[10px] text-slate-500">Delayed</dt>
                <dd className="text-sm font-bold text-slate-800 tabular-nums">{delayed}</dd>
              </div>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}

export default OnTimeVelocityReport;
