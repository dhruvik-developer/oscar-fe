import React, { useEffect, useMemo, useState } from 'react';
import { Plus, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { usePmsStore } from '../../../../stores/pmsStore';
import { PMS_DURATION_UNITS } from '../../../../services/pmsSync';
import MasterSourceLink from '../../../../components/common/MasterSourceLink';

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

export function AddDynamicStageModal({ isOpen, onClose, project, onAdded }) {
  const departments = usePmsStore((s) => s.departments);
  const stageConfigs = usePmsStore((s) => s.stageConfigs);
  const addDynamicStage = usePmsStore((s) => s.addDynamicStage);
  const showToast = usePmsStore((s) => s.showToast);

  const existingStages = useMemo(() => {
    return [...(project?.stages ?? [])].sort((a, b) => a.sequence - b.sequence);
  }, [project]);

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [plannedDuration, setPlannedDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState('Days');
  const [stageWeight, setStageWeight] = useState(10);
  const [existingWeights, setExistingWeights] = useState({});
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setDepartmentId(departments[0]?.id || '');
    setPlannedDuration(1);
    setDurationUnit('Days');

    // Default weight for new stage
    const defaultNewPct = existingStages.length === 0 ? 100 : Math.min(20, Math.round(100 / (existingStages.length + 1)));
    setStageWeight(defaultNewPct);

    // Distribute remaining (100 - defaultNewPct) across existing stages
    const remaining = 100 - defaultNewPct;
    if (existingStages.length > 0) {
      const equalShare = Math.floor(remaining / existingStages.length);
      const rem = remaining - equalShare * existingStages.length;
      const initialMap = {};
      existingStages.forEach((s, idx) => {
        initialMap[s.id] = idx === existingStages.length - 1 ? equalShare + rem : equalShare;
      });
      setExistingWeights(initialMap);
    } else {
      setExistingWeights({});
    }
    setErrors({});
  }, [isOpen, project, existingStages, departments]);

  const totalPercentage = useMemo(() => {
    const sumExisting = existingStages.reduce(
      (sum, s) => sum + (Number(existingWeights[s.id]) || 0),
      0
    );
    return (Number(stageWeight) || 0) + sumExisting;
  }, [stageWeight, existingWeights, existingStages]);

  const roundedTotal = Math.round(totalPercentage * 100) / 100;
  const isValidTotal = roundedTotal === 100;

  function handleRebalance(newPct = stageWeight) {
    const targetRemaining = 100 - (Number(newPct) || 0);
    if (existingStages.length === 0) return;
    const share = Math.floor(targetRemaining / existingStages.length);
    const rem = targetRemaining - share * existingStages.length;
    const map = {};
    existingStages.forEach((s, idx) => {
      map[s.id] = idx === existingStages.length - 1 ? share + rem : share;
    });
    setExistingWeights(map);
  }

  function handleExistingWeightChange(stageId, val) {
    const num = val === '' ? '' : Math.max(0, Math.min(100, Number(val)));
    setExistingWeights((prev) => ({
      ...prev,
      [stageId]: num,
    }));
  }

  function handleTemplateSelect(e) {
    const configId = e.target.value;
    if (!configId) return;
    const template = stageConfigs.find((c) => c.id === configId);
    if (template) {
      setName(template.name);
      if (template.departmentId) setDepartmentId(template.departmentId);
      if (template.defaultDuration) setPlannedDuration(template.defaultDuration);
      if (template.durationUnit) setDurationUnit(template.durationUnit);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Stage name is required.';
    if (!isValidTotal) {
      nextErrors.total = `Total percentage must equal exactly 100% (currently ${roundedTotal}%).`;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      const selectedDept = departments.find((d) => d.id === departmentId);
      const stagePayload = {
        name: name.trim(),
        departmentId: departmentId || undefined,
        department: selectedDept?.name || undefined,
        plannedDuration: Number(plannedDuration) || 1,
        durationUnit,
        percentage: Number(stageWeight) || 0,
      };

      const stagePercentagesMap = {
        ...existingWeights,
      };

      await addDynamicStage(project.id, stagePayload, stagePercentagesMap);
      showToast(`Dynamic stage "${name.trim()}" added.`);
      onAdded?.();
      onClose();
    } catch (err) {
      setErrors({ total: err?.message || 'Failed to add dynamic stage.' });
    } finally {
      setIsSaving(false);
    }
  }

  if (!project) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Dynamic Stage"
      subtitle={`Add a new stage to ${project.code || project.id}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button" disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="pms-add-dynamic-stage"
            icon={Plus}
            disabled={!isValidTotal || isSaving}
          >
            {isSaving ? 'Adding…' : 'Add Stage'}
          </Button>
        </>
      }
    >
      <form id="pms-add-dynamic-stage" onSubmit={handleSubmit} className="space-y-4">
        {/* Optional template quick-pick */}
        {stageConfigs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass + ' mb-0'} htmlFor="pms-dyn-template">
                Pick from Template (Optional)
              </label>
              <MasterSourceLink source="pmsSettings" />
            </div>
            <select id="pms-dyn-template" className={fieldClass} onChange={handleTemplateSelect} defaultValue="">
              <option value="">Custom dynamic stage (enter details below)…</option>
              {stageConfigs
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.department} ({c.defaultDuration} {c.durationUnit})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Stage Name */}
        <div>
          <label className={labelClass} htmlFor="pms-dyn-name">
            Stage Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="pms-dyn-name"
            type="text"
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Surface Coating, Client Demo, Special QC"
            required
          />
          {errors.name && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
              <AlertCircle size={11} /> {errors.name}
            </p>
          )}
        </div>

        {/* Department, Planned duration, unit */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass} htmlFor="pms-dyn-dept">
              Department
            </label>
            <select
              id="pms-dyn-dept"
              className={fieldClass}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="pms-dyn-duration">
              Duration
            </label>
            <input
              id="pms-dyn-duration"
              type="number"
              min="0.5"
              step="0.5"
              className={fieldClass}
              value={plannedDuration}
              onChange={(e) => setPlannedDuration(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="pms-dyn-unit">
              Unit
            </label>
            <select
              id="pms-dyn-unit"
              className={fieldClass}
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value)}
            >
              {PMS_DURATION_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stage Percentage Weight Section */}
        <div className="rounded-lg border border-[#dce5f4] bg-[#f8faff] p-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs font-bold text-slate-800">Stage Weight Distribution</span>
              <p className="text-[10px] text-slate-500">
                Define the new stage percentage and balance existing stages so total is 100%.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRebalance(stageWeight)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline"
              >
                <RotateCcw size={10} /> Auto-Balance
              </button>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isValidTotal
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {isValidTotal && <CheckCircle2 size={11} />}
                Total: {roundedTotal}% / 100%
              </span>
            </div>
          </div>

          {/* New stage percentage input */}
          <div className="flex items-center justify-between gap-3 p-2 bg-white rounded-md border border-blue-200">
            <div>
              <span className="text-xs font-bold text-blue-700 block">
                {name.trim() || 'New Stage'} (This Stage)
              </span>
              <span className="text-[10px] text-blue-500">Configured weight</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={stageWeight}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value)));
                  setStageWeight(val);
                }}
                className="w-18 text-right text-xs rounded-md border border-blue-300 px-2 py-1 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                placeholder="0"
                required
              />
              <span className="text-xs font-bold text-blue-600">%</span>
            </div>
          </div>

          {/* Existing stages adjustment */}
          {existingStages.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-600 block">
                Existing Stage Weights ({existingStages.length}):
              </span>
              <div className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100 max-h-36 overflow-y-auto">
                {existingStages.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="text-[11px] text-slate-700 truncate flex-1">
                      {stage.sequence}. {stage.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={existingWeights[stage.id] ?? ''}
                        onChange={(e) => handleExistingWeightChange(stage.id, e.target.value)}
                        className="w-16 text-right text-xs rounded border border-slate-200 px-1.5 py-0.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="0"
                        required
                      />
                      <span className="text-[10px] font-bold text-slate-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {errors.total && (
          <p className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5">
            <AlertCircle size={13} className="shrink-0" /> {errors.total}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default AddDynamicStageModal;
