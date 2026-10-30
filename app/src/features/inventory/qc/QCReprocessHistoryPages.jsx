import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import AppPagination from '../../../components/ui/AppPagination';
import { api } from '../../../services/api';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';
import { QcStageFilter } from './QcStageGate';

const crumbs = (label) => [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Inventory', path: '/inventory' }, { label }];
const RESULT_STYLE = {
  Pass: 'bg-emerald-50 text-emerald-700', 'Second Quality': 'bg-sky-50 text-sky-700', Hold: 'bg-amber-50 text-amber-800',
  Reprocess: 'bg-violet-50 text-violet-700', Reject: 'bg-rose-50 text-rose-700',
};

/**
 * Reprocess (PDF §08): QC fail -> send the failed rolls to a processor (or
 * rework in-house) -> they come back to QC Entry for the next QC round.
 */
export function QCReprocessPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/qc/reprocess-stock/');
      setRows(res?.results || []);
      setError('');
    } catch (err) {
      setError(describeApiError(err) || 'Reprocess stock could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const backToQc = async (row) => {
    const cost = window.prompt(`Rework of ${row.batchCode} done in-house. Rework cost in ₹ (leave blank if none):`, '');
    if (cost === null) return;
    setBusy(row.batchCode);
    setError('');
    try {
      const res = await inventoryService.batchAction(row.batchCode, 'rework-done', {
        lotTakaIds: row.rolls.map((r) => r.lotTakaId), cost: cost || undefined,
      });
      setNotice(`${row.batchCode}: ${formatNumberIN(row.meters)} m is back at QC (${res.reference}). Check it again in QC Entry.`);
      load();
    } catch (err) {
      setError(describeApiError(err) || 'Could not send it back to QC.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reprocess"
        subtitle="Rolls that failed QC. Send them to a processor for rework, or rework them in-house — either way they come back to QC Entry to be checked again (Pass / Repeat / Reject)."
        breadcrumb={crumbs('Reprocess')}
        actions={<Link to="/inventory/qc/advanced?step=recheck" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center">Reprocess orders</Link>}
      />
      <ol className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
        {['QC fail', 'Send to processor / rework in-house', 'Add reprocess charges', 'Receive back', 'QC again in QC Entry'].map((s, i) => (
          <li key={s} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-slate-300">›</span>}
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center">{i + 1}</span>{s}
          </li>
        ))}
      </ol>
      {notice && <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{notice}</div>}
      {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Batch / lot</th>
                <th className="px-3 py-2.5 text-left">Fabric</th>
                <th className="px-3 py-2.5 text-left">Failed rolls (reason)</th>
                <th className="px-3 py-2.5 text-right">Metres</th>
                <th className="px-3 py-2.5 text-left">Reprocess order</th>
                <th className="px-3 py-2.5 text-right">Next step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">No fabric is waiting for reprocess.</td></tr>}
              {rows.map((r) => (
                <tr key={r.batchCode || r.lots.join()}>
                  <td className="px-3 py-3">
                    {r.batchCode ? <Link to={`/inventory/batches/${encodeURIComponent(r.batchCode)}`} className="font-mono font-bold text-blue-700 hover:underline">{r.batchCode}</Link> : '—'}
                    <div className="text-[10px] text-slate-400">Lot {r.lots.join(', ')} · since {r.since}</div>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-800">{r.fabric}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.rolls.map((t) => <span key={t.lotTakaId} title={t.remarks || ''} className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 font-mono">{t.takaId} · {formatNumberIN(t.meters)}{t.remarks ? ` · ${t.remarks}` : ''}</span>)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">{formatNumberIN(r.meters)}</td>
                  <td className="px-3 py-3">{r.reprocessOrders.length ? r.reprocessOrders.map((o) => <div key={o.no}>{o.no} · {o.status}{o.jwoNo ? ` · ${o.jwoNo}` : ''}</div>) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap space-x-1">
                    {r.batchCode && (
                      <>
                        <Link to={`/inventory/batches/${encodeURIComponent(r.batchCode)}?tab=dyeing`} className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold inline-flex items-center">Send to processor</Link>
                        <button type="button" disabled={busy === r.batchCode} onClick={() => backToQc(r)} className="h-8 px-3 rounded-lg border border-slate-200 font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer">Reworked in-house → QC</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** QC History (PDF §18): every QC with its rolls -- repeat QC of the same lot included. */
export function QCHistoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState({ results: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    inventoryService.getQCInspections({ page, page_size: pageSize, ...(query ? { search: query } : {}) })
      .then((res) => { if (alive) { setData({ results: res?.results || [], count: res?.count || 0 }); setError(''); } })
      .catch((err) => { if (alive) setError(describeApiError(err) || 'QC history could not be loaded.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page, pageSize, query]);

  const n = (v) => formatNumberIN(v || 0);
  return (
    <div className="space-y-4">
      <PageHeader title="QC History" subtitle="Every quality check, newest first, with each roll's measurements, defects and result. A lot checked again shows each round." breadcrumb={crumbs('QC History')} />
      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <QcStageFilter />
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }} className="relative max-w-md">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="QC no. or GRN / inward no., then Enter" className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-xs" />
        </form>
      </div>
      {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5 w-8" />
                <th className="px-3 py-2.5 text-left">QC no. / date</th>
                <th className="px-3 py-2.5 text-left">Received on</th>
                <th className="px-3 py-2.5 text-left">Checked by</th>
                <th className="px-3 py-2.5 text-right">Checked</th>
                <th className="px-3 py-2.5 text-right">Pass</th>
                <th className="px-3 py-2.5 text-right">2nd</th>
                <th className="px-3 py-2.5 text-right">Hold</th>
                <th className="px-3 py-2.5 text-right">Reprocess</th>
                <th className="px-3 py-2.5 text-right">Reject</th>
                <th className="px-3 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400">Loading…</td></tr>}
              {!loading && data.results.length === 0 && <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400">No QC recorded yet.</td></tr>}
              {data.results.map((i) => (
                <React.Fragment key={i.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setOpen(open === i.id ? null : i.id)} aria-expanded={open === i.id} aria-label={`Rolls of ${i.inspectionNumber}`} className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                        {open === i.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5"><div className="font-mono font-semibold">{i.inspectionNumber}</div><div className="text-[10px] text-slate-400">{i.inspectionDate} · {i.inspectionType}</div></td>
                    <td className="px-3 py-2.5 font-mono">{i.sourceDocumentNumber || '—'}</td>
                    <td className="px-3 py-2.5">{i.inspectorName || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n(i.total_inspected_qty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{n(i.passed_qty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n(i.second_quality_qty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n(i.hold_qty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-violet-700">{n(i.reprocess_qty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-rose-700">{n(i.rejected_qty)}</td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{i.status}</span></td>
                  </tr>
                  {open === i.id && (
                    <tr className="bg-slate-50/60">
                      <td />
                      <td colSpan={10} className="px-3 py-3">
                        {(i.notes || '').replace(/^\[[^\]]*\]\s*/, '') && <p className="mb-2 text-slate-600">Remarks: {(i.notes || '').replace(/^\[[^\]]*\]\s*/, '')}</p>}
                        <table className="w-full">
                          <thead className="text-[10px] uppercase text-slate-400">
                            <tr><th className="text-left py-1">Roll</th><th className="text-right py-1">Book m</th><th className="text-right py-1">Actual m</th><th className="text-right py-1">KG</th><th className="text-right py-1">Width</th><th className="text-right py-1">GSM</th><th className="text-left py-1 pl-3">Defects</th><th className="text-left py-1">Result</th><th className="text-left py-1">Remarks</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(i.lines || []).map((l) => (
                              <tr key={l.id}>
                                <td className="py-1.5 font-mono">{l.lotNo} / {l.takaNo}</td>
                                <td className="py-1.5 text-right tabular-nums">{n(l.originalMeter)}</td>
                                <td className="py-1.5 text-right tabular-nums">{n(l.actualMeter)}</td>
                                <td className="py-1.5 text-right tabular-nums">{l.rollWeight ? n(l.rollWeight) : '—'}</td>
                                <td className="py-1.5 text-right tabular-nums">{l.width ? n(l.width) : '—'}</td>
                                <td className="py-1.5 text-right tabular-nums">{l.gsm ? n(l.gsm) : '—'}</td>
                                <td className="py-1.5 pl-3">{(l.defects || []).map((d) => `${d.defectName}${d.defect_count > 1 ? ` ×${d.defect_count}` : ''}`).join(', ') || '—'}</td>
                                <td className="py-1.5"><span className={`px-1.5 py-0.5 rounded font-semibold ${RESULT_STYLE[l.disposition] || ''}`}>{l.disposition}</span></td>
                                <td className="py-1.5 text-slate-500">{l.remarks || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <AppPagination total={data.count} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} loading={loading} />
      </div>
    </div>
  );
}
