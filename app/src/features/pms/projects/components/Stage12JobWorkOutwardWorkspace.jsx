import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  Send,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Truck,
  Calendar,
  User,
  RefreshCw,
  Plus,
  Eye,
  ShieldCheck,
  ExternalLink,
  Info,
  X,
  Layers,
  ArrowRight,
  Check,
} from 'lucide-react';
import { api } from '../../../../services/api';
import {
  fetchPlans,
  fetchJWOs,
  createJWORow,
  updateJWORow,
  confirmJWOOutward,
  validateJWOOutwardStock,
  errorMessage,
} from '../../../../services/jobWorkSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';

export function Stage12JobWorkOutwardWorkspace({
  project,
  stage,
  onUpdated,
  onSelectStage,
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

  const projectId = project?.id;

  // Data states
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedJwoId, setSelectedJwoId] = useState('');
  const [availableTakas, setAvailableTakas] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Outward Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutward, setEditingOutward] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  // Form fields
  const [challanNo, setChallanNo] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [transporter, setTransporter] = useState('Standard Transport Logistics');
  const [vehicleNo, setVehicleNo] = useState('GJ-05-BX-4921');
  const [driver, setDriver] = useState('');
  const [lrNo, setLrNo] = useState(`LR-${Date.now().toString().slice(-5)}`);
  const [authorizedById, setAuthorizedById] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedTakaMap, setSelectedTakaMap] = useState({}); // { [takaId]: { selected: bool, meters: number } }
  const [takaSearch, setTakaSearch] = useState('');

  // Challan Print / Preview Modal
  const [printChallanData, setPrintChallanData] = useState(null);

  // Load all necessary records
  const loadWorkspaceData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansRes, jwoRes, takasRes, empRes] = await Promise.allSettled([
        fetchPlans().catch(() => []),
        fetchJWOs().catch(() => []),
        api.get('/inventory/lot-takas/', { query: { page_size: 150 } }).catch(() => ({ results: [] })),
        api.get('/hrms/employees/', { query: { page_size: 100 } }).catch(() => ({ results: [] })),
      ]);

      if (plansRes.status === 'fulfilled' && plansRes.value) {
        setPlans(Array.isArray(plansRes.value) ? plansRes.value : []);
      }
      if (jwoRes.status === 'fulfilled' && jwoRes.value) {
        setOrders(Array.isArray(jwoRes.value) ? jwoRes.value : []);
      }
      if (takasRes.status === 'fulfilled' && takasRes.value) {
        const list = Array.isArray(takasRes.value)
          ? takasRes.value
          : takasRes.value?.results || takasRes.value?.data || [];
        setAvailableTakas(list);
      }
      if (empRes.status === 'fulfilled' && empRes.value) {
        const list = Array.isArray(empRes.value)
          ? empRes.value
          : empRes.value?.results || empRes.value?.data || [];
        setEmployees(list);
      }
    } catch (err) {
      console.warn('Failed to load Stage 12 data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Project linked plans
  const projectPlans = useMemo(() => {
    return plans.filter(
      (p) => p.projectId === projectId || (p.remarks || '').includes(project?.code || '')
    );
  }, [plans, projectId, project?.code]);

  const activePlan = projectPlans[0] || null;

  // Project linked JWOs
  const projectOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.projectId === projectId ||
        (o.projectCode && o.projectCode === project?.code) ||
        (o.remarks || '').includes(project?.code || '') ||
        (activePlan && o.processPlanId === activePlan.id)
    );
  }, [orders, projectId, project?.code, activePlan]);

  const activeJwo = useMemo(() => {
    if (selectedJwoId) {
      return projectOrders.find((o) => o.id === selectedJwoId) || projectOrders[0];
    }
    return projectOrders[0] || null;
  }, [projectOrders, selectedJwoId]);

  // Quantitative tracking
  const plannedQty = Number(activeJwo?.plannedQty || activePlan?.plannedQty || activePlan?.expectedQty || 0);

  const outwardsList = useMemo(() => {
    return activeJwo?.outwards || [];
  }, [activeJwo]);

  const totalDispatched = useMemo(() => {
    return outwardsList
      .filter((o) => o.status === 'Sent' || o.status === 'Confirmed')
      .reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
  }, [outwardsList]);

  const totalInwardReceived = useMemo(() => {
    return (activeJwo?.inwards || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  }, [activeJwo]);

  const totalLoss = useMemo(() => {
    return (activeJwo?.lossEntries || []).reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  }, [activeJwo]);

  const remainingToDispatch = Math.max(0, plannedQty - totalDispatched);
  const outstandingAtProcessor = Math.max(0, totalDispatched - totalInwardReceived - totalLoss);

  // Eligible takas for selection
  const eligibleTakas = useMemo(() => {
    const list = [];
    // 1. First add takas chosen during Stage 11 Process Plan if present
    const planTakas = Array.isArray(activePlan?.selectedTakas) ? activePlan.selectedTakas : [];
    const planTakaIds = new Set(planTakas.map((t) => t.id || t.takaId));

    // Combine with inventory takas matching item/lot
    availableTakas.forEach((t) => {
      const isAllocatedInPlan = planTakaIds.has(t.id);
      const isMatchingLot =
        activePlan?.greyLotNo &&
        (t.lot_number || '').toLowerCase().includes(activePlan.greyLotNo.toLowerCase());
      const isMatchingItem =
        activePlan?.fabricItem &&
        (t.item?.name || t.item_name || '').toLowerCase().includes(activePlan.fabricItem.toLowerCase());

      const isUsable = t.status === 'Available' || t.status === 'Active';

      if (isAllocatedInPlan || ((isMatchingLot || isMatchingItem) && isUsable)) {
        list.push({
          id: t.id,
          takaNumber: t.taka_number || t.taka_id || 'T-1',
          lotNumber: t.lot_number || activePlan?.greyLotNo || 'LOT-2026',
          fabricItem: t.item?.name || t.item_name || activePlan?.fabricItem || 'Fabric',
          fabricQuality: t.fabric_quality || activePlan?.fabricQuality || 'Grey',
          warehouse: t.location?.name || t.location_name || 'Main Godown',
          totalLength: Number(t.received_quantity || t.initial_quantity || t.available_quantity || 0),
          availableQty: Number(t.available_quantity ?? t.quantity ?? 0),
          sourcePoNumber: t.source_document_number || 'GRN-PO',
          attribution: activeJwo?.projectDestination || activePlan?.projectDestination || 'Customer Project',
          status: t.status,
        });
      }
    });

    // If availableTakas don't have them but plan had them specified, add them as virtual eligible lines
    if (list.length === 0 && planTakas.length > 0) {
      planTakas.forEach((pt, idx) => {
        list.push({
          id: pt.id || `plan-taka-${idx}`,
          takaNumber: pt.takaNumber || pt.takaId || `${idx + 1}`,
          lotNumber: pt.lotNumber || activePlan?.greyLotNo || 'LOT-PLAN',
          fabricItem: pt.fabricItem || activePlan?.fabricItem || 'Fabric Item',
          fabricQuality: pt.fabricQuality || activePlan?.fabricQuality || 'Grey Quality',
          warehouse: 'Main Godown',
          totalLength: Number(pt.meters || pt.quantity || 0),
          availableQty: Number(pt.meters || pt.quantity || 0),
          sourcePoNumber: pt.sourcePoNumber || 'GRN-2026',
          attribution: pt.allocationType || 'Customer Project',
          status: 'Available',
        });
      });
    }

    return list;
  }, [availableTakas, activePlan, activeJwo]);

  // Filtered takas for search
  const filteredTakas = useMemo(() => {
    if (!takaSearch.trim()) return eligibleTakas;
    const q = takaSearch.toLowerCase();
    return eligibleTakas.filter(
      (t) =>
        (t.takaNumber || '').toLowerCase().includes(q) ||
        (t.lotNumber || '').toLowerCase().includes(q) ||
        (t.fabricItem || '').toLowerCase().includes(q) ||
        (t.warehouse || '').toLowerCase().includes(q)
    );
  }, [eligibleTakas, takaSearch]);

  // Selected totals in form
  const selectedTakaCount = useMemo(() => {
    return Object.values(selectedTakaMap).filter((item) => item?.selected).length;
  }, [selectedTakaMap]);

  const selectedTotalMeters = useMemo(() => {
    return Object.values(selectedTakaMap).reduce((sum, item) => {
      if (!item?.selected) return sum;
      return sum + (Number(item.meters) || 0);
    }, 0);
  }, [selectedTakaMap]);

  // 1-Click Generate JWO from Plan
  const handleGenerateJwoFromPlan = async () => {
    if (!activePlan) {
      toast.error('No approved Stage 11 Process Plan found for this project.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/jobwork/plans/${activePlan.id}/create-jwo/`);
      toast.success(`Job Work Order ${res.jwoNo || 'generated'} created successfully!`);
      await loadWorkspaceData();
      if (onUpdated) await onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create Job Work Order from plan.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Open Outward Modal
  const handleOpenModal = (outwardToEdit = null) => {
    setEditingOutward(outwardToEdit);
    setValidationResult(null);

    if (outwardToEdit) {
      setChallanNo(outwardToEdit.challanNo || outwardToEdit.no || '');
      setDispatchDate(outwardToEdit.date || new Date().toISOString().split('T')[0]);
      setExpectedReturnDate(outwardToEdit.expectedReturnDate || '');
      setTransporter(outwardToEdit.transporter || 'Standard Transport Logistics');
      setVehicleNo(outwardToEdit.vehicleNo || 'GJ-05-BX-4921');
      setDriver(outwardToEdit.driver || '');
      setLrNo(outwardToEdit.lrNo || '');
      setAuthorizedById(outwardToEdit.authorizedById || '');
      setRemarks(outwardToEdit.remarks || '');

      // Load takas
      const initialMap = {};
      (outwardToEdit.takas || []).forEach((t) => {
        initialMap[t.lotTakaId || t.id] = {
          selected: true,
          meters: Number(t.meters || 0),
        };
      });
      setSelectedTakaMap(initialMap);
    } else {
      setChallanNo(`JWOUT-${Date.now().toString().slice(-4)}`);
      setDispatchDate(new Date().toISOString().split('T')[0]);
      // Default expected return: +7 days
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setExpectedReturnDate(d.toISOString().split('T')[0]);
      setTransporter('Standard Transport Logistics');
      setVehicleNo('GJ-05-BX-4921');
      setDriver('');
      setLrNo(`LR-${Date.now().toString().slice(-5)}`);
      setAuthorizedById(employees[0]?.id || '');
      setRemarks(`Outward dispatch for Project ${project?.code || ''}`);

      // Auto-select eligible takas up to remaining planned
      const autoMap = {};
      let runningSum = 0;
      eligibleTakas.forEach((t) => {
        if (runningSum < remainingToDispatch) {
          const toTake = Math.min(t.availableQty, remainingToDispatch - runningSum);
          autoMap[t.id] = {
            selected: true,
            meters: toTake > 0 ? toTake : t.availableQty,
          };
          runningSum += toTake;
        }
      });
      setSelectedTakaMap(autoMap);
    }
    setIsModalOpen(true);
  };

  // Toggle single taka selection
  const handleToggleTaka = (taka) => {
    setSelectedTakaMap((prev) => {
      const current = prev[taka.id];
      const isNowSelected = !current?.selected;
      return {
        ...prev,
        [taka.id]: {
          selected: isNowSelected,
          meters: isNowSelected ? (current?.meters || taka.availableQty) : 0,
        },
      };
    });
  };

  // Toggle all takas
  const handleToggleAllTakas = () => {
    const allSelected = eligibleTakas.length > 0 && eligibleTakas.every((t) => selectedTakaMap[t.id]?.selected);
    const newMap = {};
    if (!allSelected) {
      eligibleTakas.forEach((t) => {
        newMap[t.id] = { selected: true, meters: t.availableQty };
      });
    }
    setSelectedTakaMap(newMap);
  };

  // Update metres for individual roll
  const handleUpdateTakaMeters = (takaId, val) => {
    const m = Math.max(0, Number(val) || 0);
    setSelectedTakaMap((prev) => ({
      ...prev,
      [takaId]: {
        selected: prev[takaId]?.selected ?? true,
        meters: m,
      },
    }));
  };

  // Pre-flight Stock Validation
  const handleValidateStock = async () => {
    if (!activeJwo) {
      toast.error('No active Job Work Order found.');
      return;
    }
    if (selectedTakaCount === 0) {
      toast.error('Please select at least one roll/taka from the table.');
      return;
    }

    setValidating(true);
    try {
      const takasPayload = Object.entries(selectedTakaMap)
        .filter(([, v]) => v?.selected)
        .map(([id, v]) => ({
          lotTakaId: id,
          meters: v.meters,
        }));

      const res = await validateJWOOutwardStock(activeJwo.id, {
        qty: selectedTotalMeters,
        takas: takasPayload,
      });

      setValidationResult(res);
      toast.success(
        `Stock check passed! ${res.validatedTakasCount} rolls verified (${res.totalQty} M).`
      );
    } catch (err) {
      setValidationResult({ error: errorMessage(err, 'Stock validation failed.') });
      toast.error(errorMessage(err, 'Stock validation issue detected.'));
    } finally {
      setValidating(false);
    }
  };

  // Save Outward (Draft or Confirm)
  const handleSaveOutward = async (asStatus = 'Sent') => {
    if (!activeJwo) {
      toast.error('Please generate a Job Work Order in Stage 11 first.');
      return;
    }

    if (selectedTotalMeters <= 0) {
      toast.error('Total outward quantity must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const takasPayload = Object.entries(selectedTakaMap)
        .filter(([, v]) => v?.selected)
        .map(([id, v]) => ({
          lotTakaId: id,
          meters: v.meters,
        }));

      const payload = {
        date: dispatchDate,
        qty: selectedTotalMeters,
        challanNo: challanNo,
        lrNo: lrNo,
        transporter: transporter,
        vehicleNo: vehicleNo,
        driver: driver,
        expectedReturnDate: expectedReturnDate || undefined,
        authorizedById: authorizedById || undefined,
        remarks: remarks,
        status: asStatus,
        ...(takasPayload.length > 0 ? { takas: takasPayload } : {}),
      };

      if (editingOutward?.id) {
        await updateJWORow(activeJwo.id, 'outwards', editingOutward.id, payload);
        toast.success(
          asStatus === 'Draft'
            ? `Outward Challan ${challanNo} updated as Draft.`
            : `Outward Challan ${challanNo} confirmed! Fabric rolls moved to External WIP.`
        );
      } else {
        await createJWORow(activeJwo.id, 'outwards', payload);
        toast.success(
          asStatus === 'Draft'
            ? `Outward Challan ${challanNo} saved as Draft (no stock deducted).`
            : `Outward Challan ${challanNo} confirmed! ${selectedTotalMeters} M moved to External WIP.`
        );
      }

      setIsModalOpen(false);
      await loadWorkspaceData();
      if (onUpdated) await onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save outward transaction.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Direct confirmation of a draft outward
  const handleConfirmExistingDraft = async (outward) => {
    if (!activeJwo) return;
    setSubmitting(true);
    try {
      await confirmJWOOutward(activeJwo.id, outward.id);
      toast.success(`Challan ${outward.no || outward.challanNo} confirmed! Stock moved to External WIP.`);
      await loadWorkspaceData();
      if (onUpdated) await onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to confirm outward.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: PROCESSING PLAN / JWO REFERENCE & HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                Stage 12
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Job Work Outward (Send to Vendor)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select verified grey rolls from godown stock, validate inventory, and dispatch outward delivery challan to external processor WIP.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadWorkspaceData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs cursor-pointer transition-colors"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {activeJwo && (
              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs cursor-pointer transition-colors"
              >
                <Plus size={14} />
                <span>New Outward Challan</span>
              </button>
            )}
          </div>
        </div>

        {/* JWO / Plan Reference Card */}
        {activeJwo ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Linked JWO & Plan
              </span>
              <div className="font-mono font-bold text-blue-700 text-sm mt-0.5 flex items-center gap-1.5">
                <span>{activeJwo.jwoNo}</span>
                {activePlan && (
                  <span className="text-slate-400 font-sans font-normal text-xs">
                    (Plan: {activePlan.planNo})
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Project Code: <strong className="font-mono text-slate-700">{project?.code}</strong>
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Processor / Vendor
              </span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {activeJwo.vendor || activePlan?.vendor || '—'}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Process: <strong>{activeJwo.process || activePlan?.process || 'Dyeing'}</strong>
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Fabric Quality & Target Shade
              </span>
              <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                {activePlan?.fabricQuality || activePlan?.fabricItem || 'Fabric Quality'}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Target Shade: <strong>{activePlan?.shade || 'Standard'}</strong>
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Order Status & Rate
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeJwo.status === 'In-Process'
                    ? 'bg-blue-100 text-blue-700'
                    : activeJwo.status === 'Completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {activeJwo.status || 'Draft'}
                </span>
                <span className="font-mono font-bold text-slate-700 text-xs">
                  ₹{Number(activeJwo.rate || 0).toFixed(2)}/M
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Destination: {activeJwo.projectDestination || 'Customer Project'}
              </span>
            </div>
          </div>
        ) : activePlan ? (
          /* JWO Missing but Plan Exists: 1-Click Generator */
          <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-blue-600" />
                <h4 className="font-bold text-blue-900 text-xs">
                  Stage 11 Processing Plan Approved ({activePlan.planNo})
                </h4>
              </div>
              <p className="text-xs text-blue-700">
                Processing plan is approved for <strong>{Number(activePlan.plannedQty || activePlan.expectedQty || 0).toLocaleString('en-IN')} M</strong> ({activePlan.process || 'Dyeing'} by {activePlan.vendor}). Click below to generate the linked Job Work Order and proceed with outward dispatch.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateJwoFromPlan}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
            >
              <Send size={13} className={submitting ? 'animate-pulse' : ''} />
              <span>1-Click Generate JWO from Plan</span>
            </button>
          </div>
        ) : (
          /* Neither JWO nor Plan exists */
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center space-y-3">
            <AlertTriangle size={24} className="text-amber-500 mx-auto" />
            <p className="text-slate-600 text-xs max-w-md mx-auto">
              No Processing Plan has been established for project <strong>{project?.code}</strong>. Please complete <strong>Stage 11: Processing Plan & Vendor Assignment</strong> first.
            </p>
            <button
              type="button"
              onClick={() => onSelectStage && onSelectStage(11)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs cursor-pointer"
            >
              <span>Go to Stage 11 (Processing Plan)</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* Live KPI Metric Cards */}
        {activeJwo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-400 font-semibold block uppercase">
                Planned Quantity
              </span>
              <span className="font-mono font-bold text-slate-900 text-base">
                {plannedQty.toLocaleString('en-IN')} M
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Approved in Plan</span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200">
              <span className="text-[11px] text-blue-600 font-semibold block uppercase">
                Dispatched to Mill
              </span>
              <span className="font-mono font-bold text-blue-800 text-base">
                {totalDispatched.toLocaleString('en-IN')} M
              </span>
              <span className="text-[10px] text-blue-500 block mt-0.5">
                {plannedQty > 0 ? ((totalDispatched / plannedQty) * 100).toFixed(1) : 0}% of Planned
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200">
              <span className="text-[11px] text-amber-600 font-semibold block uppercase">
                Remaining to Dispatch
              </span>
              <span className="font-mono font-bold text-amber-800 text-base">
                {remainingToDispatch.toLocaleString('en-IN')} M
              </span>
              <span className="text-[10px] text-amber-500 block mt-0.5">Pending in Godown</span>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200">
              <span className="text-[11px] text-purple-600 font-semibold block uppercase">
                Live External WIP
              </span>
              <span className="font-mono font-bold text-purple-800 text-base">
                {outstandingAtProcessor.toLocaleString('en-IN')} M
              </span>
              <span className="text-[10px] text-purple-500 block mt-0.5">At Processor Facility</span>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4A: RECENT OUTWARD CHALLAN REGISTER
      ───────────────────────────────────────────────────────────── */}
      {activeJwo && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Dispatched Outward Challans & Gate Passes
              </h3>
              <p className="text-xs text-slate-500">
                Records of fabric rolls dispatched to {activeJwo.vendor || 'processor'}.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-400">
              {outwardsList.length} {outwardsList.length === 1 ? 'Challan' : 'Challans'}
            </span>
          </div>

          {outwardsList.length > 0 ? (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Challan / DC No</th>
                    <th className="p-3">Dispatch Date</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-center">Rolls (Takas)</th>
                    <th className="p-3">Transporter / Vehicle</th>
                    <th className="p-3">LR / Bilty No</th>
                    <th className="p-3">Expected Return</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {outwardsList.map((out) => (
                    <tr key={out.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-bold text-blue-700">
                        {out.challanNo || out.no || '—'}
                      </td>
                      <td className="p-3 text-slate-600">{out.date || '—'}</td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {Number(out.qty || 0).toLocaleString('en-IN')} M
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {(out.takas || []).length || 1} Rolls
                        </span>
                      </td>
                      <td className="p-3 font-sans text-slate-600">
                        <span className="block font-medium">{out.transporter || '—'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{out.vehicleNo}</span>
                      </td>
                      <td className="p-3 text-slate-600">{out.lrNo || '—'}</td>
                      <td className="p-3 text-slate-600">
                        {out.expectedReturnDate || '—'}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                            out.status === 'Sent' || out.status === 'Confirmed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {out.status === 'Sent' || out.status === 'Confirmed' ? 'Sent (In WIP)' : 'Draft'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPrintChallanData(out)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                            title="Print GST Delivery Challan"
                          >
                            <Printer size={12} />
                            <span>Print</span>
                          </button>

                          {out.status === 'Draft' && (
                            <button
                              type="button"
                              onClick={() => handleConfirmExistingDraft(out)}
                              disabled={submitting}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                              title="Confirm Outward & Move Stock to External WIP"
                            >
                              <CheckCircle2 size={12} />
                              <span>Confirm</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2 bg-slate-50/40">
              <Package size={28} className="text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                No outward challans recorded yet for this Job Work Order.
              </p>
              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs cursor-pointer mt-1"
              >
                <Plus size={13} />
                <span>Create First Outward Challan</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2 & 3: NEW OUTWARD CHALLAN MODAL (FULL WORKFLOW)
      ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Record Job Work Outward Dispatch — ${activeJwo?.jwoNo || ''}`}
          subtitle="Pick available rolls from godown inventory, configure outward dispatch logistics, and confirm stock movement."
          size="2xl"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              <button
                type="button"
                onClick={handleValidateStock}
                disabled={validating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                <ShieldCheck size={15} className={validating ? 'animate-spin text-blue-600' : 'text-slate-500'} />
                <span>{validating ? 'Validating Stock...' : 'Validate Stock'}</span>
              </button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>

                <button
                  type="button"
                  onClick={() => handleSaveOutward('Draft')}
                  disabled={submitting}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs cursor-pointer transition-colors shadow-2xs"
                >
                  Save Draft (No Stock Move)
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveOutward('Sent')}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                >
                  <Send size={13} className={submitting ? 'animate-pulse' : ''} />
                  <span>{submitting ? 'Confirming...' : 'Confirm Outward Dispatch'}</span>
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Vendor / Processor</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                  {activeJwo?.vendor || 'Vendor B'}
                </span>
                <span className="text-[11px] text-slate-500">Process: {activeJwo?.process || 'Dyeing'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">JWO Planned vs Dispatched</span>
                <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">
                  {plannedQty.toLocaleString('en-IN')} M Planned
                </span>
                <span className="text-[11px] text-amber-600 font-medium">
                  {remainingToDispatch.toLocaleString('en-IN')} M Remaining
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Selected for this Dispatch</span>
                <span className="font-mono font-bold text-blue-700 text-sm mt-0.5 block">
                  {selectedTotalMeters.toLocaleString('en-IN')} M ({selectedTakaCount} Rolls)
                </span>
                <span className="text-[11px] text-slate-500">
                  New Bal: {Math.max(0, remainingToDispatch - selectedTotalMeters).toLocaleString('en-IN')} M
                </span>
              </div>
            </div>

            {/* ── SECTION 2: SOURCE FABRIC SELECTION (TAKA PICKER) ── */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-600" />
                    <span>Source Fabric & Godown Roll (Taka) Selection</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Pick available rolls from godown inventory to move from Main Godown to External Processor WIP.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={takaSearch}
                    onChange={(e) => setTakaSearch(e.target.value)}
                    placeholder="Search lot, roll, godown..."
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleToggleAllTakas}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    Select All
                  </button>
                </div>
              </div>

              {/* Taka Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                <div className="max-h-60 overflow-y-auto overflow-x-auto">
                  <table className="min-w-[760px] w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 text-center w-9">
                          <input
                            type="checkbox"
                            checked={
                              filteredTakas.length > 0 &&
                              filteredTakas.every((t) => selectedTakaMap[t.id]?.selected)
                            }
                            onChange={handleToggleAllTakas}
                            className="rounded text-blue-600 cursor-pointer"
                          />
                        </th>
                        <th className="p-2.5 whitespace-nowrap">Roll / Taka #</th>
                        <th className="p-2.5 whitespace-nowrap">Lot Number</th>
                        <th className="p-2.5 whitespace-nowrap">Warehouse Godown</th>
                        <th className="p-2.5 whitespace-nowrap">Source PO / GRN</th>
                        <th className="p-2.5 text-right whitespace-nowrap">Available (M)</th>
                        <th className="p-2.5 text-right whitespace-nowrap">Dispatch Qty (M)</th>
                        <th className="p-2.5 text-center whitespace-nowrap">Attribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {filteredTakas.length > 0 ? (
                        filteredTakas.map((taka) => {
                          const isSelected = Boolean(selectedTakaMap[taka.id]?.selected);
                          const curMeters = selectedTakaMap[taka.id]?.meters ?? taka.availableQty;

                          return (
                            <tr
                              key={taka.id}
                              className={`transition-colors ${
                                isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/60'
                              }`}
                            >
                              <td className="p-2.5 text-center w-9">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleTaka(taka)}
                                  className="rounded text-blue-600 cursor-pointer"
                                />
                              </td>
                              <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{taka.takaNumber}</td>
                              <td className="p-2.5 text-slate-600 whitespace-nowrap">{taka.lotNumber}</td>
                              <td className="p-2.5 font-sans text-slate-600 whitespace-nowrap">{taka.warehouse}</td>
                              <td className="p-2.5 text-slate-500 whitespace-nowrap">{taka.sourcePoNumber}</td>
                              <td className="p-2.5 text-right font-medium text-slate-700 whitespace-nowrap">
                                {taka.availableQty.toLocaleString('en-IN')} M
                              </td>
                              <td className="p-2.5 text-right whitespace-nowrap">
                                <input
                                  type="number"
                                  min="0"
                                  max={taka.availableQty}
                                  step="any"
                                  value={curMeters}
                                  disabled={!isSelected}
                                  onChange={(e) => handleUpdateTakaMeters(taka.id, e.target.value)}
                                  className="w-24 px-2 py-1 text-right text-xs border border-slate-200 rounded font-mono font-bold focus:outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </td>
                              <td className="p-2.5 text-center font-sans whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {taka.attribution}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="8" className="p-4 text-center text-xs text-slate-400 font-sans">
                            No matching godown rolls found for this fabric/lot.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── SECTION 3: ACTUAL OUTWARD DETAILS ── */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Truck size={14} className="text-blue-600" />
                <span>Logistics & Outward Challan Details</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Outward Challan No *
                  </label>
                  <input
                    type="text"
                    value={challanNo}
                    onChange={(e) => setChallanNo(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Dispatch Date *
                  </label>
                  <input
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Expected Return Date
                  </label>
                  <input
                    type="date"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Transporter
                  </label>
                  <input
                    type="text"
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    placeholder="e.g. V-Trans Logistics"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    placeholder="e.g. GJ-05-BX-4921"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    LR / Bilty Number
                  </label>
                  <input
                    type="text"
                    value={lrNo}
                    onChange={(e) => setLrNo(e.target.value)}
                    placeholder="e.g. LR-99124"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Driver Name & Contact
                  </label>
                  <input
                    type="text"
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                    placeholder="Driver name / phone"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Authorized Sender (Employee)
                  </label>
                  <select
                    value={authorizedById}
                    onChange={(e) => setAuthorizedById(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select dispatch authorizer...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name || emp.first_name} ({emp.employee_code || emp.designation || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Remarks & Gate Pass Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Notes for security gate pass, delivery precautions, or shade instructions..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Validation Banner if checked */}
            {validationResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  validationResult.valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {validationResult.valid ? (
                  <>
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      Stock verified successfully! {validationResult.validatedTakasCount} rolls available in Godown.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} className="text-red-600 shrink-0" />
                    <span>{validationResult.error}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PRINTABLE GST RULE 55 DELIVERY CHALLAN MODAL
      ───────────────────────────────────────────────────────────── */}
      {printChallanData && (
        <Modal
          isOpen={Boolean(printChallanData)}
          onClose={() => setPrintChallanData(null)}
          title={`Delivery Challan — ${printChallanData.challanNo || printChallanData.no}`}
          size="2xl"
        >
          <div className="space-y-6 text-xs p-2">
            <div className="border border-slate-300 rounded-xl p-6 bg-white space-y-4 print:p-0 print:border-none">
              {/* Header */}
              <div className="text-center border-b border-slate-200 pb-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                  GST RULE 55 DELIVERY CHALLAN FOR JOB WORK
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5">
                  OSCAR TEXTILES ERP
                </h2>
                <p className="text-[11px] text-slate-500">
                  Plot No. 42-45, Surat Industrial Textile Park, Sachin, Gujarat — 394230
                </p>
                <p className="text-[10px] font-mono text-slate-500">GSTIN: 24AAAFO1234F1Z8</p>
              </div>

              {/* Document Meta */}
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div className="border border-slate-200 p-2.5 rounded-lg space-y-1">
                  <span className="font-bold text-slate-400 uppercase text-[9px] block">CONSIGNOR (ISSUER)</span>
                  <span className="font-bold text-slate-900 block">OSCAR Textiles Ltd.</span>
                  <span className="text-slate-600 block">Main Warehouse Godown</span>
                  <span className="text-slate-500 block">Project: {project?.code}</span>
                </div>

                <div className="border border-slate-200 p-2.5 rounded-lg space-y-1">
                  <span className="font-bold text-slate-400 uppercase text-[9px] block">CONSIGNEE (JOB WORKER)</span>
                  <span className="font-bold text-blue-700 block">
                    {activeJwo?.vendor || activePlan?.vendor || 'Job Worker Processor'}
                  </span>
                  <span className="text-slate-600 block">Process: {activeJwo?.process || 'Dyeing'}</span>
                  <span className="text-slate-500 block">JWO No: {activeJwo?.jwoNo}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-[11px] font-mono">
                <div>Challan No: <strong>{printChallanData.challanNo || printChallanData.no}</strong></div>
                <div>Date: <strong>{printChallanData.date}</strong></div>
                <div>Vehicle: <strong>{printChallanData.vehicleNo || '—'}</strong></div>
                <div>Transporter: <strong>{printChallanData.transporter || '—'}</strong></div>
                <div>LR / Bilty: <strong>{printChallanData.lrNo || '—'}</strong></div>
                <div>Return By: <strong>{printChallanData.expectedReturnDate || '7 Days'}</strong></div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Roll (Taka) No</th>
                    <th className="p-2">Lot Number</th>
                    <th className="p-2">Fabric Description</th>
                    <th className="p-2 text-right">Quantity (M)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {(printChallanData.takas || []).length > 0 ? (
                    printChallanData.takas.map((t, idx) => (
                      <tr key={t.id || idx}>
                        <td className="p-2 text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-bold">{t.takaNo || t.takaNumber || `T-${idx + 1}`}</td>
                        <td className="p-2">{t.lotNo || t.lotNumber || 'LOT'}</td>
                        <td className="p-2 font-sans">{activePlan?.fabricQuality || activePlan?.fabricItem || 'Grey Fabric'}</td>
                        <td className="p-2 text-right font-bold">{Number(t.meters || 0).toLocaleString('en-IN')} M</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-2 text-slate-400">1</td>
                      <td className="p-2 font-bold">Consolidated Rolls</td>
                      <td className="p-2">{activePlan?.greyLotNo || 'LOT-2026'}</td>
                      <td className="p-2 font-sans">{activePlan?.fabricQuality || activePlan?.fabricItem || 'Grey Fabric'}</td>
                      <td className="p-2 text-right font-bold">{Number(printChallanData.qty || 0).toLocaleString('en-IN')} M</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-mono font-bold text-xs border-t border-slate-200">
                  <tr>
                    <td colSpan="4" className="p-2 text-right font-sans">Total Dispatched Quantity:</td>
                    <td className="p-2 text-right text-blue-700">
                      {Number(printChallanData.qty || 0).toLocaleString('en-IN')} M
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Statutory Declarations */}
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-600 space-y-1">
                <p>
                  <strong>Statutory Declaration under Section 143:</strong> Material dispatched under job work outward challan. Inputs to be returned within 1 year from the date of dispatch.
                </p>
                {printChallanData.remarks && (
                  <p><strong>Remarks:</strong> {printChallanData.remarks}</p>
                )}
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs">
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Receiver Signature & Stamp</span>
                  <span className="text-[10px] text-slate-400">For {activeJwo?.vendor || 'Vendor Processor'}</span>
                </div>
                <div className="border-t border-slate-300 pt-1">
                  <span className="font-semibold text-slate-700 block">Authorized Signatory</span>
                  <span className="text-[10px] text-slate-400">For OSCAR Textiles Ltd.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintChallanData(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Print Challan</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default Stage12JobWorkOutwardWorkspace;
