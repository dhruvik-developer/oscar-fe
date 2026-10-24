import React from 'react';
import {
  Circle,
  UserCheck,
  Clock,
  AlertTriangle,
  AlertCircle,
  Send,
  Eye,
  Check,
  CheckCheck,
  RefreshCw,
  Lock,
} from 'lucide-react';

/**
 * StageStatusBadge — pill indicator for the 11 PMS stage statuses.
 *
 * The shared components/ui/StatusBadge maps status strings onto the global
 * `badge-*` CSS classes, but six of the PMS statuses (Not Started, At Risk,
 * Delayed, Under Review, Need Improvement, Blocked) have no entry there and
 * would all collapse to the same grey pill. Rather than edit that shared map —
 * which CRM, HRMS and ERP all render through — PMS carries its own token set.
 */

const STATUS_TOKENS = {
  'Not Started': { bg: '#f1f5f9', fg: '#475569', border: '#e2e8f0', icon: Circle },
  Assigned: { bg: '#e0f2fe', fg: '#0369a1', border: '#bae6fd', icon: UserCheck },
  'In Progress': { bg: '#e0e7ff', fg: '#3730a3', border: '#c7d2fe', icon: Clock },
  'At Risk': { bg: '#fef3c7', fg: '#92400e', border: '#fde68a', icon: AlertTriangle, pulse: true },
  Delayed: { bg: '#ffe4e6', fg: '#9f1239', border: '#fecdd3', icon: AlertCircle },
  Submitted: { bg: '#f3e8ff', fg: '#6b21a8', border: '#e9d5ff', icon: Send },
  'Under Review': { bg: '#e0e7ff', fg: '#3730a3', border: '#c7d2fe', icon: Eye },
  Approved: { bg: '#d1fae5', fg: '#065f46', border: '#a7f3d0', icon: Check },
  'Need Improvement': { bg: '#ffedd5', fg: '#9a3412', border: '#fed7aa', icon: RefreshCw },
  Completed: { bg: '#dcfce7', fg: '#166534', border: '#bbf7d0', icon: CheckCheck },
  Blocked: { bg: '#fee2e2', fg: '#991b1b', border: '#fecaca', icon: Lock },
};

const FALLBACK = STATUS_TOKENS['Not Started'];

/** Token lookup for callers that need the colours without the pill. */
export function getStageStatusToken(status) {
  return STATUS_TOKENS[status] ?? FALLBACK;
}

export function StageStatusBadge({ status, size = 'md', showIcon = true, className = '' }) {
  const token = STATUS_TOKENS[status] ?? FALLBACK;
  const Icon = token.icon;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border whitespace-nowrap ${className}`}
      style={{
        background: token.bg,
        color: token.fg,
        borderColor: token.border,
        fontSize: isSm ? 10 : 11,
        padding: isSm ? '2px 8px' : '4px 10px',
        lineHeight: 1.4,
      }}
      title={status}
    >
      {showIcon && Icon && (
        <Icon
          size={isSm ? 11 : 12}
          strokeWidth={2.5}
          className={token.pulse ? 'animate-pulse' : undefined}
          style={{ flexShrink: 0 }}
        />
      )}
      {status ?? 'Not Started'}
    </span>
  );
}

export default StageStatusBadge;
