import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  RotateCcw,
  XCircle,
  Truck,
  Inbox,
  ClipboardCheck,
  ChevronRight,
  ChevronLeft,
  Search,
  Plus,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../../services/api';
import { inventoryService } from '../../../services/domainServices';
import PageInfoButton from '../../../components/ui/PageInfoButton';

/*
 * Reprocess cycle, as the requirement lays it out:
 *   QC fail -> reprocess order -> send to processor -> receive -> QC again
 *   -> Pass / Repeat / Reject.
 * Each step is a tab; each row carries the one action that moves it on.
 * Orders are created from QC disposition or Job Work > Reprocess.
 */
const STEPS = [
  { key: 'toSend', label: 'To Send', hint: 'Reprocess order created', statuses: ['Pending'], icon: Inbox, tone: 'amber' },
  { key: 'atProcessor', label: 'At Processor', hint: 'Fabric sent, awaiting return', statuses: ['Sent to Vendor', 'In Process'], icon: Truck, tone: 'blue' },
  { key: 'readyForQc', label: 'Ready for QC', hint: 'Received back, inspect again', statuses: ['Received'], icon: ClipboardCheck, tone: 'purple' },
  { key: 'done', label: 'Done', hint: 'Reinspection approved', statuses: ['Completed'], icon: CheckCircle2, tone: 'emerald' },
];

const TONES = {
  amber: { active: 'border-amber-400 bg-amber-50', icon: 'bg-amber-100 text-amber-700', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  blue: { active: 'border-blue-400 bg-blue-50', icon: 'bg-blue-100 text-blue-700', pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  purple: { active: 'border-purple-400 bg-purple-50', icon: 'bg-purple-100 text-purple-700', pill: 'bg-purple-50 text-purple-700 border-purple-200' },
  emerald: { active: 'border-emerald-400 bg-emerald-50', icon: 'bg-emerald-100 text-emerald-700', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const PAGE_SIZE = 10;
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const stepOf = (status) => STEPS.find((s) => s.statuses.includes(status)) || STEPS[0];
const errText = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;

export default function QCReinspectionPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState('toSend');
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [qcRow, setQcRow] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      // "All" skips the server's tab filter; rows are grouped by step here.
      const res = await inventoryService.getQCReinspection({ tab: 'All' });
      const list = (res?.data ? res.data.records : res?.records) || [];
      setRecords(list.filter((r) => r.status !== 'Cancelled'));
    } catch (err) {
      setRecords([]);
      setToast({ type: 'error', text: errText(err, 'Could not load reprocess orders.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => { setPage(1); }, [activeStep, search, vendorFilter]);

  const vendors = useMemo(
    () => [...new Set(records.map((r) => r.vendor).filter(Boolean))].sort(),
    [records]
  );

  const stepTotals = useMemo(() => {
    const totals = Object.fromEntries(STEPS.map((s) => [s.key, { count: 0, qty: 0 }]));
    records.forEach((r) => {
      const t = totals[stepOf(r.status).key];
      t.count += 1;
      t.qty += Number(r.sentQty || 0);
    });
    return totals;
  }, [records]);

  const rows = useMemo(() => {
    const step = STEPS.find((s) => s.key === activeStep);
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (!step.statuses.includes(r.status)) return false;
      if (vendorFilter !== 'All' && r.vendor !== vendorFilter) return false;
      if (!q) return true;
      return [r.reprocessNo, r.sourceQcNo, r.fabricItem, r.lotNo, r.vendor, r.jwoNo]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [records, activeStep, search, vendorFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const moveTo = async (row, status, doneText) => {
    if (!row.jwoId) {
      setToast({ type: 'error', text: `${row.reprocessNo} has no job work order, so its status cannot change here.` });
      return;
    }
    setBusyId(row.id);
    try {
      await api.patch(`/jobwork/orders/${row.jwoId}/reprocesses/${row.id}/`, { status });
      setToast({ type: 'success', text: `${row.reprocessNo} ${doneText}.` });
      await fetchRecords();
    } catch (err) {
      setToast({ type: 'error', text: errText(err, 'Could not update the reprocess order.') });
    } finally {
      setBusyId(null);
    }
  };

  const renderAction = (r) => {
    const busy = busyId === r.id;
    const base = 'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50';
    if (r.status === 'Pending') {
      return (
        <button type="button" disabled={busy} onClick={() => moveTo(r, 'Sent to Vendor', 'sent to processor')} className={`${base} bg-amber-500 text-white hover:bg-amber-600`}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />} Send to Processor
        </button>
      );
    }
    if (r.status === 'Sent to Vendor' || r.status === 'In Process') {
      return (
        <button type="button" disabled={busy} onClick={() => moveTo(r, 'Received', 'marked received')} className={`${base} bg-blue-600 text-white hover:bg-blue-700`}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Inbox className="w-3.5 h-3.5" />} Mark Received
        </button>
      );
    }
    if (r.status === 'Received') {
      return (
        <button type="button" onClick={() => setQcRow(r)} className={`${base} bg-purple-600 text-white hover:bg-purple-700`}>
          <ClipboardCheck className="w-3.5 h-3.5" /> QC Again
        </button>
      );
    }
    return (
      <button type="button" onClick={() => setQcRow(r)} className={`${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
        View Result
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-md px-4 py-2.5 rounded-lg shadow-lg flex items-start gap-2 text-sm font-medium text-white ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Reinspection / Reprocess</h1>
            <PageInfoButton title="Reinspection / Reprocess" />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Fabric that failed QC goes to the processor, comes back, and is inspected again: Pass, Repeat or Reject.
          </p>
        </div>
        <Link
          to="/job-work/reprocess"
          className="inline-flex items-center gap-1.5 self-start md:self-auto rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          <Plus className="w-4 h-4" /> New Reprocess Order
        </Link>
      </div>

      {/* Step tabs: the reprocess cycle, left to right */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((s, i) => {
          const t = stepTotals[s.key];
          const tone = TONES[s.tone];
          const Icon = s.icon;
          const active = activeStep === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveStep(s.key)}
              className={`relative text-left rounded-xl border-2 p-3.5 transition ${active ? tone.active : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone.icon}`}><Icon className="w-5 h-5" /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500">Step {i + 1}</p>
                  <p className="text-sm font-bold text-slate-900">{s.label}</p>
                </div>
                <span className="ml-auto text-2xl font-extrabold text-slate-900">{t.count}</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{s.hint} · <span className="font-semibold text-slate-700">{fmt(t.qty)} m</span></p>
              {i < STEPS.length - 1 && (
                <ChevronRight className="hidden lg:block absolute -right-[13px] top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 bg-slate-50 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between p-3 border-b border-slate-200">
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reprocess no, GRN, fabric, lot..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            />
          </div>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="sm:w-56 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="All">All processors</option>
            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Reprocess No.</th>
                <th className="p-3">Date</th>
                <th className="p-3">Source (GRN / Inward)</th>
                <th className="p-3">Fabric</th>
                <th className="p-3">Lot</th>
                <th className="p-3">Processor</th>
                <th className="p-3 text-right">Qty (m)</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Next Step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading...</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={9} className="p-10 text-center text-slate-400">Nothing in this step.</td></tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="p-3 font-semibold text-blue-700">{r.reprocessNo}</td>
                    <td className="p-3 text-slate-600">{r.date}</td>
                    <td className="p-3 font-mono text-slate-700">{r.sourceQcNo || '—'}</td>
                    <td className="p-3 text-slate-800">{r.fabricItem || '—'}</td>
                    <td className="p-3 font-mono text-slate-600">{r.lotNo || '—'}</td>
                    <td className="p-3 text-slate-800">{r.vendor || '—'}</td>
                    <td className="p-3 text-right font-semibold">{fmt(r.sentQty)}</td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONES[stepOf(r.status).tone].pill}`}>{r.status}</span>
                    </td>
                    <td className="p-3 text-right">{renderAction(r)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-slate-200 text-xs text-slate-500">
          <span>{rows.length} record{rows.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 font-semibold text-slate-700">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {qcRow && (
        <QcAgainModal
          row={qcRow}
          onClose={() => setQcRow(null)}
          onDone={async (text) => {
            setQcRow(null);
            setToast({ type: 'success', text });
            await fetchRecords();
          }}
        />
      )}
    </div>
  );
}

/* QC Again: split the returned quantity into Pass / Repeat / Reject. */
function QcAgainModal({ row, onClose, onDone }) {
  const readOnly = row.status === 'Completed';
  const total = Number(row.sentQty || 0);
  const hasSaved = row.goodQty || row.reprocessQty || row.rejectedQty;
  const [pass, setPass] = useState(String(hasSaved ? row.goodQty : total));
  const [repeat, setRepeat] = useState(String(row.reprocessQty || 0));
  const [reject, setReject] = useState(String(row.rejectedQty || 0));
  const [remarks, setRemarks] = useState(row.remarks || '');
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const nPass = Number(pass) || 0;
  const nRepeat = Number(repeat) || 0;
  const nReject = Number(reject) || 0;
  const sum = nPass + nRepeat + nReject;
  const balanced = total > 0 && Math.abs(sum - total) < 0.001;

  const submit = async (isDraft) => {
    if (!isDraft && !balanced) {
      setError(`Pass + Repeat + Reject must equal ${fmt(total)} m (now ${fmt(sum)} m).`);
      return;
    }
    setError('');
    setSaving(isDraft ? 'draft' : 'approve');
    try {
      const res = await inventoryService.saveQCReinspectionDisposition({
        reprocessId: row.id,
        isDraft,
        goodQty: nPass,
        holdQty: 0,
        reprocessQty: nRepeat,
        rejectedQty: nReject,
        measurements: row.measurements || [],
        remarks,
      });
      await onDone(res?.data?.message || res?.message || (isDraft ? 'Draft saved.' : 'Reinspection approved.'));
    } catch (err) {
      setError(errText(err, 'Could not save the reinspection.'));
    } finally {
      setSaving(null);
    }
  };

  const fields = [
    { label: 'Pass', hint: 'Good stock, back to godown', value: pass, set: setPass, n: nPass, icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50/60 text-emerald-700' },
    { label: 'Repeat', hint: 'Send for reprocess again', value: repeat, set: setRepeat, n: nRepeat, icon: RotateCcw, cls: 'border-purple-200 bg-purple-50/60 text-purple-700' },
    { label: 'Reject', hint: 'To Reject / Scrap', value: reject, set: setReject, n: nReject, icon: XCircle, cls: 'border-rose-200 bg-rose-50/60 text-rose-700' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900">{readOnly ? 'Reinspection Result' : 'QC Again'} · {row.reprocessNo}</h3>
            <p className="text-xs text-slate-500">
              {row.fabricItem || '—'} · Lot {row.lotNo || '—'} · {row.vendor || '—'} · <span className="font-semibold text-slate-700">{fmt(total)} m</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {fields.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className={`rounded-xl border p-3 space-y-1.5 ${f.cls}`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold"><Icon className="w-4 h-4" />{f.label}</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={readOnly}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-bold text-slate-900 disabled:bg-slate-50"
                  />
                  <p className="text-[10.5px] text-slate-500 leading-tight">{f.hint}</p>
                </div>
              );
            })}
          </div>

          <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${balanced ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
            <span>Pass + Repeat + Reject = <strong>{fmt(sum)} m</strong> of {fmt(total)} m</span>
            <span className="font-semibold">{balanced ? 'Balanced' : `Diff ${fmt(total - sum)} m`}</span>
          </div>

          {nRepeat > 0 && !readOnly && (
            <p className="text-[11px] text-purple-700">A new reprocess order for {fmt(nRepeat)} m will be created in "To Send".</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
            <textarea
              rows={2}
              disabled={readOnly}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Shade corrected after re-dyeing"
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs disabled:bg-slate-50"
            />
          </div>

          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <>
              <button type="button" disabled={!!saving} onClick={() => submit(true)} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {saving === 'draft' ? 'Saving...' : 'Save Draft'}
              </button>
              <button type="button" disabled={!!saving || !balanced} onClick={() => submit(false)} className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 disabled:bg-slate-300">
                {saving === 'approve' ? 'Posting...' : 'Approve & Update Stock'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
