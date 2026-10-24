import React, { useMemo, useState } from 'react';
import { History, Search, X, CheckCircle2 } from 'lucide-react';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { filterAuditTrail, AUDIT_EVENT_TYPES } from '../../../../stores/pmsStore';

/**
 * ActivityAuditTab — the project's chronological audit trail.
 *
 * Every store mutation that matters appends an entry, so this tab needs no
 * logic of its own beyond letting a reader narrow a long trail. Completed
 * projects also surface their frozen completion record here, since that is the
 * closing entry of the project's history.
 */

function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
}

export function ActivityAuditTab({ project }) {
  const entries = useMemo(() => project.activityLog ?? [], [project]);
  const [action, setAction] = useState('all');
  const [search, setSearch] = useState('');

  // Only offer event types this project actually has.
  const presentTypes = useMemo(() => {
    const present = new Set(entries.map((e) => e.action));
    return AUDIT_EVENT_TYPES.filter((t) => present.has(t.action));
  }, [entries]);

  const visible = useMemo(
    () => filterAuditTrail(entries, { action, search }),
    [entries, action, search]
  );

  const isFiltered = action !== 'all' || Boolean(search.trim());
  const completion = project.completion ?? null;

  return (
    <div className="space-y-4">
      {completion && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <h3 className="text-sm font-bold text-emerald-900">Completion record</h3>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Completed', stamp(completion.actualCompletionDate)],
              ['Turnaround', `${completion.totalDurationDays} days`],
              ['Net delay', completion.totalDelayHours > 0 ? `${completion.totalDelayHours} h` : 'None'],
              ['Signed off by', completion.signedOffBy?.name ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] text-emerald-700">{k}</dt>
                <dd className="text-[11px] font-bold text-emerald-900 truncate" title={String(v)}>{v}</dd>
              </div>
            ))}
          </dl>
          {completion.forced && (
            <p className="text-[10px] text-amber-800 bg-amber-100 border border-amber-200 rounded px-2 py-1 mt-2.5">
              Closed with stages still open.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
        <header className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <History size={14} className="text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">Activity &amp; Audit Trail</h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the trail…"
                aria-label="Search audit trail"
                className="text-xs rounded-lg border border-[#dce5f4] bg-white pl-8 pr-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                style={{ width: 170 }}
              />
            </div>

            <select
              className="text-xs rounded-lg border border-[#dce5f4] bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              aria-label="Filter by event type"
            >
              <option value="all">All events</option>
              {presentTypes.map((t) => (
                <option key={t.action} value={t.action}>{t.label}</option>
              ))}
            </select>

            {isFiltered && (
              <button
                type="button"
                onClick={() => { setAction('all'); setSearch(''); }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </header>

        <p className="text-[11px] text-slate-400 mb-3 pb-3 border-b border-slate-100">
          Showing <strong className="text-slate-600">{visible.length}</strong> of {entries.length}{' '}
          {entries.length === 1 ? 'event' : 'events'}
        </p>

        {visible.length === 0 && entries.length > 0 ? (
          <p className="text-[11px] text-slate-400 py-8 text-center">
            No events match this filter.
          </p>
        ) : (
          <ActivityTimeline entries={visible} />
        )}
      </section>
    </div>
  );
}

export default ActivityAuditTab;
