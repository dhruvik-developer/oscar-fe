import React, { useMemo } from 'react';
import { Search, Calendar, SlidersHorizontal, X } from 'lucide-react';

const selectClass =
  'text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 font-medium cursor-pointer';

export function ProjectFilterBar({
  filters,
  options = { customers: [], managers: [], departments: [], stageNames: [] },
  allProjects = [],
  onChange,
  onReset,
  isFiltered = false,
  resultCount = 0,
  totalCount = 0,
}) {
  const set = (patch) => onChange({ ...filters, ...patch });

  // Compute live tab counts matching the reference UI
  const tabCounts = useMemo(() => {
    const list = allProjects || [];
    return {
      all: list.length,
      inProgress: list.filter((p) => p.status === 'In Progress' || p.status === 'Partial' || p.status === 'Partial Received').length,
      dyeing: list.filter((p) => p.status === 'Dyeing').length,
      partialReceived: list.filter((p) => p.status === 'Partial Received' || p.status === 'Partial').length,
      completed: list.filter((p) => p.status === 'Completed').length,
      delayed: list.filter((p) => p.status === 'Delayed' || p.isOverdue || p._meta?.isOverdue).length,
      draft: list.filter((p) => p.status === 'Draft').length,
    };
  }, [allProjects]);

  const activeTab = useMemo(() => {
    if (!filters.statuses || filters.statuses.length === 0) return 'all';
    if (filters.statuses.includes('Dyeing')) return 'dyeing';
    if (filters.statuses.includes('Completed')) return 'completed';
    if (filters.statuses.includes('Delayed')) return 'delayed';
    if (filters.statuses.includes('Draft')) return 'draft';
    if (filters.statuses.includes('Partial Received')) return 'partialReceived';
    if (filters.statuses.includes('In Progress')) return 'inProgress';
    return 'custom';
  }, [filters.statuses]);

  const selectTab = (tabKey) => {
    switch (tabKey) {
      case 'all':
        set({ statuses: [] });
        break;
      case 'inProgress':
        set({ statuses: ['In Progress', 'Partial', 'Partial Received'] });
        break;
      case 'dyeing':
        set({ statuses: ['Dyeing'] });
        break;
      case 'partialReceived':
        set({ statuses: ['Partial Received', 'Partial'] });
        break;
      case 'completed':
        set({ statuses: ['Completed'] });
        break;
      case 'delayed':
        set({ statuses: ['Delayed'] });
        break;
      case 'draft':
        set({ statuses: ['Draft'] });
        break;
      default:
        set({ statuses: [] });
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
      {/* Row 1 — Search + Dropdowns */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[260px]">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="search"
            value={filters.search || ''}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search project ID, customer, order or product..."
            aria-label="Search projects"
            className="w-full text-xs rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 font-medium transition"
          />
        </div>

        <select
          className={selectClass}
          value={filters.customer || 'all'}
          onChange={(e) => set({ customer: e.target.value })}
          aria-label="Filter by customer"
        >
          <option value="all">All customers</option>
          {(options.customers || []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={filters.projectManagerId || 'all'}
          onChange={(e) => set({ projectManagerId: e.target.value })}
          aria-label="Filter by project manager"
        >
          <option value="all">All managers</option>
          {(options.managers || []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={filters.department || 'all'}
          onChange={(e) => set({ department: e.target.value })}
          aria-label="Filter by department"
        >
          <option value="all">All departments</option>
          {(options.departments || []).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={filters.stageName || 'all'}
          onChange={(e) => set({ stageName: e.target.value })}
          aria-label="Filter by stage"
        >
          <option value="all">All stages</option>
          {(options.stageNames || []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Row 2 — Status Tabs, Delayed Only Checkbox, Date Range */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs matching the reference image */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => selectTab('all')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All ({tabCounts.all})
            </button>
            <button
              type="button"
              onClick={() => selectTab('inProgress')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === 'inProgress'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              In Progress ({tabCounts.inProgress})
            </button>
            <button
              type="button"
              onClick={() => selectTab('dyeing')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === 'dyeing'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Dyeing ({tabCounts.dyeing})
            </button>
            <button
              type="button"
              onClick={() => selectTab('partialReceived')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === 'partialReceived'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Partial Received ({tabCounts.partialReceived})
            </button>
            <button
              type="button"
              onClick={() => selectTab('completed')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Completed ({tabCounts.completed})
            </button>
            <button
              type="button"
              onClick={() => selectTab('delayed')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === 'delayed'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Delayed ({tabCounts.delayed})
            </button>
            <button
              type="button"
              onClick={() => selectTab('draft')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                activeTab === 'draft'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Draft ({tabCounts.draft})
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer ml-1 select-none">
            <input
              type="checkbox"
              checked={Boolean(filters.delayedOnly)}
              onChange={(e) => set({ delayedOnly: e.target.checked })}
              className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            Delayed only
          </label>
        </div>

        {/* Date Range Selector matching the reference UI */}
        <div className="flex items-center gap-2 ml-auto">
          <select
            className={selectClass}
            value={filters.dateField || 'startDate'}
            onChange={(e) => set({ dateField: e.target.value })}
            aria-label="Date field to filter on"
          >
            <option value="startDate">Start date</option>
            <option value="expectedCompletionDate">Expected end</option>
          </select>
          <div className="relative flex items-center">
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => set({ dateFrom: e.target.value })}
              aria-label="From date"
              className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">to</span>
          <div className="relative flex items-center">
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => set({ dateTo: e.target.value })}
              aria-label="To date"
              className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* Row 3 — Active filter tags / reset */}
      {isFiltered && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <SlidersHorizontal size={12} className="text-slate-400" />
            Showing <strong className="text-slate-800">{resultCount}</strong> of {totalCount} projects
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
          >
            <X size={12} />
            Reset all filters
          </button>
        </div>
      )}
    </section>
  );
}

export default ProjectFilterBar;
