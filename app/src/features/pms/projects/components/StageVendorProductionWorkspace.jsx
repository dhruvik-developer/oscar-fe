import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Factory, RefreshCw } from 'lucide-react';
import { usePmsStore } from '../../../../stores/pmsStore';
import { ProductionLifecyclePanel } from '../../production/ProductionLifecyclePanel';
import { VENDOR_PRODUCTION_STAGES } from './StageOverview';

// PMS production-branch stage name -> Production Lifecycle stage key.
// Mirrors PRODUCTION_LIFECYCLE_STAGE_MAP in apps/pms/pipeline_services.py.
const PMS_STAGE_TO_LIFECYCLE = Object.fromEntries(VENDOR_PRODUCTION_STAGES.map((s) => [s.name, s.lifecycleKey]));

const fmtM = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} M`);

export function StageVendorProductionWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
  totalStages = 17,
}) {
  const showToast = usePmsStore((s) => s.showToast);
  const stageName = (stage?.name || '').trim();
  const stageSeq = stage?.sequence || 2;
  const lifecycleKey = stage?.lifecycleKey || PMS_STAGE_TO_LIFECYCLE[stageName];
  // The production stages sit together in the pipeline in lifecycle order,
  // so a lifecycle key maps to a pipeline sequence by offset.
  const lifecycleIndex = VENDOR_PRODUCTION_STAGES.findIndex((s) => s.lifecycleKey === lifecycleKey);
  const selectLifecycleStage = (key) => {
    const target = VENDOR_PRODUCTION_STAGES.findIndex((s) => s.lifecycleKey === key);
    if (target < 0 || lifecycleIndex < 0 || !onSelectStage) return;
    onSelectStage(stageSeq + (target - lifecycleIndex));
  };

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lifecycles, setLifecycles] = useState([]);

  const primary = lifecycles[0];
  const stageOf = (key) => primary?.stages?.find((s) => s.key === key);
  const kpis = useMemo(() => {
    const pi = stageOf('production_work_instruction');
    const daily = stageOf('daily_production_entry');
    return {
      ordered: pi?.quantity,
      produced: daily?.quantity,
      balance: daily?.balanceQuantity,
      agency: stageOf('external_agency_assignment')?.party,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setRefreshKey((k) => k + 1);
      if (onSyncPipeline) await onSyncPipeline();
      showToast?.(`${stageName} data refreshed.`, 'info');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Factory size={16} className="text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Vendor A Production Order & Lifecycle Status
            </h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
            Lifecycle stage {lifecycleIndex + 1} of {VENDOR_PRODUCTION_STAGES.length}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Instructed Quantity</span>
            <span className="font-mono font-bold text-slate-900">{fmtM(kpis.ordered)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Produced (submitted)</span>
            <span className="font-mono font-bold text-emerald-700">{fmtM(kpis.produced)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Pending Balance</span>
            <span className="font-mono font-bold text-amber-700">{fmtM(kpis.balance)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Assigned Agency</span>
            <span className="font-bold text-slate-800">{kpis.agency || 'Not assigned'}</span>
          </div>
        </div>
      </div>

      <ProductionLifecyclePanel
        project={project}
        focusStageKey={lifecycleKey}
        refreshKey={refreshKey}
        onLoaded={setLifecycles}
        embedded
        onStageChange={selectLifecycleStage}
        onUpdated={() => onSyncPipeline && onSyncPipeline()}
        defaultQty={project?.pipelineSummary?.shortageMeters || project?.requirementMeters || project?.quantity}
      />
    </div>
  );
}
