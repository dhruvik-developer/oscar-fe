import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronDown, ChevronRight, ListChecks, Search, X } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { api } from '../../../services/api';
import { inventoryService } from '../../../services/domainServices';
import { fetchJWOs } from '../../../services/jobWorkSync';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';
import { QcStageFilter, qcStageFromSearch } from './QcStageGate';

/** The chips on top: every lot is in exactly one state. */
const STATES = [
  { id: 'open', label: 'All to do', tone: 'slate' },
  { id: 'waiting', label: 'Waiting for QC', tone: 'amber' },
  { id: 'inspected', label: 'Checked, approval pending', tone: 'blue' },
  { id: 'hold', label: 'Part on hold', tone: 'orange' },
  { id: 'rework', label: 'In rework', tone: 'violet' },
  { id: 'done', label: 'QC done', tone: 'emerald' },
];
const PILL = {
  waiting: 'bg-amber-50 text-amber-800 border-amber-200',
  inspected: 'bg-blue-50 text-blue-800 border-blue-200',
  hold: 'bg-orange-50 text-orange-800 border-orange-200',
  rework: 'bg-violet-50 text-violet-800 border-violet-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};
const DOT = {
  waiting: 'bg-amber-500', inspected: 'bg-blue-500', hold: 'bg-orange-500', rework: 'bg-violet-500', done: 'bg-emerald-500',
};
const ACTION = {
  start: { label: 'Start QC', cls: 'bg-blue-600 hover:bg-blue-700 text-white' },
  finish: { label: 'Finish QC', cls: 'bg-blue-600 hover:bg-blue-700 text-white' },
  recheck: { label: 'Re-check', cls: 'bg-violet-600 hover:bg-violet-700 text-white' },
  view: { label: 'View', cls: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' },
};
/** What happens to each part of the fabric, in plain words. */
const SPLIT = [
  ['goodQty', 'good', 'Good', 'Goes to the godown, ready to use / sell'],
  ['secondQualityQty', 'second', 'Second quality', 'Usable, sold as seconds'],
  ['holdQty', 'hold', 'Keep on hold', 'Not decided yet; stays in QC'],
  ['reprocessQty', 'reprocess', 'Send for rework', 'Needs re-dyeing / repair, then a re-check'],
  ['rejectedQty', 'reject', 'Reject', 'Not usable; return to vendor or scrap'],
];

const daysSince = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : null);

/** Where a lot went after a save, said plainly, with a way to follow it. */
function afterMessage(row) {
  if (!row) return 'Saved.';
  if (row.state === 'done') return `${row.reference}: QC done${row.result ? ` — ${row.result}` : ''}.`;
  if (row.state === 'inspected') return `${row.reference} is saved and now shows as “Checked, approval pending”. Approve it when ready.`;
  if (row.state === 'hold') return `${row.reference}: approved, with part kept on hold. It stays here as “Part on hold” until you decide.`;
  if (row.state === 'rework') return `${row.reference}: part sent for rework. It now shows as “In rework” — re-check it when it comes back.`;
  return `${row.reference}: ${row.stateLabel}.`;
}

function QcForm({ row, onClose, onSaved }) {
  const recheck = row.nextAction === 'recheck';
  const canDraft = recheck || row.kind === 'GRN';
  const toCheck = Number(row.toCheckQty || 0);
  const start = row.draft
    ? Object.fromEntries(SPLIT.map(([key, k]) => [key, row.draft[k] ? String(row.draft[k]) : '']))
    : { goodQty: toCheck ? String(toCheck) : '', secondQualityQty: '', holdQty: '', reprocessQty: '', rejectedQty: '' };
  const [form, setForm] = useState({ ...start, remarks: row.remarks || '', jwoId: '' });
  // Purchased fabric sent for rework goes on a job work order (the dyer who reworks it).
  const needsOrder = row.kind === 'GRN' && !recheck && Number(form.reprocessQty || 0) > 0;
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    if (!needsOrder || orders) return;
    fetchJWOs()
      .then((list) => setOrders(list.filter((o) => !['Completed', 'Closed', 'Cancelled'].includes(o.status))))
      .catch(() => setOrders([]));
  }, [needsOrder, orders]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = SPLIT.reduce((s, [key]) => s + Number(form[key] || 0), 0);
  const matches = !toCheck || Math.abs(total - toCheck) < 0.001;

  const save = async (isDraft) => {
    setSaving(true);
    setError('');
    try {
      const { jwoId, ...rest } = form;
      const body = { ...rest, isDraft, ...(needsOrder ? { jwoId } : {}) };
      if (recheck) await inventoryService.saveQCReinspectionDisposition({ ...body, reprocessId: row.reprocessId });
      else await inventoryService.saveQCDisposition({ ...body, receiptId: row.receiptId });
      onSaved(row.key);
    } catch (err) {
      setError(describeApiError(err) || 'QC could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-900/40 flex justify-end" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="qc-form-title" className="w-full max-w-lg h-full bg-white flex flex-col text-xs">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 id="qc-form-title" className="text-base font-bold text-slate-900">{recheck ? 'Re-check after rework' : 'QC'} — {row.reference}</h3>
            <p className="text-slate-500">{[row.fabric, row.lotNo && `Lot ${row.lotNo}`, row.supplier].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Fabric to check</span>
            <span className="text-lg font-bold tabular-nums">{formatNumberIN(toCheck)} <span className="text-xs font-semibold text-slate-500">{row.uom || 'm'}</span></span>
          </div>
          <p className="text-slate-600">Split the fabric into what you found. The total must match the fabric to check.</p>
          <div className="space-y-2">
            {SPLIT.map(([key, , label, hint]) => (
              <label key={key} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200">
                <span className="flex-1">
                  <span className="block font-semibold text-slate-800">{label}</span>
                  <span className="block text-[11px] text-slate-500">{hint}</span>
                </span>
                <input type="number" min="0" step="any" inputMode="decimal" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  aria-label={label} className="w-28 h-10 px-3 rounded-lg border border-slate-200 text-right text-sm font-semibold tabular-nums focus:outline-none focus:border-blue-500" />
              </label>
            ))}
          </div>
          <div className={`p-2.5 rounded-lg text-xs font-semibold ${matches ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            Total {formatNumberIN(total)} of {formatNumberIN(toCheck)} {row.uom || 'm'}
            {!matches && ` — ${formatNumberIN(Math.abs(toCheck - total))} ${total < toCheck ? 'still to split' : 'too much'}`}
          </div>
          {needsOrder && (
            <label className="block p-3 rounded-xl bg-violet-50 border border-violet-200">
              <span className="block font-semibold text-violet-900 mb-1">Rework goes to which job work order? *</span>
              <select value={form.jwoId} onChange={(e) => setForm({ ...form, jwoId: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-violet-200 bg-white">
                <option value="">{orders ? 'Choose the dyer / job work order' : 'Loading…'}</option>
                {(orders || []).map((o) => <option key={o.id} value={o.id}>{[o.jwoNo, o.process, o.vendor].filter(Boolean).join(' · ')}</option>)}
              </select>
              {orders && orders.length === 0 && (
                <span className="block mt-1 text-[11px] text-violet-800">No open job work order. <Link to="/job-work/orders" className="font-semibold underline">Create one</Link>, then come back.</span>
              )}
            </label>
          )}
          <label className="block">
            <span className="block font-semibold text-slate-700 mb-1">Remarks / defects found</span>
            <textarea rows={3} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500" placeholder="e.g. holes in 2 rolls, shade variation" />
          </label>
          {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex flex-wrap justify-end gap-2">
          {canDraft && (
            <button type="button" disabled={saving} onClick={() => save(true)} className="h-10 px-4 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
              Save, approve later
            </button>
          )}
          <button type="button" disabled={saving || !matches || total <= 0 || (needsOrder && !form.jwoId)} onClick={() => save(false)} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 cursor-pointer">
            {saving ? 'Saving…' : 'Approve QC'}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

/**
 * QC Work: one list of every lot to QC. A lot never leaves the list when its
 * QC moves on -- its status changes and the button shows the next step.
 */
export default function QCWorkPage() {
  const [params, setParams] = useSearchParams();
  const stage = qcStageFromSearch(`?${params.toString()}`);
  const chip = STATES.some((s) => s.id === params.get('show')) ? params.get('show') : 'open';
  const [data, setData] = useState({ results: [], counts: {}, doneDays: 30 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null); // row in the QC form
  const [expanded, setExpanded] = useState(null);
  const [notice, setNotice] = useState(null); // { text, state, key }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/qc/work/', { query: stage === 'all' ? {} : { stage } });
      setData({ results: res?.results || [], counts: res?.counts || {}, doneDays: res?.doneDays || 30 });
      setError('');
      return res?.results || [];
    } catch (err) {
      setError(describeApiError(err) || 'The QC list could not be loaded.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [stage]);
  useEffect(() => { load(); }, [load]);

  const showChip = (id) => {
    const next = new URLSearchParams(params);
    if (id === 'open') next.delete('show'); else next.set('show', id);
    setParams(next, { replace: true });
  };

  const counts = data.counts || {};
  const openCount = ['waiting', 'inspected', 'hold', 'rework'].reduce((s, k) => s + (counts[k] || 0), 0);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.results.filter((r) => (chip === 'open' ? r.state !== 'done' : r.state === chip))
      .filter((r) => !needle || [r.reference, r.lotNo, r.fabric, r.supplier].some((v) => String(v || '').toLowerCase().includes(needle)));
  }, [data.results, chip, q]);

  const onSaved = async (key) => {
    setOpen(null);
    const fresh = await load();
    const row = fresh.find((r) => r.key === key);
    setNotice({ text: afterMessage(row), state: row?.state, key });
    setExpanded(key);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="QC Work"
        subtitle="Every lot that needs quality check. A lot stays on this list — only its status changes. Click the button on a row to do its next step."
        breadcrumb={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Inventory', path: '/inventory' }, { label: 'QC Work' }]}
        actions={<Link to="/inventory/qc/advanced" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5"><ListChecks size={14} /> Detailed QC screens</Link>}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <QcStageFilter />
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="QC status">
          {STATES.map((s) => {
            const n = s.id === 'open' ? openCount : counts[s.id] || 0;
            const active = chip === s.id;
            return (
              <button key={s.id} type="button" role="tab" aria-selected={active} onClick={() => showChip(s.id)}
                className={`h-9 px-3 rounded-full border text-xs font-semibold inline-flex items-center gap-2 cursor-pointer ${active ? 'bg-slate-900 text-white border-slate-900' : `bg-white text-slate-700 border-slate-200 hover:border-slate-300`}`}>
                {s.id !== 'open' && <span className={`w-2 h-2 rounded-full ${DOT[s.id]}`} />}
                {s.label}{s.id === 'done' ? ` (last ${data.doneDays} days)` : ''}
                <span className={`px-1.5 rounded-full text-[10px] ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GRN / inward no., lot, fabric, supplier" className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      {notice && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex flex-wrap items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span className="flex-1">{notice.text}</span>
          {notice.state && notice.state !== chip && (chip !== 'open' || notice.state === 'done') && (
            <button type="button" onClick={() => showChip(notice.state)} className="h-8 px-3 rounded-lg bg-white border border-emerald-300 font-semibold cursor-pointer">Show it</button>
          )}
          {notice.state === 'inspected' && (
            <button type="button" onClick={() => { const r = data.results.find((x) => x.key === notice.key); if (r) setOpen(r); }} className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer">Approve now</button>
          )}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="p-1 rounded hover:bg-emerald-100 cursor-pointer"><X size={14} /></button>
        </div>
      )}
      {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5 w-8"><span className="sr-only">Details</span></th>
                <th className="px-3 py-2.5 text-left">Received on / lot</th>
                <th className="px-3 py-2.5 text-left">Fabric</th>
                <th className="px-3 py-2.5 text-left">From</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-right">Next step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">{chip === 'open' ? 'Nothing waiting for QC. 🎉' : 'No lots in this status.'}</td></tr>
              )}
              {!loading && rows.map((r) => {
                const isOpen = expanded === r.key;
                const days = daysSince(r.date);
                const act = ACTION[r.nextAction];
                return (
                  <React.Fragment key={r.key}>
                    <tr className={`${notice?.key === r.key ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => setExpanded(isOpen ? null : r.key)} aria-expanded={isOpen} aria-label={`History of ${r.reference}`} className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-mono font-semibold text-slate-800">{r.reference}</div>
                        <div className="text-[10px] text-slate-400">{[r.lotNo && `Lot ${r.lotNo}`, r.kind === 'JOB_WORK' ? 'Back from job work' : r.kind === 'REWORK' ? 'Rework' : 'Purchase'].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{r.fabric || '—'}</td>
                      <td className="px-3 py-3 text-slate-600">{r.supplier || '—'}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.state === 'done' ? formatNumberIN(r.receivedQty) : formatNumberIN(r.toCheckQty)} <span className="text-slate-400">{r.uom || 'm'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${PILL[r.state]}`}>{r.stateLabel}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {r.state === 'done' ? r.result : days != null ? `${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'}`} since received` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button type="button" onClick={() => (r.nextAction === 'view' ? setExpanded(isOpen ? null : r.key) : setOpen(r))} className={`h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer ${act.cls}`}>
                          {act.label}{r.nextAction !== 'view' && ' ▸'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50/60">
                        <td />
                        <td colSpan={6} className="px-3 py-3">
                          <ol className="relative border-l border-slate-200 ml-1 space-y-2">
                            {(r.timeline || []).map((e, i) => (
                              <li key={i} className="ml-4">
                                <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-blue-500 ring-2 ring-white" />
                                <span className="font-semibold text-slate-800">{e.label}</span>
                                <span className="text-slate-400"> · {e.date || '—'}{e.by ? ` · ${e.by}` : ''}</span>
                                {e.detail && <div className="text-slate-500">{e.detail}</div>}
                              </li>
                            ))}
                            <li className="ml-4">
                              <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-slate-300 ring-2 ring-white" />
                              <span className="text-slate-500">Now: <span className="font-semibold text-slate-700">{r.stateLabel}</span>{r.nextAction !== 'view' ? ` — next: ${act.label}` : ''}</span>
                            </li>
                          </ol>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open && <QcForm row={open} onClose={() => setOpen(null)} onSaved={onSaved} />}
    </div>
  );
}
