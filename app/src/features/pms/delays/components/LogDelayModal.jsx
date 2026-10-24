import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, CalendarClock } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import {
  usePmsStore,
  validateDelayEntry,
  DELAY_REASON_CATEGORIES,
} from '../../../../stores/pmsStore';
import MasterSourceLink from '../../../../components/common/MasterSourceLink';

/**
 * LogDelayModal — log a delay, revise its recovery plan, or resolve it.
 *
 * One dialog with three modes so the same root-cause vocabulary is used
 * whichever direction the delay is moving. Attribution is mandatory: a delay
 * without a category and a recovery date is not actionable.
 */

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function LogDelayModal({ isOpen, onClose, row, mode = 'log' }) {
  const employees = usePmsStore((s) => s.employees);
  const projects = usePmsStore((s) => s.projects);
  const logDelay = usePmsStore((s) => s.logDelay);
  const updateRecoveryPlan = usePmsStore((s) => s.updateRecoveryPlan);
  const resolveDelay = usePmsStore((s) => s.resolveDelay);
  const showToast = usePmsStore((s) => s.showToast);

  const project = projects.find((p) => p.id === row?.projectId) ?? null;

  const [category, setCategory] = useState('Other');
  const [reason, setReason] = useState('');
  const [responsibleUser, setResponsibleUser] = useState('');
  const [recoveryDate, setRecoveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen || !row) return;
    setCategory(row.category ?? 'Other');
    setReason(row.reason ?? '');
    setResponsibleUser(row.responsibleUser ?? '');
    setRecoveryDate(toDateInput(row.expectedRecoveryDate));
    setNotes(row.resolutionNotes ?? '');
    setErrors({});
  }, [isOpen, row]);

  if (!row || !project) return null;

  const isResolve = mode === 'resolve';
  const isPlan = mode === 'plan';

  function handleSubmit(e) {
    e.preventDefault();
    const actor = project.projectManager;

    try {
      if (isResolve) {
        resolveDelay(project.id, row.stageId, notes.trim(), actor);
      } else if (isPlan) {
        updateRecoveryPlan(
          project.id,
          row.stageId,
          {
            category,
            responsibleUser,
            expectedRecoveryDate: recoveryDate ? new Date(recoveryDate).toISOString() : null,
            resolutionNotes: notes.trim(),
          },
          actor
        );
      } else {
        const draft = {
          category,
          reason: reason.trim(),
          responsibleDepartment: row.department,
          responsibleUser,
          expectedRecoveryDate: recoveryDate ? new Date(recoveryDate).toISOString() : null,
          resolutionNotes: notes.trim(),
        };
        const found = validateDelayEntry(draft);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        logDelay(project.id, row.stageId, draft, actor);
      }
      showToast(
        isResolve ? `Delay resolved on ${row.stageName}.` : isPlan ? 'Recovery plan updated.' : `Delay logged — ${category}.`,
        isResolve ? 'success' : 'info'
      );
      onClose?.();
    } catch (err) {
      setErrors(err.fieldErrors ?? { submit: err.message });
    }
  }

  const title = isResolve ? 'Resolve Delay' : isPlan ? 'Update Recovery Plan' : 'Log Delay';
  const icon = isResolve ? CheckCircle2 : isPlan ? CalendarClock : AlertTriangle;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={`${row.projectId} — ${row.stageName}`}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="pms-delay-form"
            icon={icon}
            variant={isResolve ? 'primary' : isPlan ? 'primary' : 'danger'}
          >
            {title}
          </Button>
        </>
      }
    >
      <form id="pms-delay-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Context */}
        <div className="rounded-lg border border-[#dce5f4] bg-[#f6f9ff] p-3">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Customer', row.customerName],
              ['Department', row.department],
              ['Overdue by', row.delayMs > 0 ? row.delayLabel : 'Not yet overdue'],
              ['Completion', `${row.completionPct}%`],
            ].map(([k, v], i) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] text-slate-500">{k}</dt>
                <dd
                  className="text-[11px] font-bold truncate"
                  style={{ color: i === 2 && row.delayMs > 0 ? '#9f1239' : '#334155' }}
                  title={String(v)}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {isResolve ? (
          <>
            <p className="text-xs text-slate-600">
              This clears the delay flag and returns the stage to In Progress. The recorded cause
              stays on the audit trail.
            </p>
            {row.reason && (
              <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <strong>{row.category ?? 'Logged'}:</strong> {row.reason}
              </p>
            )}
          </>
        ) : (
          <>
            <div>
              <label className={labelClass} htmlFor="delay-category">
                Root cause <span className="text-rose-500">*</span>
              </label>
              <select
                id="delay-category"
                className={fieldClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {DELAY_REASON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                  <AlertCircle size={11} /> {errors.category}
                </p>
              )}
            </div>

            {!isPlan && (
              <div>
                <label className={labelClass} htmlFor="delay-reason">
                  What happened <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="delay-reason"
                  rows={2}
                  className={fieldClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Antistatic laminate consignment delayed by the vendor."
                />
                {errors.reason && (
                  <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                    <AlertCircle size={11} /> {errors.reason}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass + ' mb-0'} htmlFor="delay-owner">Responsible person</label>
                  <MasterSourceLink source="users" />
                </div>
                <select
                  id="delay-owner"
                  className={fieldClass}
                  value={responsibleUser}
                  onChange={(e) => setResponsibleUser(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="delay-recovery">
                  Expected recovery <span className="text-rose-500">*</span>
                </label>
                <input
                  id="delay-recovery"
                  type="date"
                  className={fieldClass}
                  value={recoveryDate}
                  onChange={(e) => setRecoveryDate(e.target.value)}
                />
                {errors.expectedRecoveryDate && (
                  <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                    <AlertCircle size={11} /> {errors.expectedRecoveryDate}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <div>
          <label className={labelClass} htmlFor="delay-notes">
            {isResolve ? 'Resolution notes' : 'Recovery notes'}
          </label>
          <textarea
            id="delay-notes"
            rows={2}
            className={fieldClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isResolve ? 'How it was resolved.' : 'Mitigation steps in flight.'}
          />
        </div>

        {errors.submit && (
          <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {errors.submit}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default LogDelayModal;
