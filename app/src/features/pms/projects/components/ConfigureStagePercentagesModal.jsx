import React, { useEffect, useMemo, useState } from 'react';
import { Percent, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { usePmsStore } from '../../../../stores/pmsStore';

const DEPARTMENT_TONES = {
  Design: { bg: '#eef2ff', fg: '#4338ca' },
  Production: { bg: '#eff6ff', fg: '#1d4ed8' },
  Quality: { bg: '#f0fdfa', fg: '#0f766e' },
  Packaging: { bg: '#faf5ff', fg: '#7e22ce' },
  Installation: { bg: '#fff7ed', fg: '#c2410c' },
  Logistics: { bg: '#ecfeff', fg: '#0e7490' },
  Management: { bg: '#fdf2f8', fg: '#be185d' },
  Procurement: { bg: '#f7fee7', fg: '#4d7c0f' },
};

function distributeEvenly(stages) {
  if (!stages || stages.length === 0) return {};
  const equal = Math.floor(100 / stages.length);
  const remainder = 100 - equal * stages.length;
  const map = {};
  stages.forEach((s, idx) => {
    map[s.id] = idx === stages.length - 1 ? equal + remainder : equal;
  });
  return map;
}

export function ConfigureStagePercentagesModal({ isOpen, onClose, project, onSaved }) {
  const updateStagePercentages = usePmsStore((s) => s.updateStagePercentages);
  const showToast = usePmsStore((s) => s.showToast);

  const stages = useMemo(() => {
    return [...(project?.stages ?? [])].sort((a, b) => a.sequence - b.sequence);
  }, [project]);

  const [weights, setWeights] = useState({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !project) return;
    const currentWeights = {};
    let hasAnyWeight = false;

    for (const s of stages) {
      const val = Number(s.percentage ?? s.weightPct ?? s.weight);
      if (Number.isFinite(val) && val > 0) {
        hasAnyWeight = true;
        currentWeights[s.id] = val;
      } else {
        currentWeights[s.id] = 0;
      }
    }

    if (!hasAnyWeight && stages.length > 0) {
      // For existing legacy projects with 0 weight, initialize an even 100% split
      setWeights(distributeEvenly(stages));
    } else {
      setWeights(currentWeights);
    }
    setError('');
  }, [isOpen, project, stages]);

  const totalPercentage = useMemo(() => {
    return stages.reduce((sum, s) => sum + (Number(weights[s.id]) || 0), 0);
  }, [stages, weights]);

  const roundedTotal = Math.round(totalPercentage * 100) / 100;
  const isValidTotal = roundedTotal === 100;

  function handleChange(stageId, val) {
    const num = val === '' ? '' : Math.max(0, Math.min(100, Number(val)));
    setWeights((prev) => ({
      ...prev,
      [stageId]: num,
    }));
    setError('');
  }

  function handleDistributeEvenly() {
    setWeights(distributeEvenly(stages));
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!isValidTotal) {
      setError(`Total percentage must equal exactly 100% (currently ${roundedTotal}%).`);
      return;
    }

    const stagePayload = stages.map((s) => ({
      id: s.id,
      percentage: Number(weights[s.id]) || 0,
    }));

    setIsSaving(true);
    try {
      await updateStagePercentages(project.id, stagePayload);
      showToast(`Stage percentages updated for ${project.code || project.id}.`);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to update stage percentages.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!project) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Stage Percentages"
      subtitle={`${project.code || project.id} · ${project.customerName || ''}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button" disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="pms-configure-percentages"
            icon={Percent}
            disabled={!isValidTotal || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save Percentages'}
          </Button>
        </>
      }
    >
      <form id="pms-configure-percentages" onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div>
            <span className="text-xs font-semibold text-slate-700">Project Stage Weights</span>
            <p className="text-[11px] text-slate-400">
              Each stage's percentage directly determines its weight in overall completion.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDistributeEvenly}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
            >
              <RotateCcw size={11} /> Distribute Evenly
            </button>
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                isValidTotal
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {isValidTotal && <CheckCircle2 size={12} />}
              Total: {roundedTotal}% / 100%
            </span>
          </div>
        </div>

        {stages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            This project has no stages configured yet.
          </p>
        ) : (
          <div className="rounded-lg border border-[#dce5f4] divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {stages.map((stage) => {
              const tone = DEPARTMENT_TONES[stage.department] ?? { bg: '#f1f5f9', fg: '#475569' };
              return (
                <div
                  key={stage.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center justify-center shrink-0">
                      {stage.sequence}
                    </span>
                    <div className="min-w-0 truncate">
                      <span className="text-xs font-semibold text-slate-800 truncate block">
                        {stage.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.2 rounded-full"
                          style={{ background: tone.bg, color: tone.fg }}
                        >
                          {stage.department || 'General'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {stage.completionPct ?? 0}% done
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={weights[stage.id] ?? ''}
                      onChange={(e) => handleChange(stage.id, e.target.value)}
                      className="w-20 text-right text-xs rounded-md border border-[#dce5f4] px-2 py-1 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white"
                      placeholder="0"
                      required
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default ConfigureStagePercentagesModal;
