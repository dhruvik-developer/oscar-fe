import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Ban, Loader, ExternalLink, AlertTriangle } from 'lucide-react';

/**
 * TaskCardItem — one actionable task with an inline progress slider.
 *
 * Moving the slider writes straight through to the store, so the stage bar and
 * the project gauge move with it; there is no local draft state to get out of
 * sync with what the rest of the module shows.
 */

const STATUS_TONES = {
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

const CYCLE = ['Not Started', 'In Progress', 'Blocked', 'Completed'];

function dueLabel(dueDate, now = Date.now()) {
  const d = dueDate ? new Date(dueDate) : null;
  if (!d || Number.isNaN(d.getTime())) return { text: 'No due date', tone: '#94a3b8' };
  const diffDays = (d.getTime() - now) / 86400000;
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  if (diffDays < 0) return { text: `${date} · overdue`, tone: '#9f1239' };
  if (diffDays < 1) return { text: `${date} · today`, tone: '#9a3412' };
  return { text: `${date} · in ${Math.floor(diffDays)}d`, tone: '#64748b' };
}

export function TaskCardItem({ task, onProgress, onCycleStatus, onOpen }) {
  const tone = STATUS_TONES[task.status] ?? STATUS_TONES['Not Started'];
  const Icon = tone.icon;
  const priority = PRIORITY_TONES[task.priority] ?? PRIORITY_TONES.Low;
  const due = dueLabel(task.dueDate);
  const done = task.status === 'Completed';

  return (
    <li className="rounded-xl border border-[#dce5f4] bg-white p-3.5 shadow-2xs hover:border-blue-200 transition-colors">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onCycleStatus?.(task, CYCLE[(CYCLE.indexOf(task.status) + 1) % CYCLE.length])}
          title={`Status: ${task.status} — click to advance`}
          aria-label={`Advance status of ${task.taskName}`}
          className="shrink-0 mt-0.5 rounded-full p-0.5"
          style={{ color: tone.fg }}
        >
          <Icon size={17} strokeWidth={2.2} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => onOpen?.(task)}
              className={`text-left text-xs font-bold hover:text-blue-600 ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}
            >
              {task.taskName}
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: priority.bg, color: priority.fg }}>
                {task.priority}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: tone.bg, color: tone.fg }}>
                {task.status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Link
              to={`/pms/projects/${task.projectId}`}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline"
            >
              {task.projectId} <ExternalLink size={9} />
            </Link>
            <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={task.stageName}>
              {task.stageName}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: due.tone }}>
              {due.tone === '#9f1239' && <AlertTriangle size={9} />}
              {due.text}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2.5">
            <label className="flex-1 min-w-0">
              <span className="sr-only">Progress for {task.taskName}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={task.completionPct ?? 0}
                onChange={(e) => onProgress?.(task, Number(e.target.value))}
                className="w-full accent-blue-600 h-1"
              />
            </label>
            <span className="text-[11px] font-bold text-slate-700 w-9 text-right tabular-nums">
              {task.completionPct ?? 0}%
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

export default TaskCardItem;
