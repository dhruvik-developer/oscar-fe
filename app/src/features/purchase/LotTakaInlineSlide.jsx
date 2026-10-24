import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  QrCode,
  PackageCheck,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Printer,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import { useAppStore } from '../../stores/appStore';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function LotTakaInlineSlide({ po, onClose, onLotSaved, onSwitchToGrn, onNextStep, onPrevStep }) {
  const {
    showToast,
    refreshCollections,
  } = useERP();
  const currentUser = useAppStore((s) => s.currentUser);
  const permissions = useAppStore((s) => s.permissions) || [];
  const isAuthorizedManager = useMemo(() => {
    return Boolean(
      currentUser?.is_superuser ||
      currentUser?.is_staff ||
      currentUser?.role?.name?.toLowerCase().includes('manager') ||
      currentUser?.role?.name?.toLowerCase().includes('admin') ||
      currentUser?.role?.name?.toLowerCase().includes('lead') ||
      permissions.includes('adjust_stock') ||
      permissions.includes('manage_inventory') ||
      permissions.includes('view_inventory') ||
      !currentUser
    );
  }, [currentUser, permissions]);

  const [loadingGrns, setLoadingGrns] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grnList, setGrnList] = useState([]);
  const [selectedGrnId, setSelectedGrnId] = useState('');
  const [existingTakas, setExistingTakas] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [customRollCount, setCustomRollCount] = useState(5);
  const [showCreatedList, setShowCreatedList] = useState(true);

  // Form rows for new takas to create
  const [takas, setTakas] = useState([]);

  const poId = po?.id;
  const poNumber = po?.poNumber || po?.code || po?.orderNumber || 'PO';

  // 1. Fetch GRNs and existing Lots/Takas linked to this PO
  const loadData = async () => {
    if (!poId) return;
    try {
      setLoadingGrns(true);
      setLoadingLots(true);
      setErrorMsg('');

      const [grnsRes, lotsRes] = await Promise.allSettled([
        api.get('/purchase/receipts/', { params: { purchaseOrderId: poId } }),
        api.get('/inventory/lot-register/', { params: { po: poId } }),
      ]);

      let grns = [];
      if (grnsRes.status === 'fulfilled' && grnsRes.value) {
        const val = grnsRes.value;
        const raw = Array.isArray(val) ? val : (val.results || val.rows || val.data || []);
        grns = raw.filter((g) =>
          String(g.purchase_order || g.purchaseOrderId || g.purchaseOrder || g.poId || '') === String(poId) ||
          (poNumber && (g.poNumber === poNumber || g.po_number === poNumber))
        );
      }
      setGrnList(grns);
      if (grns.length > 0) {
        setSelectedGrnId((prev) => (prev && grns.some((g) => String(g.id) === String(prev)) ? prev : String(grns[0].id)));
      }

      let lots = [];
      if (lotsRes.status === 'fulfilled' && lotsRes.value) {
        const ld = lotsRes.value;
        lots = Array.isArray(ld) ? ld : (ld.records || ld.rows || ld.data || ld.results || []);
      }
      setExistingTakas(lots);
    } catch (err) {
      console.error('Failed to load PO GRN and Lot data:', err);
    } finally {
      setLoadingGrns(false);
      setLoadingLots(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poId]);

  // Currently selected GRN
  const currentGrn = useMemo(() => {
    if (!grnList.length) return null;
    return grnList.find((g) => String(g.id) === String(selectedGrnId)) || grnList[0];
  }, [grnList, selectedGrnId]);

  // Source item from GRN or PO line
  const sourceItem = useMemo(() => {
    if (currentGrn?.lines?.length) {
      const line = currentGrn.lines[0];
      return {
        id: line.item?.id || line.itemId || line.item_id || line.item,
        name: line.item?.name || line.itemName || line.item_name || 'Fabric Quality',
        sku: line.item?.sku || line.itemSku || line.item_sku || '-',
        quality: line.item?.fabricQuality || line.item?.fabric_quality || line.item?.name || 'Standard Quality',
        design: line.item?.fabricDesign || line.item?.fabric_design || '-',
        shade: line.item?.fabricColor || line.item?.fabric_color || line.item?.shade || '-',
        gsm: line.item?.fabricGsm || line.item?.fabric_gsm || line.gsm || 220,
        width: line.item?.fabricWidth || line.item?.fabric_width || line.fabricWidth || 44,
        unitCost: line.unitCost || line.unit_cost || line.rate || 0,
      };
    }
    const poItems = po?.items || po?.lineItems || po?.line_items || [];
    if (poItems.length) {
      const it = poItems[0];
      return {
        id: it.itemId || it.item_id || it.id,
        name: it.name || it.itemName || it.fabric || 'Fabric Quality',
        sku: it.sku || it.itemCode || '-',
        quality: it.fabricQuality || it.quality || it.name || 'Standard Quality',
        design: it.fabricDesign || it.design || '-',
        shade: it.fabricColor || it.shade || it.color || '-',
        gsm: it.gsm || 220,
        width: it.fabricWidth || it.width || 44,
        unitCost: it.rate || it.unitPrice || 0,
      };
    }
    return {
      id: '',
      name: 'Fabric Quality',
      sku: '-',
      quality: 'Standard Quality',
      design: '-',
      shade: '-',
      gsm: 220,
      width: 44,
      unitCost: 0,
    };
  }, [currentGrn, po]);

  // Total GRN received quantity in meters
  const grnTotalMeters = useMemo(() => {
    if (currentGrn?.lines?.length) {
      return currentGrn.lines.reduce((sum, l) => sum + (Number(l.receivedQty || l.received_qty || 0)), 0);
    }
    return Number(po?.receivedQuantity || po?.receivedQty || po?.totalReceivedQty || 0);
  }, [currentGrn, po]);

  // Takas linked to the current GRN that are already created (excluding placeholder if any)
  const takasForCurrentGrn = useMemo(() => {
    if (!currentGrn) return [];
    return existingTakas.filter((t) => {
      const matchesDocId = t.sourceDocumentId && String(t.sourceDocumentId) === String(currentGrn.id);
      const matchesDocNo = t.grnNo && currentGrn.grn_number && String(t.grnNo).toLowerCase() === String(currentGrn.grn_number).toLowerCase();
      return matchesDocId || matchesDocNo;
    });
  }, [existingTakas, currentGrn]);

  // Already created meters for this GRN
  const alreadyCreatedMeters = useMemo(() => {
    // If there is only 1 roll that equals the total GRN quantity exactly, it's the intake placeholder
    if (takasForCurrentGrn.length === 1 && Math.abs(Number(takasForCurrentGrn[0].receivedQty) - grnTotalMeters) < 0.01) {
      return 0; // Will be cleanly replaced upon first taka split
    }
    return takasForCurrentGrn.reduce((acc, t) => acc + (Number(t.receivedQty || 0)), 0);
  }, [takasForCurrentGrn, grnTotalMeters]);

  // Available meters left to split
  const availableToSplit = useMemo(() => {
    return Math.max(0, grnTotalMeters - alreadyCreatedMeters);
  }, [grnTotalMeters, alreadyCreatedMeters]);

  // Initialize default takas and lot number when GRN changes
  useEffect(() => {
    if (currentGrn) {
      const dStr = (currentGrn.receiptDate || currentGrn.receipt_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
      const defaultLot = `LOT-${poNumber.replace(/^PO-?/i, '')}-${dStr.slice(2, 6)}`;
      setLotNumber(defaultLot);

      const DEFAULT_TAKA_METERS = 90;
      if (availableToSplit > 0 && takas.length === 0) {
        autoSplitDefault90m(availableToSplit);
      }
    }
  }, [currentGrn, availableToSplit]);

  const DEFAULT_TAKA_METERS = 90;

  const autoSplitDefault90m = (totalQty) => {
    const qtyToUse = totalQty !== undefined ? Number(totalQty) : Number(availableToSplit);
    if (!qtyToUse || qtyToUse <= 0) {
      setTakas([]);
      return;
    }
    const fullRolls = Math.floor(qtyToUse / DEFAULT_TAKA_METERS);
    const remainder = Math.round((qtyToUse - (fullRolls * DEFAULT_TAKA_METERS)) * 10000) / 10000;
    const newRows = [];
    let rollNum = 1;

    for (let i = 0; i < fullRolls; i++) {
      newRows.push({
        id: `taka-${Date.now()}-${rollNum}`,
        takaRoll: String(rollNum),
        qty: DEFAULT_TAKA_METERS,
        weight: Math.round(DEFAULT_TAKA_METERS * 0.22 * 10) / 10,
        width: String(sourceItem.width || 44),
        gsm: String(sourceItem.gsm || 220),
        remarks: '',
      });
      rollNum++;
    }

    if (remainder > 0.0001) {
      newRows.push({
        id: `taka-${Date.now()}-${rollNum}`,
        takaRoll: String(rollNum),
        qty: remainder,
        weight: Math.round(remainder * 0.22 * 10) / 10,
        width: String(sourceItem.width || 44),
        gsm: String(sourceItem.gsm || 220),
        remarks: '',
      });
    }

    if (newRows.length === 0 && qtyToUse > 0) {
      newRows.push({
        id: `taka-${Date.now()}-1`,
        takaRoll: '1',
        qty: qtyToUse,
        weight: Math.round(qtyToUse * 0.22 * 10) / 10,
        width: String(sourceItem.width || 44),
        gsm: String(sourceItem.gsm || 220),
        remarks: '',
      });
    }

    setTakas(newRows);
  };

  const autoSplit = (count, totalQty) => {
    const num = Math.max(1, parseInt(count, 10) || 1);
    const qtyToUse = totalQty !== undefined ? totalQty : availableToSplit;
    const baseQty = Math.floor((qtyToUse / num) * 10000) / 10000;
    const remainder = Math.round((qtyToUse - (baseQty * (num - 1))) * 10000) / 10000;

    const newRows = [];
    for (let i = 1; i <= num; i++) {
      const rollQty = (i === num) ? remainder : baseQty;
      newRows.push({
        id: `taka-${Date.now()}-${i}`,
        takaRoll: String(i),
        qty: rollQty > 0 ? rollQty : '',
        weight: rollQty > 0 ? (Math.round((rollQty * 0.22) * 10) / 10) : '',
        width: String(sourceItem.width || 44),
        gsm: String(sourceItem.gsm || 220),
        remarks: '',
      });
    }
    setTakas(newRows);
  };

  const handleAddRow = () => {
    const nextNo = takas.length + 1;
    const defaultQty = remainingMeters > 0 ? Math.min(DEFAULT_TAKA_METERS, remainingMeters) : DEFAULT_TAKA_METERS;
    setTakas((prev) => [
      ...prev,
      {
        id: `taka-${Date.now()}-${nextNo}`,
        takaRoll: String(nextNo),
        qty: defaultQty,
        weight: Math.round(defaultQty * 0.22 * 10) / 10,
        width: String(sourceItem.width || 44),
        gsm: String(sourceItem.gsm || 220),
        remarks: '',
      },
    ]);
  };

  const handleRemoveRow = (id) => {
    setTakas((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id, field, value) => {
    setTakas((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'qty') {
          const q = Number(value) || 0;
          if (q > 0 && !r.weight) {
            updated.weight = Math.round(q * 0.22 * 10) / 10;
          }
        }
        return updated;
      })
    );
  };

  // Live meters calculations
  const totalAllocatedMeters = useMemo(() => {
    return takas.reduce((acc, t) => acc + (Number(t.qty) || 0), 0);
  }, [takas]);

  const remainingMeters = useMemo(() => {
    return Math.round((availableToSplit - totalAllocatedMeters) * 10000) / 10000;
  }, [availableToSplit, totalAllocatedMeters]);

  const isExcess = remainingMeters < -0.001;
  const isComplete = Math.abs(remainingMeters) < 0.01 && totalAllocatedMeters > 0;
  const allocationPercent = availableToSplit > 0
    ? Math.min(100, Math.round((totalAllocatedMeters / availableToSplit) * 100))
    : 0;

  // Submit and create takas in batch
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentGrn) {
      setErrorMsg('No valid GRN selected. Please record GRN first.');
      return;
    }

    if (takas.length === 0) {
      setErrorMsg('Add at least one taka roll to create.');
      return;
    }

    if (totalAllocatedMeters <= 0) {
      setErrorMsg('Total assigned meters must be greater than zero.');
      return;
    }

    if (isExcess) {
      setErrorMsg(
        `Total taka meters (${numIN(totalAllocatedMeters)} m) exceeds available GRN balance (${numIN(availableToSplit)} m). Reduce roll quantities.`
      );
      return;
    }

    // Validate that every row has positive qty and unique roll #
    const rollNumbers = new Set();
    for (let i = 0; i < takas.length; i++) {
      const t = takas[i];
      const q = Number(t.qty);
      if (!q || q <= 0) {
        setErrorMsg(`Taka Roll #${t.takaRoll || (i + 1)} has an invalid quantity.`);
        return;
      }
      const rNum = String(t.takaRoll || (i + 1)).trim();
      if (rollNumbers.has(rNum)) {
        setErrorMsg(`Duplicate Taka Roll #${rNum}. Each roll in a lot must have a unique number.`);
        return;
      }
      rollNumbers.add(rNum);
    }

    const payload = {
      grnId: currentGrn.id,
      grnNo: currentGrn.grn_number || currentGrn.grnNumber,
      poId: po.id,
      poNumber: poNumber,
      itemId: sourceItem.id || (currentGrn.lines?.[0]?.item?.id) || '',
      supplierId: currentGrn.party?.id || po?.vendorId || '',
      supplier: currentGrn.party?.name || po?.vendor || '',
      lotNo: (lotNumber || '').trim(),
      receivedDate: currentGrn.receiptDate || currentGrn.receipt_date || new Date().toISOString().split('T')[0],
      qcStatus: 'Pending',
      width: Number(sourceItem.width || 44),
      gsm: Number(sourceItem.gsm || 220),
      rate: Number(sourceItem.unitCost || 0),
      takas: takas.map((t, idx) => ({
        takaRoll: String(t.takaRoll || (idx + 1)).trim(),
        qty: Number(t.qty),
        weight: t.weight ? Number(t.weight) : null,
        width: t.width ? Number(t.width) : Number(sourceItem.width || 44),
        gsm: t.gsm ? Number(t.gsm) : Number(sourceItem.gsm || 220),
        remarks: t.remarks || '',
      })),
    };

    try {
      setSubmitting(true);
      const res = await api.post('/inventory/lot-register/', payload);
      setSuccessMsg(
        `Created ${takas.length} taka rolls for Lot ${lotNumber || 'auto-assigned'}! Rolls landed in SYS-QC-HOLD pending QC inspection.`
      );
      showToast?.(`Created ${takas.length} takas for PO ${poNumber}.`);

      // Refresh data
      await loadData();
      if (refreshCollections) {
        refreshCollections(['purchaseOrders', 'inventory']);
      }
      if (onLotSaved) {
        onLotSaved();
      }
    } catch (err) {
      console.error('Lot/Taka creation failed:', err);
      const data = err.response?.data;
      const msg =
        data?.detail ||
        (data?.field_errors && Object.values(data.field_errors).flat().join(' ')) ||
        err.message ||
        'Failed to create lot and taka rolls. Please check inputs.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-purple-200 bg-white p-4 sm:p-5 shadow-lg space-y-4">
      {/* ── Slide Header ── */}
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 border-b border-purple-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <Layers size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-sm">Lot & Taka Creation Workspace</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                Stage 4 • In-Drawer
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Split verified GRN intake rolls and allocate barcodes to <strong className="text-slate-700">SYS-QC-HOLD</strong> for {poNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loadingGrns || loadingLots}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Refresh GRN & Lot Data"
          >
            <RefreshCw size={14} className={loadingGrns || loadingLots ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Hide Slide"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Alert when No GRN Exists ── */}
      {!loadingGrns && grnList.length === 0 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs space-y-2.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-amber-900">No Goods Receipt (GRN) Recorded Yet</h4>
              <p className="text-amber-800 leading-relaxed">
                Lot numbers and individual taka roll barcodes are generated directly from physical intake receipts. Please complete the <strong>GRN / Inward</strong> stage before splitting takas.
              </p>
            </div>
          </div>
          {onSwitchToGrn && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onSwitchToGrn}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <PackageCheck size={13} /> Switch to Record GRN (Slide)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Main Workspace when GRN Exists ── */}
      {grnList.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* GRN & Source Context Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Source GRN:</span>
                {grnList.length > 1 ? (
                  <select
                    value={selectedGrnId}
                    onChange={(e) => setSelectedGrnId(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold bg-white text-slate-800 focus:outline-none focus:border-purple-500"
                  >
                    {grnList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.grn_number || g.grnNumber || 'GRN'} ({numIN(g.total_received_qty || g.lines?.[0]?.received_qty || 0)} m)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    {currentGrn?.grn_number || currentGrn?.grnNumber || 'GRN-INWARD'}
                  </span>
                )}
                <span className="text-[11px] text-slate-500">
                  Date: {currentGrn?.receiptDate || currentGrn?.receipt_date || '-'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-bold text-slate-800">{currentGrn?.party?.name || po?.vendor || 'Supplier'}</span>
              </div>
            </div>

            {/* Fabric Specifications Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">Quality & Item</span>
                <strong className="text-slate-800 truncate block">{sourceItem.quality || sourceItem.name}</strong>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">Width & GSM</span>
                <span className="font-mono font-bold text-slate-700">{sourceItem.width}&quot; • {sourceItem.gsm} GSM</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">GRN Received</span>
                <span className="font-mono font-extrabold text-blue-700">{numIN(grnTotalMeters)} m</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">Available to Split</span>
                <span className="font-mono font-extrabold text-emerald-700">{numIN(availableToSplit)} m</span>
              </div>
            </div>
          </div>

          {/* Lot Number Input Strip */}
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 bg-purple-50/50 border border-purple-200/70 p-3 rounded-xl">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="font-bold text-purple-950 whitespace-nowrap">Lot Number:</label>
              <input
                type="text"
                required
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g. LOT-2026-001"
                className="font-mono font-bold px-3 py-1.5 border border-purple-200 rounded-lg bg-white text-purple-900 text-xs focus:outline-none focus:border-purple-600 w-44"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => autoSplitDefault90m(availableToSplit)}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Reset distribution to default 90 meters per taka"
              >
                <Sparkles size={13} /> Reset to 90m per Taka
              </button>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-bold">
                <ShieldAlert size={13} className="text-indigo-600" />
                <span>Authorized Manager: <strong>{currentUser?.name || currentUser?.email || 'Manager'}</strong></span>
                <span className="text-indigo-300">•</span>
                <span className="text-emerald-700 font-semibold">Custom Roll Lengths Allowed</span>
              </div>
            </div>
          </div>

          {/* ── Takas Editable Table ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Layers size={13} className="text-purple-600" /> Taka Roll Allocation ({takas.length} Rolls)
              </h4>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={12} /> Add Roll
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 uppercase text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-3 w-10 text-center">#</th>
                    <th className="py-2 px-3 w-20">Roll #</th>
                    <th className="py-2 px-3 w-36">Meters (Qty) * <span className="text-purple-600 font-extrabold normal-case">(Default: 90m)</span></th>
                    <th className="py-2 px-3 w-24">Weight (kg)</th>
                    <th className="py-2 px-3 w-24">Width (&quot;)</th>
                    <th className="py-2 px-3">Remarks / Shade</th>
                    <th className="py-2 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {takas.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-1.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          required
                          value={r.takaRoll}
                          onChange={(e) => handleUpdateRow(r.id, 'takaRoll', e.target.value)}
                          className="w-16 px-2 py-1 border border-slate-200 rounded text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-purple-500"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            required
                            min="0.01"
                            disabled={!isAuthorizedManager}
                            value={r.qty}
                            onChange={(e) => handleUpdateRow(r.id, 'qty', e.target.value)}
                            placeholder="Meters"
                            title={isAuthorizedManager ? "Authorized manager editable quantity" : "Requires manager authorization to edit"}
                            className="w-28 px-2 py-1 border border-purple-200 rounded text-xs font-mono font-bold text-purple-900 bg-purple-50/30 focus:outline-none focus:border-purple-600 disabled:opacity-60"
                          />
                          <span className="text-[10px] font-mono text-slate-400">m</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="number"
                          step="any"
                          value={r.weight}
                          onChange={(e) => handleUpdateRow(r.id, 'weight', e.target.value)}
                          placeholder="kg"
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-xs font-mono text-slate-700 focus:outline-none focus:border-purple-500"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="number"
                          step="any"
                          value={r.width}
                          onChange={(e) => handleUpdateRow(r.id, 'width', e.target.value)}
                          className="w-16 px-2 py-1 border border-slate-200 rounded text-xs font-mono text-slate-700 focus:outline-none focus:border-purple-500"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={r.remarks}
                          onChange={(e) => handleUpdateRow(r.id, 'remarks', e.target.value)}
                          placeholder="e.g. Center roll / No slubs"
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-purple-500"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                          title="Remove Roll"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Eligible GRN Quantity</span>
              <span className="text-base font-extrabold font-mono text-blue-700 mt-1 block">{numIN(grnTotalMeters)} m</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Total verified intake</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Already Allocated</span>
              <span className="text-base font-extrabold font-mono text-slate-700 mt-1 block">{numIN(alreadyCreatedMeters)} m</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{takasForCurrentGrn.length} rolls in register</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Remaining Eligible GRN</span>
              <span className="text-base font-extrabold font-mono text-purple-700 mt-1 block">{numIN(availableToSplit)} m</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Eligible to allocate</span>
            </div>
            <div className={`p-3 rounded-xl border shadow-2xs transition-colors ${
              isExcess ? 'bg-rose-50 border-rose-300' : isComplete ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-600">Total Allocated</span>
                <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold uppercase ${
                  isExcess ? 'bg-rose-100 text-rose-800' : isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isExcess ? 'Excess' : isComplete ? 'Exact Match' : 'Partial'}
                </span>
              </div>
              <span className={`text-base font-extrabold font-mono mt-1 block ${
                isExcess ? 'text-rose-700' : isComplete ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {numIN(totalAllocatedMeters)} m
              </span>
              <span className={`text-[10.5px] font-bold mt-0.5 block ${
                isExcess ? 'text-rose-600' : isComplete ? 'text-emerald-600' : 'text-amber-700'
              }`}>
                {isExcess
                  ? `+${numIN(Math.abs(remainingMeters))} m over eligible GRN`
                  : isComplete
                  ? '100% of eligible GRN allocated'
                  : `${numIN(remainingMeters)} m unassigned`}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/60 flex items-start gap-2.5 text-xs">
            <ShieldAlert size={16} className="text-purple-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-purple-950 block">QC Hold Routing Policy</span>
              <span className="text-purple-800 text-[11px] leading-relaxed block mt-0.5">
                All newly created takas are automatically routed to <strong>SYS-QC-HOLD</strong> with <strong>QC Status: Pending</strong> and <strong>0 usable stock</strong>. They cannot be transferred, allocated, or issued until inspected and passed by Quality Control.
              </span>
            </div>
          </div>

          {/* Errors / Success Feedback */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldAlert size={14} className="text-purple-600" />
              <span>Takas automatically land in <strong>SYS-QC-HOLD</strong> with Pending QC status.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel / Hide
              </button>
              <button
                type="submit"
                disabled={submitting || isExcess || totalAllocatedMeters <= 0}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Saving Takas...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} /> Create Takas & Post to QC Hold
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Already Created Takas for this PO / GRN Section ── */}
      {existingTakas.length > 0 && (
        <div className="pt-3 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <QrCode size={13} className="text-emerald-600" /> Traceable Takas Created for {poNumber} ({existingTakas.length} Rolls)
            </h4>
            <button
              type="button"
              onClick={() => setShowCreatedList((prev) => !prev)}
              className="text-[11px] text-purple-700 hover:underline font-semibold cursor-pointer"
            >
              {showCreatedList ? 'Hide History' : 'View Rolls'}
            </button>
          </div>

          {showCreatedList && (
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-500 uppercase text-[10px] border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-3">Barcode / Taka ID</th>
                    <th className="py-2 px-3">Lot #</th>
                    <th className="py-2 px-3">Roll #</th>
                    <th className="py-2 px-3">Length (m)</th>
                    <th className="py-2 px-3">QC Status</th>
                    <th className="py-2 px-3">Location</th>
                    <th className="py-2 px-3">Created By</th>
                    <th className="py-2 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {existingTakas.map((lt) => (
                    <tr key={lt.id} className="hover:bg-slate-50/60 font-mono text-[11px]">
                      <td className="py-1.5 px-3 font-bold text-purple-700 flex items-center gap-1">
                        <QrCode size={12} className="text-purple-500" />
                        {lt.takaId || lt.barcode || lt.id}
                      </td>
                      <td className="py-1.5 px-3 font-bold text-slate-800">{lt.lotNo || lt.lot_number || '-'}</td>
                      <td className="py-1.5 px-3 font-bold">#{lt.takaRoll || lt.taka_number || '1'}</td>
                      <td className="py-1.5 px-3 font-extrabold text-blue-700">{numIN(lt.receivedQty || lt.availableQty)} m</td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            lt.qcStatus === 'Passed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : lt.qcStatus === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {lt.qcStatus || 'Pending'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-600 text-[10px]">
                        {lt.location || 'SYS-QC-HOLD'}
                      </td>
                      <td className="py-1.5 px-3 text-indigo-700 font-semibold text-[10.5px]">
                        {lt.createdBy || lt.updatedBy || 'Authorized Manager'}
                      </td>
                      <td className="py-1.5 px-3 text-slate-400 text-[10px]">
                        {lt.receivedDate || lt.rawDate || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Slide Lifecycle Navigation Bar ── */}
      <div className="pt-3 border-t border-purple-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-purple-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (onPrevStep) onPrevStep('grn_inward');
              else if (onSwitchToGrn) onSwitchToGrn();
            }}
            className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
          >
            <ArrowLeft size={13} />
            <span>Previous: GRN / Inward</span>
          </button>
          <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
            Stage 4 of 8 • Lot & Taka Rolls
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
          {onNextStep && (
            <button
              type="button"
              onClick={() => onNextStep('grey_fabric_qc')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <span>Next: Grey Fabric QC</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
