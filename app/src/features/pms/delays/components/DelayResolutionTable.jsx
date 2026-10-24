import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, FileWarning } from 'lucide-react';
import { DataTable } from '../../../../components/ui/DataTable';
import { StageStatusBadge } from '../../components/StageStatusBadge';

/**
 * DelayResolutionTable — the actionable delay grid.
 *
 * Rows include stages that are simply overdue as well as ones with a delay
 * formally logged; an unattributed row is called out so it can be categorised
 * rather than quietly ignored.
 *
 * Note the two-argument render signature: DataTable calls render(value, row).
 */

const CATEGORY_TONES = {
  'Client Revision': { bg: '#f3e8ff', fg: '#6b21a8' },
  'Client Approval Pending': { bg: '#fef3c7', fg: '#92400e' },
  'Design Issue': { bg: '#eef2ff', fg: '#4338ca' },
  'Resource Unavailable': { bg: '#ffedd5', fg: '#9a3412' },
  'Production Issue': { bg: '#ffe4e6', fg: '#9f1239' },
  'Quality Issue': { bg: '#f0fdfa', fg: '#0f766e' },
  'Material Issue': { bg: '#fff7ed', fg: '#c2410c' },
  'Internal Dependency': { bg: '#ecfeff', fg: '#0e7490' },
  Other: { bg: '#f1f5f9', fg: '#475569' },
};

function shortDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DelayResolutionTable({ rows = [], onUpdatePlan, onResolve, onLog }) {
  const columns = [
    {
      key: 'projectId',
      label: 'Project',
      render: (_v, row) => (
        <div className="min-w-0">
          <Link
            to={`/pms/projects/${row.projectId}`}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            {row.projectId}
          </Link>
          <div className="text-[11px] text-slate-500 truncate max-w-[150px]" title={row.customerName}>
            {row.customerName}
          </div>
        </div>
      ),
    },
    {
      key: 'stageName',
      label: 'Stage',
      render: (_v, row) => (
        <div className="min-w-0">
          <div className="text-xs text-slate-700 truncate max-w-[160px]">{row.stageName}</div>
          <StageStatusBadge status={row.status} size="sm" />
        </div>
      ),
    },
    {
      key: 'delayMs',
      label: 'Overdue',
      render: (_v, row) =>
        row.delayMs > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap" style={{ color: '#9f1239' }}>
            <AlertTriangle size={12} strokeWidth={2.5} />+{row.delayLabel}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-amber-700">Flagged</span>
        ),
    },
    {
      key: 'responsibleDepartment',
      label: 'Responsible',
      render: (_v, row) => (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-700">{row.responsibleDepartment}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-[130px]">{row.responsibleUser}</div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Root Cause',
      render: (_v, row) => {
        if (!row.category) {
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">
              <FileWarning size={10} /> Unattributed
            </span>
          );
        }
        const tone = CATEGORY_TONES[row.category] ?? CATEGORY_TONES.Other;
        return (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {row.category}
          </span>
        );
      },
    },
    {
      key: 'reason',
      label: 'Stated Reason',
      render: (_v, row) => (
        <span
          className="text-[11px] text-slate-600 line-clamp-2 max-w-[220px] block"
          title={row.reason || 'No reason logged yet'}
        >
          {row.reason || <em className="text-slate-400">No reason logged</em>}
        </span>
      ),
    },
    {
      key: 'expectedRecoveryDate',
      label: 'Recovery',
      render: (_v, row) => {
        const label = shortDate(row.expectedRecoveryDate);
        if (!label) return <span className="text-[11px] text-slate-400">—</span>;
        const overdueRecovery = new Date(row.expectedRecoveryDate).getTime() < Date.now();
        return (
          <span
            className="text-[11px] font-semibold whitespace-nowrap"
            style={{ color: overdueRecovery ? '#9f1239' : '#334155' }}
            title={overdueRecovery ? 'Recovery date has already passed' : ''}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.isLogged ? (
            <>
              <button
                type="button"
                title="Update recovery plan"
                aria-label={`Update recovery plan for ${row.stageName}`}
                onClick={() => onUpdatePlan?.(row)}
                className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
              >
                <CalendarClock size={14} />
              </button>
              <button
                type="button"
                title="Resolve delay"
                aria-label={`Resolve delay on ${row.stageName}`}
                onClick={() => onResolve?.(row)}
                className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
              >
                <CheckCircle2 size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onLog?.(row)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline whitespace-nowrap"
            >
              <AlertTriangle size={12} /> Log reason
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      title="Delay Resolution"
      subtitle="Overdue and flagged stages, worst first"
      columns={columns}
      data={rows}
      rowKey="id"
      pageSize={10}
      pageSizeOptions={[10, 20, 50]}
      emptyTitle="Nothing running late"
      emptyDesc="Overdue and at-risk stages will appear here as soon as one slips."
      exportable={false}
      searchable={false}
    />
  );
}

export default DelayResolutionTable;
