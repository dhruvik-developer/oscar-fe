import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Boxes,
  Truck,
  Plus,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Layers,
  ShieldCheck,
  Building2,
  Calendar,
  Hash,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { getProjectPurchaseOrders } from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useERP } from '../../../../context/ERPContext';
import MasterSourceLink from '../../../../components/common/MasterSourceLink';
import { useNavigate } from 'react-router-dom';
import { TablePagination } from '../../../../components/ui/TablePagination';

export function Stage3GRNInwardWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
  deliveryContext,
}) {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const { locations = [], refreshCollections } = useERP() || {};

  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
    }),
    [showToast]
  );

  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(5);

  const paginatedReceipts = useMemo(() => {
    const start = (histPage - 1) * histPageSize;
    return receipts.slice(start, start + histPageSize);
  }, [receipts, histPage, histPageSize]);
  const [deliveries, setDeliveries] = useState([]);
  const [fetchedLocations, setFetchedLocations] = useState([]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [grnForm, setGrnForm] = useState({
    supplierChallanNo: '',
    supplierChallanDate: todayStr,
    receiptDate: todayStr,
    receivedQty: '',
    rollCount: 10,
    locationId: '',
    gateEntryNo: '',
    remarks: '',
  });

  // Pre-fill from deliveryContext if passed (e.g. clicked "Receive GRN" on a dispatch)
  useEffect(() => {
    if (deliveryContext) {
      setGrnForm((prev) => ({
        ...prev,
        supplierChallanNo: deliveryContext.supplierChallanNo || prev.supplierChallanNo,
        supplierChallanDate: deliveryContext.supplierChallanDate || prev.supplierChallanDate,
        receivedQty: deliveryContext.dispatchQty ? String(deliveryContext.dispatchQty) : prev.receivedQty,
      }));
      if (deliveryContext.poId) {
        setSelectedPoId(String(deliveryContext.poId));
      }
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [deliveryContext]);

  // Load locations if not in ERPContext
  useEffect(() => {
    let active = true;
    if (locations.length === 0) {
      api.get('/inventory/locations/').then((res) => {
        const list = Array.isArray(res) ? res : res?.results || [];
        if (active && list.length > 0) {
          setFetchedLocations(list);
        }
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [locations]);

  const activeLocations = useMemo(() => {
    return locations.length > 0 ? locations : fetchedLocations;
  }, [locations, fetchedLocations]);

  // Set default location
  useEffect(() => {
    if (activeLocations.length > 0 && !grnForm.locationId) {
      const qcHold = activeLocations.find(
        (l) => (l.name || '').toLowerCase().includes('qc') || (l.name || '').toLowerCase().includes('main')
      );
      setGrnForm((prev) => ({
        ...prev,
        locationId: qcHold ? String(qcHold.id) : String(activeLocations[0].id),
      }));
    }
  }, [activeLocations, grnForm.locationId]);

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [poRes, recRes, delRes] = await Promise.allSettled([
        getProjectPurchaseOrders(projectId),
        api.get('/purchase/receipts/'),
        api.get('/purchase/deliveries/', { params: { projectId } }),
      ]);

      let poList = [];
      if (poRes.status === 'fulfilled' && poRes.value) {
        poList = Array.isArray(poRes.value) ? poRes.value : (poRes.value.data || poRes.value.results || []);
        setPurchaseOrders(poList);
        if (!selectedPoId && poList.length > 0) {
          setSelectedPoId(String(poList[0].id));
        }
      }

      if (delRes.status === 'fulfilled' && delRes.value) {
        const dList = Array.isArray(delRes.value) ? delRes.value : (delRes.value.data || delRes.value.results || []);
        setDeliveries(dList);
      }

      if (recRes.status === 'fulfilled' && recRes.value) {
        const rList = Array.isArray(recRes.value) ? recRes.value : (recRes.value.data || recRes.value.results || []);
        const poIds = new Set(poList.map((p) => String(p.id)));
        const poNumbers = new Set(poList.map((p) => p.poNumber));
        const matched = rList.filter((r) => {
          const poId = String(r.purchaseOrderId || r.purchase_order || '');
          const poNum = r.purchaseOrderNumber || r.poNumber;
          const notes = (r.supplierChallanNo || '').toLowerCase();
          const pCode = (project?.code || '').toLowerCase();
          return poIds.has(poId) || poNumbers.has(poNum) || (pCode && notes.includes(pCode));
        });
        setReceipts(matched.length > 0 ? matched : rList.filter((r) => poIds.has(String(r.purchase_order))));
      }
    } catch (err) {
      console.warn('Error loading GRN workspace data:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }
  }, [projectId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (onSyncPipeline) await onSyncPipeline();
    setRefreshing(false);
    toast.info('GRN records refreshed.');
  };

  const activePo = useMemo(() => {
    return purchaseOrders.find((p) => String(p.id) === String(selectedPoId)) || purchaseOrders[0] || null;
  }, [purchaseOrders, selectedPoId]);

  const primaryFabric = useMemo(() => {
    if (!activePo) return null;
    const items = activePo.items || activePo.lineItems || [];
    if (items.length > 0) return items[0];
    return {
      name: activePo.itemName || activePo.fabricName || 'Grey Fabric',
      rate: activePo.rate || 0,
      qty: activePo.qty || activePo.quantity || 0,
      uom: 'Mtr',
    };
  }, [activePo]);

  const totalOrderedQty = useMemo(() => {
    if (!activePo) return 0;
    const lines = activePo.items || activePo.lineItems || [];
    const lineSum = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    return lineSum > 0 ? lineSum : (Number(activePo.qty || activePo.quantity) || 0);
  }, [activePo]);

  const totalDispatchedQty = useMemo(() => {
    if (!activePo) return 0;
    const activeDelivs = deliveries.filter(
      (d) => String(d.purchaseOrderId || d.purchaseOrder) === String(activePo.id)
    );
    return activeDelivs.reduce((sum, d) => sum + (Number(d.dispatchedQty || d.dispatched_qty) || 0), 0);
  }, [deliveries, activePo]);

  const totalReceivedQty = useMemo(() => {
    return receipts.reduce((sum, r) => {
      const lines = r.lines || [];
      const lineSum = lines.reduce((ls, l) => ls + (Number(l.receivedQty || l.received_qty) || 0), 0);
      return sum + (lineSum > 0 ? lineSum : (Number(r.receivedQty) || 0));
    }, 0);
  }, [receipts]);

  const pendingInward = Math.max(0, totalOrderedQty - totalReceivedQty);

  // Set default receivedQty if empty
  useEffect(() => {
    if (!grnForm.receivedQty && pendingInward > 0) {
      setGrnForm((prev) => ({ ...prev, receivedQty: String(pendingInward) }));
    }
  }, [pendingInward]);

  const handleScrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenStandalone = () => {
    if (activePo) {
      navigate(`/purchase/receipts?po=${activePo.id}&project=${project?.id || ''}`);
    } else {
      navigate('/purchase/receipts');
    }
  };

  const handleClearForm = () => {
    setGrnForm({
      supplierChallanNo: '',
      supplierChallanDate: todayStr,
      receiptDate: todayStr,
      receivedQty: pendingInward > 0 ? String(pendingInward) : '',
      rollCount: 10,
      locationId: activeLocations[0]?.id ? String(activeLocations[0].id) : '',
      gateEntryNo: '',
      remarks: '',
    });
  };

  const handleCreateGrn = async (e) => {
    e.preventDefault();
    if (!activePo) {
      toast.error('No purchase order found for this project.');
      return;
    }
    const qty = Number(grnForm.receivedQty);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid received quantity.');
      return;
    }

    const lines = activePo.items || activePo.lineItems || [];
    const firstLine = lines[0] || {
      itemId: activePo.itemId,
      id: null,
      qty: totalOrderedQty,
      rate: activePo.rate || 0,
      uom: 'Mtr',
    };
    const rollCnt = Math.max(1, Number(grnForm.rollCount) || 1);
    const perRoll = Math.floor(qty / rollCnt);
    const lastRoll = perRoll + (qty - perRoll * rollCnt);

    const takasArray = Array.from({ length: rollCnt }, (_, i) => ({
      takaNumber: String(i + 1),
      qty: i === rollCnt - 1 ? lastRoll : perRoll,
      width: 44,
      remarks: 'Auto-split from physical GRN intake dock',
    }));

    setSubmitting(true);
    try {
      // Auto-approve PO if still in Draft -- through the approve action, so the
      // approve permission and separation-of-duties checks still apply.
      if (activePo.status === 'Draft') {
        try {
          await api.post(`/purchase/orders/${activePo.id}/submit-for-approval/`, {});
          await api.post(`/purchase/orders/${activePo.id}/approve/`, {});
          activePo.status = 'Approved';
        } catch (err) {
          console.warn('Auto approval notice:', err);
        }
      }

      const payload = {
        partyId: activePo.vendorId || activePo.party_id,
        locationId: grnForm.locationId || activeLocations[0]?.id || undefined,
        purchaseOrderId: activePo.id,
        supplierChallanNo: grnForm.supplierChallanNo || `CH-${activePo.poNumber || Date.now()}`,
        supplierChallanDate: grnForm.supplierChallanDate || null,
        receiptDate: grnForm.receiptDate,
        gateEntryNo: grnForm.gateEntryNo || undefined,
        lines: [
          {
            itemId: firstLine?.itemId || firstLine?.item?.id,
            poLineId: firstLine?.id || null,
            orderedQty: Number(firstLine?.qty || totalOrderedQty),
            receivedQty: qty,
            rollCount: rollCnt,
            uom: firstLine?.uom || 'Mtr',
            unitCost: Number(firstLine?.rate || 0),
            remarks: grnForm.remarks,
            takas: takasArray,
          },
        ],
      };

      const res = await api.post('/purchase/receipts/', payload);
      const grnNum = res?.grnNumber || res?.grn_number || res?.id || 'New';
      toast.success(`GRN #${grnNum} created! Fabric posted to QC-Hold with ${rollCnt} takas.`);

      if (refreshCollections) {
        refreshCollections(['purchaseOrders', 'inventory']);
      }

      handleClearForm();
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error('Failed to create GRN: ' + (err?.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 sm:p-6 shadow-sm">
        {/* ── Top Workspace Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Boxes size={16} className="text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Goods Receipt Note (GRN) & Fabric Inward
            </h3>
          </div>
        </div>

        {/* ── Section 1: Purchase Order & Reference Details ── */}
        {activePo ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Purchase Order & Fabric Reference Details
                </h4>
              </div>
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {activePo.poNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Supplier / Vendor</span>
                <p className="font-bold text-slate-800 truncate mt-0.5">{activePo.vendor || activePo.party_name || '—'}</p>
                <p className="text-[10px] text-slate-500 font-mono">{activePo.vendorCode || activePo.party_gstin || 'VEND-001'}</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Fabric Quality</span>
                <p className="font-bold text-slate-800 truncate mt-0.5">
                  {primaryFabric?.name || primaryFabric?.description || activePo.fabricName || 'Grey Fabric'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {primaryFabric?.uom || 'Mtr'} · {primaryFabric?.gsm ? `${primaryFabric.gsm} GSM` : 'Standard'}
                </p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Ordered Quantity</span>
                <p className="font-mono font-black text-slate-900 text-sm mt-0.5">
                  {totalOrderedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">M</span>
                </p>
                <p className="text-[10px] text-slate-400">Total ordered meters</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Total Dispatched</span>
                <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                  {totalDispatchedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">M</span>
                </p>
                <p className="text-[10px] text-slate-400">Supplier transit dispatches</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Total PO Value</span>
                <p className="font-mono font-black text-slate-900 text-sm mt-0.5">
                  ₹{Number(activePo.total || activePo.amount || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-emerald-600 font-medium">Approved Value</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Project Association</span>
                <p className="font-bold text-slate-800 truncate mt-0.5">{project?.name || project?.code || 'General Stock'}</p>
                <p className="text-[10px] text-indigo-600 font-mono">{project?.code || 'PRJ-STOCK'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span>No Purchase Order linked to this project. Create or associate a PO in Stage 2 to record GRN inward.</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectStage && onSelectStage(2)}
              className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700"
            >
              Go to Stage 2: PO
            </button>
          </div>
        )}

        {/* ── Section 2: Inward Summary & Fulfillment Status ── */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Boxes size={16} className="text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Inward Summary & Fulfillment Status
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ordered Quantity</span>
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <FileText size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {totalOrderedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">M</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Total contracted requirement</p>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Dispatched</span>
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <Truck size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-900 mt-2 font-mono">
                {totalDispatchedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-emerald-700">M</span>
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {totalOrderedQty > 0 ? `${Math.round((totalDispatchedQty / totalOrderedQty) * 100)}% dispatched` : '0 dispatches'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Received via GRN</span>
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                  <Boxes size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-purple-900 mt-2 font-mono">
                {totalReceivedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-purple-700">M</span>
              </p>
              <p className="text-[11px] text-purple-700 mt-0.5">
                {totalOrderedQty > 0 ? `${Math.round((totalReceivedQty / totalOrderedQty) * 100)}% received into QC-Hold` : '0 m received'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Inward</span>
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <Clock size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-amber-900 mt-2 font-mono">
                {pendingInward.toLocaleString('en-IN')} <span className="text-xs font-normal text-amber-700">M</span>
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">Remaining fabric intake</p>
            </div>
          </div>
        </div>

        {/* ── Section 3: Record Goods Receipt Note (GRN) Inward ── */}
        <div ref={formRef} className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Boxes size={17} className="text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                3. Record Goods Receipt Note (GRN) Inward
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">
              Remaining to receive: <strong className="font-mono text-emerald-700">{pendingInward.toLocaleString('en-IN')} M</strong>
            </span>
          </div>

          <form onSubmit={handleCreateGrn} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Received Qty (Mtrs) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="1"
                  value={grnForm.receivedQty}
                  onChange={(e) => setGrnForm({ ...grnForm, receivedQty: e.target.value })}
                  placeholder={pendingInward > 0 ? String(pendingInward) : '1000'}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 font-mono font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Pending PO balance: {pendingInward.toLocaleString('en-IN')} Mtrs
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Receipt Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={grnForm.receiptDate}
                  onChange={(e) => setGrnForm({ ...grnForm, receiptDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    Destination Godown / Location <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="godowns" />
                </div>
                <select
                  required
                  value={grnForm.locationId}
                  onChange={(e) => setGrnForm({ ...grnForm, locationId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                >
                  {activeLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name || loc.code} {loc.code ? `(${loc.code})` : ''}
                    </option>
                  ))}
                  {activeLocations.length === 0 && (
                    <option value="qc-hold-default">Main Godown / QC-Hold</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Rolls / Takas Count <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={grnForm.rollCount}
                  onChange={(e) => setGrnForm({ ...grnForm, rollCount: e.target.value })}
                  placeholder="10"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 font-mono font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Generates initial lot takas
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier Challan No.</label>
                <input
                  type="text"
                  value={grnForm.supplierChallanNo}
                  onChange={(e) => setGrnForm({ ...grnForm, supplierChallanNo: e.target.value })}
                  placeholder="e.g. CH-2026-9041"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier Challan Date</label>
                <input
                  type="date"
                  value={grnForm.supplierChallanDate}
                  onChange={(e) => setGrnForm({ ...grnForm, supplierChallanDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Gate Inward / LR / Bilty Ref</label>
                <input
                  type="text"
                  value={grnForm.gateEntryNo}
                  onChange={(e) => setGrnForm({ ...grnForm, gateEntryNo: e.target.value })}
                  placeholder="e.g. GATE-2026-441 / LR-998"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Routing & Quality Status</label>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 font-bold">
                  <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                  <span className="truncate">QC-Hold (Inspection Queued)</span>
                </div>
              </div>
            </div>

            {/* Roll Breakdown Dynamic Preview */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                <Layers size={16} className="text-emerald-600" />
                <span>
                  Auto-Split Preview: <strong>{grnForm.receivedQty || 0} Mtrs</strong> will be divided across{' '}
                  <strong>{grnForm.rollCount || 1} rolls</strong> (~{Math.round((Number(grnForm.receivedQty) || 0) / (Number(grnForm.rollCount) || 1))} Mtrs each) on inward intake.
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-md border border-emerald-200 shadow-2xs">
                Auto Lot Taka Ready
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Dock Inspection Remarks / Notes</label>
              <textarea
                rows={2}
                value={grnForm.remarks}
                onChange={(e) => setGrnForm({ ...grnForm, remarks: e.target.value })}
                placeholder="Fabric condition on vehicle arrival, bundle count, bale wrapping status..."
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 resize-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClearForm}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <CheckCircle2 size={15} />
                {submitting ? 'Posting GRN Inward...' : 'Save & Post GRN to QC-Hold'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Section 4: GRN / Inward Receipt History ── */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                4. Inward Goods Receipts / GRN History ({receipts.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">Multiple GRNs against one PO supported</span>
          </div>

          {receipts.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Boxes size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">No Goods Receipts (GRN) recorded yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Record physical receipt when the vehicle arrives at the warehouse dock.
              </p>
              <button
                type="button"
                onClick={handleScrollToForm}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-emerald-700 cursor-pointer"
              >
                <Plus size={13} /> Record GRN Inward Above
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">GRN #</th>
                      <th className="py-2.5 px-3">Receipt Date</th>
                      <th className="py-2.5 px-3">Supplier Challan</th>
                      <th className="py-2.5 px-3 text-right">Received Qty</th>
                      <th className="py-2.5 px-3 text-center">Rolls / Takas</th>
                      <th className="py-2.5 px-3">Godown / Location</th>
                      <th className="py-2.5 px-3">QC Status</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedReceipts.map((r) => {
                      const lineQty = (r.lines || []).reduce((s, l) => s + (Number(l.receivedQty || l.received_qty) || 0), 0);
                      const displayQty = lineQty > 0 ? lineQty : (Number(r.receivedQty) || 0);
                      const qc = r.qcStatus || r.qc_status || 'QC-Hold';
                      const rollCount = (r.lines || []).reduce((s, l) => s + (l.takas?.length || Number(l.rollCount) || 0), 0) || '—';
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3 font-mono font-bold text-blue-700">
                            {r.grnNumber || r.grn_number || `GRN-${String(r.id).slice(-4)}`}
                          </td>
                          <td className="py-3 px-3 text-slate-700">{r.receiptDate || r.receipt_date || '—'}</td>
                          <td className="py-3 px-3 font-medium text-slate-800">
                            {r.supplierChallanNo || r.supplier_challan_no || '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {displayQty.toLocaleString('en-IN')} M
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                            {rollCount} Rolls
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-medium">
                            {r.locationName || r.location_name || 'QC-Hold Godown'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                qc === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {qc}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => onSelectStage && onSelectStage(5)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              Proceed to Takas <ArrowRight size={11} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {receipts.length > 5 && (
                <TablePagination
                  total={receipts.length}
                  page={histPage}
                  pageSize={histPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={setHistPage}
                  onPageSizeChange={setHistPageSize}
                />
              )}
            </div>
          )}
        </div>

        
      </div>
    </div>
  );
}

export default Stage3GRNInwardWorkspace;
