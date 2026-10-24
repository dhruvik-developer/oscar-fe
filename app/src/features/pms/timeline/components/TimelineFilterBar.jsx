import React from 'react';
import { X, SlidersHorizontal } from 'lucide-react';

/** TimelineFilterBar — department, manager and status scope for the Gantt. */

const selectClass =
  'text-xs rounded-lg border border-[#dce5f4] bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';

export function TimelineFilterBar({ filters, options, onChange, onReset, resultCount, totalCount }) {
  const set = (patch) => onChange({ ...filters, ...patch });
  const isFiltered =
    filters.department !== 'all' || filters.projectManagerId !== 'all' || filters.status !== 'all';

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectClass} value={filters.department} onChange={(e) => set({ department: e.target.value })} aria-label="Filter by department">
          <option value="all">All departments</option>
          {options.departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select className={selectClass} value={filters.projectManagerId} onChange={(e) => set({ projectManagerId: e.target.value })} aria-label="Filter by project manager">
          <option value="all">All managers</option>
          {options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <select className={selectClass} value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {['In Progress', 'At Risk', 'Delayed', 'Completed', 'On Hold'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-1 border-t border-slate-100">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <SlidersHorizontal size={12} className="text-slate-300" />
          Showing <strong className="text-slate-700">{resultCount}</strong> of {totalCount} projects
        </span>
        {isFiltered && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600">
            <X size={12} /> Clear filters
          </button>
        )}
      </div>
    </section>
  );
}

export default TimelineFilterBar;
