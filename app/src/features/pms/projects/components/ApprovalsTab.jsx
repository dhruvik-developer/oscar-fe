import React from 'react';
import { ShieldCheck, RefreshCw, Clock, User } from 'lucide-react';
import { EmptyStatePms } from '../../components/EmptyStatePms';

/**
 * ApprovalsTab — client and PM sign-off history.
 *
 * Reads the approval records the store appends whenever a document decision is
 * recorded, so an approval and the revision reason that followed it stay on the
 * same thread.
 */

const DECISION_TONES = {
  Approved: { bg: '#d1fae5', fg: '#065f46', icon: ShieldCheck },
  Pending: { bg: '#fef3c7', fg: '#92400e', icon: Clock },
  'Need Improvement': { bg: '#ffedd5', fg: '#9a3412', icon: RefreshCw },
};

function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function ApprovalsTab({ project }) {
  const stages = [...(project.stages ?? [])].sort((a, b) => a.sequence - b.sequence);

  const rows = stages.flatMap((stage) =>
    (stage.approvals ?? []).map((approval) => {
      const doc = (stage.documents ?? []).find((d) => d.id === approval.documentId);
      return { ...approval, stageName: stage.name, stageId: stage.id, document: doc };
    })
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
        <EmptyStatePms
          variant="activity"
          title="No approvals requested yet"
          description="Client and PM sign-off decisions, along with any revision reasons, are recorded here."
        />
      </div>
    );
  }

  const pending = rows.filter((r) => r.status === 'Pending').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dce5f4] bg-[#f6f9ff] px-4 py-3">
        <ShieldCheck size={14} className="text-blue-500 shrink-0" />
        <p className="text-[11px] text-slate-600 flex-1 min-w-[220px]">
          <strong>{rows.length}</strong> approval {rows.length === 1 ? 'record' : 'records'} on this
          project{pending > 0 ? <> · <strong>{pending}</strong> awaiting a response</> : null}.
        </p>
      </div>

      <ol className="space-y-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((row) => {
          const tone = DECISION_TONES[row.status] ?? DECISION_TONES.Pending;
          const Icon = tone.icon;

          return (
            <li key={row.id} className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    <Icon size={14} strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">{row.stageName}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {row.approverType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <User size={10} className="text-slate-400" />
                      {row.approverName}
                      {row.document ? ` · ${row.document.fileName} (v${row.document.version}.0)` : ''}
                    </p>
                    {row.comments && (
                      <p className="text-[11px] text-slate-600 mt-1.5 italic border-l-2 border-slate-200 pl-2">
                        “{row.comments}”
                      </p>
                    )}
                    {row.revisionReason && (
                      <p className="text-[11px] text-orange-700 bg-orange-50 border border-orange-100 rounded px-2 py-1 mt-1.5">
                        <strong>Revision reason:</strong> {row.revisionReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {row.status}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Requested {stamp(row.requestedAt)}
                  </p>
                  {row.decisionAt && (
                    <p className="text-[10px] text-slate-400">Decided {stamp(row.decisionAt)}</p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default ApprovalsTab;
