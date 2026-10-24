import React, { useMemo, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import {
  usePmsStore,
  computeVelocityReport,
  computeStageBottlenecks,
  computeDelayPareto,
  computeDepartmentWorkload,
} from '../../../stores/pmsStore';
import { OnTimeVelocityReport } from './components/OnTimeVelocityReport';
import { StageBottleneckChart } from './components/StageBottleneckChart';
import { DelayReasonPareto } from './components/DelayReasonPareto';
import { DepartmentEfficiency } from './components/DepartmentEfficiency';

/**
 * PMSReportsPage (/pms/reports) — executive analytics.
 *
 * Every figure derives from the store. A table view sits behind a toggle so the
 * same numbers are reachable without reading a chart — which is also the relief
 * any chart needs when a fill sits below 3:1 against the surface.
 */
export default function PMSReportsPage() {
  const projects = usePmsStore((s) => s.projects);
  const settings = usePmsStore((s) => s.settings);
  const [view, setView] = useState('charts');

  const velocity = useMemo(() => computeVelocityReport(projects), [projects]);
  const bottlenecks = useMemo(() => computeStageBottlenecks(projects), [projects]);
  const pareto = useMemo(() => computeDelayPareto(projects), [projects]);
  const workload = useMemo(
    () =>
      computeDepartmentWorkload(
        projects,
        settings.departmentCapacity ?? {},
        settings.defaultDepartmentCapacity ?? 20
      ),
    [projects, settings]
  );

  const th = 'px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500';
  const td = 'px-3 py-2 text-[11px] text-slate-700';

  return (
    <div className="space-y-5">
      <PageHeader
        title="PMS Reports"
        subtitle="Delivery velocity, stage bottlenecks, delay root causes and department capacity."
        actions={
          <div className="inline-flex rounded-lg border border-[#dce5f4] overflow-hidden">
            {[
              { id: 'charts', label: 'Charts', icon: BarChart3 },
              { id: 'table', label: 'Table', icon: Table2 },
            ].map((opt) => {
              const Icon = opt.icon;
              const active = view === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setView(opt.id)}
                  aria-pressed={active}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={active ? { background: '#1f6bff', color: '#fff' } : { background: '#fff', color: '#475569' }}
                >
                  <Icon size={13} /> {opt.label}
                </button>
              );
            })}
          </div>
        }
      />

      {view === 'charts' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <OnTimeVelocityReport report={velocity} />
          <StageBottleneckChart rows={bottlenecks} />
          <DelayReasonPareto rows={pareto} />
          <DepartmentEfficiency rows={workload} />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Velocity */}
          <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Project Velocity</h3>
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-slate-100">
                {[
                  ['Completed projects', velocity.completed],
                  ['Delivered on time', velocity.onTime],
                  ['Delivered late', velocity.delayed],
                  ['On-time rate', `${velocity.onTimePct}%`],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className={td}>{k}</td>
                    <td className={`${td} text-right font-bold tabular-nums`}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Bottlenecks */}
          <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Stage Bottlenecks</h3>
            <table className="w-full border-collapse">
              <thead className="bg-[#f6f9ff]">
                <tr>
                  {['Department', 'Avg cycle (days)', 'Avg planned (days)', '% of plan', 'Stages'].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bottlenecks.length === 0 ? (
                  <tr><td className={td} colSpan={5}>No completed stages yet.</td></tr>
                ) : bottlenecks.map((r) => (
                  <tr key={r.department}>
                    <td className={`${td} font-semibold`}>{r.department}</td>
                    <td className={`${td} tabular-nums`}>{r.avgCycleDays}</td>
                    <td className={`${td} tabular-nums`}>{r.avgPlannedDays}</td>
                    <td className={`${td} tabular-nums`}>{r.scheduleRatioPct}%</td>
                    <td className={`${td} tabular-nums`}>{r.samples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Pareto */}
          <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Delay Root Causes</h3>
            <table className="w-full border-collapse">
              <thead className="bg-[#f6f9ff]">
                <tr>
                  {['Cause', 'Delays', 'Share', 'Cumulative'].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pareto.length === 0 ? (
                  <tr><td className={td} colSpan={4}>No delays recorded.</td></tr>
                ) : pareto.map((r) => (
                  <tr key={r.category}>
                    <td className={`${td} font-semibold`}>{r.category}</td>
                    <td className={`${td} tabular-nums`}>{r.count}</td>
                    <td className={`${td} tabular-nums`}>{r.sharePct}%</td>
                    <td className={`${td} tabular-nums`}>{r.cumulativePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Capacity */}
          <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Department Capacity</h3>
            <table className="w-full border-collapse">
              <thead className="bg-[#f6f9ff]">
                <tr>
                  {['Department', 'Open tasks', 'Capacity', 'Utilisation', 'Band', 'Blocked'].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workload.length === 0 ? (
                  <tr><td className={td} colSpan={6}>No open tasks.</td></tr>
                ) : workload.map((r) => (
                  <tr key={r.department}>
                    <td className={`${td} font-semibold`}>{r.department}</td>
                    <td className={`${td} tabular-nums`}>{r.openTasks}</td>
                    <td className={`${td} tabular-nums`}>{r.capacity}</td>
                    <td className={`${td} tabular-nums`}>{r.utilisationPct}%</td>
                    <td className={td}>{r.load}</td>
                    <td className={`${td} tabular-nums`}>{r.blockedTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
