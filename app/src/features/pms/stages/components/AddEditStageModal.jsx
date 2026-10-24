import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { usePmsStore, validateStageConfig } from '../../../../stores/pmsStore';
import { PMS_DURATION_UNITS } from '../../../../services/pmsSync';

/**
 * AddEditStageModal — the stage template builder.
 *
 * One dialog for both create and edit; passing a `stage` switches it to edit
 * mode. Validation lives in validateStageConfig() in the store so the same
 * rules can be exercised without mounting the dialog.
 */

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

const BLANK = {
  name: '',
  description: '',
  department: 'Design',
  defaultDuration: 1,
  durationUnit: 'Days',
  assignedRole: '',
  requiredApproval: false,
  requiredDocument: false,
  isActive: true,
};

function ToggleRow({ id, label, hint, checked, onChange }) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-2.5 rounded-lg border border-[#dce5f4] px-3 py-2.5 cursor-pointer hover:bg-slate-50"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-blue-600 mt-0.5"
      />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-slate-700">{label}</span>
        <span className="block text-[10px] text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

export function AddEditStageModal({ isOpen, onClose, stage = null }) {
  const stageConfigs = usePmsStore((s) => s.stageConfigs);
  // Selected as the stored array, then mapped — a selector that builds a new
  // array on every call never lets React see the state settle.
  const departments = usePmsStore((st) => st.departments);
  const departmentNames = useMemo(
    () => departments.map((d) => d.name),
    [departments],
  );
  const addStageConfig = usePmsStore((s) => s.addStageConfig);
  const updateStageConfig = usePmsStore((s) => s.updateStageConfig);
  const showToast = usePmsStore((s) => s.showToast);

  const isEdit = Boolean(stage);
  const [draft, setDraft] = useState(BLANK);
  const [errors, setErrors] = useState({});

  // Reload the form whenever the dialog opens or switches target.
  useEffect(() => {
    if (!isOpen) return;
    setDraft(stage ? { ...BLANK, ...stage } : BLANK);
    setErrors({});
  }, [isOpen, stage]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  function handleSubmit(e) {
    e.preventDefault();
    const found = validateStageConfig(draft, stageConfigs, stage?.id ?? null);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      department: draft.department,
      defaultDuration: Number(draft.defaultDuration),
      durationUnit: draft.durationUnit,
      assignedRole: draft.assignedRole.trim(),
      requiredApproval: draft.requiredApproval,
      requiredDocument: draft.requiredDocument,
      isActive: draft.isActive,
    };

    if (isEdit) updateStageConfig(stage.id, payload);
    else addStageConfig(payload);

    showToast(isEdit ? `${payload.name} updated.` : `${payload.name} added to the pipeline.`);
    onClose?.();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Stage — ${stage?.name}` : 'Add New Stage'}
      subtitle={
        isEdit
          ? 'Changes apply to projects created from here on; running projects keep the stage they were given.'
          : 'New stages are appended to the end of the pipeline. Reorder them from the list.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pms-stage-form" icon={Save}>
            {isEdit ? 'Save Changes' : 'Add Stage'}
          </Button>
        </>
      }
    >
      <form id="pms-stage-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="stage-name">
            Stage Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="stage-name"
            type="text"
            className={fieldClass}
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Thermal Stress Testing"
          />
          {errors.name && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
              <AlertCircle size={11} /> {errors.name}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="stage-desc">Description / Scope</label>
          <textarea
            id="stage-desc"
            rows={2}
            className={fieldClass}
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="What this stage covers and what 'done' means."
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass} htmlFor="stage-dept">
              Department <span className="text-rose-500">*</span>
            </label>
            <select
              id="stage-dept"
              className={fieldClass}
              value={draft.department}
              onChange={(e) => set({ department: e.target.value })}
            >
              {departmentNames.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {errors.department && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                <AlertCircle size={11} /> {errors.department}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="stage-duration">
              Duration <span className="text-rose-500">*</span>
            </label>
            <input
              id="stage-duration"
              type="number"
              min={1}
              step={1}
              className={fieldClass}
              value={draft.defaultDuration}
              onChange={(e) => set({ defaultDuration: e.target.value })}
            />
            {errors.defaultDuration && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                <AlertCircle size={11} /> {errors.defaultDuration}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="stage-unit">Unit</label>
            <select
              id="stage-unit"
              className={fieldClass}
              value={draft.durationUnit}
              onChange={(e) => set({ durationUnit: e.target.value })}
            >
              {PMS_DURATION_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="stage-role">Role Required</label>
            <input
              id="stage-role"
              type="text"
              className={fieldClass}
              value={draft.assignedRole}
              onChange={(e) => set({ assignedRole: e.target.value })}
              placeholder="e.g. QA Lead"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ToggleRow
            id="stage-approval"
            label="Required Approval"
            hint="Client or PM sign-off before handoff."
            checked={draft.requiredApproval}
            onChange={(v) => set({ requiredApproval: v })}
          />
          <ToggleRow
            id="stage-document"
            label="Required Document"
            hint="PDF proof or inspection sheet upload."
            checked={draft.requiredDocument}
            onChange={(v) => set({ requiredDocument: v })}
          />
          <ToggleRow
            id="stage-active"
            label="Active"
            hint="Inactive stages are skipped by new projects."
            checked={draft.isActive}
            onChange={(v) => set({ isActive: v })}
          />
        </div>
      </form>
    </Modal>
  );
}

export default AddEditStageModal;
