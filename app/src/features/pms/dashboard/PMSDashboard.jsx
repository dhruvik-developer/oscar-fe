import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Warehouse, CalendarDays } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Button } from '../../../components/ui/Button';
import { pullDashboardOverview } from '../../../services/pmsSync';
import { usePmsStore } from '../../../stores/pmsStore';
import { OverviewKpiStrip } from './components/OverviewKpiStrip';
import { StageOverviewFlow } from './components/StageOverviewFlow';
import { KeyAlerts } from './components/KeyAlerts';
import { StageQuantityChart } from './components/StageQuantityChart';
import { ProjectStatusDonut } from './components/ProjectStatusDonut';
import { RecentProjectsTable } from './components/RecentProjectsTable';

/**
 * PMSDashboard (/pms) — textile-flow overview.
 *
 * Everything on this page comes from GET /pms/dashboard/overview/, which the
 * server aggregates from live projects, production instructions, job work,
 * stock, sales orders, invoices and goods receipts. There is no local or
 * placeholder data: if the request fails the page says so.
 *
 * The page refetches when the PMS store's project list changes, so creating
 * or advancing a project elsewhere is reflected without a manual refresh.
 */
const inputClass =
  'h-9 rounded-lg border border-[#dce5f4] bg-white px-2.5 text-[12px] font-medium text-slate-700 outline-none focus:border-[#1f6bff]';

export default function PMSDashboard() {
  const navigate = useNavigate();
  const projects = usePmsStore((s) => s.projects);
  const [filters, setFilters] = useState({ locationId: '', dateFrom: '', dateTo: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const body = await pullDashboardOverview(filters);
    setFailed(!body);
    if (body) setData(body);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load, projects]);

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="PMS Dashboard"
        subtitle="Fabric flow across stages, production, stock, dispatch and collections."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex items-center">
              <Warehouse size={14} className="pointer-events-none absolute left-2.5 text-slate-400" />
              <select
                aria-label="Warehouse"
                value={filters.locationId}
                onChange={setFilter('locationId')}
                className={`${inputClass} pl-8`}
              >
                <option value="">All Warehouses</option>
                {(data?.warehouses ?? []).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-slate-400" />
              <input
                type="date"
                aria-label="From date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={setFilter('dateFrom')}
                className={inputClass}
              />
              <span className="text-[12px] text-slate-400">–</span>
              <input
                type="date"
                aria-label="To date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={setFilter('dateTo')}
                className={inputClass}
              />
            </span>
            <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>
              Refresh
            </Button>
            <Button icon={Plus} onClick={() => navigate('/pms/projects')}>
              Create New Project
            </Button>
          </div>
        }
      />

      {failed && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-700">
          Couldn't load dashboard data from the server.{' '}
          <button type="button" onClick={load} className="font-semibold underline">Try again</button>
        </div>
      )}

      {!data ? (
        <div className="space-y-5" aria-busy={loading}>
          {[88, 170, 260, 240].map((h, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-[#dce5f4] bg-white" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <OverviewKpiStrip kpis={data.kpis} />
          <StageOverviewFlow stages={data.stageOverview} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.15fr_0.85fr]">
            <KeyAlerts alerts={data.alerts} />
            <StageQuantityChart rows={data.stageQuantity} />
            <ProjectStatusDonut rows={data.projectStatus} />
          </div>
          <RecentProjectsTable rows={data.recentProjects} />
        </div>
      )}
    </div>
  );
}
