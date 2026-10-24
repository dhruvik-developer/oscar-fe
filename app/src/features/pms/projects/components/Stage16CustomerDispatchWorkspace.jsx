import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  MapPin,
  Package,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  fetchStage16DispatchData,
  createStage16Dispatch,
  updateStage16DispatchLR,
  errorMessage,
} from '../../../../services/jobWorkSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_PILL = {
  Dispatched: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'In Transit': 'bg-blue-50 text-blue-700 border-blue-200',
  Delivered: 'bg-purple-50 text-purple-700 border-purple-200',
  Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function Stage16CustomerDispatchWorkspace({
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
  const stageSeq = stage?.sequence || 16;
  const stageName = stage?.name || 'Stage 16 — Customer Dispatch';

  // Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workspaceData, setWorkspaceData] = useState(null);

  // Tab navigation
  const [activeTab, setActiveTab] = useState('eligibleStock'); // eligibleStock | challans | handover

  // Filters for Section A (Eligible Stock)
  const [searchFilter, setSearchFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');

  // Selected takas for dispatch: { [takaId]: dispatchQty }
  const [selectedTakas, setSelectedTakas] = useState({});

  // Modals state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isLRModalOpen, setIsLRModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Dispatch Form State
  const [dispatchDate, setDispatchDate] = useState(todayISO());
  const [dispatchGodownId, setDispatchGodownId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [transporter, setTransporter] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [freightCharges, setFreightCharges] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // LR Update Form State
  const [lrEditChallanId, setLrEditChallanId] = useState('');
  const [lrEditNumber, setLrEditNumber] = useState('');
  const [lrEditTransporter, setLrEditTransporter] = useState('');
  const [lrEditVehicle, setLrEditVehicle] = useState('');
  const [lrEditFreight, setLrEditFreight] = useState('');
  const [lrEditNotes, setLrEditNotes] = useState('');

  // Load Stage 16 workspace data from backend
  const loadWorkspaceData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchStage16DispatchData(projectId);
      setWorkspaceData(res);
      if (res?.customer?.shippingAddress) {
        setDeliveryAddress(res.customer.shippingAddress);
      }
      if (res?.locations?.length > 0 && !dispatchGodownId) {
        setDispatchGodownId(res.locations[0].id);
      }
    } catch (err) {
      console.error('Failed to load Stage 16 Customer Dispatch data:', err);
      setError(errorMessage(err, 'Failed to load Customer Dispatch workspace data.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, dispatchGodownId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Extract data with safe fallbacks
  const summary = workspaceData?.summary || {
    targetRequirementMeters: Number(project?.requirement_meters || project?.quantity || 3000),
    eligibleForDispatch: 0,
    alreadyDispatched: 0,
    pendingDispatch: Number(project?.requirement_meters || project?.quantity || 3000),
    qcHoldRejectedQty: 0,
    dispatchedPercentage: 0,
    uom: 'Meters',
  };

  const eligibleTakas = workspaceData?.eligibleTakas || [];
  const challans = workspaceData?.challans || [];
  const customer = workspaceData?.customer || {
    name: project?.customer_name || 'Customer',
    shippingAddress: '',
    gstin: '',
    phone: '',
  };
  const salesOrder = workspaceData?.salesOrder || {
    orderNumber: '—',
    orderDate: '—',
    stage: '—',
  };
  const locations = workspaceData?.locations || [];

  const targetReq = summary.targetRequirementMeters || 3000;
  const dispatchPct = summary.dispatchedPercentage || Math.min(100, Math.round(((summary.alreadyDispatched || 0) / targetReq) * 100));

  // Determine current lifecycle status
  const currentStatus = useMemo(() => {
    if (summary.alreadyDispatched >= targetReq && targetReq > 0) return 'Completed';
    if (summary.alreadyDispatched > 0) return 'In Progress';
    if (summary.eligibleForDispatch > 0) return 'Ready for Dispatch';
    return 'Pending';
  }, [summary.alreadyDispatched, summary.eligibleForDispatch, targetReq]);

  // Filtered takas for Section A
  const filteredTakas = useMemo(() => {
    return eligibleTakas.filter((t) => {
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        const matches =
          t.takaNumber?.toLowerCase().includes(q) ||
          t.lotNumber?.toLowerCase().includes(q) ||
          t.takaId?.toLowerCase().includes(q) ||
          t.fabricItem?.toLowerCase().includes(q) ||
          t.shade?.toLowerCase().includes(q) ||
          t.locationName?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (locationFilter !== 'ALL') {
        if (t.locationId !== locationFilter && t.locationName !== locationFilter) return false;
      }
      return true;
    });
  }, [eligibleTakas, searchFilter, locationFilter]);

  // Compute selected totals
  const selectedTakaEntries = useMemo(() => {
    return Object.entries(selectedTakas)
      .map(([id, qty]) => {
        const taka = eligibleTakas.find((t) => t.id === id);
        return taka ? { taka, qty: Number(qty || 0) } : null;
      })
      .filter((e) => e && e.qty > 0);
  }, [selectedTakas, eligibleTakas]);

  const selectedCount = selectedTakaEntries.length;
  const selectedTotalMeters = useMemo(() => {
    return selectedTakaEntries.reduce((sum, e) => sum + e.qty, 0);
  }, [selectedTakaEntries]);

  // Toggle selection for a taka
  const handleToggleSelectTaka = (taka, checked) => {
    setSelectedTakas((prev) => {
      const next = { ...prev };
      if (checked) {
        next[taka.id] = taka.availableQuantity;
      } else {
        delete next[taka.id];
      }
      return next;
    });
  };

  // Change dispatch quantity for a selected taka
  const handleQtyChange = (takaId, val, maxVal) => {
    const num = Math.min(Number(val || 0), maxVal);
    setSelectedTakas((prev) => ({
      ...prev,
      [takaId]: num > 0 ? num : 0,
    }));
  };

  // Select all filtered takas
  const handleSelectAllFiltered = (checked) => {
    if (checked) {
      const next = { ...selectedTakas };
      filteredTakas.forEach((t) => {
        next[t.id] = t.availableQuantity;
      });
      setSelectedTakas(next);
    } else {
      const next = { ...selectedTakas };
      filteredTakas.forEach((t) => {
        delete next[t.id];
      });
      setSelectedTakas(next);
    }
  };

  const isAllFilteredSelected = filteredTakas.length > 0 && filteredTakas.every((t) => selectedTakas[t.id] > 0);

  // Open dispatch modal for single roll
  const handleDispatchSingle = (taka) => {
    setSelectedTakas({ [taka.id]: taka.availableQuantity });
    setIsDispatchModalOpen(true);
  };

  // Open dispatch modal for bulk selection
  const handleOpenBulkDispatch = () => {
    if (selectedCount === 0) {
      toast.warning('Please select at least one roll to dispatch.');
      return;
    }
    setIsDispatchModalOpen(true);
  };

  // Submit Customer Dispatch
  const handleConfirmDispatch = async () => {
    if (selectedTakaEntries.length === 0) {
      toast.warning('Please select at least one roll to dispatch.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        dispatch_date: dispatchDate,
        location_id: dispatchGodownId,
        delivery_address: deliveryAddress,
        transporter: transporter.trim(),
        vehicle_number: vehicleNumber.trim(),
        lr_number: lrNumber.trim(),
        freight_charges: Number(freightCharges || 0),
        notes: dispatchNotes.trim(),
        selected_takas: selectedTakaEntries.map((e) => ({
          lot_taka_id: e.taka.lotTakaId || e.taka.id,
          dispatch_qty: e.qty,
        })),
      };

      const res = await createStage16Dispatch(projectId, payload);
      toast.success(`Delivery Challan ${res.challan_number || ''} generated successfully! ${n(res.dispatched_qty)} M dispatched.`);
      setIsDispatchModalOpen(false);
      setSelectedTakas({});
      setFreightCharges('');
      setDispatchNotes('');
      await loadWorkspaceData();
      onUpdated?.();
    } catch (err) {
      console.error('Failed to create customer dispatch:', err);
      toast.error(errorMessage(err, 'Failed to confirm customer dispatch.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Open Update LR Modal
  const handleOpenEditLR = (ch) => {
    setLrEditChallanId(ch.id);
    setLrEditNumber(ch.lrNumber || '');
    setLrEditTransporter(ch.transporter || '');
    setLrEditVehicle(ch.vehicleNumber || '');
    setLrEditFreight(String(ch.allocatedFreightCost || ''));
    setLrEditNotes(ch.notes || '');
    setIsLRModalOpen(true);
  };

  // Save LR Details
  const handleSaveLR = async () => {
    if (!lrEditChallanId) return;
    setSubmitting(true);
    try {
      const payload = {
        challan_id: lrEditChallanId,
        lr_number: lrEditNumber.trim(),
        transporter: lrEditTransporter.trim(),
        vehicle_number: lrEditVehicle.trim(),
        freight_charges: Number(lrEditFreight || 0),
        notes: lrEditNotes.trim(),
      };
      await updateStage16DispatchLR(projectId, payload);
      toast.success('Logistics & LR details updated successfully.');
      setIsLRModalOpen(false);
      await loadWorkspaceData();
      onUpdated?.();
    } catch (err) {
      console.error('Failed to update LR details:', err);
      toast.error(errorMessage(err, 'Failed to update LR details.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Open Printable Delivery Challan
  const handleOpenPrintChallan = (ch) => {
    setSelectedChallan(ch);
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. LIFECYCLE HEADER (Matching Stage 11 & Stage 15 design) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                Stage {stageSeq} of {totalStages}
              </span>
              <span className="text-slate-400">•</span>
              <span className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                CUSTOMER_DISPATCH
              </span>
              <span className="text-slate-400">•</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  currentStatus === 'Completed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : currentStatus === 'In Progress'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : currentStatus === 'Ready for Dispatch'
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {currentStatus}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {stageName}
              </h2>
              <span className="text-sm font-medium text-slate-500">
                ({code} — {customer.name})
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage finished fabric dispatches to customers, issue formal Delivery Challans, assign LR/transport manifests, and update real-time stock deductions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            

            <Button
              variant="outline"
              size="sm"
              onClick={loadWorkspaceData}
              disabled={loading}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Progress Bar & Key Context Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <User size={15} className="text-slate-400 shrink-0" />
            <div>
              <span className="text-slate-400">Customer Consignee:</span>{' '}
              <span className="font-semibold text-slate-800">{customer.name}</span>
              {customer.gstin && <span className="font-mono text-[11px] text-slate-500 ml-1">({customer.gstin})</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <FileText size={15} className="text-slate-400 shrink-0" />
            <div>
              <span className="text-slate-400">Sales Order Reference:</span>{' '}
              <span className="font-semibold text-slate-800">{salesOrder.orderNumber}</span>
              {salesOrder.orderDate !== '—' && (
                <span className="text-[11px] text-slate-500 ml-1">({salesOrder.orderDate})</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-600">Dispatch Fulfillment</span>
              <span className="font-mono font-bold text-slate-900">{dispatchPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className="bg-orange-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${dispatchPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 text-right">
              Target: <span className="font-semibold text-slate-800">{n(targetReq)} M</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY KPI CARDS (4 Cards matching Stage 11 & Stage 15 design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: QC-Approved Eligible Quantity */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">QC-Approved Eligible Qty</span>
            <ShieldCheck size={18} />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {n(summary.eligibleForDispatch)} <span className="text-xs font-normal text-slate-500">M</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>QC Passed & Customer Stock</span>
            <span className="font-medium text-emerald-600">Ready</span>
          </div>
        </div>

        {/* Card 2: Already Dispatched Quantity */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between text-blue-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Already Dispatched</span>
            <Truck size={18} />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700">
            {n(summary.alreadyDispatched)} <span className="text-xs font-normal text-slate-500">M</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{challans.length} Delivery Challans</span>
            <span className="font-medium text-blue-600">{dispatchPct}% fulfilled</span>
          </div>
        </div>

        {/* Card 3: Remaining Pending Dispatch */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Pending Dispatch</span>
            <Clock size={18} />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700">
            {n(summary.pendingDispatch)} <span className="text-xs font-normal text-slate-500">M</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Target Req: {n(targetReq)} M</span>
            <span className="font-medium text-amber-600">
              {summary.pendingDispatch === 0 ? 'Full' : 'Incomplete'}
            </span>
          </div>
        </div>

        {/* Card 4: QC Hold / Rejected Quantity */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-rose-300 transition-colors">
          <div className="flex items-center justify-between text-rose-600 mb-1.5">
            <span className="text-xs font-semibold text-slate-600">QC Hold / Rejected</span>
            <AlertTriangle size={18} />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700">
            {n(summary.qcHoldRejectedQty)} <span className="text-xs font-normal text-slate-500">M</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Stage 15 Hold/Reject</span>
            <span className="font-medium text-rose-600">Blocked</span>
          </div>
        </div>
      </div>

      {/* 3. TABS NAVIGATION & WORKSPACE CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Horizontal Tabs Header */}
        <div className="border-b border-slate-200 bg-slate-50/60 px-4 sm:px-6 pt-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('eligibleStock')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-t-2 ${
                activeTab === 'eligibleStock'
                  ? 'bg-white border-orange-600 text-orange-700 shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Package size={15} />
              <span>Section A — Dispatch-Eligible Stock</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                {eligibleTakas.length} Rolls
              </span>
            </button>

            <button
              onClick={() => setActiveTab('challans')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-t-2 ${
                activeTab === 'challans'
                  ? 'bg-white border-orange-600 text-orange-700 shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Truck size={15} />
              <span>Section B & C — Delivery Challans & History</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800">
                {challans.length} Challans
              </span>
            </button>

            <button
              onClick={() => setActiveTab('handover')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-t-2 ${
                activeTab === 'handover'
                  ? 'bg-white border-orange-600 text-orange-700 shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ArrowRight size={15} />
              <span>Section D — Stage 17 Handover</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 pb-2">
            Target Project: <span className="font-semibold text-slate-800">{code}</span>
          </div>
        </div>

        {/* Tab 1: Section A — Dispatch-Eligible Stock */}
        {activeTab === 'eligibleStock' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filter & Action Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search lot, roll ID, shade, fabric..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Filter size={13} className="text-slate-400" />
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                  >
                    <option value="ALL">All Godowns</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleOpenBulkDispatch}
                  disabled={selectedCount === 0}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Truck size={14} />
                  <span>
                    Dispatch Selected ({selectedCount} Rolls • {n(selectedTotalMeters)} M)
                  </span>
                </Button>
              </div>
            </div>

            {/* Table of Dispatch-Eligible Stock */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-xs text-left border-collapse min-w-[950px]">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={(e) => handleSelectAllFiltered(e.target.checked)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">Roll / Taka ID</th>
                    <th className="py-2.5 px-3">Lot Number</th>
                    <th className="py-2.5 px-3">Fabric Item / Quality</th>
                    <th className="py-2.5 px-3">Design / Shade</th>
                    <th className="py-2.5 px-3">Godown Location</th>
                    <th className="py-2.5 px-3">QC Status</th>
                    <th className="py-2.5 px-3 text-right">Available (M)</th>
                    <th className="py-2.5 px-3 text-right w-32">Dispatch Qty (M)</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTakas.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        <Box size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="font-medium text-slate-600">No QC-passed stock available for dispatch.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Complete Stage 15 Quality Check and allocate fabric to Customer Project.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTakas.map((taka) => {
                      const isSelected = !!selectedTakas[taka.id];
                      const dispatchQty = selectedTakas[taka.id] !== undefined ? selectedTakas[taka.id] : taka.availableQuantity;

                      return (
                        <tr
                          key={taka.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-orange-50/40' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelectTaka(taka, e.target.checked)}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-semibold text-slate-900">
                              {taka.takaId || `TAK-${taka.takaNumber}`}
                            </div>
                            <div className="text-[11px] text-slate-400">Roll #{taka.takaNumber}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-800">
                            {taka.lotNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">{taka.fabricItem}</div>
                            <div className="text-[11px] text-slate-400">{taka.fabricQuality}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                              {taka.shade}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="text-slate-400" />
                              <span>{taka.locationName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                              <ShieldCheck size={11} />
                              <span>{taka.qcStatus}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                            {n(taka.availableQuantity)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              max={taka.availableQuantity}
                              value={dispatchQty}
                              onChange={(e) => handleQtyChange(taka.id, e.target.value, taka.availableQuantity)}
                              disabled={!isSelected}
                              className={`w-28 px-2 py-1 text-right text-xs rounded border font-mono ${
                                isSelected
                                  ? 'border-orange-300 bg-white text-slate-900 focus:ring-2 focus:ring-orange-500'
                                  : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleDispatchSingle(taka)}
                              className="text-xs text-orange-700 border-orange-200 hover:bg-orange-50 flex items-center gap-1 mx-auto"
                            >
                              <Truck size={12} />
                              <span>Dispatch</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Selection Banner */}
            {selectedCount > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-orange-100 text-orange-700 rounded-lg">
                    <Package size={18} />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-orange-950">
                      {selectedCount} Roll(s) selected for customer shipment
                    </div>
                    <div className="text-[11px] text-orange-800">
                      Total Dispatched Quantity:{' '}
                      <span className="font-mono font-bold text-orange-900">
                        {n(selectedTotalMeters)} Meters
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTakas({})}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    Clear Selection
                  </Button>
                  <Button
                    onClick={handleOpenBulkDispatch}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Truck size={14} />
                    <span>Proceed to Delivery Challan</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Section B & C — Delivery Challans & History */}
        {activeTab === 'challans' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                Active customer Delivery Challans and transport manifests posted for {code}:
              </span>
              <span className="text-slate-500 font-mono font-semibold">
                {challans.length} Challan Records
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-xs text-left border-collapse min-w-[950px]">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Delivery Challan</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer Consignee</th>
                    <th className="py-2.5 px-3">Transporter</th>
                    <th className="py-2.5 px-3">Vehicle No</th>
                    <th className="py-2.5 px-3">LR / Bilty No</th>
                    <th className="py-2.5 px-3 text-center">Rolls</th>
                    <th className="py-2.5 px-3 text-right">Dispatched (M)</th>
                    <th className="py-2.5 px-3 text-right">Freight (₹)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {challans.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400">
                        <Truck size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="font-medium text-slate-600">No delivery challans created yet.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Select eligible rolls from Section A to generate your first customer delivery challan.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    challans.map((ch) => (
                      <tr key={ch.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-bold text-slate-900">{ch.challanNumber}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {ch.id?.slice(0, 8)}...</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{ch.dispatchDate || ch.docDate}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900">{ch.customerName}</div>
                          {ch.deliveryLocation && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {ch.deliveryLocation}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {ch.transporter || <span className="text-slate-400 italic">Self / Local</span>}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {ch.vehicleNumber || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {ch.lrNumber ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {ch.lrNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Pending LR</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-800">
                          {ch.rollsCount || ch.lines?.length || 1}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {n(ch.totalQty)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          ₹{n(ch.allocatedFreightCost)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              STATUS_PILL[ch.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {ch.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenPrintChallan(ch)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                              title="Print Delivery Challan"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenEditLR(ch)}
                              className="p-1 hover:bg-slate-100 rounded text-blue-600 transition-colors cursor-pointer"
                              title="Update Logistics / LR"
                            >
                              <Edit2 size={13} />
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

        {/* Tab 3: Section D — Stage 17 Handover */}
        {activeTab === 'handover' && (
          <div className="p-5 sm:p-6 space-y-6">
            <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-6 rounded-2xl border border-orange-200 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-orange-600 text-white rounded-xl shadow-xs">
                      <Truck size={20} />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Stage 17 Handover — Commercial Invoicing & Payment Collection
                      </h3>
                      <p className="text-xs text-slate-600">
                        Delivery challans generated in Stage 16 serve as the authoritative delivery proof for GST Sales Invoices in Stage 17.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                    <div className="bg-white/80 p-3 rounded-xl border border-orange-200/60">
                      <div className="text-[11px] font-semibold text-slate-500">Customer</div>
                      <div className="text-sm font-bold text-slate-900">{customer.name}</div>
                    </div>
                    <div className="bg-white/80 p-3 rounded-xl border border-orange-200/60">
                      <div className="text-[11px] font-semibold text-slate-500">Sales Order</div>
                      <div className="text-sm font-bold font-mono text-slate-900">{salesOrder.orderNumber}</div>
                    </div>
                    <div className="bg-white/80 p-3 rounded-xl border border-orange-200/60">
                      <div className="text-[11px] font-semibold text-slate-500">Total Dispatched</div>
                      <div className="text-sm font-bold font-mono text-orange-700">
                        {n(summary.alreadyDispatched)} / {n(targetReq)} M
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => onSelectStage?.(17)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap self-stretch sm:self-center"
                >
                  <span>Proceed to Stage 17: Invoicing</span>
                  <ArrowRight size={15} />
                </Button>
              </div>
            </div>

            {/* Reconciliation breakdown cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Stock Ledgers & Allocations Harmonized</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Every meter dispatched is automatically recorded in the physical inventory ledger under movement type <code className="font-mono bg-white px-1 border rounded text-slate-800">SALE</code>, ensuring zero inventory discrepancies between warehouse stock and billing.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText size={14} className="text-blue-600" />
                  <span>GST Rule 55 Compliant Delivery Challans</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Delivery Challans carry unique serial numbers, consignee addresses, transporter names, vehicle numbers, and roll-level breakdown ready for e-Way bill and invoice matching.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. MODAL: CREATE DELIVERY CHALLAN */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="Create Customer Delivery Challan"
        size="2xl"
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Customer:</span>
              <span className="font-bold text-slate-800">{customer.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Sales Order:</span>
              <span className="font-mono font-bold text-slate-800">{salesOrder.orderNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Selected Rolls:</span>
              <span className="font-bold text-slate-800">{selectedCount} Roll(s)</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Dispatch Total:</span>
              <span className="font-mono font-bold text-orange-700">{n(selectedTotalMeters)} M</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">
                Dispatch Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">
                Dispatch From Godown <span className="text-rose-500">*</span>
              </label>
              <select
                value={dispatchGodownId}
                onChange={(e) => setDispatchGodownId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">
                Delivery / Consignee Address <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Shipping address of the customer destination..."
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Transporter / Logistics</label>
              <input
                type="text"
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                placeholder="e.g. VRL Logistics, SafeXpress..."
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Vehicle Number</label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="e.g. GJ-01-AB-1234"
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">LR / Bilty / GR Number</label>
              <input
                type="text"
                value={lrNumber}
                onChange={(e) => setLrNumber(e.target.value)}
                placeholder="e.g. LR-2026-0042"
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Freight / Transport Charges (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={freightCharges}
                onChange={(e) => setFreightCharges(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Remarks & Gate Pass Notes</label>
              <textarea
                rows={2}
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                placeholder="Optional notes or instructions for delivery..."
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Selected Rolls Summary List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-700 border-b border-slate-200">
              Selected Rolls Breakdown ({selectedCount} items)
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
              {selectedTakaEntries.map(({ taka, qty }) => (
                <div key={taka.id} className="p-2.5 flex items-center justify-between text-slate-700">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{taka.takaId}</span>
                    <span className="text-slate-400 text-[11px] ml-2">Lot: {taka.lotNumber}</span>
                    <span className="text-slate-500 text-[11px] ml-2">({taka.fabricItem})</span>
                  </div>
                  <div className="font-mono font-bold text-orange-700">{n(qty)} M</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDispatchModalOpen(false)}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDispatch}
              disabled={submitting || selectedCount === 0}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Truck size={14} className={submitting ? 'animate-spin' : ''} />
              <span>{submitting ? 'Generating Challan...' : 'Confirm & Post Dispatch'}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. MODAL: UPDATE LR & LOGISTICS DETAILS */}
      <Modal
        isOpen={isLRModalOpen}
        onClose={() => setIsLRModalOpen(false)}
        title="Update Logistics & Transport Details"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-500">
            Update transporter, vehicle, or LR/Bilty details without affecting inventory or creating duplicate dispatches.
          </p>

          <div>
            <label className="block text-slate-600 font-medium mb-1">LR / Bilty Number</label>
            <input
              type="text"
              value={lrEditNumber}
              onChange={(e) => setLrEditNumber(e.target.value)}
              placeholder="e.g. LR-2026-9999"
              className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Transporter Name</label>
            <input
              type="text"
              value={lrEditTransporter}
              onChange={(e) => setLrEditTransporter(e.target.value)}
              placeholder="e.g. VRL Logistics"
              className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Vehicle Number</label>
            <input
              type="text"
              value={lrEditVehicle}
              onChange={(e) => setLrEditVehicle(e.target.value)}
              placeholder="e.g. GJ-01-AB-1234"
              className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Freight Charges (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={lrEditFreight}
              onChange={(e) => setLrEditFreight(e.target.value)}
              placeholder="0.00"
              className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Logistics Notes</label>
            <textarea
              rows={2}
              value={lrEditNotes}
              onChange={(e) => setLrEditNotes(e.target.value)}
              placeholder="Driver phone number, delivery milestones..."
              className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLRModalOpen(false)}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLR}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check size={14} className={submitting ? 'animate-spin' : ''} />
              <span>{submitting ? 'Saving...' : 'Save Logistics Details'}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* 6. MODAL: FORMAL PRINTABLE DELIVERY CHALLAN */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={`Delivery Challan: ${selectedChallan?.challanNumber || ''}`}
        size="2xl"
      >
        {selectedChallan && (
          <div className="space-y-4 text-xs">
            {/* Printable Document Sheet */}
            <div className="border border-slate-300 p-6 rounded-xl bg-white space-y-5 print:border-none print:p-0">
              {/* Document Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">OSCAR TEXTILE ERP</h2>
                  <div className="text-[11px] text-slate-500">Fabric Processing & Manufacturing Division</div>
                  <div className="text-[11px] text-slate-500">GSTIN: 24AAFCO9999P1Z8 • State: Gujarat (24)</div>
                </div>
                <div className="text-right">
                  <div className="px-2.5 py-1 rounded bg-slate-900 text-white font-bold text-xs inline-block">
                    DELIVERY CHALLAN
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">
                    Rule 55 Goods Dispatch
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    {selectedChallan.challanNumber}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Date: <span className="font-semibold">{selectedChallan.dispatchDate || selectedChallan.docDate}</span>
                  </div>
                </div>
              </div>

              {/* Consignee & Order Information */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Consignee / Customer:</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedChallan.customerName}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-line">
                    {selectedChallan.deliveryLocation || customer.shippingAddress || 'Customer Warehouse'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Dispatch Details:</div>
                  <div className="mt-0.5 space-y-0.5 text-[11px] text-slate-700">
                    <div>
                      Project Ref: <span className="font-semibold text-slate-900">{code}</span>
                    </div>
                    <div>
                      Sales Order: <span className="font-mono font-semibold text-slate-900">{salesOrder.orderNumber}</span>
                    </div>
                    <div>
                      Transporter:{' '}
                      <span className="font-semibold text-slate-900">
                        {selectedChallan.transporter || 'Direct Dispatch'}
                      </span>
                    </div>
                    <div>
                      Vehicle No:{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {selectedChallan.vehicleNumber || '—'}
                      </span>
                    </div>
                    <div>
                      LR / Bilty No:{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {selectedChallan.lrNumber || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispatched Lines Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-10 text-center">#</th>
                      <th className="p-2">Item Description</th>
                      <th className="p-2">Roll / Taka Breakdown</th>
                      <th className="p-2 text-center">Rolls</th>
                      <th className="p-2 text-right">Qty (Meters)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {selectedChallan.lines?.map((line, idx) => (
                      <tr key={line.id || idx}>
                        <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-2">
                          <div className="font-semibold text-slate-900">{line.itemName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{line.sku}</div>
                        </td>
                        <td className="p-2 text-[11px] text-slate-600">
                          {line.takaAllocations && line.takaAllocations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {line.takaAllocations.map((ta, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono"
                                >
                                  {ta.takaNumber ? `#${ta.takaNumber}` : ta.lotTakaId?.slice(0, 6)}: {n(ta.qty)}M
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Rolls bundled</span>
                          )}
                        </td>
                        <td className="p-2 text-center font-mono">{line.takaAllocations?.length || 1}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">{n(line.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                    <tr>
                      <td colSpan={3} className="p-2 text-right">
                        Total Dispatched:
                      </td>
                      <td className="p-2 text-center font-mono">{selectedChallan.rollsCount}</td>
                      <td className="p-2 text-right font-mono text-orange-700">{n(selectedChallan.totalQty)} M</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Declarations & Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
                <div className="space-y-1 text-slate-500 text-[11px]">
                  <p className="font-semibold text-slate-700">Terms & Conditions:</p>
                  <p>1. Received goods in good condition and correct count.</p>
                  <p>2. Goods once delivered are not subject to return without prior written approval.</p>
                </div>

                <div className="flex justify-between items-end text-center pt-8">
                  <div>
                    <div className="w-28 border-b border-slate-300 pb-1 text-[11px] text-slate-600">Receiver's Sign</div>
                  </div>
                  <div>
                    <div className="w-32 border-b border-slate-300 pb-1 text-[11px] text-slate-600 font-semibold">
                      Authorised Signatory
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPrintModalOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Delivery Challan</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
