import React from 'react';

/**
 * DepartmentEfficiency — open task load against configured capacity.
 *
 * Utilisation is magnitude, not identity, so the bars use one sequential blue
 * ramp stepped by load rather than three competing categorical colours — a
 * green/amber/red trio cannot clear the contrast and separation gates together
 * on a white surface. The band is carried by a labelled chip instead, so the
 * state never rests on hue alone.
 */

// Ordinal blue ramp; the lightest step still clears 2:1 on white.
const RAMP = [
  { max: 40, hex: '#86b6ef' },
  { max: 65, hex: '#5598e7' },
  { max: 90, hex: '#2a78d6' },
  { max: Infinity, hex: '#1c5cab' },
];

const BAND_CHIPS = {
  Low: { bg: '#d1fae5', fg: '#065f46' },
  Medium: { bg: '#fef3c7', fg: '#92400e' },
  High: { bg: '#ffe4e6', fg: '#9f1239' },
};

const stepFor = (pct) => RAMP.find((s) => pct <= s.max).hex;

export function DepartmentEfficiency({ rows = [] }) {
  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs h-full">
      <header className="mb-4">
        <h3 className="text-sm font-bold text-slate-800">Department Capacity</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Open tasks against each department&apos;s concurrent capacity
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-8 text-center">
          No open tasks — capacity utilisation appears once stages are assigned.
        </p>
      ) : (
        <ul className="space-y-3.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((row) => {
            const chip = BAND_CHIPS[row.load] ?? BAND_CHIPS.Low;
            const over = row.utilisationPct > 100;

            return (
              <li key={row.department}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-700 truncate">{row.department}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {row.openTasks}/{row.capacity}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: chip.bg, color: chip.fg }}
                    >
                      {row.load} · {row.utilisationPct}%
                    </span>
                  </div>
                </div>

                <div className="relative w-full" style={{ height: 8, borderRadius: 4, background: '#eef2f8' }}>
                  <div
                    style={{
                      width: `${Math.min(100, row.utilisationPct)}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: stepFor(row.utilisationPct),
                      backgroundImage: over
                        ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.5) 0 2px, transparent 2px 4px)'
                        : 'none',
                      transition: 'width 0.3s ease',
                    }}
                  />
                  {/* Capacity line sits at 100% so overload is visible, not implied */}
                  <span
                    className="absolute top-0 bottom-0"
                    style={{ right: 0, width: 2, background: '#94a3b8', borderRadius: 1 }}
                    title="Capacity"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default DepartmentEfficiency;
