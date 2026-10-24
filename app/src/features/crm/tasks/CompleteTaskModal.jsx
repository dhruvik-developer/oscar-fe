import { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, CheckSquare, Phone, Clock, MoveRight, LayoutGrid, CalendarDays, Check } from 'lucide-react';
import { NEXT_ACTIONS, NEXT_ACTION_LABELS, getNextStageName } from '../../../services/taskCompletionService';
import { useCrmStore } from '../../../stores/crmStore';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

const WHAT_HAPPENED_MAX = 1000;
const OUTCOME_NOTES_MAX = 500;

function defaultFollowUpValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const OPTION_ICONS = {
  'needs-another-attempt': Clock,
  'ready-to-move-on': MoveRight,
  'finished-with-lead': LayoutGrid,
};

const OPTION_SUB = {
  'needs-another-attempt': 'Schedule another attempt in this stage',
  'ready-to-move-on': 'Move the lead to the next stage and create its tasks',
  'finished-with-lead': 'Close remaining tasks and keep the current stage.',
};

export default function CompleteTaskModal({ open, task, lead, onCancel, onComplete, onSuccess, nextStageName, blockingTasks = [] }) {
  const stages = useCrmStore((s) => s.stages);
  const [whatHappened, setWhatHappened] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [nextAction, setNextAction] = useState('ready-to-move-on');
  const [targetStageId, setTargetStageId] = useState('');
  const [followUpAt, setFollowUpAt] = useState(defaultFollowUpValue);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [phase, setPhase] = useState('form');
  const [warnings, setWarnings] = useState([]);

  const currentStage = task?.stage || lead?.status || 'New Lead';
  const attemptNumber = task?.attempt || task?.attemptNumber || 1;

  const stageOptions = useMemo(() => {
    const rows = Array.isArray(stages) ? stages : [];
    return rows
      .filter((s) => s?.is_active !== false)
      .slice()
      .sort((a, b) => (Number(a.order ?? a.sequence ?? 0) || 0) - (Number(b.order ?? b.sequence ?? 0) || 0));
  }, [stages]);

  const suggestedStage = useMemo(() => {
    if (nextStageName) {
      const match = stageOptions.find((s) => String(s.name || '').toLowerCase() === String(nextStageName).toLowerCase());
      if (match) return match;
    }
    let name = null;
    try {
      name = getNextStageName(currentStage);
    } catch {
      name = null;
    }
    if (name) {
      const match = stageOptions.find((s) => String(s.name || '').toLowerCase() === String(name).toLowerCase());
      if (match) return match;
    }
    return stageOptions[0] || null;
  }, [stageOptions, nextStageName, currentStage]);

  useEffect(() => {
    if (open) {
      setWhatHappened('');
      setOutcomeNotes('');
      setNextAction('ready-to-move-on');
      setTargetStageId('');
      setFollowUpAt(defaultFollowUpValue());
      setSubmitting(false);
      setFormError('');
      setPhase('form');
      setWarnings([]);
    }
  }, [open]);

  useEffect(() => {
    if (open && !targetStageId && suggestedStage?.id) {
      setTargetStageId(String(suggestedStage.id));
    }
  }, [open, suggestedStage, targetStageId]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape' && phase === 'form') onCancel?.();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, phase, onCancel]);

  if (!open) return null;

  const showMoveToStage = nextAction === 'ready-to-move-on';
  const showFollowUp = nextAction !== 'finished-with-lead';
  const valid =
    Boolean(whatHappened.trim()) &&
    whatHappened.trim().length <= WHAT_HAPPENED_MAX &&
    outcomeNotes.length <= OUTCOME_NOTES_MAX &&
    Boolean(nextAction) &&
    (!showFollowUp || Boolean(followUpAt)) &&
    (!showMoveToStage || Boolean(targetStageId));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!whatHappened.trim()) {
      setFormError('Please summarize what happened.');
      return;
    }
    if (showMoveToStage && !targetStageId) {
      setFormError('Please select the stage to move to.');
      return;
    }
    if (showFollowUp && !followUpAt) {
      setFormError('Please select the next follow-up date and time.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const result = (await onComplete?.(
        outcomeNotes.trim() || null,
        nextAction,
        whatHappened.trim(),
        showFollowUp ? toIsoOrNull(followUpAt) : null,
        showMoveToStage ? targetStageId : null,
      )) || {};
      if (result.ok === false) {
        setFormError(result.message || 'Could not complete the task.');
        setSubmitting(false);
        return;
      }
      setWarnings(result.warnings || []);
      setPhase('success');
      window.setTimeout(() => onSuccess?.(result || {}), 1600);
    } catch (err) {
      setFormError(err?.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 p-2 sm:p-4 backdrop-blur-xs"
      onClick={() => { if (!submitting && phase === 'form') onCancel?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Complete Task"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-600 text-white">
              <CheckSquare size={15} />
            </span>
            <h2 className="text-[15px] font-bold text-slate-900">Complete Task</h2>
          </div>
          <button
            type="button"
            onClick={() => { if (!submitting && phase === 'form') onCancel?.(); }}
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label="Close"
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>

        {phase === 'success' ? (
          <div className="overflow-y-auto">
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={30} />
              </span>
              <h3 className="mt-4 text-[15px] font-bold text-slate-900">Task completed successfully.</h3>
              <p className="mt-1 text-xs text-slate-500">
                Next: <strong className="text-slate-700">{NEXT_ACTION_LABELS[nextAction] || nextAction}</strong>
              </p>
              {warnings.length > 0 && (
                <div className="mt-4 w-full space-y-2 text-left">
                  {warnings.map((warning, index) => (
                    <p key={index} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto">
            <div className="space-y-4 px-5 py-4">
              <div className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
                  <Phone size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-slate-900">{task?.title || 'Detail collection'}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Attempt {attemptNumber} &nbsp;|&nbsp; Stage: {currentStage}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                  What happened? <span className="text-rose-500">*</span>
                </label>
                <div className="rounded-lg border border-slate-200 focus-within:border-blue-500">
                  <textarea
                    rows={3}
                    value={whatHappened}
                    onChange={(e) => setWhatHappened(e.target.value.slice(0, WHAT_HAPPENED_MAX))}
                    placeholder="Summarize the call, visit, demo, or outcome.."
                    className="w-full resize-none rounded-lg px-3 py-2 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <p className="px-3 pb-1.5 text-right text-[10px] text-slate-400">
                    {whatHappened.length} / {WHAT_HAPPENED_MAX}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                  What next? <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {NEXT_ACTIONS.map((option) => {
                    const Icon = OPTION_ICONS[option.value] || Clock;
                    const selected = nextAction === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                          selected
                            ? 'border-teal-500 bg-teal-50/60'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="next-action"
                          value={option.value}
                          checked={selected}
                          onChange={(e) => setNextAction(e.target.value)}
                          className="mt-1 h-4 w-4 accent-teal-600"
                        />
                        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${selected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon size={13} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-slate-800">
                            {option.label}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {OPTION_SUB[option.value] || option.description}
                          </span>
                          {option.value === 'ready-to-move-on' && blockingTasks.length > 0 && (
                            <span className="mt-0.5 block text-[11px] font-medium text-rose-500">
                              Blocked until these are completed: {blockingTasks.join(', ')}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {showMoveToStage && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-[13px] font-semibold text-slate-800">
                      Move to stage <span className="text-rose-500">*</span>
                    </label>
                    <MasterSourceLink source="leadStages" />
                  </div>
                  <select
                    value={targetStageId}
                    onChange={(e) => setTargetStageId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-blue-500"
                  >
                    <option value="">Select stage</option>
                    {stageOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    This is the suggested stage based on this task. You can change it if needed.
                  </p>
                </div>
              )}

              {showFollowUp && (
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                  Next follow-up date & time <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={followUpAt}
                    onChange={(e) => setFollowUpAt(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 text-[13px] text-slate-700 outline-none transition focus:border-blue-500"
                  />
                  <CalendarDays size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  The next stage task will be scheduled for this date and time.
                </p>
              </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                  Outcome notes / blockers <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <div className="rounded-lg border border-slate-200 focus-within:border-blue-500">
                  <textarea
                    rows={2}
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value.slice(0, OUTCOME_NOTES_MAX))}
                    placeholder="Any additional notes, customer feedback, or blockers.."
                    className="w-full resize-none rounded-lg px-3 py-2 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <p className="px-3 pb-1.5 text-right text-[10px] text-slate-400">
                    {outcomeNotes.length} / {OUTCOME_NOTES_MAX}
                  </p>
                </div>
              </div>

              {formError && (
                <p className="text-[11px] font-semibold text-rose-600">{formError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid || submitting}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-5 text-[13px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    Complete Task
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
