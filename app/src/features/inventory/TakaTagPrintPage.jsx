import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Tag,
  Printer,
  Barcode as BarcodeIcon,
  Search,
  RotateCcw,
  RefreshCw,
  Download,
  Eye,
  History,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Box,
  Building,
  Calendar,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Scan,
  Sparkles,
  Info,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { inventoryService } from '../../services/domainServices';
import KpiCard from '../../components/ui/KpiCard';

// Helper for Quantity formatting
function formatQty(val, uom = 'm') {
  if (val === null || val === undefined || isNaN(val)) return '0' + (uom ? ` ${uom}` : '');
  const num = Number(val);
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return uom ? `${formatted} ${uom}` : formatted;
}

// Single Printable Tag Component for DOM rendering & Print
export function TakaTagLabel({ taka, qrDataUrl }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && taka?.takaId) {
      try {
        JsBarcode(barcodeRef.current, taka.takaId, {
          format: 'CODE128',
          width: 1.4,
          height: 38,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        console.warn('Barcode render error:', err);
      }
    }
  }, [taka?.takaId]);

  if (!taka) return null;

  const qcColor =
    taka.qcStatus === 'Passed' || taka.qcStatus === 'Approved'
      ? 'border-emerald-600 text-emerald-800 bg-emerald-50'
      : taka.qcStatus === 'Pending'
      ? 'border-amber-600 text-amber-800 bg-amber-50'
      : taka.qcStatus === 'On Hold'
      ? 'border-orange-600 text-orange-800 bg-orange-50'
      : 'border-rose-600 text-rose-800 bg-rose-50';

  return (
    <div
      className="taka-printable-tag bg-white text-slate-900 border border-slate-300 rounded-lg p-3 w-[300px] sm:w-[320px] shadow-sm font-sans mx-auto select-none"
      style={{ minHeight: '210px' }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-blue-700 text-white font-black text-[10px] grid place-items-center">
            O
          </div>
          <div>
            <div className="text-[11px] font-black tracking-wider text-slate-900 leading-tight">
              OSCAR TEXTILE ERP
            </div>
            <div className="text-[8px] font-semibold text-slate-500 tracking-wide uppercase">
              Taka Identity Tag
            </div>
          </div>
        </div>
        <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${qcColor}`}>
          {taka.qcStatus || 'QC Pending'}
        </div>
      </div>

      {/* Barcode & QR Code Section */}
      <div className="flex items-center justify-between gap-2 bg-slate-50/80 p-2 rounded border border-slate-200 mb-2">
        <div className="flex-1 flex flex-col items-center">
          <svg ref={barcodeRef} className="max-w-full h-9"></svg>
          <span className="font-mono text-xs font-black tracking-widest text-slate-900 mt-0.5">
            {taka.takaId}
          </span>
        </div>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="Taka QR"
            className="w-12 h-12 rounded border border-slate-300 bg-white p-0.5 shrink-0"
          />
        )}
      </div>

      {/* Identification & Specs Grid */}
      <div className="space-y-1 text-[10px]">
        <div className="grid grid-cols-2 gap-1 border-b border-slate-100 pb-1">
          <div>
            <span className="text-slate-500 font-medium">Lot No:</span>{' '}
            <span className="font-bold text-slate-900 font-mono">{taka.lotNo}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-medium">Roll / Taka #:</span>{' '}
            <span className="font-bold text-slate-900 font-mono">{taka.takaRoll}</span>
          </div>
        </div>

        <div className="border-b border-slate-100 pb-1">
          <span className="text-slate-500 font-medium">Item:</span>{' '}
          <span className="font-bold text-slate-900">
            {taka.itemCode} - {taka.itemName}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 border-b border-slate-100 pb-1">
          <div>
            <span className="text-slate-500 font-medium">Quality:</span>{' '}
            <span className="font-semibold text-slate-800">{taka.quality || '-'}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Design:</span>{' '}
            <span className="font-semibold text-slate-800">{taka.design || '-'}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-medium">Shade:</span>{' '}
            <span className="font-semibold text-slate-800">{taka.shade || '-'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 border-b border-slate-100 pb-1">
          <div>
            <span className="text-slate-500 font-medium">Supplier:</span>{' '}
            <span className="font-semibold text-slate-800 truncate block max-w-[130px]">
              {taka.supplier || '-'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-medium">GRN Ref:</span>{' '}
            <span className="font-bold text-slate-900 font-mono">{taka.grnNo || '-'}</span>
          </div>
        </div>

        {/* Highlighted Received Quantity */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-slate-500 font-medium">Rec Date:</span>{' '}
            <span className="font-medium text-slate-800">{taka.receivedDate}</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-500 mr-1">Taka Qty:</span>
            <span className="text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {formatQty(taka.receivedQty, taka.uom)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TakaTagPrintPage() {
  // Data State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [selectedItem, setSelectedItem] = useState('All');
  const [selectedQuality, setSelectedQuality] = useState('All');
  const [selectedDesign, setSelectedDesign] = useState('All');
  const [selectedShade, setSelectedShade] = useState('All');
  const [selectedQCStatus, setSelectedQCStatus] = useState('All');
  const [selectedTagStatus, setSelectedTagStatus] = useState('All');

  // Pagination & Row Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  // Modals & Drawers
  const [previewTaka, setPreviewTaka] = useState(null);
  const [previewQrUrl, setPreviewQrUrl] = useState('');
  const [historyTaka, setHistoryTaka] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Scanner State (Keyboard wedge / manual)
  const [scannerInput, setScannerInput] = useState('');
  const [scanResultTaka, setScanResultTaka] = useState(null);
  const [scanningStatus, setScanningStatus] = useState(null); // 'success' | 'error' | null
  const [scanErrorMsg, setScanErrorMsg] = useState('');
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  // Print execution state
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState(null);
  const [bulkPrintTakas, setBulkPrintTakas] = useState([]);
  const [bulkQrUrls, setBulkQrUrls] = useState({});

  // Fetch Taka Tags Data from Backend
  const fetchData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const query = {};
        if (searchQuery) query.search = searchQuery;
        if (fromDate) query.from_date = fromDate;
        if (toDate) query.to_date = toDate;
        if (selectedSupplier !== 'All') query.supplier = selectedSupplier;
        if (selectedItem !== 'All') query.item = selectedItem;
        if (selectedQuality !== 'All') query.quality = selectedQuality;
        if (selectedDesign !== 'All') query.design = selectedDesign;
        if (selectedShade !== 'All') query.shade = selectedShade;
        if (selectedQCStatus !== 'All') query.qc_status = selectedQCStatus;
        if (selectedTagStatus !== 'All') query.tag_status = selectedTagStatus;

        const res = await inventoryService.getTakaTags(query);
        setData(res);
      } catch (err) {
        console.error('Failed to load taka tags:', err);
        setError(err?.message || 'Failed to retrieve taka tags from database.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      searchQuery,
      fromDate,
      toDate,
      selectedSupplier,
      selectedItem,
      selectedQuality,
      selectedDesign,
      selectedShade,
      selectedQCStatus,
      selectedTagStatus,
    ]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Search & Filter Reset
  const handleResetFilters = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setSelectedSupplier('All');
    setSelectedItem('All');
    setSelectedQuality('All');
    setSelectedDesign('All');
    setSelectedShade('All');
    setSelectedQCStatus('All');
    setSelectedTagStatus('All');
    setCurrentPage(1);
  };

  // Row selection helpers
  const toggleSelectRow = (id) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const paginatedRecords = useMemo(() => {
    const all = data?.records || [];
    const start = (currentPage - 1) * pageSize;
    return all.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const totalPages = Math.ceil((data?.records?.length || 0) / pageSize) || 1;

  const isAllPageSelected =
    paginatedRecords.length > 0 && paginatedRecords.every((r) => selectedRowIds.has(r.id));

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      const next = new Set(selectedRowIds);
      paginatedRecords.forEach((r) => next.delete(r.id));
      setSelectedRowIds(next);
    } else {
      const next = new Set(selectedRowIds);
      paginatedRecords.forEach((r) => next.add(r.id));
      setSelectedRowIds(next);
    }
  };

  // Generate QR Data URL for a Taka
  const generateQrForTaka = async (taka) => {
    try {
      const payload = JSON.stringify({
        takaId: taka.takaId,
        lotNo: taka.lotNo,
        roll: taka.takaRoll,
        item: taka.itemCode,
        qty: taka.receivedQty,
        qc: taka.qcStatus,
      });
      return await QRCode.toDataURL(payload, {
        width: 120,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch {
      return '';
    }
  };

  // Open Preview Modal
  const handleOpenPreview = async (taka) => {
    setPreviewTaka(taka);
    const qrUrl = await generateQrForTaka(taka);
    setPreviewQrUrl(qrUrl);
  };

  // Open History Modal
  const handleOpenHistory = async (taka) => {
    setHistoryTaka(taka);
    setLoadingHistory(true);
    try {
      const res = await inventoryService.getTakaTagHistory(taka.id);
      setHistoryLogs(res?.history || []);
    } catch (err) {
      console.error('Failed to load print history:', err);
      setHistoryLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Perform Print (Single or Bulk)
  const executePrint = async (takasToPrint, actionType = 'PRINT') => {
    if (!takasToPrint || takasToPrint.length === 0) return;

    setIsPrinting(true);
    setPrintSuccessMsg(null);

    try {
      // 1. Prepare QR codes for printing
      const qrMap = {};
      for (const t of takasToPrint) {
        qrMap[t.id] = await generateQrForTaka(t);
      }
      setBulkPrintTakas(takasToPrint);
      setBulkQrUrls(qrMap);

      // 2. Call backend to record print event (atomic audit, zero stock change)
      const ids = takasToPrint.map((t) => t.id);
      await inventoryService.recordTakaTagPrint({
        ids,
        actionType,
        notes: actionType === 'REPRINT' ? 'Reprint requested from Taka Tag Print register' : 'Physical tag printed',
      });

      // 3. Trigger print window after brief state flush
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
        setPrintSuccessMsg(`Successfully printed ${takasToPrint.length} tag(s). Print count updated.`);
        fetchData(true); // silent refresh of table & summary cards
      }, 350);
    } catch (err) {
      console.error('Print failure:', err);
      alert('Failed to register print event: ' + (err?.message || 'Error occurred.'));
      setIsPrinting(false);
    }
  };

  // Handle Barcode Scanner Lookup (Keyboard wedge on Enter or scan button)
  const handleBarcodeScan = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const code = scannerInput.trim();
    if (!code) return;

    setScanningStatus('loading');
    setScanErrorMsg('');
    try {
      const res = await inventoryService.scanTakaTag(code);
      if (res && res.found) {
        setScanResultTaka(res);
        setScanningStatus('success');
        setIsScanModalOpen(true);
      } else {
        setScanningStatus('error');
        setScanErrorMsg(res?.detail || `No taka found for barcode '${code}'.`);
      }
    } catch (err) {
      console.warn('Barcode scan error:', err);
      setScanningStatus('error');
      setScanErrorMsg(err?.message || `Barcode '${code}' not found in active inventory.`);
    }
  };

  // Download PDF via Backend ReportLab
  const handleDownloadPdf = () => {
    const ids = Array.from(selectedRowIds);
    if (ids.length === 0) {
      alert('Please select at least one taka to download printable PDF.');
      return;
    }
    inventoryService.openTakaTagsPdf(ids).catch((err) => alert(err?.message || 'Could not download PDF.'));
  };

  // Summary Metrics
  const summaryCards = data?.summaryCards || {
    totalTakas: 0,
    tagsPrinted: 0,
    pendingPrint: 0,
    reprints: 0,
  };

  const selectedCount = selectedRowIds.size;
  const selectedTakas = useMemo(() => {
    const all = data?.records || [];
    return all.filter((r) => selectedRowIds.has(r.id));
  }, [data, selectedRowIds]);

  return (
    <div className="space-y-4">
      {/* ── CSS PRINT STYLES (Prints ONLY the tags, hides app chrome) ── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-mount-point, #print-mount-point * {
            visibility: visible;
          }
          #print-mount-point {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .taka-printable-tag {
            page-break-after: always;
            break-after: page;
            margin: 0 auto 15mm auto;
            border: 1px solid #94a3b8 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Hidden container holding tags during window.print() */}
      <div id="print-mount-point" className="hidden print:block">
        {bulkPrintTakas.map((taka) => (
          <div key={taka.id} className="py-2 flex justify-center">
            <TakaTagLabel taka={taka} qrDataUrl={bulkQrUrls[taka.id]} />
          </div>
        ))}
      </div>

      {/* ── 1. PAGE HEADER ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white grid place-items-center shadow-sm shrink-0">
            <Tag size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Taka Tag Print</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Code 128 / QR
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Print physical barcode tags for fabric takas, rolls and pieces. Traceable to GRN, QC and Stock.
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Refresh */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer disabled:opacity-50"
            title="Refresh records"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={selectedCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download printable label PDF (ReportLab)"
          >
            <Download size={13} className="text-slate-500" />
            <span>Download PDF</span>
            {selectedCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-bold grid place-items-center">
                {selectedCount}
              </span>
            )}
          </button>

          {/* Reprint Selected */}
          <button
            onClick={() => executePrint(selectedTakas, 'REPRINT')}
            disabled={selectedCount === 0 || isPrinting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={13} />
            <span>Reprint</span>
          </button>

          {/* Bulk Print */}
          <button
            onClick={() => executePrint(selectedTakas, 'BULK_PRINT')}
            disabled={selectedCount === 0 || isPrinting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer size={13} />
            <span>Bulk Print ({selectedCount})</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {printSuccessMsg && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{printSuccessMsg}</span>
          </div>
          <button onClick={() => setPrintSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 2. SUMMARY KPI CARDS ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Takas"
          value={summaryCards.totalTakas}
          sub="Eligible in register"
          icon={Layers}
          tone="blue"
        />
        <KpiCard
          label="Tags Printed"
          value={summaryCards.tagsPrinted}
          sub="Physical tag issued"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Pending Print"
          value={summaryCards.pendingPrint}
          sub="Awaiting tag printing"
          icon={Clock}
          tone="amber"
        />
        <KpiCard
          label="Reprints"
          value={summaryCards.reprints}
          sub="Recorded reprint audit"
          icon={RotateCcw}
          tone="purple"
        />
      </div>

      {/* ── 3. BARCODE SCANNER BAR & FILTER TOOLBAR ───────────────────── */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Scanner Bar (Keyboard-wedge friendly) */}
        <form onSubmit={handleBarcodeScan} className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Scan size={16} className="text-blue-600" />
            </div>
            <input
              type="text"
              value={scannerInput}
              onChange={(e) => setScannerInput(e.target.value)}
              placeholder="Scan Barcode (Code 128) or enter Taka ID (e.g. TAK-000001) / Lot / GRN... Press Enter to scan"
              className="w-full h-9 pl-9 pr-24 bg-slate-50/80 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
            <div className="absolute inset-y-0 right-1 flex items-center">
              <button
                type="submit"
                className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
              >
                <BarcodeIcon size={12} />
                <span>Scan / Lookup</span>
              </button>
            </div>
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="w-full sm:w-auto h-9 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer shrink-0"
          >
            Reset Filters
          </button>
        </form>

        {/* Scan Error Message */}
        {scanErrorMsg && (
          <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{scanErrorMsg}</span>
            </div>
            <button onClick={() => setScanErrorMsg('')} className="text-rose-500 hover:text-rose-700">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Multi-Criteria Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
          {/* Supplier */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Supplier</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
            >
              <option value="All">All Suppliers</option>
              {(data?.filters?.suppliers || []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Quality</label>
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
            >
              <option value="All">All Qualities</option>
              {(data?.filters?.qualities || []).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          {/* Design */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Design</label>
            <select
              value={selectedDesign}
              onChange={(e) => setSelectedDesign(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
            >
              <option value="All">All Designs</option>
              {(data?.filters?.designs || []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Shade */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Shade</label>
            <select
              value={selectedShade}
              onChange={(e) => setSelectedShade(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
            >
              <option value="All">All Shades</option>
              {(data?.filters?.shades || []).map((sh) => (
                <option key={sh} value={sh}>
                  {sh}
                </option>
              ))}
            </select>
          </div>

          {/* QC Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">QC Status</label>
            <select
              value={selectedQCStatus}
              onChange={(e) => setSelectedQCStatus(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
            >
              {(data?.filters?.qcStatuses || ['All', 'Passed', 'Pending', 'On Hold', 'Reprocess', 'Rejected']).map(
                (st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Tag Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Tag Status</label>
            <select
              value={selectedTagStatus}
              onChange={(e) => setSelectedTagStatus(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
            >
              {(data?.filters?.tagStatuses || ['All', 'Pending', 'Printed', 'Reprinted']).map((ts) => (
                <option key={ts} value={ts}>
                  {ts}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
            />
          </div>
        </div>
      </div>

      {/* ── 4. TAKA TAG REGISTER TABLE ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs font-semibold">Loading Taka Tag register from database...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <AlertTriangle size={24} className="mx-auto mb-2 text-rose-500" />
            <p className="text-xs font-bold">{error}</p>
          </div>
        ) : !data?.records || data.records.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <BarcodeIcon size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">No Taka Records Found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Takas are created automatically when Goods Receipts (GRN) are approved, or manually in the Lot / Taka Register.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 select-none">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      onChange={toggleSelectAllPage}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-2 w-8 text-center">#</th>
                  <th className="py-2.5 px-3">Taka ID & Barcode</th>
                  <th className="py-2.5 px-3">Lot No.</th>
                  <th className="py-2.5 px-2 text-center">Roll #</th>
                  <th className="py-2.5 px-3">Fabric Item</th>
                  <th className="py-2.5 px-3">Quality / Design / Shade</th>
                  <th className="py-2.5 px-3">Supplier / GRN</th>
                  <th className="py-2.5 px-3 text-right">Received Qty</th>
                  <th className="py-2.5 px-3 text-center">QC Status</th>
                  <th className="py-2.5 px-3 text-center">Tag Status</th>
                  <th className="py-2.5 px-3">Last Printed</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.map((taka, idx) => {
                  const isChecked = selectedRowIds.has(taka.id);
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr
                      key={taka.id}
                      className={`hover:bg-slate-50/70 transition-colors ${isChecked ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(taka.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                        {rowNum}
                      </td>

                      {/* Taka ID & Barcode */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                          <Tag size={13} className="text-blue-600 shrink-0" />
                          <span>{taka.takaId}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <BarcodeIcon size={11} />
                          <span>{taka.barcode}</span>
                        </div>
                      </td>

                      {/* Lot No */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">
                        {taka.lotNo}
                      </td>

                      {/* Roll # */}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-700 font-mono">
                        #{taka.takaRoll}
                      </td>

                      {/* Fabric Item */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{taka.itemName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{taka.itemCode}</div>
                      </td>

                      {/* Quality / Design / Shade */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{taka.quality || '-'}</div>
                        <div className="text-[10px] text-slate-500">
                          {taka.design || 'Plain'} • {taka.shade || 'Default'}
                        </div>
                      </td>

                      {/* Supplier & GRN */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 truncate max-w-[130px]">
                          {taka.supplier}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{taka.grnNo}</div>
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-bold text-slate-900 font-mono">
                          {formatQty(taka.receivedQty, taka.uom)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Avail: {formatQty(taka.availableQty, taka.uom)}
                        </div>
                      </td>

                      {/* QC Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            taka.qcStatus === 'Passed' || taka.qcStatus === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : taka.qcStatus === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : taka.qcStatus === 'On Hold'
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {taka.qcStatus}
                        </span>
                      </td>

                      {/* Tag Status */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              taka.tagStatus === 'Printed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : taka.tagStatus === 'Reprinted'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {taka.tagStatus || 'Pending'}
                          </span>
                          {taka.printCount > 0 && (
                            <span className="text-[9px] text-slate-400 font-mono">
                              ({taka.printCount}x)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Printed */}
                      <td className="py-2.5 px-3 text-[11px]">
                        {taka.lastPrintedAt ? (
                          <div>
                            <div className="font-medium text-slate-800">{taka.lastPrintedAt}</div>
                            <div className="text-[10px] text-slate-400">{taka.lastPrintedBy || 'User'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Never printed</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Preview Tag */}
                          <button
                            onClick={() => handleOpenPreview(taka)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Preview Tag"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Print / Reprint Tag */}
                          <button
                            onClick={() => executePrint([taka], taka.printCount > 0 ? 'REPRINT' : 'PRINT')}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            title={taka.printCount > 0 ? 'Reprint Tag' : 'Print Tag'}
                          >
                            <Printer size={14} />
                          </button>

                          {/* Print History */}
                          <button
                            onClick={() => handleOpenHistory(taka)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition cursor-pointer"
                            title="Print & Audit History"
                          >
                            <History size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination Footer */}
        {data?.records?.length > 0 && (
          <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              Showing{' '}
              <span className="font-bold text-slate-800">
                {(currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, data.records.length)}
              </span>{' '}
              of <span className="font-bold text-slate-800">{data.records.length}</span> takas
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. PREVIEW MODAL ─────────────────────────────────────────── */}
      {previewTaka && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white grid place-items-center">
                  <Tag size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tag Print Preview</h3>
                  <p className="text-[11px] text-slate-500">Physical Label Size: 60 × 40 mm</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewTaka(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Rendered Label */}
            <div className="p-5 bg-slate-100 flex justify-center">
              <TakaTagLabel taka={previewTaka} qrDataUrl={previewQrUrl} />
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-white">
              <div className="text-[11px] text-slate-500">
                Status:{' '}
                <span className="font-bold text-slate-800">{previewTaka.tagStatus || 'Pending'}</span>{' '}
                ({previewTaka.printCount || 0} times)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTaka(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    executePrint([previewTaka], previewTaka.printCount > 0 ? 'REPRINT' : 'PRINT');
                    setPreviewTaka(null);
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm"
                >
                  <Printer size={13} />
                  <span>Print This Tag</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. PRINT HISTORY MODAL ────────────────────────────────────── */}
      {historyTaka && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white grid place-items-center">
                  <History size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Print & Audit History</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {historyTaka.takaId} • Lot: {historyTaka.lotNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryTaka(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto">
              {loadingHistory ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-purple-600" />
                  <p className="text-xs">Loading audit logs...</p>
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Clock size={24} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">No print events recorded yet.</p>
                  <p className="text-slate-400 mt-0.5">This taka has not been printed yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-6 h-6 rounded-full grid place-items-center shrink-0 mt-0.5 ${
                            log.actionType === 'REPRINT'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {log.actionType === 'REPRINT' ? <RotateCcw size={12} /> : <Printer size={12} />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {log.actionType === 'REPRINT' ? 'Reprint Event' : 'Initial Tag Print'}
                          </div>
                          <div className="text-[11px] text-slate-500">By {log.printedBy}</div>
                          {log.notes && log.notes !== '-' && (
                            <div className="text-[10px] text-slate-400 italic mt-0.5">{log.notes}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-[11px] font-mono text-slate-500 shrink-0">
                        {log.printedAt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryTaka(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. SCAN LOOKUP RESULT MODAL ───────────────────────────────── */}
      {isScanModalOpen && scanResultTaka && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white grid place-items-center">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Scanned Taka Verified</h3>
                  <p className="text-[11px] font-mono text-slate-500">
                    ID: {scanResultTaka.takaId} • Barcode: {scanResultTaka.barcode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fabric Item</span>
                  <span className="font-bold text-slate-900">{scanResultTaka.itemName}</span>
                  <span className="text-[10px] text-slate-500 font-mono block">{scanResultTaka.itemCode}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Quality & Specs</span>
                  <span className="font-semibold text-slate-800">
                    {scanResultTaka.quality} • {scanResultTaka.design}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Shade: {scanResultTaka.shade}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Lot / Roll</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {scanResultTaka.lotNo} / #{scanResultTaka.takaRoll}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Available Qty</span>
                  <span className="font-black text-blue-700">
                    {formatQty(scanResultTaka.availableQty, scanResultTaka.uom)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">QC Verdict</span>
                  <span className="font-bold text-emerald-700">{scanResultTaka.qcStatus}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-blue-900">
                <div className="flex items-center gap-1.5">
                  <Building size={14} className="text-blue-600" />
                  <span>Storage: <strong>{scanResultTaka.location}</strong></span>
                </div>
                <div>
                  <span>Supplier: <strong>{scanResultTaka.supplier}</strong></span>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Print status: <strong>{scanResultTaka.tagStatus || 'Pending'}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScanModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    executePrint([scanResultTaka], scanResultTaka.printCount > 0 ? 'REPRINT' : 'PRINT');
                    setIsScanModalOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                >
                  <Printer size={13} />
                  <span>Print Tag</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
