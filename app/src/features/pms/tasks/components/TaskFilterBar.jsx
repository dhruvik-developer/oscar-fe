import React from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

/**
 * TaskFilterBar — priority, stage and status filters for the workbench.
 *
 * Presentational only; the matching runs in the page so the same filter object
 * can drive the grouped counts.
 */

const selectClass =
  'text-xs rounded-lg border border-[#dce5f4] bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';

const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
const STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Completed'];

export function TaskFilterBar({ filters, options, onChange, onReset, resultCount, totalCount }) {
  const set = (patch) => onChange({ ...filters, ...patch });
  const isFiltered =
    Boolean(filters.search.trim()) ||
    filters.priority !== 'all' ||
    filters.status !== 'all' ||
    filters.stageName !== 'all' ||
    filters.projectId !== 'all';

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search task, project or stage…"
            aria-label="Search tasks"
            className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white pl-9 pr-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          />
        </div>

        <select className={selectClass} value={filters.projectId} onChange={(e) => set({ projectId: e.target.value })} aria-label="Filter by project">
          <option value="all">All projects</option>
          {options.projects.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.label}</option>)}
        </select>

        <select className={selectClass} value={filters.stageName} onChange={(e) => set({ stageName: e.target.value })} aria-label="Filter by stage">
          <option value="all">All stages</option>
          {options.stageNames.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className={selectClass} value={filters.priority} onChange={(e) => set({ priority: e.target.value })} aria-label="Filter by priority">
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select className={selectClass} value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-1 border-t border-slate-100">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <SlidersHorizontal size={12} className="text-slate-300" />
          Showing <strong className="text-slate-700">{resultCount}</strong> of {totalCount} tasks
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

export default TaskFilterBar;
