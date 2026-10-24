import React, { useState } from 'react';

/**
 * StageBottleneckChart — average cycle time per department.
 *
 * One measure, one series, so one hue and no legend: the title names it. Bars
 * are ordered slowest-first because the question this answers is "where does
 * work sit longest", and only finished stages are sampled — an unfinished stage
 * has no cycle time yet.
 */

const HUE = '#2a78d6';
const OVER = '#d03b3b';

export function StageBottleneckChart({ rows = [] }) {
  const [hover, setHover] = useState(null);
  const max = rows.reduce((m, r) => Math.max(m, r.avgCycleDays), 0);

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs h-full">
      <header className="mb-4">
        <h3 className="text-sm font-bold text-slate-800">Stage Bottlenecks</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Average cycle time in days, completed stages only
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-8 text-center">
          No completed stages yet — cycle time needs at least one finished stage.
        </p>
      ) : (
        <ul className="space-y-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((row) => {
            const overruns = row.scheduleRatioPct > 100;
            const width = max > 0 ? Math.max(2, (row.avgCycleDays / max) * 100) : 0;

            return (
              <li
                key={row.department}
                onMouseEnter={() => setHover(row.department)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">{row.department}</span>
                  <span className="text-xs font-bold text-slate-800 tabular-nums">
                    {row.avgCycleDays}
                    <span className="font-medium text-slate-400 ml-1">
                      {row.avgCycleDays === 1 ? 'day' : 'days'}
                    </span>
                  </span>
                </div>

                <div className="w-full overflow-hidden" style={{ height: 8, borderRadius: 4, background: '#eef2f8' }}>
                  <div
                    style={{
                      width: `${width}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: overruns ? OVER : HUE,
                      backgroundImage: overruns
                        ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.5) 0 2px, transparent 2px 4px)'
                        : 'none',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                {hover === row.department && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    planned {row.avgPlannedDays}d · actual {row.avgCycleDays}d ·{' '}
                    <strong style={{ color: overruns ? OVER : '#065f46' }}>
                      {row.scheduleRatioPct}% of plan
                    </strong>{' '}
                    · {row.samples} {row.samples === 1 ? 'stage' : 'stages'}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default StageBottleneckChart;
