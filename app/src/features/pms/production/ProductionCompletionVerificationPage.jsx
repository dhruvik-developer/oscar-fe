import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Printer, Plus, Eye, ListChecks,
  ClipboardList, Package, XCircle, CheckCircle2, AlertTriangle,
  IndianRupee, Check, X, FileText, LayoutGrid, Pencil,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import TablePagination from '../../../components/ui/TablePagination';
import { api } from '../../../services/api';
import { loomService } from '../../../services/loomService';
import {
  statusPill, canMarkComplete, canVerify, canGeneratePo, errorText, fmtNum, listOf,
} from './productionStatus';
import GenerateFinalJobWorkPOModal from '../../purchase/GenerateFinalJobWorkPOModal';
import { PrintProductionCompletionModal } from './PrintProductionCompletionModal';
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

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
  const { showToast } = useERP();
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
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
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('oscar_pms_completion_tab') || 'summary'
  );

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('oscar_pms_completion_tab', tabId);
  };

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

  // Resolve final PO number and ID across camelCase and snake_case properties
  const finalPoNumber =
    detail?.finalPoNumber ||
    detail?.final_po_number ||
    completionData?.finalPoNumber ||
    completionData?.final_po_number ||
    completionData?.fjwpoMetadata?.poNumber ||
    detail?.fjwpoMetadata?.poNumber ||
    detail?.final_po?.po_number ||
    (typeof detail?.final_po === 'string' && detail?.final_po.startsWith('FJWPO') ? detail.final_po : null) ||
    null;

  const finalPoId =
    detail?.finalPoId ||
    detail?.final_po_id ||
    detail?.final_po?.id ||
    completionData?.finalPoId ||
    completionData?.final_po_id ||
    null;

  const finalPoStatus =
    detail?.finalPoStatus ||
    detail?.final_po_status ||
    completionData?.finalPoStatus ||
    detail?.final_po?.status ||
    (status === 'PO Created' ? 'Approved' : (finalPoNumber ? 'Pending Approval' : null));

  // If a final PO number or ID exists, or status is 'PO Created', PO is generated
  const isPoGenerated = Boolean(
    finalPoNumber ||
    finalPoId ||
    status === 'PO Created' ||
    (status === 'PO Pending' && (finalPoNumber || finalPoId || completionData?.finalPoNumber || detail?.finalPoNumber))
  );
  const hasFinalPo = isPoGenerated;
  const isPoApproved = status === 'PO Created' || finalPoStatus === 'Approved';

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

  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageSize, setSummaryPageSize] = useState(10);

  const paginatedRows = useMemo(() => {
    const start = (summaryPage - 1) * summaryPageSize;
    return rows.slice(start, start + summaryPageSize);
  }, [rows, summaryPage, summaryPageSize]);

  const hasData = Boolean(completionData);
  const statusLabel = status || '—';
  const jobRateLabel = jobRate > 0 ? `₹ ${jobRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / M` : '—';

  const handlePrint = () => setShowPrintModal(true);

  const handleComplete = async () => {
    if (!activePiId) return;
    setActionError(null);
    setActionNotice(null);
    setBusy('complete');
    try {
      await api.post(`/production/instructions/${activePiId}/complete/`);
      showToast('Instruction marked as Completed (pending verification)', 'success');
      await loadCompletionData(activePiId);
    } catch (err) {
      setActionError(`Mark Complete failed: ${errorText(err)}`);
      showToast(`Mark Complete failed: ${errorText(err)}`, 'error');
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

  // [OLD CODE - COMMENTED OUT]: Fallback to /pms/daily-production when no matching loom factory was found or processType was not weaving
  /*
  const handleAddDailyEntry = async () => {
    try {
      const res = await loomService.getFactories();
      const factoryList = Array.isArray(res) ? res : res?.results || [];

      const vName = (vendor || '').toLowerCase().trim();
      const pType = (processType || '').toLowerCase().trim();

      // Check if project is open in a specific loom factory
      const matchingFactory = factoryList.find((f) => {
        const name = (f.name || '').toLowerCase();
        const partyName = (f.job_worker_party_name || '').toLowerCase();
        return (
          (name && vName && (name.includes(vName) || vName.includes(name))) ||
          (partyName && vName && (partyName.includes(vName) || vName.includes(partyName)))
        );
      });

      if (matchingFactory) {
        // Redirect to Daily Loom Entry with factory & project filter so only that project shows
        navigate(
          `/pms/loom-daily?factory=${encodeURIComponent(matchingFactory.id)}&project=${encodeURIComponent(piNumber)}&pi=${encodeURIComponent(activePiId || '')}&fabric=${encodeURIComponent(fabric || '')}`
        );
      } else if (factoryList.length > 0 && (pType.includes('weaving') || pType.includes('loom'))) {
        navigate(
          `/pms/loom-daily?factory=${encodeURIComponent(factoryList[0].id)}&project=${encodeURIComponent(piNumber)}&pi=${encodeURIComponent(activePiId || '')}&fabric=${encodeURIComponent(fabric || '')}`
        );
      } else {
        // Standard processing / dyeing PI -> redirect to daily production register
        navigate(`/pms/daily-production?pi=${encodeURIComponent(activePiId || '')}`);
      }
    } catch {
      navigate(`/pms/daily-production?pi=${encodeURIComponent(activePiId || '')}`);
    }
  };
  */

  // [UPDATED IMPLEMENTATION]: Always redirect to Daily Loom Production Entry (/pms/loom-daily)
  // Automatically maps factory and carries project, PI, and fabric filters.
  const handleAddDailyEntry = async () => {
    try {
      const res = await loomService.getFactories();
      const factoryList = Array.isArray(res) ? res : res?.results || [];

      const vName = (vendor && vendor !== '—') ? vendor.toLowerCase().trim() : '';
      const cleanPiNumber = (piNumber && piNumber !== '—') ? piNumber : '';
      const cleanFabric = (fabric && fabric !== '—') ? fabric : '';
      const cleanPiId = activePiId || '';

      // Determine target factory
      let targetFactoryId = '';
      if (factoryList.length > 0) {
        // 1. Check if vendor/agency matches factory name or job worker party
        const matchingFactory = factoryList.find((f) => {
          const name = (f.name || '').toLowerCase();
          const partyName = (f.job_worker_party_name || '').toLowerCase();
          return (
            (name && vName && (name.includes(vName) || vName.includes(name))) ||
            (partyName && vName && (partyName.includes(vName) || vName.includes(partyName)))
          );
        });

        if (matchingFactory) {
          targetFactoryId = matchingFactory.id;
        } else {
          // 2. Check localStorage selected factory or fallback to first factory with machines
          const savedId = localStorage.getItem('oscar_pms_selected_factory');
          const savedValid = factoryList.find((f) => f.id === savedId);
          if (savedValid) {
            targetFactoryId = savedValid.id;
          } else {
            const activeF = factoryList.find((f) => f.machines_count > 0) || factoryList[0];
            targetFactoryId = activeF.id;
          }
        }
      }

      // Build search params for /pms/loom-daily
      const params = new URLSearchParams();
      if (targetFactoryId) params.set('factory', targetFactoryId);
      if (cleanPiNumber) params.set('project', cleanPiNumber);
      if (cleanPiId) params.set('pi', cleanPiId);
      if (cleanFabric) params.set('fabric', cleanFabric);

      const qs = params.toString();
      navigate(`/pms/loom-daily${qs ? `?${qs}` : ''}`);
    } catch (err) {
      console.error('Failed to load factories for loom-daily redirection:', err);
      navigate('/pms/loom-daily');
    }
  };

  const tabs = [
    {
      id: 'summary',
      label: 'Summary & Approvals',
      icon: ClipboardList,
    },
    {
      id: 'daily',
      label: 'Daily Production Register',
      icon: ListChecks,
    },
    {
      id: 'all',
      label: 'Show All',
      icon: LayoutGrid,
    },
  ];

  return (
    <div className="pms-screen w-full space-y-6">
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

      {/* Screen Section Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="inline-flex max-w-full overflow-x-auto no-scrollbar p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl shadow-2xs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5">
          <span>Active view: <b className="text-slate-700 dark:text-slate-300 font-semibold">{tabs.find((t) => t.id === activeTab)?.label}</b></span>
        </div>
      </div>

      {/* Section 1: Summary card */}
      {(activeTab === 'summary' || activeTab === 'all') && (
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
                onClick={() => setConfirmCompleteOpen(true)}
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
            {/* Generate Final PO: ONLY show if PO has NOT already been generated */}
            {hasData && !isPoGenerated && canGeneratePo(status) && (
              <button
                type="button"
                onClick={() => setShowGeneratePoModal(true)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <FileText size={14} /> Generate Final PO
              </button>
            )}
            {/* When PO is already generated: 'Generate Final PO' is disabled & gone from screen. Show View Final PO */}
            {hasData && isPoGenerated && (
              <button
                type="button"
                onClick={() => {
                  if (finalPoId) {
                    navigate(`/purchase/orders?po=${encodeURIComponent(finalPoId)}`);
                  } else {
                    setShowGeneratePoModal(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-[12px] font-bold text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                title={`Final Job Work PO ${finalPoNumber || ''} is already generated. Click to view.`}
              >
                <Eye size={13} /> View Final PO ({finalPoNumber || (isPoApproved ? 'Approved' : 'Generated')})
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
            <button
              type="button"
              onClick={handleAddDailyEntry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Add daily production entry in factory"
            >
              <Plus size={13} /> Add Daily Entry
            </button>
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
            ...(finalPoNumber ? [[
              'Final Job Work PO',
              <span key="fjwpo-val" className="inline-flex items-center gap-1.5 flex-wrap">
                <span>{finalPoNumber}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isPoApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                  {isPoApproved ? 'Approved' : 'Pending Approval'}
                </span>
              </span>
            ]] : []),
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] font-medium text-slate-400">{k}</p>
              <div className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v}</div>
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
      )}

      {/* Section 2: Daily summary */}
      {(activeTab === 'daily' || activeTab === 'all') && (
      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#2563eb] text-[11px] font-extrabold text-white">2</span>
          <h2 className="text-[13px] font-extrabold text-[#2563eb]">Daily Production Summary (Auto from Daily Production)</h2>
        </div>
        <div className="pms-table-container overflow-x-auto">
          <table className="w-full min-w-[860px] text-center text-[12px] pms-sticky-header">
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
              {!loading && paginatedRows.map((r, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-slate-50 text-slate-600 ${idx === paginatedRows.length - 1 ? 'bg-[#f2f7ff]' : ''}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-400">{(summaryPage - 1) * summaryPageSize + idx + 1}</td>
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

        <TablePagination
          total={rows.length}
          page={summaryPage}
          pageSize={summaryPageSize}
          onPageChange={setSummaryPage}
          onPageSizeChange={(newSize) => {
            setSummaryPageSize(newSize);
            setSummaryPage(1);
          }}
          pageSizeOptions={[10, 20, 50]}
        />
      </div>
      )}

      {/* Verify & Approve Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
                  onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowPI(false)}>
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
        initialPoId={finalPoId}
        isEditMode={hasFinalPo}
        isApproved={isPoApproved}
        onSuccess={(res) => {
          setActionNotice(
            res?.finalPoNumber
              ? `Final Job Work PO ${res.finalPoNumber} ${hasFinalPo ? 'updated' : 'created'} successfully.`
              : `Final Job Work PO ${hasFinalPo ? 'updated' : 'created'} successfully.`
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
      <ConfirmModal
        isOpen={confirmCompleteOpen}
        onClose={() => setConfirmCompleteOpen(false)}
        onConfirm={async () => {
          setConfirmCompleteOpen(false);
          await handleComplete();
        }}
        title="Complete Production Instruction"
        message="Mark this instruction as Completed (pending verification)?"
        confirmText="Mark Complete"
        variant="warning"
      />
    </div>
  );
}
