import React from 'react';
import {
  Plus,
  UserCheck,
  Upload,
  Eye,
  Check,
  CheckCheck,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Sliders,
  CircleDot,
  PlayCircle,
} from 'lucide-react';
import { EmptyStatePms } from './EmptyStatePms';

/**
 * ActivityTimeline — chronological vertical audit trail for a PMS project.
 *
 * Renders the `activityLog` entries produced by the PMS store. Entries carry
 * `{ id, timestamp, actor, action, description }`; the optional `from`/`to`
 * and `comments` fields render when a caller supplies them, which is what the
 * Stage 12 audit trail fills in.
 */

const ACTION_NODES = {
  PROJECT_CREATED: { icon: Plus, bg: '#e0f2fe', fg: '#0369a1', label: 'Created' },
  STAGES_CONFIGURED: { icon: Sliders, bg: '#e0e7ff', fg: '#3730a3', label: 'Configured' },
  STAGE_ASSIGNED: { icon: UserCheck, bg: '#e0f2fe', fg: '#0369a1', label: 'Assigned' },
  STAGE_STARTED: { icon: PlayCircle, bg: '#e0e7ff', fg: '#3730a3', label: 'Started' },
  STAGE_STATUS_CHANGED: { icon: CircleDot, bg: '#e0e7ff', fg: '#3730a3', label: 'Status' },
  DOCUMENT_UPLOADED: { icon: Upload, bg: '#f3e8ff', fg: '#6b21a8', label: 'Uploaded' },
  APPROVAL_REQUESTED: { icon: Eye, bg: '#e0e7ff', fg: '#3730a3', label: 'Reviewed' },
  DOCUMENT_APPROVED: { icon: Check, bg: '#d1fae5', fg: '#065f46', label: 'Approved' },
  REVISION_REQUESTED: { icon: RefreshCw, bg: '#ffedd5', fg: '#9a3412', label: 'Revision' },
  DELAY_LOGGED: { icon: AlertCircle, bg: '#ffe4e6', fg: '#9f1239', label: 'Delayed' },
  DELAY_RESOLVED: { icon: Check, bg: '#d1fae5', fg: '#065f46', label: 'Resolved' },
  STAGE_HANDOFF: { icon: ArrowRight, bg: '#e0e7ff', fg: '#3730a3', label: 'Handoff' },
  STAGE_COMPLETED: { icon: CheckCheck, bg: '#dcfce7', fg: '#166534', label: 'Completed' },
  PROJECT_COMPLETED: { icon: CheckCheck, bg: '#dcfce7', fg: '#166534', label: 'Completed' },
};

const FALLBACK_NODE = { icon: CircleDot, bg: '#f1f5f9', fg: '#475569', label: 'Activity' };

function formatTimestamp(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function ActorAvatar({ actor }) {
  if (actor?.avatar) {
    return (
      <img
        src={actor.avatar}
        alt={actor.name ?? 'User'}
        className="w-5 h-5 rounded-full object-cover border border-slate-200"
      />
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-500 flex items-center justify-center">
      {initialsOf(actor?.name) || '—'}
    </span>
  );
}

export function ActivityTimeline({ entries = [], limit, renderContext, className = '' }) {
  // Newest first; the store appends chronologically.
  const ordered = [...entries].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  const visible = limit ? ordered.slice(0, limit) : ordered;

  if (visible.length === 0) {
    return (
      <EmptyStatePms
        variant="activity"
        className={className}
      />
    );
  }

  return (
    <ol className={`relative ${className}`} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {visible.map((entry, idx) => {
        const node = ACTION_NODES[entry.action] ?? FALLBACK_NODE;
        const Icon = node.icon;
        const isLast = idx === visible.length - 1;

        return (
          <li key={entry.id ?? idx} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Rail */}
            {!isLast && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 15,
                  top: 32,
                  bottom: 0,
                  width: 2,
                  background: '#e2e8f0',
                }}
              />
            )}

            {/* Icon node */}
            <span
              className="relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center border"
              style={{ background: node.bg, color: node.fg, borderColor: node.fg + '33' }}
              title={node.label}
            >
              <Icon size={14} strokeWidth={2.4} />
            </span>

            {/* Body */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800">{node.label}</span>
                <span className="text-[11px] text-slate-400">{formatTimestamp(entry.timestamp)}</span>
                {/* Optional caller-supplied context, e.g. a project link on a
                    cross-project feed. */}
                {typeof renderContext === 'function' && renderContext(entry)}
              </div>

              {entry.description && (
                <p className="text-xs text-slate-600 mt-0.5">{entry.description}</p>
              )}

              {/* previous value → new value */}
              {(entry.from != null || entry.to != null) && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 line-through">
                    {String(entry.from ?? '—')}
                  </span>
                  <ArrowRight size={11} className="text-slate-400 shrink-0" />
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-semibold">
                    {String(entry.to ?? '—')}
                  </span>
                </div>
              )}

              {entry.comments && (
                <p className="mt-1.5 text-[11px] text-slate-500 italic border-l-2 border-slate-200 pl-2">
                  “{entry.comments}”
                </p>
              )}

              {entry.actor?.name && (
                <div className="flex items-center gap-1.5 mt-2">
                  <ActorAvatar actor={entry.actor} />
                  <span className="text-[11px] font-medium text-slate-500">
                    {entry.actor.name}
                  </span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default ActivityTimeline;
