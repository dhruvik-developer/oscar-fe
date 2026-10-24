import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, RotateCcw, Search } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { PageHeader } from '../../components/common/PageHeader';
import MasterSourceLink, { useMasterDataRefresh } from '../../components/common/MasterSourceLink';
import {
  Card,
  EmptyRow,
  ErrorState,
  Kpi,
  LoadingState,
  TabBar,
  describeApiError,
  fetchAllPages,
  formatDate,
  formatINR,
  inputClass,
  labelClass,
  thClass,
  toPaise,
  todayISO,
  unwrapList,
} from './accountingShared';

const generalLedgerGuide = {
  title: 'General Ledger & Journal Entries',
  subtitle: 'Double-entry journal vouchers, account ledgers and trial balance',
  purpose:
    'Every debit and credit posted across the business. Sales invoices, purchase bills, payments and stock documents post balanced journal entries automatically; manual vouchers are posted here.',
  workflow: ['Operational transaction occurs', 'Server posts a balanced entry (Dr = Cr)', 'Ledger balances update', 'Trial balance stays balanced'],
  keyTerms: [
    { term: 'Double-Entry Accounting', definition: 'Every entry has equal and opposite Debit (Dr) and Credit (Cr) lines.' },
    { term: 'Reversal', definition: 'Journal entries are never deleted; a reversal posts the mirror entry and marks the original Reversed.' },
  ],
  tips: ['System entries are reversed by cancelling their source document, not from this screen.'],
};

const PAGE_SIZE = 25;
const TABS = [
  { id: 'journal', label: 'Journal Entries' },
  { id: 'ledger', label: 'Account Ledger' },
  { id: 'trial', label: 'Trial Balance' },
];

const emptyLine = () => ({ accountId: '', debit: '', credit: '', description: '' });

function accountLabel(a) {
  return `${a.code ? `${a.code} - ` : ''}${a.name}`;
}

function statusClass(status) {
  if (status === 'Reversed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'Draft') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

/* ───────────────────────── Journal tab ───────────────────────── */
function JournalTab({ accounts, accountsError, onPosted }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reversingId, setReversingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/accounts/journal/', {
        query: { page, page_size: PAGE_SIZE, search: appliedSearch, date_from: dateFrom, date_to: dateTo },
      });
      setData(res);
    } catch (err) {
      setData(null);
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = unwrapList(data);
  const aggregates = data?.aggregates || {};

  const handleReverse = async (entry) => {
    if (!window.confirm(`Post a reversing entry for ${entry.entryNumber}? The original will be marked Reversed.`)) return;
    setReversingId(entry.id);
    setActionError('');
    try {
      await api.post(`/accounts/journal/${entry.id}/reverse/`, {});
      await load();
      onPosted?.();
    } catch (err) {
      setActionError(`Reversal failed — ${describeApiError(err)}`);
    } finally {
      setReversingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Total Debits (Dr)" value={data ? formatINR(aggregates.debit) : '—'} tone="text-blue-800" note="Across the filtered entries" />
        <Kpi label="Total Credits (Cr)" value={data ? formatINR(aggregates.credit) : '—'} tone="text-emerald-800" note="Across the filtered entries" />
        <Kpi label="Entries" value={data ? String(data.count ?? 0) : '—'} />
      </div>

      <Card
        title="Journal Entries"
        subtitle="Posted vouchers with their debit and credit lines, as recorded on the server."
        actions={<Button icon={Plus} onClick={() => setShowForm(true)}>New Journal Voucher</Button>}
      >
        <form
          className="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px_auto] gap-3 items-end mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(search.trim());
          }}
        >
          <div>
            <label className={labelClass}>Search entry no. / narration</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass} placeholder="e.g. JV-0001" />
          </div>
          <div>
            <label className={labelClass}>From</label>
            <input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>To</label>
            <input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} className={inputClass} />
          </div>
          <Button type="submit" variant="outline" icon={Search}>Search</Button>
        </form>

        <div className="space-y-3">
          <ErrorState message={error} onRetry={load} />
          <ErrorState message={actionError} />
        </div>

        {loading ? (
          <LoadingState label="Loading journal entries…" />
        ) : !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-[#dce5f4]">
                <tr>
                  <th className={thClass}>Entry / Account</th>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Narration</th>
                  <th className={`${thClass} text-right`}>Debit</th>
                  <th className={`${thClass} text-right`}>Credit</th>
                  <th className={`${thClass} text-center`}>Status</th>
                  <th className={`${thClass} text-right`}>Action</th>
                </tr>
              </thead>
              {entries.length === 0 ? (
                <tbody><EmptyRow colSpan={7} message="No journal entries found for these filters." /></tbody>
              ) : entries.map((entry) => {
                const lines = entry.lines || [];
                const dr = lines.reduce((s, l) => s + toPaise(l.debit), 0) / 100;
                const cr = lines.reduce((s, l) => s + toPaise(l.credit), 0) / 100;
                const canReverse = !entry.isSystem && entry.status === 'Posted' && !entry.reversalOf;
                return (
                  <tbody key={entry.id} className="border-b border-[#dce5f4]">
                    <tr className="bg-slate-50/60">
                      <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {entry.entryNumber}
                        {entry.isSystem && <span className="ml-2 text-[10px] font-semibold text-slate-400">SYSTEM</span>}
                        {entry.sourceDocumentType && <span className="block text-[10px] font-normal text-slate-400">{entry.sourceDocumentType}</span>}
                      </td>
                      <td className="py-2 px-3 font-mono whitespace-nowrap">{formatDate(entry.entryDate)}</td>
                      <td className="py-2 px-3 text-slate-700">{entry.narration || '—'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{formatINR(dr)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{formatINR(cr)}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusClass(entry.status)}`}>{entry.status}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {canReverse && (
                          <button
                            type="button"
                            disabled={reversingId === entry.id}
                            onClick={() => handleReverse(entry)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline disabled:opacity-50 cursor-pointer"
                          >
                            <RotateCcw size={12} /> {reversingId === entry.id ? 'Reversing…' : 'Reverse'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td className="py-1.5 px-3 pl-8 text-slate-700" colSpan={2}>
                          {line.accountCode ? `${line.accountCode} - ` : ''}{line.accountName}
                          {line.partyName && <span className="text-slate-400"> · {line.partyName}</span>}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500">{line.description || ''}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-blue-700">{Number(line.debit) ? formatINR(line.debit) : ''}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-emerald-700">{Number(line.credit) ? formatINR(line.credit) : ''}</td>
                        <td colSpan={2} />
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}

        {data && (data.count ?? 0) > PAGE_SIZE && (
          <div className="mt-3">
            <Pagination total={data.count} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        )}
      </Card>

      <JournalForm
        isOpen={showForm}
        accounts={accounts}
        accountsError={accountsError}
        onClose={() => setShowForm(false)}
        onPosted={async () => {
          setShowForm(false);
          setPage(1);
          await load();
          onPosted?.();
        }}
      />
    </div>
  );
}

/* ───────────────────────── Manual voucher form ───────────────────────── */
function JournalForm({ isOpen, accounts, accountsError, onClose, onPosted }) {
  const [entryDate, setEntryDate] = useState(todayISO());
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setEntryDate(todayISO());
    setNarration('');
    setLines([emptyLine(), emptyLine()]);
    setError('');
  };

  const totalDr = lines.reduce((s, l) => s + toPaise(l.debit), 0);
  const totalCr = lines.reduce((s, l) => s + toPaise(l.credit), 0);
  const balanced = totalDr === totalCr && totalDr > 0;

  const updateLine = (idx, patch) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const validate = () => {
    if (!entryDate) return 'Entry date is required.';
    if (lines.length < 2) return 'A journal entry needs at least two lines.';
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      const dr = toPaise(l.debit);
      const cr = toPaise(l.credit);
      if (!l.accountId) return `Line ${i + 1}: select an account.`;
      if (dr < 0 || cr < 0) return `Line ${i + 1}: amounts cannot be negative.`;
      if ((dr > 0) === (cr > 0)) return `Line ${i + 1}: enter either a debit or a credit amount.`;
    }
    if (totalDr <= 0) return 'Total debit must be greater than zero.';
    if (totalDr !== totalCr) return `Entry does not balance: debits ${formatINR(totalDr / 100)} vs credits ${formatINR(totalCr / 100)}.`;
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/accounts/journal/', {
        entryDate,
        narration: narration.trim() || null,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: toPaise(l.debit) / 100,
          credit: toPaise(l.credit) / 100,
          description: l.description.trim() || null,
        })),
      });
      reset();
      await onPosted();
    } catch (err) {
      // Keep the form open with what the user typed -- nothing is shown as posted.
      setError(describeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title="New Journal Voucher"
      subtitle="Balanced debit and credit lines. The entry number is assigned by the server."
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <ErrorState message={accountsError ? `Accounts could not be loaded — ${accountsError}` : ''} />
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
          <div>
            <label className={labelClass}>Entry Date *</label>
            <input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Narration</label>
            <input value={narration} onChange={(e) => setNarration(e.target.value)} className={inputClass} placeholder="What this voucher records" />
          </div>
        </div>

        <div className="overflow-x-auto border border-[#dce5f4] rounded-xl">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-slate-50 border-b border-[#dce5f4]">
              <tr>
                <th className={thClass}>
                  <span className="flex items-center justify-between gap-2">
                    Account *
                    <MasterSourceLink source="ledgerAccounts" className="normal-case tracking-normal" />
                  </span>
                </th>
                <th className={thClass}>Line note</th>
                <th className={`${thClass} text-right w-32`}>Debit (₹)</th>
                <th className={`${thClass} text-right w-32`}>Credit (₹)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="p-2">
                    <select value={line.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })} className={inputClass}>
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{accountLabel(a)} ({a.type})</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })} className={inputClass} />
                  </td>
                  <td className="p-2">
                    <input type="number" min="0" step="0.01" value={line.debit} onChange={(e) => updateLine(idx, { debit: e.target.value })} className={`${inputClass} text-right font-mono`} />
                  </td>
                  <td className="p-2">
                    <input type="number" min="0" step="0.01" value={line.credit} onChange={(e) => updateLine(idx, { credit: e.target.value })} className={`${inputClass} text-right font-mono`} />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      disabled={lines.length <= 2}
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                      aria-label="Remove line"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-[#dce5f4]">
              <tr>
                <td className="p-2" colSpan={2}>
                  <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer">
                    <Plus size={12} /> Add line
                  </button>
                </td>
                <td className="p-2 text-right font-mono font-bold text-slate-800">{formatINR(totalDr / 100)}</td>
                <td className="p-2 text-right font-mono font-bold text-slate-800">{formatINR(totalCr / 100)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className={`text-[11px] font-semibold ${balanced ? 'text-emerald-700' : 'text-amber-700'}`}>
          {balanced ? 'Debits equal credits.' : `Difference: ${formatINR(Math.abs(totalDr - totalCr) / 100)} — debits must equal credits and be greater than zero.`}
        </p>

        <ErrorState message={error} />

        <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-[#dce5f4]">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || !balanced}>{saving ? 'Posting…' : 'Post Journal Entry'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── Account ledger tab ───────────────────────── */
function LedgerTab({ accounts, accountsError }) {
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/accounts/ledger/${accountId}/`, { query: { date_from: dateFrom, date_to: dateTo } });
      setLedger(res);
    } catch (err) {
      setLedger(null);
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, [accountId, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = ledger?.entries || [];

  return (
    <Card title="Account Ledger" subtitle="Opening balance, every posted line and the running balance for one account.">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px] gap-3 mb-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className={labelClass}>Account</label>
            <MasterSourceLink source="ledgerAccounts" />
          </div>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
            <option value="">Select account…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="space-y-3">
        <ErrorState message={accountsError ? `Accounts could not be loaded — ${accountsError}` : ''} />
        <ErrorState message={error} onRetry={load} />
      </div>
      {!accountId ? (
        <p className="py-6 text-center text-xs text-slate-400">Select an account to view its ledger.</p>
      ) : loading ? (
        <LoadingState label="Loading ledger…" />
      ) : ledger && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-[#dce5f4]">
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Entry</th>
                <th className={thClass}>Narration</th>
                <th className={`${thClass} text-right`}>Debit</th>
                <th className={`${thClass} text-right`}>Credit</th>
                <th className={`${thClass} text-right`}>Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/60 font-semibold">
                <td className="py-2 px-3" colSpan={5}>Opening balance</td>
                <td className="py-2 px-3 text-right font-mono">{formatINR(ledger.openingBalance)}</td>
              </tr>
              {entries.length === 0 && <EmptyRow colSpan={6} message="No postings in this period." />}
              {entries.map((row, idx) => (
                <tr key={`${row.entryNumber}-${idx}`} className="hover:bg-slate-50">
                  <td className="py-1.5 px-3 font-mono whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="py-1.5 px-3 font-mono text-slate-800">{row.entryNumber}</td>
                  <td className="py-1.5 px-3">{row.narration || '—'}{row.party && <span className="text-slate-400"> · {row.party}</span>}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-blue-700">{Number(row.debit) ? formatINR(row.debit) : ''}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-emerald-700">{Number(row.credit) ? formatINR(row.credit) : ''}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-800">{formatINR(row.balance)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold border-t-2 border-[#dce5f4]">
                <td className="py-2 px-3" colSpan={5}>Closing balance</td>
                <td className="py-2 px-3 text-right font-mono">{formatINR(ledger.closingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Trial balance tab ───────────────────────── */
function TrialBalanceTab({ refreshKey }) {
  const [asOf, setAsOf] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.get('/accounts/reports/trial-balance/', { query: { asOf } }));
    } catch (err) {
      setData(null);
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const rows = unwrapList(data);
  const agg = data?.aggregates || {};

  return (
    <Card
      title="Trial Balance"
      subtitle="Debit and credit totals per account from posted, un-reversed journal lines."
      actions={
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-600">As of</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={`${inputClass} w-40`} />
        </div>
      }
    >
      <ErrorState message={error} onRetry={load} />
      {loading ? (
        <LoadingState label="Loading trial balance…" />
      ) : !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-[#dce5f4]">
              <tr>
                <th className={thClass}>Account</th>
                <th className={thClass}>Type</th>
                <th className={`${thClass} text-right`}>Debit</th>
                <th className={`${thClass} text-right`}>Credit</th>
                <th className={`${thClass} text-right`}>Net (Dr − Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && <EmptyRow colSpan={5} message="No postings up to this date." />}
              {rows.map((r) => (
                <tr key={r.accountId} className="hover:bg-slate-50">
                  <td className="py-1.5 px-3 text-slate-800">{r.code ? `${r.code} - ` : ''}{r.name}</td>
                  <td className="py-1.5 px-3">{r.type}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{formatINR(r.debit)}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{formatINR(r.credit)}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-800">{formatINR(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-[#dce5f4]">
                  <td className="py-2 px-3" colSpan={2}>Total</td>
                  <td className="py-2 px-3 text-right font-mono">{formatINR(agg.totalDebit)}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatINR(agg.totalCredit)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Page ───────────────────────── */
export const GeneralLedgerPage = () => {
  const [tab, setTab] = useState('journal');
  const [accounts, setAccounts] = useState([]);
  const [accountsError, setAccountsError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [accountsReload, setAccountsReload] = useState(0);

  // Reload the account pickers after accounts are edited from the "+ Add / Manage" popup.
  const reloadAccounts = useCallback(() => setAccountsReload((k) => k + 1), []);
  useMasterDataRefresh(reloadAccounts, ['ledgerAccounts']);

  useEffect(() => {
    let live = true;
    fetchAllPages(api, '/accounts/chart-of-accounts/')
      .then((rows) => {
        if (!live) return;
        setAccounts(rows);
        setAccountsError('');
      })
      .catch((err) => {
        if (live) setAccountsError(describeApiError(err));
      });
    return () => {
      live = false;
    };
  }, [accountsReload]);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive !== false), [accounts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="General Ledger & Journal Entries"
        subtitle="Double-entry journal vouchers, account ledgers and the trial balance — straight from the server ledger."
        guide={generalLedgerGuide}
      />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'journal' && (
        <JournalTab accounts={activeAccounts} accountsError={accountsError} onPosted={() => setRefreshKey((k) => k + 1)} />
      )}
      {tab === 'ledger' && <LedgerTab accounts={accounts} accountsError={accountsError} />}
      {tab === 'trial' && <TrialBalanceTab refreshKey={refreshKey} />}
    </div>
  );
};

export default GeneralLedgerPage;
