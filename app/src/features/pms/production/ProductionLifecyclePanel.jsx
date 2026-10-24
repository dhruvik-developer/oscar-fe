import React, { useCallback, useEffect, useState } from 'react';
import { Factory, Plus, RefreshCw } from 'lucide-react';
import { getProjectProductionLifecycle, lifecycleStageDetail } from '../../purchase/productionLifecycle';
import { InstructionStageWorkspace } from './InstructionStageWorkspace';
import { CreateProductionPoModal } from './CreateProductionPoModal';

const STATE_PILL = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-slate-50 text-slate-500 border-slate-200',
};
const STATE_LABEL = { completed: 'Completed', active: 'Active', pending: 'Pending' };
const runLabel = (l) => [l.poNumber, l.instructionNumber].filter(Boolean).join(' · ');

/**
 * Workspace for the selected production stage of a project: Purchase Order
 * (Vendor A Production), then the client requirement PDF section 05 stages. The stages themselves are shown in the project
 * pipeline above; this panel only renders the selected stage's work, inside
 * the project slide. Data: GET /pms/projects/:id/production-lifecycle/.
 */
export function ProductionLifecyclePanel({ project, focusStageKey, refreshKey, onLoaded, onStageChange, onUpdated, defaultQty }) {
  const projectId = project?.id;
  const [lifecycles, setLifecycles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getProjectProductionLifecycle(projectId);
      const rows = res?.lifecycles || [];
      setLifecycles(rows);
      onLoaded?.(rows);
    } catch (err) {
      setError(err?.message || 'Could not load the production lifecycle.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const lifecycle = lifecycles.find((l) => l.id === selectedId) || lifecycles[0];
  const stage = lifecycle?.stages?.find((s) => s.key === focusStageKey);
  const afterUpdate = async () => {
    await load();
    onUpdated?.();
  };

  return (
    <div className="rounded-2xl border border-[#dce5f4] bg-white p-4 sm:p-5 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <Factory size={16} className="text-amber-600" />
          <h3 className="text-sm font-bold text-slate-800">{stage?.label || 'External Agency Production'}</h3>
          {lifecycles.length > 1 ? (
            <select value={lifecycle?.id || ''} onChange={(e) => setSelectedId(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono">
              {lifecycles.map((l) => <option key={l.id} value={l.id}>{runLabel(l)}</option>)}
            </select>
          ) : lifecycle ? (
            <span className="font-mono text-xs text-slate-500">{runLabel(lifecycle)}</span>
          ) : null}
          {stage && (
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATE_PILL[stage.state]}`}>
              {STATE_LABEL[stage.state]}{stage.status ? ` · ${stage.status}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs cursor-pointer disabled:opacity-60">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer">
            <Plus size={13} /> New Production Order (PO)
          </button>
        </div>
      </div>

      {stage && lifecycleStageDetail(stage) && <div className="text-xs text-slate-500">{lifecycleStageDetail(stage)}</div>}

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      {!error && !loading && lifecycles.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center text-xs text-slate-500">
          No Vendor A Production purchase order for this project yet. Create the PO to start the production run.
        </div>
      )}

      {lifecycle && focusStageKey && (
        <InstructionStageWorkspace
          key={`${lifecycle.id}-${lifecycle.instructionId || ''}-${focusStageKey}`}
          project={project}
          lifecycle={lifecycle}
          stageKey={focusStageKey}
          onStageChange={onStageChange}
          onUpdated={afterUpdate}
        />
      )}

      {showCreate && (
        <CreateProductionPoModal
          project={project}
          defaultQty={defaultQty}
          onClose={() => setShowCreate(false)}
          onCreated={async (saved) => {
            setShowCreate(false);
            if (saved?.id) setSelectedId(String(saved.id));
            await afterUpdate();
            onStageChange?.('purchase_order');
          }}
        />
      )}
    </div>
  );
}

export default ProductionLifecyclePanel;
