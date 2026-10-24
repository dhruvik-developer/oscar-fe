import React from 'react';
import { Pencil, Trash2, Check, X, FileText, ShieldCheck } from 'lucide-react';
import { StageSequenceReorder } from './StageSequenceReorder';
import { EmptyStatePms } from '../../components/EmptyStatePms';

/**
 * StageListTable — the configured stage pipeline, in execution order.
 *
 * Deliberately a plain table rather than the shared DataTable: sequence *is*
 * the meaning here, so the sorting and pagination DataTable provides would
 * fight the one ordering that matters.
 */

const DEPARTMENT_TONES = {
  Design: { bg: '#eef2ff', fg: '#4338ca' },
  Production: { bg: '#eff6ff', fg: '#1d4ed8' },
  Quality: { bg: '#f0fdfa', fg: '#0f766e' },
  Packaging: { bg: '#faf5ff', fg: '#7e22ce' },
  Installation: { bg: '#fff7ed', fg: '#c2410c' },
  Logistics: { bg: '#ecfeff', fg: '#0e7490' },
  Management: { bg: '#fdf2f8', fg: '#be185d' },
  Procurement: { bg: '#f7fee7', fg: '#4d7c0f' },
};

function FlagCell({ on, label }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={on ? { background: '#d1fae5', color: '#065f46' } : { background: '#f1f5f9', color: '#94a3b8' }}
      title={`${label}: ${on ? 'required' : 'not required'}`}
    >
      {on ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
      {on ? 'Yes' : 'No'}
    </span>
  );
}

export function StageListTable({ stages = [], onMove, onEdit, onDelete, onToggleActive, emptyAction }) {
  const ordered = [...stages].sort((a, b) => a.sequence - b.sequence);

  if (ordered.length === 0) {
    return (
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
        <EmptyStatePms variant="stages" action={emptyAction} />
      </div>
    );
  }

  const th =
    'px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap';
  const td = 'px-3 py-2.5 align-middle';

  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[#f6f9ff] border-b border-[#dce5f4]">
            <tr>
              <th className={th}>Seq</th>
              <th className={th}>Stage Name</th>
              <th className={th}>Department</th>
              <th className={th}>Duration</th>
              <th className={th}>Role Required</th>
              <th className={th}>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={11} /> Approval
                </span>
              </th>
              <th className={th}>
                <span className="inline-flex items-center gap-1">
                  <FileText size={11} /> Document
                </span>
              </th>
              <th className={th}>Active</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordered.map((stage, idx) => {
              const tone = DEPARTMENT_TONES[stage.department] ?? { bg: '#f1f5f9', fg: '#475569' };
              return (
                <tr
                  key={stage.id}
                  className={`hover:bg-slate-50/70 transition-colors ${stage.isActive ? '' : 'opacity-55'}`}
                >
                  <td className={td}>
                    <StageSequenceReorder
                      sequence={stage.sequence}
                      stageName={stage.name}
                      isFirst={idx === 0}
                      isLast={idx === ordered.length - 1}
                      onMove={(dir) => onMove?.(stage.id, dir)}
                    />
                  </td>

                  <td className={td}>
                    <div className="min-w-0 max-w-[260px]">
                      <div className="text-xs font-bold text-slate-800 truncate">{stage.name}</div>
                      {stage.description && (
                        <div className="text-[11px] text-slate-500 truncate" title={stage.description}>
                          {stage.description}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className={td}>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {stage.department}
                    </span>
                  </td>

                  <td className={td}>
                    <span className="text-xs text-slate-700 whitespace-nowrap">
                      <strong className="font-bold">{stage.defaultDuration}</strong>{' '}
                      <span className="text-slate-400">{stage.durationUnit}</span>
                    </span>
                  </td>

                  <td className={td}>
                    <span className="text-[11px] text-slate-600 whitespace-nowrap">
                      {stage.assignedRole || <em className="text-slate-400">Any</em>}
                    </span>
                  </td>

                  <td className={td}>
                    <FlagCell on={stage.requiredApproval} label="Approval" />
                  </td>

                  <td className={td}>
                    <FlagCell on={stage.requiredDocument} label="Document" />
                  </td>

                  <td className={td}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={stage.isActive}
                      aria-label={`${stage.isActive ? 'Deactivate' : 'Activate'} ${stage.name}`}
                      onClick={() => onToggleActive?.(stage.id)}
                      title={
                        stage.isActive
                          ? 'Active — included in new projects'
                          : 'Inactive — skipped when creating projects'
                      }
                      className="relative inline-flex items-center rounded-full transition-colors"
                      style={{
                        width: 34,
                        height: 18,
                        background: stage.isActive ? '#1bb878' : '#cbd5e1',
                      }}
                    >
                      <span
                        className="absolute rounded-full bg-white shadow-sm transition-all"
                        style={{ width: 14, height: 14, left: stage.isActive ? 18 : 2 }}
                      />
                    </button>
                  </td>

                  <td className={td}>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => onEdit?.(stage)}
                        title="Edit stage"
                        aria-label={`Edit ${stage.name}`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(stage)}
                        title="Delete stage"
                        aria-label={`Delete ${stage.name}`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StageListTable;
