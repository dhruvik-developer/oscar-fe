import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, Gavel, RefreshCcw } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { inventoryService } from '../../../services/domainServices';
import QcStageGate, { QcStageFilter } from './QcStageGate';
import { QcHubEmbed } from './QCPageHeader';

const QCPendingInspectionsPage = lazy(() => import('./QCPendingInspectionsPage'));
const QCInspectionRegisterPage = lazy(() => import('./QCInspectionRegisterPage'));
const QCResultsDispositionPage = lazy(() => import('./QCResultsDispositionPage'));
const QCReinspectionPage = lazy(() => import('./QCReinspectionPage'));
const QCDashboardPage = lazy(() => import('./QCDashboardPage'));
const QCReportsPage = lazy(() => import('./QCReportsPage'));

/** The QC work, in the order it is done. `count` names the badge (see useWorkCounts). */
export const QC_STEPS = [
  { id: 'pending', label: 'To Inspect', icon: ClipboardList, component: QCPendingInspectionsPage, count: 'pending',
    hint: 'Fabric received from GRN or job-work inward, waiting for QC.' },
  { id: 'inspect', label: 'Inspect', icon: ClipboardCheck, component: QCInspectionRegisterPage,
    hint: 'Record the inspection: roll-by-roll defects, points, length and grade.' },
  { id: 'decide', label: 'Decide', icon: Gavel, component: QCResultsDispositionPage,
    hint: 'Route the inspected fabric: Good to godown, Hold, Reprocess, or Reject (debit note).' },
  { id: 'recheck', label: 'Re-check Rework', icon: RefreshCcw, component: QCReinspectionPage, count: 'recheck',
    hint: 'Inspect reprocessed / disputed fabric again: Pass, Repeat or Reject.' },
];

/** Badge counts for the steps that are a worklist, for the QC type picked. */
function useWorkCounts(stage) {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let alive = true;
    Promise.all([
      inventoryService.getQCPending().then((r) => (r?.pendingList || []).length).catch(() => null),
      inventoryService.getQCReinspection()
        .then((r) => (r?.records || []).filter((x) => x.status !== 'Completed').length).catch(() => null),
    ]).then(([pending, recheck]) => { if (alive) setCounts({ pending, recheck }); });
    return () => { alive = false; };
  }, [stage]);
  return counts;
}

function Hub({ title, subtitle, tabs, param, counts = {}, numbered = false }) {
  const [params, setParams] = useSearchParams();
  const active = tabs.find((t) => t.id === params.get(param)) || tabs[0];
  const open = (id) => {
    const next = new URLSearchParams();
    next.set(param, id);
    if (params.get('stage')) next.set('stage', params.get('stage'));
    setParams(next);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumb={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Inventory', path: '/inventory' }, { label: title }]}
      />
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="px-3 pt-3 pb-2 border-b border-slate-100"><QcStageFilter /></div>
        <div className="flex items-stretch gap-1 px-2 overflow-x-auto border-b border-slate-200" role="tablist" aria-label={title}>
          {tabs.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = tab.id === active.id;
            const n = tab.count ? counts[tab.count] : null;
            return (
              <React.Fragment key={tab.id}>
                {numbered && i > 0 && <span className="self-center text-slate-300" aria-hidden="true">›</span>}
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => open(tab.id)}
                  className={`flex items-center gap-2 px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                    isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {numbered
                    ? <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                    : <Icon size={15} className={isActive ? 'text-blue-600' : 'text-slate-400'} />}
                  <span>{tab.label}</span>
                  {n > 0 && <span className="px-1.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">{n}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <p className="px-4 py-2.5 text-xs text-slate-600"><span className="font-semibold text-slate-800">{active.label}:</span> {active.hint}</p>
      </div>
      <QcHubEmbed.Provider value>
        <Suspense fallback={<div className="p-10 text-center text-sm text-slate-400">Loading…</div>}>
          {/* QcStageGate keeps the QC type in the URL and reloads the step when it changes. */}
          <QcStageGate key={active.id} inner={active.component} />
        </Suspense>
      </QcHubEmbed.Provider>
    </div>
  );
}

/** Detailed QC screens: the full step pages (4-point inspection, disposition
 *  details, reinspection). Day-to-day QC is the QC Work list. */
export function QCAdvancedPage() {
  const [params] = useSearchParams();
  const counts = useWorkCounts(params.get('stage') || 'all');
  return (
    <Hub
      title="Detailed QC Screens"
      subtitle="The full QC screens: pending list, 4-point inspection register, disposition and rework re-check. For everyday QC use QC Work."
      tabs={QC_STEPS}
      param="step"
      counts={counts}
      numbered
    />
  );
}

/** One QC page under its own title, with the All / Grey / Dyeing filter. */
function SingleQcPage({ title, subtitle, component }) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumb={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Inventory', path: '/inventory' }, { label: 'QC', path: '/inventory/qc/dashboard' }, { label: title }]}
      />
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5"><QcStageFilter /></div>
      <QcHubEmbed.Provider value>
        <Suspense fallback={<div className="p-10 text-center text-sm text-slate-400">Loading…</div>}>
          <QcStageGate inner={component} />
        </Suspense>
      </QcHubEmbed.Provider>
    </div>
  );
}

/** QC Dashboard: the first QC screen -- what is waiting, passed, held and rejected. */
export function QCDashboardHubPage() {
  return (
    <SingleQcPage
      title="QC Dashboard"
      subtitle="Quality at a glance: what is waiting for QC, passed, on hold, in reprocess and rejected."
      component={QCDashboardPage}
    />
  );
}

/** QC Reports: the analytics behind the dashboard. */
export function QCReportsHubPage() {
  return (
    <SingleQcPage
      title="QC Reports"
      subtitle="Supplier rejection, defect analysis and reprocess recovery over time."
      component={QCReportsPage}
    />
  );
}
