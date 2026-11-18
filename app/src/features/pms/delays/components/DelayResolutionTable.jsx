import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, FileWarning } from 'lucide-react';
import { StageStatusBadge } from '../../components/StageStatusBadge';
import TablePagination from '../../../../components/ui/TablePagination';

/**
 * DelayResolutionTable — the actionable delay grid.
 *
 * Rows include stages that are simply overdue as well as ones with a delay
 * formally logged; an unattributed row is called out so it can be categorised
 * rather than quietly ignored.
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

export function DelayResolutionTable({
  rows = [],
  onUpdatePlan,
  onResolve,
  onLog,
  headerContent,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const total = rows.length;
  const startIdx = (page - 1) * pageSize;
  const paginatedRows = rows.slice(startIdx, startIdx + pageSize);

  return (
    <div className="overflow-hidden rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
      {headerContent}

      <div className="pms-table-container min-h-[220px]">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs pms-sticky-header">
          <thead>
            <tr className="border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 bg-slate-50/80">
              <th className="px-3.5 py-2.5">Project</th>
              <th className="px-3.5 py-2.5">Stage</th>
              <th className="px-3.5 py-2.5">Overdue</th>
              <th className="px-3.5 py-2.5">Responsible</th>
              <th className="px-3.5 py-2.5">Root Cause</th>
              <th className="px-3.5 py-2.5">Stated Reason</th>
              <th className="px-3.5 py-2.5">Recovery</th>
              <th className="px-3.5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.map((row) => {
              const recoveryLabel = shortDate(row.expectedRecoveryDate);
              const overdueRecovery = recoveryLabel && new Date(row.expectedRecoveryDate).getTime() < Date.now();
              const tone = CATEGORY_TONES[row.category] ?? CATEGORY_TONES.Other;

              return (
                <tr key={row.id || `${row.projectId}-${row.stageName}`} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3.5 py-2.5">
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
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-700 truncate max-w-[160px] font-medium">{row.stageName}</div>
                      <StageStatusBadge status={row.status} size="sm" />
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5">
                    {row.delayMs > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap text-rose-700">
                        <AlertTriangle size={12} strokeWidth={2.5} />+{row.delayLabel}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700">Flagged</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-700">{row.responsibleDepartment}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[130px]">{row.responsibleUser}</div>
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5">
                    {!row.category ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">
                        <FileWarning size={10} /> Unattributed
                      </span>
                    ) : (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        {row.category}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className="text-[11px] text-slate-600 line-clamp-2 max-w-[220px] block"
                      title={row.reason || 'No reason logged yet'}
                    >
                      {row.reason || <em className="text-slate-400">No reason logged</em>}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    {!recoveryLabel ? (
                      <span className="text-[11px] text-slate-400">—</span>
                    ) : (
                      <span
                        className="text-[11px] font-semibold whitespace-nowrap"
                        style={{ color: overdueRecovery ? '#9f1239' : '#334155' }}
                        title={overdueRecovery ? 'Recovery date has already passed' : ''}
                      >
                        {recoveryLabel}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {row.isLogged ? (
                        <>
                          <button
                            type="button"
                            title="Update recovery plan"
                            aria-label={`Update recovery plan for ${row.stageName}`}
                            onClick={() => onUpdatePlan?.(row)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <CalendarClock size={14} />
                          </button>
                          <button
                            type="button"
                            title="Resolve delay"
                            aria-label={`Resolve delay on ${row.stageName}`}
                            onClick={() => onResolve?.(row)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onLog?.(row)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline whitespace-nowrap cursor-pointer"
                        >
                          <AlertTriangle size={12} /> Log reason
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedRows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-14 text-center">
                  <div className="text-sm font-bold text-slate-700">Nothing running late</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Overdue and at-risk stages will appear here as soon as one slips.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <TablePagination
          totalItems={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50]}
          bordered
        />
      )}
    </div>
  );
}

export default DelayResolutionTable;
