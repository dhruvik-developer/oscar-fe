import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Box,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Layers,
  Package,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import {
  fetchJWOs,
  fetchPlans,
  createJWORow,
  deleteJWORow,
  errorMessage,
} from '../../../../services/jobWorkSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const DEST_PILL = {
  'Customer Project': 'bg-blue-50 text-blue-700 border-blue-200',
  'Own Project': 'bg-purple-50 text-purple-700 border-purple-200',
  Mixed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const INWARD_STATUS_PILL = {
  Received: 'bg-teal-50 text-teal-700 border-teal-200',
  'Fully Received': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Partially Received': 'bg-amber-50 text-amber-700 border-amber-200',
  'In Process': 'bg-blue-50 text-blue-700 border-blue-200',
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function Stage14JobWorkInwardWorkspace({
  project,
  stage,
  onUpdated,
  onSelectStage,
  totalStages = 18,
}) {
  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
      warning: (msg) => showToast?.(msg, 'warning'),
    }),
    [showToast]
  );

  const code = project?.code || '';
  const projectId = project?.id;
  const stageSeq = stage?.sequence || 14;
  const stageName = stage?.name || 'Stage 14 — Job Work Inward (Receive)';

  // Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [plans, setPlans] = useState([]);

  // Active sub-table tab state:
  // 'jwo_outwards' | 'inwards_history' | 'takas_breakdown' | 'reconciliation' | 'pending_overdue'
  const [activeTableTab, setActiveTableTab] = useState('inwards_history');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create Inward Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [savingInward, setSavingInward] = useState(false);
  const [formError, setFormError] = useState('');

  // Form fields
  const [inwardForm, setInwardForm] = useState({
    jwoId: '',
    date: todayISO(),
    qty: '',
    accepted: '',
    rejected: '0',
    challanNo: '',
    transporter: '',
    vehicleNo: '',
    lrNo: '',
    rollCount: 1,
    remarks: '',
    status: 'Received',
  });

  // Taka-level receiving breakdown inside the modal
  const [modalTakaEntries, setModalTakaEntries] = useState([]);

  // Detail Modal State (View Inward Receipt)
  const [selectedInwardDetail, setSelectedInwardDetail] = useState(null);

  // Load backend records
  const loadRecords = useCallback(async () => {
    if (!projectId && !code) return;
    setLoading(true);
    setError('');
    try {
      const [allOrders, allPlans] = await Promise.all([
        fetchJWOs().catch(() => []),
        fetchPlans().catch(() => []),
      ]);

      // Filter orders belonging to this project
      const projectOrders = (allOrders || []).filter(
        (o) =>
          o.projectId === projectId ||
          (o.projectCode && o.projectCode === code) ||
          (o.remarks || '').includes(code)
      );
      setOrders(projectOrders);

      // Filter plans belonging to this project
      const projectPlans = (allPlans || []).filter(
        (p) =>
          p.projectId === projectId ||
          (p.projectCode && p.projectCode === code) ||
          (p.remarks || '').includes(code)
      );
      setPlans(projectPlans);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load Job Work Inward records.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, code]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Derived calculations across project orders
  const projectReq = Number(project?.requirementMeters || project?.quantity || 0);

  // Augmented orders with calculated metrics
  const augmentedOrders = useMemo(() => {
    return orders.map((ord) => {
      const planned = Number(ord.plannedQty || 0);
      const outwardsList = ord.outwards || [];
      const inwardsList = ord.inwards || [];
      const lossList = ord.lossEntries || [];

      const outwardQty = outwardsList.reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
      const inwardQty = inwardsList.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
      const acceptedQty = inwardsList.reduce((sum, i) => sum + (Number(i.accepted ?? i.qty) || 0), 0);
      const rejectedQty = inwardsList.reduce((sum, i) => sum + (Number(i.rejected || 0)), 0);
      const approvedLoss = lossList
        .filter((l) => (l.status || '').toLowerCase() === 'approved')
        .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

      const pendingQty = Math.max(0, outwardQty - inwardQty - approvedLoss);

      const isPastExpected =
        Boolean(ord.expectedCompletion) && ord.expectedCompletion < todayISO();
      const isOverdue = pendingQty > 0 && isPastExpected;

      const linkedPlan = plans.find(
        (p) => p.id === ord.processPlanId || p.planNo === ord.processPlanNo
      );
      const effectivePlanNo =
        ord.processPlanNo || linkedPlan?.planNo || (linkedPlan ? `PP-${linkedPlan.id.slice(0, 6)}` : '—');

      const primaryMaterial = ord.materials?.[0] || {};
      const fabricItem = primaryMaterial.fabricItem || linkedPlan?.fabricItem || 'Grey Fabric';
      const fabricQuality = primaryMaterial.fabricQuality || linkedPlan?.fabricQuality || '';
      const shade = primaryMaterial.shade || linkedPlan?.shade || '—';
      const lotNo = primaryMaterial.lotNo || linkedPlan?.greyLotNo || '—';

      const latestChallan = outwardsList[0]?.challanNo || outwardsList[0]?.no || '—';
      const latestOutwardDate = outwardsList[0]?.date || '—';

      return {
        ...ord,
        effectivePlanNo,
        fabricItem,
        fabricQuality,
        shade,
        lotNo,
        outwardQty,
        inwardQty,
        acceptedQty,
        rejectedQty,
        approvedLoss,
        pendingQty,
        isOverdue,
        latestChallan,
        latestOutwardDate,
      };
    });
  }, [orders, plans]);

  // Flatten all inwards across project orders for History table
  const allInwardReceipts = useMemo(() => {
    const list = [];
    augmentedOrders.forEach((ord) => {
      (ord.inwards || []).forEach((inw) => {
        list.push({
          ...inw,
          jwoId: ord.id,
          jwoNo: ord.jwoNo,
          vendor: ord.vendor,
          process: ord.process,
          fabricItem: ord.fabricItem,
          fabricQuality: ord.fabricQuality,
          shade: ord.shade,
          lotNo: ord.lotNo,
          projectDestination: ord.projectDestination || 'Customer Project',
          receivedQty: Number(inw.qty || 0),
          acceptedQty: Number(inw.accepted ?? inw.qty ?? 0),
          rejectedQty: Number(inw.rejected || 0),
          effectiveStatus: inw.status || 'Received',
          location: 'SYS-QC-HOLD',
        });
      });
    });
    return list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [augmentedOrders]);

  // Flatten all taka-level received records across all inwards
  const allReceivedTakas = useMemo(() => {
    const list = [];
    allInwardReceipts.forEach((inw) => {
      (inw.takas || []).forEach((t, idx) => {
        list.push({
          id: t.id || `${inw.id}-taka-${idx}`,
          inwardNo: inw.no,
          inwardDate: inw.date,
          jwoNo: inw.jwoNo,
          vendor: inw.vendor,
          takaNumber: t.takaNumber || t.receivedTakaNumber || String(idx + 1),
          sourceTakaNumber: t.sourceTakaNumber || '—',
          sourceLotNumber: t.sourceLotNumber || inw.lotNo || '—',
          receivedLotNumber: t.receivedLotNumber || `LOT-${inw.jwoNo}-P`,
          receivedTakaId: t.receivedTakaIdStr || `TAK-${t.takaNumber || idx + 1}`,
          meters: Number(t.meters || 0),
          weightKg: Number(t.weightKg || 0),
          width: Number(t.width || 0),
          shade: t.shade || inw.shade || '—',
          location: 'SYS-QC-HOLD (QC Hold)',
          qcStatus: t.qcStatus || 'Pending',
        });
      });
    });
    return list;
  }, [allInwardReceipts]);

  // Aggregate metrics across project
  const totalOutwardQty = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.outwardQty, 0);
  }, [augmentedOrders]);

  const totalInwardQty = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.inwardQty, 0);
  }, [augmentedOrders]);

  const totalAcceptedQty = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.acceptedQty, 0);
  }, [augmentedOrders]);

  const totalRejectedQty = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.rejectedQty, 0);
  }, [augmentedOrders]);

  const totalApprovedLoss = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.approvedLoss, 0);
  }, [augmentedOrders]);

  const totalPendingInwardQty = useMemo(() => {
    return augmentedOrders.reduce((sum, o) => sum + o.pendingQty, 0);
  }, [augmentedOrders]);

  const activeOrdersCount = useMemo(() => {
    return augmentedOrders.filter((o) => o.pendingQty > 0 || o.outwardQty > 0).length;
  }, [augmentedOrders]);

  const assignedVendorsCount = useMemo(() => {
    const vSet = new Set(augmentedOrders.map((o) => o.vendor).filter(Boolean));
    return vSet.size;
  }, [augmentedOrders]);

  // Nearest expected return date & overdue summary
  const returnSchedule = useMemo(() => {
    const pendingOrders = augmentedOrders.filter((o) => o.pendingQty > 0);
    const overdueOrders = pendingOrders.filter((o) => o.isOverdue);
    const dates = pendingOrders.map((o) => o.expectedCompletion).filter(Boolean).sort();
    const nearestDate = dates[0] || '—';
    const isAnyOverdue = overdueOrders.length > 0;
    return { nearestDate, isAnyOverdue, overdueCount: overdueOrders.length };
  }, [augmentedOrders]);

  // Project destination
  const projectDestination = useMemo(() => {
    let customer = 0;
    let own = 0;
    augmentedOrders.forEach((o) => {
      const dest = o.projectDestination || 'Customer Project';
      if (dest === 'Own Project') own += o.plannedQty;
      else customer += o.plannedQty;
    });
    if (customer > 0 && own > 0) return 'Mixed';
    if (own > 0) return 'Own Project';
    return project?.project_types || 'Customer Project';
  }, [augmentedOrders, project]);

  // Stage Progress: (Total Inward Received / Total Outward Sent) * 100%
  const stageProgressPct = useMemo(() => {
    if (totalOutwardQty <= 0) return 0;
    return Math.min(100, Math.round((totalInwardQty / totalOutwardQty) * 100));
  }, [totalInwardQty, totalOutwardQty]);

  // Stage Status
  const stageStatus = useMemo(() => {
    if (stageProgressPct === 100 && totalOutwardQty > 0) return 'Completed';
    if (returnSchedule.isAnyOverdue) return 'Delayed';
    if (totalInwardQty > 0) return 'Partially Received';
    if (totalOutwardQty > 0) return 'In Progress';
    return 'Pending';
  }, [stageProgressPct, totalOutwardQty, totalInwardQty, returnSchedule.isAnyOverdue]);

  // Available vendor options for filter
  const vendorOptions = useMemo(() => {
    return Array.from(new Set(augmentedOrders.map((o) => o.vendor).filter(Boolean)));
  }, [augmentedOrders]);

  // Currently selected JWO inside the create inward modal
  const modalSelectedJWO = useMemo(() => {
    if (!inwardForm.jwoId) return augmentedOrders[0] || null;
    return augmentedOrders.find((o) => String(o.id) === String(inwardForm.jwoId)) || null;
  }, [augmentedOrders, inwardForm.jwoId]);

  // Open Create Inward Modal with auto-fill
  const handleOpenCreateModal = (targetJwo = null) => {
    const orderToUse = targetJwo || augmentedOrders[0];
    if (!orderToUse) {
      toast.error('No Job Work Orders found for this project. Create an order in Stage 11 & dispatch in Stage 12 first.');
      return;
    }

    const defaultPending = orderToUse.pendingQty > 0 ? orderToUse.pendingQty : orderToUse.outwardQty;
    const defaultChallan = orderToUse.outwards?.[0]?.challanNo || orderToUse.outwards?.[0]?.no || '';
    const defaultTransporter = orderToUse.outwards?.[0]?.transporter || 'Standard Transport Logistics';
    const defaultVehicle = orderToUse.outwards?.[0]?.vehicleNo || '';

    // Collect dispatched takas from outward challans to pre-populate roll entries
    const dispatchedTakas = [];
    (orderToUse.outwards || []).forEach((out) => {
      (out.takas || []).forEach((t) => {
        dispatchedTakas.push({
          sourceTakaId: t.lotTakaId || t.id,
          sourceTakaNumber: t.takaNo || t.taka_number || '1',
          sourceLotNumber: t.lotNo || t.lot_number || orderToUse.lotNo || '',
          takaNumber: t.takaNo || t.taka_number || '1',
          meters: Number(t.meters || 0),
          weightKg: Number(t.weightKg || 0),
          width: 58,
          shade: orderToUse.shade || '',
        });
      });
    });

    // If outward had no specific taka lines, provide 1 default taka line matching defaultPending
    if (dispatchedTakas.length === 0) {
      dispatchedTakas.push({
        sourceTakaId: null,
        sourceTakaNumber: '1',
        sourceLotNumber: orderToUse.lotNo || 'LOT-2026',
        takaNumber: '1',
        meters: defaultPending > 0 ? defaultPending : 100,
        weightKg: 25,
        width: 58,
        shade: orderToUse.shade || '',
      });
    }

    setInwardForm({
      jwoId: orderToUse.id,
      date: todayISO(),
      qty: defaultPending > 0 ? String(defaultPending) : '',
      accepted: defaultPending > 0 ? String(defaultPending) : '',
      rejected: '0',
      challanNo: defaultChallan,
      transporter: defaultTransporter,
      vehicleNo: defaultVehicle,
      lrNo: `LR-IN-${Date.now().toString().slice(-5)}`,
      rollCount: dispatchedTakas.length,
      remarks: `Inward receipt for ${orderToUse.jwoNo} (${orderToUse.vendor})`,
      status: 'Received',
    });

    setModalTakaEntries(dispatchedTakas);
    setFormError('');
    setIsCreateModalOpen(true);
  };

  // Change selected JWO in modal
  const handleModalJwoChange = (newJwoId) => {
    const ord = augmentedOrders.find((o) => String(o.id) === String(newJwoId));
    if (!ord) return;
    const defaultPending = ord.pendingQty > 0 ? ord.pendingQty : ord.outwardQty;
    const defaultChallan = ord.outwards?.[0]?.challanNo || ord.outwards?.[0]?.no || '';
    setInwardForm((prev) => ({
      ...prev,
      jwoId: ord.id,
      qty: defaultPending > 0 ? String(defaultPending) : '',
      accepted: defaultPending > 0 ? String(defaultPending) : '',
      rejected: '0',
      challanNo: defaultChallan,
      remarks: `Inward receipt for ${ord.jwoNo} (${ord.vendor})`,
    }));
  };

  // Add / remove / update taka entries in modal
  const handleUpdateTakaEntry = (idx, field, value) => {
    setModalTakaEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleAddTakaRow = () => {
    setModalTakaEntries((prev) => [
      ...prev,
      {
        sourceTakaId: null,
        sourceTakaNumber: String(prev.length + 1),
        sourceLotNumber: modalSelectedJWO?.lotNo || 'LOT-2026',
        takaNumber: String(prev.length + 1),
        meters: 0,
        weightKg: 25,
        width: 58,
        shade: modalSelectedJWO?.shade || '',
      },
    ]);
  };

  const handleRemoveTakaRow = (idx) => {
    setModalTakaEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit Inward Receipt Form
  const handleSubmitInward = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!modalSelectedJWO) {
      setFormError('Please select a valid Job Work Order.');
      return;
    }

    const qty = Number(inwardForm.qty);
    if (!(qty > 0)) {
      setFormError('Received quantity must be greater than zero.');
      return;
    }

    const rejected = Math.max(0, Number(inwardForm.rejected) || 0);
    const accepted = inwardForm.accepted !== '' ? Number(inwardForm.accepted) : Math.max(0, qty - rejected);

    if (accepted + rejected > qty) {
      setFormError('Accepted + Rejected quantity cannot exceed the total received quantity.');
      return;
    }

    // Pending limit check: prevent exceeding what is still at vendor
    const currentPending = modalSelectedJWO.pendingQty > 0 ? modalSelectedJWO.pendingQty : modalSelectedJWO.outwardQty;
    if (qty > currentPending) {
      setFormError(
        `Received quantity (${n(qty)} m) exceeds the quantity still outstanding at vendor (${n(currentPending)} m).`
      );
      return;
    }

    setSavingInward(true);
    try {
      // Prepare roll-by-roll taka payload
      const takasPayload = modalTakaEntries.map((t, idx) => ({
        source_taka_id: t.sourceTakaId || undefined,
        sourceTakaId: t.sourceTakaId || undefined,
        taka_number: String(t.takaNumber || idx + 1),
        meters: Number(t.meters || 0) > 0 ? Number(t.meters) : Number(qty / (modalTakaEntries.length || 1)),
        weight_kg: Number(t.weightKg) || undefined,
        width: Number(t.width) || undefined,
        shade: t.shade || modalSelectedJWO.shade || undefined,
      }));

      const payload = {
        date: inwardForm.date,
        qty: qty,
        accepted: accepted,
        rejected: rejected,
        challanNo: inwardForm.challanNo,
        status: inwardForm.status || 'Received',
        remarks: inwardForm.remarks,
        takas: takasPayload,
      };

      const res = await createJWORow(modalSelectedJWO.id, 'inwards', payload);
      toast.success(
        `Job Work Inward receipt ${res.no || 'created'} recorded successfully! ${n(qty)} M received into SYS-QC-HOLD.`
      );

      setIsCreateModalOpen(false);
      await loadRecords();
      if (onUpdated) await onUpdated();
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to record inward receipt.'));
    } finally {
      setSavingInward(false);
    }
  };

  // Delete Inward Receipt (if not yet inspected)
  const handleDeleteInward = async (inward) => {
    if (!window.confirm(`Are you sure you want to delete inward receipt ${inward.no}?`)) return;
    try {
      await deleteJWORow(inward.jwoId, 'inwards', inward.id);
      toast.success(`Inward receipt ${inward.no} deleted.`);
      await loadRecords();
      if (onUpdated) await onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete inward receipt.'));
    }
  };

  return (
    <div className="space-y-5">
      {/* =========================================================================
          1. LIFECYCLE HEADER (MATCHING STAGE 11 LAYOUT EXACTLY)
         ========================================================================= */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-teal-200 bg-teal-50/70 text-teal-600 shadow-2xs">
              <ArrowDownToLine size={26} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {code || 'PMS-PROJECT'}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {project?.product_name || project?.name || 'Textile Manufacturing Project'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${DEST_PILL[projectDestination] || DEST_PILL['Customer Project']}`}>
                  {projectDestination}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${INWARD_STATUS_PILL[stageStatus] || INWARD_STATUS_PILL['Received']}`}>
                  {stageStatus}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight mt-1">
                Stage {stageSeq}: {stage?.name || 'Job Work Inward (Receive)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record physical fabric returned from processors, capture partial receipts, reconcile vendor balances, and release to Stage 15 QC.
              </p>
            </div>
          </div>

          {/* Navigation & Action Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            

            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Record Inward</span>
            </button>

            <button
              type="button"
              onClick={loadRecords}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Refresh records"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Linked Documents & Stage Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-600 flex-wrap">
            <span className="flex items-center gap-1.5">
              <FileText size={14} className="text-blue-600" />
              <span><strong>{orders.length}</strong> Job Work Orders</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Truck size={14} className="text-amber-600" />
              <span><strong>{n(totalOutwardQty)}</strong> M Dispatched</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ArrowDownToLine size={14} className="text-teal-600" />
              <span><strong>{allInwardReceipts.length}</strong> Inward Receipts ({n(totalInwardQty)} M)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Box size={14} className="text-indigo-600" />
              <span><strong>{allReceivedTakas.length}</strong> Rolls in QC Hold</span>
            </span>
          </div>

          <div className="flex items-center gap-3 min-w-[220px]">
            <span className="text-[11px] font-bold text-slate-500">Inward Progress</span>
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-teal-600 rounded-full transition-all duration-300"
                style={{ width: `${stageProgressPct}%` }}
              />
            </div>
            <span className="font-mono font-bold text-teal-700">{stageProgressPct}%</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* =========================================================================
          2. SUMMARY CARDS (EXACT STAGE 11 8-CARD GRID STRUCTURE)
         ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* 1. Total Outward Quantity */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Total Outward</p>
          <p className="text-base font-black text-amber-800 mt-1 font-mono">{n(totalOutwardQty)}</p>
          <p className="text-[10px] text-amber-600 mt-0.5">Dispatched to mill</p>
        </div>

        {/* 2. Total Received Quantity */}
        <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Total Received</p>
          <p className="text-base font-black text-teal-800 mt-1 font-mono">{n(totalInwardQty)}</p>
          <p className="text-[10px] text-teal-600 mt-0.5">Dock intake</p>
        </div>

        {/* 3. Pending Inward Quantity */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Pending Inward</p>
          <p className="text-base font-black text-indigo-800 mt-1 font-mono">{n(totalPendingInwardQty)}</p>
          <p className="text-[10px] text-indigo-600 mt-0.5">Awaiting return</p>
        </div>

        {/* 4. Accepted Good Quantity */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Accepted Qty</p>
          <p className="text-base font-black text-emerald-800 mt-1 font-mono">{n(totalAcceptedQty)}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Passed intake</p>
        </div>

        {/* 5. Approved Processing Loss */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Approved Loss</p>
          <p className="text-base font-black text-slate-900 mt-1 font-mono">{n(totalApprovedLoss)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Reconciled</p>
        </div>

        {/* 6. Shortage / Damage Quantity */}
        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Short / Damaged</p>
          <p className="text-base font-black text-rose-800 mt-1 font-mono">{n(totalRejectedQty)}</p>
          <p className="text-[10px] text-rose-600 mt-0.5">Rejected at intake</p>
        </div>

        {/* 7. Expected Return & Overdue Status */}
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Return Target</p>
          <p className={`text-base font-black mt-1 font-mono ${returnSchedule.isAnyOverdue ? 'text-rose-700' : 'text-purple-800'}`}>
            {returnSchedule.nearestDate}
          </p>
          <p className="text-[10px] text-purple-600 mt-0.5">
            {returnSchedule.isAnyOverdue ? `${returnSchedule.overdueCount} Overdue` : 'On Schedule'}
          </p>
        </div>

        {/* 8. Active Orders & Processors */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Active Orders</p>
          <p className="text-base font-black text-blue-800 mt-1 font-mono">{activeOrdersCount}</p>
          <p className="text-[10px] text-blue-600 mt-0.5">{assignedVendorsCount} Processors</p>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN OPERATIONAL CARD & 5 TABBED TABLES (PART 5 OF PROMPT)
         ========================================================================= */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-4">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Package size={16} className="text-teal-600" />
              <span>Job Work Inward Management — Project {code}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Traceable receipt history, outward reconciliation, roll-level inventory intake, and vendor return monitoring.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-2xs cursor-pointer transition-colors"
            >
              <Plus size={13} />
              <span>New Inward Receipt</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs for the 5 Tables */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTableTab('inwards_history')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTableTab === 'inwards_history'
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Table B: Inward Receipt History</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              {allInwardReceipts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTableTab('jwo_outwards')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTableTab === 'jwo_outwards'
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Table A: Linked Orders & Outwards</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              {augmentedOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTableTab('takas_breakdown')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTableTab === 'takas_breakdown'
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Table C: Lot / Taka Received Rolls</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              {allReceivedTakas.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTableTab('reconciliation')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTableTab === 'reconciliation'
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Table D: Reconciliation Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTableTab('pending_overdue')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTableTab === 'pending_overdue'
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Table E: Pending & Overdue Returns</span>
            {returnSchedule.isAnyOverdue && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-bold">
                {returnSchedule.overdueCount} Overdue
              </span>
            )}
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            TABLE B: INWARD RECEIPT HISTORY
           ───────────────────────────────────────────────────────────────────── */}
        {activeTableTab === 'inwards_history' && (
          <div className="space-y-3">
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3">Inward No</th>
                    <th className="p-3">JWO No</th>
                    <th className="p-3">Vendor / Processor</th>
                    <th className="p-3">Process</th>
                    <th className="p-3">Inward Date</th>
                    <th className="p-3">Vendor Challan</th>
                    <th className="p-3 text-right">Received (m)</th>
                    <th className="p-3 text-right">Accepted (m)</th>
                    <th className="p-3 text-right">Rejected (m)</th>
                    <th className="p-3 text-center">Holding Godown</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allInwardReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-slate-400">
                        No inward receipts recorded for this project yet. Click &quot;New Inward Receipt&quot; to intake returned fabric.
                      </td>
                    </tr>
                  ) : (
                    allInwardReceipts.map((inw) => (
                      <tr key={inw.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono font-bold text-teal-700 whitespace-nowrap">
                          {inw.no}
                        </td>
                        <td className="p-3 font-mono font-semibold text-blue-700 whitespace-nowrap">
                          {inw.jwoNo}
                        </td>
                        <td className="p-3 font-medium text-slate-800 whitespace-nowrap">
                          {inw.vendor}
                        </td>
                        <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                          {inw.process}
                        </td>
                        <td className="p-3 text-slate-600 whitespace-nowrap font-sans">
                          {inw.date}
                        </td>
                        <td className="p-3 text-slate-700 whitespace-nowrap">
                          {inw.challanNo || '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {n(inw.receivedQty)} m
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {n(inw.acceptedQty)} m
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                          {n(inw.rejectedQty)} m
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            SYS-QC-HOLD
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${INWARD_STATUS_PILL[inw.effectiveStatus] || INWARD_STATUS_PILL.Received}`}>
                            {inw.effectiveStatus}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedInwardDetail(inw)}
                              className="p-1 rounded text-slate-500 hover:text-teal-600 hover:bg-teal-50 cursor-pointer"
                              title="View Inward Breakdown"
                            >
                              <Eye size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteInward(inw)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete Inward Receipt"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TABLE A: LINKED JOB WORK ORDERS & OUTWARD CHALLANS
           ───────────────────────────────────────────────────────────────────── */}
        {activeTableTab === 'jwo_outwards' && (
          <div className="space-y-3">
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3">JWO No</th>
                    <th className="p-3">Plan No</th>
                    <th className="p-3">Processor</th>
                    <th className="p-3">Process</th>
                    <th className="p-3 text-right">Planned (m)</th>
                    <th className="p-3 text-right">Outward Dispatched (m)</th>
                    <th className="p-3 text-right">Inward Received (m)</th>
                    <th className="p-3 text-right">Pending at Mill (m)</th>
                    <th className="p-3">Outward Challan</th>
                    <th className="p-3">Dispatch Date</th>
                    <th className="p-3">Target Return</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {augmentedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-10 text-center text-slate-400">
                        No Job Work Orders found for this project.
                      </td>
                    </tr>
                  ) : (
                    augmentedOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {ord.jwoNo}
                        </td>
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                          {ord.effectivePlanNo}
                        </td>
                        <td className="p-3 font-medium text-slate-800 whitespace-nowrap">
                          {ord.vendor}
                        </td>
                        <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                          {ord.process}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {n(ord.plannedQty)} m
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                          {n(ord.outwardQty)} m
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-teal-700 whitespace-nowrap">
                          {n(ord.inwardQty)} m
                        </td>
                        <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                          <span className={ord.pendingQty > 0 ? 'text-indigo-700' : 'text-slate-400'}>
                            {n(ord.pendingQty)} m
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                          {ord.latestChallan}
                        </td>
                        <td className="p-3 text-slate-600 whitespace-nowrap font-sans">
                          {ord.latestOutwardDate}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={ord.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                            {ord.expectedCompletion || '—'}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${INWARD_STATUS_PILL[ord.pendingQty === 0 && ord.outwardQty > 0 ? 'Fully Received' : 'Partially Received']}`}>
                            {ord.pendingQty === 0 && ord.outwardQty > 0 ? 'Fully Received' : ord.inwardQty > 0 ? 'Partially Received' : 'In Process'}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenCreateModal(ord)}
                            disabled={ord.pendingQty === 0 && ord.outwardQty > 0}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
                          >
                            <Plus size={11} />
                            <span>Inward</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TABLE C: LOT / TAKA RECEIVED ROLLS BREAKDOWN
           ───────────────────────────────────────────────────────────────────── */}
        {activeTableTab === 'takas_breakdown' && (
          <div className="space-y-3">
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3">Received Taka ID</th>
                    <th className="p-3">Taka Roll No</th>
                    <th className="p-3">Inward Receipt</th>
                    <th className="p-3">JWO No</th>
                    <th className="p-3">Source Lot No</th>
                    <th className="p-3">Received Lot No</th>
                    <th className="p-3 text-right">Length (m)</th>
                    <th className="p-3 text-right">Weight (kg)</th>
                    <th className="p-3 text-right">Width (in)</th>
                    <th className="p-3">Shade / Colour</th>
                    <th className="p-3 text-center">Holding Location</th>
                    <th className="p-3 text-center">QC Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allReceivedTakas.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-slate-400">
                        No roll-level takas received yet. When you record inward receipts, individual rolls are tracked here in QC Hold.
                      </td>
                    </tr>
                  ) : (
                    allReceivedTakas.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono font-bold text-teal-700 whitespace-nowrap">
                          {t.receivedTakaId}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap text-center">
                          {t.takaNumber}
                        </td>
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                          {t.inwardNo}
                        </td>
                        <td className="p-3 font-mono text-blue-700 whitespace-nowrap">
                          {t.jwoNo}
                        </td>
                        <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                          {t.sourceLotNumber}
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {t.receivedLotNumber}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {n(t.meters)} m
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700 whitespace-nowrap">
                          {t.weightKg > 0 ? `${n(t.weightKg)} kg` : '—'}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700 whitespace-nowrap">
                          {t.width > 0 ? `${t.width}"` : '—'}
                        </td>
                        <td className="p-3 text-slate-700 whitespace-nowrap">
                          {t.shade}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            SYS-QC-HOLD
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {t.qcStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TABLE D: RECONCILIATION SUMMARY
           ───────────────────────────────────────────────────────────────────── */}
        {activeTableTab === 'reconciliation' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  Material Reconciliation Equation (PDF §07: Sent − Received − Approved Loss = Closing Pending)
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    totalPendingInwardQty === 0 && totalOutwardQty > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {totalPendingInwardQty === 0 && totalOutwardQty > 0 ? 'Fully Reconciled' : 'Inward Pending'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-sans text-slate-400 block font-semibold uppercase">Total Dispatched</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{n(totalOutwardQty)} M</span>
                  <span className="text-[10px] text-slate-500 font-sans">Sent to processors</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-sans text-teal-700 block font-semibold uppercase">Received at Dock</span>
                  <span className="font-bold text-teal-800 text-sm mt-0.5 block">{n(totalInwardQty)} M</span>
                  <span className="text-[10px] text-teal-600 font-sans">{n(totalAcceptedQty)} M Accepted</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-sans text-slate-500 block font-semibold uppercase">Approved Loss</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">{n(totalApprovedLoss)} M</span>
                  <span className="text-[10px] text-slate-500 font-sans">Reconciled deduction</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-sans text-rose-700 block font-semibold uppercase">Shortage / Rejected</span>
                  <span className="font-bold text-rose-800 text-sm mt-0.5 block">{n(totalRejectedQty)} M</span>
                  <span className="text-[10px] text-rose-600 font-sans">Discrepancy</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-sans text-indigo-700 block font-semibold uppercase">Closing Pending</span>
                  <span className={`font-bold text-sm mt-0.5 block ${totalPendingInwardQty > 0 ? 'text-indigo-800' : 'text-emerald-700'}`}>
                    {n(totalPendingInwardQty)} M
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">Still at mills</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TABLE E: PENDING RECEIPTS & OVERDUE VENDOR RETURNS
           ───────────────────────────────────────────────────────────────────── */}
        {activeTableTab === 'pending_overdue' && (
          <div className="space-y-3">
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3">JWO No</th>
                    <th className="p-3">Vendor / Processor</th>
                    <th className="p-3">Process</th>
                    <th className="p-3 text-right">Dispatched (m)</th>
                    <th className="p-3 text-right">Received (m)</th>
                    <th className="p-3 text-right">Outstanding (m)</th>
                    <th className="p-3">Expected Return</th>
                    <th className="p-3 text-center">Overdue Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {augmentedOrders.filter((o) => o.pendingQty > 0).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-emerald-600 font-semibold">
                        All dispatched materials have been returned and received. Zero pending or overdue returns!
                      </td>
                    </tr>
                  ) : (
                    augmentedOrders
                      .filter((o) => o.pendingQty > 0)
                      .map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {ord.jwoNo}
                          </td>
                          <td className="p-3 font-medium text-slate-800 whitespace-nowrap">
                            {ord.vendor}
                          </td>
                          <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                            {ord.process}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                            {n(ord.outwardQty)} m
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-teal-700 whitespace-nowrap">
                            {n(ord.inwardQty)} m
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-indigo-700 whitespace-nowrap">
                            {n(ord.pendingQty)} m
                          </td>
                          <td className="p-3 whitespace-nowrap font-sans">
                            <span className={ord.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                              {ord.expectedCompletion || '—'}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {ord.isOverdue ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Overdue
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Pending Return
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenCreateModal(ord)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                            >
                              <Plus size={12} />
                              <span>Record Inward</span>
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          4. STAGE 15 QUALITY CHECK & STOCK ALLOCATION HANDOVER BANNER
         ========================================================================= */}
      {totalInwardQty > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs shadow-2xs">
          <div className="flex items-center gap-3 text-emerald-950">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-700">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="font-bold text-slate-900">
                {n(totalInwardQty)} M of processed fabric received at the dock into QC Hold (SYS-QC-HOLD).
              </p>
              <p className="text-slate-600 mt-0.5">
                Fabric must now undergo 4-point inspection and grade disposition (Grade A / Seconds / Reject) before stock allocation. Proceed to <strong>Stage 15 — Quality Check & Stock Allocation</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectStage && onSelectStage(stageSeq + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs whitespace-nowrap text-xs transition-colors shrink-0"
          >
            <span>Proceed to Stage {stageSeq + 1} (Quality Check & Stock Allocation)</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* =========================================================================
          5. CREATE INWARD RECEIPT MODAL (PART 3 OF PROMPT)
         ========================================================================= */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title={`Record Job Work Inward Receipt — ${modalSelectedJWO?.jwoNo || ''}`}
          subtitle={`Receive physical finished rolls back from ${modalSelectedJWO?.vendor || 'Vendor'} into godown SYS-QC-HOLD.`}
          size="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-slate-500">
                Outstanding at Vendor: <span className="font-mono font-bold text-indigo-700">{n(modalSelectedJWO?.pendingQty || modalSelectedJWO?.outwardQty)} m</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" type="button" onClick={() => setIsCreateModalOpen(false)} disabled={savingInward}>
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={handleSubmitInward}
                  disabled={savingInward}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <ArrowDownToLine size={13} className={savingInward ? 'animate-bounce' : ''} />
                  <span>{savingInward ? 'Recording Inward...' : 'Confirm Inward Receipt'}</span>
                </button>
              </div>
            </div>
          }
        >
          <form onSubmit={handleSubmitInward} className="space-y-4 text-xs">
            {formError && (
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* JWO & Auto-filled details strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Job Work Order <span className="text-rose-500">*</span>
                </label>
                <select
                  value={inwardForm.jwoId}
                  onChange={(e) => handleModalJwoChange(e.target.value)}
                  className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-blue-700 text-xs"
                >
                  {augmentedOrders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.jwoNo} ({ord.vendor} — {ord.process})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Fabric & Quality</span>
                <span className="font-semibold text-slate-900 text-xs mt-1 block">
                  {modalSelectedJWO?.fabricItem} ({modalSelectedJWO?.fabricQuality || 'Grey'})
                </span>
                <span className="text-[11px] text-slate-500">Target Shade: {modalSelectedJWO?.shade || '—'}</span>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Outward Dispatched</span>
                <span className="font-mono font-bold text-amber-800 text-xs mt-1 block">
                  {n(modalSelectedJWO?.outwardQty)} m
                </span>
                <span className="text-[11px] text-indigo-700 font-mono font-semibold">
                  Pending: {n(modalSelectedJWO?.pendingQty || modalSelectedJWO?.outwardQty)} m
                </span>
              </div>
            </div>

            {/* Inward Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Receipt Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={inwardForm.date}
                  onChange={(e) => setInwardForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-sans"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Total Received (m) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={inwardForm.qty}
                  onChange={(e) => {
                    const val = e.target.value;
                    const rej = Number(inwardForm.rejected) || 0;
                    const numVal = Number(val) || 0;
                    setInwardForm((p) => ({
                      ...p,
                      qty: val,
                      accepted: String(Math.max(0, numVal - rej)),
                    }));
                  }}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Vendor Challan No
                </label>
                <input
                  type="text"
                  placeholder="e.g. DC-MILL-8812"
                  value={inwardForm.challanNo}
                  onChange={(e) => setInwardForm((p) => ({ ...p, challanNo: e.target.value }))}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Accepted Qty (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inwardForm.accepted}
                  onChange={(e) => setInwardForm((p) => ({ ...p, accepted: e.target.value }))}
                  className="w-full p-2 rounded-lg border border-emerald-300 bg-emerald-50/50 text-emerald-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Rejected / Damaged Qty (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inwardForm.rejected}
                  onChange={(e) => {
                    const rej = e.target.value;
                    const total = Number(inwardForm.qty) || 0;
                    const numRej = Number(rej) || 0;
                    setInwardForm((p) => ({
                      ...p,
                      rejected: rej,
                      accepted: String(Math.max(0, total - numRej)),
                    }));
                  }}
                  className="w-full p-2 rounded-lg border border-rose-300 bg-rose-50/50 text-rose-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Holding Godown Location
                </label>
                <div className="p-2 rounded-lg border border-indigo-200 bg-indigo-50/70 font-mono font-bold text-indigo-800">
                  SYS-QC-HOLD (Godown)
                </div>
              </div>
            </div>

            {/* Transport & Remarks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Transporter</label>
                <input
                  type="text"
                  placeholder="Transport agency..."
                  value={inwardForm.transporter}
                  onChange={(e) => setInwardForm((p) => ({ ...p, transporter: e.target.value }))}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vehicle No</label>
                <input
                  type="text"
                  placeholder="e.g. GJ-05-BX-4921"
                  value={inwardForm.vehicleNo}
                  onChange={(e) => setInwardForm((p) => ({ ...p, vehicleNo: e.target.value }))}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">LR / Bilty No</label>
                <input
                  type="text"
                  placeholder="LR-00000"
                  value={inwardForm.lrNo}
                  onChange={(e) => setInwardForm((p) => ({ ...p, lrNo: e.target.value }))}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Remarks & Inward Notes</label>
              <textarea
                rows={2}
                placeholder="Roll packaging condition, seal integrity, mill tags verified..."
                value={inwardForm.remarks}
                onChange={(e) => setInwardForm((p) => ({ ...p, remarks: e.target.value }))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800"
              />
            </div>

            {/* Roll / Taka Breakdown Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Box size={14} className="text-teal-600" />
                  <span>Received Rolls (Takas) Intake Breakdown</span>
                </span>
                <button
                  type="button"
                  onClick={handleAddTakaRow}
                  className="text-xs px-2 py-0.5 rounded border border-teal-200 text-teal-700 hover:bg-teal-50 cursor-pointer font-semibold flex items-center gap-1"
                >
                  <Plus size={11} /> Add Roll
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[180px] overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2">Roll No</th>
                      <th className="p-2">Source Lot</th>
                      <th className="p-2 text-right">Length (m)</th>
                      <th className="p-2 text-right">Weight (kg)</th>
                      <th className="p-2 text-right">Width (in)</th>
                      <th className="p-2">Shade</th>
                      <th className="p-2 text-center">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {modalTakaEntries.map((t, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={t.takaNumber}
                            onChange={(e) => handleUpdateTakaEntry(idx, 'takaNumber', e.target.value)}
                            className="w-14 p-1 border border-slate-300 rounded bg-white text-center font-bold"
                          />
                        </td>
                        <td className="p-2 text-slate-600">{t.sourceLotNumber || modalSelectedJWO?.lotNo}</td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={t.meters}
                            onChange={(e) => handleUpdateTakaEntry(idx, 'meters', e.target.value)}
                            className="w-20 p-1 border border-slate-300 rounded bg-white text-right font-bold"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.1"
                            value={t.weightKg}
                            onChange={(e) => handleUpdateTakaEntry(idx, 'weightKg', e.target.value)}
                            className="w-16 p-1 border border-slate-300 rounded bg-white text-right"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={t.width}
                            onChange={(e) => handleUpdateTakaEntry(idx, 'width', e.target.value)}
                            className="w-14 p-1 border border-slate-300 rounded bg-white text-right"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={t.shade}
                            onChange={(e) => handleUpdateTakaEntry(idx, 'shade', e.target.value)}
                            className="w-20 p-1 border border-slate-300 rounded bg-white font-sans"
                          />
                        </td>
                        <td className="p-2 text-center font-sans">
                          {modalTakaEntries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTakaRow(idx)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          6. INWARD RECEIPT DETAIL MODAL
         ========================================================================= */}
      {selectedInwardDetail && (
        <Modal
          isOpen={Boolean(selectedInwardDetail)}
          onClose={() => setSelectedInwardDetail(null)}
          title={`Inward Receipt Details — ${selectedInwardDetail.no}`}
          subtitle={`Received on ${selectedInwardDetail.date} against JWO ${selectedInwardDetail.jwoNo} (${selectedInwardDetail.vendor}).`}
          size="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 font-mono">
                Location: SYS-QC-HOLD (QC Hold Stock)
              </span>
              <Button variant="outline" type="button" onClick={() => setSelectedInwardDetail(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Inward Receipt</span>
                <span className="text-sm font-mono font-bold text-teal-800 mt-0.5 block">{selectedInwardDetail.no}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Received Meters</span>
                <span className="text-sm font-mono font-bold text-slate-900 mt-0.5 block">{n(selectedInwardDetail.receivedQty)} m</span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-700 uppercase font-bold block">Accepted</span>
                <span className="text-sm font-mono font-bold text-emerald-800 mt-0.5 block">{n(selectedInwardDetail.acceptedQty)} m</span>
              </div>
              <div>
                <span className="text-[10px] text-rose-700 uppercase font-bold block">Rejected</span>
                <span className="text-sm font-mono font-bold text-rose-800 mt-0.5 block">{n(selectedInwardDetail.rejectedQty)} m</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Processor & JWO</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">{selectedInwardDetail.vendor}</span>
                <span className="text-[11px] text-blue-700 font-mono">{selectedInwardDetail.jwoNo} ({selectedInwardDetail.process})</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Fabric & Quality</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">{selectedInwardDetail.fabricItem}</span>
                <span className="text-[11px] text-slate-500">{selectedInwardDetail.fabricQuality || 'Grey'}</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Challan & Status</span>
                <span className="text-xs font-mono font-bold text-slate-800 mt-1 block">{selectedInwardDetail.challanNo || '—'}</span>
                <span className="text-[11px] text-teal-700 font-bold">{selectedInwardDetail.effectiveStatus}</span>
              </div>
            </div>

            {/* Received Takas in this receipt */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 block">Received Roll Takas</span>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Roll No</th>
                      <th className="p-2.5">Source Lot</th>
                      <th className="p-2.5 text-right">Length (m)</th>
                      <th className="p-2.5 text-right">Weight (kg)</th>
                      <th className="p-2.5 text-right">Width</th>
                      <th className="p-2.5">Shade</th>
                      <th className="p-2.5 text-center">Holding Location</th>
                      <th className="p-2.5 text-center">QC Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {(selectedInwardDetail.takas || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-3 text-center text-slate-400 font-sans">
                          Consolidated receipt entry ({n(selectedInwardDetail.receivedQty)} M).
                        </td>
                      </tr>
                    ) : (
                      selectedInwardDetail.takas.map((t, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-bold text-slate-800">{t.takaNumber || idx + 1}</td>
                          <td className="p-2.5 text-slate-600">{t.sourceLotNumber || selectedInwardDetail.lotNo}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">{n(t.meters)} m</td>
                          <td className="p-2.5 text-right">{t.weightKg ? `${n(t.weightKg)} kg` : '—'}</td>
                          <td className="p-2.5 text-right">{t.width ? `${t.width}"` : '—'}</td>
                          <td className="p-2.5 font-sans">{t.shade || selectedInwardDetail.shade}</td>
                          <td className="p-2.5 text-center font-sans">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                              SYS-QC-HOLD
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-sans">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                              {t.qcStatus || 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Stage14JobWorkInwardWorkspace;
