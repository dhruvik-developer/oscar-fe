import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  Plus,
  RefreshCw,
  Boxes,
  Clock,
  ArrowRight,
  X,
  ExternalLink,
  RotateCcw,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';

const STATUS_PILLS = {
  'Pending Dispatch': 'bg-amber-50 text-amber-700 border-amber-200',
  'Dispatched': 'bg-blue-50 text-blue-700 border-blue-200',
  'In Transit': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Partially Delivered': 'bg-purple-50 text-purple-700 border-purple-200',
  'Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Delayed': 'bg-rose-50 text-rose-700 border-rose-200',
};

export function SupplierDeliveryInlineSlide({ po, onClose, onDeliverySaved, onNextStep }) {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const { showToast } = useERP() || {};

  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isUpdateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

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

  const poId = po?.id;

  const loadDeliveries = async () => {
    if (!poId) return;
    try {
      setLoading(true);
      const res = await api.get('/purchase/deliveries/', {
        params: { purchaseOrderId: poId },
      });
      const list = Array.isArray(res) ? res : res?.data || res?.results || [];
      const filtered = list.filter(
        (d) => String(d.purchaseOrderId || d.purchaseOrder) === String(poId)
      );
      setDeliveries(filtered);
    } catch (err) {
      console.warn('Failed to load deliveries for PO:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [poId]);

  const poLineItems = useMemo(() => {
    if (!po) return [];
    return po.items || po.lineItems || po.line_items || [];
  }, [po]);

  const primaryFabric = useMemo(() => {
    if (!poLineItems.length) return null;
    return poLineItems[0];
  }, [poLineItems]);

  const totalOrderedQty = useMemo(() => {
    if (!poLineItems.length) return Number(po?.totalQuantity || po?.qty || 0);
    return poLineItems.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  }, [poLineItems, po]);

  const totalDispatchedQty = useMemo(() => {
    return deliveries.reduce((s, d) => s + (Number(d.dispatchedQty) || 0), 0);
  }, [deliveries]);

  const totalReceivedQty = useMemo(() => {
    const fromPo = Number(po?.receivedQty ?? po?.received_qty);
    if (!isNaN(fromPo) && fromPo > 0) return fromPo;
    if (poLineItems.length) {
      const lineRec = poLineItems.reduce((s, l) => s + (Number(l.receivedQty ?? l.received_qty) || 0), 0);
      if (lineRec > 0) return lineRec;
    }
    return Number(deliveries[0]?.receivedQty || 0);
  }, [po, poLineItems, deliveries]);

  const pendingDispatch = Math.max(0, totalOrderedQty - totalDispatchedQty);

  const [itemDispatchQtys, setItemDispatchQtys] = useState({});

  useEffect(() => {
    if (poLineItems.length > 1) {
      const initial = {};
      poLineItems.forEach((it, idx) => {
        const key = it.id || it.itemId || `item-${idx}`;
        initial[key] = '';
      });
      setItemDispatchQtys(initial);
    } else {
      setItemDispatchQtys({});
    }
  }, [poId, poLineItems]);

  const handleFillAllRemaining = () => {
    if (!poLineItems.length) return;
    const filled = {};
    let sum = 0;
    poLineItems.forEach((it, idx) => {
      const key = it.id || it.itemId || `item-${idx}`;
      const q = Number(it.qty || 0);
      filled[key] = q > 0 ? String(q) : '';
      sum += q;
    });
    setItemDispatchQtys(filled);
    setDispatchForm((prev) => ({ ...prev, dispatchedQty: sum > 0 ? String(sum) : '' }));
  };

  const handleClearLineQtys = () => {
    const cleared = {};
    poLineItems.forEach((it, idx) => {
      const key = it.id || it.itemId || `item-${idx}`;
      cleared[key] = '';
    });
    setItemDispatchQtys(cleared);
    setDispatchForm((prev) => ({ ...prev, dispatchedQty: '' }));
  };

  const handleLineQtyChange = (key, val) => {
    const updated = { ...itemDispatchQtys, [key]: val };
    setItemDispatchQtys(updated);
    const sum = Object.values(updated).reduce((s, v) => s + (Number(v) || 0), 0);
    setDispatchForm((prev) => ({ ...prev, dispatchedQty: sum > 0 ? String(sum) : '' }));
  };

  const handleClear = () => {
    setDispatchForm(initialFormState);
    handleClearLineQtys();
  };

  const handleSaveDispatch = async (e) => {
    e.preventDefault();
    if (!poId) {
      showToast?.('No purchase order context found.', 'error');
      return;
    }
    const qty = Number(dispatchForm.dispatchedQty);
    if (!qty || qty <= 0) {
      showToast?.('Enter a valid dispatch quantity.', 'error');
      return;
    }

    if (pendingDispatch > 0 && qty > pendingDispatch) {
      showToast?.(
        `Dispatch quantity cannot exceed remaining order quantity (${pendingDispatch.toLocaleString('en-IN')} M).`,
        'error'
      );
      return;
    }

    setSubmitting(true);
    try {
      let finalRemarks = dispatchForm.remarks?.trim() || '';
      if (poLineItems.length > 1) {
        const breakdownParts = poLineItems
          .map((it, idx) => {
            const key = it.id || it.itemId || `item-${idx}`;
            const val = Number(itemDispatchQtys[key] || 0);
            if (val > 0) {
              const name = it.name || it.itemName || it.fabric || it.description || `Item ${idx + 1}`;
              return `${name}: ${val.toLocaleString('en-IN')} M`;
            }
            return null;
          })
          .filter(Boolean);

        if (breakdownParts.length > 0) {
          const breakdownText = `[Breakdown: ${breakdownParts.join(' | ')}]`;
          finalRemarks = finalRemarks ? `${breakdownText} ${finalRemarks}` : breakdownText;
        }
      }

      const payload = {
        purchaseOrderId: poId,
        supplierChallanNo: dispatchForm.supplierChallanNo,
        supplierChallanDate: dispatchForm.supplierChallanDate || null,
        dispatchDate: dispatchForm.dispatchDate,
        expectedDeliveryDate: dispatchForm.expectedDeliveryDate || null,
        transporterName: dispatchForm.transporterName,
        vehicleNumber: dispatchForm.vehicleNumber,
        lrBiltyNumber: dispatchForm.lrBiltyNumber,
        dispatchedQty: qty,
        status: dispatchForm.status,
        remarks: finalRemarks || undefined,
      };

      await api.post('/purchase/deliveries/', payload);
      showToast?.('Supplier dispatch saved successfully.', 'success');
      setDispatchForm(initialFormState);
      handleClearLineQtys();
      await loadDeliveries();
      if (onDeliverySaved) onDeliverySaved();
    } catch (err) {
      showToast?.('Failed to save dispatch: ' + (err?.message || 'Server error'), 'error');
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
      showToast?.(`Delivery status updated to ${updateForm.status}.`, 'success');
      setUpdateModalOpen(false);
      setSelectedDelivery(null);
      await loadDeliveries();
      if (onDeliverySaved) onDeliverySaved();
    } catch (err) {
      showToast?.('Failed to update status: ' + (err?.message || 'Server error'), 'error');
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

  const handleAddAnother = () => {
    setDispatchForm(initialFormState);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleReceiveGrn = (delivery) => {
    if (onNextStep) {
      onNextStep('grn_inward', delivery);
      return;
    }
    navigate('/purchase/receipts', {
      state: {
        grnForPo: delivery.purchaseOrderId || delivery.purchaseOrder || poId,
        supplierChallanNo: delivery.supplierChallanNo,
        supplierChallanDate: delivery.supplierChallanDate,
        dispatchQty: delivery.dispatchedQty,
      },
    });
  };

  return (
    <div className="rounded-2xl border-2 border-blue-400/80 bg-gradient-to-b from-blue-50/60 via-white to-white p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Truck size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">
                Stage 2 Slide
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Supplier Delivery & Dispatch Tracking
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Manage dispatches, transporter vehicles, and bilty details against PO <strong className="font-mono text-blue-700">{po?.poNumber || ''}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => {
              if (onNextStep) onNextStep('grn_inward');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg shadow-2xs cursor-pointer"
            title="Advance to GRN Inward Slide"
          >
            <PackageCheck size={12} /> Advance to GRN
          </button>

          <button
            type="button"
            onClick={loadDeliveries}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs"
            title="Refresh Deliveries"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              title="Close Slide"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Ordered Qty</span>
            <FileText size={13} className="text-blue-600" />
          </div>
          <p className="text-lg font-black text-slate-900 font-mono mt-1">
            {totalOrderedQty.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-slate-500">M</span>
          </p>
        </div>

        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider">Dispatched</span>
            <Truck size={13} className="text-emerald-700" />
          </div>
          <p className="text-lg font-black text-emerald-900 font-mono mt-1">
            {totalDispatchedQty.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-emerald-700">M</span>
          </p>
        </div>

        <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-purple-800 uppercase tracking-wider">Received GRN</span>
            <Boxes size={13} className="text-purple-700" />
          </div>
          <p className="text-lg font-black text-purple-900 font-mono mt-1">
            {totalReceivedQty.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-purple-700">M</span>
          </p>
        </div>

        <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wider">Pending Dispatch</span>
            <Clock size={13} className="text-amber-700" />
          </div>
          <p className="text-lg font-black text-amber-900 font-mono mt-1">
            {pendingDispatch.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-amber-700">M</span>
          </p>
        </div>
      </div>

      {poLineItems.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-blue-600" />
              Fabric Line Items ({poLineItems.length})
            </h4>
            <span className="text-[10.5px] font-semibold text-slate-500">
              Total Contract: <strong className="font-mono text-slate-900">{totalOrderedQty.toLocaleString('en-IN')} M</strong>
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2.5 w-8">#</th>
                  <th className="py-2 px-2.5">Fabric Quality / Description</th>
                  <th className="py-2 px-2.5 text-right">Ordered Qty</th>
                  <th className="py-2 px-2.5 text-right">Rate</th>
                  <th className="py-2 px-2.5 text-right">Line Total</th>
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
                    <tr key={item.id || idx} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2.5 font-mono text-slate-400 text-[10px]">{idx + 1}</td>
                      <td className="py-2 px-2.5">
                        <span className="font-bold text-slate-800">{name}</span>
                        {item.gsm && <span className="ml-1.5 text-[9.5px] text-slate-400 font-mono">{item.gsm} GSM</span>}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                        {qty.toLocaleString('en-IN')} <span className="text-[9.5px] font-normal text-slate-500">{uom}</span>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-700">
                        ₹{rate.toLocaleString('en-IN')}/{uom}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                        ₹{total.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div ref={formRef} className="rounded-xl border border-blue-200 bg-white p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Plus size={13} className="text-blue-600" /> Record New Dispatch
          </h4>
          <span className="text-[10.5px] font-semibold text-slate-500">
            Available: <strong className="font-mono text-indigo-700">{pendingDispatch.toLocaleString('en-IN')} M</strong>
          </span>
        </div>

        <form onSubmit={handleSaveDispatch} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {poLineItems.length > 1 ? 'Total Dispatch Qty (Mtrs)' : 'Dispatch Qty (Mtrs)'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                readOnly={poLineItems.length > 1}
                min="1"
                max={pendingDispatch > 0 ? pendingDispatch : undefined}
                value={dispatchForm.dispatchedQty}
                onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchedQty: e.target.value })}
                placeholder={poLineItems.length > 1 ? 'Filled from table below' : (pendingDispatch > 0 ? String(pendingDispatch) : '1000')}
                className={`w-full border rounded-lg p-2 font-mono font-bold ${
                  poLineItems.length > 1
                    ? 'border-blue-300 bg-blue-50/70 text-blue-900 cursor-not-allowed'
                    : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                }`}
              />
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
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={dispatchForm.expectedDeliveryDate}
                onChange={(e) => setDispatchForm({ ...dispatchForm, expectedDeliveryDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status</label>
              <select
                value={dispatchForm.status}
                onChange={(e) => setDispatchForm({ ...dispatchForm, status: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Challan No.</label>
              <input
                type="text"
                value={dispatchForm.supplierChallanNo}
                onChange={(e) => setDispatchForm({ ...dispatchForm, supplierChallanNo: e.target.value })}
                placeholder="e.g. CH-2026-9041"
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Challan Date</label>
              <input
                type="date"
                value={dispatchForm.supplierChallanDate}
                onChange={(e) => setDispatchForm({ ...dispatchForm, supplierChallanDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Transporter</label>
              <input
                type="text"
                value={dispatchForm.transporterName}
                onChange={(e) => setDispatchForm({ ...dispatchForm, transporterName: e.target.value })}
                placeholder="e.g. VRL Logistics"
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Vehicle & LR No.</label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={dispatchForm.vehicleNumber}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNumber: e.target.value })}
                  placeholder="GJ 05 BX 4512"
                  className="border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
                <input
                  type="text"
                  value={dispatchForm.lrBiltyNumber}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, lrBiltyNumber: e.target.value })}
                  placeholder="LR-889012"
                  className="border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>
            </div>
          </div>

          {poLineItems.length > 1 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={13} className="text-blue-600" />
                  Fabric Allocation ({poLineItems.length} fabrics)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFillAllRemaining}
                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2 py-0.5 rounded shadow-2xs cursor-pointer hover:bg-blue-50"
                  >
                    Dispatch All Full
                  </button>
                  <button
                    type="button"
                    onClick={handleClearLineQtys}
                    className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs cursor-pointer hover:bg-slate-50"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5">Fabric Quality</th>
                      <th className="py-2 px-2.5 text-right">Contracted</th>
                      <th className="py-2 px-2.5 text-right w-44">Dispatch This Shipment</th>
                      <th className="py-2 px-2.5 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {poLineItems.map((item, idx) => {
                      const key = item.id || item.itemId || `item-${idx}`;
                      const name = item.name || item.itemName || item.fabric || item.description || `Fabric Item ${idx + 1}`;
                      const maxQty = Number(item.qty || item.quantity || 0);
                      const uom = item.uom || item.stockUom || 'Mtr';
                      return (
                        <tr key={key}>
                          <td className="py-1.5 px-2.5 font-medium text-slate-800">
                            {name}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono text-slate-600">
                            {maxQty.toLocaleString('en-IN')} {uom}
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={maxQty > 0 ? maxQty : undefined}
                                value={itemDispatchQtys[key] ?? ''}
                                onChange={(e) => handleLineQtyChange(key, e.target.value)}
                                placeholder="0"
                                className="w-28 border border-slate-300 rounded p-1 text-right font-mono font-bold text-slate-900 bg-white"
                              />
                              <span className="text-[10px] text-slate-400 font-mono">{uom}</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleLineQtyChange(key, String(maxQty))}
                              className="text-[9.5px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded"
                            >
                              Max
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-[11px]">
                    <tr>
                      <td className="py-1.5 px-2.5 text-slate-800">Total Dispatch</td>
                      <td className="py-1.5 px-2.5 text-right font-mono text-slate-600">{totalOrderedQty.toLocaleString('en-IN')} M</td>
                      <td className="py-1.5 px-2.5 text-right font-mono text-blue-700">
                        {Number(dispatchForm.dispatchedQty || 0).toLocaleString('en-IN')} M
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Remarks & Notes</label>
            <textarea
              rows={2}
              value={dispatchForm.remarks}
              onChange={(e) => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
              placeholder="e.g. Dispatched 25 rolls in good condition."
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-bold"
            >
              <RotateCcw size={13} /> Clear
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs disabled:opacity-50"
            >
              <Check size={14} />
              {submitting ? 'Saving...' : 'Save Dispatch'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 flex-wrap gap-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Truck size={14} className="text-slate-600" /> Dispatches for this PO ({deliveries.length})
          </h4>
          <button
            type="button"
            onClick={handleAddAnother}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
          >
            <Plus size={12} /> Add Another Dispatch
          </button>
        </div>

        {deliveries.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl">
            <Truck size={28} className="mx-auto mb-1.5 text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No supplier dispatches recorded yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Use the form above to record the first shipment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Delivery #</th>
                  <th className="py-2.5 px-3">Challan No & Date</th>
                  <th className="py-2.5 px-3">Dispatch Date</th>
                  <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                  <th className="py-2.5 px-3">Transporter</th>
                  <th className="py-2.5 px-3">LR / Bilty</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-bold text-blue-700">{d.deliveryNumber}</td>
                    <td className="py-2 px-3">
                      <p className="font-semibold text-slate-800">{d.supplierChallanNo || '—'}</p>
                      {d.supplierChallanDate && (
                        <p className="text-[10px] text-slate-400 font-mono">{d.supplierChallanDate}</p>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-800">{d.dispatchDate || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(d.dispatchedQty || 0).toLocaleString('en-IN')} M
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {d.transporterName || '—'} {d.vehicleNumber ? `(${d.vehicleNumber})` : ''}
                    </td>
                    <td className="py-2 px-3 font-mono text-indigo-700 font-semibold">{d.lrBiltyNumber || '—'}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_PILLS[d.status] || STATUS_PILLS.Dispatched}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openUpdateModal(d)}
                          className="px-2 py-1 text-[10.5px] font-semibold rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReceiveGrn(d)}
                          className="px-2 py-1 text-[10.5px] font-bold rounded bg-sky-600 hover:bg-sky-700 text-white shadow-2xs flex items-center gap-1"
                        >
                          <Boxes size={11} /> Receive GRN
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Slide Lifecycle Navigation Bar ── */}
      <div className="pt-3 border-t border-blue-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-blue-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
        <div className="text-[11px] text-slate-500 font-medium">
          Stage 2 of 8: <strong className="text-slate-800">Supplier Delivery</strong> • Dispatch tracking & transporter LR
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Close Slide
            </button>
          )}
          <button
            type="button"
            onClick={() => onNextStep && onNextStep('grn_inward')}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <span>Next: Record GRN / Inward</span>
            <ArrowRight size={13} />
          </button>
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

export default SupplierDeliveryInlineSlide;
