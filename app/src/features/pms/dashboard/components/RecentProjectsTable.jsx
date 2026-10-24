import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { EmptyStatePms } from '../../components/EmptyStatePms';
import { formatDate, formatQty } from '../format';

/** RecentProjectsTable — the five newest projects in scope. */

const STATUS_STYLES = {
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Delayed: 'bg-rose-50 text-rose-700 border-rose-200',
  'At Risk': 'bg-orange-50 text-orange-700 border-orange-200',
  'On Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  Draft: 'bg-slate-50 text-slate-600 border-slate-200',
};

function progressColor(pct) {
  if (pct >= 75) return '#16a34a';
  if (pct >= 40) return '#1f6bff';
  return '#f59e0b';
}

export function RecentProjectsTable({ rows = [] }) {
  const navigate = useNavigate();
  const open = (row) => navigate(`/pms/projects/${row.id}`);

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Recent Projects</h3>
        <button
          type="button"
          onClick={() => navigate('/pms/projects')}
          className="text-[12px] font-semibold text-[#1f6bff] hover:underline"
        >
          View All
        </button>
      </header>

      {rows.length === 0 ? (
        <EmptyStatePms variant="projects" title="No projects yet" description="Create a project to see it here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e6ecf6] bg-[#f6f9ff] text-[11px] font-semibold text-slate-600">
                {['#', 'Project No.', 'Customer', 'Fabric / Design', 'Order Qty (m)', 'Current Stage', 'Progress', 'Expected Date', 'Status', 'Action'].map((h) => (
                  <th key={h} className="px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const pct = Math.max(0, Math.min(100, row.completionPct || 0));
                return (
                  <tr
                    key={row.id}
                    onClick={() => open(row)}
                    className="cursor-pointer border-b border-[#eef2f8] last:border-0 hover:bg-[#f8fbff]"
                  >
                    <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{row.code}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.customerName || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.product || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{formatQty(row.quantity)}</td>
                    <td className="px-3 py-2.5">
                      {row.currentStage ? (
                        <span className="inline-block rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 whitespace-nowrap">
                          {row.currentStage}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#eef2f8]">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: progressColor(pct) }} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatDate(row.expectedCompletionDate)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLES[row.status] ?? STATUS_STYLES.Draft}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        aria-label={`View ${row.code}`}
                        onClick={(e) => { e.stopPropagation(); open(row); }}
                        className="rounded p-1 text-[#1f6bff] hover:bg-blue-50"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RecentProjectsTable;
