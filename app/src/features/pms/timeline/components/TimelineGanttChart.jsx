import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyStatePms } from '../../components/EmptyStatePms';

/**
 * TimelineGanttChart — stage spans across projects on one shared time axis.
 *
 * Bars are positioned as percentages of the window, so the chart reflows with
 * the container instead of needing a measured pixel width. Each bar carries a
 * hover tooltip; overdue spans get a status tint plus a hatch texture, so the
 * warning never rests on colour alone.
 */

const DEPARTMENT_HUES = {
  Design: '#2a78d6',
  Production: '#1c5cab',
  Quality: '#5598e7',
  Packaging: '#86b6ef',
  Installation: '#3987e5',
  Logistics: '#6da7ec',
  Management: '#256abf',
  Procurement: '#9ec5f4',
};

const OVERDUE = '#d03b3b';

function dayTicks(startMs, endMs, max = 8) {
  const span = endMs - startMs;
  const step = Math.max(1, Math.ceil(span / 86400000 / max)) * 86400000;
  const ticks = [];
  const first = new Date(startMs);
  first.setHours(0, 0, 0, 0);
  for (let t = first.getTime(); t <= endMs; t += step) {
    if (t >= startMs) ticks.push(t);
  }
  return ticks;
}

export function TimelineGanttChart({ rows = [], window: win }) {
  const [hover, setHover] = useState(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
        <EmptyStatePms
          variant="projects"
          title="Nothing on the timeline"
          description="Projects appear here once at least one of their stages has started."
        />
      </div>
    );
  }

  const pct = (ms) => ((ms - win.startMs) / win.totalMs) * 100;
  const ticks = dayTicks(win.startMs, win.endMs);
  const nowPct = pct(Date.now());

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-4 sm:p-5 shadow-2xs">
      <header className="flex flex-wrap lg:flex-nowrap items-baseline justify-between gap-x-3 lg:gap-x-0 gap-y-1 lg:gap-y-0 mb-4">
        <h3 className="text-sm font-bold text-slate-800">Project Timeline</h3>
        <span className="text-[11px] text-slate-400">
          {new Date(win.startMs).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} —{' '}
          {new Date(win.endMs).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </header>

      {/* Legend: identity is never colour-alone, so the hatch is named too. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 pb-3 border-b border-slate-100">
        {Object.entries(DEPARTMENT_HUES)
          .filter(([dept]) => rows.some((r) => r.bars.some((b) => b.department === dept)))
          .map(([dept, hue]) => (
            <span key={dept} className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: hue }} />
              {dept}
            </span>
          ))}
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
          <span
            style={{
              width: 10, height: 10, borderRadius: 3, background: OVERDUE,
              backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 2px, transparent 2px 4px)',
            }}
          />
          Overdue
        </span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 640 }}>
          {/* Axis */}
          <div className="relative h-5 mb-1" style={{ marginLeft: 150 }}>
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute text-[9px] text-slate-400 -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${pct(t)}%` }}
              >
                {new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            ))}
          </div>

          <div className="relative">
            {/* Gridlines + today marker sit behind the bars */}
            <div className="absolute inset-0 pointer-events-none" style={{ marginLeft: 150 }}>
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 bottom-0" style={{ left: `${pct(t)}%`, width: 1, background: '#eef2f8' }} />
              ))}
              {nowPct >= 0 && nowPct <= 100 && (
                <span
                  className="absolute top-0 bottom-0"
                  style={{ left: `${nowPct}%`, width: 2, background: '#94a3b8' }}
                  title="Today"
                />
              )}
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {rows.map((row) => (
                <li key={row.projectId} className="flex items-center gap-2 py-1.5 relative">
                  <div style={{ width: 150 }} className="shrink-0 min-w-0 pr-2 sticky left-0 z-10 bg-white">
                    <Link
                      to={`/pms/projects/${row.projectId}`}
                      className="block text-[11px] font-bold text-blue-600 hover:underline truncate"
                    >
                      {row.projectId}
                    </Link>
                    <span className="block text-[10px] text-slate-400 truncate" title={row.customerName}>
                      {row.customerName}
                    </span>
                  </div>

                  <div className="relative flex-1" style={{ height: 22 }}>
                    {row.bars.map((bar) => {
                      const left = pct(bar.startMs);
                      const width = Math.max(1.2, pct(bar.endMs) - left);
                      const hue = DEPARTMENT_HUES[bar.department] ?? '#94a3b8';
                      const isHovered = hover?.id === bar.id;

                      return (
                        <button
                          key={bar.id}
                          type="button"
                          onMouseEnter={() => setHover({ id: bar.id, bar, projectId: row.projectId, left })}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover({ id: bar.id, bar, projectId: row.projectId, left })}
                          onBlur={() => setHover(null)}
                          aria-label={`${bar.name}, ${bar.department}, ${bar.status}`}
                          className="absolute top-1/2 -translate-y-1/2"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            height: 14,
                            borderRadius: 4,
                            background: bar.isOverdue ? OVERDUE : hue,
                            // Texture doubles the overdue signal for CVD/print.
                            backgroundImage: bar.isOverdue
                              ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 2px, transparent 2px 4px)'
                              : 'none',
                            // 2px surface ring keeps adjacent spans separate.
                            boxShadow: isHovered ? '0 0 0 2px #fff, 0 0 0 4px #1f6bff' : '0 0 0 2px #fff',
                            padding: 0,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        />
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Hover detail */}
      {hover && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[11px] font-bold text-slate-800">{hover.bar.name}</span>
          <span className="text-[10px] text-slate-500">{hover.projectId} · {hover.bar.department}</span>
          <span className="text-[10px] text-slate-500">
            {new Date(hover.bar.startMs).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} →{' '}
            {new Date(hover.bar.endMs).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </span>
          <span className="text-[10px] font-semibold" style={{ color: hover.bar.isOverdue ? OVERDUE : '#065f46' }}>
            {hover.bar.status} · {hover.bar.completionPct}%
          </span>
        </div>
      )}
    </section>
  );
}

export default TimelineGanttChart;
