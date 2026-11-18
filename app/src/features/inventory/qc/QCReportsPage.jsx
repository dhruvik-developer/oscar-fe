import React, { useState, useEffect, useMemo } from 'react';
import { modal } from '../../../context/ModalContext';
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  XCircle,
  Building2,
  Layers,
  UserCheck,
  Calendar,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Percent,
  SlidersHorizontal,
  Eye,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import QCPageHeader from './QCPageHeader';
import KpiCard from '../../../components/ui/KpiCard';

const fmtQty = (val, fallback = '—') => {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num.toLocaleString('en-IN') : fallback;
};

const fmtPct = (val, fallback = '—') => {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? `${num}%` : fallback;
};

export default function QCReportsPage() {
  const [activeTab, setActiveTab] = useState('supplierRejection');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('90');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [selectedQuality, setSelectedQuality] = useState('All');
  const [selectedRow, setSelectedRow] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Backend state
  const [summaryKPIs, setSummaryKPIs] = useState({
    totalReceipts: 0,
    totalReceived: 0,
    totalInspected: 0,
    passRate: 0,
    rejectionRate: 0,
    pendingHoldQty: 0,
    reprocessRecovery: 0,
  });

  const [reportsData, setReportsData] = useState({
    supplierRejection: [],
    fabricDefects: [],
    holdPending: [],
    reprocessRecovery: [],
    inspectorPerformance: [],
    dateWiseSummary: [],
  });

  const [filterOptions, setFilterOptions] = useState({
    suppliers: [],
    qualities: [],
  });

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedSupplier !== 'All') params.supplier = selectedSupplier;
      if (selectedQuality !== 'All') params.quality = selectedQuality;

      const today = new Date();
      if (dateRange === '30') {
        const from = new Date();
        from.setDate(today.getDate() - 30);
        params.date_from = from.toISOString().split('T')[0];
        params.date_to = today.toISOString().split('T')[0];
      } else if (dateRange === '90') {
        const from = new Date();
        from.setDate(today.getDate() - 90);
        params.date_from = from.toISOString().split('T')[0];
        params.date_to = today.toISOString().split('T')[0];
      } else if (dateRange === 'custom' && customFrom && customTo) {
        params.date_from = customFrom;
        params.date_to = customTo;
      }

      const res = await inventoryService.getQCReports(params);
      const data = res?.data || res || {};

      if (data.summaryKPIs) setSummaryKPIs(data.summaryKPIs);
      if (data.reports) setReportsData(data.reports);
      if (data.filters) {
        setFilterOptions({
          suppliers: data.filters.suppliers || [],
          qualities: data.filters.qualities || [],
        });
      }
    } catch (err) {
      console.error('Failed to load QC reports:', err);
      setError('Unable to load Quality Check reports from the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [dateRange, customFrom, customTo, selectedSupplier, selectedQuality]);

  // Tab definitions
  const tabs = [
    { id: 'supplierRejection', label: 'Supplier Rejection Report', icon: Building2, count: reportsData.supplierRejection.length },
    { id: 'fabricDefects', label: 'Fabric Quality Defect Report', icon: Layers, count: reportsData.fabricDefects.length },
    { id: 'holdPending', label: 'Hold & Pending Inspection Report', icon: Clock, count: reportsData.holdPending.length },
    { id: 'reprocessRecovery', label: 'Reprocess & Recovery Report', icon: RotateCcw, count: reportsData.reprocessRecovery.length },
    { id: 'inspectorPerformance', label: 'Inspector Performance Report', icon: UserCheck, count: reportsData.inspectorPerformance.length },
    { id: 'dateWiseSummary', label: 'Date-wise QC Summary', icon: Calendar, count: reportsData.dateWiseSummary.length },
  ];

  // Search filtering
  const filteredData = useMemo(() => {
    const list = reportsData[activeTab] || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();

    return list.filter((item) => {
      return Object.values(item).some((val) => {
        if (typeof val === 'string') return val.toLowerCase().includes(q);
        if (typeof val === 'number') return val.toString().includes(q);
        return false;
      });
    });
  }, [reportsData, activeTab, searchQuery]);

  // PDF Export Generation
  const handleExportPDF = async () => {
    if (!filteredData || filteredData.length === 0) {
      modal.info('No records available in this report to export.', 'Export PDF');
      return;
    }

    setExportingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const margin = 36;
      const printableWidth = pageWidth - margin * 2; // 769.89 pt

      const currentTabObj = tabs.find((t) => t.id === activeTab);
      const reportTitle = currentTabObj?.label || 'QC Report';

      // Define columns for each of the 6 reports
      const columnConfigs = {
        supplierRejection: [
          { header: 'Supplier / Mill', width: 130, align: 'left', get: (r) => r.supplier || '—' },
          { header: 'Grade', width: 50, align: 'center', get: (r) => r.grade ? `Grade ${r.grade}` : '—' },
          { header: 'Receipts', width: 55, align: 'right', get: (r) => String(r.receiptsCount ?? 0) },
          { header: 'Received (m)', width: 75, align: 'right', get: (r) => fmtQty(r.receivedQty) },
          { header: 'Inspected (m)', width: 75, align: 'right', get: (r) => fmtQty(r.inspectedQty) },
          { header: 'Good (m)', width: 75, align: 'right', get: (r) => fmtQty(r.goodQty) },
          { header: 'Hold (m)', width: 70, align: 'right', get: (r) => fmtQty(r.holdQty) },
          { header: 'Rejected (m)', width: 70, align: 'right', get: (r) => fmtQty(r.rejectedQty) },
          { header: 'Rejection %', width: 80, align: 'right', get: (r) => fmtPct(r.rejectionPct, '0%') },
          { header: 'Pass %', width: 90, align: 'right', get: (r) => fmtPct(r.passPct, '0%') },
        ],
        fabricDefects: [
          { header: 'Fabric Quality', width: 140, align: 'left', get: (r) => r.quality || '—' },
          { header: 'Item Code', width: 75, align: 'left', get: (r) => r.itemCode || '—' },
          { header: 'Lots', width: 55, align: 'right', get: (r) => String(r.lotsCount ?? 0) },
          { header: 'Inspected (m)', width: 80, align: 'right', get: (r) => fmtQty(r.inspectedQty) },
          { header: 'Good Qty (m)', width: 80, align: 'right', get: (r) => fmtQty(r.goodQty) },
          { header: 'Defective (m)', width: 80, align: 'right', get: (r) => fmtQty(r.defectiveQty) },
          { header: 'Defect %', width: 75, align: 'right', get: (r) => fmtPct(r.defectPct, '0%') },
          { header: 'Pass %', width: 75, align: 'right', get: (r) => fmtPct(r.passPct, '0%') },
          { header: 'Primary Defect', width: 110, align: 'left', get: (r) => r.primaryDefect || 'None' },
        ],
        holdPending: [
          { header: 'Ref / Inward No', width: 85, align: 'left', get: (r) => r.refNo || '—' },
          { header: 'Source', width: 60, align: 'center', get: (r) => r.sourceType || '—' },
          { header: 'Date', width: 65, align: 'center', get: (r) => r.date || '—' },
          { header: 'Supplier / Mill', width: 110, align: 'left', get: (r) => r.supplier || '—' },
          { header: 'Fabric Quality', width: 100, align: 'left', get: (r) => r.itemName || r.quality || '—' },
          { header: 'Lot No', width: 65, align: 'left', get: (r) => r.lotNo || '—' },
          { header: 'Pending (m)', width: 70, align: 'right', get: (r) => fmtQty(r.qty) },
          { header: 'Days', width: 45, align: 'center', get: (r) => `${r.daysPending ?? 0}d` },
          { header: 'Aging Bucket', width: 60, align: 'center', get: (r) => r.agingBucket || '—' },
          { header: 'Status', width: 50, align: 'center', get: (r) => r.status || '—' },
          { header: 'Reason / Notes', width: 60, align: 'left', get: (r) => r.remarks || '—' },
        ],
        reprocessRecovery: [
          { header: 'Reprocess No', width: 80, align: 'left', get: (r) => r.rpNo || '—' },
          { header: 'Source Ref', width: 75, align: 'left', get: (r) => r.sourceRef || '—' },
          { header: 'Processor', width: 110, align: 'left', get: (r) => r.vendor || '—' },
          { header: 'Fabric Item', width: 95, align: 'left', get: (r) => r.fabricItem || '—' },
          { header: 'Sent (m)', width: 65, align: 'right', get: (r) => fmtQty(r.sentQty) },
          { header: 'Recv (m)', width: 70, align: 'right', get: (r) => r.receivedQty != null ? fmtQty(r.receivedQty) : 'Pending' },
          { header: 'Recovery %', width: 65, align: 'right', get: (r) => fmtPct(r.recoveryPct, '—') },
          { header: 'Loss (m)', width: 65, align: 'right', get: (r) => r.lossQty != null ? fmtQty(r.lossQty) : '—' },
          { header: 'Status', width: 55, align: 'center', get: (r) => r.status || '—' },
          { header: 'Good (m)', width: 60, align: 'right', get: (r) => r.goodQty != null ? fmtQty(r.goodQty) : '—' },
          { header: 'Reason', width: 80, align: 'left', get: (r) => r.reason || '—' },
        ],
        inspectorPerformance: [
          { header: 'Inspector Name', width: 150, align: 'left', get: (r) => r.inspector || '—' },
          { header: 'Total Inspections', width: 90, align: 'right', get: (r) => String(r.inspectionsCount ?? 0) },
          { header: 'Inspected (m)', width: 95, align: 'right', get: (r) => fmtQty(r.inspectedQty) },
          { header: 'Approved Lots', width: 80, align: 'right', get: (r) => String(r.approvedCount ?? 0) },
          { header: 'Held Lots', width: 75, align: 'right', get: (r) => String(r.holdCount ?? 0) },
          { header: 'Rejected Lots', width: 80, align: 'right', get: (r) => String(r.rejectedCount ?? 0) },
          { header: 'Pass Rate %', width: 90, align: 'right', get: (r) => fmtPct(r.passPct, '0%') },
          { header: 'Rating', width: 110, align: 'center', get: () => 'Consistent' },
        ],
        dateWiseSummary: [
          { header: 'Date', width: 80, align: 'left', get: (r) => r.date || '—' },
          { header: 'Receipts', width: 70, align: 'right', get: (r) => String(r.receiptsCount ?? 0) },
          { header: 'Received (m)', width: 85, align: 'right', get: (r) => fmtQty(r.receivedQty) },
          { header: 'Inspected (m)', width: 85, align: 'right', get: (r) => fmtQty(r.inspectedQty) },
          { header: 'Good Fabric (m)', width: 85, align: 'right', get: (r) => fmtQty(r.goodQty) },
          { header: 'Hold (m)', width: 80, align: 'right', get: (r) => fmtQty(r.holdQty) },
          { header: 'Rejected (m)', width: 80, align: 'right', get: (r) => fmtQty(r.rejectedQty) },
          { header: 'Pass Rate %', width: 95, align: 'right', get: (r) => fmtPct(r.passPct, '0%') },
          { header: 'Rejection Rate %', width: 90, align: 'right', get: (r) => fmtPct(r.rejectionPct, '0%') },
        ],
      };

      const columns = columnConfigs[activeTab] || [
        { header: 'Item', width: printableWidth, align: 'left', get: (r) => JSON.stringify(r) }
      ];

      // Draw header on each page
      const drawReportHeader = (isFirstPage) => {
        if (isFirstPage) {
          // Dark Header Banner
          doc.setFillColor(30, 41, 59); // slate-800
          doc.rect(margin, margin, printableWidth, 34, 'F');

          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text('OSCAR TEXTILE ERP  |  QUALITY ASSURANCE & COMPLIANCE', margin + 12, margin + 21);

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(203, 213, 225);
          doc.text('AUDIT-CERTIFIED QC REPORT', margin + printableWidth - 145, margin + 21);

          // Report Title & Meta
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42); // slate-900
          doc.text(reportTitle, margin, margin + 56);

          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139); // slate-500
          const dateRangeLabel = dateRange === '30' ? 'Last 30 Days' : dateRange === '90' ? 'Last 90 Days' : dateRange === 'custom' ? `${customFrom || '—'} to ${customTo || '—'}` : 'All Time';
          const metaText = `Time Period: ${dateRangeLabel}  |  Supplier: ${selectedSupplier}  |  Quality: ${selectedQuality}  |  Rows: ${filteredData.length}`;
          doc.text(metaText, margin, margin + 70);

          const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
          doc.text(`Generated: ${nowStr}`, margin + printableWidth - 170, margin + 70);

          // Summary KPI Strip
          doc.setFillColor(248, 250, 252); // slate-50
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.roundedRect(margin, margin + 80, printableWidth, 30, 3, 3, 'FD');

          const kpis = [
            { label: 'Receipts', value: String(summaryKPIs?.totalReceipts || 0) },
            { label: 'Total Received', value: `${fmtQty(summaryKPIs?.totalReceived, '0')} m` },
            { label: 'Inspected', value: `${fmtQty(summaryKPIs?.totalInspected, '0')} m` },
            { label: 'Pass Rate', value: fmtPct(summaryKPIs?.passRate, '0%') },
            { label: 'Rejection Rate', value: fmtPct(summaryKPIs?.rejectionRate, '0%') },
            { label: 'Hold / Pending', value: `${fmtQty(summaryKPIs?.pendingHoldQty, '0')} m` },
            { label: 'Recovery Rate', value: fmtPct(summaryKPIs?.reprocessRecovery, '0%') },
          ];

          const kpiColWidth = printableWidth / kpis.length;
          kpis.forEach((k, idx) => {
            const kx = margin + idx * kpiColWidth;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(k.label, kx + 8, margin + 92);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(k.value, kx + 8, margin + 104);
          });

          return margin + 120; // Table start Y on page 1
        } else {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text(`${reportTitle} (continued)`, margin, margin + 14);
          doc.setDrawColor(226, 232, 240);
          doc.line(margin, margin + 20, margin + printableWidth, margin + 20);
          return margin + 26; // Table start Y on page 2+
        }
      };

      // Draw table headers
      const drawTableHeaders = (startY) => {
        doc.setFillColor(241, 245, 249); // slate-100
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.rect(margin, startY, printableWidth, 20, 'FD');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85); // slate-700

        let currentX = margin;
        columns.forEach((col) => {
          let textX = currentX + 6;
          if (col.align === 'right') {
            textX = currentX + col.width - 6;
          } else if (col.align === 'center') {
            textX = currentX + col.width / 2;
          }
          doc.text(col.header, textX, startY + 13, { align: col.align });
          currentX += col.width;
        });

        return startY + 20;
      };

      let currentY = drawReportHeader(true);
      currentY = drawTableHeaders(currentY);

      // Render data rows
      const rowHeight = 16;
      const maxY = pageHeight - margin - 22; // 537 pt

      filteredData.forEach((row, rowIdx) => {
        if (currentY + rowHeight > maxY) {
          doc.addPage();
          currentY = drawReportHeader(false);
          currentY = drawTableHeaders(currentY);
        }

        // Alternating row background
        if (rowIdx % 2 === 0) {
          doc.setFillColor(255, 255, 255);
        } else {
          doc.setFillColor(248, 250, 252);
        }
        doc.setDrawColor(241, 245, 249);
        doc.rect(margin, currentY, printableWidth, rowHeight, 'FD');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        let currentX = margin;
        columns.forEach((col) => {
          const rawVal = col.get(row);
          let text = String(rawVal != null ? rawVal : '—');

          const maxTextWidth = col.width - 12;
          if (doc.getTextWidth(text) > maxTextWidth) {
            while (text.length > 3 && doc.getTextWidth(text + '...') > maxTextWidth) {
              text = text.slice(0, -1);
            }
            text += '...';
          }

          let textX = currentX + 6;
          if (col.align === 'right') {
            textX = currentX + col.width - 6;
          } else if (col.align === 'center') {
            textX = currentX + col.width / 2;
          }

          doc.text(text, textX, currentY + 11, { align: col.align });
          currentX += col.width;
        });

        currentY += rowHeight;
      });

      // Bottom footer on every page
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - margin + 6, margin + printableWidth, pageHeight - margin + 6);

        doc.text('CONFIDENTIAL - FOR INTERNAL QUALITY CONTROL USE ONLY', margin, pageHeight - margin + 17);
        doc.text('Generated via OSCAR ERP Quality Control Management System', margin + printableWidth / 2, pageHeight - margin + 17, { align: 'center' });
        doc.text(`Page ${p} of ${totalPages}`, margin + printableWidth, pageHeight - margin + 17, { align: 'right' });
      }

      const dateStamp = new Date().toISOString().split('T')[0];
      const filename = `QC_Report_${activeTab}_${dateStamp}.pdf`;
      doc.save(filename);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
      modal.error('Could not generate PDF report: ' + (err.message || 'Unknown error'), 'PDF Export Failed');
    } finally {
      setExportingPdf(false);
    }
  };

  // Export Dispatcher (CSV / Excel / PDF)
  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) {
      modal.info('No records available in this report to export.', 'Export Report');
      return;
    }

    if (exportFormat === 'pdf') {
      handleExportPDF();
      return;
    }

    const headers = Object.keys(filteredData[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    filteredData.forEach((row) => {
      const values = headers.map((header) => {
        const val = row[header] ?? '';
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QC_Report_${activeTab}_${new Date().toISOString().split('T')[0]}.${exportFormat === 'xlsx' ? 'xlsx' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  return (
    <div className="space-y-6">
      {/* ── Standard QC Page Header ─────────────────────────────── */}
      <QCPageHeader
        title="Quality Check Reports & Analytics"
        subpage="QC Reports"
        subtitle="Real-time audit summaries, supplier rejection metrics, defect analysis, and reprocess recovery tracking."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={loadReports}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              title="Refresh Report Data"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs md:text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        }
      />

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <KpiCard
          index={0}
          label="Audited Receipts"
          value={summaryKPIs?.totalReceipts ?? 0}
          icon={FileText}
          sub="GRN & Job Work"
        />
        <KpiCard
          index={1}
          label="Inspected Fabric"
          value={`${fmtQty(summaryKPIs?.totalInspected, '0')} m`}
          icon={Layers}
          sub={`${summaryKPIs?.totalReceived ? Math.round(((summaryKPIs?.totalInspected || 0) / summaryKPIs.totalReceived) * 100) : 100}% of received`}
        />
        <KpiCard
          index={2}
          label="Overall Pass Rate"
          value={fmtPct(summaryKPIs?.passRate, '0%')}
          icon={CheckCircle2}
          sub="Approved usable"
        />
        <KpiCard
          index={3}
          label="Rejection Rate"
          value={fmtPct(summaryKPIs?.rejectionRate, '0%')}
          icon={XCircle}
          sub="Scrap & wastage"
        />
        <KpiCard
          index={4}
          label="Hold / Pending"
          value={`${fmtQty(summaryKPIs?.pendingHoldQty, '0')} m`}
          icon={Clock}
          sub="Awaiting resolution"
        />
        <KpiCard
          index={5}
          label="Recovery Rate"
          value={fmtPct(summaryKPIs?.reprocessRecovery, '0%')}
          icon={RotateCcw}
          sub="From reprocessing"
        />
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date range picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
              />
            </div>
          )}

          {/* Supplier / Processor Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="All">All Suppliers / Mill</option>
              {filterOptions.suppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Quality Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="All">All Fabric Qualities</option>
              {filterOptions.qualities.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search report items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* ── REPORT TABS NAVIGATION ── */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-semibold border-b-2 whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-t-lg'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── ACTIVE REPORT TABLE VIEW ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm font-medium">Aggregating live QC data and calculating metrics...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={loadReports}
              className="mt-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-100 transition"
            >
              Retry Loading
            </button>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No records found for the selected criteria.</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* 1. Supplier-wise Rejection Table */}
            {activeTab === 'supplierRejection' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Supplier / Processor</th>
                    <th className="py-3 px-4">Quality Grade</th>
                    <th className="py-3 px-4 text-right">Receipts</th>
                    <th className="py-3 px-4 text-right">Received Qty</th>
                    <th className="py-3 px-4 text-right">Inspected Qty</th>
                    <th className="py-3 px-4 text-right">Good Fabric</th>
                    <th className="py-3 px-4 text-right">QC Hold</th>
                    <th className="py-3 px-4 text-right">Rejected</th>
                    <th className="py-3 px-4 text-right">Rejection %</th>
                    <th className="py-3 px-4 text-right">Pass %</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">{row.supplier}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          row.grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
                          row.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                          row.grade === 'C' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          Grade {row.grade}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">{row.receiptsCount ?? 0}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">{fmtQty(row.receivedQty)} m</td>
                      <td className="py-3 px-4 text-right text-slate-700">{fmtQty(row.inspectedQty)} m</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{fmtQty(row.goodQty)} m</td>
                      <td className="py-3 px-4 text-right text-amber-600">{fmtQty(row.holdQty)} m</td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600">{fmtQty(row.rejectedQty)} m</td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">{fmtPct(row.rejectionPct, '0%')}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{fmtPct(row.passPct, '0%')}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedRow({ ...row, type: 'supplier' })}
                          className="p-1 hover:bg-slate-200 text-slate-500 rounded transition"
                          title="View Breakdown"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 2. Fabric Quality Defect Table */}
            {activeTab === 'fabricDefects' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Fabric Quality</th>
                    <th className="py-3 px-4">Item Code</th>
                    <th className="py-3 px-4 text-right">Lots Tested</th>
                    <th className="py-3 px-4 text-right">Inspected Qty</th>
                    <th className="py-3 px-4 text-right">Good Qty</th>
                    <th className="py-3 px-4 text-right">Defective Qty</th>
                    <th className="py-3 px-4 text-right">Defect Rate %</th>
                    <th className="py-3 px-4 text-right">Pass Rate %</th>
                    <th className="py-3 px-4">Primary Defect Category</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">{row.quality}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{row.itemCode}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">{row.lotsCount ?? 0}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">{fmtQty(row.inspectedQty)} m</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{fmtQty(row.goodQty)} m</td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600">{fmtQty(row.defectiveQty)} m</td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">{fmtPct(row.defectPct, '0%')}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{fmtPct(row.passPct, '0%')}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                          {row.primaryDefect}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedRow({ ...row, type: 'quality' })}
                          className="p-1 hover:bg-slate-200 text-slate-500 rounded transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 3. Hold & Pending Inspection Table */}
            {activeTab === 'holdPending' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Ref / Inward No</th>
                    <th className="py-3 px-4">Source Type</th>
                    <th className="py-3 px-4">Receipt Date</th>
                    <th className="py-3 px-4">Supplier / Processor</th>
                    <th className="py-3 px-4">Fabric Quality</th>
                    <th className="py-3 px-4">Lot No</th>
                    <th className="py-3 px-4 text-right">Pending Qty</th>
                    <th className="py-3 px-4 text-center">Days Pending</th>
                    <th className="py-3 px-4 text-center">Aging Bucket</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-600">{row.refNo}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.sourceType === 'Purchase' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {row.sourceType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{row.date}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{row.supplier}</td>
                      <td className="py-3 px-4 text-slate-700">{row.itemName || row.quality}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{row.lotNo}</td>
                      <td className="py-3 px-4 text-right font-bold text-amber-600">{fmtQty(row.qty)} m</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">{row.daysPending} days</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          row.agingBucket === '0-3 Days' ? 'bg-slate-100 text-slate-700' :
                          row.agingBucket === '4-7 Days' ? 'bg-blue-100 text-blue-700' :
                          row.agingBucket === '8-14 Days' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {row.agingBucket}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          row.status === 'On Hold' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-[200px]" title={row.remarks}>{row.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 4. Reprocess History & Recovery Table */}
            {activeTab === 'reprocessRecovery' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Reprocess Job No</th>
                    <th className="py-3 px-4">Source Ref / Inward</th>
                    <th className="py-3 px-4">Outside Processor</th>
                    <th className="py-3 px-4">Fabric Item</th>
                    <th className="py-3 px-4 text-right">Sent Qty</th>
                    <th className="py-3 px-4 text-right">Received Back</th>
                    <th className="py-3 px-4 text-right">Recovery Rate %</th>
                    <th className="py-3 px-4 text-right">Loss / Shortage</th>
                    <th className="py-3 px-4 text-center">Job Status</th>
                    <th className="py-3 px-4 text-right">Good Qty</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{row.rpNo}</td>
                      <td className="py-3 px-4 font-mono text-blue-600">{row.sourceRef}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{row.vendor}</td>
                      <td className="py-3 px-4 text-slate-700">{row.fabricItem}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">{fmtQty(row.sentQty)} m</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{row.receivedQty !== null && row.receivedQty !== undefined ? `${fmtQty(row.receivedQty)} m` : <span className="text-slate-400 italic font-normal">Pending</span>}</td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600">{fmtPct(row.recoveryPct, '—')}</td>
                      <td className="py-3 px-4 text-right font-medium text-rose-600">{row.lossQty !== null && row.lossQty !== undefined ? `${fmtQty(row.lossQty)} m` : '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          row.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                          row.status === 'In Process' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{row.goodQty !== null && row.goodQty !== undefined ? `${fmtQty(row.goodQty)} m` : '—'}</td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-[180px]">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 5. Inspector Performance Table */}
            {activeTab === 'inspectorPerformance' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Inspector Name</th>
                    <th className="py-3 px-4 text-right">Total Inspections</th>
                    <th className="py-3 px-4 text-right">Total Inspected Qty</th>
                    <th className="py-3 px-4 text-right">Approved Lots</th>
                    <th className="py-3 px-4 text-right">Held Lots</th>
                    <th className="py-3 px-4 text-right">Rejected Lots</th>
                    <th className="py-3 px-4 text-right">Approval Rate %</th>
                    <th className="py-3 px-4 text-center">Performance Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">{row.inspector}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">{row.inspectionsCount ?? 0}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">{fmtQty(row.inspectedQty)} m</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{row.approvedCount ?? 0}</td>
                      <td className="py-3 px-4 text-right font-medium text-amber-600">{row.holdCount ?? 0}</td>
                      <td className="py-3 px-4 text-right font-medium text-rose-600">{row.rejectedCount ?? 0}</td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600">{fmtPct(row.passPct, '0%')}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          Consistent
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 6. Date-wise Summary Table */}
            {activeTab === 'dateWiseSummary' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Receipts Count</th>
                    <th className="py-3 px-4 text-right">Received Qty</th>
                    <th className="py-3 px-4 text-right">Inspected Qty</th>
                    <th className="py-3 px-4 text-right">Good Fabric</th>
                    <th className="py-3 px-4 text-right">Hold Fabric</th>
                    <th className="py-3 px-4 text-right">Rejected Fabric</th>
                    <th className="py-3 px-4 text-right">Pass %</th>
                    <th className="py-3 px-4 text-right">Rejection %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{row.date}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">{row.receiptsCount ?? 0}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">{fmtQty(row.receivedQty)} m</td>
                      <td className="py-3 px-4 text-right text-slate-700">{fmtQty(row.inspectedQty)} m</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{fmtQty(row.goodQty)} m</td>
                      <td className="py-3 px-4 text-right text-amber-600">{fmtQty(row.holdQty)} m</td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600">{fmtQty(row.rejectedQty)} m</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{fmtPct(row.passPct, '0%')}</td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">{fmtPct(row.rejectionPct, '0%')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer info bar */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredData.length} records</span>
          <span className="font-medium text-slate-600">All data compiled dynamically from real GRN, Inward & Reprocess transactions.</span>
        </div>
      </div>

      {/* ── DRILL-DOWN DETAILS MODAL ── */}
      {selectedRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                {selectedRow.type === 'supplier' ? `Supplier Audit: ${selectedRow.supplier}` : `Quality Audit: ${selectedRow.quality}`}
              </h3>
              <button
                onClick={() => setSelectedRow(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <div className="text-slate-500 text-[11px]">Total Inspected</div>
                  <div className="text-base font-bold text-slate-900">{fmtQty(selectedRow?.inspectedQty, '0')} m</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[11px]">Pass Rate</div>
                  <div className="text-base font-bold text-emerald-600">{fmtPct(selectedRow?.passPct, '0%')}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Approved Good Fabric:</span>
                  <span className="font-semibold text-emerald-600">{fmtQty(selectedRow?.goodQty, '0')} m</span>
                </div>
                {selectedRow?.holdQty !== undefined && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">QC Hold Fabric:</span>
                    <span className="font-semibold text-amber-600">{fmtQty(selectedRow?.holdQty, '0')} m</span>
                  </div>
                )}
                {(selectedRow?.rejectedQty !== undefined || selectedRow?.defectiveQty !== undefined) && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Rejected / Defective:</span>
                    <span className="font-semibold text-rose-600">{fmtQty(selectedRow?.rejectedQty ?? selectedRow?.defectiveQty, '0')} m</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Overall Rejection / Defect Rate:</span>
                  <span className="font-bold text-rose-600">{selectedRow.rejectionPct || selectedRow.defectPct || 0}%</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setSelectedRow(null)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT MODAL ── */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                {exportFormat === 'pdf' ? (
                  <FileText className="w-4 h-4 text-rose-600" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                )}
                Export {tabs.find((t) => t.id === activeTab)?.label}
              </h3>
              <button onClick={() => !exportingPdf && setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Select Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="csv">CSV (Comma-separated values)</option>
                  <option value="xlsx">Excel (.csv format)</option>
                  <option value="pdf">PDF Document (.pdf format)</option>
                </select>
              </div>
              <p className="text-slate-500 text-[11px]">
                {exportFormat === 'pdf'
                  ? `Generates an audit-certified A4 landscape PDF report with summary KPIs and all ${filteredData.length} records.`
                  : `Downloads the currently filtered ${filteredData.length} report rows with all columns and calculations.`}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                disabled={exportingPdf}
                className="flex-1 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exportingPdf}
                className="flex-1 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {exportingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
