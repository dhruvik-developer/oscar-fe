import React, { useMemo, useState } from 'react';
import { CheckCircle2, ShieldAlert, Clock, AlertTriangle } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import {
  usePmsStore,
  validateProjectCompletion,
  computeProjectCompletionMetrics,
} from '../../../../stores/pmsStore';

/**
 * CompleteProjectModal — the project sign-off gate.
 *
 * The rule is: every stage Completed, plus a named PM sign-off. Blockers are
 * listed by name so it is obvious what is still open, and the override is
 * deliberately separate — a manager can close unfinished work, but only by
 * saying so explicitly, and the audit entry records that they did.
 */

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';

export function CompleteProjectModal({ isOpen, onClose, project, onCompleted }) {
  const completeProject = usePmsStore((s) => s.completeProject);
  const showToast = usePmsStore((s) => s.showToast);

  const [override, setOverride] = useState(false);
  const [signer, setSigner] = useState('');
  const [error, setError] = useState('');

  const blockers = useMemo(
    () => (project ? validateProjectCompletion(project).filter((b) => b.code === 'STAGE_OPEN' || b.code === 'NO_STAGES') : []),
    [project]
  );
  const preview = useMemo(
    () => (project ? computeProjectCompletionMetrics(project, Date.now(), project.projectManager) : null),
    [project]
  );

  if (!project) return null;

  const pm = project.projectManager;
  const gateClear = blockers.length === 0;
  const canSubmit = (gateClear || override) && signer.trim().length > 0;

  function handleConfirm() {
    setError('');
    try {
      const metrics = completeProject(
        project.id,
        { ...pm, name: signer.trim() || pm?.name },
        { force: override }
      );
      showToast(`${project.code || project.id} signed off — ${metrics.totalDurationDays} day turnaround.`, 'success', 'onCompletion');
      onCompleted?.(metrics);
      onClose?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Complete Project"
      subtitle={`${project.code || project.id} — ${project.customerName}`}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="button" icon={CheckCircle2} onClick={handleConfirm} disabled={!canSubmit}>
            Sign Off &amp; Complete
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Gate */}
        {gateClear ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-800">
              All {project.stages?.length ?? 0} stages are completed. Ready for sign-off.
            </p>
          </div>
        ) : (
          <section className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={13} className="text-rose-600" />
              <span className="text-[11px] font-bold text-rose-700">
                {blockers.length} stage{blockers.length === 1 ? '' : 's'} still open
              </span>
            </div>
            <ul className="space-y-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {blockers.map((b) => (
                <li key={b.stageId ?? b.code} className="text-[11px] text-rose-700">• {b.label}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Completion record preview */}
        <section className="rounded-lg border border-[#dce5f4] bg-[#f6f9ff] p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Clock size={12} className="text-blue-500" />
            <span className="text-[11px] font-bold text-slate-700">Completion record</span>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Turnaround', `${preview.totalDurationDays} days`],
              ['Net delay', preview.totalDelayHours > 0 ? `${preview.totalDelayHours} h` : 'None'],
              ['Final completion', `${preview.finalCompletionPct}%`],
              ['Stages', preview.stageCount],
            ].map(([k, v], i) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] text-slate-500">{k}</dt>
                <dd
                  className="text-[11px] font-bold truncate"
                  style={{ color: i === 1 && preview.totalDelayHours > 0 ? '#9f1239' : '#334155' }}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-[10px] text-slate-400 mt-2">
            These figures are frozen at sign-off and are not recalculated afterwards.
          </p>
        </section>

        {/* Sign-off */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1.5" htmlFor="signoff-name">
            Signed off by <span className="text-rose-500">*</span>
          </label>
          <input
            id="signoff-name"
            type="text"
            className={fieldClass}
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            placeholder={pm?.name ?? 'Project manager name'}
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            Recorded against the project and written to the audit trail.
          </p>
        </div>

        {!gateClear && (
          <label className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
              className="accent-amber-600 mt-0.5"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
                <AlertTriangle size={11} /> Close anyway, with stages still open
              </span>
              <span className="block text-[10px] text-amber-700 mt-0.5">
                The override is recorded in the audit trail alongside your name.
              </span>
            </span>
          </label>
        )}

        {error && (
          <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default CompleteProjectModal;
