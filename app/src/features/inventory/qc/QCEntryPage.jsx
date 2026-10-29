import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Search, X } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { api } from '../../../services/api';
import { inventoryService } from '../../../services/domainServices';
import { fetchJWOs } from '../../../services/jobWorkSync';
import { useERP } from '../../../context/ERPContext';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';
import { QcStageFilter, qcStageFromSearch } from './QcStageGate';

/** The five results of the requirement (PDF §08), with their colour. */
const RESULTS = [
  { id: 'Pass', short: 'Pass', on: 'bg-emerald-600 text-white border-emerald-600', off: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  { id: 'Second Quality', short: '2nd', on: 'bg-sky-600 text-white border-sky-600', off: 'text-sky-700 border-sky-200 hover:bg-sky-50' },
  { id: 'Hold', short: 'Hold', on: 'bg-amber-500 text-white border-amber-500', off: 'text-amber-700 border-amber-200 hover:bg-amber-50' },
  { id: 'Reprocess', short: 'Reprocess', on: 'bg-violet-600 text-white border-violet-600', off: 'text-violet-700 border-violet-200 hover:bg-violet-50' },
  { id: 'Reject', short: 'Reject', on: 'bg-rose-600 text-white border-rose-600', off: 'text-rose-700 border-rose-200 hover:bg-rose-50' },
];
const cell = 'w-full h-8 px-2 rounded-md border border-slate-200 text-right tabular-nums focus:outline-none focus:border-blue-500';
const daysAgo = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);

/** A roll's entry: what the checker types, prefilled from the draft or the book values. */
const entryFor = (roll) => ({
  actualMeter: roll.saved?.actualMeter ?? roll.bookMeter,
  weightKg: roll.saved?.weightKg ?? roll.weightKg ?? '',
  width: roll.saved?.width ?? roll.width ?? '',
  gsm: roll.saved?.gsm ?? roll.gsm ?? '',
  result: roll.saved?.result || '',
  remarks: roll.saved?.remarks || '',
  defects: roll.saved?.defects || [],
});

function DefectPicker({ defects, value, onChange, onClose }) {
  const counts = Object.fromEntries(value.map((d) => [d.defectId, d.count]));
  const set = (id, count) => onChange(Object.entries({ ...counts, [id]: count }).filter(([, c]) => c > 0).map(([defectId, c]) => ({ defectId, count: c })));
  return (
    <div className="absolute z-20 right-0 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-2 text-xs">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="font-semibold text-slate-700">Defects found</span>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-slate-100 cursor-pointer"><X size={12} /></button>
      </div>
      {defects.length === 0 && (
        <p className="p-2 text-slate-500">No defects in the master. <Link to="/inventory/masters/textile?tab=defects" className="font-semibold text-blue-700 underline">Add defects</Link></p>
      )}
      {defects.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 px-1 py-1 rounded hover:bg-slate-50">
          <label className="flex items-center gap-2 cursor-pointer flex-1">
            <input type="checkbox" checked={Boolean(counts[d.id])} onChange={(e) => set(d.id, e.target.checked ? 1 : 0)} />
            <span>{d.name}</span><span className="text-[10px] text-slate-400">{d.severity}</span>
          </label>
          {counts[d.id] > 0 && (
            <input type="number" min="1" value={counts[d.id]} onChange={(e) => set(d.id, Math.max(1, Number(e.target.value) || 1))} aria-label={`${d.name} count`} className="w-12 h-7 px-1 rounded border border-slate-200 text-right" />
          )}
        </div>
      ))}
    </div>
  );
}

function LotQc({ lotKey, defects, godowns, onDone }) {
  const [detail, setDetail] = useState(null);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null);
  const [locationId, setLocationId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [jwoId, setJwoId] = useState('');
  const [orders, setOrders] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/inventory/qc/entry/', { query: { key: lotKey } });
      setDetail(res);
      setEntries(Object.fromEntries(res.rolls.map((r) => [r.lotTakaId, entryFor(r)])));
    } catch (err) {
      setError(describeApiError(err) || 'The lot could not be loaded.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [lotKey]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!locationId && godowns.length) setLocationId(godowns[0].id); }, [godowns, locationId]);

  const rolls = useMemo(() => detail?.rolls || [], [detail]);
  const set = (id, patch) => setEntries((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const summary = useMemo(() => {
    const s = { rolls: 0, undecided: 0, short: 0 };
    RESULTS.forEach((r) => { s[r.id] = 0; });
    rolls.forEach((roll) => {
      const e = entries[roll.lotTakaId];
      if (!e?.result) { s.undecided += 1; return; }
      const book = Number(roll.bookMeter);
      const actual = Math.min(Number(e.actualMeter || book), book);
      s.rolls += 1;
      s[e.result] += actual;
      s.short += Math.max(0, book - actual);
    });
    return s;
  }, [rolls, entries]);
  const showOrder = detail?.lot?.sourceType === 'GRN' && summary.Reprocess > 0;
  useEffect(() => {
    if (!showOrder || orders) return;
    fetchJWOs().then((list) => setOrders(list.filter((o) => !['Completed', 'Closed', 'Cancelled'].includes(o.status)))).catch(() => setOrders([]));
  }, [showOrder, orders]);

  const save = async (approve) => {
    setSaving(true);
    setError('');
    try {
      const checked = rolls.filter((r) => entries[r.lotTakaId]?.result).map((r) => ({ lotTakaId: r.lotTakaId, ...entries[r.lotTakaId] }));
      const res = await api.post('/inventory/qc/entry/', {
        key: lotKey, rolls: checked, approve, locationId: locationId || undefined, remarks: remarks || undefined,
        jwoId: showOrder && jwoId ? jwoId : undefined,
      });
      onDone(res, detail.lot);
      if (!approve) await load();
    } catch (err) {
      setError(describeApiError(err) || 'QC could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-slate-400">Loading rolls…</div>;
  if (!detail) return <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>;
  const lot = detail.lot;

  return (
    <div className="space-y-3 text-xs">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">{lot.reference} <span className="text-xs font-semibold text-slate-500">· {lot.sourceLabel}</span></h3>
            <p className="text-slate-500">{[lot.fabric, lot.supplier, `Lot ${lot.lots.join(', ')}`, lot.batches.length && `Batch ${lot.batches.join(', ')}`].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-900">{lot.rolls} rolls · {formatNumberIN(lot.meters)} m</div>
            {detail.draftNumber && <div className="text-[11px] text-blue-700">Draft {detail.draftNumber} saved — continue where you left</div>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-slate-500">Quick:</span>
          {RESULTS.filter((r) => ['Pass', 'Hold'].includes(r.id)).map((r) => (
            <button key={r.id} type="button" onClick={() => setEntries((prev) => Object.fromEntries(Object.entries(prev).map(([k, e]) => [k, e.result ? e : { ...e, result: r.id }])))} className={`h-7 px-2.5 rounded-md border font-semibold cursor-pointer ${r.off}`}>
              Mark the rest {r.short}
            </button>
          ))}
          <span className="text-[11px] text-slate-400">Only rolls without a result are changed.</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">Roll / taka</th>
                <th className="px-2 py-2 text-right">Book m</th>
                <th className="px-2 py-2 text-right w-24">Actual m</th>
                <th className="px-2 py-2 text-right w-20">KG</th>
                <th className="px-2 py-2 text-right w-20">Width</th>
                <th className="px-2 py-2 text-right w-20">GSM</th>
                <th className="px-2 py-2 text-left">Defects</th>
                <th className="px-2 py-2 text-left">Result</th>
                <th className="px-2 py-2 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rolls.map((roll) => {
                const e = entries[roll.lotTakaId] || {};
                const short = Math.max(0, Number(roll.bookMeter) - Number(e.actualMeter || roll.bookMeter));
                const chosen = (e.defects || []).map((d) => defects.find((x) => String(x.id) === String(d.defectId))).filter(Boolean);
                return (
                  <tr key={roll.lotTakaId} className={e.result ? '' : 'bg-amber-50/30'}>
                    <td className="px-2 py-2">
                      <div className="font-mono font-semibold text-slate-800">{roll.takaId}</div>
                      <div className="text-[10px] text-slate-400">Lot {roll.lotNumber} / {roll.takaNumber}{roll.qcStatus === 'On Hold' ? ' · was on hold' : ''}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatNumberIN(roll.bookMeter)}</td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" step="any" value={e.actualMeter} onChange={(ev) => set(roll.lotTakaId, { actualMeter: ev.target.value })} aria-label={`Actual meter of ${roll.takaId}`} className={cell} />
                      {short > 0 && <div className="text-[10px] text-rose-600 text-right">{formatNumberIN(short)} short</div>}
                    </td>
                    <td className="px-2 py-2"><input type="number" min="0" step="any" value={e.weightKg} onChange={(ev) => set(roll.lotTakaId, { weightKg: ev.target.value })} aria-label={`Weight of ${roll.takaId}`} className={cell} /></td>
                    <td className="px-2 py-2"><input type="number" min="0" step="any" value={e.width} onChange={(ev) => set(roll.lotTakaId, { width: ev.target.value })} aria-label={`Width of ${roll.takaId}`} className={cell} /></td>
                    <td className="px-2 py-2"><input type="number" min="0" step="any" value={e.gsm} onChange={(ev) => set(roll.lotTakaId, { gsm: ev.target.value })} aria-label={`GSM of ${roll.takaId}`} className={cell} /></td>
                    <td className="px-2 py-2 relative">
                      <button type="button" onClick={() => setPicker(picker === roll.lotTakaId ? null : roll.lotTakaId)} className="min-h-8 px-2 rounded-md border border-slate-200 text-left hover:bg-slate-50 cursor-pointer max-w-44">
                        {chosen.length ? chosen.map((d) => `${d.name}${(e.defects.find((x) => String(x.defectId) === String(d.id))?.count || 1) > 1 ? ` ×${e.defects.find((x) => String(x.defectId) === String(d.id)).count}` : ''}`).join(', ') : <span className="text-slate-400">+ Add</span>}
                      </button>
                      {picker === roll.lotTakaId && (
                        <DefectPicker defects={defects} value={e.defects || []} onChange={(v) => set(roll.lotTakaId, { defects: v })} onClose={() => setPicker(null)} />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1" role="radiogroup" aria-label={`Result of ${roll.takaId}`}>
                        {RESULTS.map((r) => (
                          <button key={r.id} type="button" role="radio" aria-checked={e.result === r.id} onClick={() => set(roll.lotTakaId, { result: r.id })} className={`h-8 px-2 rounded-md border text-[11px] font-semibold cursor-pointer ${e.result === r.id ? r.on : `bg-white ${r.off}`}`}>
                            {r.short}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2"><input value={e.remarks} onChange={(ev) => set(roll.lotTakaId, { remarks: ev.target.value })} aria-label={`Remarks of ${roll.takaId}`} placeholder="e.g. shade off" className="w-full h-8 px-2 rounded-md border border-slate-200" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {RESULTS.map((r) => (
            <span key={r.id} className={`px-2.5 py-1 rounded-full border font-semibold ${summary[r.id] > 0 ? r.on : 'bg-white text-slate-400 border-slate-200'}`}>{r.id}: {formatNumberIN(summary[r.id])} m</span>
          ))}
          {summary.short > 0 && <span className="px-2.5 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 font-semibold">Short meter (loss): {formatNumberIN(summary.short)} m</span>}
          {summary.undecided > 0 && <span className="px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-800 font-semibold">{summary.undecided} roll(s) without a result stay waiting</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="block"><span className="block font-semibold text-slate-600 mb-1">Passed fabric goes to</span>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-slate-200">
              {godowns.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select></label>
          <label className="block sm:col-span-2"><span className="block font-semibold text-slate-600 mb-1">Overall remarks</span>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200" placeholder="Checked under daylight, etc." /></label>
          {showOrder && (
            <label className="block sm:col-span-3 p-2.5 rounded-lg bg-violet-50 border border-violet-200">
              <span className="block font-semibold text-violet-900 mb-1">Reprocess order on which job work order? (optional — you can also send it later from the Reprocess screen)</span>
              <select value={jwoId} onChange={(e) => setJwoId(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-violet-200 bg-white">
                <option value="">Decide later</option>
                {(orders || []).map((o) => <option key={o.id} value={o.id}>{[o.jwoNo, o.process, o.vendor].filter(Boolean).join(' · ')}</option>)}
              </select>
            </label>
          )}
        </div>
        {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={saving || summary.rolls === 0} onClick={() => save(false)} className="h-10 px-4 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">Save draft</button>
          <button type="button" disabled={saving || summary.rolls === 0} onClick={() => save(true)} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 cursor-pointer">
            {saving ? 'Saving…' : `Approve QC for ${summary.rolls} roll${summary.rolls === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * QC Entry (PDF §08): lots waiting at QC Hold on the left; the chosen lot's
 * rolls on the right -- actual meter, kg, width, GSM, defects and one result
 * per roll. Approve moves every checked roll; the rest stay waiting.
 */
export default function QCEntryPage() {
  const { locations = [] } = useERP() || {};
  const godowns = useMemo(() => locations.filter((l) => !String(l.code || '').startsWith('SYS-') && l.isActive !== false), [locations]);
  const [params, setParams] = useSearchParams();
  const stage = qcStageFromSearch(`?${params.toString()}`);
  const selected = params.get('lot');
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [defects, setDefects] = useState([]);
  const [notice, setNotice] = useState(null);
  const [version, setVersion] = useState(0);

  const loadLots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/qc/entry/', { query: stage === 'all' ? {} : { stage } });
      setLots(res?.results || []);
      setError('');
      return res?.results || [];
    } catch (err) {
      setError(describeApiError(err) || 'Lots waiting for QC could not be loaded.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [stage]);
  useEffect(() => { loadLots(); }, [loadLots]);
  useEffect(() => {
    inventoryService.getDefects({ page_size: 500 }).then((res) => setDefects((res?.results || res || []).filter((d) => d.isActive !== false && d.is_active !== false))).catch(() => setDefects([]));
  }, []);

  const choose = (key) => {
    const next = new URLSearchParams(params);
    if (key) next.set('lot', key); else next.delete('lot');
    setParams(next, { replace: true });
  };

  const onDone = async (res, lot) => {
    if (!res.approved) {
      setNotice({ text: `Draft ${res.inspectionNumber} saved for ${lot.reference}. Nothing is moved until you approve.` });
      loadLots();
      return;
    }
    const qty = res.quantities || {};
    const parts = [['good', 'passed'], ['second', 'second quality'], ['hold', 'on hold'], ['reprocess', 'for reprocess'], ['reject', 'rejected']]
      .filter(([k]) => Number(qty[k]) > 0).map(([k, label]) => `${formatNumberIN(qty[k])} m ${label}`);
    const fresh = await loadLots();
    const still = fresh.find((l) => l.key === lot.key);
    setNotice({
      text: `${res.inspectionNumber} approved for ${lot.reference}: ${parts.join(', ')}.`
        + (Number(res.shortMeter) > 0 ? ` ${formatNumberIN(res.shortMeter)} m short meter booked as loss.` : '')
        + (res.reprocessNo ? ` Reprocess order ${res.reprocessNo} created.` : '')
        + (still ? ` ${still.rolls} roll(s) of this lot are still waiting (on hold or not checked).` : ' This lot is fully checked.'),
      reprocess: Number(qty.reprocess) > 0,
    });
    if (!still) choose(null);
    setVersion((v) => v + 1);
  };

  const shown = lots.filter((l) => !q.trim() || [l.reference, l.fabric, l.supplier, ...(l.lots || []), ...(l.batches || [])]
    .some((v) => String(v || '').toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div className="space-y-4">
      <PageHeader
        title="QC Entry"
        subtitle="Check fabric roll by roll: actual meter, kg, width, GSM, defects and the result — Pass, Second Quality, Hold, Reprocess or Reject."
        breadcrumb={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Inventory', path: '/inventory' }, { label: 'QC Entry' }]}
        actions={(
          <div className="flex gap-2">
            <Link to="/inventory/masters/textile?tab=defects" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center">Defect Master</Link>
            <Link to="/inventory/qc/history" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center">QC History</Link>
          </div>
        )}
      />
      <div className="bg-white border border-slate-200 rounded-xl p-3"><QcStageFilter /></div>
      {notice && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <span className="flex-1">{notice.text}</span>
          {notice.reprocess && <Link to="/inventory/qc/reprocess" className="h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-semibold inline-flex items-center">Go to Reprocess</Link>}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="p-1 rounded hover:bg-emerald-100 cursor-pointer"><X size={14} /></button>
        </div>
      )}
      {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 items-start">
        <aside className="bg-white border border-slate-200 rounded-xl overflow-hidden text-xs">
          <div className="p-3 border-b border-slate-100">
            <div className="font-bold text-slate-900 mb-2">Waiting for QC ({lots.length})</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="GRN, lot, batch, fabric, supplier" className="w-full h-8 pl-8 pr-2 rounded-lg border border-slate-200" />
            </div>
          </div>
          <ul className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
            {loading && <li className="p-6 text-center text-slate-400">Loading…</li>}
            {!loading && shown.length === 0 && <li className="p-6 text-center text-slate-400">No fabric is waiting for QC.</li>}
            {shown.map((l) => (
              <li key={l.key}>
                <button type="button" onClick={() => choose(l.key)} className={`w-full text-left p-3 cursor-pointer ${selected === l.key ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-800">{l.reference}</span>
                    <span className="text-[10px] text-slate-500">{daysAgo(l.since)}d</span>
                  </div>
                  <div className="text-slate-600 truncate">{l.fabric}</div>
                  <div className="text-[11px] text-slate-500">{l.sourceLabel} · {l.rolls} rolls · {formatNumberIN(l.meters)} m</div>
                  <div className="flex gap-1 mt-1">
                    {l.hasDraft && <span className="px-1.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">Draft saved</span>}
                    {l.onHoldRolls > 0 && <span className="px-1.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">{l.onHoldRolls} on hold</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section>
          {selected && lots.some((l) => l.key === selected)
            ? <LotQc key={`${selected}-${version}`} lotKey={selected} defects={defects} godowns={godowns} onDone={onDone} />
            : (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-sm text-slate-500">
                <ClipboardCheck size={28} className="mx-auto mb-2 text-slate-300" />
                Choose a lot on the left to check its rolls.
              </div>
            )}
        </section>
      </div>
    </div>
  );
}
