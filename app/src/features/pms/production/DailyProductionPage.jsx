import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, X, AlertTriangle, Lock, Activity,
  CheckCircle2, Clock, Calendar, FileText, Send, Save, AlertCircle,
  ExternalLink, Layers, Factory, Info
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import PageHeader from '../../../components/ui/PageHeader';
import TablePagination from '../../../components/ui/TablePagination';
import { api } from '../../../services/api';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import { statusPill, isLockedStatus, errorText, fmtNum, listOf } from './productionStatus';

const fmt = fmtNum;
const LIST_QUERY = { page_size: 200 };
const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

const toDDMMYYYY = (iso) => {
  if (!iso) return '—';
  const parts = String(iso).slice(0, 10).split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return iso;
};

function normalizeInstruction(item) {
  if (!item) return null;
  return {
    ...item,
    id: String(item.id),
    piNumber: item.instructionNumber || '',
    date: item.piDate || '',
    vendor: item.agencyName || '',
    fabric: item.fabric || '',
    processType: item.processType || '',
    orderReference: item.orderReference || item.order_reference || '—',
    assignedQty: numOrNull(item.orderMeter),
    totalProduced: numOrNull(item.totalProduced ?? item.cumulative),
    balance: numOrNull(item.balance ?? item.balanceQty),
    rejectedQty: numOrNull(item.rejectedQty ?? item.rejected_qty),
    reprocessQty: numOrNull(item.reprocessQty),
    acceptedQty: numOrNull(item.acceptedQty),
    completionPercentage: numOrNull(item.completionPercentage),
    startDate: item.expectedStartDate || '',
    employeeId: item.employeeId ? String(item.employeeId) : '',
    status: item.status || '',
  };
}

function normalizeEntry(e) {
  if (!e) return null;
  const meters = Number(e.meters ?? e.produced ?? 0);
  const reject = Number(e.rejectMeter ?? e.reject_meter ?? e.rejected ?? e.rejectedQty ?? 0);
  const reprocess = Number(e.reprocessMeter ?? e.reprocess_meter ?? e.reprocess ?? e.reprocessQty ?? 0);
  const rawGood = e.goodMeter ?? e.good_meter ?? e.accepted ?? e.acceptedQty;
  const good = rawGood !== undefined && rawGood !== null && rawGood !== ''
    ? Number(rawGood)
    : Math.max(0, meters - reject - reprocess);

  return {
    id: String(e.id),
    date: e.entryDate || e.entry_date || e.date || '',
    produced: meters,
    rejected: reject,
    reprocess: reprocess,
    accepted: good,
    status: e.status || 'Submitted',
    by: e.employeeName || e.enteredBy || '—',
    remarks: e.remarks || '',
    employeeId: e.enteredByEmployeeId ? String(e.enteredByEmployeeId) : (e.entered_by_employee_id ? String(e.entered_by_employee_id) : ''),
    cumulative: numOrNull(e.cumulativeMeter ?? e.cumulative_meter ?? e.cumulative),
    balance: numOrNull(e.balanceMeter ?? e.balance_meter ?? e.balance),
  };
}

export default function DailyProductionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [instructions, setInstructions] = useState([]);
  const [selectedPiId, setSelectedPiId] = useState(() => searchParams.get('pi') || '');
  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employeesError, setEmployeesError] = useState(null);
  const [entriesError, setEntriesError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [formDate, setFormDate] = useState(todayStr);
  const [formQty, setFormQty] = useState('');
  const [formRejected, setFormRejected] = useState('');
  const [formReprocess, setFormReprocess] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');

  // Load instructions and employees
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      api.get('/production/instructions/', { query: LIST_QUERY }),
      api.get('/hrms/employees/', { query: LIST_QUERY }),
    ])
      .then(([piRes, empRes]) => {
        if (!live) return;
        if (piRes.status === 'fulfilled') {
          const piList = listOf(piRes.value).map(normalizeInstruction).filter(Boolean);
          setInstructions(piList);
          setSelectedPiId((cur) => cur || (piList[0]?.id ?? ''));
        } else {
          setInstructions([]);
          setError(errorText(piRes.reason, 'Failed to load production instructions'));
        }
        if (empRes.status === 'fulfilled') {
          setEmployees(listOf(empRes.value));
          setEmployeesError(null);
        } else {
          setEmployees([]);
          setEmployeesError(errorText(empRes.reason, 'Failed to load employees'));
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => { live = false; };
  }, [reloadKey]);

  const pi = useMemo(
    () => instructions.find((p) => String(p.id) === String(selectedPiId)) || instructions[0] || null,
    [instructions, selectedPiId],
  );

  const piNumber = pi?.piNumber || '—';
  const vendor = pi?.vendor || '—';
  const fabric = pi?.fabric || '—';
  const assignedQty = Number(pi?.assignedQty) || 0;
  const startDate = pi?.startDate || '';
  const piDate = pi?.date || '';
  const status = pi?.status || '';
  const isLocked = isLockedStatus(status);
  const isDraft = status === 'Draft';
  const canRecord = Boolean(pi) && !isLocked && !isDraft;

  // Refresh instruction completion data
  const refreshInstruction = async (id) => {
    try {
      const fresh = normalizeInstruction(await api.get(`/production/instructions/${id}/`));
      setInstructions((prev) => prev.map((p) => (p.id === fresh.id ? fresh : p)));
    } catch (err) {
      setActionError(`Entry saved, but instruction totals could not be refreshed: ${errorText(err)}`);
    }
  };

  // Load daily entries when selected PI changes
  useEffect(() => {
    if (!pi?.id) {
      setEntries([]);
      return;
    }
    let live = true;
    setEntriesLoading(true);
    setEntriesError(null);
    api.get('/production/daily-entries/', { query: { instructionId: pi.id, ...LIST_QUERY } })
      .then((res) => {
        if (!live) return;
        setEntries(listOf(res).map(normalizeEntry).filter(Boolean));
      })
      .catch((err) => {
        if (!live) return;
        setEntries([]);
        setEntriesError(errorText(err, 'Failed to load daily entries'));
      })
      .finally(() => {
        if (live) setEntriesLoading(false);
      });

    return () => { live = false; };
  }, [pi?.id]);

  // Rows with calculated running cumulative and balance
  const rows = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
    let cumulative = 0;
    return sorted.map((e) => {
      if (e.status !== 'Draft') {
        cumulative += Number(e.produced) || 0;
      }
      return {
        ...e,
        cumulative: e.status === 'Draft' ? cumulative : (e.cumulative ?? cumulative),
        balance: e.status === 'Draft' ? Math.max(0, assignedQty - cumulative) : (e.balance ?? Math.max(0, assignedQty - cumulative)),
      };
    });
  }, [entries, assignedQty]);

  useEffect(() => {
    setPage(1);
  }, [pi?.id]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  // Derived Summary Figures
  const validSubmittedEntries = useMemo(() => entries.filter((e) => e.status !== 'Draft'), [entries]);
  const calcTotalProduced = useMemo(() => validSubmittedEntries.reduce((s, e) => s + (Number(e.produced) || 0), 0), [validSubmittedEntries]);
  const calcAccepted = useMemo(() => validSubmittedEntries.reduce((s, e) => s + (Number(e.accepted) || 0), 0), [validSubmittedEntries]);
  const calcRejected = useMemo(() => validSubmittedEntries.reduce((s, e) => s + (Number(e.rejected) || 0), 0), [validSubmittedEntries]);
  const calcReprocess = useMemo(() => validSubmittedEntries.reduce((s, e) => s + (Number(e.reprocess) || 0), 0), [validSubmittedEntries]);
  const totalProduced = pi?.totalProduced ?? calcTotalProduced;
  const balanceQty = pi?.balance ?? Math.max(0, assignedQty - totalProduced);
  const completionPercentage = assignedQty > 0
    ? Math.min(100, Math.round((totalProduced / assignedQty) * 1000) / 10)
    : 0;

  // Live preview for modal form
  const modalProduced = Number(formQty) || 0;
  const modalRejected = Number(formRejected) || 0;
  const modalReprocess = Number(formReprocess) || 0;
  const modalAccepted = Math.max(0, modalProduced - modalRejected - modalReprocess);

  const openAdd = () => {
    if (!canRecord) return;
    setEditing(null);
    setFormDate(todayStr);
    setFormQty('');
    setFormRejected('');
    setFormReprocess('');
    setFormRemarks('');
    setFormEmployeeId(pi?.employeeId || '');
    setFormError(null);
    setFieldErrors({});
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setFormDate(row.date ? String(row.date).slice(0, 10) : todayStr);
    setFormQty(String(row.produced || ''));
    setFormRejected(String(row.rejected || ''));
    setFormReprocess(String(row.reprocess || ''));
    setFormRemarks(row.remarks || '');
    setFormEmployeeId(row.employeeId || pi?.employeeId || '');
    setFormError(null);
    setFieldErrors({});
    setShowModal(true);
  };

  const handleSave = async (actionType = 'Submitted') => {
    setFormError(null);
    setFieldErrors({});
    const errors = {};

    if (!formDate) {
      errors.date = 'Date is required.';
    } else if (formDate > todayStr) {
      errors.date = 'Production Date cannot be in the future.';
    }

    const numQty = Number(formQty);
    if (!numQty || numQty <= 0 || isNaN(numQty)) {
      errors.qty = 'Produced quantity must be greater than 0.';
    } else if (balanceQty > 0 && numQty > (balanceQty * 1.25)) {
      errors.qty = `Produced quantity exceeds remaining balance (${balanceQty.toLocaleString('en-IN')} Mtr) by more than 25%.`;
    }

    const numRej = Number(formRejected) || 0;
    if (numRej < 0) errors.rejected = 'Rejected quantity cannot be negative.';
    else if (numRej > numQty) errors.rejected = 'Cannot exceed produced quantity.';

    const numRep = Number(formReprocess) || 0;
    if (numRep < 0) errors.reprocess = 'Reprocess quantity cannot be negative.';
    else if (numRep > numQty) errors.reprocess = 'Cannot exceed produced quantity.';

    if ((numRej + numRep) > numQty) {
      errors.rejected = 'Sum of reject and reprocess cannot exceed produced quantity.';
    }

    if (!pi?.id) {
      errors.instruction = 'Select a Production Instruction first.';
    }

    const empId = formEmployeeId;
    if (!editing && !empId) {
      errors.employee = 'Select the employee who produced this entry.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please resolve the errors highlighted above.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const payload = {
          entry_date: formDate,
          entryDate: formDate,
          meters: numQty,
          reject_meter: numRej,
          rejectMeter: numRej,
          reprocess_meter: numRep,
          reprocessMeter: numRep,
          good_meter: modalAccepted,
          goodMeter: modalAccepted,
          remarks: formRemarks,
          status: actionType,
        };
        if (empId) {
          payload.enteredByEmployeeId = empId;
          payload.entered_by_employee_id = empId;
        }
        const updated = await api.patch(`/production/daily-entries/${editing.id}/`, payload);
        const norm = normalizeEntry(updated);
        setEntries((prev) => prev.map((item) => (item.id === norm.id ? norm : item)));
      } else {
        const payload = {
          instructionId: pi.id,
          instruction_id: pi.id,
          entry_date: formDate,
          entryDate: formDate,
          meters: numQty,
          reject_meter: numRej,
          rejectMeter: numRej,
          reprocess_meter: numRep,
          reprocessMeter: numRep,
          good_meter: modalAccepted,
          goodMeter: modalAccepted,
          enteredByEmployeeId: empId,
          entered_by_employee_id: empId,
          remarks: formRemarks,
          status: actionType,
        };
        const created = await api.post('/production/daily-entries/', payload);
        const norm = normalizeEntry(created);
        setEntries((prev) => [...prev, norm]);
      }
      setShowModal(false);
      await refreshInstruction(pi.id);
    } catch (err) {
      setFormError(errorText(err, 'Failed to save daily entry'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDraft = async (id) => {
    try {
      await api.post(`/production/daily-entries/${id}/submit/`);
      if (pi?.id) {
        await refreshInstruction(pi.id);
        const res = await api.get('/production/daily-entries/', { query: { instructionId: pi.id, ...LIST_QUERY } });
        setEntries(listOf(res).map(normalizeEntry).filter(Boolean));
      }
    } catch (err) {
      setActionError(errorText(err, 'Failed to submit draft entry'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    setActionError(null);
    try {
      await api.delete(`/production/daily-entries/${id}/`);
      setEntries((prev) => prev.filter((item) => item.id !== id));
      if (pi?.id) await refreshInstruction(pi.id);
    } catch (err) {
      setActionError(errorText(err, 'Failed to delete entry'));
    }
  };

  const handleQuickActivate = async () => {
    if (!pi?.id) return;
    setActivating(true);
    setActionError(null);
    try {
      if (pi.status === 'Draft') {
        await api.post(`/production/instructions/${pi.id}/approve/`);
      }
      await api.post(`/production/instructions/${pi.id}/start/`);
      await refreshInstruction(pi.id);
    } catch (err) {
      setActionError(`Could not activate instruction: ${errorText(err)}`);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daily Production Entry"
        subtitle={`Record daily grey fabric production output from ${vendor} against Production Instruction ${piNumber}.`}
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'PMS' },
          { label: 'Daily Production Entry' },
          { label: piNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {instructions.length > 0 && (
              <select
                value={pi?.id || ''}
                onChange={(e) => {
                  setSelectedPiId(e.target.value);
                  setSearchParams({ pi: e.target.value });
                  setActionError(null);
                }}
                className="rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none"
              >
                {instructions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.piNumber} — {p.vendor} ({p.fabric || 'Grey Fabric'}) [{p.status}]
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => navigate('/pms/production-instructions')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-bold text-[#2563eb] hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Instructions
            </button>
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="rounded-md border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100">Retry</button>
        </div>
      )}
      {actionError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-700" title="Dismiss"><X size={14} /></button>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-[#e2eaf5] bg-white px-4 py-8 text-center text-[12px] text-slate-500">
          Loading production instructions...
        </div>
      )}

      {!loading && !error && instructions.length === 0 && (
        <div className="rounded-xl border border-[#e2eaf5] bg-white px-4 py-10 text-center">
          <p className="text-[13px] font-extrabold text-[#17294e]">No production instructions yet</p>
          <p className="mt-1 text-[11.5px] text-slate-400">Create and approve a production instruction before recording daily production.</p>
        </div>
      )}

      {pi && isDraft && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <span>This instruction is in Draft. Approve and start it to enable official daily production entries.</span>
          </div>
          <button
            type="button"
            disabled={activating}
            onClick={handleQuickActivate}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {activating ? 'Activating…' : 'Approve & Start Now'}
          </button>
        </div>
      )}

      {pi && isLocked && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-semibold text-slate-600">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>This instruction is {status}. Daily production is verified/locked and cannot be altered.</span>
        </div>
      )}

      {pi && (
        <>
          {/* Linked Details — Read Only */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Lock size={13} className="text-slate-400" />
                <span>Linked Details (Read Only from PO & Instruction)</span>
              </div>
              <span className="text-[11px] text-slate-400 italic">Non-editable reference values</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Linked PO / Ref</p>
                <p className="font-mono font-bold text-slate-800 truncate">{pi.orderReference || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Instruction No.</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono font-bold text-teal-700">{piNumber}</span>
                  {status && <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${statusPill(status)}`}>{status}</span>}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Vendor / Agency</p>
                <p className="font-semibold text-slate-800 truncate">{vendor}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Fabric Quality</p>
                <p className="font-semibold text-slate-800 truncate">{fabric}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Instructed Qty</p>
                <p className="font-mono font-bold text-slate-900">{assignedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Mtr</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Start Date</p>
                <p className="font-mono text-slate-700">{toDDMMYYYY(startDate || piDate)}</p>
              </div>
            </div>
          </div>

          {/* Auto-Calculated Production Summary Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-teal-600" />
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800">
                  Auto-Calculated Production Summary
                </h3>
              </div>
              <span className="text-xs font-bold text-teal-700">{completionPercentage}% Completed</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden border border-slate-200">
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, completionPercentage)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">PO / Instructed</p>
                <p className="text-sm font-mono font-bold text-slate-900 mt-1">{fmt(assignedQty)} <span className="text-[10px] font-sans text-slate-400">m</span></p>
              </div>
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
                <p className="text-[10px] uppercase font-bold text-blue-600">Total Produced</p>
                <p className="text-sm font-mono font-bold text-blue-900 mt-1">{fmt(totalProduced)} <span className="text-[10px] font-sans text-blue-500">m</span></p>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                <p className="text-[10px] uppercase font-bold text-emerald-600">Accepted Qty</p>
                <p className="text-sm font-mono font-bold text-emerald-900 mt-1">{fmt(calcAccepted)} <span className="text-[10px] font-sans text-emerald-500">m</span></p>
              </div>
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3">
                <p className="text-[10px] uppercase font-bold text-rose-600">Rejected Qty</p>
                <p className="text-sm font-mono font-bold text-rose-900 mt-1">{fmt(calcRejected)} <span className="text-[10px] font-sans text-rose-500">m</span></p>
              </div>
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3">
                <p className="text-[10px] uppercase font-bold text-purple-600">Reprocess Qty</p>
                <p className="text-sm font-mono font-bold text-purple-900 mt-1">{fmt(calcReprocess)} <span className="text-[10px] font-sans text-purple-500">m</span></p>
              </div>
              <div className={`border rounded-xl p-3 ${balanceQty <= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50/70 border-amber-200 text-amber-900'}`}>
                <p className={`text-[10px] uppercase font-bold ${balanceQty <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {balanceQty <= 0 ? 'Target Met' : 'Balance Qty'}
                </p>
                <p className="text-sm font-mono font-bold mt-1">{fmt(balanceQty)} <span className="text-[10px] font-sans">m</span></p>
              </div>
            </div>
          </div>

          {/* Entries Table Card */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Daily Production Entries ({rows.length})
                </h3>
              </div>
              {canRecord && (
                <Button icon={Plus} onClick={openAdd} className="!rounded-lg !bg-teal-600 hover:!bg-teal-700 text-white font-bold text-xs">
                  Add Daily Entry
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Produced (m)</th>
                    <th className="px-4 py-2.5 text-right">Accepted</th>
                    <th className="px-4 py-2.5 text-right">Rejected</th>
                    <th className="px-4 py-2.5 text-right">Reprocess</th>
                    <th className="px-4 py-2.5 text-right">Cumulative</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5">Entered By</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5">Remarks</th>
                    <th className="px-4 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedRows.map((row, idx) => {
                    const isDraftEntry = row.status === 'Draft';
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-400">{(page - 1) * pageSize + idx + 1}</td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap text-slate-700">{toDDMMYYYY(row.date)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{fmt(row.produced)}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">{fmt(row.accepted)}</td>
                        <td className="px-4 py-3 text-right font-mono text-rose-600">{Number(row.rejected) > 0 ? fmt(row.rejected) : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-purple-600">{Number(row.reprocess) > 0 ? fmt(row.reprocess) : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-700 font-semibold">{fmt(row.cumulative)}</td>
                        <td className={`px-4 py-3 text-right font-mono ${Number(row.balance) < 0 ? 'text-rose-600 font-bold' : 'text-amber-800'}`}>{fmt(row.balance)}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.by}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-full border ${
                            isDraftEntry ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          }`}>
                            {row.status || 'Submitted'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate" title={row.remarks}>{row.remarks || '—'}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {!canRecord ? (
                            <span className="text-slate-400">Locked</span>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              {isDraftEntry && (
                                <button
                                  type="button"
                                  onClick={() => handleSubmitDraft(row.id)}
                                  className="text-teal-600 hover:text-teal-800 font-bold text-[11px] flex items-center gap-0.5 cursor-pointer"
                                  title="Submit Draft"
                                >
                                  <Send size={12} /> Submit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                className="text-slate-400 hover:text-teal-600 cursor-pointer"
                                title="Edit"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row.id)}
                                className="text-rose-400 hover:text-rose-600 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {entriesLoading && (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                        Loading daily entries...
                      </td>
                    </tr>
                  )}
                  {!entriesLoading && entriesError && (
                    <tr><td colSpan={12} className="px-4 py-8 text-center font-semibold text-rose-600">{entriesError}</td></tr>
                  )}
                  {!entriesLoading && !entriesError && rows.length === 0 && (
                    <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">{canRecord ? 'No entries yet. Click "Add Daily Entry" to record production.' : 'No entries recorded.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={page}
              pageSize={pageSize}
              total={rows.length}
              totalItems={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            />
          </div>
        </>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory size={16} className="text-teal-400" />
                <h3 className="text-sm font-bold">{editing ? 'Edit Daily Production Entry' : 'New Daily Production Entry'}</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSave('Submitted'); }} className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[9.5px]">Instruction No:</span>
                  <p className="font-mono font-bold text-slate-800">{piNumber}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[9.5px]">Vendor / Agency:</span>
                  <p className="font-semibold text-slate-800 truncate">{vendor}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-700">Production Date <span className="text-rose-500">*</span></span>
                  <input
                    type="date"
                    max={todayStr}
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono outline-hidden focus:ring-2 focus:ring-teal-200"
                  />
                  {fieldErrors.date && <p className="text-[10.5px] text-rose-600 mt-1">{fieldErrors.date}</p>}
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-700">Today's Produced (Mtr) <span className="text-rose-500">*</span></span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 500.00"
                    value={formQty}
                    onChange={(e) => setFormQty(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-hidden focus:ring-2 focus:ring-teal-200"
                  />
                  {fieldErrors.qty && <p className="text-[10.5px] text-rose-600 mt-1">{fieldErrors.qty}</p>}
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Rejected Quantity (Mtr)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formRejected}
                    onChange={(e) => setFormRejected(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono outline-hidden focus:ring-2 focus:ring-rose-200"
                  />
                  {fieldErrors.rejected && <p className="text-[10.5px] text-rose-600 mt-1">{fieldErrors.rejected}</p>}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Reprocess Quantity (Mtr)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formReprocess}
                    onChange={(e) => setFormReprocess(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono outline-hidden focus:ring-2 focus:ring-purple-200"
                  />
                  {fieldErrors.reprocess && <p className="text-[10.5px] text-rose-600 mt-1">{fieldErrors.reprocess}</p>}
                </label>
              </div>

              {modalProduced > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs flex items-center justify-between">
                  <span className="text-slate-600">Calculated Accepted / Good Output:</span>
                  <span className="font-mono font-bold text-emerald-700">{modalAccepted.toFixed(2)} Mtr</span>
                </div>
              )}

              <label className="block">
                <span className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Entered By Employee</span>
                  <MasterSourceLink source="employees" />
                </span>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-hidden focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Select employee...</option>
                  {formEmployeeId && !employees.some((em) => String(em.id) === formEmployeeId) && (
                    <option value={formEmployeeId}>{editing?.by || pi?.employeeName || 'Assigned employee'}</option>
                  )}
                  {employees.map((em) => (
                    <option key={em.id} value={String(em.id)}>
                      {em.name}{em.employeeCode ? ` (${em.employeeCode})` : ''}
                    </option>
                  ))}
                </select>
                {employeesError && <p className="mt-1 text-[10.5px] font-semibold text-rose-600">{employeesError}</p>}
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Remarks / Production Observations</span>
                <textarea
                  rows={2}
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Enter delays, loom stoppages, defect descriptions..."
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs outline-hidden focus:ring-2 focus:ring-teal-200 resize-none"
                />
              </label>

              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('Draft')}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={13} /> Save Draft
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Send size={13} /> {saving ? 'Saving…' : editing ? 'Update' : 'Submit Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
