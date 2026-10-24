import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Factory, Lock, Send, Loader2 } from 'lucide-react';
import { fetchPublicProduction, submitPublicProduction } from '../../../services/pmsSync';

/**
 * PublicProductionEntryPage — `/production-entry/:token`.
 *
 * The Daily Production Entry form behind a project's shareable link: no
 * sign-in, no app shell. The token scopes it to one project's production
 * instructions; the server applies the same rules as the in-app page
 * (no future dates, balance tolerance, active employees only).
 */

const fmt = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const toDDMMYYYY = (iso) => {
  const parts = String(iso || '').slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : iso || '—';
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-teal-200 focus:border-teal-500';

/** Server field names → this form's error slots. */
const FIELD_SLOTS = {
  instructionId: 'instruction',
  entryDate: 'date',
  entry_date: 'date',
  meters: 'qty',
  rejectMeter: 'rejected',
  reject_meter: 'rejected',
  reprocessMeter: 'reprocess',
  reprocess_meter: 'reprocess',
  enteredByEmployeeId: 'employee',
};

export default function PublicProductionEntryPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [instructionId, setInstructionId] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [qty, setQty] = useState('');
  const [rejected, setRejected] = useState('');
  const [reprocess, setReprocess] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [remarks, setRemarks] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchPublicProduction(token);
      setData(res);
      setLoadError(null);
      return res;
    } catch (err) {
      setLoadError(err?.message || 'This production link could not be opened.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load().then((res) => {
      if (!res) return;
      setEntryDate(String(res.today || '').slice(0, 10));
      const open = (res.instructions || []).filter((pi) => pi.canRecord);
      if (open.length === 1) setInstructionId(open[0].id);
    });
  }, [load]);

  const today = String(data?.today || '').slice(0, 10);
  const instructions = useMemo(() => data?.instructions || [], [data]);
  const openInstructions = instructions.filter((pi) => pi.canRecord);
  const isProjectDone =
    Boolean(data?.isCompleted) ||
    data?.project?.status === 'Completed' ||
    data?.project?.status === 'Closed' ||
    (instructions.length > 0 &&
      openInstructions.length === 0 &&
      instructions.every((item) => item.isCompleted || Number(item.balance || 0) <= 0 || item.status === 'Completed'));
  const pi = instructions.find((row) => row.id === instructionId) || null;
  const balance = Number(pi?.balance || 0);
  const produced = Number(qty) || 0;
  const accepted = Math.max(produced - (Number(rejected) || 0) - (Number(reprocess) || 0), 0);

  function validate() {
    const errors = {};
    if (!pi) errors.instruction = 'Select a production instruction.';
    if (!entryDate) errors.date = 'Date is required.';
    else if (today && entryDate > today) errors.date = 'Production Date cannot be in the future.';

    if (!produced || produced <= 0) {
      errors.qty = 'Produced quantity must be greater than 0.';
    } else if (balance > 0 && produced > balance) {
      errors.qty = `Today's produced quantity (${fmt(produced)} Mtr) exceeds remaining balance (${fmt(balance)} Mtr). Maximum allowed is ${fmt(balance)} Mtr.`;
    } else if (balance <= 0) {
      errors.qty = 'All ordered quantity for this instruction has already been completed.';
    }

    const rej = Number(rejected) || 0;
    const rep = Number(reprocess) || 0;
    if (rej < 0) errors.rejected = 'Rejected quantity cannot be negative.';
    else if (rej > produced) errors.rejected = 'Cannot exceed produced quantity.';
    if (rep < 0) errors.reprocess = 'Reprocess quantity cannot be negative.';
    else if (rep > produced) errors.reprocess = 'Cannot exceed produced quantity.';
    if (rej + rep > produced) errors.rejected = 'Sum of reject and reprocess cannot exceed produced quantity.';

    if (!employeeId) errors.employee = 'Select the employee who produced this entry.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const saved = await submitPublicProduction(token, {
        instructionId,
        entryDate,
        meters: produced,
        rejectMeter: Number(rejected) || 0,
        reprocessMeter: Number(reprocess) || 0,
        enteredByEmployeeId: employeeId,
        remarks: remarks.trim() || undefined,
      });
      setSuccess({
        meters: saved?.meters ?? produced,
        goodMeter: saved?.goodMeter ?? accepted,
        instructionNumber: pi?.instructionNumber,
        date: entryDate,
      });
      setQty('');
      setRejected('');
      setReprocess('');
      setRemarks('');
      load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const serverFields = err?.payload?.field_errors || {};
      const mapped = {};
      Object.entries(serverFields).forEach(([key, messages]) => {
        const slot = FIELD_SLOTS[key];
        if (slot) mapped[slot] = Array.isArray(messages) ? messages[0] : String(messages);
      });
      setFieldErrors(mapped);
      setFormError(err?.message || 'The entry could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading production form…
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <div className="mx-auto max-w-md mt-16 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-xs">
          <Lock size={28} className="mx-auto text-rose-500" />
          <h1 className="mt-3 text-base font-bold text-slate-900">Link unavailable</h1>
          <p className="mt-1 text-sm text-slate-600">{loadError}</p>
          <p className="mt-3 text-xs text-slate-500">Ask your production supervisor for the current link.</p>
        </div>
      </Shell>
    );
  }

  const company = data?.company?.tradeName || data?.company?.legalName || '';
  const project = data?.project || {};

  return (
    <Shell>
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4">
        <header className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
              <Factory size={18} className="text-teal-600" />
            </span>
            <div className="min-w-0">
              {company && <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{company}</p>}
              <h1 className="text-lg font-bold text-slate-900">Daily Production Entry</h1>
              <p className="text-xs text-slate-600">
                Project <b>{project.code}</b>
                {project.customerName ? ` — ${project.customerName}` : ''}
                {project.productName ? ` · ${project.productName}` : ''}
              </p>
            </div>
          </div>
        </header>

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <span>
              Entry submitted: <b>{fmt(success.meters)} Mtr</b> ({fmt(success.goodMeter)} Mtr good) on{' '}
              {toDDMMYYYY(success.date)} against {success.instructionNumber}.
            </span>
          </div>
        )}

        {isProjectDone ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-xs space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 tracking-wide uppercase">
                Production Complete
              </span>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Project is Done</h2>
              <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
                All production quantities for this project have been fully completed and received.
                This entry link is now closed and no further daily production updates are required.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Total Ordered</p>
                <p className="text-base font-bold font-mono text-slate-900">
                  {fmt(data?.totalOrdered ?? instructions.reduce((s, x) => s + Number(x.orderMeter || 0), 0))} <span className="text-[10px] font-normal">Mtr</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Total Produced</p>
                <p className="text-base font-bold font-mono text-emerald-700">
                  {fmt(data?.totalProduced ?? instructions.reduce((s, x) => s + Number(x.cumulative || 0), 0))} <span className="text-[10px] font-normal">Mtr</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Remaining Balance</p>
                <p className="text-base font-bold font-mono text-slate-700">
                  0.00 <span className="text-[10px] font-normal">Mtr</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Project: <span className="font-semibold text-slate-700">{project.code}</span> · Status: <span className="font-semibold text-emerald-700">{project.status === 'Completed' ? 'Completed' : '100% Produced'}</span>
            </p>
          </div>
        ) : openInstructions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm font-bold text-slate-800">No open production instructions</p>
            <p className="mt-1 text-xs text-slate-500">
              This project has no approved production instruction to record against yet.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs space-y-4" noValidate>
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Production Instruction <span className="text-rose-500">*</span></span>
              <select value={instructionId} onChange={(e) => setInstructionId(e.target.value)} className={inputClass}>
                <option value="">Select instruction…</option>
                {instructions.map((row) => (
                  <option key={row.id} value={row.id} disabled={!row.canRecord}>
                    {row.instructionNumber} — {row.agencyName}{row.fabric ? ` · ${row.fabric}` : ''}
                    {row.canRecord
                      ? (Number(row.balance) > 0 ? ` (${fmt(row.balance)} Mtr remaining)` : '')
                      : ` (${row.status} · 0 Mtr remaining)`}
                  </option>
                ))}
              </select>
              {fieldErrors.instruction && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.instruction}</p>}
            </label>

            {pi && (
              <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                {[
                  ['Order', pi.orderMeter],
                  ['Produced', pi.cumulative],
                  ['Balance', pi.balance],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="text-sm font-bold font-mono text-slate-900">{fmt(value)} <span className="text-[10px] font-normal">Mtr</span></dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold text-slate-700">Production Date <span className="text-rose-500">*</span></span>
                <input type="date" max={today || undefined} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={`${inputClass} font-mono`} />
                {fieldErrors.date && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.date}</p>}
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-700">
                  Today's Produced (Mtr) <span className="text-rose-500">*</span>
                  {balance > 0 && (
                    <span className="ml-1 text-[11px] font-normal text-slate-500">
                      (Max {fmt(balance)} Mtr remaining)
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max={balance > 0 ? balance : undefined}
                  placeholder={balance > 0 ? `Max ${fmt(balance)}` : "e.g. 500.00"}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={`${inputClass} font-mono font-bold`}
                />
                {fieldErrors.qty && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.qty}</p>}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Rejected Qty (Mtr)</span>
                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={rejected} onChange={(e) => setRejected(e.target.value)} className={`${inputClass} font-mono`} />
                {fieldErrors.rejected && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.rejected}</p>}
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Reprocess Qty (Mtr)</span>
                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={reprocess} onChange={(e) => setReprocess(e.target.value)} className={`${inputClass} font-mono`} />
                {fieldErrors.reprocess && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.reprocess}</p>}
              </label>
            </div>

            {produced > 0 && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs flex items-center justify-between">
                <span className="text-slate-600">Calculated Accepted / Good Output:</span>
                <span className="font-mono font-bold text-emerald-700">{accepted.toFixed(2)} Mtr</span>
              </div>
            )}

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Entered By Employee <span className="text-rose-500">*</span></span>
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
                <option value="">Select your name…</option>
                {(data?.employees || []).map((em) => (
                  <option key={em.id} value={em.id}>{em.name}{em.code ? ` (${em.code})` : ''}</option>
                ))}
              </select>
              {fieldErrors.employee && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.employee}</p>}
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Remarks / Production Observations</span>
              <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter delays, loom stoppages, defect descriptions..." className={`${inputClass} resize-none`} />
            </label>

            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" /> {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 px-4 py-3 text-sm font-bold text-white transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {submitting ? 'Submitting…' : 'Submit Entry'}
            </button>
          </form>
        )}

        {(data?.recentEntries || []).length > 0 && (
          <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-2">Recent entries</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Instruction</th>
                    <th className="py-2 pr-2 text-right">Produced</th>
                    <th className="py-2 pr-2 text-right">Good</th>
                    <th className="py-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentEntries.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-2 font-mono whitespace-nowrap">{toDDMMYYYY(row.entryDate)}</td>
                      <td className="py-2 pr-2">{row.instructionNumber}</td>
                      <td className="py-2 pr-2 text-right font-mono">{fmt(row.meters)}</td>
                      <td className="py-2 pr-2 text-right font-mono text-emerald-700">{fmt(row.goodMeter)}</td>
                      <td className="py-2">{row.employeeName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen bg-slate-100 text-slate-900">{children}</div>;
}
