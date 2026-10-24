import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ShieldAlert, Check, Send, Clock } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { StageStatusBadge } from './StageStatusBadge';
import {
  usePmsStore,
  validateStageHandoff,
  summariseStageForHandoff,
} from '../../../stores/pmsStore';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

/**
 * StageHandoffModal — department-to-department handoff with PM sign-off.
 *
 * Enforces the stage's configured gates before it will confirm: required
 * document, required approval, open delays and blocked tasks all hold the
 * handoff. An incomplete percentage is advisory rather than hard, so a PM can
 * still close out a stage they judge finished.
 */

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

const QUALITY_CHECKS = [
  'Work output matches the stage scope',
  'Documentation and records are up to date',
  'No open issues carried into the next stage',
];

export function StageHandoffModal({ isOpen, onClose, project, stageId, onHandedOff }) {
  const stageConfigs = usePmsStore((s) => s.stageConfigs);
  const employees = usePmsStore((s) => s.employees);
  const handoffStage = usePmsStore((s) => s.handoffStage);
  const showToast = usePmsStore((s) => s.showToast);

  const ordered = useMemo(
    () => [...(project?.stages ?? [])].sort((a, b) => a.sequence - b.sequence),
    [project]
  );
  const index = ordered.findIndex((s) => s.id === stageId);
  const stage = index >= 0 ? ordered[index] : null;
  const nextStage = index >= 0 ? ordered[index + 1] ?? null : null;
  const config = stageConfigs.find((c) => c.id === stage?.stageConfigId) ?? null;

  const [recipientId, setRecipientId] = useState('');
  const [recipientTeam, setRecipientTeam] = useState('');
  const [notes, setNotes] = useState('');
  const [checked, setChecked] = useState([]);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setRecipientId(nextStage?.assignedUser?.id ?? '');
    setRecipientTeam(nextStage?.assignedTeam ?? '');
    setNotes('');
    setChecked([]);
    setSubmitError('');
  }, [isOpen, nextStage]);

  const blockers = useMemo(
    () => (stage ? validateStageHandoff(stage, config) : []),
    [stage, config]
  );
  const hardBlockers = blockers.filter((b) => b.hard);
  const softBlockers = blockers.filter((b) => !b.hard);
  const summary = useMemo(() => (stage ? summariseStageForHandoff(stage) : null), [stage]);

  const candidates = useMemo(() => {
    if (!nextStage) return [];
    const inDept = employees.filter((e) => e.department === nextStage.department);
    return inDept.length > 0 ? inDept : employees;
  }, [employees, nextStage]);

  const allChecked = checked.length === QUALITY_CHECKS.length;
  const canConfirm = hardBlockers.length === 0 && allChecked;

  function toggleCheck(item) {
    setChecked((prev) => (prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]));
  }

  function handleConfirm() {
    if (!stage) return;
    const recipient = employees.find((e) => e.id === recipientId) ?? null;
    try {
      const nextId = handoffStage(project.id, stage.id, {
        recipient: recipient ? { id: recipient.id, name: recipient.name, email: recipient.email } : null,
        recipientTeam: recipientTeam.trim() || null,
        notes: notes.trim(),
        checklist: checked,
        actor: project.projectManager,
      });
      showToast(nextId ? `${stage.name} handed off to ${nextStage?.name}.` : `${stage.name} completed.`);
      onHandedOff?.(nextId);
      onClose?.();
    } catch (err) {
      setSubmitError(err.message);
    }
  }

  if (!project || !stage) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Stage Handoff"
      subtitle={`${project.code || project.id} — ${stage.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="button" icon={Send} onClick={handleConfirm} disabled={!canConfirm}>
            {nextStage ? 'Confirm Handoff' : 'Complete Final Stage'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Completed-stage summary */}
        <section className="rounded-lg border border-[#dce5f4] bg-[#f6f9ff] p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Clock size={12} className="text-blue-500" />
            <span className="text-[11px] font-bold text-slate-700">Stage summary</span>
            <StageStatusBadge status={stage.status} size="sm" />
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Planned', summary.plannedLabel],
              ['Time taken', summary.takenLabel],
              ['Delay', summary.delayLabel],
              ['Completion', `${summary.completionPct}%`],
            ].map(([k, v], i) => (
              <div key={k}>
                <dt className="text-[10px] text-slate-500">{k}</dt>
                <dd
                  className="text-[11px] font-bold"
                  style={{ color: i === 2 && summary.isOverdue ? '#9f1239' : '#334155' }}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          {summary.taskCount > 0 && (
            <p className="text-[10px] text-slate-500 mt-2">
              {summary.doneTaskCount}/{summary.taskCount} tasks completed.
            </p>
          )}
        </section>

        {/* Gates */}
        {blockers.length > 0 && (
          <section
            className="rounded-lg border p-3"
            style={
              hardBlockers.length > 0
                ? { borderColor: '#fecdd3', background: '#fff1f2' }
                : { borderColor: '#fde68a', background: '#fffbeb' }
            }
          >
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={12} style={{ color: hardBlockers.length > 0 ? '#9f1239' : '#92400e' }} />
              <span
                className="text-[11px] font-bold"
                style={{ color: hardBlockers.length > 0 ? '#9f1239' : '#92400e' }}
              >
                {hardBlockers.length > 0 ? 'Handoff blocked' : 'Worth checking'}
              </span>
            </div>
            <ul className="space-y-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {[...hardBlockers, ...softBlockers].map((b) => (
                <li
                  key={b.code}
                  className="text-[11px]"
                  style={{ color: b.hard ? '#9f1239' : '#92400e' }}
                >
                  • {b.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recipient */}
        {nextStage ? (
          <section>
            <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-2.5">
              <span className="font-semibold">{stage.department}</span>
              <ArrowRight size={12} className="text-slate-400" />
              <span className="font-semibold">{nextStage.department}</span>
              <span className="text-slate-400">· Stage {nextStage.sequence}: {nextStage.name}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass + ' mb-0'} htmlFor="handoff-user">Receiving employee</label>
                  <MasterSourceLink source="users" />
                </div>
                <select
                  id="handoff-user"
                  className={fieldClass}
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {candidates.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} — {emp.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="handoff-team">Receiving team</label>
                <input
                  id="handoff-team"
                  type="text"
                  className={fieldClass}
                  value={recipientTeam}
                  onChange={(e) => setRecipientTeam(e.target.value)}
                  placeholder="e.g. Quality Lab"
                />
              </div>
            </div>
          </section>
        ) : (
          <p className="text-[11px] text-slate-500">
            This is the final stage — completing it closes out the pipeline.
          </p>
        )}

        {/* Quality checklist */}
        <section>
          <span className={labelClass}>Quality checklist sign-off <span className="text-rose-500">*</span></span>
          <div className="rounded-lg border border-[#dce5f4] divide-y divide-slate-100">
            {QUALITY_CHECKS.map((item) => (
              <label key={item} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={() => toggleCheck(item)}
                  className="accent-blue-600"
                />
                <span className="text-[11px] text-slate-700">{item}</span>
                {checked.includes(item) && <Check size={12} className="text-emerald-600 ml-auto" />}
              </label>
            ))}
          </div>
          {!allChecked && (
            <p className="text-[10px] text-slate-400 mt-1.5">
              All three must be signed off before the handoff can be confirmed.
            </p>
          )}
        </section>

        <div>
          <label className={labelClass} htmlFor="handoff-notes">Handover notes</label>
          <textarea
            id="handoff-notes"
            rows={2}
            className={fieldClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What the receiving department needs to know."
          />
        </div>

        {submitError && (
          <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default StageHandoffModal;
