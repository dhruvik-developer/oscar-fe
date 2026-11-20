import React, { useState, useEffect, useMemo } from 'react';
import { useERP } from '../../context/ERPContext';
import { useAppStore } from '../../stores/appStore';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { AppPagination } from '../../components/ui/AppPagination';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Plus,
  RefreshCw,
  Send,
  Lock,
  Eye,
  Warehouse,
  Calendar,
  ArrowRight,
  Save,
  History,
  Search,
  Check,
  XCircle,
  User,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Play,
  ClipboardList,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { inventoryService } from '../../services/domainServices';
import { unwrapList, describeApiError } from '../accounts/accountingShared';

const formatMonth = (val) => {
  if (!val) return '—';
  try {
    const parts = String(val).split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return val;
  } catch {
    return val;
  }
};

const formatDateTime = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return val;
  }
};

export const MonthEndAuditPage = () => {
  const { items, calculateItemStock, formatCurrency } = useERP();
  const hasPermission = useAppStore((s) => s.hasPermission);
  const currentUser = useAppStore((s) => s.currentUser);

  const canPerformAudit = currentUser?.is_superuser || hasPermission('perform_audit');

  // Audit list & current selection
  const [audits, setAudits] = useState([]);
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [currentAudit, setCurrentAudit] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Loading & status states
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [postingVariances, setPostingVariances] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [error, setError] = useState(null);

  // Local editable lines
  const [auditRows, setAuditRows] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [countFilterTab, setCountFilterTab] = useState('ALL'); // 'ALL' | 'MATCHED' | 'VARIANCE'

  // Audit History state
  const [isHistoryCompact, setIsHistoryCompact] = useState(true); // Default compact preview
  const [historySearch, setHistorySearch] = useState('');
  const [historyWarehouseFilter, setHistoryWarehouseFilter] = useState('ALL');
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(5);

  // "Start New Audit" modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [creatingAudit, setCreatingAudit] = useState(false);
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [newAuditForm, setNewAuditForm] = useState({
    warehouseId: '',
    periodMonth: defaultPeriod,
    auditorId: '',
    allCategories: true,
    selectedCategories: [],
    notes: '',
  });

  // Post confirmation modal
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  // Initialize auditor when user loads
  useEffect(() => {
    if (currentUser?.id && !newAuditForm.auditorId) {
      setNewAuditForm((prev) => ({ ...prev, auditorId: currentUser.id }));
    }
  }, [currentUser]);

  // Load masters: warehouses, categories, users
  const loadMasters = async () => {
    try {
      const [whRes, catRes, userRes] = await Promise.allSettled([
        inventoryService.getWarehouses(),
        inventoryService.getItemCategories(),
        inventoryService.getUsers(),
      ]);

      if (whRes.status === 'fulfilled') {
        const list = unwrapList(whRes.value);
        setWarehouses(list.filter((w) => !w.code?.startsWith('SYS-')));
      }

      if (catRes.status === 'fulfilled') {
        const catList = unwrapList(catRes.value);
        setCategories(catList);
      }

      if (userRes.status === 'fulfilled') {
        const uList = unwrapList(userRes.value);
        setUsersList(uList);
      } else if (currentUser) {
        setUsersList([currentUser]);
      }
    } catch (e) {
      console.warn('Could not load some audit masters', e);
    }
  };

  // Fallback builder if no backend audit exists yet
  const buildLocalSnapshot = () =>
    (items || []).map((it) => {
      const live = calculateItemStock(it.id);
      const systemQty = live?.available ?? it.availableQty ?? it.stock ?? 0;
      const unitCost = it.costPrice ?? it.unitCost ?? 0;
      return {
        id: `aud-${it.id}`,
        sku: it.sku,
        name: it.name,
        location: it.location || '—',
        systemQty: Number(systemQty),
        physicalCount: Number(systemQty),
        variance: 0,
        varianceCost: 0,
        unitCost: Number(unitCost),
        status: 'Matched',
        reason: '',
      };
    });

  // Load all audit cycles (history)
  const loadAudits = async (preferredId = null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getAudits();
      const list = unwrapList(res);
      setAudits(list);

      if (list.length > 0) {
        if (preferredId && list.some((a) => a.id === preferredId)) {
          setSelectedAuditId(preferredId);
        } else if (!selectedAuditId || !list.some((a) => a.id === selectedAuditId)) {
          // Default to the first audit (latest)
          setSelectedAuditId(list[0].id);
        }
      } else {
        setAuditRows(buildLocalSnapshot());
      }
    } catch (err) {
      setError(describeApiError(err));
      setAuditRows(buildLocalSnapshot());
    } finally {
      setLoading(false);
    }
  };

  // Load detail of selected audit
  const loadAuditDetail = async (id) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const res = await inventoryService.getAudit(id);
      const audit = res?.data || res;
      setCurrentAudit(audit);
      setHasUnsavedChanges(false);

      if (audit?.lines && audit.lines.length > 0) {
        const rows = audit.lines.map((ln) => {
          const sys = Number(ln.system_qty ?? ln.systemQty ?? 0);
          const counted =
            ln.counted_qty !== null && ln.counted_qty !== undefined
              ? Number(ln.counted_qty)
              : ln.countedQty !== null && ln.countedQty !== undefined
              ? Number(ln.countedQty)
              : sys;
          const variance = counted - sys;
          const cost = Number(ln.item?.cost_price ?? ln.item?.costPrice ?? ln.costPrice ?? 0);
          return {
            id: ln.id,
            sku: ln.item?.sku || ln.sku || '—',
            name: ln.item?.name || ln.name || '—',
            location:
              ln.item?.default_location?.name ||
              ln.item?.location ||
              audit.locationName ||
              audit.location?.name ||
              'Main Godown',
            systemQty: sys,
            physicalCount: counted,
            variance: variance,
            varianceCost: variance * cost,
            unitCost: cost,
            reason: ln.reason || '',
            status: variance === 0 ? 'Matched' : 'Variance',
          };
        });
        setAuditRows(rows);
      } else {
        setAuditRows(buildLocalSnapshot());
      }
    } catch (err) {
      setError(describeApiError(err));
      setAuditRows(buildLocalSnapshot());
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadMasters();
    loadAudits();
  }, []);

  useEffect(() => {
    if (selectedAuditId) {
      loadAuditDetail(selectedAuditId);
    }
  }, [selectedAuditId]);

  // Handle count input change
  const handleCountChange = (id, newCount) => {
    const val = parseFloat(newCount) || 0;
    setHasUnsavedChanges(true);
    setAuditRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const diff = val - r.systemQty;
        return {
          ...r,
          physicalCount: val,
          variance: diff,
          varianceCost: diff * r.unitCost,
          status: diff === 0 ? 'Matched' : 'Variance',
        };
      })
    );
  };

  // Handle reason change
  const handleReasonChange = (id, reason) => {
    setHasUnsavedChanges(true);
    setAuditRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, reason } : r))
    );
  };

  // Workflow status transitions
  const handleStartCounting = async () => {
    if (!currentAudit?.id) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      await inventoryService.saveAuditCounts(currentAudit.id, { lines: auditRows });
      setToastMessage(`Audit ${currentAudit.audit_number || currentAudit.auditNumber} is now in Counting.`);
      setHasUnsavedChanges(false);
      setTimeout(() => setToastMessage(null), 4000);
      await loadAuditDetail(currentAudit.id);
      await loadAudits(currentAudit.id);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleMarkReadyForReview = async () => {
    if (!currentAudit?.id) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      // First save any unsaved count entries
      if (hasUnsavedChanges) {
        await inventoryService.saveAuditCounts(currentAudit.id, { lines: auditRows });
      }
      await inventoryService.markAuditReadyForReview(currentAudit.id);
      setToastMessage(`Physical counting complete. Audit ${currentAudit.audit_number || currentAudit.auditNumber} marked Ready for Review.`);
      setHasUnsavedChanges(false);
      setTimeout(() => setToastMessage(null), 4000);
      await loadAuditDetail(currentAudit.id);
      await loadAudits(currentAudit.id);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRevertToCounting = async () => {
    if (!currentAudit?.id) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      await inventoryService.revertAuditToCounting(currentAudit.id);
      setToastMessage(`Audit reopened for recount (Counting status).`);
      setTimeout(() => setToastMessage(null), 4000);
      await loadAuditDetail(currentAudit.id);
      await loadAudits(currentAudit.id);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Save draft counts
  const handleSaveDraftCounts = async () => {
    if (!currentAudit?.id) return;
    setSavingDraft(true);
    setError(null);
    try {
      await inventoryService.saveAuditCounts(currentAudit.id, { lines: auditRows });
      setToastMessage('Physical counts saved successfully as draft.');
      setHasUnsavedChanges(false);
      setTimeout(() => setToastMessage(null), 4000);
      loadAuditDetail(currentAudit.id);
      loadAudits(currentAudit.id);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSavingDraft(false);
    }
  };

  // Post variances to GL & stock movements
  const handleConfirmPostVariances = async () => {
    if (!currentAudit?.id) return;
    setPostingVariances(true);
    setError(null);
    try {
      await inventoryService.postAuditVariances(currentAudit.id, { lines: auditRows });
      setToastMessage('Variances successfully posted to Stock Ledger & General Ledger! Audit certified and closed.');
      setIsPostModalOpen(false);
      setHasUnsavedChanges(false);
      setTimeout(() => setToastMessage(null), 4000);
      await loadAuditDetail(currentAudit.id);
      await loadAudits(currentAudit.id);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setPostingVariances(false);
    }
  };

  // Check duplicate active / posted audit for creation modal
  const checkConflictInModal = useMemo(() => {
    const selectedWh = newAuditForm.warehouseId || null;
    const targetPeriod = newAuditForm.periodMonth;

    const postedMatch = audits.find((a) => {
      const aWhId = a.location?.id || a.location || a.locationId || null;
      const aPeriod = (a.period_month || a.periodMonth || '').substring(0, 7);
      const matchesWh = selectedWh ? String(aWhId) === String(selectedWh) : !aWhId;
      const matchesPeriod = aPeriod === targetPeriod;
      return matchesWh && matchesPeriod && a.status === 'Posted';
    });

    const activeMatch = audits.find((a) => {
      const aWhId = a.location?.id || a.location || a.locationId || null;
      const aPeriod = (a.period_month || a.periodMonth || '').substring(0, 7);
      const matchesWh = selectedWh ? String(aWhId) === String(selectedWh) : !aWhId;
      const matchesPeriod = aPeriod === targetPeriod;
      return (
        matchesWh &&
        matchesPeriod &&
        (a.status === 'Draft' || a.status === 'Counting' || a.status === 'Ready for Review')
      );
    });

    const whName = selectedWh
      ? warehouses.find((w) => String(w.id) === String(selectedWh))?.name || 'Selected Warehouse'
      : 'All Godowns (Global Audit)';

    return { postedMatch, activeMatch, whName };
  }, [newAuditForm, audits, warehouses]);

  // Handle start/resume from new audit modal
  const handleCreateAudit = async (resume = false) => {
    setCreatingAudit(true);
    setError(null);
    try {
      const periodMonth = `${newAuditForm.periodMonth}-01`;
      const payload = {
        period_month: periodMonth,
        location: newAuditForm.warehouseId || null,
        auditor_id: newAuditForm.auditorId || null,
        categories: newAuditForm.allCategories ? [] : newAuditForm.selectedCategories,
        notes: newAuditForm.notes,
        resume_if_exists: resume,
      };

      const res = await inventoryService.createAudit(payload);
      const data = res?.data || res;
      const auditId = data?.id || data?.existingAuditId;

      await loadAudits(auditId);
      if (auditId) setSelectedAuditId(auditId);

      setIsNewModalOpen(false);
      setToastMessage(
        resume
          ? `Resumed active audit ${data?.audit_number || data?.auditNumber || ''}.`
          : 'New month-end stock audit created and book quantities captured.'
      );
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      const apiErr = err?.response?.data;
      if (apiErr?.code === 'ACTIVE_AUDIT_EXISTS' && apiErr?.existingAuditId) {
        setSelectedAuditId(apiErr.existingAuditId);
        setIsNewModalOpen(false);
        setToastMessage(`Switched to existing active audit (${apiErr.auditNumber}).`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setError(describeApiError(err));
      }
    } finally {
      setCreatingAudit(false);
    }
  };

  const isAuditDraft = currentAudit?.status === 'Draft';
  const isAuditCounting = currentAudit?.status === 'Counting';
  const isAuditReadyForReview = currentAudit?.status === 'Ready for Review';
  const isAuditPosted = currentAudit?.status === 'Posted';
  const isAuditCancelled = currentAudit?.status === 'Cancelled';
  const isAuditReadOnly = isAuditPosted || isAuditCancelled;

  // 4 Summary figures (Exact requirements)
  const totalItemsToCount = auditRows.length;
  const itemsMatched = auditRows.filter((i) => i.variance === 0).length;
  const itemsWithVariance = auditRows.filter((i) => i.variance !== 0).length;
  const reconciliationAccuracy =
    totalItemsToCount > 0 ? ((itemsMatched / totalItemsToCount) * 100).toFixed(1) : '100.0';
  const netVarianceCost = auditRows.reduce((acc, i) => acc + (i.varianceCost || 0), 0);

  // Filtered rows for physical count table
  const displayedRows = useMemo(() => {
    return auditRows.filter((r) => {
      if (countFilterTab === 'MATCHED') return r.variance === 0;
      if (countFilterTab === 'VARIANCE') return r.variance !== 0;
      return true;
    });
  }, [auditRows, countFilterTab]);

  // Unique periods in audits for history filter
  const uniqueAuditPeriods = useMemo(() => {
    const set = new Set();
    audits.forEach((a) => {
      const p = (a.period_month || a.periodMonth || '').substring(0, 7);
      if (p) set.add(p);
    });
    return Array.from(set).sort().reverse();
  }, [audits]);

  // Filtered History list
  const filteredHistory = useMemo(() => {
    return audits.filter((a) => {
      // Status filter
      if (historyStatusFilter !== 'ALL' && a.status !== historyStatusFilter) return false;

      // Warehouse filter
      if (historyWarehouseFilter !== 'ALL') {
        const aWhId = a.location?.id || a.location || a.locationId || null;
        if (historyWarehouseFilter === 'GLOBAL') {
          if (aWhId) return false;
        } else if (String(aWhId) !== String(historyWarehouseFilter)) {
          return false;
        }
      }

      // Period filter
      if (historyPeriodFilter !== 'ALL') {
        const aPeriod = (a.period_month || a.periodMonth || '').substring(0, 7);
        if (aPeriod !== historyPeriodFilter) return false;
      }

      // Search filter (audit number, warehouse, auditor)
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const audNo = (a.audit_number || a.auditNumber || '').toLowerCase();
        const whName = (a.locationName || a.location_name || a.location?.name || 'All Godowns').toLowerCase();
        const user = (a.conductedByName || a.conducted_by_name || a.conducted_by?.email || '').toLowerCase();
        return audNo.includes(q) || whName.includes(q) || user.includes(q);
      }

      return true;
    });
  }, [audits, historyStatusFilter, historyWarehouseFilter, historyPeriodFilter, historySearch]);

  // Paginated History records (compact preview displays top 5)
  const paginatedHistory = useMemo(() => {
    const effectivePageSize = isHistoryCompact ? 5 : historyPageSize;
    const effectivePage = isHistoryCompact ? 1 : historyPage;
    const start = (effectivePage - 1) * effectivePageSize;
    return filteredHistory.slice(start, start + effectivePageSize);
  }, [filteredHistory, isHistoryCompact, historyPage, historyPageSize]);

  // Physical Count Schedule Table Columns (Exact columns requested)
  const countColumns = [
    {
      key: 'name',
      header: 'Item / Fabric',
      width: '20%',
      render: (a) => (
        <div>
          <span className="font-semibold text-text block">{a.name}</span>
          <span className="text-[11px] text-muted font-mono">{a.sku}</span>
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU Code',
      width: '12%',
      render: (a) => <span className="font-mono font-bold text-primary text-xs">{a.sku}</span>,
    },
    {
      key: 'location',
      header: 'Warehouse',
      width: '13%',
      render: (a) => (
        <span className="text-muted text-xs flex items-center gap-1">
          <Warehouse size={12} className="text-slate-400 shrink-0" />
          {a.location}
        </span>
      ),
    },
    {
      key: 'systemQty',
      header: 'System Book Quantity',
      align: 'center',
      width: '12%',
      render: (a) => (
        <span className="font-mono text-text-secondary font-semibold text-xs">
          {Number(a.systemQty).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'physicalCount',
      header: 'Physical Count (editable)',
      align: 'center',
      width: '13%',
      render: (a) =>
        isAuditReadOnly ? (
          <span className="font-mono font-bold text-text bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
            {Number(a.physicalCount).toLocaleString()}
          </span>
        ) : (
          <input
            type="number"
            step="any"
            value={a.physicalCount}
            onChange={(e) => handleCountChange(a.id, e.target.value)}
            className="w-24 text-center font-mono font-bold border border-slate-300 rounded px-2 py-1 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        ),
    },
    {
      key: 'variance',
      header: 'Quantity Variance',
      align: 'center',
      width: '11%',
      render: (a) =>
        a.variance === 0 ? (
          <span className="text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
            <CheckCircle2 size={12} /> 0.00 (Match)
          </span>
        ) : (
          <span
            className={`text-xs font-semibold flex items-center justify-center gap-1 px-2 py-0.5 rounded ${
              a.variance < 0 ? 'text-rose-700 bg-rose-50' : 'text-blue-700 bg-blue-50'
            }`}
          >
            <AlertTriangle size={12} /> {a.variance > 0 ? `+${a.variance}` : a.variance}
          </span>
        ),
    },
    {
      key: 'varianceCost',
      header: 'Financial Variance',
      align: 'right',
      width: '11%',
      render: (a) => (
        <span
          className={`font-mono font-bold text-xs ${
            a.varianceCost < 0
              ? 'text-rose-600 dark:text-rose-400'
              : a.varianceCost > 0
              ? 'text-blue-600'
              : 'text-emerald-600'
          }`}
        >
          {a.varianceCost < 0
            ? `-${formatCurrency(Math.abs(a.varianceCost))}`
            : formatCurrency(a.varianceCost)}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Auditor Notes',
      width: '15%',
      render: (a) =>
        isAuditReadOnly ? (
          <span className="text-xs text-slate-500 italic">{a.reason || '—'}</span>
        ) : (
          <input
            type="text"
            placeholder="Audit remarks or reason..."
            value={a.reason || ''}
            onChange={(e) => handleReasonChange(a.id, e.target.value)}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 bg-white focus:ring-1 focus:ring-blue-400"
          />
        ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '10%',
      render: (a) => <StatusBadge status={a.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 flex items-center gap-2 shadow-xs animate-fade-in">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Month-End Stock Audit & Reconciliation"
        subtitle="Physical inventory counting, variance verification, and period-end stock ledger reconciliation."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={Plus}
              disabled={!canPerformAudit}
              onClick={() => setIsNewModalOpen(true)}
              title={canPerformAudit ? 'Start new audit cycle' : 'Permission perform_audit required'}
            >
              Start New Audit
            </Button>

            {/* Workflow Action Buttons */}
            {isAuditDraft && (
              <>
                <Button
                  variant="outline"
                  icon={Save}
                  disabled={savingDraft || detailLoading}
                  onClick={handleSaveDraftCounts}
                  className="border-slate-300 text-slate-700"
                >
                  {savingDraft ? 'Saving…' : 'Save Draft'}
                </Button>
                <Button
                  icon={Play}
                  disabled={updatingStatus || detailLoading || !canPerformAudit}
                  onClick={handleStartCounting}
                  className="!bg-blue-600 hover:!bg-blue-700 text-white"
                >
                  {updatingStatus ? 'Starting…' : 'Start Physical Count'}
                </Button>
              </>
            )}

            {isAuditCounting && (
              <>
                <Button
                  variant="outline"
                  icon={Save}
                  disabled={savingDraft || detailLoading}
                  onClick={handleSaveDraftCounts}
                  className="border-slate-300 text-slate-700"
                >
                  {savingDraft ? 'Saving…' : 'Save Progress'}
                </Button>
                <Button
                  icon={CheckCircle2}
                  disabled={updatingStatus || detailLoading || !canPerformAudit}
                  onClick={handleMarkReadyForReview}
                  className="!bg-indigo-600 hover:!bg-indigo-700 text-white"
                >
                  {updatingStatus ? 'Updating…' : 'Mark Ready for Review'}
                </Button>
              </>
            )}

            {isAuditReadyForReview && (
              <>
                <Button
                  variant="outline"
                  icon={RotateCcw}
                  disabled={updatingStatus || detailLoading}
                  onClick={handleRevertToCounting}
                  className="border-slate-300 text-slate-700"
                >
                  Revert to Counting
                </Button>
                <Button
                  icon={Send}
                  disabled={postingVariances || detailLoading || !canPerformAudit}
                  onClick={() => setIsPostModalOpen(true)}
                  className="!bg-emerald-600 hover:!bg-emerald-700 text-white font-semibold"
                >
                  {postingVariances ? 'Posting…' : 'Approve & Post to Ledger'}
                </Button>
              </>
            )}

            {isAuditPosted && (
              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-xs flex items-center gap-1.5 border border-emerald-300">
                <ShieldCheck size={14} className="text-emerald-700" /> Audit Certified & Posted (Locked)
              </span>
            )}

            {isAuditCancelled && (
              <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded font-semibold text-xs flex items-center gap-1.5 border border-slate-300">
                <XCircle size={14} className="text-slate-500" /> Audit Cancelled
              </span>
            )}
          </div>
        }
      />

      {/* Selected Audit Details Banner */}
      {currentAudit && (
        <div className="bg-white border border-[#CED4DA] rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-4">
              {/* Audit Number */}
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                <span className="text-blue-600 text-[11px] font-sans font-semibold uppercase tracking-wider">
                  Audit #:
                </span>{' '}
                {currentAudit.audit_number || currentAudit.auditNumber}
              </div>

              {/* Warehouse */}
              <div className="flex items-center gap-1.5 text-slate-700">
                <Warehouse size={15} className="text-slate-400 shrink-0" />
                <span className="text-slate-500">Warehouse:</span>
                <strong className="text-slate-900">
                  {currentAudit.locationName || currentAudit.location?.name || 'All Godowns (Global Audit)'}
                </strong>
              </div>

              {/* Audit Period */}
              <div className="flex items-center gap-1.5 text-slate-700">
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <span className="text-slate-500">Audit Period:</span>
                <strong className="text-slate-900">
                  {formatMonth(currentAudit.period_month || currentAudit.periodMonth)}
                </strong>
              </div>

              {/* Auditor */}
              <div className="flex items-center gap-1.5 text-slate-700">
                <User size={15} className="text-slate-400 shrink-0" />
                <span className="text-slate-500">Auditor:</span>
                <strong className="text-slate-900">
                  {currentAudit.conductedByName ||
                    currentAudit.conducted_by_name ||
                    currentAudit.conducted_by?.email ||
                    'admin'}
                </strong>
              </div>
            </div>

            {/* Status Badge & Certified Stamp */}
            <div className="flex items-center gap-2">
              <StatusBadge status={currentAudit.status} />
              {isAuditPosted && (
                <span className="text-slate-500 text-[11px] flex items-center gap-1">
                  <Lock size={13} className="text-emerald-600" /> Posted on{' '}
                  {formatDateTime(currentAudit.posted_at || currentAudit.postedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Workflow Stepper Bar */}
          <div className="flex items-center justify-between text-xs pt-1 px-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                Workflow Status:
              </span>
              <div className="flex items-center gap-1 font-medium">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    currentAudit.status === 'Draft'
                      ? 'bg-blue-100 text-blue-800 font-bold border border-blue-200'
                      : 'text-slate-400'
                  }`}
                >
                  1. Draft
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    currentAudit.status === 'Counting'
                      ? 'bg-amber-100 text-amber-800 font-bold border border-amber-200'
                      : 'text-slate-400'
                  }`}
                >
                  2. Counting
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    currentAudit.status === 'Ready for Review'
                      ? 'bg-indigo-100 text-indigo-800 font-bold border border-indigo-200'
                      : 'text-slate-400'
                  }`}
                >
                  3. Ready for Review
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    currentAudit.status === 'Posted'
                      ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200'
                      : 'text-slate-400'
                  }`}
                >
                  4. Posted
                </span>
              </div>
            </div>

            {hasUnsavedChanges && (
              <span className="text-amber-600 font-semibold text-xs flex items-center gap-1">
                <AlertTriangle size={13} /> Unsaved count entries
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4 Summary Cards (Exact Requirements) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Card 1: Total Items to Count */}
        <div className="bg-white p-4 rounded-lg border border-[#CED4DA] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
            Total Items to Count
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {totalItemsToCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Schedule lines in active cycle
          </span>
        </div>

        {/* Card 2: Items Matched */}
        <div className="bg-white p-4 rounded-lg border border-[#CED4DA] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
            Items Matched
          </span>
          <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">
            {itemsMatched}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Physical count = Book quantity
          </span>
        </div>

        {/* Card 3: Items with Variance */}
        <div className="bg-white p-4 rounded-lg border border-[#CED4DA] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
            Items with Variance
          </span>
          <p className="text-2xl font-bold text-rose-700 mt-1 font-mono">
            {itemsWithVariance}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {itemsWithVariance === 0 ? 'Zero discrepancies' : 'Requires adjustment write-off'}
          </span>
        </div>

        {/* Card 4: Reconciliation Accuracy */}
        <div className="bg-white p-4 rounded-lg border border-[#CED4DA] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
            Reconciliation Accuracy
          </span>
          <p className="text-2xl font-bold text-blue-700 mt-1 font-mono">
            {reconciliationAccuracy}%
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {itemsMatched} of {totalItemsToCount} items verified
          </span>
        </div>
      </div>

      {/* Locked Notice for Posted Audit */}
      {isAuditPosted && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-blue-600 shrink-0" />
            <span>
              <strong>Audit Certified & Locked:</strong> This audit cycle was certified and closed on{' '}
              {formatDateTime(currentAudit.posted_at || currentAudit.postedAt)}. Stock ledger movements have been posted. This audit is strictly read-only.
            </span>
          </div>
          <span className="font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-[11px]">
            Read-Only
          </span>
        </div>
      )}

      {/* Physical Stock Counting Section */}
      <div className="space-y-3">
        {/* Table Filter Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Physical Stock Counting Table
            </h3>
            <span className="text-xs text-slate-500">
              ({displayedRows.length} of {auditRows.length} displayed)
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCountFilterTab('ALL')}
              className={`px-3 py-1 rounded-md transition-colors ${
                countFilterTab === 'ALL'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Items ({auditRows.length})
            </button>
            <button
              type="button"
              onClick={() => setCountFilterTab('MATCHED')}
              className={`px-3 py-1 rounded-md transition-colors ${
                countFilterTab === 'MATCHED'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Matched ({itemsMatched})
            </button>
            <button
              type="button"
              onClick={() => setCountFilterTab('VARIANCE')}
              className={`px-3 py-1 rounded-md transition-colors ${
                countFilterTab === 'VARIANCE'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Variances ({itemsWithVariance})
            </button>
          </div>
        </div>

        {/* Counting DataTable */}
        <DataTable
          columns={countColumns}
          data={displayedRows}
          keyExtractor={(a) => a.id}
          searchPlaceholder="Search item name, SKU code or warehouse location..."
          searchFilter={(a, term) =>
            String(a.sku ?? '').toLowerCase().includes(term) ||
            String(a.name ?? '').toLowerCase().includes(term) ||
            String(a.location ?? '').toLowerCase().includes(term)
          }
        />
      </div>

      {/* Audit History Section (Compact by default with View All option) */}
      <div className="bg-white rounded-lg border border-[#CED4DA] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <History size={18} className="text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Audit History & Archives</h2>
              <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                {audits.length} cycles recorded
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical stock audit cycles. {isHistoryCompact ? 'Showing compact preview of latest audits.' : 'Full archive view.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Compact / View All Toggle */}
            <Button
              size="xs"
              variant="outline"
              onClick={() => setIsHistoryCompact(!isHistoryCompact)}
              className="border-slate-300 text-slate-700 text-xs"
            >
              {isHistoryCompact ? (
                <span className="flex items-center gap-1">
                  View All History ({filteredHistory.length}) <ChevronDown size={14} />
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  Show Compact Preview <ChevronUp size={14} />
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar (Visible especially when expanded or to narrow history) */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit #, auditor..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 w-44 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Warehouse Filter */}
            <select
              value={historyWarehouseFilter}
              onChange={(e) => {
                setHistoryWarehouseFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="py-1.5 px-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700 focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Warehouses</option>
              <option value="GLOBAL">Global Audits (All Godowns)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            {/* Month/Year Period Filter */}
            <select
              value={historyPeriodFilter}
              onChange={(e) => {
                setHistoryPeriodFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="py-1.5 px-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700 focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Periods</option>
              {uniqueAuditPeriods.map((p) => (
                <option key={p} value={p}>
                  {formatMonth(p)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-xs font-semibold">
            {['ALL', 'Draft', 'Counting', 'Ready for Review', 'Posted'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setHistoryStatusFilter(st);
                  setHistoryPage(1);
                }}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  historyStatusFilter === st
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Audit Number</th>
                <th className="py-2.5 px-3">Warehouse / Godown</th>
                <th className="py-2.5 px-3">Audit Period</th>
                <th className="py-2.5 px-3">Auditor</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Created Date</th>
                <th className="py-2.5 px-3">Posting Date</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 italic">
                    No stock audit cycles found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((a) => {
                  const isSelected = a.id === selectedAuditId;
                  const isDraft = a.status === 'Draft';
                  const isCounting = a.status === 'Counting';
                  const isReady = a.status === 'Ready for Review';
                  const whLabel =
                    a.locationName || a.location_name || a.location?.name || 'All Godowns (Global Audit)';

                  return (
                    <tr
                      key={a.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40 font-medium' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-blue-600">
                        {a.audit_number || a.auditNumber}
                      </td>
                      <td className="py-2 px-3 text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Warehouse size={13} className="text-slate-400 shrink-0" />
                          <span>{whLabel}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>{formatMonth(a.period_month || a.periodMonth)}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {a.conductedByName ||
                          a.conducted_by_name ||
                          a.createdByName ||
                          a.conducted_by?.email ||
                          'admin'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {formatDateTime(a.created_at || a.createdAt)}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {a.status === 'Posted' ? formatDateTime(a.posted_at || a.postedAt) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {isSelected ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-blue-700 bg-blue-100/70 border border-blue-200">
                            Active in View
                          </span>
                        ) : isDraft || isCounting ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setSelectedAuditId(a.id)}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          >
                            Resume Count
                          </Button>
                        ) : isReady ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setSelectedAuditId(a.id)}
                            className="text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                          >
                            Review & Post
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setSelectedAuditId(a.id)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            View Details
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* History Pagination (when not compact) */}
        {!isHistoryCompact && filteredHistory.length > 0 && (
          <AppPagination
            total={filteredHistory.length}
            page={historyPage}
            pageSize={historyPageSize}
            onPageChange={setHistoryPage}
            onPageSizeChange={(sz) => {
              setHistoryPageSize(sz);
              setHistoryPage(1);
            }}
            pageSizeOptions={[5, 10, 20]}
            bordered
          />
        )}
      </div>

      {/* Start New Audit Modal (Audit Creation Requirements) */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Start Month-End Stock Audit Cycle"
        subtitle="Capture book balance snapshot, assign auditor, and initiate physical inventory verification."
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {checkConflictInModal.activeMatch ? (
                <Button
                  onClick={() => {
                    setSelectedAuditId(checkConflictInModal.activeMatch.id);
                    setIsNewModalOpen(false);
                    setToastMessage(
                      `Resumed active audit ${
                        checkConflictInModal.activeMatch.audit_number ||
                        checkConflictInModal.activeMatch.auditNumber
                      }.`
                    );
                    setTimeout(() => setToastMessage(null), 4000);
                  }}
                  className="!bg-amber-600 hover:!bg-amber-700 text-white font-semibold"
                >
                  Resume Active Audit ({checkConflictInModal.activeMatch.audit_number || checkConflictInModal.activeMatch.auditNumber})
                </Button>
              ) : checkConflictInModal.postedMatch ? (
                <Button
                  onClick={() => {
                    setSelectedAuditId(checkConflictInModal.postedMatch.id);
                    setIsNewModalOpen(false);
                  }}
                  className="!bg-blue-600 hover:!bg-blue-700 text-white font-semibold"
                >
                  View Posted Audit ({checkConflictInModal.postedMatch.audit_number || checkConflictInModal.postedMatch.auditNumber})
                </Button>
              ) : (
                <Button
                  disabled={creatingAudit}
                  onClick={() => handleCreateAudit(false)}
                  className="!bg-blue-600 hover:!bg-blue-700 text-white font-semibold"
                >
                  {creatingAudit ? 'Capturing Snapshot…' : 'Create Audit Cycle'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1 text-xs">
          {/* Warehouse Selection */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Warehouse / Godown <span className="text-rose-500">*</span>
            </label>
            <select
              value={newAuditForm.warehouseId}
              onChange={(e) => setNewAuditForm({ ...newAuditForm, warehouseId: e.target.value })}
              className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Godowns (Global Audit across entire company)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Selecting a specific warehouse limits the count schedule to stock physically stored at that location.
            </span>
          </div>

          {/* Audit Month & Year Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Audit Month & Year <span className="text-rose-500">*</span>
              </label>
              <input
                type="month"
                value={newAuditForm.periodMonth}
                onChange={(e) => setNewAuditForm({ ...newAuditForm, periodMonth: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Audits verify the closing balance for this month.
              </span>
            </div>

            {/* Auditor Selection */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Auditor <span className="text-rose-500">*</span>
              </label>
              <select
                value={newAuditForm.auditorId}
                onChange={(e) => setNewAuditForm({ ...newAuditForm, auditorId: e.target.value })}
                className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
              >
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email} ({u.email})
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Responsible auditor for physical verification and sign-off.
              </span>
            </div>
          </div>

          {/* Stock Categories to Include */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <Layers size={13} className="text-slate-400" />
                Stock Categories to Include <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  setNewAuditForm({
                    ...newAuditForm,
                    allCategories: !newAuditForm.allCategories,
                    selectedCategories: !newAuditForm.allCategories ? [] : categories.map((c) => c.id),
                  })
                }
                className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold"
              >
                {newAuditForm.allCategories ? 'Select Specific Categories' : 'Include All Categories'}
              </button>
            </div>

            {newAuditForm.allCategories ? (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-slate-600 text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="text-blue-600" />
                <span>
                  <strong>All Categories Included:</strong> All inventory fabric and stock items will be snapshotted.
                </span>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md space-y-2 max-h-36 overflow-y-auto">
                {categories.length === 0 ? (
                  <span className="text-slate-400 italic">No specific categories defined in masters.</span>
                ) : (
                  categories.map((cat) => {
                    const isChecked = newAuditForm.selectedCategories.includes(cat.id);
                    return (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAuditForm({
                                ...newAuditForm,
                                selectedCategories: [...newAuditForm.selectedCategories, cat.id],
                              });
                            } else {
                              setNewAuditForm({
                                ...newAuditForm,
                                selectedCategories: newAuditForm.selectedCategories.filter((id) => id !== cat.id),
                              });
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{cat.name}</span>
                        {cat.code && <span className="text-[11px] text-slate-400">({cat.code})</span>}
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Scope Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Auditor Remarks / Scope Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. End of month physical stock count and godown reconciliation"
              value={newAuditForm.notes}
              onChange={(e) => setNewAuditForm({ ...newAuditForm, notes: e.target.value })}
              className="w-full border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Duplicate Conflict Warnings */}
          {checkConflictInModal.postedMatch && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 flex items-start gap-2.5">
              <Lock size={16} className="text-rose-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-rose-900">
                  Audit Already Certified & Posted ({checkConflictInModal.postedMatch.audit_number || checkConflictInModal.postedMatch.auditNumber})
                </p>
                <p className="mt-0.5 text-rose-700 leading-relaxed">
                  An audit for <strong>{checkConflictInModal.whName}</strong> for{' '}
                  <strong>{formatMonth(newAuditForm.periodMonth)}</strong> has already been certified and closed on{' '}
                  {formatDateTime(checkConflictInModal.postedMatch.posted_at || checkConflictInModal.postedMatch.postedAt)}. Posted audits are permanently locked and cannot be recreated.
                </p>
              </div>
            </div>
          )}

          {checkConflictInModal.activeMatch && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900">
                  Active {checkConflictInModal.activeMatch.status} Audit Exists ({checkConflictInModal.activeMatch.audit_number || checkConflictInModal.activeMatch.auditNumber})
                </p>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  An active {checkConflictInModal.activeMatch.status.toLowerCase()} audit already exists for{' '}
                  <strong>{checkConflictInModal.whName}</strong> for{' '}
                  <strong>{formatMonth(newAuditForm.periodMonth)}</strong> (Created on{' '}
                  {formatDateTime(checkConflictInModal.activeMatch.created_at || checkConflictInModal.activeMatch.createdAt)}).
                  Creating duplicate audits is prevented. Please resume the existing cycle.
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Post Variances Confirmation Modal */}
      <Modal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        title="Certify & Post Month-End Variances"
        subtitle={`Lock audit ${currentAudit?.audit_number || currentAudit?.auditNumber} and post inventory adjustments to Stock Ledger.`}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" onClick={() => setIsPostModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={postingVariances}
              onClick={handleConfirmPostVariances}
              className="!bg-emerald-600 hover:!bg-emerald-700 text-white font-semibold"
            >
              {postingVariances ? 'Certifying & Posting…' : 'Confirm & Post to Ledger'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Audit Cycle:</span>
              <span className="font-mono font-bold text-slate-900">
                {currentAudit?.audit_number || currentAudit?.auditNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Warehouse:</span>
              <span className="font-semibold text-slate-800">
                {currentAudit?.locationName || currentAudit?.location?.name || 'All Godowns (Global Audit)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Audit Period:</span>
              <span className="font-semibold text-slate-800">
                {formatMonth(currentAudit?.period_month || currentAudit?.periodMonth)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Reconciled Items:</span>
              <span className="font-semibold text-emerald-700">{itemsMatched} Matched</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Discrepancies to Adjust:</span>
              <span className="font-semibold text-rose-700">{itemsWithVariance} Item(s)</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-800">Net Fiscal Adjustment:</span>
              <span className="font-mono font-bold text-slate-900">
                {netVarianceCost < 0
                  ? `-${formatCurrency(Math.abs(netVarianceCost))}`
                  : formatCurrency(netVarianceCost)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <span className="leading-relaxed">
              <strong>Stock Ledger Integration:</strong> Posting will generate <code>ADJUSTMENT</code> movements in the inventory ledger and adjust stock balances. This audit cycle will be permanently locked against changes.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MonthEndAuditPage;
