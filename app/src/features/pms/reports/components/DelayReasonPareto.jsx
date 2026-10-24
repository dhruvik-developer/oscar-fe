import React, { useState } from 'react';

/**
 * DelayReasonPareto — delay causes ranked, with a cumulative curve.
 *
 * A textbook Pareto puts counts on a left axis and cumulative percent on a
 * right one. Two y-scales on one plot invent a relationship the data does not
 * have, so both measures are expressed as a share of the same total and share a
 * single 0–100% axis. The ranking and the "where does 80% come from" reading
 * both survive; the arbitrary second scale does not.
 */

const BAR = '#2a78d6';      // categorical slot 1 — share of delays
const LINE = '#eb6834';     // categorical slot 2 — cumulative share
const GRID = '#eef2f8';
const AXIS = '#c3c2b7';

const W = 420;
const H = 200;
const PAD = { top: 12, right: 10, bottom: 34, left: 30 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const short = (s) =>
  s.replace('Client Approval Pending', 'Cl. Approval')
    .replace('Client Revision', 'Cl. Revision')
    .replace('Resource Unavailable', 'Resource')
    .replace('Internal Dependency', 'Internal')
    .replace(' Issue', '');

export function DelayReasonPareto({ rows = [] }) {
  const [hover, setHover] = useState(null);

  // A Pareto needs a ranking to be worth drawing. With one or two causes the
  // chart adds nothing the numbers do not already say, so show the numbers.
  if (rows.length > 0 && rows.length < 3) {
    const total = rows.reduce((n, r) => n + r.count, 0);
    return (
      <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs h-full">
        <header className="mb-4">
          <h3 className="text-sm font-bold text-slate-800">Delay Root Causes</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {total} recorded {total === 1 ? 'delay' : 'delays'} — too few causes to rank
          </p>
        </header>
        <ul className="space-y-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li key={r.category}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700">{r.category}</span>
                <span className="text-xs font-bold text-slate-800 tabular-nums">
                  {r.count}
                  <span className="font-medium text-slate-400 ml-1">
                    ({r.sharePct}%)
                  </span>
                </span>
              </div>
              <div className="w-full overflow-hidden" style={{ height: 8, borderRadius: 4, background: '#eef2f8' }}>
                <div style={{ width: `${r.sharePct}%`, height: '100%', borderRadius: 4, background: BAR }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs h-full">
        <header className="mb-4">
          <h3 className="text-sm font-bold text-slate-800">Delay Root Causes</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Share of delays by cause, with cumulative total</p>
        </header>
        <p className="text-[11px] text-slate-400 py-8 text-center">
          No delays recorded — nothing to attribute.
        </p>
      </section>
    );
  }

  // Cap the band so two or three causes do not stretch into a sparse chart,
  // and centre the group in the plot.
  const band = Math.min(PLOT_W / rows.length, 96);
  const groupW = band * rows.length;
  const offset = PAD.left + (PLOT_W - groupW) / 2;
  const barW = Math.min(46, band * 0.6);
  const y = (pct) => PAD.top + PLOT_H - (pct / 100) * PLOT_H;
  const cx = (i) => offset + band * i + band / 2;

  const points = rows.map((r, i) => `${cx(i)},${y(r.cumulativePct)}`).join(' ');

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs h-full">
      <header className="mb-2">
        <h3 className="text-sm font-bold text-slate-800">Delay Root Causes</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Share of delays by cause, with cumulative total — one 0–100% scale
        </p>
      </header>

      {/* Legend: two series, so identity is never colour-alone */}
      <div className="flex items-center gap-4 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
          <span style={{ width: 10, height: 10, borderRadius: 3, background: BAR }} /> Share of delays
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
          <span style={{ width: 12, height: 2, background: LINE, borderRadius: 1 }} /> Cumulative
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }} role="img"
        aria-label="Delay causes ranked by share, with cumulative percentage">
        {/* Gridlines + axis ticks */}
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.left - 5} y={y(t) + 3} textAnchor="end" fontSize="8" fill="#898781">{t}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke={AXIS} strokeWidth="1" />

        {/* 80% reference — the line a Pareto is read against */}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(80)} y2={y(80)}
          stroke={LINE} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />

        {/* Bars: 4px rounded top, anchored to the baseline */}
        {rows.map((r, i) => {
          const h = Math.max(2, (r.sharePct / 100) * PLOT_H);
          const isHover = hover === r.category;
          return (
            <g key={r.category} onMouseEnter={() => setHover(r.category)} onMouseLeave={() => setHover(null)}>
              <rect x={cx(i) - band / 2} y={PAD.top} width={band} height={PLOT_H} fill="transparent" />
              <rect
                x={cx(i) - barW / 2}
                y={y(r.sharePct)}
                width={barW}
                height={h}
                rx="4"
                fill={BAR}
                opacity={isHover ? 1 : 0.9}
              />
              <text x={cx(i)} y={H - PAD.bottom + 12} textAnchor="middle" fontSize="8" fill="#52514e">
                {short(r.category)}
              </text>
              <text x={cx(i)} y={H - PAD.bottom + 22} textAnchor="middle" fontSize="8" fill="#898781">
                {r.count}
              </text>
            </g>
          );
        })}

        {/* Cumulative curve, 2px, with markers >= 8px */}
        <polyline points={points} fill="none" stroke={LINE} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {rows.map((r, i) => (
          <g key={`pt-${r.category}`}>
            <circle cx={cx(i)} cy={y(r.cumulativePct)} r="4.5" fill={LINE} stroke="#fff" strokeWidth="2" />
            {/* Direct-label the end of the curve only, never every point */}
            {i === rows.length - 1 && (() => {
              // Flip the label below the marker when the curve tops out, so it
              // never collides with the 100 gridline or clip at the edge.
              const high = y(r.cumulativePct) - PAD.top < 14;
              return (
                <text
                  x={cx(i) + (rows.length === 1 ? 0 : -8)}
                  y={y(r.cumulativePct) + (high ? 16 : -9)}
                  textAnchor={rows.length === 1 ? 'middle' : 'end'}
                  fontSize="9"
                  fontWeight="700"
                  fill="#52514e"
                >
                  {r.cumulativePct}%
                </text>
              );
            })()}
          </g>
        ))}
      </svg>

      {hover && (
        <p className="text-[10px] text-slate-500 mt-1 pt-2 border-t border-slate-100">
          <strong className="text-slate-700">{hover}</strong> —{' '}
          {rows.find((r) => r.category === hover).count} delays ·{' '}
          {rows.find((r) => r.category === hover).sharePct}% of total ·{' '}
          {rows.find((r) => r.category === hover).cumulativePct}% cumulative
        </p>
      )}
    </section>
  );
}

export default DelayReasonPareto;
