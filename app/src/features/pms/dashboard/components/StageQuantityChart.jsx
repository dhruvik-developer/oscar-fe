import React, { useState } from 'react';
import { EmptyStatePms } from '../../components/EmptyStatePms';
import { formatAxis, formatMeters } from '../format';

/**
 * StageQuantityChart — grouped bars per stage: meters that have completed the
 * stage, are in it now, and are still to reach it. Plain SVG; the chart
 * scales to the largest value so it reads the same at 10 m or 10 lakh m.
 */

const SERIES = [
  { key: 'completed', label: 'Completed', color: '#1f6bff' },
  { key: 'inProgress', label: 'In Stage', color: '#34c38f' },
  { key: 'pending', label: 'Pending', color: '#f97352' },
];

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 40, left: 44 };
const TICKS = 4;

function niceMax(value) {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp * TICKS >= value) ?? 10;
  return step * exp * TICKS;
}

export function StageQuantityChart({ rows = [] }) {
  const [hover, setHover] = useState(null);
  const hasData = rows.some((r) => SERIES.some((s) => r[s.key] > 0));

  const groupWidth = 64;
  const width = PAD.left + PAD.right + Math.max(rows.length, 1) * groupWidth;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(0, ...rows.flatMap((r) => SERIES.map((s) => r[s.key] || 0))));
  const y = (v) => PAD.top + plotH - (v / max) * plotH;
  const barW = 12;

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs h-full">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">
          Stage Wise Quantity <span className="font-medium text-slate-400">(Meters)</span>
        </h3>
        <div className="flex flex-wrap gap-3">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </header>

      {!hasData ? (
        <EmptyStatePms
          variant="projects"
          title="No stage quantities yet"
          description="Bars appear once projects with a quantity have stages."
        />
      ) : (
        <div className="relative overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${HEIGHT}`}
            width="100%"
            style={{ minWidth: Math.min(width, 640) }}
            role="img"
            aria-label="Stage wise quantity in meters"
          >
            {Array.from({ length: TICKS + 1 }, (_, i) => {
              const v = (max / TICKS) * i;
              return (
                <g key={i}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="#eef2f8" />
                  <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
                    {formatAxis(v)}
                  </text>
                </g>
              );
            })}
            {rows.map((row, gi) => {
              const gx = PAD.left + gi * groupWidth + (groupWidth - SERIES.length * barW - 4) / 2;
              return (
                <g key={row.key}>
                  {SERIES.map((s, si) => {
                    const v = row[s.key] || 0;
                    return (
                      <rect
                        key={s.key}
                        x={gx + si * (barW + 2)}
                        y={y(v)}
                        width={barW}
                        height={Math.max(PAD.top + plotH - y(v), 0)}
                        rx="2"
                        fill={s.color}
                        opacity={hover && hover.row !== row.key ? 0.45 : 1}
                        onMouseEnter={() => setHover({ row: row.key, name: row.name, label: s.label, v })}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })}
                  <text
                    x={PAD.left + gi * groupWidth + groupWidth / 2}
                    y={HEIGHT - PAD.bottom + 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                  >
                    {row.name.length > 11 ? `${row.name.slice(0, 10)}…` : row.name}
                    <title>{row.name}</title>
                  </text>
                </g>
              );
            })}
          </svg>
          {hover && (
            <div className="pointer-events-none absolute right-2 top-0 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow">
              <span className="font-semibold">{hover.name}</span> · {hover.label}: {formatMeters(hover.v)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default StageQuantityChart;
