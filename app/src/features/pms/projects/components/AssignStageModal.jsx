import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, UserPlus, Info } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import {
  usePmsStore,
  computeExpectedCompletion,
  formatDuration,
  durationToMs,
} from '../../../../stores/pmsStore';
import { PMS_DURATION_UNITS } from '../../../../services/pmsSync';
import MasterSourceLink from '../../../../components/common/MasterSourceLink';

/**
 * AssignStageModal — assign a stage to a department, team and employee.
 *
 * The employee list is filtered to the chosen department by default, because
 * the stage config names the responsible department; "show all" is there for
 * the cases where a stage genuinely needs someone from elsewhere.
 */

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function AssignStageModal({ isOpen, onClose, project, initialStageId = null }) {
  const employees = usePmsStore((s) => s.employees);
  const stageConfigs = usePmsStore((s) => s.stageConfigs);
  // Selected as the stored array, then mapped — a selector that builds a new
  // array on every call never lets React see the state settle.
  const departments = usePmsStore((st) => st.departments);
  const departmentNames = useMemo(
    () => departments.map((d) => d.name),
    [departments],
  );
  const assignStage = usePmsStore((s) => s.assignStage);
  const showToast = usePmsStore((s) => s.showToast);

  const stages = useMemo(
    () => [...(project?.stages ?? [])].sort((a, b) => a.sequence - b.sequence),
    [project]
  );

  const [stageId, setStageId] = useState('');
  const [department, setDepartment] = useState('Design');
  const [userId, setUserId] = useState('');
  const [team, setTeam] = useState('');
  const [startAt, setStartAt] = useState(toLocalInput());
  const [duration, setDuration] = useState(1);
  const [unit, setUnit] = useState('Days');
  const [status, setStatus] = useState('Assigned');
  const [notes, setNotes] = useState('');
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [errors, setErrors] = useState({});

  const stage = stages.find((s) => s.id === stageId) ?? null;
  const config = stageConfigs.find((c) => c.id === stage?.stageConfigId) ?? null;

  // Seed the form from the chosen stage, and from its predecessor's finish time.
  useEffect(() => {
    if (!isOpen) return;
    const first =
      stages.find((s) => s.id === initialStageId) ??
      stages.find((s) => s.status !== 'Completed') ??
      stages[0];
    if (!first) return;

    const idx = stages.findIndex((s) => s.id === first.id);
    const predecessor = idx > 0 ? stages[idx - 1] : null;

    setStageId(first.id);
    setDepartment(first.department ?? 'Design');
    setUserId(first.assignedUser?.id ?? '');
    setTeam(first.assignedTeam ?? '');
    setDuration(first.plannedDuration ?? 1);
    setUnit(first.durationUnit ?? 'Days');
    setStartAt(
      toLocalInput(
        first.startDateTime ?? predecessor?.actualCompletionDateTime ?? new Date().toISOString()
      )
    );
    setStatus('Assigned');
    setNotes('');
    setErrors({});
  }, [isOpen, initialStageId, stages]);

  // Re-seed when the user picks a different stage mid-dialog.
  function pickStage(nextId) {
    const s = stages.find((x) => x.id === nextId);
    setStageId(nextId);
    if (!s) return;
    const idx = stages.findIndex((x) => x.id === nextId);
    const predecessor = idx > 0 ? stages[idx - 1] : null;
    setDepartment(s.department ?? 'Design');
    setUserId(s.assignedUser?.id ?? '');
    setTeam(s.assignedTeam ?? '');
    setDuration(s.plannedDuration ?? 1);
    setUnit(s.durationUnit ?? 'Days');
    setStartAt(
      toLocalInput(s.startDateTime ?? predecessor?.actualCompletionDateTime ?? new Date().toISOString())
    );
  }

  const candidates = useMemo(() => {
    if (showAllStaff) return employees;
    const inDept = employees.filter((e) => e.department === department);
    return inDept.length > 0 ? inDept : employees;
  }, [employees, department, showAllStaff]);

  const startIso = startAt ? new Date(startAt).toISOString() : null;
  const expected = computeExpectedCompletion(startIso, Number(duration), unit);
  const plannedMs = durationToMs(Number(duration), unit);

  function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (!stageId) found.stage = 'Choose a stage to assign.';
    if (!userId && !team.trim()) found.assignee = 'Assign an employee or a team.';
    if (!startAt) found.startAt = 'A planned start is required.';
    if (!Number.isFinite(Number(duration)) || Number(duration) <= 0) {
      found.duration = 'Duration must be greater than zero.';
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const employee = employees.find((emp) => emp.id === userId) ?? null;

    assignStage(project.id, stageId, {
      assignedUser: employee
        ? { id: employee.id, name: employee.name, email: employee.email }
        : null,
      assignedTeam: team.trim() || null,
      department,
      plannedDuration: Number(duration),
      durationUnit: unit,
      startDateTime: startIso,
      status,
      notes: notes.trim(),
      actor: project.projectManager,
    });

    showToast(`${stage?.name ?? 'Stage'} assigned to ${employee?.name ?? (team.trim() || 'the team')}.`);
    onClose?.();
  }

  if (!project) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Stage"
      subtitle={`${project.code || project.id} — ${project.customerName}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="pms-assign-stage" icon={UserPlus}>Assign Stage</Button>
        </>
      }
    >
      <form id="pms-assign-stage" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="assign-stage">
            Stage <span className="text-rose-500">*</span>
          </label>
          <select
            id="assign-stage"
            className={fieldClass}
            value={stageId}
            onChange={(e) => pickStage(e.target.value)}
          >
            <option value="">Select a stage…</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id} disabled={s.status === 'Completed'}>
                {s.sequence}. {s.name}
                {s.status === 'Completed' ? ' · completed' : ` · ${s.status}`}
              </option>
            ))}
          </select>
          {errors.stage && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
              <AlertCircle size={11} /> {errors.stage}
            </p>
          )}
        </div>

        {config && (
          <div className="flex items-start gap-2 rounded-lg border border-[#dce5f4] bg-[#f6f9ff] px-3 py-2">
            <Info size={12} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600">
              Template default: <strong>{config.department}</strong> ·{' '}
              {config.defaultDuration} {config.durationUnit}
              {config.assignedRole ? ` · ${config.assignedRole}` : ''}
              {config.requiredApproval ? ' · needs approval' : ''}
              {config.requiredDocument ? ' · needs document' : ''}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="assign-dept">Department</label>
            <select
              id="assign-dept"
              className={fieldClass}
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setUserId(''); }}
            >
              {departmentNames.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass + ' mb-0'} htmlFor="assign-user">
                Assigned Employee <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllStaff}
                    onChange={(e) => setShowAllStaff(e.target.checked)}
                    className="accent-blue-600"
                  />
                  show all staff
                </label>
                <MasterSourceLink source="users" />
              </div>
            </div>
            <select
              id="assign-user"
              className={fieldClass}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {candidates.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.role}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="assign-team">Team</label>
            <input
              id="assign-team"
              type="text"
              className={fieldClass}
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="e.g. Fabrication Line 2"
            />
            {errors.assignee && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                <AlertCircle size={11} /> {errors.assignee}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="assign-status">Set status to</label>
            <select
              id="assign-status"
              className={fieldClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className={labelClass} htmlFor="assign-start">
              Planned Start <span className="text-rose-500">*</span>
            </label>
            <input
              id="assign-start"
              type="datetime-local"
              className={fieldClass}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
            {errors.startAt && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                <AlertCircle size={11} /> {errors.startAt}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="assign-duration">Duration Override</label>
            <input
              id="assign-duration"
              type="number"
              min={1}
              step={1}
              className={fieldClass}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            {errors.duration && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                <AlertCircle size={11} /> {errors.duration}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="assign-unit">Unit</label>
            <select
              id="assign-unit"
              className={fieldClass}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {PMS_DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {expected && (
          <p className="text-[11px] text-slate-500" data-test="assign-expected">
            Expected completion{' '}
            <strong className="text-slate-700">
              {new Date(expected).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </strong>{' '}
            · {formatDuration(plannedMs)} of planned effort.
          </p>
        )}

        <div>
          <label className={labelClass} htmlFor="assign-notes">Assignment Notes</label>
          <textarea
            id="assign-notes"
            rows={2}
            className={fieldClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Context for the assignee — becomes the task description."
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            An actionable task is created for the assignee and appears in their My Tasks list.
          </p>
        </div>
      </form>
    </Modal>
  );
}

export default AssignStageModal;
