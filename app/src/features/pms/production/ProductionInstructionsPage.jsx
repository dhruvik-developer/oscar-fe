import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Button } from '../../../components/ui/Button';
import {
  Plus, ClipboardList, X, Search, Clock, CheckCircle2, Package, Layers,
  Maximize2, Minimize2, Eye, Pencil, AlertTriangle, Check, ArrowRight,
} from 'lucide-react';
import { toISODate } from '../../../utils/dateUtils';
import PageHeader from '../../../components/ui/PageHeader';
import TablePagination from '../../../components/ui/TablePagination';
import KpiCard from '../../../components/ui/KpiCard';
import { api } from '../../../services/api';
import { loomService } from '../../../services/loomService';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import {
  PRODUCTION_STATUSES, ACTIVE_STATUSES, statusPill, canApprove, canStart,
  canEditInstruction, errorText, fmtNum, listOf,
} from './productionStatus';

const PROCESS_TYPES = ['Weaving', 'Dyeing', 'Processing', 'Printing'];
const LIST_QUERY = { page_size: 200 };

const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function normalizeInstruction(item) {
  if (!item) return item;
  return {
    ...item,
    id: String(item.id),
    piNumber: item.instructionNumber || '',
    date: item.piDate || '',
    vendor: item.agencyName || '',
    fabric: item.fabric || '',
    processType: item.processType || '',
    assignedQty: numOrNull(item.orderMeter),
    producedQty: numOrNull(item.totalProduced ?? item.cumulative),
    balance: numOrNull(item.balance),
    startDate: item.expectedStartDate || '',
    assignedEmployee: item.employeeName || '',
    employeeId: item.employeeId ? String(item.employeeId) : '',
    status: item.status || '',
    remarks: (() => {
      const vr = item.verificationRemarks || item.verification_remarks;
      if (vr) return vr;
      if (item.notes && typeof item.notes === 'string') {
        const trimmed = item.notes.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            return parsed.remarks || parsed.originalNotes || parsed.note || '';
          } catch (e) {
            return '';
          }
        }
        return item.notes;
      }
      return item.notes || '';
    })(),
    agreedJobRate: numOrNull(item.agreedJobRate),
  };
}

export default function ProductionInstructionsPage() {
  const {
    purchaseOrders, formatCurrency, formatDateDDMMYYYY,
    getCurrentISODate, showToast,
  } = useERP();
  const [deleteConfirmPi, setDeleteConfirmPi] = useState(null);
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('query') || searchParams.get('program') || '';
  const urlAutoCreate = searchParams.get('autoCreate') === '1' || searchParams.get('openCreate') === '1';

  const [instructions, setInstructions] = useState([]);
  const [aggregates, setAggregates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeesError, setEmployeesError] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [query, setQuery] = useState(urlQuery);
  const [statusFilter, setStatusFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Create form state
  const [sourceType, setSourceType] = useState('program'); // 'program' | 'po' | 'manual'
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [poId, setPoId] = useState('');
  const [manualAgency, setManualAgency] = useState('');
  const [manualOrderRef, setManualOrderRef] = useState('');
  const [manualFabric, setManualFabric] = useState('');
  const [agreedJobRate, setAgreedJobRate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [piDate, setPiDate] = useState(() => getCurrentISODate());
  const [assignedQty, setAssignedQty] = useState('');
  const [startDate, setStartDate] = useState(() => getCurrentISODate());
  const [processType, setProcessType] = useState('Weaving');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0, openUp: false });

  // Close floating action menu on window / table scroll
  useEffect(() => {
    const handleScroll = () => {
      if (openMenuId) setOpenMenuId(null);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [openMenuId]);

  const handleToggleMenu = (e, piId) => {
    if (openMenuId === piId) {
      setOpenMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 250;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight;

    setMenuPos({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      right: Math.max(12, window.innerWidth - rect.right),
      openUp,
    });
    setOpenMenuId(piId);
  };

  // View / Edit state
  const [viewingPi, setViewingPi] = useState(null);
  const [viewTab, setViewTab] = useState('overview'); // 'overview' | 'progress' | 'match'
  const [piProgress, setPiProgress] = useState(null);
  const [piProgressLoading, setPiProgressLoading] = useState(false);
  const [matchQty, setMatchQty] = useState('');
  const [matchRate, setMatchRate] = useState('');
  const [matchResult, setMatchResult] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');

  const handleOpenViewingPi = (pi) => {
    setViewingPi(pi);
    setViewTab('overview');
    setMatchQty(String(pi.assignedQty || ''));
    setMatchRate(String(pi.agreedRate || pi.agreedJobRate || ''));
    setMatchResult(null);
    setMatchError('');

    // Fetch live progress
    setPiProgressLoading(true);
    api.get(`/production/instructions/${pi.id}/progress/`)
      .then((res) => setPiProgress(res))
      .catch(() => setPiProgress(null))
      .finally(() => setPiProgressLoading(false));
  };

  const handleRunThreeWayMatch = async (e) => {
    e?.preventDefault();
    if (!viewingPi?.id) return;
    setMatchLoading(true);
    setMatchError('');
    try {
      const res = await api.post(`/production/instructions/${viewingPi.id}/three-way-match/`, {
        invoiceQty: parseFloat(matchQty) || 0,
        invoiceRate: parseFloat(matchRate) || 0,
      });
      setMatchResult(res);
    } catch (err) {
      setMatchError(err?.payload?.field_errors ? JSON.stringify(err.payload.field_errors) : (err?.payload?.message || err?.payload?.detail || err?.message || 'Failed to verify three-way match.'));
    } finally {
      setMatchLoading(false);
    }
  };
  const [editingPi, setEditingPi] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editProcessType, setEditProcessType] = useState('');
  const [editEmployee, setEditEmployee] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editError, setEditError] = useState(null);

  const applyProgramFields = useCallback((prog) => {
    if (!prog) return;
    setSelectedProgramId(String(prog.id));
    setAssignedQty(String(prog.target || ''));
    setManualFabric(prog.quality_name || '');
    setStartDate(prog.start || getCurrentISODate());
    setExpectedCompletionDate(prog.deadline || '');
    setProcessType('Weaving');
    const r = prog.stats?.cost_m || prog.stats?.jobCost || prog.quality_job_rate || '';
    if (r) setAgreedJobRate(String(r));
  }, [getCurrentISODate]);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.allSettled([
      api.get('/production/instructions/', { query: LIST_QUERY }),
      api.get('/hrms/employees/', { query: LIST_QUERY }),
      loomService.getPrograms(),
    ])
      .then(([piRes, empRes, progRes]) => {
        let loadedInstructions = [];
        if (piRes.status === 'fulfilled') {
          loadedInstructions = listOf(piRes.value).map(normalizeInstruction);
          setInstructions(loadedInstructions);
          setAggregates(piRes.value && !Array.isArray(piRes.value) ? piRes.value.aggregates || null : null);
        } else {
          setInstructions([]);
          setAggregates(null);
          setError(errorText(piRes.reason, 'Failed to load production instructions'));
        }
        if (empRes.status === 'fulfilled') {
          setEmployees(listOf(empRes.value));
          setEmployeesError(null);
        } else {
          setEmployees([]);
          setEmployeesError(errorText(empRes.reason, 'Failed to load employees'));
        }
        if (progRes.status === 'fulfilled') {
          const progList = Array.isArray(progRes.value) ? progRes.value : progRes.value?.results || [];
          setPrograms(progList);

          // If query param matches a program
          if (urlQuery) {
            const norm = (s) => String(s || '').trim().toLowerCase();
            const matchingProg = progList.find((p) => norm(p.name) === norm(urlQuery));
            if (matchingProg) {
              applyProgramFields(matchingProg);
              setSourceType('program');
              // If autoCreate was requested or no PI exists yet for this program, auto open modal
              const hasExistingPi = loadedInstructions.some((inst) => norm(inst.orderReference) === norm(urlQuery));
              if (urlAutoCreate || !hasExistingPi) {
                setShowAddModal(true);
              }
            }
          }
        } else {
          setPrograms([]);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [urlQuery, urlAutoCreate, applyProgramFields]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const replaceRow = (raw) => {
    const updated = normalizeInstruction(raw);
    setInstructions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setViewingPi((v) => (v && v.id === updated.id ? updated : v));
    return updated;
  };

  const runAction = async (pi, action, label) => {
    setActionError(null);
    setBusyId(pi.id);
    setOpenMenuId(null);
    try {
      const res = await api.post(`/production/instructions/${pi.id}/${action}/`);
      replaceRow(res);
    } catch (err) {
      setActionError(`${label} failed for ${pi.piNumber}: ${errorText(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (pi) => {
    if (!canEditInstruction(pi.status)) return;
    setEditingPi(pi);
    setEditQty(pi.assignedQty === null ? '' : String(pi.assignedQty));
    setEditStart(toISODate(pi.startDate) || '');
    setEditProcessType(pi.processType || '');
    setEditEmployee(pi.employeeId || '');
    setEditRemarks(pi.remarks || '');
    setEditError(null);
    setOpenMenuId(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!(Number(editQty) > 0)) { setEditError('Assigned Qty (Meter) is required.'); return; }
    if (!editEmployee) { setEditError('Assigned Employee is required.'); return; }
    setSaving(true);
    setEditError(null);
    try {
      const payload = {
        orderMeter: Number(editQty),
        processType: editProcessType || null,
        employeeId: editEmployee,
        expectedStartDate: editStart || null,
        notes: editRemarks,
      };
      const res = await api.patch(`/production/instructions/${editingPi.id}/`, payload);
      replaceRow(res);
      setEditingPi(null);
    } catch (err) {
      setEditError(errorText(err, 'Failed to update Production Instruction'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pi) => {
    setActionError(null);
    try {
      await api.delete(`/production/instructions/${pi.id}/`);
      setInstructions((prev) => prev.filter((p) => p.id !== pi.id));
      showToast?.(`Production Instruction ${pi.piNumber} deleted`, 'success');
    } catch (err) {
      const msg = `Delete failed for ${pi.piNumber}: ${errorText(err)}`;
      setActionError(msg);
      showToast?.(msg, 'error');
    }
  };

  const selectedPo = useMemo(() => purchaseOrders.find((p) => p.id === poId) || null, [purchaseOrders, poId]);
  const selectedProgram = useMemo(() => programs.find((p) => String(p.id) === String(selectedProgramId)) || null, [programs, selectedProgramId]);
  const poLines = (po) => po?.items || po?.lineItems || [];
  const poQty = (po) => poLines(po).reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const poFabric = (po) => poLines(po)[0]?.name || '';

  // Produced / balance come from the server (totalProduced / balance), never derived from status.
  const getProduced = (pi) => pi.producedQty;
  const getBalance = (pi) => pi.balance;

  // KPI tiles prefer the server's list aggregates (covers every row, not just the loaded page).
  const countBy = (statuses) => instructions.filter((p) => statuses.includes(p.status)).length;
  const totalInstructions = aggregates?.total ?? instructions.length;
  const inProgressCount = aggregates?.inProgress ?? countBy(ACTIVE_STATUSES);
  const completedCount = aggregates?.completed ?? countBy(['Completed']);
  const verifiedCount = aggregates?.verified ?? countBy(['Verified', 'PO Pending', 'PO Created']);

  const vendors = useMemo(() => [...new Set(instructions.map((p) => p.vendor).filter(Boolean))], [instructions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instructions.filter((p) => {
      if (q && !`${p.piNumber} ${p.orderReference || ''} ${p.vendor} ${p.fabric}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (vendorFilter !== 'All' && p.vendor !== vendorFilter) return false;
      if (dateFrom || dateTo) {
        const iso = toISODate(p.date);
        if (!iso) return false;
        if (dateFrom && iso < dateFrom) return false;
        if (dateTo && iso > dateTo) return false;
      }
      return true;
    });
  }, [instructions, query, statusFilter, vendorFilter, dateFrom, dateTo]);

  // Check if current search query matches an active program
  const matchingProgramForQuery = useMemo(() => {
    if (!query.trim() || !programs.length) return null;
    const q = query.trim().toLowerCase();
    return programs.find((p) => p.name?.toLowerCase() === q || p.name?.toLowerCase().includes(q)) || null;
  }, [programs, query]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, vendorFilter, dateFrom, dateTo]);

  const pagedInstructions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleSelectProgram = (id) => {
    setSelectedProgramId(id);
    const prog = programs.find((p) => String(p.id) === String(id));
    if (prog) {
      applyProgramFields(prog);
    }
  };

  const handleSelectPo = (id) => {
    setPoId(id);
    const po = purchaseOrders.find((p) => p.id === id);
    if (po) {
      setAssignedQty(String(poQty(po) || ''));
      setManualFabric(poFabric(po) || '');
      setStartDate(po.date || getCurrentISODate());
      setExpectedCompletionDate(po.expectedDate || '');
      if (po.rate) setAgreedJobRate(String(po.rate));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(null);

    let agencyName = '';
    let orderReference = '';
    let fabricName = manualFabric;
    let rate = Number(agreedJobRate) || 0;

    if (sourceType === 'program') {
      if (!selectedProgramId) {
        setFormError('Please select a Production Program.');
        return;
      }
      const prog = programs.find((p) => String(p.id) === String(selectedProgramId));
      if (!prog) {
        setFormError('Selected program not found.');
        return;
      }
      agencyName = prog.factory_name || 'In-House Loom Shed';
      orderReference = prog.name;
      fabricName = prog.quality_name || manualFabric || 'Standard Quality';
      if (!rate) {
        rate = Number(prog.stats?.cost_m || prog.stats?.jobCost || 0);
      }
    } else if (sourceType === 'po') {
      if (!poId || !selectedPo) {
        setFormError('Purchase Order is required.');
        return;
      }
      agencyName = selectedPo.vendor;
      orderReference = selectedPo.poNumber;
      fabricName = poFabric(selectedPo) || manualFabric || null;
      if (!rate && Number(selectedPo.rate) > 0) {
        rate = Number(selectedPo.rate);
      }
    } else {
      if (!manualAgency.trim()) {
        setFormError('Agency / Factory name is required.');
        return;
      }
      if (!manualOrderRef.trim()) {
        setFormError('Order Reference / Program code is required.');
        return;
      }
      agencyName = manualAgency.trim();
      orderReference = manualOrderRef.trim();
    }

    if (!piDate) { setFormError('Date is required.'); return; }
    if (!(Number(assignedQty) > 0)) { setFormError('Assigned Qty (Meter) must be greater than 0.'); return; }
    if (!assignedEmployeeId) { setFormError('Assigned Employee is required.'); return; }

    const payload = {
      agencyName,
      orderReference,
      orderMeter: Number(assignedQty),
      piDate,
      expectedStartDate: startDate || null,
      expectedCompletionDate: expectedCompletionDate || null,
      fabric: fabricName || null,
      processType: processType || 'Weaving',
      employeeId: assignedEmployeeId,
      notes: remarks || '',
    };
    if (rate > 0) {
      payload.agreedJobRate = rate;
      payload.agreedRate = rate;
    }

    setSaving(true);
    try {
      const res = await api.post('/production/instructions/', payload);
      const newInst = normalizeInstruction(res);
      setInstructions((prev) => [newInst, ...prev]);
      setAggregates((a) => (a && typeof a.total === 'number' ? { ...a, total: a.total + 1 } : a));
      setShowAddModal(false);
      setIsFullscreen(false);
      setPoId('');
      setSelectedProgramId('');
      setManualAgency('');
      setManualOrderRef('');
      setManualFabric('');
      setAgreedJobRate('');
      setAssignedQty('');
      setRemarks('');
      setAssignedEmployeeId('');
      showToast?.(`Production Instruction ${newInst.piNumber || ''} created successfully!`, 'success');
    } catch (err) {
      setFormError(errorText(err, 'Failed to create Production Instruction'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pms-screen w-full space-y-6">
      <PageHeader
        title="Production Instructions"
        subtitle="Create and manage production instructions for external agencies."
        actions={
          <Button icon={Plus} onClick={() => { setShowAddModal(true); setIsFullscreen(false); setFormError(null); }} className="!rounded-lg !bg-[#2563eb] hover:!bg-[#1d4ed8]">
            Create Production Instruction
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={loadData} className="rounded-md border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100">Retry</button>
        </div>
      )}
      {actionError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-700" title="Dismiss"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Instructions" value={loading ? '—' : fmtNum(totalInstructions)} icon={ClipboardList} tone="blue" />
        <KpiCard label="In Progress" value={loading ? '—' : fmtNum(inProgressCount)} icon={Clock} tone="amber" />
        <KpiCard label="Completed" value={loading ? '—' : fmtNum(completedCount)} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Verified / PO" value={loading ? '—' : fmtNum(verifiedCount)} icon={Layers} tone="purple" />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3.5">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search PI No., vendor, fabric..." className="w-full sm:w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[12px] outline-none placeholder:text-slate-400 focus:border-blue-400" />
          </div>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] font-medium text-slate-600 outline-none">
            <option value="All">All Agencies</option>
            {vendors.map((v) => <option key={v}>{v}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] font-medium text-slate-600 outline-none">
            <option value="All">All Status</option>
            {PRODUCTION_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 px-2">
            <span className="text-[12px] text-slate-400">PI Date</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-[12px] text-slate-600 outline-none" title="Start date from" />
          </div>
          <span className="text-slate-400 text-[11px]">to</span>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 px-2">
            <span className="text-[12px] text-slate-400">End Date</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-[12px] text-slate-600 outline-none" title="End date to" />
          </div>
        </div>

        {/* Quick Issue PI banner if searching for a program that has no PI yet */}
        {Boolean(matchingProgramForQuery && !filtered.length) && (
          <div className="m-3 p-3.5 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-slate-900 dark:to-blue-950/40 text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-blue-600" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100">
                  Production Program "{matchingProgramForQuery.name}" is scheduled
                </h4>
                <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-blue-100 text-blue-800">
                  {matchingProgramForQuery.factory_name}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11.5px]">
                Quality: <strong>{matchingProgramForQuery.quality_name}</strong> · Target: <strong>{fmtNum(matchingProgramForQuery.target)} M</strong>. No Production Work Instruction (PI) has been issued for this program yet.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSourceType('program');
                handleSelectProgram(String(matchingProgramForQuery.id));
                setShowAddModal(true);
                setIsFullscreen(false);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm cursor-pointer transition-colors"
            >
              <Plus size={14} /> Issue PI for "{matchingProgramForQuery.name}"
            </button>
          </div>
        )}

        <div className="pms-table-container min-h-[220px]">
          <table className="w-full min-w-[1280px] border-collapse text-left text-[12px] pms-sticky-header">
            <thead>
              <tr className="border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                {['PI No.', 'PI Date', 'Agency/Vendor', 'Fabric', 'Process Type', 'Order Qty (M)', 'Produced Qty (M)', 'Balance Qty (M)', 'Expected Start', 'Assigned Employee', 'Status'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${i >= 5 && i <= 7 ? 'text-right' : ''} ${i === 10 ? 'text-center' : ''}`}>{h}</th>
                ))}
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedInstructions.map((pi, idx) => (
                <tr key={pi.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-center text-slate-400 font-mono">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button onClick={() => navigate(`/pms/production-completion?pi=${encodeURIComponent(pi.id)}`)} className="font-mono font-bold text-blue-600 hover:underline" title="Open Production Completion & Verification">{pi.piNumber}</button>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{pi.date ? formatDateDDMMYYYY(pi.date) : '—'}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap">{pi.vendor}</td>
                  <td className="px-3 py-2.5 text-slate-600 font-medium whitespace-nowrap">{pi.fabric || '—'}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-600 whitespace-nowrap">{pi.processType || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">{fmtNum(pi.assignedQty)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">{fmtNum(getProduced(pi))}</td>
                  <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${Number(getBalance(pi)) < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{fmtNum(getBalance(pi))}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{pi.startDate ? formatDateDDMMYYYY(pi.startDate) : '—'}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{pi.assignedEmployee || '—'}</td>
                  <td className="px-3 py-2.5 text-center"><span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${statusPill(pi.status)}`}>{pi.status || '—'}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      {canApprove(pi.status) && (
                        <button type="button" disabled={busyId === pi.id} onClick={() => runAction(pi, 'approve', 'Approve')} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50" title="Approve this instruction">
                          {busyId === pi.id ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                      {canStart(pi.status) && (
                        <button type="button" disabled={busyId === pi.id} onClick={() => runAction(pi, 'start', 'Start')} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50" title="Start production (Running)">
                          {busyId === pi.id ? 'Starting…' : 'Start'}
                        </button>
                      )}
                      <button onClick={() => setViewingPi(pi)} className="p-2 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                        <Eye size={14} />
                      </button>
                      {canEditInstruction(pi.status) && (
                        <button onClick={() => openEdit(pi)} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors" title="Edit">
                          <Pencil size={14} />
                        </button>
                      )}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => handleToggleMenu(e, pi.id)}
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="More actions"
                          aria-expanded={openMenuId === pi.id}
                        >
                          <span className="text-[14px] font-bold leading-none tracking-widest">...</span>
                        </button>
                        {openMenuId === pi.id && (
                          <>
                            <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setOpenMenuId(null)} />
                            <div
                              style={{
                                position: 'fixed',
                                ...(menuPos.openUp
                                  ? { bottom: `${window.innerHeight - menuPos.top}px` }
                                  : { top: `${menuPos.top}px` }),
                                right: `${menuPos.right}px`,
                              }}
                              className="z-50 w-52 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                            >
                              <button
                                type="button"
                                onClick={() => { setOpenMenuId(null); handleOpenViewingPi(pi); }}
                                className="block w-full px-3.5 py-2 text-left text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                              >
                                View details
                              </button>
                              {canEditInstruction(pi.status) && (
                                <button
                                  type="button"
                                  onClick={() => openEdit(pi)}
                                  className="block w-full px-3.5 py-2 text-left text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                                >
                                  Edit
                                </button>
                              )}
                              {canApprove(pi.status) && (
                                <button
                                  type="button"
                                  disabled={busyId === pi.id}
                                  onClick={() => runAction(pi, 'approve', 'Approve')}
                                  className="block w-full px-3.5 py-2 text-left text-[12px] font-medium text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors disabled:opacity-50"
                                >
                                  Approve
                                </button>
                              )}
                              {canStart(pi.status) && (
                                <button
                                  type="button"
                                  disabled={busyId === pi.id}
                                  onClick={() => runAction(pi, 'start', 'Start')}
                                  className="block w-full px-3.5 py-2 text-left text-[12px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-50"
                                >
                                  Start production
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => { setOpenMenuId(null); navigate(`/pms/daily-production?pi=${encodeURIComponent(pi.id)}`); }}
                                className="block w-full px-3.5 py-2 text-left text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                              >
                                Daily production
                              </button>
                              <button
                                type="button"
                                onClick={() => { setOpenMenuId(null); navigate(`/pms/production-completion?pi=${encodeURIComponent(pi.id)}`); }}
                                className="block w-full px-3.5 py-2 text-left text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                              >
                                Open completion
                              </button>
                              {pi.status === 'Draft' && (
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuId(null); setDeleteConfirmPi(pi); }}
                                  className="block w-full px-3.5 py-2 text-left text-[12px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                    Loading production instructions...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-500"><ClipboardList size={20} /></div>
                    <p className="mt-3 text-[13px] font-extrabold text-[#17294e]">{error ? 'Could not load instructions' : 'No records found'}</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">{error ? 'See the error above and retry.' : instructions.length ? 'No instructions match the current filters.' : 'Create a production instruction from a Purchase Order.'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          />
        </div>
      </div>

      {showAddModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-200 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
          <div className={`bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${isFullscreen ? 'w-full h-full rounded-none p-4 sm:p-8' : 'max-w-3xl w-full rounded-2xl p-4 sm:p-6 max-h-[95vh] sm:max-h-[92vh]'} text-xs`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-[#1F2E4A]">Create Production Instruction (PI)</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Issue formal manufacturing or job-work instruction from a Program Batch, Purchase Order, or custom reference.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition" title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Fullscreen'}>
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button type="button" onClick={() => { setShowAddModal(false); setIsFullscreen(false); }} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              {/* Instruction Source Switcher */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                <label className="block font-bold text-slate-800 text-xs">
                  Instruction Source <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceType('program');
                      if (programs.length && !selectedProgramId) handleSelectProgram(String(programs[0].id));
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                      sourceType === 'program'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Layers size={14} /> Production Program (Batch)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceType('po');
                      if (purchaseOrders.length && !poId) handleSelectPo(purchaseOrders[0].id);
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                      sourceType === 'po'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ClipboardList size={14} /> Purchase Order (PO)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType('manual')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                      sourceType === 'manual'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Pencil size={14} /> Direct / Manual Entry
                  </button>
                </div>

                {sourceType === 'program' && (
                  <div className="pt-2 space-y-2">
                    <label className="block font-semibold text-slate-700">
                      Select Loom Production Program <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedProgramId}
                      onChange={(e) => handleSelectProgram(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                    >
                      <option value="">{programs.length ? 'Select a Production Program...' : 'No programs found'}</option>
                      {programs.map((prog) => (
                        <option key={prog.id} value={prog.id}>
                          {prog.name} — {prog.factory_name} ({prog.quality_name}, {fmtNum(prog.target)} M)
                        </option>
                      ))}
                    </select>
                    {selectedProgram && (
                      <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>Factory: {selectedProgram.factory_name}</span>
                          <span className="text-blue-700 font-mono text-[10.5px] bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                            Target: {fmtNum(selectedProgram.target)} M
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 text-[10px]">
                          <span>Quality: <strong>{selectedProgram.quality_name}</strong></span>
                          <span>Start: <strong>{selectedProgram.start}</strong></span>
                          <span>Deadline: <strong>{selectedProgram.deadline}</strong></span>
                          <span>Status: <strong>{selectedProgram.status}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sourceType === 'po' && (
                  <div className="pt-2 space-y-2">
                    <label className="block font-semibold text-slate-700">
                      Purchase Order (PO) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={poId}
                      onChange={(e) => handleSelectPo(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                    >
                      <option value="">{purchaseOrders.length ? 'Select Purchase Order...' : 'No purchase orders available'}</option>
                      {purchaseOrders.map((po) => (
                        <option key={po.id} value={po.id}>
                          {po.poNumber} ({formatDateDDMMYYYY(po.date)}) - {po.vendor} - {poQty(po).toLocaleString('en-IN')} M
                        </option>
                      ))}
                    </select>
                    {selectedPo && (
                      <div className="mt-2 p-2.5 rounded-xl border border-blue-200 bg-blue-50 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>Vendor: {selectedPo.vendor}</span>
                          <span className="text-emerald-700 font-mono text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            PO Value: {formatCurrency(selectedPo.amount ?? selectedPo.total ?? 0)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 text-[10px]">
                          <span>PO Date: <strong>{formatDateDDMMYYYY(selectedPo.date)}</strong></span>
                          <span>Expected: <strong>{formatDateDDMMYYYY(selectedPo.expectedDate)}</strong></span>
                          <span>Status: <strong>{selectedPo.status}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sourceType === 'manual' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Agency / Factory Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualAgency}
                        onChange={(e) => setManualAgency(e.target.value)}
                        placeholder="e.g. Shree Laxmi Fab / Unit 1"
                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                        required={sourceType === 'manual'}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Order Reference / Batch <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualOrderRef}
                        onChange={(e) => setManualOrderRef(e.target.value)}
                        placeholder="e.g. Batch-2170-Nov"
                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                        required={sourceType === 'manual'}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <h4 className="flex items-center gap-2 text-[13px] font-extrabold text-[#17294e]"><ClipboardList size={15} className="text-blue-500" /> Basic Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">PI Number</label>
                    <input type="text" readOnly value="Auto-Generate" className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-500 font-medium cursor-not-allowed" />
                    <p className="text-[10px] text-slate-400 mt-1">PI number will be generated automatically on save.</p>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date *</label>
                    <input type="date" required value={piDate} onChange={(e) => setPiDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Expected Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                </div>
                <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-700">
                  New instructions are saved as <strong>Draft</strong>. Approve and start them from the list before recording daily production.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <h4 className="flex items-center gap-2 text-[13px] font-extrabold text-[#17294e]"><Package size={15} className="text-blue-500" /> Production Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Fabric Quality</label>
                    <input
                      type="text"
                      value={manualFabric}
                      onChange={(e) => setManualFabric(e.target.value)}
                      placeholder="e.g. 2170 / Cotton 60s"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assigned Qty (Meter) *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      value={assignedQty}
                      onChange={(e) => setAssignedQty(e.target.value)}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }}
                      placeholder="Meters"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Process Type *</label>
                    <select required value={processType} onChange={(e) => setProcessType(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                      {PROCESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">Assigned Employee *</label>
                      <MasterSourceLink source="employees" />
                    </div>
                    <select
                      required
                      value={assignedEmployeeId}
                      onChange={(e) => setAssignedEmployeeId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                    >
                      <option value="">Select Employee...</option>
                      {employees.map((em) => (
                        <option key={em.id} value={em.id}>
                          {em.name}{em.employeeCode ? ` (${em.employeeCode})` : ''} - {em.status}
                        </option>
                      ))}
                    </select>
                    {employeesError && <p className="mt-1 text-[10.5px] font-semibold text-rose-600">{employeesError}</p>}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Agreed Job Rate (₹/M)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={agreedJobRate}
                      onChange={(e) => setAgreedJobRate(e.target.value)}
                      placeholder="e.g. 8.40"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Remark (Optional)</label>
                    <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Special instructions, production notes, etc." maxLength={500} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{formError}</span>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => { setShowAddModal(false); setIsFullscreen(false); }} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : 'Save Production Instruction'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingPi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4" onClick={() => setViewingPi(null)}>
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 sm:p-6 max-w-2xl w-full text-xs flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#1F2E4A] font-mono">{viewingPi.piNumber}</h3>
                <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusPill(viewingPi.status)}`}>
                  {viewingPi.status}
                </span>
              </div>
              <button type="button" onClick={() => setViewingPi(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 gap-2 mt-3 text-xs overflow-x-auto no-scrollbar whitespace-nowrap">
              <button
                type="button"
                onClick={() => setViewTab('overview')}
                className={`pb-2 px-3 font-bold border-b-2 transition cursor-pointer ${
                  viewTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Instruction Info
              </button>
              <button
                type="button"
                onClick={() => setViewTab('progress')}
                className={`pb-2 px-3 font-bold border-b-2 transition cursor-pointer ${
                  viewTab === 'progress'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Production Progress
              </button>
              <button
                type="button"
                onClick={() => setViewTab('match')}
                className={`pb-2 px-3 font-bold border-b-2 transition cursor-pointer ${
                  viewTab === 'match'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Three-Way Match Verification
              </button>
            </div>

            <div className="mt-4 overflow-y-auto pr-1 flex-1 space-y-4">
              {/* TAB 1: OVERVIEW */}
              {viewTab === 'overview' && (
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {[
                    ['PI Number', viewingPi.piNumber || '—'],
                    ['Order Reference', viewingPi.orderReference || '—'],
                    ['PI Date', viewingPi.date ? formatDateDDMMYYYY(viewingPi.date) : '—'],
                    ['Vendor / Mill', viewingPi.vendor || '—'],
                    ['Fabric Quality', viewingPi.fabric || '—'],
                    ['Process Type', viewingPi.processType || '—'],
                    ['Assigned Employee', viewingPi.assignedEmployee || '—'],
                    ['Assigned Qty (M)', fmtNum(viewingPi.assignedQty)],
                    ['Produced (M)', fmtNum(getProduced(viewingPi))],
                    ['Balance (M)', fmtNum(getBalance(viewingPi))],
                    ['Expected Start', viewingPi.startDate ? formatDateDDMMYYYY(viewingPi.startDate) : '—'],
                    ['Grey Lot', viewingPi.greyLotNo || '—'],
                    ['Final PO', viewingPi.finalPoNumber || '—'],
                    ['Remarks', viewingPi.remarks || '—'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{k}</dt>
                      <dd className="mt-0.5 text-[11.5px] font-semibold text-slate-700">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* TAB 2: PROGRESS */}
              {viewTab === 'progress' && (
                <div className="space-y-4">
                  {piProgressLoading ? (
                    <div className="py-8 text-center text-slate-400">Loading progress data...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Order Meters</span>
                          <span className="font-mono font-bold text-base text-slate-900 block mt-0.5">
                            {Number(piProgress?.orderMeter || viewingPi.assignedQty || 0).toLocaleString()} m
                          </span>
                        </div>
                        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-blue-700 block">Cumulative Produced</span>
                          <span className="font-mono font-bold text-base text-blue-900 block mt-0.5">
                            {Number(piProgress?.cumulative || getProduced(viewingPi) || 0).toLocaleString()} m
                          </span>
                        </div>
                        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Balance Remaining</span>
                          <span className="font-mono font-bold text-base text-emerald-900 block mt-0.5">
                            {Number(piProgress?.balance ?? getBalance(viewingPi) ?? 0).toLocaleString()} m
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {(() => {
                        const target = Number(piProgress?.orderMeter || viewingPi.assignedQty || 1);
                        const done = Number(piProgress?.cumulative || getProduced(viewingPi) || 0);
                        const pct = Math.min(100, Math.round((done / (target || 1)) * 100));
                        return (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <div className="flex justify-between font-semibold text-slate-700">
                              <span>Production Completion Progress</span>
                              <span className="font-mono font-bold text-blue-600">{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                              <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Verified production entries cumulative total towards order meter target.
                            </p>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: THREE-WAY MATCH */}
              {viewTab === 'match' && (
                <div className="space-y-4">
                  <form onSubmit={handleRunThreeWayMatch} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                      Verify Vendor Agency Bill (3-Way Match)
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Quantity (Meters) *</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={matchQty}
                          onChange={(e) => setMatchQty(e.target.value)}
                          onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Rate (₹/M) *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={matchRate}
                          onChange={(e) => setMatchRate(e.target.value)}
                          onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={matchLoading}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {matchLoading ? 'Verifying...' : 'Check 3-Way Match'}
                      </button>
                    </div>
                  </form>

                  {matchError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                      <AlertTriangle size={14} /> {matchError}
                    </div>
                  )}

                  {matchResult && (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="font-bold text-slate-800 text-xs">Matching Verification Result</span>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          matchResult.matched
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300'
                        }`}>
                          {matchResult.matched ? 'Verified & Matched' : 'Mismatch Flagged'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Quantity Comparison</span>
                          <p className="mt-1">Verified Qty: <strong className="font-mono">{matchResult.verifiedQty} m</strong></p>
                          <p>PO Qty: <strong className="font-mono">{matchResult.poQty} m</strong></p>
                          <p className={`font-mono font-bold mt-1 ${Math.abs(matchResult.qtyDiff) > 0.01 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            Diff: {matchResult.qtyDiff > 0 ? `+${matchResult.qtyDiff}` : matchResult.qtyDiff} m
                          </p>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Rate Comparison</span>
                          <p className="mt-1">Agreed Rate: <strong className="font-mono">₹{matchResult.agreedRate}</strong></p>
                          <p>PO Rate: <strong className="font-mono">₹{matchResult.poRate}</strong></p>
                          <p className={`font-mono font-bold mt-1 ${Math.abs(matchResult.rateDiff) > 0.01 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            Diff: ₹{matchResult.rateDiff > 0 ? `+${matchResult.rateDiff}` : matchResult.rateDiff}
                          </p>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Final PO: <strong className="text-slate-800">{matchResult.poNumber || 'PO Pending'}</strong> | Instruction: <strong className="text-slate-800">{matchResult.instructionNo}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 mt-4">
              <button
                type="button"
                onClick={() => setViewingPi(null)}
                className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4" onClick={() => setEditingPi(null)}>
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 sm:p-6 max-w-lg w-full text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-[#1F2E4A]">Edit Production Instruction</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{editingPi.piNumber} · {editingPi.orderReference || '—'} · {editingPi.vendor} · <span className={`inline-block rounded-md border px-1.5 text-[10px] font-bold ${statusPill(editingPi.status)}`}>{editingPi.status}</span></p>
              </div>
              <button type="button" onClick={() => setEditingPi(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Qty (Meter) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault(); }}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Process Type</label>
                  <select value={editProcessType} onChange={(e) => setEditProcessType(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    {!editProcessType && <option value="">Select process type...</option>}
                    {editProcessType && !PROCESS_TYPES.includes(editProcessType) && <option value={editProcessType}>{editProcessType}</option>}
                    {PROCESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Assigned Employee *</label>
                    <MasterSourceLink source="employees" />
                  </div>
                  <select required value={editEmployee} onChange={(e) => setEditEmployee(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">Select Employee...</option>
                    {editEmployee && !employees.some((em) => String(em.id) === editEmployee) && (
                      <option value={editEmployee}>{editingPi.assignedEmployee || 'Current employee'}</option>
                    )}
                    {employees.map((em) => (
                      <option key={em.id} value={String(em.id)}>
                        {em.name}{em.employeeCode ? ` (${em.employeeCode})` : ''} - {em.status}
                      </option>
                    ))}
                  </select>
                  {employeesError && <p className="mt-1 text-[10.5px] font-semibold text-rose-600">{employeesError}</p>}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Start Date</label>
                  <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Remark (Optional)</label>
                  <input type="text" value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} maxLength={500} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
              </div>
              <p className="text-[10.5px] text-slate-400">Status changes only through Approve / Start / Complete / Verify actions.</p>
              {editError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{editError}</span>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setEditingPi(null)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteConfirmPi)}
        onClose={() => setDeleteConfirmPi(null)}
        onConfirm={async () => {
          const pi = deleteConfirmPi;
          setDeleteConfirmPi(null);
          await handleDelete(pi);
        }}
        title="Delete Production Instruction"
        message={deleteConfirmPi ? `Are you sure you want to delete Production Instruction ${deleteConfirmPi.piNumber}? This cannot be undone.` : ''}
        confirmText="Delete PI"
        variant="danger"
      />
    </div>
  );
}
