import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  XCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { useERP } from '../../../context/ERPContext';
import PageInfoButton from '../../../components/ui/PageInfoButton';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

export default function QCInspectionRegisterPage() {
  const { vendors = [], items = [], locations = [] } = useERP();

  // State
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [filtersData, setFiltersData] = useState({
    statuses: ['All', 'Completed', 'Partially Approved', 'Pending', 'On Hold', 'Rework', 'Rejected'],
    suppliers: [],
    qualities: [],
    designs: [],
    shades: [],
  });

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [qualityFilter, setQualityFilter] = useState('All');
  const [designFilter, setDesignFilter] = useState('All');
  const [shadeFilter, setShadeFilter] = useState('All');

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const PAGE_SIZE = 10;

  // Modals
  const [showNewQCModal, setShowNewQCModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailsTab, setDetailsTab] = useState('measurements'); // 'measurements' | 'images' | 'remarks' | 'documents' | 'audit'

  // New QC Form State
  const [newSourceType, setNewSourceType] = useState('Purchase (GRN)');
  const [newGrnNo, setNewGrnNo] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newLotNo, setNewLotNo] = useState('');
  const [newLocationId, setNewLocationId] = useState('');
  const [newTakaRoll, setNewTakaRoll] = useState('1');
  const [newReceivedQty, setNewReceivedQty] = useState('');
  const [newInspectionDate, setNewInspectionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submittingNewQC, setSubmittingNewQC] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Phase 2.6 ASTM 4-Point Piece Inspection State
  const [qcEntryMode, setQcEntryMode] = useState('standard'); // 'standard' | 'astm'
  const [defectsList, setDefectsList] = useState([]);
  const [astmRollMeter, setAstmRollMeter] = useState('100');
  const [astmRollWidth, setAstmRollWidth] = useState('44');
  const [astmDefects, setAstmDefects] = useState([]);

  useEffect(() => {
    inventoryService.getDefects()
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.results || []);
        setDefectsList(rows);
      })
      .catch((err) => console.warn('Could not load defect master:', err));
  }, []);

  const calcASTM = (actualMeterVal, widthVal, defectsArr) => {
    const actualMeter = Number(actualMeterVal) || 0;
    const widthInches = Number(widthVal) || 44;
    const widthMeters = widthInches * 0.0254;
    const area = actualMeter * widthMeters;
    const totalPoints = (defectsArr || []).reduce(
      (acc, d) => acc + (Number(d.points) || 1) * (Number(d.count) || 1),
      0
    );
    const ptsPer100M = area > 0 ? Number(((totalPoints * 100) / area).toFixed(2)) : 0;
    let grade = 'A';
    let disposition = 'Pass';
    if (ptsPer100M <= 20) {
      grade = 'A';
      disposition = 'Pass';
    } else if (ptsPer100M <= 28) {
      grade = 'B';
      disposition = 'Pass';
    } else if (ptsPer100M <= 40) {
      grade = 'C';
      disposition = 'Second Quality';
    } else {
      grade = 'Second Quality';
      disposition = 'Reject';
    }
    return { totalPoints, ptsPer100M, grade, disposition };
  };

  // Fetch register data from backend (combining GRN register and Piece Inspections)
  const fetchRegister = useCallback(async () => {
    setLoading(true);
    try {
      const [resReg, resPiece] = await Promise.allSettled([
        inventoryService.getQCRegister({
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          status: statusFilter !== 'All' ? statusFilter : undefined,
          supplier: supplierFilter !== 'All' ? supplierFilter : undefined,
          quality: qualityFilter !== 'All' ? qualityFilter : undefined,
          design: designFilter !== 'All' ? designFilter : undefined,
          shade: shadeFilter !== 'All' ? shadeFilter : undefined,
        }),
        inventoryService.getQCInspections(),
      ]);

      let regRecords = [];
      if (resReg.status === 'fulfilled' && resReg.value) {
        const res = resReg.value;
        if (res.data) {
          regRecords = res.data.records || [];
          if (res.data.filters) {
            setFiltersData((prev) => ({
              ...prev,
              suppliers: res.data.filters.suppliers || [],
              qualities: res.data.filters.qualities || [],
              designs: res.data.filters.designs || [],
              shades: res.data.filters.shades || [],
            }));
          }
        } else if (res.records) {
          regRecords = res.records || [];
          if (res.filters) {
            setFiltersData((prev) => ({
              ...prev,
              suppliers: res.filters.suppliers || [],
              qualities: res.filters.qualities || [],
              designs: res.filters.designs || [],
              shades: res.filters.shades || [],
            }));
          }
        }
      }

      let pieceRecords = [];
      if (resPiece.status === 'fulfilled' && resPiece.value) {
        const pList = Array.isArray(resPiece.value) ? resPiece.value : (resPiece.value?.results || []);
        pieceRecords = pList.map((p) => ({
          id: p.id,
          qcNo: p.inspectionNumber,
          date: p.inspectionDate || '',
          sourceType: 'Piece Inspection (ASTM D5430)',
          grnNo: p.sourceDocumentNumber || p.inspectionNumber,
          supplier: p.inspectorName || 'Internal QC',
          itemCode: p.lines?.[0]?.lotNo || 'Piece Lot',
          itemName: `Piece Inspection ${p.inspectionNumber}`,
          quality: p.lines?.[0]?.lotNo ? `Lot ${p.lines[0].lotNo}` : 'Fabric',
          design: '—',
          shade: '—',
          lotNo: p.lines?.[0]?.lotNo || '—',
          takaRoll: p.lines?.length || 1,
          receivedQty: p.total_inspected_qty || 0,
          inspectedQty: p.total_inspected_qty || 0,
          goodQty: p.passed_qty || 0,
          holdQty: p.hold_qty || 0,
          reprocessQty: p.reprocess_qty || 0,
          rejectedQty: p.rejected_qty || 0,
          status: p.status === 'Approved' ? 'Completed' : (p.status || 'Pending'),
          remarks: p.notes || '',
          isPieceInspection: true,
          measurements: (p.lines || []).map((l, i) => ({
            srNo: i + 1,
            takaNo: l.takaNo || i + 1,
            actualQty: l.actualMeter || 0,
            width: l.width || 44,
            grade: l.grade,
            pointsPer100M: l.pointsPer100SqMeter,
            penaltyPoints: l.penaltyPoints,
            good: l.disposition === 'Pass' ? l.actualMeter : 0,
            hold: l.disposition === 'Hold' ? l.actualMeter : 0,
            reprocess: l.disposition === 'Reprocess' ? l.actualMeter : 0,
            rejected: l.disposition === 'Reject' || l.disposition === 'Second Quality' ? l.actualMeter : 0,
            defects: l.defects || [],
          })),
        }));
      }

      setRecords([...pieceRecords, ...regRecords]);
    } catch (err) {
      console.warn('Backend /inventory/qc/register/ call failed:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter, supplierFilter, qualityFilter, designFilter, shadeFilter]);

  useEffect(() => {
    fetchRegister();
  }, [fetchRegister]);

  // Toast auto-hide
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Filtered Records (search + frontend filters)
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          String(r.qcNo || '').toLowerCase().includes(q) ||
          String(r.supplier || '').toLowerCase().includes(q) ||
          String(r.itemCode || '').toLowerCase().includes(q) ||
          String(r.itemName || '').toLowerCase().includes(q) ||
          String(r.grnNo || '').toLowerCase().includes(q) ||
          String(r.lotNo || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [records, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedRows.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Status Badge Helper
  const renderStatusBadge = (st) => {
    const statusLower = (st || '').toLowerCase();
    if (statusLower === 'completed' || statusLower === 'approved') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Completed
        </span>
      );
    }
    if (statusLower === 'on hold') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          On Hold
        </span>
      );
    }
    if (statusLower === 'in progress') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          In Progress
        </span>
      );
    }
    if (statusLower === 'reprocess' || statusLower === 'rework') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Reprocess
        </span>
      );
    }
    if (statusLower === 'rejected') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
        Pending
      </span>
    );
  };

  // Create Manual QC
  const handleSaveManualQC = async (e) => {
    e.preventDefault();
    if (!newReceivedQty || Number(newReceivedQty) <= 0) {
      alert('Please enter a valid received quantity');
      return;
    }
    setSubmittingNewQC(true);
    try {
      const res = await inventoryService.createManualQC({
        sourceType: newSourceType,
        supplier: newSupplier,
        itemCode: newItemCode,
        locationId: newLocationId,
        lotNo: newLotNo,
        takaRoll: newTakaRoll,
        receivedQty: newReceivedQty,
        inspectionDate: newInspectionDate,
      });
      setToastMsg(res?.data?.message || 'QC Inspection record created successfully.');
      setShowNewQCModal(false);
      // Reset
      setNewGrnNo('');
      setNewReceivedQty('');
      await fetchRegister();
    } catch (err) {
      alert('Could not create QC record: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingNewQC(false);
    }
  };

  // Create Piece Inspection with 4-Point ASTM D5430
  const handleSaveASTMQC = async (e) => {
    e.preventDefault();
    if (!astmRollMeter || Number(astmRollMeter) <= 0) {
      alert('Please enter a valid inspected roll length (meters).');
      return;
    }
    setSubmittingNewQC(true);
    try {
      const calc = calcASTM(astmRollMeter, astmRollWidth, astmDefects);
      const linesPayload = [
        {
          takaNo: String(newTakaRoll || 1),
          lotNo: newLotNo || 'LOT-PIECE',
          actualMeter: Number(astmRollMeter),
          width: Number(astmRollWidth),
          penaltyPoints: calc.totalPoints,
          pointsPer100SqMeter: calc.ptsPer100M,
          grade: calc.grade,
          disposition: calc.disposition,
          defects: astmDefects.map((d) => ({
            defect: d.defectId,
            defect_count: Number(d.count) || 1,
            points: Number(d.points) || 1,
            distance_meter: d.distanceMeter ? Number(d.distanceMeter) : undefined,
            remarks: d.remarks || '',
          })),
        },
      ];

      const res = await inventoryService.createQCInspection({
        sourceDocumentType: newSourceType,
        sourceDocumentNumber: newGrnNo || undefined,
        inspectionDate: newInspectionDate,
        lines: linesPayload,
      });

      setToastMsg(`Piece QC inspection ${res?.inspectionNumber || 'created'} with Grade ${calc.grade} (${calc.ptsPer100M} pts/100m²)!`);
      setShowNewQCModal(false);
      setAstmDefects([]);
      await fetchRegister();
    } catch (err) {
      alert('Could not save ASTM QC Inspection: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingNewQC(false);
    }
  };

  // Export CSV
  const handleExport = () => {
    if (!filteredRecords.length) {
      alert('No records available to export.');
      return;
    }
    const headers = [
      'QC No',
      'Date',
      'Source Type',
      'GRN/JWO No',
      'Supplier',
      'Item Code',
      'Item Name',
      'Quality',
      'Design',
      'Shade',
      'Lot No',
      'Taka/Roll',
      'Received Qty',
      'Inspected Qty',
      'Good Qty',
      'Hold Qty',
      'Reprocess Qty',
      'Rejected Qty',
      'QC Status',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.qcNo || ''}"`,
      `"${r.date || ''}"`,
      `"${r.sourceType || ''}"`,
      `"${r.grnNo || ''}"`,
      `"${r.supplier || ''}"`,
      `"${r.itemCode || ''}"`,
      `"${r.itemName || ''}"`,
      `"${r.quality || ''}"`,
      `"${r.design || ''}"`,
      `"${r.shade || ''}"`,
      `"${r.lotNo || ''}"`,
      `"${r.takaRoll || 1}"`,
      r.receivedQty || 0,
      r.inspectedQty || 0,
      r.goodQty || 0,
      r.holdQty || 0,
      r.reprocessQty || 0,
      r.rejectedQty || 0,
      `"${r.status || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QC_Inspection_Register_${new Date().toISOString().split('T')[0]}.${exportFormat === 'xlsx' ? 'csv' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
              2
            </div>
            <h1 className="text-xl font-bold text-slate-900">QC Inspection Register</h1>
            <PageInfoButton title="QC Inspection Register" />
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1 pl-11">
            Record inspection details and measurement for each lot/taka.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pl-11 md:pl-0">
          <div className="flex items-center space-x-2 bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-700 bg-white px-1.5 py-0.5 rounded text-[11px] border border-slate-200 shadow-2xs">
              Live DB
            </span>
            <span>Real database records only (zero dummy data).</span>
          </div>

          <button
            onClick={() => setShowNewQCModal(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-semibold rounded-lg shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ New QC</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs md:text-sm font-medium rounded-lg border border-slate-300 shadow-2xs transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR (Panel 1) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">QC Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs"
            >
              {filtersData.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Supplier</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs truncate"
            >
              <option value="All">All</option>
              {filtersData.suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Quality</label>
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs truncate"
            >
              <option value="All">All</option>
              {filtersData.qualities.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Design</label>
            <select
              value={designFilter}
              onChange={(e) => setDesignFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs truncate"
            >
              <option value="All">All</option>
              {filtersData.designs.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Shade</label>
            <select
              value={shadeFilter}
              onChange={(e) => setShadeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs truncate"
            >
              <option value="All">All</option>
              {filtersData.shades.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search bar & Apply/Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by QC No, GRN, supplier, item or lot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchRegister}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-2xs transition flex items-center space-x-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Apply Filters</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter('All');
                setSupplierFilter('All');
                setQualityFilter('All');
                setDesignFilter('All');
                setShadeFilter('All');
                setSearchQuery('');
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* QC INSPECTION REGISTER TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={paginatedRows.length > 0 && selectedIds.size === paginatedRows.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-3">QC No.</th>
                <th className="p-3">Date</th>
                <th className="p-3">Source Type</th>
                <th className="p-3">GRN / JWO No.</th>
                <th className="p-3">Supplier / Vendor</th>
                <th className="p-3">Item Code</th>
                <th className="p-3">Item Name</th>
                <th className="p-3">Quality</th>
                <th className="p-3">Design</th>
                <th className="p-3">Shade</th>
                <th className="p-3">Lot No.</th>
                <th className="p-3 text-center">Taka/Roll</th>
                <th className="p-3 text-right">Received Qty (m)</th>
                <th className="p-3 text-right">Inspected Qty (m)</th>
                <th className="p-3 text-right text-emerald-700">Good (m)</th>
                <th className="p-3 text-right text-amber-700">Hold (m)</th>
                <th className="p-3 text-right text-purple-700">Reprocess (m)</th>
                <th className="p-3 text-right text-red-700">Rejected (m)</th>
                <th className="p-3 text-center">QC Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="21" className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading QC register entries...</span>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan="21" className="p-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No QC inspection records found</p>
                      <p className="text-xs text-slate-500">
                        Inspections appear here automatically when Goods Receipts are created and inspected. You can also create a manual inspection record using the "+ New QC" button.
                      </p>
                      <button
                        onClick={() => setShowNewQCModal(true)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Manual QC</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => handleToggleSelect(r.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-3 font-semibold text-blue-700">{r.qcNo}</td>
                    <td className="p-3 text-slate-600">{r.date}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {r.sourceType}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-800">{r.grnNo}</td>
                    <td className="p-3 font-medium text-slate-900">{r.supplier}</td>
                    <td className="p-3 font-mono text-slate-600">{r.itemCode}</td>
                    <td className="p-3 font-medium text-slate-800">{r.itemName}</td>
                    <td className="p-3 text-slate-600">{r.quality || '—'}</td>
                    <td className="p-3 text-slate-600">{r.design || '—'}</td>
                    <td className="p-3 text-slate-600">{r.shade || '—'}</td>
                    <td className="p-3 font-mono text-slate-600">{r.lotNo}</td>
                    <td className="p-3 text-center">{r.takaRoll}</td>
                    <td className="p-3 text-right font-medium">{r.receivedQty?.toLocaleString()}</td>
                    <td className="p-3 text-right font-medium">{r.inspectedQty?.toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-700 font-semibold">{r.goodQty?.toLocaleString()}</td>
                    <td className="p-3 text-right text-amber-700 font-semibold">{r.holdQty?.toLocaleString()}</td>
                    <td className="p-3 text-right text-purple-700 font-semibold">{r.reprocessQty?.toLocaleString()}</td>
                    <td className="p-3 text-right text-red-700 font-semibold">{r.rejectedQty?.toLocaleString()}</td>
                    <td className="p-3 text-center">{renderStatusBadge(r.status)}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedRecord(r);
                          setShowDetailsModal(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination (Panel 4) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing {filteredRecords.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to{' '}
            {Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} of {filteredRecords.length} entries
          </div>

          <div className="flex items-center space-x-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded text-xs font-medium border transition ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>


      {/* ── MODAL: CREATE NEW QC (MANUAL & 4-POINT ASTM ENTRY) ── */}
      {showNewQCModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Create QC Inspection</h3>
                <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-semibold">
                  Standard Quality Flow
                </span>
              </div>
              <button
                onClick={() => setShowNewQCModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setQcEntryMode('astm')}
                className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
                  qcEntryMode === 'astm'
                    ? 'bg-white text-purple-700 shadow-2xs font-bold border border-purple-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                4-Point ASTM Piece Inspection
              </button>
              <button
                type="button"
                onClick={() => setQcEntryMode('standard')}
                className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
                  qcEntryMode === 'standard'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Standard Receipt QC (Manual)
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {qcEntryMode === 'astm' ? (
                /* ASTM 4-Point Inspection Form */
                <form onSubmit={handleSaveASTMQC} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Source Type</label>
                      <select
                        value={newSourceType}
                        onChange={(e) => setNewSourceType(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                      >
                        <option value="Purchase (GRN)">Purchase (GRN)</option>
                        <option value="Job Work Inward">Job Work Inward</option>
                        <option value="Internal Stock">Internal Stock</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Ref / Challan No.</label>
                      <input
                        type="text"
                        placeholder="e.g. GRN-101 / CH-88"
                        value={newGrnNo}
                        onChange={(e) => setNewGrnNo(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Inspection Date</label>
                      <input
                        type="date"
                        value={newInspectionDate}
                        onChange={(e) => setNewInspectionDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Lot Number *</label>
                      <input
                        type="text"
                        placeholder="e.g. LOT-FAB-200"
                        value={newLotNo}
                        onChange={(e) => setNewLotNo(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Taka / Roll No. *</label>
                      <input
                        type="number"
                        min="1"
                        value={newTakaRoll}
                        onChange={(e) => setNewTakaRoll(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Roll Length (m) *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={astmRollMeter}
                        onChange={(e) => setAstmRollMeter(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 border border-purple-300 rounded-lg bg-purple-50/50 text-purple-900 font-mono font-bold"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-slate-700 font-medium mb-1">Fabric Width (inches) *</label>
                      <input
                        type="number"
                        step="0.5"
                        min="20"
                        value={astmRollWidth}
                        onChange={(e) => setAstmRollWidth(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  {/* Defect Logger against DefectMaster */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">Defects Logged (ASTM D5430)</h4>
                        <p className="text-[10.5px] text-slate-500">
                          Select defect from Defect Master and assign 4-point penalty value
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                      <MasterSourceLink source="defects" />
                      <button
                        type="button"
                        onClick={() =>
                          setAstmDefects((prev) => [
                            ...prev,
                            {
                              id: Date.now() + Math.random(),
                              defectId: defectsList[0]?.id || '',
                              points: 1,
                              count: 1,
                              distanceMeter: '',
                              remarks: '',
                            },
                          ])
                        }
                        className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} /> Add Defect
                      </button>
                      </div>
                    </div>

                    {astmDefects.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                            <tr>
                              <th className="py-2 px-2.5">Defect</th>
                              <th className="py-2 px-2.5 w-36">Size / Points</th>
                              <th className="py-2 px-2.5 w-20">Count</th>
                              <th className="py-2 px-2.5 w-24">Dist (m)</th>
                              <th className="py-2 px-2.5 w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[11px]">
                            {astmDefects.map((def, dIdx) => (
                              <tr key={def.id || dIdx} className="hover:bg-slate-50/50">
                                <td className="py-1.5 px-2.5">
                                  <select
                                    value={def.defectId}
                                    onChange={(e) =>
                                      setAstmDefects((prev) =>
                                        prev.map((d, i) => (i === dIdx ? { ...d, defectId: e.target.value } : d))
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                                  >
                                    {defectsList.map((dm) => (
                                      <option key={dm.id} value={dm.id}>
                                        {dm.name} ({dm.category})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-1.5 px-2.5">
                                  <select
                                    value={def.points}
                                    onChange={(e) =>
                                      setAstmDefects((prev) =>
                                        prev.map((d, i) => (i === dIdx ? { ...d, points: Number(e.target.value) } : d))
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-xs font-semibold"
                                  >
                                    <option value={1}>1 pt (≤ 3" / 7.5cm)</option>
                                    <option value={2}>2 pts (3" to 6" / 15cm)</option>
                                    <option value={3}>3 pts (6" to 9" / 23cm)</option>
                                    <option value={4}>4 pts (&gt; 9" / hole &gt; 1")</option>
                                  </select>
                                </td>
                                <td className="py-1.5 px-2.5">
                                  <input
                                    type="number"
                                    min="1"
                                    value={def.count}
                                    onChange={(e) =>
                                      setAstmDefects((prev) =>
                                        prev.map((d, i) => (i === dIdx ? { ...d, count: Number(e.target.value) } : d))
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-slate-200 rounded font-mono font-bold"
                                  />
                                </td>
                                <td className="py-1.5 px-2.5">
                                  <input
                                    type="number"
                                    step="0.1"
                                    placeholder="Optional"
                                    value={def.distanceMeter}
                                    onChange={(e) =>
                                      setAstmDefects((prev) =>
                                        prev.map((d, i) => (i === dIdx ? { ...d, distanceMeter: e.target.value } : d))
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-slate-200 rounded font-mono text-xs"
                                  />
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setAstmDefects((prev) => prev.filter((_, i) => i !== dIdx))}
                                    className="text-rose-500 hover:text-rose-700 p-1 rounded"
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                        No defects logged yet. Clean roll gets 0 penalty points (Grade A Pass).
                      </div>
                    )}

                    {/* Live ASTM Calculation Summary Card */}
                    {(() => {
                      const calc = calcASTM(astmRollMeter, astmRollWidth, astmDefects);
                      const areaM2 = (
                        (Number(astmRollMeter) || 0) *
                        (Number(astmRollWidth) || 44) *
                        0.0254
                      ).toFixed(2);
                      return (
                        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 p-3 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                              ASTM D5430 Evaluation:
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-white text-purple-800 border border-purple-200">
                                {calc.ptsPer100M} pts / 100m²
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded text-xs font-extrabold border ${
                                  calc.grade === 'A'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : calc.grade === 'B'
                                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                                    : calc.grade === 'C'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}
                              >
                                Grade {calc.grade}
                              </span>
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800">
                                Auto-Disposition: {calc.disposition}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10.5px] text-slate-600 flex justify-between font-mono">
                            <span>Total Penalty Points: {calc.totalPoints} pts</span>
                            <span>Fabric Area: {areaM2} m² ({astmRollMeter}m × {astmRollWidth}")</span>
                            <span>Standard: ASTM 4-Point System</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowNewQCModal(false)}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingNewQC}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      {submittingNewQC ? 'Saving & Grading...' : 'Save & Grade Inspection'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Standard GRN QC Manual Form */
                <form onSubmit={handleSaveManualQC} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Source Type</label>
                      <select
                        value={newSourceType}
                        onChange={(e) => setNewSourceType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                      >
                        <option value="Purchase (GRN)">Purchase (GRN)</option>
                        <option value="Job Work">Job Work</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">GRN / Ref No.</label>
                      <input
                        type="text"
                        placeholder="Auto-generate if empty"
                        value={newGrnNo}
                        onChange={(e) => setNewGrnNo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                      />
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-700 font-medium">Supplier / Vendor *</label>
                        <MasterSourceLink source="vendors" />
                      </div>
                      <select
                        value={newSupplier}
                        onChange={(e) => setNewSupplier(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                      >
                        <option value="">Select Supplier</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.name}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-700 font-medium">Item Code / Fabric *</label>
                        <MasterSourceLink source="items" />
                      </div>
                      <select
                        value={newItemCode}
                        onChange={(e) => {
                          const sel = items.find((it) => it.sku === e.target.value);
                          setNewItemCode(e.target.value);
                          if (sel) setNewItemName(sel.name);
                        }}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                      >
                        <option value="">Select Fabric Item</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.sku}>
                            {it.sku} — {it.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Item Name</label>
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Auto-filled from Item"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-800"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-700 font-medium">Receiving Godown *</label>
                        <MasterSourceLink source="godowns" />
                      </div>
                      <select
                        value={newLocationId}
                        onChange={(e) => setNewLocationId(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                      >
                        <option value="">Select Godown</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Lot No. *</label>
                      <input
                        type="text"
                        value={newLotNo}
                        onChange={(e) => setNewLotNo(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Taka / Roll Count</label>
                      <input
                        type="number"
                        min="1"
                        value={newTakaRoll}
                        onChange={(e) => setNewTakaRoll(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Received Qty (m) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        placeholder="e.g. 1000"
                        value={newReceivedQty}
                        onChange={(e) => setNewReceivedQty(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Inspection Date</label>
                      <input
                        type="date"
                        value={newInspectionDate}
                        onChange={(e) => setNewInspectionDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs flex items-start space-x-2 border border-blue-200">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Use this form only for manual or exception entries. Standard fabric lots are automatically received and queued through the Purchase GRN module.
                    </span>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowNewQCModal(false)}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingNewQC}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      {submittingNewQC ? 'Saving...' : 'Save QC Record'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EXPORT ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Export QC Inspection Register</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">File Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                </select>
              </div>
              <p className="text-slate-500">
                Exports the current filtered data with all column details and measurements ({filteredRecords.length} records).
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW ROW DETAILS (Panel 5) ── */}
      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-3">
                <h3 className="text-base font-bold text-slate-900">QC Inspection Details</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                  {selectedRecord.qcNo}
                </span>
                {renderStatusBadge(selectedRecord.status)}
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Details Grid */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[11px]">Date</span>
                <span className="font-semibold text-slate-800">{selectedRecord.date}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Source Type</span>
                <span className="font-semibold text-slate-800">{selectedRecord.sourceType}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">GRN / Ref No.</span>
                <span className="font-mono font-semibold text-slate-800">{selectedRecord.grnNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Supplier</span>
                <span className="font-semibold text-slate-800">{selectedRecord.supplier}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Item Code</span>
                <span className="font-mono font-semibold text-slate-800">{selectedRecord.itemCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Item Name</span>
                <span className="font-semibold text-slate-800 truncate block">{selectedRecord.itemName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Quality</span>
                <span className="font-semibold text-slate-800">{selectedRecord.quality || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Design</span>
                <span className="font-semibold text-slate-800">{selectedRecord.design || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Shade</span>
                <span className="font-semibold text-slate-800">{selectedRecord.shade || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Lot No.</span>
                <span className="font-mono font-semibold text-slate-800">{selectedRecord.lotNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Received Qty</span>
                <span className="font-semibold text-slate-800">{selectedRecord.receivedQty} m</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Inspected Qty</span>
                <span className="font-semibold text-blue-700">{selectedRecord.inspectedQty} m</span>
              </div>
            </div>

            {/* Details Tabs */}
            <div className="flex items-center space-x-1 border-b border-slate-200 px-4 pt-2 bg-white text-xs font-medium">
              {[
                { id: 'measurements', label: 'Measurement & Result' },
                { id: 'images', label: 'Fabric Images' },
                { id: 'remarks', label: 'Remarks' },
                { id: 'documents', label: 'Documents' },
                { id: 'audit', label: 'Audit Trail' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDetailsTab(t.id)}
                  className={`px-3 py-2 border-b-2 transition ${
                    detailsTab === t.id
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-4 overflow-y-auto flex-1">
              {detailsTab === 'measurements' && (
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Sr. No.</th>
                          <th className="p-2.5">Taka No.</th>
                          <th className="p-2.5 text-right">Actual Qty (m)</th>
                          <th className="p-2.5 text-right">Width (cm/in)</th>
                          <th className="p-2.5">ASTM Grade</th>
                          <th className="p-2.5 text-right text-emerald-700">Good (m)</th>
                          <th className="p-2.5 text-right text-amber-700">Hold (m)</th>
                          <th className="p-2.5 text-right text-purple-700">Reprocess (m)</th>
                          <th className="p-2.5 text-right text-red-700">Rejected (m)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {(selectedRecord.measurements || []).length > 0 ? (
                          selectedRecord.measurements.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5">{m.srNo || idx + 1}</td>
                              <td className="p-2.5 font-medium">{m.takaNo || idx + 1}</td>
                              <td className="p-2.5 text-right font-medium">{m.actualQty}</td>
                              <td className="p-2.5 text-right">{m.width ?? '—'}</td>
                              <td className="p-2.5">
                                {m.grade ? (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    m.grade === 'A' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    m.grade === 'B' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                    m.grade === 'C' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    Grade {m.grade} {m.pointsPer100M ? `(${m.pointsPer100M} pts)` : ''}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono text-[11px]">—</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right text-emerald-700 font-semibold">{m.good ?? selectedRecord.goodQty}</td>
                              <td className="p-2.5 text-right text-amber-700 font-semibold">{m.hold ?? selectedRecord.holdQty}</td>
                              <td className="p-2.5 text-right text-purple-700 font-semibold">{m.reprocess ?? selectedRecord.reprocessQty}</td>
                              <td className="p-2.5 text-right text-red-700 font-semibold">{m.rejected ?? selectedRecord.rejectedQty}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="9" className="p-4 text-center text-slate-400">
                              No individual taka measurements recorded. Total received: {selectedRecord.receivedQty} m
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-center text-xs">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="text-emerald-700 block font-bold text-base">{selectedRecord.goodQty} m</span>
                      <span className="text-emerald-600 font-medium">Good Stock</span>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <span className="text-amber-700 block font-bold text-base">{selectedRecord.holdQty} m</span>
                      <span className="text-amber-600 font-medium">On Hold</span>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <span className="text-purple-700 block font-bold text-base">{selectedRecord.reprocessQty} m</span>
                      <span className="text-purple-600 font-medium">Reprocess</span>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-red-700 block font-bold text-base">{selectedRecord.rejectedQty} m</span>
                      <span className="text-red-600 font-medium">Rejected</span>
                    </div>
                  </div>
                </div>
              )}

              {detailsTab === 'images' && (
                <div className="p-4 text-center text-xs text-slate-500 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400 border border-dashed border-slate-300">
                    <Layers className="w-8 h-8" />
                  </div>
                  <p>No external fabric images attached to this inspection record.</p>
                </div>
              )}

              {detailsTab === 'remarks' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <span className="font-semibold text-slate-800 block">Inspection Checkpoint & Defect Notes:</span>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedRecord.remarks || 'No specific defect notes recorded during this checkpoint.'}
                  </p>
                </div>
              )}

              {detailsTab === 'documents' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <span className="font-semibold text-slate-800 block">Linked Receipt Document:</span>
                  <div className="flex items-center space-x-2 text-slate-600">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span className="font-mono">{selectedRecord.grnNo}</span>
                    <span>— Date: {selectedRecord.date}</span>
                  </div>
                </div>
              )}

              {detailsTab === 'audit' && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Date & Time</th>
                        <th className="p-2.5">Action</th>
                        <th className="p-2.5">User</th>
                        <th className="p-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(selectedRecord.auditTrail || []).map((a, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-600">{a.dateTime || selectedRecord.date}</td>
                          <td className="p-2.5 font-semibold text-blue-700">{a.action}</td>
                          <td className="p-2.5">{a.user}</td>
                          <td className="p-2.5 text-slate-500">{a.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
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
