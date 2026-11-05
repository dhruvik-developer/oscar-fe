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
  Package,
  Building2,
  RefreshCw,
  Search,
} from 'lucide-react';
import api from '../../services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { numIN } from '../../utils/formatters';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import GrnDetailDrawer from './GrnDetailDrawer';
import { ReceiptTypeNotice } from './DyeingColourField';

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

  // Tab state: 'receipts' (completed GRN register) | 'orders' (POs awaiting intake) | 'pending' (bills awaiting receipt)
  const [activeTab, setActiveTab] = useState('receipts');
  const [grnList, setGrnList] = useState([]);
  const [totalGrnCount, setTotalGrnCount] = useState(0);
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
      const res = await api.get('/purchase/receipts/?page_size=1000');
      const rows = Array.isArray(res) ? res : (res?.results || res?.rows || []);
      setTotalGrnCount(res?.count ?? rows.length);
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
      setTotalGrnCount(0);
    } finally {
      setLoadingGrns(false);
    }
  }, []);

  useEffect(() => {
    fetchGrns();
    if (typeof refreshCollections === 'function') {
      refreshCollections(['purchaseOrders', 'purchaseBills']);
    }
  }, [fetchGrns, refreshCollections]);

  // Set default location once locations are loaded
  useEffect(() => {
    if (locations?.length > 0 && !standaloneForm.locationId) {
      setStandaloneForm((prev) => ({ ...prev, locationId: locations[0].id }));
    }
  }, [locations, standaloneForm.locationId]);

  // Pending receipts from active Purchase Orders awaiting receipt (standard ERP flow)
  const pendingPOs = useMemo(() => {
    return (purchaseOrders || []).filter((po) => {
      if (['Draft', 'Cancelled'].includes(po.status)) return false;
      const lines = po.lineItems || po.items || [];
      const ordered = lines.reduce((sum, l) => sum + (Number(l.qty ?? l.orderedQty) || 0), 0);
      const received = lines.reduce((sum, l) => sum + (Number(l.receivedQty ?? l.received_qty) || 0), 0);
      return ordered > 0 && received < ordered;
    });
  }, [purchaseOrders]);

  const pendingPoLines = useMemo(() => {
    return pendingPOs.flatMap((po) =>
      (po.lineItems || po.items || []).map((l) => {
        const ordered = Number(l.qty ?? l.orderedQty ?? 0);
        const received = Number(l.receivedQty ?? l.received_qty ?? 0);
        const remaining = Math.max(0, ordered - received);
        const rate = Number(l.rate ?? l.price ?? 0);
        return {
          ...l,
          qty: remaining,
          uom: l.uom || l.unit || 'MTR',
          value: remaining * rate,
        };
      })
    ).filter((l) => l.qty > 0);
  }, [pendingPOs]);

  // Legacy pending receipts from bills
  // A bill whose PO already has a GRN has nothing left to receive: goods come in
  // through the GRN, and this list is only for bills raised without one.
  const pendingReceipts = useMemo(() => {
    return (purchaseBills || []).filter(
      (b) => b.goodsReceived !== true && b.status !== 'Cancelled' && !b.poAlreadyReceived,
    );
  }, [purchaseBills]);

  // Combined metrics across pending POs and pending bills
  const pendingIntakeLabel = pendingPOs.length > 0
    ? `${pendingPOs.length} ${pendingPOs.length === 1 ? 'Order' : 'Orders'}`
    : `${pendingReceipts.length} ${pendingReceipts.length === 1 ? 'Bill' : 'Bills'}`;

  const allPendingLines = useMemo(() => {
    const billLines = pendingReceipts.flatMap((b) => b.items || []);
    return [...pendingPoLines, ...billLines];
  }, [pendingPoLines, pendingReceipts]);

  const pendingQtyText = useMemo(() => {
    if (allPendingLines.length === 0) return '0 MTR';
    const formatted = unitTotals(allPendingLines, (it) => Number(it.qty) || 0);
    return !formatted || formatted === '—' ? '0 MTR' : formatted;
  }, [allPendingLines, unitTotals]);

  const pendingValue = useMemo(() => {
    const poVal = pendingPoLines.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    const billVal = pendingReceipts.reduce((sum, b) => sum + (Number(b.total ?? b.amount) || 0), 0);
    return poVal + billVal;
  }, [pendingPoLines, pendingReceipts]);

  const totalGrnDisplayCount = totalGrnCount || grnList.length;

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

  const resolveMasterItemId = useCallback((it, poRef) => {
    let resolvedId = it?.itemId || it?.item_id || (typeof it?.item === 'string' ? it.item : it?.item?.id) || '';
    if (!resolvedId && masterItems?.length) {
      const candidates = [
        it?.name,
        it?.itemName,
        it?.fabric,
        it?.description,
        poRef?.fabric,
        poRef?.fabricItem,
      ].filter(Boolean);

      for (const raw of candidates) {
        const trimmed = String(raw).trim().toLowerCase();
        let match = masterItems.find(
          (m) => String(m.id) === String(raw) ||
                 (m.name && m.name.trim().toLowerCase() === trimmed) ||
                 (m.sku && m.sku.trim().toLowerCase() === trimmed) ||
                 (m.itemCode && m.itemCode.trim().toLowerCase() === trimmed)
        );
        if (!match) {
          match = masterItems.find(
            (m) => m.name && (trimmed.includes(m.name.trim().toLowerCase()) || m.name.trim().toLowerCase().includes(trimmed))
          );
        }
        if (match) {
          resolvedId = match.id;
          break;
        }
      }
    }
    return resolvedId;
  }, [masterItems]);

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
    const po = purchaseOrders.find((p) => String(p.id) === String(poId));
    if (!po) return;

    const poLines = (po.lineItems || po.items || []).map((it, idx) => {
      const lineOrdered = Number(it.qty ?? it.orderedQty ?? 0);
      const lineReceived = Number(it.receivedQty ?? 0);
      const remaining = Math.max(0, lineOrdered - lineReceived);
      const targetQty = remaining > 0 ? remaining : lineOrdered;
      const itemId = resolveMasterItemId(it, po);
      return {
        id: `line-${idx + 1}`,
        itemId,
        itemName: it.name || it.itemName || it.fabric || it.description || (masterItems.find((m) => m.id === itemId)?.name) || '',
        poLineId: it.id,
        orderedQty: lineOrdered,
        remainingQty: remaining,
        receivedQty: targetQty > 0 ? targetQty : '',
        unitCost: Number(it.rate || it.unitPrice || 0) > 0 ? Number(it.rate || it.unitPrice || 0) : '',
        poRate: Number(it.rate || it.unitPrice || 0),
        totalCost: targetQty > 0 && Number(it.rate || it.unitPrice || 0) > 0 ? Math.round(targetQty * Number(it.rate || it.unitPrice) * 100) / 100 : '',
        uom: it.uom || '',
        batchNumber: '',
        fabricWidth: it.fabricWidth || '',
        remarks: '',
      };
    });

    setStandaloneForm((prev) => ({
      ...prev,
      poId,
      lines: poLines,
    }));
  };

  useEffect(() => {
    if (masterItems?.length > 0 && standaloneForm.lines.some((l) => !l.itemId)) {
      setStandaloneForm((prev) => ({
        ...prev,
        lines: prev.lines.map((l) => {
          if (l.itemId) return l;
          const resolvedId = resolveMasterItemId(l, purchaseOrders.find((p) => String(p.id) === String(prev.poId)));
          return resolvedId ? { ...l, itemId: resolvedId } : l;
        }),
      }));
    }
  }, [masterItems, standaloneForm.lines, standaloneForm.poId, purchaseOrders, resolveMasterItemId]);

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
          receivedQty: '',
          unitCost: '',
          poRate: 0,
          totalCost: '',
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
        if (field === 'receivedQty') {
          const rQty = Number(val) || 0;
          const uCost = Number(updated.unitCost) || 0;
          if (uCost > 0 && rQty > 0) {
            updated.totalCost = Math.round(rQty * uCost * 100) / 100;
          }
        } else if (field === 'unitCost') {
          const uCost = Number(val) || 0;
          const rQty = Number(updated.receivedQty) || 0;
          if (rQty > 0 && val !== '') {
            updated.totalCost = Math.round(rQty * uCost * 100) / 100;
          }
        } else if (field === 'totalCost') {
          const tCost = Number(val) || 0;
          const rQty = Number(updated.receivedQty) || 0;
          if (rQty > 0 && val !== '') {
            updated.unitCost = Math.round((tCost / rQty) * 100) / 100;
          }
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
        if (!l.itemId) {
          l.itemId = resolveMasterItemId(l, purchaseOrders.find((p) => String(p.id) === String(standaloneForm.poId)));
        }
        if (!l.itemId && masterItems.length === 1) {
          l.itemId = masterItems[0].id;
        }
        if (!l.itemId) throw new Error(`Line ${i + 1}: Select the item received.`);
        if (!(rQty > 0)) throw new Error(`Line ${i + 1}: Received quantity must be greater than zero.`);


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
          totalCost: Number(l.totalCost) || (Number(l.receivedQty) * Number(l.unitCost)) || 0,
          uom: l.uom || undefined,
          batchNumber: l.batchNumber || undefined,
          fabricWidth: l.fabricWidth ? Number(l.fabricWidth) : null,
          remarks: l.remarks || '',
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
  const [grnPageSize, setGrnPageSize] = useState(25);

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
        <StatCard
          label="Awaiting Receipt"
          value={pendingIntakeLabel}
          icon={Truck}
          tone="amber"
          note={pendingPOs.length > 0 ? `${pendingPOs.length} POs pending intake` : undefined}
          onClick={() => setActiveTab('orders')}
          className="cursor-pointer hover:shadow-md transition"
        />
        <StatCard
          label="Pending Qty"
          value={pendingQtyText}
          icon={Boxes}
          tone="blue"
        />
        <StatCard
          label="Receivable Value"
          value={formatCurrency(pendingValue)}
          icon={ClipboardCheck}
          tone="blue"
        />
        <StatCard
          label="Received GRNs"
          value={`${totalGrnDisplayCount} Notes`}
          icon={ShieldCheck}
          tone="green"
          onClick={() => setActiveTab('receipts')}
          className="cursor-pointer hover:shadow-md transition"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('receipts')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'receipts'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Completed GRN Register ({totalGrnDisplayCount})
        </button>
        {pendingPOs.length > 0 && (
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'orders'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Orders Awaiting Receipt ({pendingPOs.length})
          </button>
        )}
        {pendingReceipts.length > 0 && (
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
        )}
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

      {/* TAB 3: Purchase Orders Awaiting Intake */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl border border-[#dce5f4] shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[#1F2E4A]">Purchase Orders Awaiting Goods Receipt</h3>
              <p className="text-xs text-slate-500 mt-0.5">Approved purchase orders with remaining unreceived meterage</p>
            </div>
            <span className="text-xs text-slate-600 font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-semibold">
              {pendingPOs.length} orders pending
            </span>
          </div>
          {pendingPOs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No purchase orders awaiting intake. All approved orders are fully received.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">PO Number</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Supplier / Mill</th>
                    <th className="py-2.5 px-4">Fabric / Item</th>
                    <th className="py-2.5 px-4 text-right">Ordered Qty</th>
                    <th className="py-2.5 px-4 text-right">Received Qty</th>
                    <th className="py-2.5 px-4 text-right">Remaining</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingPOs.map((po) => {
                    const lines = po.lineItems || po.items || [];
                    const ordered = lines.reduce((sum, l) => sum + (Number(l.qty ?? l.orderedQty) || 0), 0);
                    const received = lines.reduce((sum, l) => sum + (Number(l.receivedQty ?? l.received_qty) || 0), 0);
                    const remaining = Math.max(0, ordered - received);
                    const fabricName = lines[0]?.fabricQualityName || lines[0]?.itemName || lines[0]?.name || lines[0]?.description || '—';
                    const uom = lines[0]?.uom || 'MTR';
                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4 font-mono font-bold text-blue-600">{po.poNumber}</td>
                        <td className="p-4 text-slate-700">{formatDateDDMMYYYY(po.date || po.docDate || po.createdAt)}</td>
                        <td className="p-4 font-medium text-slate-900">{po.vendorName || po.partyName || '—'}</td>
                        <td className="p-4 text-slate-800">{fabricName}{lines.length > 1 ? ` (+${lines.length - 1} more)` : ''}</td>
                        <td className="p-4 text-right font-mono text-slate-700">{numIN(ordered)} {uom}</td>
                        <td className="p-4 text-right font-mono text-emerald-700 font-semibold">{numIN(received)} {uom}</td>
                        <td className="p-4 text-right font-mono text-amber-700 font-bold bg-amber-50/50">{numIN(remaining)} {uom}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            po.status === 'Partially Received'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              openStandaloneModal({ vendorId: po.vendorId || po.partyId });
                              handlePoSelect(po.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs transition"
                          >
                            <PackageCheck size={13} /> Receive GRN
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
                  <div className="mt-1.5 empty:hidden">
                    <ReceiptTypeNotice po={purchaseOrders.find((p) => String(p.id) === String(standaloneForm.poId))} />
                  </div>
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
                          {standaloneForm.poId && line.itemName && line.itemId ? (
                            <div className="px-3 py-1.5 bg-slate-100 rounded-lg font-medium text-slate-800 border border-slate-200 truncate flex items-center justify-between">
                              <span className="truncate">{line.itemName}</span>
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-medium shrink-0 ml-1">Linked</span>
                            </div>
                          ) : (
                            <div>
                              <select
                                value={line.itemId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const matched = masterItems.find((m) => String(m.id) === String(val));
                                  handleUpdateLine(line.id, 'itemId', val);
                                  if (matched && !line.itemName) handleUpdateLine(line.id, 'itemName', matched.name);
                                }}
                                className={`w-full px-3 py-1.5 border rounded-lg bg-white font-medium focus:border-blue-500 focus:outline-none ${
                                  !line.itemId && standaloneForm.poId ? 'border-amber-400 bg-amber-50/20' : 'border-slate-300'
                                }`}
                              >
                                <option value="">Select item...</option>
                                {masterItems.map((it) => (
                                  <option key={it.id} value={it.id}>{it.name} ({it.sku || 'Fabric'})</option>
                                ))}
                              </select>
                              {standaloneForm.poId && line.itemName && !line.itemId && (
                                <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                                  PO Fabric: <strong>{line.itemName}</strong> (Please map item)
                                </div>
                              )}
                            </div>
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
                          {Boolean(standaloneForm.poId) && typeof line.remainingQty !== 'undefined' && (
                            <div className="mt-1">
                              {line.remainingQty > 0 ? (
                                <span className="text-[10px] font-bold text-emerald-700">{line.remainingQty} {line.uom || 'm'} remaining</span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                  Reprocess / Replacement
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="sm:col-span-3">
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

                      {/* Dedicated Batch & Costing Row (Ek batch kitne me padi) */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-2.5 bg-blue-50/40 rounded-xl border border-blue-200/70 shadow-2xs">
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Batch / Lot #</label>
                          <input
                            type="text"
                            value={line.batchNumber}
                            placeholder="Auto (server)"
                            onChange={(e) => handleUpdateLine(line.id, 'batchNumber', e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono uppercase text-xs"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span>Rate (₹ / meter)</span>
                            {Number(line.poRate) > 0 && (
                              <span className="text-[9.5px] text-slate-400 font-normal">PO: ₹{line.poRate}</span>
                            )}
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-bold text-xs pointer-events-none">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={line.unitCost !== undefined && line.unitCost !== '' ? line.unitCost : ''}
                              placeholder="0.00"
                              onChange={(e) => handleUpdateLine(line.id, 'unitCost', e.target.value)}
                              className="w-full pl-6 pr-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-5">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-blue-900 flex items-center gap-1">
                              <span>Batch Cost (₹)</span>
                              <span className="text-[10px] text-blue-600 font-normal">(Rupees me kitne me padi)</span>
                            </label>
                            {Number(line.receivedQty) > 0 && Number(line.unitCost) > 0 && (
                              <span className="text-[10px] text-blue-700 font-bold font-mono">
                                {Number(line.receivedQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })} m × ₹{Number(line.unitCost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-blue-600 font-bold text-sm pointer-events-none">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={
                                line.totalCost !== undefined && line.totalCost !== ''
                                  ? line.totalCost
                                  : (Number(line.receivedQty) > 0 && Number(line.unitCost) > 0)
                                  ? (Math.round(Number(line.receivedQty) * Number(line.unitCost) * 100) / 100)
                                  : ''
                              }
                              placeholder="0.00"
                              onChange={(e) => handleUpdateLine(line.id, 'totalCost', e.target.value)}
                              className="w-full pl-7 pr-3 py-1.5 border-2 border-blue-400 bg-white rounded-lg font-mono text-xs font-black text-blue-900 focus:border-blue-600 focus:outline-none shadow-2xs"
                            />
                          </div>
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

                      {/* Clean Batch Details Section (Batch-Wise Receiving Only) */}
                      <div className="bg-slate-50/90 rounded-xl p-3.5 border border-blue-200/80 space-y-3 mt-2 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                          <span className="font-extrabold text-[#17294e] text-xs flex items-center gap-1.5">
                            <Package size={14} className="text-blue-700" />
                            Batch Details — Auto-Generated Batch
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100/70 text-blue-800 font-bold">
                            Batch Number: Auto (assigned on save)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fabric / Item</span>
                            <span className="mt-1 block font-bold text-slate-800 text-xs truncate" title={line.itemName}>
                              {line.itemName}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Actual Rate per Meter (₹)</span>
                            <div className="relative mt-1">
                              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-bold pointer-events-none text-xs">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={line.unitCost ?? ''}
                                onChange={(e) => {
                                  const newRate = e.target.value === '' ? '' : Number(e.target.value);
                                  const rQty = Number(line.receivedQty) || 0;
                                  const newTotal = newRate !== '' ? Math.round(rQty * Number(newRate) * 100) / 100 : '';
                                  handleUpdateLine(line.id, 'unitCost', newRate);
                                  handleUpdateLine(line.id, 'totalCost', newTotal);
                                }}
                                className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Batch Total Amount</span>
                            <div className="mt-1 p-1.5 px-3 rounded-lg border-2 border-emerald-400 bg-emerald-50/80 flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-emerald-800">Batch Total:</span>
                              <span className="font-mono text-sm font-black text-emerald-950 tabular-nums">
                                ₹{((Number(line.receivedQty) || 0) * (Number(line.unitCost) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Batch Remarks / Notes</span>
                          <input
                            type="text"
                            placeholder="e.g. Batch quality observations or delivery remarks"
                            value={line.remarks || ''}
                            onChange={(e) => handleUpdateLine(line.id, 'remarks', e.target.value)}
                            className="mt-1 w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                          />
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