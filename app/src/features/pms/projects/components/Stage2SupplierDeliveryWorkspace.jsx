import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  Plus,
  RefreshCw,
  FileText,
  Boxes,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  ExternalLink,
  Building,
  Calendar,
  Layers,
  RotateCcw,
  Check,
  MapPin,
  IndianRupee,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../services/api';
import { getProjectPurchaseOrders } from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import TablePagination from '../../../../components/ui/TablePagination';

const STATUS_PILLS = {
  'Pending Dispatch': 'bg-amber-50 text-amber-700 border-amber-200',
  'Dispatched': 'bg-blue-50 text-blue-700 border-blue-200',
  'In Transit': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Partially Delivered': 'bg-purple-50 text-purple-700 border-purple-200',
  'Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Delayed': 'bg-rose-50 text-rose-700 border-rose-200',
};

export function Stage2SupplierDeliveryWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
}) {
  const navigate = useNavigate();
  const formRef = useRef(null);
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
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [deliveries, setDeliveries] = useState([]);

  const [isUpdateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const initialFormState = {
    supplierChallanNo: '',
    supplierChallanDate: new Date().toISOString().split('T')[0],
    dispatchDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    transporterName: '',
    vehicleNumber: '',
    lrBiltyNumber: '',
    dispatchedQty: '',
    status: 'Dispatched',
    remarks: '',
  };

  const [dispatchForm, setDispatchForm] = useState(initialFormState);

  const [updateForm, setUpdateForm] = useState({
    status: 'Delivered',
    actualDeliveryDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [poRes, delRes, allPosRes] = await Promise.allSettled([
        getProjectPurchaseOrders(projectId),
        api.get('/purchase/deliveries/', { params: { projectId } }),
        api.get('/purchase/orders/', { params: { limit: 100 } }),
      ]);

      let poList = [];
      if (poRes.status === 'fulfilled' && poRes.value) {
        poList = Array.isArray(poRes.value)
          ? poRes.value
          : poRes.value.data || poRes.value.results || [];
      }

      if (poList.length === 0 && allPosRes.status === 'fulfilled' && allPosRes.value) {
        const allPos = Array.isArray(allPosRes.value)
          ? allPosRes.value
          : allPosRes.value.data || allPosRes.value.results || [];
        poList = allPos.filter(
          (p) =>
            String(p.projectId || p.project_id || p.project) === String(projectId) ||
            p.projectCode === project.code
        );
        if (poList.length === 0 && allPos.length > 0) {
          poList = allPos.slice(0, 5);
        }
      }

      setPurchaseOrders(poList);
      if (poList.length > 0 && !selectedPoId) {
        setSelectedPoId(String(poList[0].id));
      }

      if (delRes.status === 'fulfilled' && delRes.value) {
        const dList = Array.isArray(delRes.value)
          ? delRes.value
          : delRes.value.data || delRes.value.results || [];
        setDeliveries(dList);
      } else if (poList.length > 0) {
        const poIds = new Set(poList.map((p) => String(p.id)));
        const allDel = await api.get('/purchase/deliveries/').catch(() => []);
        const raw = Array.isArray(allDel) ? allDel : allDel?.results || [];
        setDeliveries(raw.filter((d) => poIds.has(String(d.purchaseOrderId || d.purchaseOrder))));
      }
    } catch (err) {
      console.warn('Error loading delivery workspace data:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }
  }, [projectId]);

  const activePo = useMemo(() => {
    if (!purchaseOrders.length) return null;
    if (selectedPoId) {
      const match = purchaseOrders.find((p) => String(p.id) === String(selectedPoId));
      if (match) return match;
    }
    return purchaseOrders[0];
  }, [purchaseOrders, selectedPoId]);

  const poLineItems = useMemo(() => {
    if (!activePo) return [];
    return activePo.items || activePo.lineItems || activePo.line_items || [];
  }, [activePo]);

  const primaryFabric = useMemo(() => {
    if (!poLineItems.length) return null;
    return poLineItems[0];
  }, [poLineItems]);

  const poDeliveries = useMemo(() => {
    if (!activePo) return deliveries;
    return deliveries.filter(
      (d) => String(d.purchaseOrderId || d.purchaseOrder) === String(activePo.id)
    );
  }, [deliveries, activePo]);

  const totalOrderedQty = useMemo(() => {
    if (!poLineItems.length) return 0;
    return poLineItems.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  }, [poLineItems]);

  const totalDispatchedQty = useMemo(() => {
    return poDeliveries.reduce((s, d) => s + (Number(d.dispatchedQty) || 0), 0);
  }, [poDeliveries]);

  const totalReceivedQty = useMemo(() => {
    return poDeliveries.reduce((s, d) => s + (Number(d.receivedQty) || 0), 0);
  }, [poDeliveries]);

  const pendingDispatch = Math.max(0, totalOrderedQty - totalDispatchedQty);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [selectedPoId]);

  const pagedPoDeliveries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return poDeliveries.slice(start, start + pageSize);
  }, [poDeliveries, page, pageSize]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (onSyncPipeline) await onSyncPipeline();
    setRefreshing(false);
    toast.info('Delivery records refreshed.');
  };

  const handleClearForm = () => {
    setDispatchForm(initialFormState);
  };

  const handleSaveDispatch = async (e) => {
    e.preventDefault();
    if (!activePo) {
      toast.error('No purchase order selected.');
      return;
    }
    const qty = Number(dispatchForm.dispatchedQty);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid dispatch quantity.');
      return;
    }

    if (pendingDispatch > 0 && qty > pendingDispatch) {
      toast.error(`Dispatch quantity cannot exceed remaining order quantity (${pendingDispatch.toLocaleString('en-IN')} M).`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        purchaseOrderId: activePo.id,
        supplierChallanNo: dispatchForm.supplierChallanNo,
        supplierChallanDate: dispatchForm.supplierChallanDate || null,
        dispatchDate: dispatchForm.dispatchDate,
        expectedDeliveryDate: dispatchForm.expectedDeliveryDate || null,
        transporterName: dispatchForm.transporterName,
        vehicleNumber: dispatchForm.vehicleNumber,
        lrBiltyNumber: dispatchForm.lrBiltyNumber,
        dispatchedQty: qty,
        status: dispatchForm.status,
        remarks: dispatchForm.remarks,
      };

      await api.post('/purchase/deliveries/', payload);
      toast.success('Supplier dispatch saved successfully.');
      setDispatchForm(initialFormState);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error('Failed to save dispatch: ' + (err?.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedDelivery) return;

    setSubmitting(true);
    try {
      const payload = {
        status: updateForm.status,
        actualDeliveryDate: updateForm.actualDeliveryDate || null,
        remarks: updateForm.remarks || selectedDelivery.remarks || '',
      };

      await api.patch(`/purchase/deliveries/${selectedDelivery.id}/`, payload);
      toast.success(`Delivery status updated to ${updateForm.status}.`);
      setUpdateModalOpen(false);
      setSelectedDelivery(null);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error('Failed to update status: ' + (err?.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdateModal = (delivery) => {
    setSelectedDelivery(delivery);
    setUpdateForm({
      status: delivery.status || 'Delivered',
      actualDeliveryDate: delivery.actualDeliveryDate || new Date().toISOString().split('T')[0],
      remarks: delivery.remarks || '',
    });
    setUpdateModalOpen(true);
  };

  const handleAddAnotherDispatch = () => {
    setDispatchForm(initialFormState);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenStandalone = () => {
    if (activePo) {
      navigate(`/purchase/deliveries?po=${activePo.id}&project=${project?.id || ''}`);
    } else {
      navigate('/purchase/deliveries');
    }
  };

  const handleReceiveGrn = (delivery) => {
    if (onSelectStage) {
      onSelectStage(4, {
        deliveryId: delivery.id,
        supplierChallanNo: delivery.supplierChallanNo,
        supplierChallanDate: delivery.supplierChallanDate,
        dispatchQty: delivery.dispatchedQty,
        poId: delivery.purchaseOrderId || delivery.purchaseOrder || activePo?.id,
      });
    } else {
      navigate('/purchase/receipts', {
        state: {
          grnForPo: delivery.purchaseOrderId || delivery.purchaseOrder,
          supplierChallanNo: delivery.supplierChallanNo,
          supplierChallanDate: delivery.supplierChallanDate,
          dispatchQty: delivery.dispatchedQty,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Supplier Fabric Delivery & Logistics Tracking
            </h3>
          </div>
        </div>

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
                {poLineItems.length > 1 ? (
                  <>
                    <p className="font-bold text-blue-700 truncate mt-0.5" title={poLineItems.map((l) => l.name || l.fabric || l.description).filter(Boolean).join(', ')}>
                      {poLineItems.length} Fabric Qualities
                    </p>
                    <p className="text-[10px] text-slate-500">Multi-item PO ({poLineItems.length} items)</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-slate-800 truncate mt-0.5">{primaryFabric?.name || primaryFabric?.description || activePo.fabricName || 'Grey Fabric'}</p>
                    <p className="text-[10px] text-slate-500">{primaryFabric?.uom || 'Mtr'} · {primaryFabric?.gsm ? `${primaryFabric.gsm} GSM` : 'Standard'}</p>
                  </>
                )}
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Ordered Quantity</span>
                <p className="font-mono font-black text-slate-900 text-sm mt-0.5">
                  {totalOrderedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">M</span>
                </p>
                <p className="text-[10px] text-slate-400">Total ordered meters</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Unit Rate</span>
                {poLineItems.length > 1 ? (
                  <>
                    <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                      Various Rates
                    </p>
                    <p className="text-[10px] text-slate-400">See line items breakdown below</p>
                  </>
                ) : (
                  <>
                    <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                      ₹{Number(primaryFabric?.rate || activePo.rate || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-slate-400">Per meter rate</p>
                  </>
                )}
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

            {poLineItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={13} className="text-blue-600" />
                    Fabric Line Items ({poLineItems.length})
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Total: <strong className="font-mono text-slate-900">{totalOrderedQty.toLocaleString('en-IN')} M</strong> · <strong className="font-mono text-slate-900">₹{Number(activePo.total || activePo.amount || 0).toLocaleString('en-IN')}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3">Fabric Quality / Description</th>
                        <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                        <th className="py-2.5 px-3 text-right">Agreed Rate</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {poLineItems.map((item, idx) => {
                        const name = item.name || item.itemName || item.fabric || item.description || `Fabric ${idx + 1}`;
                        const qty = Number(item.qty || item.quantity || 0);
                        const rate = Number(item.rate || item.unitPrice || 0);
                        const total = Number(item.amount || qty * rate);
                        const uom = item.uom || item.stockUom || 'Mtr';
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-800">{name}</span>
                              {item.gsm && <span className="ml-2 text-[10px] text-slate-400 font-mono">{item.gsm} GSM</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {qty.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-slate-500">{uom}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                              ₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{uom}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span>No Purchase Order linked to this project yet. Create or associate a PO in Stage 1 to track dispatches.</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectStage && onSelectStage(1)}
              className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700"
            >
              Go to Stage 1: PO
            </button>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Boxes size={16} className="text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Delivery Summary & Fulfillment Status
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
                {totalOrderedQty > 0 ? `${Math.round((totalDispatchedQty / totalOrderedQty) * 100)}% of PO dispatched` : '0 dispatches'}
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
              <p className="text-[11px] text-purple-700 mt-0.5">Physical intake in dock</p>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Dispatch</span>
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <Clock size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-amber-900 mt-2 font-mono">
                {pendingDispatch.toLocaleString('en-IN')} <span className="text-xs font-normal text-amber-700">M</span>
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">Remaining vendor shipment</p>
            </div>
          </div>
        </div>

        <div ref={formRef} className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Truck size={17} className="text-blue-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                3. Record Supplier Dispatch
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">
              Remaining to dispatch: <strong className="font-mono text-indigo-700">{pendingDispatch.toLocaleString('en-IN')} M</strong>
            </span>
          </div>

          <form onSubmit={handleSaveDispatch} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Dispatch Qty (Mtrs) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="1"
                  max={pendingDispatch > 0 ? pendingDispatch : undefined}
                  value={dispatchForm.dispatchedQty}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchedQty: e.target.value })}
                  placeholder={pendingDispatch > 0 ? String(pendingDispatch) : '1000'}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Must be ≤ {pendingDispatch.toLocaleString('en-IN')} Mtrs
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Dispatch Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dispatchForm.dispatchDate}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={dispatchForm.expectedDeliveryDate}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, expectedDeliveryDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Delivery Status</label>
                <select
                  value={dispatchForm.status}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, status: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  <option value="Dispatched">Dispatched</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Partially Delivered">Partially Delivered</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Pending Dispatch">Pending Dispatch</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier Challan No.</label>
                <input
                  type="text"
                  value={dispatchForm.supplierChallanNo}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, supplierChallanNo: e.target.value })}
                  placeholder="e.g. CH-2026-9041"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier Challan Date</label>
                <input
                  type="date"
                  value={dispatchForm.supplierChallanDate}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, supplierChallanDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Transporter Name</label>
                <input
                  type="text"
                  value={dispatchForm.transporterName}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, transporterName: e.target.value })}
                  placeholder="e.g. VRL Logistics / Mahavir Roadways"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vehicle & LR / Bilty Number</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={dispatchForm.vehicleNumber}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNumber: e.target.value })}
                    placeholder="GJ 05 BX 4512"
                    className="border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={dispatchForm.lrBiltyNumber}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, lrBiltyNumber: e.target.value })}
                    placeholder="LR-889012"
                    className="border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Remarks & Dispatch Notes</label>
              <textarea
                rows={2}
                value={dispatchForm.remarks}
                onChange={(e) => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
                placeholder="e.g. 20 bales dispatched in good condition, expected arrival tomorrow."
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClearForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold shadow-2xs"
              >
                <RotateCcw size={14} /> Clear
              </button>

              <button
                type="submit"
                disabled={submitting || !activePo}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
              >
                <Check size={15} />
                {submitting ? 'Saving Dispatch...' : 'Save Dispatch'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-slate-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                4. Dispatch / Delivery History ({poDeliveries.length})
              </h4>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500">
                Total Dispatched: <strong className="font-mono text-slate-900">{totalDispatchedQty.toLocaleString('en-IN')} M</strong>
              </span>
              <button
                type="button"
                onClick={handleAddAnotherDispatch}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
              >
                <Plus size={13} /> Add Another Dispatch
              </button>
            </div>
          </div>

          {poDeliveries.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
              <Truck size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">No dispatches logged for this Purchase Order</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Use the form above to record the first dispatch when the vendor ships fabric.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">Delivery #</th>
                    <th className="py-3 px-3">Challan No & Date</th>
                    <th className="py-3 px-3">Dispatch Date</th>
                    <th className="py-3 px-3 text-right">Dispatched Qty</th>
                    <th className="py-3 px-3">Transporter / Vehicle</th>
                    <th className="py-3 px-3">LR / Bilty</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedPoDeliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-mono font-bold text-blue-700">
                        {d.deliveryNumber}
                        {d.remarks && (
                          <p className="font-sans text-[10px] text-slate-400 font-normal truncate max-w-[130px]" title={d.remarks}>
                            {d.remarks}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800">{d.supplierChallanNo || '—'}</p>
                        {d.supplierChallanDate && (
                          <p className="text-[10px] text-slate-400 font-mono">{d.supplierChallanDate}</p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-slate-800 font-medium">{d.dispatchDate || '—'}</p>
                        {d.expectedDeliveryDate && (
                          <p className="text-[10px] text-slate-400">Exp: {d.expectedDeliveryDate}</p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {Number(d.dispatchedQty || 0).toLocaleString('en-IN')} M
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-slate-800 font-medium">{d.transporterName || '—'}</p>
                        {d.vehicleNumber && (
                          <p className="text-[10px] font-mono text-slate-500">{d.vehicleNumber}</p>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-indigo-700 font-semibold">
                        {d.lrBiltyNumber || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            STATUS_PILLS[d.status] || STATUS_PILLS.Dispatched
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openUpdateModal(d)}
                            className="px-2 py-1 text-[11px] font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReceiveGrn(d)}
                            className="px-2 py-1 text-[11px] font-bold rounded-md bg-sky-600 hover:bg-sky-700 text-white shadow-2xs flex items-center gap-1"
                          >
                            <Boxes size={11} /> Receive GRN
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination
                page={page}
                pageSize={pageSize}
                totalItems={poDeliveries.length}
                onPageChange={setPage}
                onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
              />
            </div>
          )}
        </div>

        
      </div>

      {isUpdateModalOpen && selectedDelivery && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl text-xs flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Update Delivery Status</h3>
              <button
                type="button"
                onClick={() => setUpdateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3 mt-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Status</label>
                <select
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                >
                  <option value="Dispatched">Dispatched</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Partially Delivered">Partially Delivered</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Actual Delivery Date</label>
                <input
                  type="date"
                  value={updateForm.actualDeliveryDate}
                  onChange={(e) => setUpdateForm({ ...updateForm, actualDeliveryDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={updateForm.remarks}
                  onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUpdateModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {submitting ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stage2SupplierDeliveryWorkspace;
