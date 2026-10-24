import React from 'react';
import { EmptyStatePms } from '../../components/EmptyStatePms';

/** ProjectStatusDonut — projects in scope split by status. */

const STATUS_COLORS = {
  Completed: '#16a34a',
  'In Progress': '#1f6bff',
  Delayed: '#facc15',
  'At Risk': '#f97316',
  'On Hold': '#64748b',
  Draft: '#cbd5e1',
};

const R = 60;
const STROKE = 22;
const C = 2 * Math.PI * R;

export function ProjectStatusDonut({ rows = [] }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  let offset = 0;

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs h-full">
      <header className="mb-3">
        <h3 className="text-sm font-bold text-slate-800">Project Status</h3>
      </header>

      {total === 0 ? (
        <EmptyStatePms variant="projects" title="No projects" description="Projects in the selected range appear here." />
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-5">
          <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="Project status split">
            <g transform="rotate(-90 80 80)">
              <circle cx="80" cy="80" r={R} fill="none" stroke="#eef2f8" strokeWidth={STROKE} />
              {rows.map((row) => {
                const len = (row.count / total) * C;
                const seg = (
                  <circle
                    key={row.status}
                    cx="80"
                    cy="80"
                    r={R}
                    fill="none"
                    stroke={STATUS_COLORS[row.status] ?? '#94a3b8'}
                    strokeWidth={STROKE}
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-offset}
                  >
                    <title>{`${row.status}: ${row.count}`}</title>
                  </circle>
                );
                offset += len;
                return seg;
              })}
            </g>
            <text x="80" y="78" textAnchor="middle" fontSize="26" fontWeight="700" fill="#0f172a">{total}</text>
            <text x="80" y="96" textAnchor="middle" fontSize="11" fill="#64748b">Projects</text>
          </svg>
          <ul className="space-y-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map((row) => (
              <li key={row.status} className="flex min-w-[130px] items-center justify-between gap-4 text-[12px]">
                <span className="flex items-center gap-2 font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[row.status] ?? '#94a3b8' }} />
                  {row.status}
                </span>
                <span className="font-bold text-slate-900">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default ProjectStatusDonut;
