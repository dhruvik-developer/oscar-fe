import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Pause,
  RotateCcw,
  Search,
  Filter,
  Download,
  Calendar,
  ChevronDown,
  ArrowRight,
  Eye,
  Clock,
  Layers,
  FileText,
  Printer,
  Check,
  X,
  AlertTriangle,
  Building2,
  TrendingDown,
  Info,
  RefreshCw,
  Plus,
  Users,
  Play,
  ChevronLeft,
  ChevronRight,
  Scale,
  Maximize2,
  Trash2,
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { useERP } from '../../../context/ERPContext';
import PageInfoButton from '../../../components/ui/PageInfoButton';

export default function QCPendingInspectionsPage() {
  const { purchaseBills = [], vendors = [], items = [], fabrics = [] } = useERP();

  // State
  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState([]);
  const [filtersData, setFiltersData] = useState({
    suppliers: [],
    qualities: [],
    designs: [],
    shades: [],
    inspectors: [],
  });

  // Filter State
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceType, setSourceType] = useState('All');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [selectedQuality, setSelectedQuality] = useState('All');
  const [selectedDesign, setSelectedDesign] = useState('All');
  const [selectedShade, setSelectedShade] = useState('All');

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [startModalItem, setStartModalItem] = useState(null);
  const [chosenInspector, setChosenInspector] = useState('');
  const [chosenInspectionDate, setChosenInspectionDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkInspector, setBulkInspector] = useState('');
  const [bulkShift, setBulkShift] = useState('');
  const [bulkDate, setBulkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [assigning, setAssigning] = useState(false);

  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [measuringItem, setMeasuringItem] = useState(null);
  const [takaMeasurements, setTakaMeasurements] = useState([]);
  const [qcGoodQty, setQcGoodQty] = useState('');
  const [qcHoldQty, setQcHoldQty] = useState('');
  const [qcReprocessQty, setQcReprocessQty] = useState('');
  const [qcRejectedQty, setQcRejectedQty] = useState('');
  const [qcRemarks, setQcRemarks] = useState('');
  const [completingInspection, setCompletingInspection] = useState(false);

  const [showViewDetailsModal, setShowViewDetailsModal] = useState(false);
  const [viewDetailsItem, setViewDetailsItem] = useState(null);

  const [toastMessage, setToastMessage] = useState(null);

  // Fetch Pending Inspections from Backend
  const fetchPendingData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getQCPending({
        date_from: dateFrom,
        date_to: dateTo,
        source_type: sourceType !== 'All' ? sourceType : undefined,
        supplier: selectedSupplier !== 'All' ? selectedSupplier : undefined,
        quality: selectedQuality !== 'All' ? selectedQuality : undefined,
        design: selectedDesign !== 'All' ? selectedDesign : undefined,
        shade: selectedShade !== 'All' ? selectedShade : undefined,
      });

      if (res && res.data) {
        setPendingList(res.data.pendingList || []);
        if (res.data.filters) setFiltersData((prev) => ({ ...prev, ...res.data.filters }));
      } else if (res && res.pendingList) {
        setPendingList(res.pendingList);
        if (res.filters) setFiltersData((prev) => ({ ...prev, ...res.filters }));
      } else {
        setPendingList([]);
      }
    } catch (err) {
      console.warn('Backend /inventory/qc/pending/ failed:', err);
      setPendingList([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, sourceType, selectedSupplier, selectedQuality, selectedDesign, selectedShade]);

  useEffect(() => {
    fetchPendingData();
  }, [fetchPendingData]);

  // Filtered List
  const filteredRows = useMemo(() => {
    return pendingList.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          String(r.refNo || '').toLowerCase().includes(q) ||
          String(r.supplier || '').toLowerCase().includes(q) ||
          String(r.itemCode || '').toLowerCase().includes(q) ||
          String(r.itemName || '').toLowerCase().includes(q) ||
          String(r.lotNo || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [pendingList, searchQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  // Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedRows.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk Assign Action
  const handleConfirmBulkAssign = async () => {
    const selectedRows = pendingList.filter((r) => selectedIds.has(r.id));
    const receiptIds = selectedRows.map((r) => r.receiptId).filter(Boolean);
    setAssigning(true);
    try {
      if (receiptIds.length > 0) {
        await inventoryService.bulkAssignQC({
          receiptIds,
          inspector: bulkInspector,
          shift: bulkShift,
          inspectionDate: bulkDate,
        });
      }
      // Update local state
      setPendingList((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) ? { ...r, inspector: bulkInspector, shift: bulkShift } : r
        )
      );
      showToast(`Assigned ${selectedIds.size} inspections to ${bulkInspector} (${bulkShift}).`);
      setShowBulkAssignModal(false);
      setSelectedIds(new Set());
    } catch (err) {
      alert('Could not bulk assign: ' + (err.message || 'Error'));
    } finally {
      setAssigning(false);
    }
  };

  // Open Measurement / Entry Form
  const openMeasurementForm = (row) => {
    setMeasuringItem(row);
    setTakaMeasurements([]);
    // Default Good Qty to the entire pending / awaiting QC quantity
    const pending = Number(row?.pendingQty ?? row?.receivedQty ?? 0);
    setQcGoodQty(pending > 0 ? String(pending) : '');
    setQcHoldQty('');
    setQcReprocessQty('');
    setQcRejectedQty('');
    setQcRemarks('');
    setShowStartModal(false);
    setShowMeasurementModal(true);
  };

  // Add Taka Row in Measurement Form
  const handleAddTakaRow = () => {
    setTakaMeasurements((prev) => [
      ...prev,
      {
        sr: prev.length + 1,
        takaNo: prev.length + 1,
        actualQty: '',
        width: '',
        remarks: '',
      },
    ]);
  };

  // Update Taka Row
  const handleUpdateTaka = (idx, field, val) => {
    setTakaMeasurements((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t))
    );
  };

  // Helper calculations for measurement modal
  const awaitingQcQty = measuringItem ? Number(measuringItem.pendingQty ?? measuringItem.receivedQty ?? 0) : 0;
  const numGood = Number(qcGoodQty) || 0;
  const numHold = Number(qcHoldQty) || 0;
  const numReprocess = Number(qcReprocessQty) || 0;
  const numRejected = Number(qcRejectedQty) || 0;
  const totalAllocated = Number((numGood + numHold + numReprocess + numRejected).toFixed(4));
  const diffQty = Number((awaitingQcQty - totalAllocated).toFixed(4));
  const isQcBalanced = Math.abs(diffQty) < 0.001 && totalAllocated > 0;
  const measurementsSum = takaMeasurements.reduce((acc, t) => acc + (Number(t.actualQty) || 0), 0);

  const handlePassAll = () => {
    if (awaitingQcQty > 0) {
      setQcGoodQty(String(awaitingQcQty));
      setQcHoldQty('');
      setQcReprocessQty('');
      setQcRejectedQty('');
    }
  };

  const handlePutRemainingOnHold = () => {
    if (diffQty > 0) {
      const currentHold = Number(qcHoldQty) || 0;
      const newHold = Number((currentHold + diffQty).toFixed(4));
      setQcHoldQty(String(newHold));
    }
  };

  const handleApplyMeasurementsToGood = () => {
    if (measurementsSum > 0) {
      setQcGoodQty(String(measurementsSum));
    }
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    if (!measuringItem) return;
    try {
      const g = Number(qcGoodQty) || 0;
      const h = Number(qcHoldQty) || 0;
      const rep = Number(qcReprocessQty) || 0;
      const rej = Number(qcRejectedQty) || 0;
      await inventoryService.saveQCDisposition({
        receiptId: measuringItem.receiptId,
        billId: measuringItem.billId,
        goodQty: g,
        holdQty: h,
        reprocessQty: rep,
        rejectedQty: rej,
        remarks: qcRemarks,
        measurements: takaMeasurements,
        isDraft: true,
      });
      showToast(`QC draft saved for ${measuringItem.refNo}.`);
      setShowMeasurementModal(false);
    } catch (err) {
      alert('Could not save draft: ' + (err.message || 'Error'));
    }
  };

  // Submit Completed QC Inspection
  const handleCompleteInspection = async () => {
    if (!measuringItem) return;
    const g = Number(qcGoodQty) || 0;
    const h = Number(qcHoldQty) || 0;
    const rep = Number(qcReprocessQty) || 0;
    const rej = Number(qcRejectedQty) || 0;
    const sum = Number((g + h + rep + rej).toFixed(4));

    if (sum <= 0) {
      alert('Please enter disposition quantities before completing inspection.');
      return;
    }

    if (Math.abs(awaitingQcQty - sum) >= 0.001) {
      if (sum < awaitingQcQty) {
        const remaining = (awaitingQcQty - sum).toFixed(2);
        alert(
          `Disposition total (${sum} ${measuringItem.uom}) must equal the quantity awaiting QC (${awaitingQcQty} ${measuringItem.uom}).\n\nThere is still ${remaining} ${measuringItem.uom} unallocated. Please allocate the remaining quantity (e.g. click "Put Remaining on Hold") before completing.`
        );
      } else {
        const over = (sum - awaitingQcQty).toFixed(2);
        alert(
          `Disposition total (${sum} ${measuringItem.uom}) exceeds the quantity awaiting QC (${awaitingQcQty} ${measuringItem.uom}) by ${over} ${measuringItem.uom}. Please correct the quantities.`
        );
      }
      return;
    }

    setCompletingInspection(true);
    try {
      await inventoryService.completeQCInspection({
        receiptId: measuringItem.receiptId,
        billId: measuringItem.billId,
        goodQty: g,
        holdQty: h,
        reprocessQty: rep,
        rejectedQty: rej,
        remarks: qcRemarks,
        measurements: takaMeasurements,
      });

      // Remove from pending list or mark completed
      setPendingList((prev) => prev.filter((r) => r.id !== measuringItem.id));
      showToast(`QC completed for ${measuringItem.refNo}. Stock updated in real-time.`);
      setShowMeasurementModal(false);
      setMeasuringItem(null);
    } catch (err) {
      alert('Could not complete QC inspection: ' + (err.message || 'Error'));
    } finally {
      setCompletingInspection(false);
    }
  };

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Ref No',
      'Source Type',
      'GRN/JWI No',
      'Date',
      'Supplier',
      'Item Code',
      'Item Name',
      'Lot No',
      'Taka/Roll',
      'Received Qty',
      'Pending Qty',
      'UOM',
      'Days Pending',
      'Inspector',
      'Shift',
    ];
    const rows = filteredRows.map((r) => [
      r.refNo,
      r.sourceType,
      r.grnNo,
      r.date,
      `"${r.supplier || ''}"`,
      r.itemCode,
      `"${r.itemName || ''}"`,
      r.lotNo,
      r.takaRoll,
      r.receivedQty,
      r.pendingQty,
      r.uom,
      r.days,
      `"${r.inspector || ''}"`,
      `"${r.shift || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pending_QC_Inspections_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-4 pb-12 font-sans text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Header: Title & Action Buttons (Panel 2 & Reference Image) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#10b981] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
            2
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                Pending Inspections
              </h1>
              <PageInfoButton title="Pending Inspections" />
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Fabric received from GRN or Job Work Inward, pending for QC inspection.
            </p>
          </div>
        </div>

        {/* Action Buttons: Bulk Assign & Start Inspection */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setShowBulkAssignModal(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer ${
              selectedIds.size > 0
                ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Bulk Assign {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</span>
          </button>

          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => {
              const firstSelected = pendingList.find((r) => selectedIds.has(r.id));
              if (firstSelected) {
                setStartModalItem(firstSelected);
                setShowStartModal(true);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer ${
              selectedIds.size > 0
                ? 'bg-[#059669] hover:bg-[#047857] text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Start Inspection</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar: Date, Source, Supplier, Quality, Design, Shade (Panel 1) ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs items-end">
          {/* From Date */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Source Type */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">Source Type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              <option value="Purchase">Purchase (GRN)</option>
              <option value="Job Work">Job Work Inward</option>
              <option value="Internal">Internal Production</option>
            </select>
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">Supplier</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {filtersData.suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">Quality</label>
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {filtersData.qualities.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          {/* Design */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">Design</label>
            <select
              value={selectedDesign}
              onChange={(e) => setSelectedDesign(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {filtersData.designs.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Shade */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">Shade</label>
            <select
              value={selectedShade}
              onChange={(e) => setSelectedShade(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {filtersData.shades.map((sh) => (
                <option key={sh} value={sh}>
                  {sh}
                </option>
              ))}
            </select>
          </div>

          {/* Apply Button */}
          <div>
            <button
              type="button"
              onClick={fetchPendingData}
              className="w-full px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold rounded-lg shadow-xs transition cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Pending Table ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              {filteredRows.length} Inspections Pending
            </span>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Ref, Item, Lot, Supplier..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3 text-center w-8">
                  <input
                    type="checkbox"
                    checked={paginatedRows.length > 0 && selectedIds.size === paginatedRows.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3">Ref No.</th>
                <th className="py-2.5 px-3">Source Type</th>
                <th className="py-2.5 px-3">GRN / JWI No.</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Supplier / Vendor</th>
                <th className="py-2.5 px-3">Item Code</th>
                <th className="py-2.5 px-3">Item Name</th>
                <th className="py-2.5 px-3">Lot No.</th>
                <th className="py-2.5 px-3 text-center">Taka/Roll</th>
                <th className="py-2.5 px-3 text-right">Received Qty</th>
                <th className="py-2.5 px-3 text-right">Pending Qty</th>
                <th className="py-2.5 px-3 text-center">UOM</th>
                <th className="py-2.5 px-3 text-center">Days</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((r) => {
                  const isSelected = selectedIds.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(r.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 font-semibold text-blue-600">
                        <button
                          type="button"
                          onClick={() => {
                            setViewDetailsItem(r);
                            setShowViewDetailsModal(true);
                          }}
                          className="hover:underline text-left cursor-pointer"
                        >
                          {r.refNo}
                        </button>
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {r.sourceType}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">{r.grnNo}</td>
                      <td className="py-2 px-3 text-slate-500">{r.date}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{r.supplier}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{r.itemCode}</td>
                      <td className="py-2 px-3 text-slate-800 max-w-[200px] truncate" title={r.itemName}>
                        {r.itemName}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">{r.lotNo}</td>
                      <td className="py-2 px-3 text-center font-mono">{r.takaRoll}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        {Number(r.receivedQty).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {Number(r.pendingQty).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-500">{r.uom}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.days > 2
                              ? 'bg-rose-50 text-rose-700'
                              : r.days > 0
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.days}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setStartModalItem(r);
                            setShowStartModal(true);
                          }}
                          className="px-3 py-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs rounded-lg shadow-2xs transition cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Package className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-600">No pending inspections found.</p>
                      <p className="text-slate-400 text-xs">
                        All received goods have been inspected or no records match the active filters.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination (Panel 8) ─────────────────────────────────── */}
        <div className="p-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {filteredRows.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to{' '}
            {Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} entries
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded-lg font-semibold text-xs ${
                    currentPage === p
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal 1: Start QC Inspection (Single Row) (Panel 2) ───── */}
      {showStartModal && startModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Start QC Inspection</h3>
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[10.5px]">Source Type</label>
                <input
                  type="text"
                  readOnly
                  value={startModalItem.sourceType}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[10.5px]">GRN No.</label>
                <input
                  type="text"
                  readOnly
                  value={startModalItem.grnNo}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[10.5px]">Supplier</label>
                <input
                  type="text"
                  readOnly
                  value={startModalItem.supplier}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[10.5px]">Item Code</label>
                <input
                  type="text"
                  readOnly
                  value={startModalItem.itemCode}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-400 text-[10.5px]">Item Name</label>
                <input
                  type="text"
                  readOnly
                  value={startModalItem.itemName}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[10.5px]">Lot / Taka No.</label>
                <input
                  type="text"
                  readOnly
                  value={`${startModalItem.lotNo} (${startModalItem.takaRoll} Taka)`}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[10.5px]">Received Qty</label>
                <input
                  type="text"
                  readOnly
                  value={`${startModalItem.receivedQty} ${startModalItem.uom}`}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[10.5px]">Pending Qty</label>
                <input
                  type="text"
                  readOnly
                  value={`${startModalItem.pendingQty} ${startModalItem.uom}`}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold text-[10.5px]">Inspector *</label>
                <select
                  value={chosenInspector}
                  onChange={(e) => setChosenInspector(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:border-blue-500"
                >
                  {filtersData.inspectors.map((ins) => (
                    <option key={ins} value={ins}>
                      {ins}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 font-semibold text-[10.5px]">Inspection Date *</label>
                <input
                  type="date"
                  value={chosenInspectionDate}
                  onChange={(e) => setChosenInspectionDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => openMeasurementForm(startModalItem)}
                className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs rounded-lg transition"
              >
                Start Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Bulk Assign Inspector (Panel 3) ──────────────── */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Bulk Assign Inspector</h3>
              <button
                type="button"
                onClick={() => setShowBulkAssignModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold text-[10.5px]">Assign To *</label>
                <select
                  value={bulkInspector}
                  onChange={(e) => setBulkInspector(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:border-blue-500"
                >
                  {filtersData.inspectors.map((ins) => (
                    <option key={ins} value={ins}>
                      {ins}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 font-semibold text-[10.5px]">Shift *</label>
                <select
                  value={bulkShift}
                  onChange={(e) => setBulkShift(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:border-blue-500"
                >
                  <option value="Day Shift">Day Shift</option>
                  <option value="Night Shift">Night Shift</option>
                  <option value="General Shift">General Shift</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 font-semibold text-[10.5px]">Inspection Date *</label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:border-blue-500"
                />
              </div>
            </div>

            {/* Selected Rows Preview */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                Selected Inspections ({selectedIds.size})
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                {pendingList
                  .filter((r) => selectedIds.has(r.id))
                  .map((r) => (
                    <div key={r.id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-blue-600 mr-2">{r.refNo}</span>
                        <span className="text-slate-700">{r.itemName}</span>
                      </div>
                      <span className="font-mono font-medium text-slate-900">
                        {r.pendingQty} {r.uom}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkAssignModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assigning}
                onClick={handleConfirmBulkAssign}
                className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs rounded-lg transition"
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Enter Measurement & QC Result Form (Panel 5) ─── */}
      {showMeasurementModal && measuringItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Enter Measurement & QC Result</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{measuringItem.refNo}</span>
                  <span>•</span>
                  <span>{measuringItem.supplier}</span>
                  <span>•</span>
                  <span>Lot: <strong className="text-slate-700">{measuringItem.lotNo || 'N/A'}</strong></span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-xs bg-blue-50 text-blue-700 border border-blue-200">
                    Awaiting QC: <span className="font-mono font-bold">{awaitingQcQty} {measuringItem.uom || 'MTR'}</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMeasurementModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Measurement Details (Per-Taka breakdown) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900">Measurement Details</h4>
                  {measurementsSum > 0 && (
                    <span className="text-[11px] font-mono text-slate-500">
                      (Total Measured: <strong>{measurementsSum.toFixed(2)} {measuringItem.uom}</strong>)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {measurementsSum > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyMeasurementsToGood}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                    >
                      Use Measured Qty as Good
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddTakaRow}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase">
                      <th className="py-2 px-3 w-12">Sr.</th>
                      <th className="py-2 px-3 w-28">Taka/Roll No.</th>
                      <th className="py-2 px-3">Actual Qty ({measuringItem.uom})</th>
                      <th className="py-2 px-3">Width (cm)</th>
                      <th className="py-2 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {takaMeasurements.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 px-3 text-center text-slate-400 text-xs italic">
                          No per-taka rolls added yet. Click &quot;+ Add Row&quot; if roll-wise breakdown is recorded.
                        </td>
                      </tr>
                    ) : (
                      takaMeasurements.map((t, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-3 font-mono text-slate-400">{t.sr}</td>
                          <td className="py-1.5 px-3 font-mono font-medium">{t.takaNo}</td>
                          <td className="py-1.5 px-3">
                            <input
                              type="number"
                              value={t.actualQty}
                              onChange={(e) => handleUpdateTaka(i, 'actualQty', e.target.value)}
                              className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-medium focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="number"
                              value={t.width}
                              onChange={(e) => handleUpdateTaka(i, 'width', e.target.value)}
                              className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={t.remarks}
                              onChange={(e) => handleUpdateTaka(i, 'remarks', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* QC Result Form Cards */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">QC Result Breakdown</h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePassAll}
                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    Pass All ({awaitingQcQty} {measuringItem.uom})
                  </button>
                  {diffQty > 0 && (
                    <button
                      type="button"
                      onClick={handlePutRemainingOnHold}
                      className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded cursor-pointer transition"
                    >
                      Put {diffQty} on Hold
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Good Qty */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10.5px] font-semibold text-emerald-700 block">Good Qty</span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={qcGoodQty}
                      onChange={(e) => setQcGoodQty(e.target.value)}
                      onFocus={(e) => { if (e.target.value === '0') setQcGoodQty(''); }}
                      className="w-full bg-white border border-emerald-300 rounded px-2 py-1 text-sm font-bold text-emerald-800 font-mono focus:outline-none"
                    />
                    <span className="text-xs text-emerald-700 font-semibold">{measuringItem.uom}</span>
                  </div>
                </div>

                {/* Hold Qty */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                  <span className="text-[10.5px] font-semibold text-amber-700 block">Hold Qty</span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={qcHoldQty}
                      onChange={(e) => setQcHoldQty(e.target.value)}
                      onFocus={(e) => { if (e.target.value === '0') setQcHoldQty(''); }}
                      className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-sm font-bold text-amber-800 font-mono focus:outline-none"
                    />
                    <span className="text-xs text-amber-700 font-semibold">{measuringItem.uom}</span>
                  </div>
                </div>

                {/* Reprocess Qty */}
                <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3">
                  <span className="text-[10.5px] font-semibold text-purple-700 block">Reprocess Qty</span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={qcReprocessQty}
                      onChange={(e) => setQcReprocessQty(e.target.value)}
                      onFocus={(e) => { if (e.target.value === '0') setQcReprocessQty(''); }}
                      className="w-full bg-white border border-purple-300 rounded px-2 py-1 text-sm font-bold text-purple-800 font-mono focus:outline-none"
                    />
                    <span className="text-xs text-purple-700 font-semibold">{measuringItem.uom}</span>
                  </div>
                </div>

                {/* Rejected Qty */}
                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3">
                  <span className="text-[10.5px] font-semibold text-rose-700 block">Rejected Qty</span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={qcRejectedQty}
                      onChange={(e) => setQcRejectedQty(e.target.value)}
                      onFocus={(e) => { if (e.target.value === '0') setQcRejectedQty(''); }}
                      className="w-full bg-white border border-rose-300 rounded px-2 py-1 text-sm font-bold text-rose-800 font-mono focus:outline-none"
                    />
                    <span className="text-xs text-rose-700 font-semibold">{measuringItem.uom}</span>
                  </div>
                </div>
              </div>

              {/* Total Reconciliation Bar */}
              <div
                className={`p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition ${
                  isQcBalanced
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                    : diffQty > 0
                    ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                    : 'bg-rose-50/70 border-rose-300 text-rose-900'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-medium flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">Awaiting QC:</span>
                    <span className="font-mono font-bold bg-white/70 px-1.5 py-0.5 rounded border border-slate-200">{awaitingQcQty} {measuringItem.uom}</span>
                    <span className="text-slate-400 mx-1">|</span>
                    <span>Total Entered:</span>
                    <span className="font-mono font-bold">{totalAllocated} {measuringItem.uom}</span>
                    <span className="text-slate-500">({numGood} Good + {numHold} Hold + {numReprocess} Reprocess + {numRejected} Rejected)</span>
                  </div>
                  {diffQty > 0 && (
                    <p className="text-[11px] text-amber-700">
                      Disposition total must equal {awaitingQcQty} {measuringItem.uom}. You have <strong>{diffQty} {measuringItem.uom}</strong> unallocated.
                    </p>
                  )}
                  {diffQty < 0 && (
                    <p className="text-[11px] text-rose-700 font-medium">
                      Exceeds awaiting QC quantity by <strong>{Math.abs(diffQty)} {measuringItem.uom}</strong>. Please reduce disposition quantities.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isQcBalanced ? (
                    <div className="inline-flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Reconciled</span>
                    </div>
                  ) : diffQty > 0 ? (
                    <button
                      type="button"
                      onClick={handlePutRemainingOnHold}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <Pause className="w-3.5 h-3.5" /> Put {diffQty} on Hold
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Remarks */}
              <div className="pt-1">
                <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">
                  Inspection Observations & Remarks
                </label>
                <textarea
                  value={qcRemarks}
                  onChange={(e) => setQcRemarks(e.target.value)}
                  placeholder="e.g. Fabric quality good with minor shade variation on selvage..."
                  className="w-full h-16 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMeasurementModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={completingInspection || !isQcBalanced}
                onClick={handleCompleteInspection}
                className={`px-4 py-2 font-semibold text-xs rounded-lg transition cursor-pointer ${
                  !isQcBalanced
                    ? 'bg-blue-300 text-white cursor-not-allowed'
                    : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs'
                }`}
              >
                {completingInspection ? 'Saving...' : 'Complete Inspection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 4: View Row Details Modal (Panel 6) ─────────────── */}
      {showViewDetailsModal && viewDetailsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Inspection Details</h3>
              <button
                type="button"
                onClick={() => setShowViewDetailsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">Ref No.</span>
                  <span className="font-semibold text-blue-600 font-mono">{viewDetailsItem.refNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Source Type</span>
                  <span className="font-medium text-slate-700">{viewDetailsItem.sourceType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Date</span>
                  <span className="font-medium text-slate-700">{viewDetailsItem.date}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">Supplier</span>
                  <span className="font-medium text-slate-800">{viewDetailsItem.supplier}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Item Code</span>
                  <span className="font-mono font-semibold text-slate-800">{viewDetailsItem.itemCode}</span>
                </div>
              </div>

              <div className="pb-2 border-b border-slate-100">
                <span className="text-slate-400 block text-[10px]">Item Name</span>
                <span className="font-medium text-slate-800">{viewDetailsItem.itemName}</span>
              </div>

              <div className="grid grid-cols-4 gap-2 pb-2 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">Lot No.</span>
                  <span className="font-mono font-semibold">{viewDetailsItem.lotNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Taka/Roll</span>
                  <span className="font-mono">{viewDetailsItem.takaRoll}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Received Qty</span>
                  <span className="font-semibold">{viewDetailsItem.receivedQty} {viewDetailsItem.uom}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Pending Qty</span>
                  <span className="font-bold text-slate-900">{viewDetailsItem.pendingQty} {viewDetailsItem.uom}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">Aging (Days)</span>
                  <span className="font-semibold text-amber-700">{viewDetailsItem.days} days</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Assigned Inspector</span>
                  <span className="font-medium text-slate-800">{viewDetailsItem.inspector || 'Unassigned'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowViewDetailsModal(false);
                  setStartModalItem(viewDetailsItem);
                  setShowStartModal(true);
                }}
                className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs rounded-lg transition"
              >
                Start Inspection
              </button>
              <button
                type="button"
                onClick={() => setShowViewDetailsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
