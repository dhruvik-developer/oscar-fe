import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, SlidersHorizontal, Gauge } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import {
  usePmsStore,
  computeDelayWatchlist,
  computeDelayMetrics,
  filterDelays,
  getDelayFilterOptions,
  emptyDelayFilters,
  hasActiveDelayFilters,
  DELAY_REASON_CATEGORIES,
} from '../../../stores/pmsStore';
import { DelayMetricsRow } from './components/DelayMetricsRow';
import { DelayResolutionTable } from './components/DelayResolutionTable';
import { LogDelayModal } from './components/LogDelayModal';
import { PmsToast } from '../components/PmsToast';

/**
 * DelayDashboardPage (/pms/delays) — the delay resolution desk.
 *
 * The watchlist is derived, not stored: any stage past its expected completion
 * appears here whether or not a delay has been formally logged, so nothing
 * slips through simply because nobody filled in a reason.
 */

const selectClass =
  'text-xs rounded-lg border border-[#dce5f4] bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';

export default function DelayDashboardPage() {
  const projects = usePmsStore((s) => s.projects);
  const settings = usePmsStore((s) => s.settings);
  const [searchParams, setSearchParams] = useSearchParams();

  // Other stages link here as /pms/delays?project=PRJ-2026-002.
  const projectParam = searchParams.get('project');
  const [filters, setFilters] = useState(() => ({
    ...emptyDelayFilters(),
    projectId: projectParam ?? 'all',
  }));
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { row, mode }

  const allRows = useMemo(() => computeDelayWatchlist(projects), [projects]);
  const options = useMemo(() => getDelayFilterOptions(allRows), [allRows]);

  const visible = useMemo(() => {
    const filtered = filterDelays(allRows, filters);
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((r) =>
      [r.projectId, r.customerName, r.stageName, r.reason, r.responsibleUser]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [allRows, filters, search]);

  const metrics = useMemo(() => computeDelayMetrics(visible), [visible]);
  const isFiltered = hasActiveDelayFilters(filters) || Boolean(search.trim());

  function update(patch) {
    const next = { ...filters, ...patch };
    setFilters(next);
    // Keep the deep link honest when the project filter changes.
    if (patch.projectId !== undefined) {
      if (patch.projectId === 'all') searchParams.delete('project');
      else searchParams.set('project', patch.projectId);
      setSearchParams(searchParams, { replace: true });
    }
  }

  function reset() {
    setFilters(emptyDelayFilters());
    setSearch('');
    searchParams.delete('project');
    setSearchParams(searchParams, { replace: true });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Delay Center"
        subtitle="Overdue and at-risk stages across every project, with root-cause attribution and recovery planning."
      />

      <DelayMetricsRow metrics={metrics} />

      {/* Filter bar */}
      <section className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project, stage, owner or reason…"
              aria-label="Search delays"
              className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white pl-9 pr-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>

          <select
            className={selectClass}
            value={filters.projectId}
            onChange={(e) => update({ projectId: e.target.value })}
            aria-label="Filter by project"
          >
            <option value="all">All projects</option>
            {options.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code || p.id} — {p.label}</option>
            ))}
          </select>

          <select
            className={selectClass}
            value={filters.department}
            onChange={(e) => update({ department: e.target.value })}
            aria-label="Filter by department"
          >
            <option value="all">All departments</option>
            {options.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            className={selectClass}
            value={filters.stageName}
            onChange={(e) => update({ stageName: e.target.value })}
            aria-label="Filter by stage"
          >
            <option value="all">All stages</option>
            {options.stageNames.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            className={selectClass}
            value={filters.category}
            onChange={(e) => update({ category: e.target.value })}
            aria-label="Filter by root cause"
          >
            <option value="all">All root causes</option>
            {DELAY_REASON_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">Due between</span>
          <input
            type="date"
            className={selectClass}
            value={filters.dateFrom}
            onChange={(e) => update({ dateFrom: e.target.value })}
            aria-label="Due from date"
          />
          <span className="text-xs text-slate-400">and</span>
          <input
            type="date"
            className={selectClass}
            value={filters.dateTo}
            onChange={(e) => update({ dateTo: e.target.value })}
            aria-label="Due to date"
          />

          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 ml-auto">
            <Gauge size={12} className="text-slate-300" />
            At-risk trigger: {settings.atRiskThresholdPct}% elapsed with under 50% done
          </span>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-1 border-t border-slate-100">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <SlidersHorizontal size={12} className="text-slate-300" />
            Showing <strong className="text-slate-700">{visible.length}</strong> of {allRows.length}{' '}
            delayed {allRows.length === 1 ? 'stage' : 'stages'}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600"
            >
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </section>

      <DelayResolutionTable
        rows={visible}
        onLog={(row) => setModal({ row, mode: 'log' })}
        onUpdatePlan={(row) => setModal({ row, mode: 'plan' })}
        onResolve={(row) => setModal({ row, mode: 'resolve' })}
      />

      <LogDelayModal
        isOpen={modal !== null}
        row={modal?.row ?? null}
        mode={modal?.mode ?? 'log'}
        onClose={() => setModal(null)}
      />
      <PmsToast />
    </div>
  );
}
