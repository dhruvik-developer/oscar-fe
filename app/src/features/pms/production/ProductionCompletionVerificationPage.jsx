import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Printer, MoreHorizontal, Eye, ListChecks,
  ClipboardList, Package, XCircle, CheckCircle2, AlertTriangle,
  IndianRupee, Check, X, FileText,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import { api } from '../../../services/api';
import {
  statusPill, canMarkComplete, canVerify, canGeneratePo, errorText, fmtNum, listOf,
} from './productionStatus';
import GenerateFinalJobWorkPOModal from '../../purchase/GenerateFinalJobWorkPOModal';
import { PrintProductionCompletionModal } from './PrintProductionCompletionModal';

const fmtM = (n) => (n === null || n === undefined || n === '' ? '—' : `${fmtNum(n)} M`);
const fmtDate = (d) => {
  if (!d) return '—';
  const parts = String(d).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : d;
};
const fmtINR = (n) => (n === null || n === undefined || n === ''
  ? '—'
  : `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export default function ProductionCompletionVerificationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [instructions, setInstructions] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [completionData, setCompletionData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [verifyError, setVerifyError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [showPI, setShowPI] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showGeneratePoModal, setShowGeneratePoModal] = useState(false);
  const [rejectedQtyInput, setRejectedQtyInput] = useState('0');
  const [verifyReasonInput, setVerifyReasonInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const piIdParam = searchParams.get('pi');

  // Load instructions list (for the picker)
  useEffect(() => {
    let live = true;
    setListLoading(true);
    setListError(null);
    api.get('/production/instructions/', { query: { page_size: 200 } })
      .then((res) => {
        if (!live) return;
        const list = listOf(res);
        setInstructions(list);
        if (!piIdParam && list.length > 0) {
          setSearchParams({ pi: String(list[0].id) });
        }
      })
      .catch((err) => {
        if (live) setListError(errorText(err, 'Failed to load production instructions'));
      })
      .finally(() => {
        if (live) setListLoading(false);
      });
    return () => { live = false; };
  }, [piIdParam, setSearchParams]);

  const activePiId = piIdParam || (instructions[0]?.id ? String(instructions[0].id) : null);

  const loadCompletionData = (id) => {
    if (!id) {
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    setLoadError(null);
    return Promise.all([
      api.get(`/production/instructions/${id}/completion/`),
      api.get(`/production/instructions/${id}/`),
    ])
      .then(([data, inst]) => {
        setCompletionData(data);
        setDetail(inst);
      })
      .catch((err) => {
        setCompletionData(null);
        setDetail(null);
        setLoadError(errorText(err, 'Failed to load production completion'));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    setActionError(null);
    setActionNotice(null);
    if (activePiId) {
      loadCompletionData(activePiId);
    } else {
      setCompletionData(null);
      setDetail(null);
      setLoading(false);
    }
  }, [activePiId]);

  const piNumber = completionData?.piNo || detail?.instructionNumber || instructions.find((p) => String(p.id) === String(activePiId))?.instructionNumber || '—';
  const piDate = completionData?.piDate || '';
  const vendor = completionData?.agency || '—';
  const fabric = completionData?.fabric || '—';
  const processType = completionData?.processType || '—';
  const assignedEmployee = completionData?.assignedEmployee || '—';
  const orderQty = completionData ? completionData.orderQty : null;
  const totalProduced = completionData ? Number(completionData.totalProduced) : null;
  const rejectedQty = completionData ? completionData.rejectedQty : null;
  const acceptedQty = completionData ? completionData.acceptedQty : null;
  const shortage = completionData ? completionData.shortageQty : null;
  const jobRate = Number(completionData?.jobRate) || 0;
  const finalAmount = completionData ? completionData.finalAmount : null;
  const status = completionData?.status || detail?.status || '';
  const greyLotNo = detail?.greyLotNo || null;
  const finalPoNumber = detail?.finalPoNumber || null;

  const rows = useMemo(() => {
    return (completionData?.dailySummary || []).map((r) => {
      const parts = String(r.date || '').slice(0, 10).split('-');
      const displayDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : r.date || '—';
      return {
        ...r,
        displayDate,
      };
    });
  }, [completionData]);

  const hasData = Boolean(completionData);
  const statusLabel = status || '—';
  const jobRateLabel = jobRate > 0 ? `₹ ${jobRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / M` : '—';

  const handlePrint = () => setShowPrintModal(true);

  const handleComplete = async () => {
    if (!activePiId) return;
    if (!window.confirm('Mark this instruction as Completed (pending verification)?')) return;
    setActionError(null);
    setActionNotice(null);
    setBusy('complete');
    try {
      await api.post(`/production/instructions/${activePiId}/complete/`);
      await loadCompletionData(activePiId);
    } catch (err) {
      setActionError(`Mark Complete failed: ${errorText(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleGeneratePo = async () => {
    if (!activePiId) return;
    if (!window.confirm('Generate the Final Job Work PO for this instruction?')) return;
    setActionError(null);
    setActionNotice(null);
    setBusy('po');
    try {
      const res = await api.post(`/production/instructions/${activePiId}/generate-po/`);
      setDetail(res);
      setActionNotice(res?.finalPoNumber ? `Final Job Work PO ${res.finalPoNumber} created.` : 'Final Job Work PO created.');
      await loadCompletionData(activePiId);
    } catch (err) {
      setActionError(`Generate Final PO failed: ${errorText(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!activePiId) return;
    setVerifyError(null);
    if (!verifyReasonInput.trim()) {
      setVerifyError('Verification reason or remarks is required.');
      return;
    }
    const rejected = Number(rejectedQtyInput);
    if (rejectedQtyInput !== '' && (!Number.isFinite(rejected) || rejected < 0)) {
      setVerifyError('Rejected quantity must be zero or more.');
      return;
    }
    setVerifying(true);
    try {
      const res = await api.post(`/production/instructions/${activePiId}/verify/`, {
        reason: verifyReasonInput.trim(),
        rejectedQty: rejectedQtyInput === '' ? 0 : rejected,
      });
      setShowVerifyModal(false);
      setVerifyReasonInput('');
      setRejectedQtyInput('0');
      setDetail(res);
      setActionNotice(`Verified — status is now ${res?.status || 'updated'}${res?.greyLotNo ? `, grey lot ${res.greyLotNo}` : ''}.`);
      await loadCompletionData(activePiId);
    } catch (err) {
      setVerifyError(errorText(err, 'Verification failed'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      {/* Title */}
      <PageHeader
        title="Production Completion & Verification"
        subtitle="Verify final production quantity and approve for Final Job Work PO."
        actions={
          instructions.length > 1 && (
            <select
              value={activePiId || ''}
              onChange={(e) => setSearchParams({ pi: e.target.value })}
              className="rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none"
            >
              {instructions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.instructionNumber} - {p.agencyName || '—'} ({p.status})
                </option>
              ))}
            </select>
          )
        }
      />

      {[listError, loadError, actionError].filter(Boolean).map((msg) => (
        <div key={msg} className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{msg}</span>
          {msg === loadError && activePiId && (
            <button type="button" onClick={() => loadCompletionData(activePiId)} className="rounded-md border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100">Retry</button>
          )}
          {msg === actionError && (
            <button type="button" onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-700" title="Dismiss"><X size={14} /></button>
          )}
        </div>
      ))}
      {actionNotice && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-semibold text-emerald-700">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-emerald-700" title="Dismiss"><X size={14} /></button>
        </div>
      )}
      {!listLoading && !listError && instructions.length === 0 && (
        <div className="rounded-xl border border-[#e2eaf5] bg-white px-4 py-10 text-center">
          <p className="text-[13px] font-extrabold text-[#17294e]">No production instructions yet</p>
          <p className="mt-1 text-[11.5px] text-slate-400">Create a production instruction to track completion and verification.</p>
        </div>
      )}

      {/* 1 — Summary card */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/pms/production-instructions')}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <h2 className="text-[14px] font-extrabold text-[#17294e]">Production Instruction Summary</h2>
          {status && (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusPill(status)}`}>
              {statusLabel}
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {hasData && canMarkComplete(status) && (
              <button
                onClick={handleComplete}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                {busy === 'complete' ? 'Completing…' : 'Mark Complete'}
              </button>
            )}
            {hasData && canVerify(status) && (
              <button
                onClick={() => {
                  setRejectedQtyInput(String(Number(rejectedQty) || 0));
                  setVerifyError(null);
                  setShowVerifyModal(true);
                }}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                <Check size={14} /> Verify & Approve
              </button>
            )}
            {hasData && canGeneratePo(status) && (
              <button
                onClick={() => setShowGeneratePoModal(true)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <FileText size={14} /> Generate Final PO
              </button>
            )}
            <button
              onClick={() => setShowPI(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Eye size={13} /> View PI
            </button>
            <button
              onClick={() => navigate(`/pms/daily-production?pi=${encodeURIComponent(activePiId || '')}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <ListChecks size={13} /> View Daily Production
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Printer size={13} /> Print
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg border border-[#e2eaf5] px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
                title="More"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl text-[12px]">
                    <button onClick={() => { setMenuOpen(false); navigate(`/pms/daily-production?pi=${encodeURIComponent(activePiId || '')}`); }} className="block w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50">Add daily entry</button>
                    <button onClick={() => { setMenuOpen(false); handlePrint(); }} className="block w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50">Print summary</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* PI meta */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['PI No.', piNumber],
            ['PI Date', fmtDate(piDate)],
            ['Agency / Vendor', vendor],
            ['Fabric', fabric],
            ['Process Type', processType],
            ['Assigned Employee', assignedEmployee],
            ...(greyLotNo ? [['Grey Lot No.', greyLotNo]] : []),
            ...(finalPoNumber ? [['Final Job Work PO', finalPoNumber]] : []),
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] font-medium text-slate-400">{k}</p>
              <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v}</p>
            </div>
          ))}
        </div>

        {/* Stat boxes */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Order Quantity" value={hasData ? fmtM(orderQty) : '—'} icon={ClipboardList} tone="blue" />
          <KpiCard label="Total Produced" value={hasData ? fmtM(totalProduced) : '—'} icon={Package} tone="emerald" />
          <KpiCard label="Rejected Qty" value={hasData ? fmtM(rejectedQty) : '—'} icon={XCircle} tone="rose" />
          <KpiCard label="Accepted Qty" value={hasData ? fmtM(acceptedQty) : '—'} icon={CheckCircle2} tone="blue" />
          <KpiCard label="Shortage / Difference" value={hasData ? fmtM(shortage) : '—'} icon={AlertTriangle} tone="amber" />
          <KpiCard label="Agreed Job Rate" value={jobRateLabel} icon={IndianRupee} tone="purple" />
        </div>
      </div>

      {/* 2 — Daily summary */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#2563eb] text-[11px] font-extrabold text-white">2</span>
          <h2 className="text-[13px] font-extrabold text-[#2563eb]">Daily Production Summary (Auto from Daily Production)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-center text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                {['#', 'Date', 'Produced Qty (M)', 'Cumulative Qty (M)', 'Balance Qty (M)', 'Entered By', 'Remarks'].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-slate-400">Loading production summary...</td>
                </tr>
              )}
              {!loading && rows.map((r, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-slate-50 text-slate-600 ${idx === rows.length - 1 ? 'bg-[#f2f7ff]' : ''}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2.5">{r.displayDate}</td>
                  <td className="px-4 py-2.5 font-semibold">{fmtNum(r.produced)}</td>
                  <td className="px-4 py-2.5">{fmtNum(r.cumulative)}</td>
                  <td className={`px-4 py-2.5 ${Number(r.balance) < 0 ? 'text-rose-600' : ''}`}>{fmtNum(r.balance)}</td>
                  <td className="px-4 py-2.5 font-medium">{r.enteredBy || '—'}</td>
                  <td className="px-4 py-2.5">{r.remarks}</td>
                </tr>
              ))}
              {!loading && loadError && (
                <tr><td colSpan={7} className="px-4 py-8 font-semibold text-rose-600">Could not load the production summary.</td></tr>
              )}
              {!loading && !loadError && rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-slate-400">No production entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verify & Approve Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleVerify} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[15px] font-extrabold text-[#17294e]">Approve & Verify Production</h3>
              <button type="button" onClick={() => setShowVerifyModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">Total Produced Quantity</label>
                <input
                  type="text"
                  readOnly
                  value={fmtM(totalProduced)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">Rejected Quantity (M)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  max={totalProduced ?? undefined}
                  value={rejectedQtyInput}
                  onChange={(e) => setRejectedQtyInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px] text-slate-800 outline-none focus:border-blue-500"
                />
                <p className="mt-1 text-[10.5px] text-slate-400">
                  Accepted quantity will be {fmtNum(Math.max(0, (totalProduced || 0) - (Number(rejectedQtyInput) || 0)))} M (confirmed by the server on save).
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">Verification Reason / Remarks *</label>
                <textarea
                  required
                  rows={3}
                  value={verifyReasonInput}
                  onChange={(e) => setVerifyReasonInput(e.target.value)}
                  placeholder="e.g. Quality and meters cross-checked and approved."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px] text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>
            {verifyError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{verifyError}</span>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-[12px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Approve & Verify'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View PI modal */}
      {showPI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPI(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[15px] font-extrabold text-[#17294e]">Production Instruction — {piNumber}</h3>
              <button onClick={() => setShowPI(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              {[['PI Date', fmtDate(piDate)], ['Agency / Vendor', vendor], ['Fabric', fabric], ['Process Type', processType], ['Order Qty', hasData ? fmtM(orderQty) : '—'], ['Assigned', assignedEmployee], ['Job Rate', jobRateLabel], ['Final Amount', hasData ? fmtINR(finalAmount) : '—'], ['Status', status || '—'], ['Grey Lot No.', greyLotNo || '—'], ['Final Job Work PO', finalPoNumber || '—']].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10.5px] font-bold uppercase text-slate-400">{k}</dt>
                  <dd className="mt-0.5 font-bold text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowPI(false)} className="rounded-lg bg-slate-100 px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Final Job Work PO Modal / Slide */}
      <GenerateFinalJobWorkPOModal
        isOpen={showGeneratePoModal}
        onClose={() => setShowGeneratePoModal(false)}
        initialInstructionId={activePiId}
        onSuccess={(res) => {
          setActionNotice(
            res?.finalPoNumber
              ? `Final Job Work PO ${res.finalPoNumber} created successfully.`
              : 'Final Job Work PO created successfully.'
          );
          if (activePiId) loadCompletionData(activePiId);
        }}
      />

      {/* Print Completion & Verification Certificate Modal */}
      <PrintProductionCompletionModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        completionData={completionData}
        detail={detail}
      />
    </div>
  );
}
