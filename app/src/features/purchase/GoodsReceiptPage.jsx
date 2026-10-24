import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TablePagination } from '../../components/ui/TablePagination';
import { useERP } from '../../context/ERPContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatCard } from '../../components/ui/StatCard';
import { PageHeader } from '../../components/common/PageHeader';
import useUnits from '../../hooks/useUnits';
import { formatQty, formatUnitTotals, sumByUnit } from '../../utils/uom';
import {
  PackageCheck,
  Truck,
  ClipboardCheck,
  ShieldCheck,
  X,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Scale,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Layers,
  Building2,
  RefreshCw,
  Search,
} from 'lucide-react';
import api from '../../services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { numIN } from '../../utils/formatters';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import GrnDetailDrawer from './GrnDetailDrawer';

const goodsReceiptGuide = {
  title: 'Goods Receipt Notes (GRN)',
  subtitle: 'Physical intake verification, roll/taka breakdown, 3-way matching (PO ⇄ GRN ⇄ Bill), and QC checkpoint.',
  purpose: 'Every purchase order and delivery from suppliers/mills is received through physical GRN verification. This screen captures taka rolls per line, compares received meters against ordered PO meterage, records shortage/excess, and routes goods to QC inspection before stock release.',
  keyTerms: [
    { term: 'GRN (Goods Receipt Note)', definition: 'The physical intake document capturing roll-by-roll actual meters, kg, width, and lot numbers.' },
    { term: 'Taka / Roll Breakdown', definition: 'The individual roll meters and weights that must sum exactly to the line received quantity.' },
    { term: 'Shortage / Excess', definition: 'Difference between PO ordered meterage and supplier delivered meterage.' },
  ],
  tips: [
    'You can create a standalone GRN directly against a PO using "+ New GRN Intake".',
    'Taka quantities must add up to the line received quantity before submitting.',
    'Received goods enter QC Hold until QC inspection releases them to the target godown.',
  ],
  workflow: ['PO Issued', 'Supplier Delivers with Challan', 'GRN Created with Taka Breakdown', 'QC Inspection', 'Stock Released to Godown'],
};

export const GoodsReceiptPage = () => {
  const {
    purchaseBills,
    purchaseOrders = [],
    vendors = [],
    items: masterItems = [],
    locations = [],
    receivePurchaseBillGoods,
    refreshCollections,
    formatCurrency,
    formatDateDDMMYYYY,
  } = useERP();
  const { units } = useUnits();

  const lineUnit = (it) => it.uom || it.unit || 'MTR';
  const unitTotals = (lines, qtyOf) => formatUnitTotals(sumByUnit(lines, { qty: qtyOf, uom: lineUnit, units }), { units });

  // Tab state: 'pending' (bills awaiting receipt) | 'receipts' (completed GRN register)
  const [activeTab, setActiveTab] = useState('pending');
  const [grnList, setGrnList] = useState([]);
  const [viewGrn, setViewGrn] = useState(null);
  const [loadingGrns, setLoadingGrns] = useState(false);
  const [grnSearch, setGrnSearch] = useState('');

  // Bill-receive modal state (legacy / bill-first)
  const [selectedBill, setSelectedBill] = useState(null);
  const [receivedQtys, setReceivedQtys] = useState({});
  const [receivedWeights, setReceivedWeights] = useState({});
  const [qcStatus, setQcStatus] = useState('Approved');
  const [note, setNote] = useState('');

  // Standalone GRN Modal State (Phase 2.2)
  const location = useLocation();
  const navigate = useNavigate();
  const [standaloneModalOpen, setStandaloneModalOpen] = useState(false);
  // One key per opened form: a double-clicked Save replays, never posts twice.
  const [grnIdempotencyKey, setGrnIdempotencyKey] = useState('');
  const [standaloneSubmitting, setStandaloneSubmitting] = useState(false);
  const [standaloneError, setStandaloneError] = useState('');
  const [standaloneSuccess, setStandaloneSuccess] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const [standaloneForm, setStandaloneForm] = useState({
    vendorId: '',
    poId: '',
    supplierChallanNo: '',
    supplierChallanDate: todayStr,
    receiptDate: todayStr,
    locationId: '',
    lines: [],
  });

  // Fetch completed GRNs from backend
  const fetchGrns = useCallback(async () => {
    setLoadingGrns(true);
    try {
      const res = await api.get('/purchase/receipts/');
      const rows = Array.isArray(res) ? res : (res?.results || res?.rows || []);
      // The API answers in camelCase (grnNumber, receiptDate, ...); this page
      // reads the snake_case names, so fill those from the camelCase ones.
      setGrnList(rows.map((r) => ({
        ...r,
        grn_number: r.grnNumber ?? r.grn_number,
        receipt_date: r.receiptDate ?? r.receipt_date,
        supplier_challan_no: r.supplierChallanNo ?? r.supplier_challan_no,
        qc_status: r.qcStatus ?? r.qc_status,
      })));
    } catch (err) {
      console.error('Failed to fetch GRN list:', err);
      setGrnList([]);
    } finally {
      setLoadingGrns(false);
    }
  }, []);

  useEffect(() => {
    fetchGrns();
  }, [fetchGrns]);

  // Set default location once locations are loaded
  useEffect(() => {
    if (locations?.length > 0 && !standaloneForm.locationId) {
      setStandaloneForm((prev) => ({ ...prev, locationId: locations[0].id }));
    }
  }, [locations, standaloneForm.locationId]);

  // Pending receipts from bills
  const pendingReceipts = (purchaseBills || []).filter((b) => b.goodsReceived !== true && b.status !== 'Cancelled');
  const receivedCount = grnList.length || (purchaseBills || []).filter((b) => b.goodsReceived === true).length;
  const pendingQtyText = unitTotals(pendingReceipts.flatMap((b) => b.items || []), (it) => Number(it.qty) || 0);
  const pendingValue = pendingReceipts.reduce((sum, b) => sum + (Number(b.total ?? b.amount) || 0), 0);

  // Weight metadata helper
  const getLineWeightMeta = (line) => {
    const masterObj = line?.itemId
      ? masterItems.find((mi) => mi.id === line.itemId || mi.sku === line.sku)
      : null;
    return {
      isWeightItem: Boolean(line.isWeightItem) || Boolean(masterObj?.isWeightItem),
      theoreticalWeight: Number(line.theoreticalWeight ?? masterObj?.theoreticalWeight ?? 0) || 0,
      tolerancePct: line.tolerancePct !== undefined ? Number(line.tolerancePct) : (masterObj?.tolerancePct !== undefined ? Number(masterObj.tolerancePct) : 2),
      weightUnit: line.weightUnit || masterObj?.weightUnit || 'kg',
    };
  };

  // Weight-variation history
  const variationHistory = (purchaseBills || [])
    .filter((b) => b.goodsReceived === true && b.items?.some((it) => it.variationPct !== undefined && it.variationPct !== null))
    .flatMap((b) => (b.items || [])
      .filter((it) => it.variationPct !== undefined && it.variationPct !== null)
      .map((it) => ({
        billNumber: b.billNumber,
        vendor: b.vendor,
        receivedDate: b.receivedDate,
        itemName: it.name || it.description,
        sku: it.sku || it.itemSku,
        orderedQty: it.orderedQty ?? it.qty,
        receivedQty: it.receivedQty ?? it.qty,
        uom: it.uom || it.unit || '',
        orderedWeight: Number(it.theoreticalWeight || 0) * Number((it.orderedQty ?? it.qty) || 0),
        receivedWeight: Number(it.receivedWeight || 0),
        variationPct: Number(it.variationPct || 0),
        tolerancePct: it.tolerancePct,
      })))
    .sort((a, b2) => (b2.receivedDate || '').localeCompare(a.receivedDate || ''));

  // Open Legacy Receive Modal
  const openReceiveModal = (bill) => {
    setSelectedBill(bill);
    const initial = {};
    const initialWeights = {};
    (bill.items || []).forEach((it, idx) => {
      const key = it.id || `line-${idx}`;
      initial[key] = Number(it.qty || 0);
      const meta = getLineWeightMeta(it);
      initialWeights[key] = it.receivedWeight || (meta.isWeightItem ? Number((meta.theoreticalWeight || 0) * Number(it.qty || 1)) : undefined);
    });
    setReceivedQtys(initial);
    setReceivedWeights(initialWeights);
    setQcStatus('Approved');
    setNote('');
  };

  const confirmReceipt = () => {
    if (!selectedBill) return;
    const overrides = (selectedBill.items || []).map((it, idx) => {
      const key = it.id || `line-${idx}`;
      const meta = getLineWeightMeta(it);
      return {
        lineIndex: idx,
        lineId: it.id,
        sku: it.sku || it.itemSku,
        receivedQty: Number(receivedQtys[key] || 0) || 0,
        receivedWeight: meta.isWeightItem ? (Number(receivedWeights[key]) > 0 ? Number(receivedWeights[key]) : undefined) : undefined,
      };
    });
    receivePurchaseBillGoods(selectedBill.id, overrides, qcStatus);
    setSelectedBill(null);
    fetchGrns();
  };

  // ── Standalone GRN Form Handlers (Phase 2.2) ──
  const openStandaloneModal = (prefill = {}) => {
    setStandaloneError('');
    setStandaloneSuccess('');
    setGrnIdempotencyKey(
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `grn-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const defaultLoc = locations?.[0]?.id || '';
    setStandaloneForm({
      vendorId: prefill.vendorId || '',
      poId: '',
      supplierChallanNo: '',
      supplierChallanDate: todayStr,
      receiptDate: todayStr,
      locationId: defaultLoc,
      // Lines start empty; lot numbers are allocated by the server (LOT
      // series) unless the supplier's own lot number is typed in.
      lines: [],
    });
    setStandaloneModalOpen(true);
  };

  // Only approved ready grey stock POs are received here; Vendor A
  // production POs go through daily production entry instead.
  const availableVendorPos = useMemo(() => {
    if (!standaloneForm.vendorId) return [];
    return purchaseOrders.filter(
      (po) => String(po.vendorId || po.partyId) === String(standaloneForm.vendorId)
        && ['Grey Stock Purchase', 'Ready Grey Fabric Purchase', 'Ready Grey', 'Grey Fabric'].includes(po.purchaseType || 'Grey Stock Purchase')
        && ['Approved', 'Partially Received', 'Fully Received', 'Issued'].includes(po.status)
    );
  }, [purchaseOrders, standaloneForm.vendorId]);

  const handleVendorSelect = (vendorId) => {
    setStandaloneForm((prev) => ({
      ...prev,
      vendorId,
      poId: '',
      lines: [],
    }));
  };

  const handlePoSelect = (poId) => {
    if (!poId) {
      setStandaloneForm((prev) => ({ ...prev, poId: '', lines: [] }));
      return;
    }
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return;

    const poLines = (po.lineItems || po.items || []).map((it, idx) => {
      const remaining = Math.max(0, Number(it.qty || 0) - Number(it.receivedQty || 0));
      const targetQty = remaining > 0 ? remaining : Number(it.qty || 0);
      return {
        id: `line-${idx + 1}`,
        itemId: it.itemId || it.item_id || it.item,
        itemName: it.name || it.itemName || it.description || '',
        poLineId: it.id,
        orderedQty: Number(it.qty || 0),
        receivedQty: targetQty,
        unitCost: Number(it.rate || it.unitPrice || 0),
        uom: it.uom || '',
        batchNumber: '',
        fabricWidth: it.fabricWidth || '',
        remarks: '',
        takas: [
          { id: `t-${idx + 1}-1`, takaNumber: '1', qty: targetQty, weight: '', width: it.fabricWidth ? String(it.fabricWidth) : '', remarks: '' },
        ],
        showTakas: true,
      };
    });

    setStandaloneForm((prev) => ({
      ...prev,
      poId,
      lines: poLines,
    }));
  };

  // "Record GRN" on a purchase order lands here with that PO preselected.
  const grnForPo = location.state?.grnForPo;
  useEffect(() => {
    if (!grnForPo) return;
    const po = purchaseOrders.find((p) => p.id === grnForPo);
    if (!po) return; // the orders are still loading
    openStandaloneModal({ vendorId: po.vendorId || po.partyId });
    handlePoSelect(po.id);
    navigate(location.pathname, { replace: true, state: {} });
  }, [grnForPo, purchaseOrders]);

  const handleAddLine = () => {
    setStandaloneForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          id: `line-${Date.now()}`,
          itemId: '',
          itemName: '',
          poLineId: '',
          orderedQty: 0,
          receivedQty: 0,
          unitCost: 0,
          uom: '',
          batchNumber: '',
          fabricWidth: '',
          remarks: '',
          takas: [],
          showTakas: true,
        },
      ],
    }));
  };

  const handleRemoveLine = (lineId) => {
    setStandaloneForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.id !== lineId),
    }));
  };

  const handleUpdateLine = (lineId, field, val) => {
    setStandaloneForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, [field]: val };
        // If receivedQty changed and there's 1 taka, auto-sync its qty
        if (field === 'receivedQty' && updated.takas?.length === 1) {
          updated.takas = [{ ...updated.takas[0], qty: Number(val) || 0 }];
        }
        return updated;
      }),
    }));
  };

  const handleAddTaka = (lineId) => {
    setStandaloneForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.id !== lineId) return l;
        const nextNo = (l.takas?.length || 0) + 1;
        return {
          ...l,
          takas: [
            ...(l.takas || []),
            { id: `t-${Date.now()}`, takaNumber: String(nextNo), qty: '', weight: '', width: l.fabricWidth ? String(l.fabricWidth) : '', remarks: '' },
          ],
        };
      }),
    }));
  };

  const handleRemoveTaka = (lineId, takaId) => {
    setStandaloneForm((prev) => ({
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
    setStandaloneForm((prev) => ({
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
    const line = standaloneForm.lines.find((l) => l.id === lineId);
    if (!line) return;
    const countStr = window.prompt(`How many rolls to split ${line.receivedQty} meters into?`, '');
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
      width: line.fabricWidth ? String(line.fabricWidth) : '',
      remarks: '',
    }));

    setStandaloneForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === lineId ? { ...l, takas: newTakas } : l)),
    }));
  };

  const handleSubmitStandaloneGrn = async (e) => {
    e.preventDefault();
    setStandaloneError('');
    setStandaloneSubmitting(true);

    try {
      if (!standaloneForm.vendorId) throw new Error('Please select a supplier.');
      if (!standaloneForm.locationId) throw new Error('Please select a destination godown / location.');
      if (!standaloneForm.lines || standaloneForm.lines.length === 0) throw new Error('Add at least one line item.');

      // Validate each line
      for (let i = 0; i < standaloneForm.lines.length; i++) {
        const l = standaloneForm.lines[i];
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
        partyId: standaloneForm.vendorId,
        locationId: standaloneForm.locationId,
        purchaseOrderId: standaloneForm.poId || null,
        supplierChallanNo: standaloneForm.supplierChallanNo,
        supplierChallanDate: standaloneForm.supplierChallanDate || null,
        receiptDate: standaloneForm.receiptDate,
        lines: standaloneForm.lines.map((l) => ({
          itemId: l.itemId,
          poLineId: l.poLineId || null,
          orderedQty: Number(l.orderedQty) || 0,
          receivedQty: Number(l.receivedQty) || 0,
          unitCost: Number(l.unitCost) || 0,
          uom: l.uom || undefined,
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

      const res = await api.post('/purchase/receipts/', payload, { idempotencyKey: grnIdempotencyKey || undefined });
      setStandaloneSuccess(`GRN ${res.grnNumber || res.grn_number || res.id} created successfully! Stock moved to QC Hold.`);
      fetchGrns();
      // The PO's received quantity and status changed on the server.
      if (standaloneForm.poId) refreshCollections?.(['purchaseOrders']);
      setTimeout(() => {
        setStandaloneModalOpen(false);
        setActiveTab('receipts');
      }, 1200);
    } catch (err) {
      console.error('Standalone GRN creation failed:', err);
      setStandaloneError(err?.message || 'Failed to create Goods Receipt Note.');
    } finally {
      setStandaloneSubmitting(false);
    }
  };

  const filteredGrnList = useMemo(() => {
    if (!grnSearch.trim()) return grnList;
    const q = grnSearch.toLowerCase();
    return grnList.filter((g) =>
      (g.grn_number || '').toLowerCase().includes(q) ||
      (g.vendorName || '').toLowerCase().includes(q) ||
      (g.supplier_challan_no || '').toLowerCase().includes(q) ||
      (g.poNumber || '').toLowerCase().includes(q)
    );
  }, [grnList, grnSearch]);

  const [grnPage, setGrnPage] = useState(1);
  const [grnPageSize, setGrnPageSize] = useState(10);

  useEffect(() => {
    setGrnPage(1);
  }, [grnSearch]);

  const paginatedGrnList = useMemo(() => {
    const start = (grnPage - 1) * grnPageSize;
    return filteredGrnList.slice(start, start + grnPageSize);
  }, [filteredGrnList, grnPage, grnPageSize]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Receipt Notes (GRN)"
        subtitle="Physical intake verification, roll/taka capture, and 3-way matching"
        guide={goodsReceiptGuide}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => openStandaloneModal()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
            >
              <Plus size={14} /> New GRN Intake
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Awaiting Receipt" value={`${pendingReceipts.length} Bills`} icon={Truck} tone="amber" />
        <StatCard label="Pending Qty" value={pendingQtyText === '—' ? '0' : pendingQtyText} icon={Boxes} />
        <StatCard label="Receivable Value" value={formatCurrency(pendingValue)} icon={ClipboardCheck} tone="blue" />
        <StatCard label="Received GRNs" value={`${grnList.length} Notes`} icon={ShieldCheck} tone="green" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Pending Bills ({pendingReceipts.length})
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'receipts'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Completed GRN Register ({grnList.length})
        </button>
      </div>

      {/* TAB 1: Completed GRN Register */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#dce5f4] shadow-xs">
            <div className="relative w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search GRN, Supplier, Challan..."
                value={grnSearch}
                onChange={(e) => setGrnSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={fetchGrns}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 border border-slate-200"
              title="Refresh"
            >
              <RefreshCw size={13} className={loadingGrns ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#dce5f4] shadow-xs overflow-hidden">
            {loadingGrns ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading GRN notes...</div>
            ) : filteredGrnList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">No goods receipt notes recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">GRN #</th>
                      <th className="px-4 py-3">Receipt Date</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Supplier Challan #</th>
                      <th className="px-4 py-3">PO Number</th>
                      <th className="px-4 py-3 text-right">Lines</th>
                      <th className="px-4 py-3 text-center">QC Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedGrnList.map((g) => (
                      <tr key={g.id} onClick={() => setViewGrn(g)} className="hover:bg-slate-50/70 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setViewGrn(g); }}
                            className="font-mono font-bold text-blue-600 hover:underline"
                            title="View GRN details"
                          >
                            {g.grn_number}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{g.receipt_date}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{g.vendorName}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{g.supplier_challan_no || '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{g.poNumber || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{g.lines?.length || 0}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            g.qc_status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            g.qc_status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {g.qc_status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredGrnList.length > 0 && (
              <TablePagination
                total={filteredGrnList.length}
                page={grnPage}
                pageSize={grnPageSize}
                onPageChange={setGrnPage}
                onPageSizeChange={setGrnPageSize}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Pending Bills Awaiting Intake */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-xl border border-[#dce5f4] shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#1F2E4A]">Bills Awaiting Goods Receipt</h3>
            <span className="text-xs text-slate-500 font-mono">{pendingReceipts.length} pending</span>
          </div>
          {pendingReceipts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No bills awaiting physical receipt. All purchase bills have been checked in.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Bill Number</th>
                    <th className="py-2.5 px-4">Supplier</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4 text-right">Bill Items</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingReceipts.map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-50/70">
                      <td className="p-4 font-mono font-bold text-slate-800">{bill.billNumber}</td>
                      <td className="p-4 font-medium text-slate-900">{bill.vendor}</td>
                      <td className="p-4">{formatDateDDMMYYYY(bill.date)}</td>
                      <td className="p-4 text-right font-mono">{bill.items?.length || 0} lines</td>
                      <td className="p-4 text-right font-mono font-semibold text-slate-900">{formatCurrency(bill.total || bill.amount)}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => openReceiveModal(bill)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-xs"
                        >
                          Receive Goods
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Standalone GRN Modal (Phase 2.2 with Taka Breakdown) ── */}
      {standaloneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <PackageCheck size={16} className="text-blue-600" /> Standalone Goods Receipt Note (GRN)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Capture intake directly against supplier challan or purchase order with roll/taka breakdown</p>
              </div>
              <button
                onClick={() => setStandaloneModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitStandaloneGrn} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {standaloneError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={15} /> {standaloneError}
                </div>
              )}
              {standaloneSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2">
                  <CheckCircle2 size={15} /> {standaloneSuccess}
                </div>
              )}

              {/* Header Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Supplier / Mill *</label>
                    <MasterSourceLink source="vendors" />
                  </div>
                  <select
                    required
                    value={standaloneForm.vendorId}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select Supplier...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.code || 'Vendor'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Link Purchase Order (Optional)</label>
                  <select
                    value={standaloneForm.poId}
                    onChange={(e) => handlePoSelect(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Direct Receipt (No PO)</option>
                    {availableVendorPos.map((po) => (
                      <option key={po.id} value={po.id}>{po.poNumber || po.number} ({po.docDate || po.date})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Destination Godown *</label>
                    <MasterSourceLink source="godowns" />
                  </div>
                  <select
                    required
                    value={standaloneForm.locationId}
                    onChange={(e) => setStandaloneForm({ ...standaloneForm, locationId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:border-blue-500 focus:outline-none"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier Challan No *</label>
                  <input
                    type="text"
                    required
                    value={standaloneForm.supplierChallanNo}
                    onChange={(e) => setStandaloneForm({ ...standaloneForm, supplierChallanNo: e.target.value })}
                    placeholder="e.g. CH-2026/894"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier Challan Date</label>
                  <input
                    type="date"
                    value={standaloneForm.supplierChallanDate}
                    onChange={(e) => setStandaloneForm({ ...standaloneForm, supplierChallanDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    required
                    value={standaloneForm.receiptDate}
                    onChange={(e) => setStandaloneForm({ ...standaloneForm, receiptDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Lines and Takas Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Intake Line Items ({standaloneForm.lines.length})
                  </h4>
                  <div className="flex items-center gap-3">
                    <MasterSourceLink source="items" label="+ Add / Manage Items" />
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Plus size={13} /> Add Fabric Line
                    </button>
                  </div>
                </div>

                {standaloneForm.lines.map((line, lIdx) => {
                  const shortage = Math.max(0, Number(line.orderedQty || 0) - Number(line.receivedQty || 0));
                  const excess = Math.max(0, Number(line.receivedQty || 0) - Number(line.orderedQty || 0));
                  const takaSum = (line.takas || []).reduce((s, t) => s + (Number(t.qty) || 0), 0);
                  const takaDiff = Math.round((Number(line.receivedQty || 0) - takaSum) * 100) / 100;
                  const takaMatch = Math.abs(takaDiff) < 0.001;

                  return (
                    <div key={line.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3">
                      {/* Line Overview Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fabric Item *</label>
                          {standaloneForm.poId && line.itemName ? (
                            <div className="px-3 py-1.5 bg-slate-100 rounded-lg font-medium text-slate-800 border border-slate-200 truncate">
                              {line.itemName}
                            </div>
                          ) : (
                            <select
                              value={line.itemId}
                              onChange={(e) => handleUpdateLine(line.id, 'itemId', e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:border-blue-500 focus:outline-none"
                            >
                              <option value="">Select item...</option>
                              {masterItems.map((it) => (
                                <option key={it.id} value={it.id}>{it.name} ({it.sku || 'Fabric'})</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">PO Ordered</label>
                          <input
                            type="number"
                            readOnly={Boolean(standaloneForm.poId)}
                            value={line.orderedQty}
                            onChange={(e) => handleUpdateLine(line.id, 'orderedQty', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-700"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Received (m) *</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={line.receivedQty}
                            onChange={(e) => handleUpdateLine(line.id, 'receivedQty', e.target.value)}
                            className="w-full px-3 py-1.5 border border-blue-400 rounded-lg bg-white font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Batch / Lot #</label>
                          <input
                            type="text"
                            value={line.batchNumber}
                            placeholder="Auto (server)"
                            onChange={(e) => handleUpdateLine(line.id, 'batchNumber', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono uppercase text-xs"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Width (in)</label>
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

                      {/* Variance Indicator */}
                      {Number(line.orderedQty) > 0 && (
                        <div className="flex items-center gap-3 text-[11px] pt-1">
                          <span className="text-slate-500 font-medium">Variance vs PO:</span>
                          {shortage > 0 ? (
                            <span className="text-amber-600 font-semibold flex items-center gap-1">
                              ⚠️ Shortage: {numIN(shortage)} m ({Math.round((shortage / line.orderedQty) * 100)}%)
                            </span>
                          ) : excess > 0 ? (
                            <span className="text-blue-600 font-semibold flex items-center gap-1">
                              ℹ️ Excess: +{numIN(excess)} m ({Math.round((excess / line.orderedQty) * 100)}%)
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">✓ Exact match with PO</span>
                          )}
                        </div>
                      )}

                      {/* Taka Breakdown Sub-Table */}
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700 text-[11px] flex items-center gap-1.5">
                            <Layers size={13} className="text-blue-600" /> Taka / Roll Breakdown ({line.takas?.length || 0} rolls)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAutoSplitTakas(line.id)}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline"
                            >
                              Auto Split
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddTaka(line.id)}
                              className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs"
                            >
                              <Plus size={11} /> Add Taka
                            </button>
                          </div>
                        </div>

                        {/* Takas Grid */}
                        <div className="space-y-1.5">
                          {(line.takas || []).map((t, tIdx) => (
                            <div key={t.id} className="grid grid-cols-12 gap-2 items-center text-xs">
                              <div className="col-span-2">
                                <input
                                  type="text"
                                  placeholder="Roll #"
                                  value={t.takaNumber}
                                  onChange={(e) => handleUpdateTaka(line.id, t.id, 'takaNumber', e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-200 rounded bg-white font-mono text-[11px]"
                                />
                              </div>
                              <div className="col-span-3">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Meters *"
                                  value={t.qty}
                                  onChange={(e) => handleUpdateTaka(line.id, t.id, 'qty', e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-300 rounded bg-white font-mono font-semibold text-slate-800 text-[11px]"
                                />
                              </div>
                              <div className="col-span-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Weight (kg)"
                                  value={t.weight || ''}
                                  onChange={(e) => handleUpdateTaka(line.id, t.id, 'weight', e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-200 rounded bg-white font-mono text-[11px]"
                                />
                              </div>
                              <div className="col-span-4">
                                <input
                                  type="text"
                                  placeholder="Remarks / Defect notes"
                                  value={t.remarks || ''}
                                  onChange={(e) => handleUpdateTaka(line.id, t.id, 'remarks', e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-[11px]"
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

                        {/* Taka Sum Validation Banner */}
                        <div className={`p-2 rounded flex items-center justify-between text-[11px] font-medium ${
                          takaMatch ? 'bg-emerald-100/60 text-emerald-800' : 'bg-amber-100/80 text-amber-900 border border-amber-300'
                        }`}>
                          <span>
                            Total Taka Rolls: <strong>{line.takas?.length || 0}</strong> • Sum: <strong>{numIN(takaSum)} m</strong>
                          </span>
                          {takaMatch ? (
                            <span className="font-semibold text-emerald-700">✓ Matches line quantity ({numIN(line.receivedQty)} m)</span>
                          ) : (
                            <span className="font-bold text-amber-800">
                              ⚠️ Difference: {takaDiff > 0 ? `-${numIN(takaDiff)} m remaining` : `+${numIN(Math.abs(takaDiff))} m excess`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStandaloneModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={standaloneSubmitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={15} />
                  {standaloneSubmitting ? 'Recording GRN...' : 'Submit GRN Intake'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bill-scoped Receive Modal (Legacy) ── */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Goods Intake: {selectedBill.billNumber}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedBill.vendor} • {formatDateDDMMYYYY(selectedBill.date)}</p>
              </div>
              <button onClick={() => setSelectedBill(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="space-y-3">
                {(selectedBill.items || []).map((it, idx) => {
                  const key = it.id || `line-${idx}`;
                  return (
                    <div key={key} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{it.name || it.description}</div>
                        <span className="text-[11px] text-slate-500">Ordered: {it.qty} {it.uom || it.unit}</span>
                      </div>
                      <div className="w-32">
                        <label className="block text-[10px] text-slate-500 mb-0.5">Received Qty</label>
                        <input
                          type="number"
                          step="0.01"
                          value={receivedQtys[key] ?? it.qty}
                          onChange={(e) => setReceivedQtys({ ...receivedQtys, [key]: Number(e.target.value) })}
                          className="w-full px-2.5 py-1 border border-slate-300 rounded bg-white font-mono font-bold"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => setSelectedBill(null)} className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg">Cancel</button>
                <button onClick={confirmReceipt} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">Confirm Receipt</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewGrn && <GrnDetailDrawer grn={viewGrn} onClose={() => setViewGrn(null)} />}
    </div>
  );
};

export default GoodsReceiptPage;