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

  // Loading & status states
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [postingVariances, setPostingVariances] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [error, setError] = useState(null);

  // Local editable lines
  const [auditRows, setAuditRows] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Audit History table states
  const [historyTab, setHistoryTab] = useState('ALL'); // 'ALL' | 'Draft' | 'Posted' | 'Cancelled'
  const [historySearch, setHistorySearch] = useState('');
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
    notes: '',
  });

  // Post confirmation modal
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

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
        status: 'Reconciled',
        reason: '',
      };
    });

  // Load warehouse locations
  const loadWarehouses = async () => {
    try {
      const res = await inventoryService.getWarehouses();
      const list = unwrapList(res);
      setWarehouses(list.filter((w) => !w.code?.startsWith('SYS-')));
    } catch (e) {
      console.warn('Could not load warehouses', e);
    }
  };

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
            status: variance === 0 ? 'Reconciled' : 'Variance Flagged',
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
    loadWarehouses();
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
          status: diff === 0 ? 'Reconciled' : 'Variance Flagged',
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

  // Post variances to GL
  const handleConfirmPostVariances = async () => {
    if (!currentAudit?.id) return;
    setPostingVariances(true);
    setError(null);
    try {
      await inventoryService.postAuditVariances(currentAudit.id, { lines: auditRows });
      setToastMessage('Variances successfully posted to General Ledger & stock movements adjusted!');
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

  // Check draft & posted status for new audit modal
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

    const draftMatch = audits.find((a) => {
      const aWhId = a.location?.id || a.location || a.locationId || null;
      const aPeriod = (a.period_month || a.periodMonth || '').substring(0, 7);
      const matchesWh = selectedWh ? String(aWhId) === String(selectedWh) : !aWhId;
      const matchesPeriod = aPeriod === targetPeriod;
      return matchesWh && matchesPeriod && (a.status === 'Draft' || a.status === 'Counting');
    });

    const whName = selectedWh
      ? warehouses.find((w) => String(w.id) === String(selectedWh))?.name || 'Selected Warehouse'
      : 'All Godowns (Global Audit)';

    return { postedMatch, draftMatch, whName };
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
          ? `Resumed active draft audit ${data?.audit_number || data?.auditNumber || ''}.`
          : 'New month-end stock audit created and book quantities captured.'
      );
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      const apiErr = err?.response?.data;
      if (apiErr?.code === 'ACTIVE_AUDIT_EXISTS' && apiErr?.existingAuditId) {
        // Backend detected active draft: switch to that draft
        setSelectedAuditId(apiErr.existingAuditId);
        setIsNewModalOpen(false);
        setToastMessage(`Switched to existing draft audit (${apiErr.auditNumber}).`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setError(describeApiError(err));
      }
    } finally {
      setCreatingAudit(false);
    }
  };

  const isAuditPosted = currentAudit?.status === 'Posted';
  const isAuditCancelled = currentAudit?.status === 'Cancelled';
  const isAuditReadOnly = isAuditPosted || isAuditCancelled;

  // Live KPI Summary stats
  const reconciledCount = auditRows.filter((i) => i.status === 'Reconciled').length;
  const accuracyPct =
    auditRows.length > 0 ? ((reconciledCount / auditRows.length) * 100).toFixed(1) : '0.0';
  const netVarianceCost = auditRows.reduce((acc, i) => acc + (i.varianceCost || 0), 0);
  const flaggedCount = auditRows.filter((i) => i.status === 'Variance Flagged').length;

  // Filtered History list
  const filteredHistory = useMemo(() => {
    return audits.filter((a) => {
      // Tab filter
      if (historyTab === 'Draft' && a.status !== 'Draft' && a.status !== 'Counting') return false;
      if (historyTab === 'Posted' && a.status !== 'Posted') return false;
      if (historyTab === 'Cancelled' && a.status !== 'Cancelled') return false;

      // Search filter
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const audNo = (a.audit_number || a.auditNumber || '').toLowerCase();
        const whName = (a.locationName || a.location_name || a.location?.name || 'All Godowns').toLowerCase();
        const user = (a.conductedByName || a.conducted_by_name || a.conducted_by?.email || '').toLowerCase();
        return audNo.includes(q) || whName.includes(q) || user.includes(q);
      }
      return true;
    });
  }, [audits, historyTab, historySearch]);

  // Paginated History records
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistory.slice(start, start + historyPageSize);
  }, [filteredHistory, historyPage, historyPageSize]);

  // Physical Count Schedule Table Columns
  const countColumns = [
    {
      key: 'sku',
      header: 'SKU Code',
      width: '12%',
      render: (a) => <span className="font-mono font-bold text-primary">{a.sku}</span>,
    },
    {
      key: 'name',
      header: 'Item Description',
      width: '22%',
      render: (a) => <span className="font-semibold text-text">{a.name}</span>,
    },
    {
      key: 'location',
      header: 'Godown / Zone',
      width: '14%',
      render: (a) => <span className="text-muted text-xs">{a.location}</span>,
    },
    {
      key: 'systemQty',
      header: 'System Book Qty',
      align: 'center',
      width: '10%',
      render: (a) => <span className="font-mono text-text-secondary">{a.systemQty}</span>,
    },
    {
      key: 'physicalCount',
      header: 'Physical Count',
      align: 'center',
      width: '12%',
      render: (a) =>
        isAuditReadOnly ? (
          <span className="font-mono font-bold text-text bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            {a.physicalCount}
          </span>
        ) : (
          <input
            type="number"
            step="any"
            value={a.physicalCount}
            onChange={(e) => handleCountChange(a.id, e.target.value)}
            className="w-24 text-center font-mono font-bold border border-slate-300 rounded px-1.5 py-0.5 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        ),
    },
    {
      key: 'variance',
      header: 'Unit Variance',
      align: 'center',
      width: '11%',
      render: (a) =>
        a.variance === 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1">
            <CheckCircle2 size={12} /> Match
          </span>
        ) : (
          <span className="text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1">
            <AlertTriangle size={12} /> {a.variance > 0 ? `+${a.variance}` : a.variance} units
          </span>
        ),
    },
    {
      key: 'varianceCost',
      header: 'Fiscal Variance',
      align: 'right',
      width: '11%',
      render: (a) => (
        <span
          className={`font-mono font-bold ${
            a.varianceCost < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-text'
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
      width: '14%',
      render: (a) =>
        isAuditReadOnly ? (
          <span className="text-xs text-slate-500 italic">{a.reason || '—'}</span>
        ) : (
          <input
            type="text"
            placeholder="Reason for variance..."
            value={a.reason || ''}
            onChange={(e) => handleReasonChange(a.id, e.target.value)}
            className="w-full text-xs border border-slate-200 rounded px-2 py-0.5 text-slate-700 bg-white"
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
    <div className="space-y-6">
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-800 flex items-center gap-2 shadow-sm animate-fade-in">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded text-xs text-rose-800 flex items-center gap-2 shadow-sm">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <PageHeader
        title="Month-End Stock Audit & Reconciliation"
        subtitle="Physical count verification against book balance, variance write-offs, and auditor GL closing."
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

            {!isAuditReadOnly ? (
              <>
                <Button
                  variant="outline"
                  icon={Save}
                  disabled={savingDraft || detailLoading}
                  onClick={handleSaveDraftCounts}
                  className="border-slate-300 text-slate-700"
                >
                  {savingDraft ? 'Saving…' : 'Save Draft Counts'}
                </Button>
                <Button
                  icon={Send}
                  disabled={postingVariances || detailLoading || !canPerformAudit}
                  onClick={() => setIsPostModalOpen(true)}
                  className="!bg-blue-600 hover:!bg-blue-700 text-white"
                >
                  {postingVariances ? 'Posting Variances…' : 'Post Variances & Close'}
                </Button>
              </>
            ) : isAuditPosted ? (
              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-xs flex items-center gap-1.5 border border-emerald-300">
                <ShieldCheck size={14} className="text-emerald-700" /> Audit Certified & Posted
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded font-semibold text-xs flex items-center gap-1.5 border border-slate-300">
                <XCircle size={14} className="text-slate-500" /> Audit Cancelled
              </span>
            )}
          </div>
        }
      />

      {/* Selected Audit Information Banner */}
      {currentAudit && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-xs">
              <span className="text-blue-600">Cycle:</span> {currentAudit.audit_number || currentAudit.auditNumber}
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <Warehouse size={14} className="text-slate-400" />
              <span>
                Warehouse:{' '}
                <strong className="text-slate-800">
                  {currentAudit.locationName || currentAudit.location?.name || 'All Godowns (Global)'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span>
                Period:{' '}
                <strong className="text-slate-800">
                  {formatMonth(currentAudit.period_month || currentAudit.periodMonth)}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <span>
                Auditor:{' '}
                <strong className="text-slate-800">
                  {currentAudit.conductedByName || currentAudit.conducted_by?.email || 'admin'}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={currentAudit.status} />
            {isAuditPosted && (
              <span className="text-slate-500 text-[11px] flex items-center gap-1">
                <Lock size={12} className="text-emerald-600" /> Certified on {formatDateTime(currentAudit.posted_at || currentAudit.postedAt)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* KPI summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-[#CED4DA] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Cycle</span>
          <p className="text-base font-bold text-[#1F2E4A] mt-1 font-mono">
            {currentAudit?.audit_number || currentAudit?.auditNumber || '—'}
          </p>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Scope: <strong className="text-slate-600">{currentAudit?.locationName || currentAudit?.location?.name || 'All Godowns'}</strong>
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#CED4DA] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Reconciled Accuracy</span>
          <p className="text-lg font-bold text-emerald-700 mt-1">{accuracyPct}%</p>
          <span className="text-[11px] text-slate-400">
            {reconciledCount} of {auditRows.length} items verified
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#CED4DA] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Net Fiscal Variance</span>
          <p className="text-lg font-bold text-rose-700 mt-1">
            {netVarianceCost < 0
              ? `-${formatCurrency(Math.abs(netVarianceCost))}`
              : formatCurrency(netVarianceCost)}
          </p>
          <span className="text-[11px] text-slate-400">
            {flaggedCount === 0 ? 'Zero variance write-offs' : `${flaggedCount} item(s) flagged`}
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#CED4DA] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Lines Counted</span>
          <p className="text-lg font-bold text-slate-900 mt-1">{auditRows.length}</p>
          <span className="text-[11px] text-slate-400">
            {hasUnsavedChanges ? (
              <span className="text-amber-600 font-medium">Unsaved count changes</span>
            ) : (
              'Snapshot verified'
            )}
          </span>
        </div>
      </div>

      {/* Locked Notice for Posted Audit */}
      {isAuditPosted && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-blue-600 shrink-0" />
            <span>
              <strong>Audit Certified & Locked:</strong> This audit cycle was certified and posted on{' '}
              {formatDateTime(currentAudit.posted_at || currentAudit.postedAt)}. Discrepancies have been posted to the Stock Ledger. This audit cannot be modified or recreated.
            </span>
          </div>
          <span className="font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-[11px]">
            Read-Only
          </span>
        </div>
      )}

      {/* Physical vs Book Count Audit Table */}
      <DataTable
        title={`Physical vs Book Count Audit: ${currentAudit?.audit_number || currentAudit?.auditNumber || 'Active Cycle'}`}
        columns={countColumns}
        data={auditRows}
        keyExtractor={(a) => a.id}
        searchPlaceholder="Filter SKU, description or location..."
        searchFilter={(a, term) =>
          String(a.sku ?? '').toLowerCase().includes(term) ||
          String(a.name ?? '').toLowerCase().includes(term) ||
          String(a.location ?? '').toLowerCase().includes(term)
        }
      />

      {/* Audit History & Cycles Section (Requirement 6, 7 & 8) */}
      <div className="bg-white rounded-lg border border-[#CED4DA] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <History size={18} className="text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Stock Audit Cycles & History</h2>
              <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                {audits.length} total cycles
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical physical audit cycles. Select any cycle to review book quantities, physical counts, or resume active drafts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setHistoryTab('ALL');
                  setHistoryPage(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  historyTab === 'ALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({audits.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryTab('Draft');
                  setHistoryPage(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  historyTab === 'Draft' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Draft / Active ({audits.filter((a) => a.status === 'Draft' || a.status === 'Counting').length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryTab('Posted');
                  setHistoryPage(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  historyTab === 'Posted' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Posted ({audits.filter((a) => a.status === 'Posted').length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryTab('Cancelled');
                  setHistoryPage(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  historyTab === 'Cancelled' ? 'bg-white text-slate-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelled ({audits.filter((a) => a.status === 'Cancelled').length})
              </button>
            </div>

            {/* History Search */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit # or warehouse..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                className="pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-800 w-48 focus:ring-1 focus:ring-blue-500"
              />
            </div>
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
                <th className="py-2.5 px-3">Created Date</th>
                <th className="py-2.5 px-3">Created / Auditor</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Posting Date</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 italic">
                    No stock audit cycles found matching the filter.
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((a) => {
                  const isSelected = a.id === selectedAuditId;
                  const isDraft = a.status === 'Draft' || a.status === 'Counting';
                  const whLabel = a.locationName || a.location_name || a.location?.name || 'All Godowns (Global)';

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
                      <td className="py-2 px-3 text-slate-500">
                        {formatDateTime(a.created_at || a.createdAt)}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {a.conductedByName || a.conducted_by_name || a.createdByName || a.conducted_by?.email || 'admin'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {a.status === 'Posted' ? formatDateTime(a.posted_at || a.postedAt) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {isSelected ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-blue-700 bg-blue-100/70 border border-blue-200">
                            Active in View
                          </span>
                        ) : isDraft ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setSelectedAuditId(a.id)}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          >
                            Resume & Count
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

        {/* History Pagination */}
        {filteredHistory.length > 0 && (
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

      {/* Start New Audit Modal (Requirement 1, 2, 3, 4, 5, 9) */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Start Month-End Stock Audit Cycle"
        subtitle="Capture snapshot of book balance and initiate physical count verification."
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {checkConflictInModal.draftMatch ? (
                <Button
                  onClick={() => {
                    setSelectedAuditId(checkConflictInModal.draftMatch.id);
                    setIsNewModalOpen(false);
                    setToastMessage(
                      `Resumed existing draft audit ${
                        checkConflictInModal.draftMatch.audit_number ||
                        checkConflictInModal.draftMatch.auditNumber
                      }.`
                    );
                    setTimeout(() => setToastMessage(null), 4000);
                  }}
                  className="!bg-amber-600 hover:!bg-amber-700 text-white"
                >
                  Resume Draft ({checkConflictInModal.draftMatch.audit_number || checkConflictInModal.draftMatch.auditNumber})
                </Button>
              ) : checkConflictInModal.postedMatch ? (
                <Button
                  onClick={() => {
                    setSelectedAuditId(checkConflictInModal.postedMatch.id);
                    setIsNewModalOpen(false);
                  }}
                  className="!bg-blue-600 hover:!bg-blue-700 text-white"
                >
                  View Posted Audit ({checkConflictInModal.postedMatch.audit_number || checkConflictInModal.postedMatch.auditNumber})
                </Button>
              ) : (
                <Button
                  disabled={creatingAudit}
                  onClick={() => handleCreateAudit(false)}
                  className="!bg-blue-600 hover:!bg-blue-700 text-white"
                >
                  {creatingAudit ? 'Capturing Snapshot…' : 'Create Audit Cycle'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Warehouse Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit Scope / Warehouse <span className="text-rose-500">*</span>
            </label>
            <select
              value={newAuditForm.warehouseId}
              onChange={(e) => setNewAuditForm({ ...newAuditForm, warehouseId: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
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

          {/* Audit Period Month Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit Period Month <span className="text-rose-500">*</span>
            </label>
            <input
              type="month"
              value={newAuditForm.periodMonth}
              onChange={(e) => setNewAuditForm({ ...newAuditForm, periodMonth: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Audits represent the closing balance for the specified calendar month.
            </span>
          </div>

          {/* Notes / Scope remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Auditor Remarks / Scope Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. End of month physical inventory verification and auditor sign-off"
              value={newAuditForm.notes}
              onChange={(e) => setNewAuditForm({ ...newAuditForm, notes: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Conflict Warnings & Resume Prompts */}
          {checkConflictInModal.postedMatch && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2.5">
              <Lock size={16} className="text-rose-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-rose-900">
                  Audit Already Certified & Posted ({checkConflictInModal.postedMatch.audit_number || checkConflictInModal.postedMatch.auditNumber})
                </p>
                <p className="mt-0.5 text-rose-700">
                  An audit for <strong>{checkConflictInModal.whName}</strong> for{' '}
                  <strong>{formatMonth(newAuditForm.periodMonth)}</strong> has already been certified and closed on{' '}
                  {formatDateTime(checkConflictInModal.postedMatch.posted_at || checkConflictInModal.postedMatch.postedAt)}. Posted audits are permanently locked and cannot be recreated.
                </p>
              </div>
            </div>
          )}

          {checkConflictInModal.draftMatch && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900">
                  Active Draft Audit Exists ({checkConflictInModal.draftMatch.audit_number || checkConflictInModal.draftMatch.auditNumber})
                </p>
                <p className="mt-0.5 text-amber-800">
                  A Draft audit is currently active for <strong>{checkConflictInModal.whName}</strong> for{' '}
                  <strong>{formatMonth(newAuditForm.periodMonth)}</strong> (Created on{' '}
                  {formatDateTime(checkConflictInModal.draftMatch.created_at || checkConflictInModal.draftMatch.createdAt)}).
                  Please resume counting the existing audit instead of creating a duplicate cycle.
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
        subtitle={`Lock audit ${currentAudit?.audit_number || currentAudit?.auditNumber} and post inventory adjustments to GL.`}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" onClick={() => setIsPostModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={postingVariances}
              onClick={handleConfirmPostVariances}
              className="!bg-emerald-600 hover:!bg-emerald-700 text-white"
            >
              {postingVariances ? 'Certifying & Posting…' : 'Confirm & Post to GL'}
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
              <span className="text-slate-600">Audit Scope:</span>
              <span className="font-semibold text-slate-800">
                {currentAudit?.locationName || currentAudit?.location?.name || 'All Godowns'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Period:</span>
              <span className="font-semibold text-slate-800">
                {formatMonth(currentAudit?.period_month || currentAudit?.periodMonth)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Reconciled Items:</span>
              <span className="font-semibold text-emerald-700">{reconciledCount} Match</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Discrepancies to Adjust:</span>
              <span className="font-semibold text-rose-700">{flaggedCount} Item(s)</span>
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
            <span>
              <strong>Important:</strong> Posting will generate <code>ADJUSTMENT</code> movements in the inventory stock ledger and stamp GL write-offs. This audit cycle will be permanently locked against changes.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MonthEndAuditPage;
