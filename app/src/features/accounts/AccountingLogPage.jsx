import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import {
  Card,
  EmptyRow,
  ErrorState,
  LoadingState,
  formatDate,
  formatINR,
  inputClass,
  labelClass,
  thClass,
  unwrapList,
  useApiGet,
} from './accountingShared';

const PAGE_SIZE = 50;

const MODULE_TONES = {
  payroll: 'bg-violet-50 text-violet-700 border-violet-200',
  incentive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  broker: 'bg-amber-50 text-amber-700 border-amber-200',
  expense: 'bg-rose-50 text-rose-700 border-rose-200',
  payment_in: 'bg-sky-50 text-sky-700 border-sky-200',
  payment_out: 'bg-slate-100 text-slate-700 border-slate-300',
};

function StatusPill({ row }) {
  if (row.isReversal) {
    return (
      <span className="inline-block px-2 py-0.5 rounded border text-[10px] font-semibold bg-orange-50 text-orange-700 border-orange-200">
        Reversal{row.reversalOf ? ` of ${row.reversalOf}` : ''}
      </span>
    );
  }
  if (row.status === 'Reversed') {
    return (
      <span className="inline-block px-2 py-0.5 rounded border text-[10px] font-semibold bg-slate-100 text-slate-500 border-slate-300 line-through">
        Reversed
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded border text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
      Posted
    </span>
  );
}

function EntryLines({ lines }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left">
          <th className={thClass}>Account</th>
          <th className={thClass}>Party</th>
          <th className={thClass}>Description</th>
          <th className={`${thClass} text-right`}>Debit</th>
          <th className={`${thClass} text-right`}>Credit</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#eef2f9]">
        {lines.map((line, idx) => (
          <tr key={idx}>
            <td className="py-1.5 px-3 text-slate-700">
              <span className="font-mono text-slate-400 mr-1.5">{line.accountCode}</span>
              {line.accountName}
            </td>
            <td className="py-1.5 px-3 text-slate-600">{line.party || '—'}</td>
            <td className="py-1.5 px-3 text-slate-500">{line.description || '—'}</td>
            <td className="py-1.5 px-3 text-right font-mono">{Number(line.debit) ? formatINR(line.debit) : ''}</td>
            <td className="py-1.5 px-3 text-right font-mono">{Number(line.credit) ? formatINR(line.credit) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AccountingLogPage() {
  const [module, setModule] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', search: '' });
  const [draft, setDraft] = useState(filters);
  const [expanded, setExpanded] = useState(() => new Set());

  const query = { page, pageSize: PAGE_SIZE };
  if (module) query.module = module;
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;
  if (filters.search) query.search = filters.search;

  const { data, loading, error, reload } = useApiGet('/accounts/accounting-log/', query);
  const rows = unwrapList(data);
  const total = data?.count || 0;
  const modules = data?.aggregates?.modules || [];
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const chooseModule = (key) => {
    setModule((current) => (current === key ? '' : key));
    setPage(1);
  };

  const applyFilters = (e) => {
    e.preventDefault();
    setFilters(draft);
    setPage(1);
  };

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounting Log"
        subtitle="Every ledger entry posted by payroll, salary advances, incentives, broker commission, expenses and payments in / out, with the document that caused it. Read-only."
      />

      {/* Module tiles double as the filter */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {modules.map((m) => (
          <button
            key={m.module}
            type="button"
            onClick={() => chooseModule(m.module)}
            className={`text-left rounded-xl border p-3 transition cursor-pointer ${
              module === m.module ? 'border-blue-500 ring-2 ring-blue-100 bg-white' : 'border-[#dce5f4] bg-white hover:bg-slate-50'
            }`}
          >
            <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold ${MODULE_TONES[m.module] || ''}`}>
              {m.label}
            </span>
            <p className="text-base font-mono font-bold text-slate-800 mt-1.5">{formatINR(m.netAmount)}</p>
            <p className="text-[11px] text-slate-400">{m.entries} entr{m.entries === 1 ? 'y' : 'ies'} · net on books</p>
          </button>
        ))}
      </div>

      <Card
        title={module ? modules.find((m) => m.module === module)?.label || 'Entries' : 'All entries'}
        subtitle={`${total} entr${total === 1 ? 'y' : 'ies'}${module ? ' · click the tile again to show all' : ''}`}
        actions={
          <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-2">
            <div>
              <label className={labelClass}>From</label>
              <input type="date" className={inputClass} value={draft.dateFrom}
                onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>To</label>
              <input type="date" className={inputClass} value={draft.dateTo}
                onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Entry no. / narration</label>
              <input type="text" className={inputClass} value={draft.search} placeholder="Search…"
                onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
            </div>
            <button type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">
              <Search size={13} /> Apply
            </button>
          </form>
        }
      >
        <ErrorState message={error} onRetry={reload} />
        {loading && !data ? (
          <LoadingState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-[#dce5f4]">
                <tr className="text-left">
                  <th className={thClass} />
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Entry</th>
                  <th className={thClass}>Module</th>
                  <th className={thClass}>Document</th>
                  <th className={thClass}>Narration</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Posted by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f9]">
                {rows.length === 0 ? (
                  <EmptyRow colSpan={9} message="No ledger entries match these filters." />
                ) : (
                  rows.map((row) => {
                    const open = expanded.has(row.id);
                    return (
                      <React.Fragment key={row.id}>
                        <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => toggle(row.id)}>
                          <td className="py-2 px-3 text-slate-400">
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-700">{formatDate(row.entryDate)}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{row.entryNumber}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold ${MODULE_TONES[row.module] || ''}`}>
                              {row.moduleLabel}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-700">{row.documentLabel}</td>
                          <td className="py-2 px-3 text-slate-500 max-w-[280px] truncate" title={row.narration || ''}>
                            {row.narration || '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">{formatINR(row.amount)}</td>
                          <td className="py-2 px-3"><StatusPill row={row} /></td>
                          <td className="py-2 px-3 text-slate-500">{row.postedBy || 'System'}</td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/60">
                            <td />
                            <td colSpan={8} className="py-2 px-3">
                              <EntryLines lines={row.lines || []} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 pt-3 text-xs text-slate-600">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-[#dce5f4] disabled:opacity-40 cursor-pointer">
              Previous
            </button>
            <span>Page {page} of {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-[#dce5f4] disabled:opacity-40 cursor-pointer">
              Next
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
