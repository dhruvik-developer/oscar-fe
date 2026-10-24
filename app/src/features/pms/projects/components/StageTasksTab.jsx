import React from 'react';
import { CheckCircle2, Circle, Ban, Loader } from 'lucide-react';
import { StageStatusBadge } from '../../components/StageStatusBadge';
import { EmptyStatePms } from '../../components/EmptyStatePms';

/**
 * StageTasksTab — the stage-wise task checklist.
 *
 * Task progress is the input the store averages into stage completion, which
 * in turn averages into project completion, so editing here moves the gauges
 * everywhere else on the page.
 */

const TASK_TONES = {
  Completed: { icon: CheckCircle2, fg: '#065f46', bg: '#d1fae5' },
  'In Progress': { icon: Loader, fg: '#3730a3', bg: '#e0e7ff' },
  Blocked: { icon: Ban, fg: '#991b1b', bg: '#fee2e2' },
  'Not Started': { icon: Circle, fg: '#64748b', bg: '#f1f5f9' },
};

const PRIORITY_TONES = {
  Urgent: { bg: '#ffe4e6', fg: '#9f1239' },
  High: { bg: '#ffedd5', fg: '#9a3412' },
  Medium: { bg: '#e0f2fe', fg: '#0369a1' },
  Low: { bg: '#f1f5f9', fg: '#475569' },
};

function shortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function TaskRow({ task, onToggle, onProgress, readOnly }) {
  const tone = TASK_TONES[task.status] ?? TASK_TONES['Not Started'];
  const Icon = tone.icon;
  const priority = PRIORITY_TONES[task.priority] ?? PRIORITY_TONES.Low;
  const done = task.status === 'Completed';

  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => onToggle?.(task)}
        disabled={readOnly}
        aria-label={done ? `Reopen ${task.taskName}` : `Complete ${task.taskName}`}
        title={done ? 'Mark as in progress' : 'Mark complete'}
        className="shrink-0 mt-0.5 rounded-full p-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ color: tone.fg }}
      >
        <Icon size={16} strokeWidth={2.2} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {task.taskName}
          </span>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: priority.bg, color: priority.fg }}
          >
            {task.priority}
          </span>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {task.status}
          </span>
        </div>

        {task.description && (
          <p className="text-[11px] text-slate-500 mt-0.5">{task.description}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400">
            {task.assignedUser?.name ?? 'Unassigned'} · due {shortDate(task.dueDate)}
          </span>

          <label className="flex items-center gap-1.5 min-w-[150px]">
            <span className="sr-only">Progress for {task.taskName}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={task.completionPct ?? 0}
              disabled={readOnly}
              onChange={(e) => onProgress?.(task, Number(e.target.value))}
              className="flex-1 accent-blue-600 h-1 disabled:opacity-40"
            />
            <span className="text-[10px] font-bold text-slate-600 w-8 text-right">
              {task.completionPct ?? 0}%
            </span>
          </label>
        </div>
      </div>
    </li>
  );
}

export function StageTasksTab({ project, onToggleTask, onTaskProgress, focusStageId }) {
  const ordered = [...(project.stages ?? [])].sort((a, b) => a.sequence - b.sequence);
  const withTasks = ordered.filter((s) => (s.tasks ?? []).length > 0);
  const readOnly = project.status === 'Completed';

  if (withTasks.length === 0) {
    return (
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
        <EmptyStatePms
          variant="tasks"
          title="No tasks yet"
          description="Tasks appear here once they are added to a stage. A stage with no tasks tracks its own progress directly."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withTasks.map((stage) => {
        const tasks = stage.tasks ?? [];
        const done = tasks.filter((t) => t.status === 'Completed').length;
        const isFocused = stage.id === focusStageId;

        return (
          <section
            key={stage.id}
            id={`stage-tasks-${stage.id}`}
            className="rounded-xl border bg-white p-5 shadow-2xs"
            style={{ borderColor: isFocused ? '#bfdbfe' : '#dce5f4' }}
          >
            <header className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">
                  {stage.sequence}
                </span>
                <h3 className="text-sm font-bold text-slate-800 truncate">{stage.name}</h3>
                <StageStatusBadge status={stage.status} size="sm" />
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {done}/{tasks.length} done · stage {stage.completionPct}%
              </span>
            </header>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  readOnly={readOnly}
                  onToggle={(t) => onToggleTask?.(stage.id, t)}
                  onProgress={(t, pct) => onTaskProgress?.(stage.id, t, pct)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default StageTasksTab;
