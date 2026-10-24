import React, { useState, useEffect, useMemo } from 'react';
import {
  PackageCheck,
  Plus,
  Trash2,
  Layers,
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import MasterSourceLink from '../../components/common/MasterSourceLink';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function GoodsReceiptInlineSlide({ po, delivery, onClose, onReceiptSaved, onNextStep, onPrevStep }) {
  const navigate = useNavigate();
  const {
    purchaseOrders = [],
    vendors = [],
    items: masterItems = [],
    locations = [],
    refreshCollections,
  } = useERP();

  const [existingGrns, setExistingGrns] = useState([]);
  const [loadingGrns, setLoadingGrns] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const poId = po?.id;
  const todayStr = new Date().toISOString().split('T')[0];

  const defaultVendorId = po?.vendorId || po?.partyId || (vendors.find((v) => v.name === po?.vendor)?.id) || '';
  const defaultLocationId = locations?.[0]?.id || '';

  const initialLines = useMemo(() => {
    const rawItems = po?.items || po?.lineItems || po?.line_items || [];
    const deliveryQty = Number(delivery?.dispatchedQty);
    const hasDeliveryQty = !isNaN(deliveryQty) && deliveryQty > 0;
    if (!rawItems.length) {
      return [
        {
          id: `line-${Date.now()}`,
          itemId: '',
          itemName: '',
          poLineId: null,
          orderedQty: 0,
          receivedQty: '',
          unitCost: 0,
          uom: 'MTR',
          batchNumber: '',
          fabricWidth: 44,
          remarks: '',
          takas: [
            {
              id: `t-${Date.now()}-1`,
              takaNumber: '1',
              qty: '',
              weight: '',
              width: '44',
              remarks: '',
            },
          ],
        },
      ];
    }

    return rawItems.map((it, idx) => {
      const remaining = Math.max(0, Number(it.qty || 0) - Number(it.receivedQty || 0));
      const targetQty = hasDeliveryQty ? deliveryQty : (remaining > 0 ? remaining : Number(it.qty || 0));
      return {
        id: `line-${idx + 1}`,
        itemId: it.itemId || it.item_id || it.item || '',
        itemName: it.name || it.itemName || it.fabric || it.description || `Line Item ${idx + 1}`,
        poLineId: it.id || null,
        orderedQty: Number(it.qty || 0),
        receivedQty: targetQty,
        unitCost: Number(it.rate || it.unitPrice || 0),
        uom: it.uom || 'MTR',
        batchNumber: '',
        fabricWidth: it.fabricWidth || 44,
        remarks: '',
        takas: [
          {
            id: `t-${idx + 1}-1`,
            takaNumber: '1',
            qty: targetQty,
            weight: '',
            width: it.fabricWidth ? String(it.fabricWidth) : '44',
            remarks: '',
          },
        ],
      };
    });
  }, [po, delivery]);

  const [form, setForm] = useState({
    vendorId: defaultVendorId,
    poId: poId || '',
    supplierChallanNo: delivery?.supplierChallanNo || '',
    supplierChallanDate: delivery?.supplierChallanDate || todayStr,
    receiptDate: todayStr,
    locationId: defaultLocationId,
    lines: initialLines,
  });

  useEffect(() => {
    if (delivery) {
      const dQty = Number(delivery.dispatchedQty);
      const hasDQty = !isNaN(dQty) && dQty > 0;
      setForm((prev) => ({
        ...prev,
        supplierChallanNo: delivery.supplierChallanNo || prev.supplierChallanNo,
        supplierChallanDate: delivery.supplierChallanDate || prev.supplierChallanDate,
        lines: prev.lines.map((l) => {
          let lineTargetQty = l.receivedQty;
          if (hasDQty) {
            if (prev.lines.length === 1) {
              lineTargetQty = dQty;
            } else {
              // For multi-item PO, preserve line ordered quantity instead of applying total shipment sum to each line
              lineTargetQty = l.orderedQty ? Math.min(Number(l.orderedQty), dQty) : l.receivedQty;
            }
          }
          return {
            ...l,
            receivedQty: lineTargetQty,
            takas: (l.takas || []).map((t) => ({
              ...t,
              qty: lineTargetQty,
            })),
          };
        }),
      }));
    }
  }, [delivery]);

  const loadPoDeliveriesAndGrns = async () => {
    if (!poId) return;
    try {
      setLoadingGrns(true);
      const [deliveriesRes, grnsRes] = await Promise.allSettled([
        api.get('/purchase/deliveries/', { params: { purchaseOrderId: poId } }),
        api.get('/purchase/receipts/'),
      ]);

      if (deliveriesRes.status === 'fulfilled') {
        const dList = Array.isArray(deliveriesRes.value) ? deliveriesRes.value : deliveriesRes.value?.results || [];
        const matchingDeliveries = dList.filter(
          (d) => String(d.purchaseOrderId || d.purchaseOrder) === String(poId)
        );
        if (matchingDeliveries.length > 0 && !form.supplierChallanNo) {
          const latest = matchingDeliveries[0];
          setForm((prev) => ({
            ...prev,
            supplierChallanNo: prev.supplierChallanNo || latest.supplierChallanNo || '',
            supplierChallanDate: latest.supplierChallanDate || prev.supplierChallanDate,
          }));
        }
      }

      if (grnsRes.status === 'fulfilled') {
        const raw = grnsRes.value;
        const allGrns = Array.isArray(raw) ? raw : (raw?.results || raw?.rows || []);
        const matchingGrns = allGrns.filter(
          (g) => String(g.poId || g.purchase_order || g.purchaseOrderId) === String(poId) ||
                 (po?.poNumber && g.poNumber === po.poNumber)
        );
        setExistingGrns(matchingGrns);
      }
    } catch (err) {
      console.warn('Failed loading deliveries/GRNs for PO:', err);
    } finally {
      setLoadingGrns(false);
    }
  };

  useEffect(() => {
    loadPoDeliveriesAndGrns();
  }, [poId]);

  useEffect(() => {
    if (locations?.length > 0 && !form.locationId) {
      setForm((prev) => ({ ...prev, locationId: locations[0].id }));
    }
  }, [locations, form.locationId]);

  useEffect(() => {
    if (defaultVendorId && !form.vendorId) {
      setForm((prev) => ({ ...prev, vendorId: defaultVendorId }));
    }
  }, [defaultVendorId, form.vendorId]);

  useEffect(() => {
    if (poId && form.poId !== poId) {
      setForm((prev) => ({ ...prev, poId }));
    }
  }, [poId, form.poId]);

  const GREY_PURCHASE_TYPES = ['Grey Stock Purchase', 'Ready Grey Fabric Purchase', 'Ready Grey', 'Grey Fabric'];
  const availableVendorPos = useMemo(() => {
    let list = (purchaseOrders || []).filter(
      (p) => (!form.vendorId || String(p.vendorId || p.partyId) === String(form.vendorId))
        && GREY_PURCHASE_TYPES.includes(p.purchaseType || 'Grey Stock Purchase')
        && ['Approved', 'Partially Received', 'Fully Received', 'Issued'].includes(p.status)
    );
    if (po && !list.some((p) => String(p.id) === String(po.id))) {
      list = [po, ...list];
    }
    return list;
  }, [purchaseOrders, form.vendorId, po]);

  const handleVendorSelect = (vendorId) => {
    setForm((prev) => ({
      ...prev,
      vendorId,
      poId: '',
      lines: [],
    }));
  };

  const handlePoSelect = (selectedPoId) => {
    if (!selectedPoId) {
      setForm((prev) => ({ ...prev, poId: '', lines: [] }));
      return;
    }
    const targetPo = purchaseOrders.find((p) => p.id === selectedPoId);
    if (!targetPo) return;

    const poLines = (targetPo.lineItems || targetPo.items || []).map((it, idx) => {
      const remaining = Math.max(0, Number(it.qty || 0) - Number(it.receivedQty || 0));
      const targetQty = remaining > 0 ? remaining : Number(it.qty || 0);
      return {
        id: `line-${idx + 1}`,
        itemId: it.itemId || it.item_id || it.item || '',
        itemName: it.name || it.itemName || it.fabric || it.description || '',
        poLineId: it.id || null,
        orderedQty: Number(it.qty || 0),
        receivedQty: targetQty,
        unitCost: Number(it.rate || it.unitPrice || 0),
        uom: it.uom || 'MTR',
        batchNumber: '',
        fabricWidth: it.fabricWidth || 44,
        remarks: '',
        takas: [
          {
            id: `t-${idx + 1}-1`,
            takaNumber: '1',
            qty: targetQty,
            weight: '',
            width: it.fabricWidth ? String(it.fabricWidth) : '44',
            remarks: '',
          },
        ],
      };
    });

    setForm((prev) => ({
      ...prev,
      poId: selectedPoId,
      lines: poLines,
    }));
  };

  const handleAddLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          id: `line-${Date.now()}`,
          itemId: '',
          itemName: '',
          poLineId: null,
          orderedQty: 0,
          receivedQty: '',
          unitCost: 0,
          uom: 'MTR',
          batchNumber: '',
          fabricWidth: 44,
          remarks: '',
          takas: [
            {
              id: `t-${Date.now()}-1`,
              takaNumber: '1',
              qty: '',
              weight: '',
              width: '44',
              remarks: '',
            },
          ],
        },
      ],
    }));
  };

  const handleRemoveLine = (lineId) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.id !== lineId),
    }));
  };

  const handleUpdateLine = (lineId, field, val) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, [field]: val };
        if (field === 'receivedQty' && updated.takas?.length === 1) {
          updated.takas = [{ ...updated.takas[0], qty: Number(val) || 0 }];
        }
        return updated;
      }),
    }));
  };

  const handleAddTaka = (lineId) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.id !== lineId) return l;
        const nextNo = (l.takas?.length || 0) + 1;
        return {
          ...l,
          takas: [
            ...(l.takas || []),
            {
              id: `t-${Date.now()}-${nextNo}`,
              takaNumber: String(nextNo),
              qty: '',
              weight: '',
              width: l.fabricWidth ? String(l.fabricWidth) : '44',
              remarks: '',
            },
          ],
        };
      }),
    }));
  };

  const handleRemoveTaka = (lineId, takaId) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          takas: l.takas.filter((t) => t.id !== takaId),
        };
      }),
    }));
  };

  const handleUpdateTaka = (lineId, takaId, field, val) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          takas: l.takas.map((t) => (t.id === takaId ? { ...t, [field]: val } : t)),
        };
      }),
    }));
  };

  const handleAutoSplitTakas = (lineId) => {
    const line = form.lines.find((l) => l.id === lineId);
    if (!line) return;
    const countStr = window.prompt(`How many rolls to split ${line.receivedQty} meters into?`, '4');
    const count = parseInt(countStr, 10);
    if (!count || count <= 0) return;

    const total = Number(line.receivedQty) || 0;
    const perRoll = Math.floor((total / count) * 100) / 100;
    const lastRoll = Math.round((total - perRoll * (count - 1)) * 100) / 100;

    const newTakas = Array.from({ length: count }, (_, idx) => ({
      id: `t-${Date.now()}-${idx}`,
      takaNumber: String(idx + 1),
      qty: idx === count - 1 ? lastRoll : perRoll,
      weight: '',
      width: line.fabricWidth ? String(line.fabricWidth) : '44',
      remarks: '',
    }));

    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === lineId ? { ...l, takas: newTakas } : l)),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (!form.vendorId) throw new Error('Please select a supplier.');
      if (!form.locationId) throw new Error('Please select a destination godown / location.');
      if (!form.lines || form.lines.length === 0) throw new Error('Add at least one line item.');

      for (let i = 0; i < form.lines.length; i++) {
        const l = form.lines[i];
        const rQty = Number(l.receivedQty);
        if (!l.itemId) throw new Error(`Line ${i + 1}: Select the item received.`);
        if (!(rQty > 0)) throw new Error(`Line ${i + 1}: Received quantity must be greater than zero.`);

        if (l.takas && l.takas.length > 0) {
          const takaSum = l.takas.reduce((s, t) => s + (Number(t.qty) || 0), 0);
          if (Math.abs(takaSum - rQty) > 0.001) {
            throw new Error(`Line ${i + 1}: Sum of taka meters (${takaSum} m) does not match received quantity (${rQty} m).`);
          }
        }
      }

      const payload = {
        partyId: form.vendorId,
        locationId: form.locationId,
        purchaseOrderId: form.poId || poId || null,
        supplierChallanNo: form.supplierChallanNo || `CH-${po?.poNumber || Date.now()}`,
        supplierChallanDate: form.supplierChallanDate || null,
        receiptDate: form.receiptDate,
        lines: form.lines.map((l) => ({
          itemId: l.itemId,
          poLineId: l.poLineId || null,
          orderedQty: Number(l.orderedQty) || 0,
          receivedQty: Number(l.receivedQty) || 0,
          unitCost: Number(l.unitCost) || 0,
          uom: l.uom || 'MTR',
          batchNumber: l.batchNumber || undefined,
          fabricWidth: l.fabricWidth ? Number(l.fabricWidth) : null,
          remarks: l.remarks || '',
          takas: (l.takas || []).map((t, tIdx) => ({
            takaNumber: t.takaNumber || String(tIdx + 1),
            qty: Number(t.qty) || 0,
            weight: t.weight ? Number(t.weight) : null,
            width: t.width ? Number(t.width) : null,
            remarks: t.remarks || '',
          })),
        })),
      };

      const key = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `grn-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const res = await api.post('/purchase/receipts/', payload, { idempotencyKey: key });
      const grnNum = res.grnNumber || res.grn_number || res.id;
      setSuccessMsg(`GRN #${grnNum} intake recorded successfully! Goods received and sent to QC hold.`);

      if (refreshCollections) {
        refreshCollections(['purchaseOrders', 'inventory']);
      }
      if (onReceiptSaved) {
        onReceiptSaved(res);
      }

      await loadPoDeliveriesAndGrns();
    } catch (err) {
      console.error('GRN creation failed:', err);
      setErrorMsg(err?.message || 'Failed to submit Goods Receipt Note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-b from-emerald-50/50 via-white to-white p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs">
            <PackageCheck size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Stage 3 Slide
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Standalone Goods Receipt Note (GRN)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Capture intake directly against supplier challan or purchase order with roll/taka breakdown
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {existingGrns.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg shadow-2xs"
            >
              <Layers size={12} />
              {showHistory ? 'Hide Existing Receipts' : `Past Receipts (${existingGrns.length})`}
            </button>
          )}

          <button
            type="button"
            onClick={loadPoDeliveriesAndGrns}
            disabled={loadingGrns}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw size={13} className={loadingGrns ? 'animate-spin' : ''} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 border border-slate-200"
              title="Close Slide"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {showHistory && existingGrns.length > 0 && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-700" /> Recorded GRNs Against PO {po?.poNumber}
            </span>
            <span className="text-[11px] font-mono text-emerald-800 font-semibold">{existingGrns.length} received</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-white rounded-lg border border-emerald-200 overflow-hidden">
              <thead className="bg-emerald-100/60 text-emerald-900 font-semibold text-[10.5px] uppercase">
                <tr>
                  <th className="px-3 py-2">GRN #</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Challan #</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2 text-center">QC Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 text-[11.5px]">
                {existingGrns.map((g) => (
                  <tr key={g.id || g.grn_number} className="hover:bg-emerald-50/40">
                    <td className="px-3 py-2 font-mono font-bold text-emerald-700">{g.grn_number || g.id}</td>
                    <td className="px-3 py-2 text-slate-600">{g.receipt_date || g.date}</td>
                    <td className="px-3 py-2 font-mono text-slate-700">{g.supplier_challan_no || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{g.lines?.length || 0}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {g.qc_status || 'Pending QC'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs font-semibold">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700 text-[11px]">
                Supplier / Mill <span className="text-rose-500">*</span>
              </label>
              <MasterSourceLink source="vendors" />
            </div>
            <select
              required
              value={form.vendorId}
              onChange={(e) => handleVendorSelect(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Select Supplier...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code || 'Vendor'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">
              Link Purchase Order (Optional)
            </label>
            <select
              value={form.poId}
              onChange={(e) => handlePoSelect(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Direct Receipt (No PO)</option>
              {availableVendorPos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poNumber || p.number} ({p.docDate || p.date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700 text-[11px]">
                Destination Godown <span className="text-rose-500">*</span>
              </label>
              <MasterSourceLink source="godowns" />
            </div>
            <select
              required
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:border-emerald-500 focus:outline-none"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">
              Supplier Challan No <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.supplierChallanNo}
              onChange={(e) => setForm({ ...form, supplierChallanNo: e.target.value })}
              placeholder="e.g. CH-2026/894"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono focus:border-emerald-500 focus:outline-none text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">
              Supplier Challan Date
            </label>
            <input
              type="date"
              value={form.supplierChallanDate}
              onChange={(e) => setForm({ ...form, supplierChallanDate: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:border-emerald-500 focus:outline-none text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">
              Receipt Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.receiptDate}
              onChange={(e) => setForm({ ...form, receiptDate: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:border-emerald-500 focus:outline-none text-xs"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-emerald-700" />
              Intake Line Items ({form.lines.length})
            </h4>
            <div className="flex items-center gap-3">
              <MasterSourceLink source="items" label="+ Add / Manage Items" />
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                <Plus size={13} /> Add Fabric Line
              </button>
            </div>
          </div>

          {form.lines.map((line) => {
            const shortage = Math.max(0, Number(line.orderedQty || 0) - Number(line.receivedQty || 0));
            const excess = Math.max(0, Number(line.receivedQty || 0) - Number(line.orderedQty || 0));
            const takaSum = (line.takas || []).reduce((s, t) => s + (Number(t.qty) || 0), 0);
            const takaDiff = Math.round((Number(line.receivedQty || 0) - takaSum) * 100) / 100;
            const takaMatch = Math.abs(takaDiff) < 0.001;

            return (
              <div key={line.id} className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-2xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Fabric Item <span className="text-rose-500">*</span>
                    </label>
                    {form.poId && line.itemName ? (
                      <div className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold text-slate-800 border border-slate-200 truncate text-xs">
                        {line.itemName}
                      </div>
                    ) : (
                      <select
                        value={line.itemId}
                        onChange={(e) => handleUpdateLine(line.id, 'itemId', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:border-emerald-500 focus:outline-none text-xs"
                      >
                        <option value="">Select item...</option>
                        {masterItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.sku || 'Fabric'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      PO Ordered
                    </label>
                    <input
                      type="number"
                      readOnly={Boolean(form.poId)}
                      value={line.orderedQty}
                      onChange={(e) => handleUpdateLine(line.id, 'orderedQty', e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-700 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Received (m) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={line.receivedQty}
                      onChange={(e) => handleUpdateLine(line.id, 'receivedQty', e.target.value)}
                      className="w-full px-3 py-1.5 border-2 border-emerald-500 rounded-lg bg-white font-mono font-black text-slate-900 focus:border-emerald-600 focus:outline-none text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Batch / Lot #
                    </label>
                    <input
                      type="text"
                      value={line.batchNumber}
                      placeholder="Auto (server)"
                      onChange={(e) => handleUpdateLine(line.id, 'batchNumber', e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono uppercase text-xs"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Width (in)
                    </label>
                    <input
                      type="number"
                      value={line.fabricWidth}
                      onChange={(e) => handleUpdateLine(line.id, 'fabricWidth', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-xs"
                    />
                  </div>

                  <div className="sm:col-span-1 flex items-center justify-end pb-1">
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(line.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50"
                      title="Remove Line"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {Number(line.orderedQty) > 0 && (
                  <div className="flex items-center gap-2 text-[11px] pt-0.5">
                    <span className="text-slate-500 font-semibold">Variance vs PO:</span>
                    {shortage > 0 ? (
                      <span className="text-amber-700 font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        ⚠️ Shortage: {numIN(shortage)} m ({Math.round((shortage / line.orderedQty) * 100)}%)
                      </span>
                    ) : excess > 0 ? (
                      <span className="text-blue-700 font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        ℹ️ Excess: +{numIN(excess)} m ({Math.round((excess / line.orderedQty) * 100)}%)
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ Exact match with PO
                      </span>
                    )}
                  </div>
                )}

                <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-700 text-[11px] flex items-center gap-1.5">
                      <Layers size={13} className="text-emerald-700" />
                      Taka / Roll Breakdown ({line.takas?.length || 0} rolls)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAutoSplitTakas(line.id)}
                        className="text-[11px] font-extrabold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                      >
                        Auto Split
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddTaka(line.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs"
                      >
                        <Plus size={11} /> Add Taka
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {(line.takas || []).map((t) => (
                      <div key={t.id} className="grid grid-cols-12 gap-2 items-center text-xs">
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="Roll #"
                            value={t.takaNumber}
                            onChange={(e) => handleUpdateTaka(line.id, t.id, 'takaNumber', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded-md bg-white font-mono text-[11px]"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Meters *"
                            value={t.qty}
                            onChange={(e) => handleUpdateTaka(line.id, t.id, 'qty', e.target.value)}
                            className="w-full px-2 py-1 border border-emerald-300 rounded-md bg-white font-mono font-bold text-slate-800 text-[11px] focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Weight (kg)"
                            value={t.weight || ''}
                            onChange={(e) => handleUpdateTaka(line.id, t.id, 'weight', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded-md bg-white font-mono text-[11px]"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Remarks / Defect notes"
                            value={t.remarks || ''}
                            onChange={(e) => handleUpdateTaka(line.id, t.id, 'remarks', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded-md bg-white text-[11px]"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveTaka(line.id, t.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={`p-2 rounded-lg flex items-center justify-between text-[11px] font-semibold ${
                    takaMatch
                      ? 'bg-emerald-100/70 text-emerald-900 border border-emerald-300'
                      : 'bg-amber-100/90 text-amber-950 border border-amber-300'
                  }`}>
                    <span>
                      Total Taka Rolls: <strong>{line.takas?.length || 0}</strong> • Sum: <strong>{numIN(takaSum)} m</strong>
                    </span>
                    {takaMatch ? (
                      <span className="font-extrabold text-emerald-800">
                        ✓ Matches line quantity ({numIN(line.receivedQty)} m)
                      </span>
                    ) : (
                      <span className="font-extrabold text-amber-900">
                        ⚠️ Difference: {takaDiff > 0 ? `-${numIN(takaDiff)} m remaining` : `+${numIN(Math.abs(takaDiff))} m excess`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-emerald-50/50 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
          <div className="flex items-center gap-2">
            {onPrevStep && (
              <button
                type="button"
                onClick={() => onPrevStep('supplier_delivery')}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <ArrowLeft size={13} />
                <span>Previous: Supplier Delivery</span>
              </button>
            )}
            <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
              Stage 3 of 8 • Standalone GRN
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs cursor-pointer shadow-2xs"
              >
                Close Slide
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-xs disabled:opacity-50 flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <CheckCircle2 size={14} />
              {submitting ? 'Recording GRN...' : 'Submit GRN Intake'}
            </button>
            {onNextStep && (
              <button
                type="button"
                onClick={() => onNextStep('lot_taka_creation')}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <span>Next: Lot / Taka Creation</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

export default GoodsReceiptInlineSlide;
