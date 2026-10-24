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
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { useERP } from '../../../context/ERPContext';
import PageInfoButton from '../../../components/ui/PageInfoButton';

export default function QCDashboardPage({ defaultTab = 'All' }) {
  const { purchaseBills = [], vendors = [], items = [], formatCurrency } = useERP();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  // Filter States
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState('All');

  // Table Controls
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [qualityTopN, setQualityTopN] = useState('Top 5');
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Updating disposition
  const [updatingDisposition, setUpdatingDisposition] = useState(false);
  const [dispositionNote, setDispositionNote] = useState('');

  // Fetch Dashboard Data from Backend
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getQCDashboard({
        date_from: dateFrom,
        date_to: dateTo,
        supplier: supplierFilter !== 'All' ? supplierFilter : undefined,
        source_type: sourceTypeFilter !== 'All' ? sourceTypeFilter : undefined,
      });

      if (res && res.data) {
        setDashboardData(res.data);
      } else if (res && !res.data && res.summaryCards) {
        setDashboardData(res);
      } else {
        setDashboardData(null);
      }
    } catch (err) {
      console.warn('Backend QC dashboard endpoint unavailable:', err);
      setDashboardData(buildEmptyDashboard(dateFrom, dateTo, supplierFilter));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, supplierFilter, sourceTypeFilter]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Handle Apply button
  const handleApplyFilters = () => {
    fetchDashboard();
  };

  // Helper for empty dashboard when endpoint returns no data or fails
  function buildEmptyDashboard(from, to, supp) {
    return {
      filters: {
        suppliers: (vendors || []).map((v) => v.name),
        dateRange: { from, to },
      },
      summaryCards: {
        totalReceived: { qty: 0, lots: 0, takas: 0, uom: 'm' },
        inspected: { qty: 0, lots: 0, pct: 0, uom: 'm' },
        good: { qty: 0, pct: 0, uom: 'm' },
        hold: { qty: 0, pct: 0, uom: 'm' },
        reprocess: { qty: 0, pct: 0, uom: 'm' },
        rejected: { qty: 0, pct: 0, uom: 'm' },
      },
      statusDistribution: {
        inspectedTotal: 0,
        good: { qty: 0, pct: 0 },
        hold: { qty: 0, pct: 0 },
        reprocess: { qty: 0, pct: 0 },
        rejected: { qty: 0, pct: 0 },
      },
      trend: [],
      supplierRejection: [],
      qualityBreakdown: [],
      pendingInspections: {
        totalQty: 0,
        totalLots: 0,
        purchase: { qty: 0, lots: 0 },
        jobWork: { qty: 0, lots: 0 },
        internal: { qty: 0, lots: 0 },
      },
      onHoldReview: {
        totalQty: 0,
        totalLots: 0,
        breakdown: [],
      },
      records: [],
    };
  }

  // Active records from dashboardData
  const allRecords = useMemo(() => {
    return dashboardData?.records || [];
  }, [dashboardData]);

  // Tab Counts for badges
  const tabCounts = useMemo(() => {
    return {
      All: allRecords.length,
      Pending: allRecords.filter((r) => r.status === 'Pending').length,
      Completed: allRecords.filter((r) => r.status === 'Completed').length,
      'On Hold': allRecords.filter((r) => r.status === 'On Hold').length,
      Reprocess: allRecords.filter((r) => r.status === 'Reprocess' || r.status === 'Rework').length,
      Rejected: allRecords.filter((r) => r.status === 'Rejected').length,
    };
  }, [allRecords]);

  // Filter records based on tab and search
  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      if (activeTab === 'Pending' && rec.status !== 'Pending') return false;
      if (activeTab === 'Completed' && rec.status !== 'Completed') return false;
      if (activeTab === 'On Hold' && rec.status !== 'On Hold') return false;
      if (activeTab === 'Reprocess' && rec.status !== 'Reprocess' && rec.status !== 'Rework') return false;
      if (activeTab === 'Rejected' && rec.status !== 'Rejected') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          String(rec.id || '').toLowerCase().includes(q) ||
          String(rec.supplier || '').toLowerCase().includes(q) ||
          String(rec.itemCode || '').toLowerCase().includes(q) ||
          String(rec.itemName || '').toLowerCase().includes(q) ||
          String(rec.refNo || '').toLowerCase().includes(q) ||
          String(rec.lotNo || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [allRecords, activeTab, searchQuery]);

  // Metrics Data Extraction
  const cards = dashboardData?.summaryCards || {
    totalReceived: { qty: 0, lots: 0, takas: 0, uom: 'm' },
    inspected: { qty: 0, lots: 0, pct: 0, uom: 'm' },
    good: { qty: 0, pct: 0, uom: 'm' },
    hold: { qty: 0, pct: 0, uom: 'm' },
    reprocess: { qty: 0, pct: 0, uom: 'm' },
    rejected: { qty: 0, pct: 0, uom: 'm' },
  };

  const dist = dashboardData?.statusDistribution || {
    inspectedTotal: 0,
    good: { qty: 0, pct: 0 },
    hold: { qty: 0, pct: 0 },
    reprocess: { qty: 0, pct: 0 },
    rejected: { qty: 0, pct: 0 },
  };

  const trendData = dashboardData?.trend || [];
  const supplierRejection = dashboardData?.supplierRejection || [];
  const qualityBreakdown = dashboardData?.qualityBreakdown || [];
  const pendingInspections = dashboardData?.pendingInspections || {
    totalQty: 0,
    totalLots: 0,
    purchase: { qty: 0, lots: 0 },
    jobWork: { qty: 0, lots: 0 },
    internal: { qty: 0, lots: 0 },
  };
  const onHoldReview = dashboardData?.onHoldReview || {
    totalQty: 0,
    totalLots: 0,
    breakdown: [],
  };

  const suppliersList = dashboardData?.filters?.suppliers || vendors.map((v) => v.name);

  // Update Disposition Action
  // A whole-lot verdict can only move stock still at QC Hold (backend
  // qc.dispose_all); job-work inwards have no receipt to post against here.
  const canDisposeSelected = Boolean(selectedRecord?.receiptId) && selectedRecord?.canDispose !== false;

  const handleUpdateDisposition = async (newVerdict) => {
    if (!selectedRecord || !canDisposeSelected) return;
    setUpdatingDisposition(true);
    try {
      await inventoryService.updateQCDisposition(selectedRecord.receiptId, {
        status: newVerdict,
        note: dispositionNote || selectedRecord.defectReason,
      });
      // Refresh after update
      await fetchDashboard();
      setSelectedRecord(null);
    } catch (err) {
      alert('Could not update QC disposition: ' + (err.message || 'Server error'));
    } finally {
      setUpdatingDisposition(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'QC No',
      'Date',
      'Source Type',
      'GRN/JWI No',
      'Supplier',
      'Item Code',
      'Item Name',
      'Lot No',
      'Taka/Roll',
      'Received',
      'Inspected',
      'Good',
      'Hold',
      'Reprocess',
      'Rejected',
      'Status',
    ];
    const rows = filteredRecords.map((r) => [
      r.id,
      r.date,
      r.sourceType,
      r.refNo,
      `"${r.supplier || ''}"`,
      r.itemCode,
      `"${r.itemName || ''}"`,
      r.lotNo,
      r.takaRoll,
      r.received,
      r.inspected,
      r.good,
      r.hold,
      r.reprocess,
      r.rejected,
      r.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QC_Inspections_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Donut calculation
  const donutGoodPct = dist.good?.pct || 0;
  const donutHoldPct = dist.hold?.pct || 0;
  const donutReprocessPct = dist.reprocess?.pct || 0;
  const donutRejectedPct = dist.rejected?.pct || 0;
  const circumference = 238.8; // 2 * Math.PI * 38
  const goodDash = (donutGoodPct / 100) * circumference;
  const holdDash = (donutHoldPct / 100) * circumference;
  const repDash = (donutReprocessPct / 100) * circumference;
  const rejDash = (donutRejectedPct / 100) * circumference;

  return (
    <div className="w-full space-y-4 pb-12 font-sans text-slate-800">
      {/* ── Top Header & Filter Controls ─────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
              QC Dashboard
            </h1>
            <PageInfoButton title="QC Dashboard" />
            {loading && (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time overview of fabric inspection, quality status and stock impact
          </p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Supplier Dropdown */}
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium shadow-2xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Suppliers</option>
            {suppliersList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Date Range From */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="pl-3 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium shadow-2xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Date Range To */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="pl-3 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium shadow-2xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Source Type / Status Filter */}
          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium shadow-2xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Sources</option>
            <option value="Purchase">Purchase (GRN)</option>
            <option value="Job Work">Job Work Inward</option>
            <option value="Internal">Internal Production</option>
          </select>

          {/* Apply Button */}
          <button
            type="button"
            onClick={handleApplyFilters}
            className="px-4 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            Apply
          </button>

          {/* Quick Intake Button */}
          <Link
            to="/purchase/receipts"
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Intake GRN</span>
          </Link>
        </div>
      </div>

      {/* ── 6 Top Metric Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Total Received */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 truncate">Total Received for QC</p>
            <p className="text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
              {Number(cards.totalReceived.qty).toLocaleString('en-IN')} {cards.totalReceived.uom}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {cards.totalReceived.lots} Lots | {cards.totalReceived.takas} Taka
            </p>
          </div>
        </div>

        {/* Card 2: Inspected Quantity */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#dcfce7] text-[#16a34a] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 truncate">Inspected Quantity</p>
            <p className="text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
              {Number(cards.inspected.qty).toLocaleString('en-IN')} {cards.inspected.uom}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5 truncate">
              {cards.inspected.lots} Lots ({cards.inspected.pct}%)
            </p>
          </div>
        </div>

        {/* Card 3: Good Quantity */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#d1fae5] text-[#059669] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 truncate">Good Quantity</p>
            <p className="text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
              {Number(cards.good.qty).toLocaleString('en-IN')} {cards.good.uom}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5 truncate">
              {cards.good.pct}% of Inspected
            </p>
          </div>
        </div>

        {/* Card 4: Hold Quantity */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#fef3c7] text-[#d97706] flex items-center justify-center shrink-0">
            <Pause className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 truncate">Hold Quantity</p>
            <p className="text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
              {Number(cards.hold.qty).toLocaleString('en-IN')} {cards.hold.uom}
            </p>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5 truncate">
              {cards.hold.pct}% of Inspected
            </p>
          </div>
        </div>

        {/* Card 5: Reprocess Quantity */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f3e8ff] text-[#9333ea] flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 truncate">Reprocess Quantity</p>
            <p className="text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
              {Number(cards.reprocess.qty).toLocaleString('en-IN')} {cards.reprocess.uom}
            </p>
            <p className="text-[10px] text-purple-600 font-medium mt-0.5 truncate">
              {cards.reprocess.pct}% of Inspected
            </p>
          </div>
        </div>

        {/* Card 6: Rejected Quantity */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#fee2e2] text-[#dc2626] flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 truncate">Rejected Quantity</p>
            <p className="text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
              {Number(cards.rejected.qty).toLocaleString('en-IN')} {cards.rejected.uom}
            </p>
            <p className="text-[10px] text-rose-600 font-medium mt-0.5 truncate">
              {cards.rejected.pct}% of Inspected
            </p>
          </div>
        </div>
      </div>

      {/* ── Middle 4 Analytics Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Card A: QC Status Distribution (Donut Chart) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-900 tracking-tight mb-3">QC Status Distribution</h3>
          <div className="flex items-center justify-between gap-2 my-auto">
            {/* SVG Donut Chart */}
            <div className="relative w-32 h-32 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="15" />
                {dist.inspectedTotal > 0 && (
                  <>
                    {/* Good segment */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="15"
                      strokeDasharray={`${goodDash} ${circumference}`}
                      strokeDashoffset="0"
                    />
                    {/* Hold segment */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="15"
                      strokeDasharray={`${holdDash} ${circumference}`}
                      strokeDashoffset={-goodDash}
                    />
                    {/* Reprocess segment */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="15"
                      strokeDasharray={`${repDash} ${circumference}`}
                      strokeDashoffset={-(goodDash + holdDash)}
                    />
                    {/* Rejected segment */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="15"
                      strokeDasharray={`${rejDash} ${circumference}`}
                      strokeDashoffset={-(goodDash + holdDash + repDash)}
                    />
                  </>
                )}
              </svg>
              {/* Center Value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[12px] font-bold text-slate-800 leading-none">
                  {Number(dist.inspectedTotal).toLocaleString('en-IN')} {cards.inspected.uom}
                </span>
                <span className="text-[9px] text-slate-400 font-medium mt-0.5">Inspected</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-1.5 text-[11px] min-w-0 pr-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" />
                <span className="text-slate-600 font-medium">Good</span>
                <span className="text-slate-400 text-[10px] ml-auto">
                  {dist.good?.pct}% ({Number(dist.good?.qty).toLocaleString('en-IN')} {cards.good.uom})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shrink-0" />
                <span className="text-slate-600 font-medium">Hold</span>
                <span className="text-slate-400 text-[10px] ml-auto">
                  {dist.hold?.pct}% ({Number(dist.hold?.qty).toLocaleString('en-IN')} {cards.hold.uom})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] shrink-0" />
                <span className="text-slate-600 font-medium">Reprocess</span>
                <span className="text-slate-400 text-[10px] ml-auto">
                  {dist.reprocess?.pct}% ({Number(dist.reprocess?.qty).toLocaleString('en-IN')} {cards.reprocess.uom})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shrink-0" />
                <span className="text-slate-600 font-medium">Rejected</span>
                <span className="text-slate-400 text-[10px] ml-auto">
                  {dist.rejected?.pct}% ({Number(dist.rejected?.qty).toLocaleString('en-IN')} {cards.rejected.uom})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card B: QC Trend (Last 6 Months Stacked Bar Chart) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-900 tracking-tight mb-2">QC Trend (Last 6 Months)</h3>
          
          <div className="h-32 flex flex-col justify-end relative pt-2">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[9px] text-slate-400 pr-1">
              <div className="border-b border-dashed border-slate-100 flex justify-between"><span>Max</span></div>
              <div className="border-b border-dashed border-slate-100 flex justify-between"><span>75%</span></div>
              <div className="border-b border-dashed border-slate-100 flex justify-between"><span>50%</span></div>
              <div className="border-b border-dashed border-slate-100 flex justify-between"><span>25%</span></div>
              <div className="border-b border-slate-200 flex justify-between"><span>0</span></div>
            </div>

            {/* Stacked Columns */}
            <div className="relative z-10 grid grid-cols-6 gap-2 h-24 pl-5 pr-1 items-end">
              {trendData.map((m, idx) => {
                const totalM = m.good + m.hold + m.reprocess + m.rejected;
                const maxInTrend = Math.max(...trendData.map((x) => x.good + x.hold + x.reprocess + x.rejected), 1);
                const heightPct = totalM > 0 ? Math.min(100, Math.max(15, (totalM / maxInTrend) * 100)) : 4;
                const goodSegment = totalM ? (m.good / totalM) * 100 : 0;
                const holdSegment = totalM ? (m.hold / totalM) * 100 : 0;
                const repSegment = totalM ? (m.reprocess / totalM) * 100 : 0;
                const rejSegment = totalM ? (m.rejected / totalM) * 100 : 0;

                return (
                  <div key={m.month || idx} className="flex flex-col items-center gap-1">
                    <div
                      className="w-3.5 flex flex-col-reverse rounded-t overflow-hidden bg-slate-100"
                      style={{ height: `${heightPct}%` }}
                    >
                      {totalM > 0 ? (
                        <>
                          <div style={{ height: `${goodSegment}%` }} className="bg-[#10b981]" />
                          <div style={{ height: `${holdSegment}%` }} className="bg-[#f59e0b]" />
                          <div style={{ height: `${repSegment}%` }} className="bg-[#8b5cf6]" />
                          <div style={{ height: `${rejSegment}%` }} className="bg-[#ef4444]" />
                        </>
                      ) : (
                        <div className="w-full h-1 bg-slate-200" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bar Chart Legend */}
          <div className="flex items-center justify-center gap-3 pt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10b981]" />Good</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" />Hold</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#8b5cf6]" />Reprocess</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ef4444]" />Rejected</span>
          </div>
        </div>

        {/* Card C: QC by Supplier (Rejected %) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-900 tracking-tight mb-3">QC by Supplier (Rejected %)</h3>
          
          <div className="space-y-2.5 my-auto">
            {supplierRejection.length > 0 ? (
              supplierRejection.map((s, idx) => (
                <div key={s.supplier || idx}>
                  <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-0.5">
                    <span className="truncate max-w-[120px]">{s.supplier}</span>
                    <span className="font-semibold text-slate-700">{s.rejectedPct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#f87171] h-2 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, s.rejectedPct * 10))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                No supplier rejection history in this date range.
              </div>
            )}
          </div>
        </div>

        {/* Card D: QC by Fabric Quality */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">QC by Fabric Quality</h3>
            <select
              value={qualityTopN}
              onChange={(e) => setQualityTopN(e.target.value)}
              className="text-[10px] font-medium bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 focus:outline-none"
            >
              <option value="Top 5">Top 5</option>
              <option value="Top 10">Top 10</option>
              <option value="All">All</option>
            </select>
          </div>

          <div className="overflow-x-auto my-auto">
            {qualityBreakdown.length > 0 ? (
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-medium">
                    <th className="pb-1.5">Quality</th>
                    <th className="pb-1.5 text-right">Inspected ({cards.inspected.uom})</th>
                    <th className="pb-1.5 text-right">Rejected</th>
                    <th className="pb-1.5 text-right">Rejection %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {qualityBreakdown.map((q, idx) => (
                    <tr key={q.quality || idx}>
                      <td className="py-1 font-medium text-slate-800">{q.quality}</td>
                      <td className="py-1 text-right font-mono">{Number(q.inspected).toLocaleString('en-IN')}</td>
                      <td className="py-1 text-right font-mono text-rose-600">{Number(q.rejected).toLocaleString('en-IN')}</td>
                      <td className="py-1 text-right font-mono text-slate-500">{q.rejectionPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                No quality breakdown records found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Process Pipeline & Review Row ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Card 1: Inspection Progress (6-Step Pipeline) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-900 tracking-tight mb-3">Inspection Progress</h3>
          
          <div className="flex items-center justify-between gap-1 overflow-x-auto py-2">
            {/* Step 1: Received */}
            <div className="flex flex-col items-center text-center min-w-[70px]">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 text-blue-600 font-bold flex items-center justify-center text-xs mb-1.5 shadow-2xs bg-blue-50">
                1
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Received</span>
              <span className="text-[11px] font-bold text-slate-900 mt-0.5">
                {Number(cards.totalReceived.qty).toLocaleString('en-IN')} {cards.totalReceived.uom}
              </span>
              <span className="text-[9.5px] text-slate-400">{cards.totalReceived.lots} Lots</span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

            {/* Step 2: Inspected */}
            <div className="flex flex-col items-center text-center min-w-[70px]">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 text-emerald-600 font-bold flex items-center justify-center text-xs mb-1.5 shadow-2xs bg-emerald-50">
                2
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Inspected</span>
              <span className="text-[11px] font-bold text-slate-900 mt-0.5">
                {Number(cards.inspected.qty).toLocaleString('en-IN')} {cards.inspected.uom}
              </span>
              <span className="text-[9.5px] text-emerald-600">{cards.inspected.pct}%</span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

            {/* Step 3: Good */}
            <div className="flex flex-col items-center text-center min-w-[70px]">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 text-emerald-600 font-bold flex items-center justify-center text-xs mb-1.5 shadow-2xs bg-emerald-50">
                3
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Good</span>
              <span className="text-[11px] font-bold text-slate-900 mt-0.5">
                {Number(cards.good.qty).toLocaleString('en-IN')} {cards.good.uom}
              </span>
              <span className="text-[9.5px] text-emerald-600">{cards.good.pct}%</span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

            {/* Step 4: Hold */}
            <div className="flex flex-col items-center text-center min-w-[70px]">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500 text-amber-600 font-bold flex items-center justify-center text-xs mb-1.5 shadow-2xs bg-amber-50">
                4
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Hold</span>
              <span className="text-[11px] font-bold text-slate-900 mt-0.5">
                {Number(cards.hold.qty).toLocaleString('en-IN')} {cards.hold.uom}
              </span>
              <span className="text-[9.5px] text-amber-600">{cards.hold.pct}%</span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

            {/* Step 5: Reprocess */}
            <div className="flex flex-col items-center text-center min-w-[70px]">
              <div className="w-8 h-8 rounded-full border-2 border-purple-500 text-purple-600 font-bold flex items-center justify-center text-xs mb-1.5 shadow-2xs bg-purple-50">
                5
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Reprocess</span>
              <span className="text-[11px] font-bold text-slate-900 mt-0.5">
                {Number(cards.reprocess.qty).toLocaleString('en-IN')} {cards.reprocess.uom}
              </span>
              <span className="text-[9.5px] text-purple-600">{cards.reprocess.pct}%</span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

            {/* Step 6: Rejected */}
            <div className="flex flex-col items-center text-center min-w-[70px]">
              <div className="w-8 h-8 rounded-full border-2 border-red-500 text-red-600 font-bold flex items-center justify-center text-xs mb-1.5 shadow-2xs bg-red-50">
                6
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Rejected</span>
              <span className="text-[11px] font-bold text-slate-900 mt-0.5">
                {Number(cards.rejected.qty).toLocaleString('en-IN')} {cards.rejected.uom}
              </span>
              <span className="text-[9.5px] text-rose-600">{cards.rejected.pct}%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Inspections */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">Pending Inspections</h3>
            <button
              type="button"
              onClick={() => setActiveTab('Pending')}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-3 my-auto">
            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-red-50/70 border border-red-100 min-w-[85px] text-center">
              <Clock className="w-5 h-5 text-red-500 mb-1" />
              <span className="text-base font-bold text-slate-900">
                {Number(pendingInspections.totalQty).toLocaleString('en-IN')} {cards.totalReceived.uom}
              </span>
              <span className="text-[9.5px] text-slate-500">
                {pendingInspections.totalLots} Lots Pending
              </span>
            </div>

            <div className="flex-1 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-slate-600">
                <span>Purchase (GRN)</span>
                <span className="font-semibold text-slate-800">
                  {Number(pendingInspections.purchase?.qty || 0).toLocaleString('en-IN')} {cards.totalReceived.uom} ({pendingInspections.purchase?.lots || 0} Lots)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Job Work Inward</span>
                <span className="font-semibold text-slate-800">
                  {Number(pendingInspections.jobWork?.qty || 0).toLocaleString('en-IN')} {cards.totalReceived.uom} ({pendingInspections.jobWork?.lots || 0} Lots)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Internal Production</span>
                <span className="font-semibold text-slate-800">
                  {Number(pendingInspections.internal?.qty || 0).toLocaleString('en-IN')} {cards.totalReceived.uom} ({pendingInspections.internal?.lots || 0} Lots)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: On Hold Review */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">On Hold Review</h3>
            <button
              type="button"
              onClick={() => setActiveTab('On Hold')}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-3 my-auto">
            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 min-w-[85px] text-center">
              <Pause className="w-5 h-5 text-amber-500 mb-1" />
              <span className="text-base font-bold text-slate-900">
                {Number(onHoldReview.totalQty).toLocaleString('en-IN')} {cards.hold.uom}
              </span>
              <span className="text-[9.5px] text-slate-500">
                {onHoldReview.totalLots} Lots on Hold
              </span>
            </div>

            <div className="flex-1 space-y-1 text-[11px]">
              {onHoldReview.breakdown && onHoldReview.breakdown.length > 0 ? (
                onHoldReview.breakdown.map((b, idx) => (
                  <div key={b.reason || idx} className="flex justify-between items-center text-slate-600">
                    <span className="truncate max-w-[110px]">{b.reason}</span>
                    <span className="font-semibold text-slate-800">
                      {Number(b.qty).toLocaleString('en-IN')} {cards.hold.uom} ({b.lots} Lots)
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 py-2">No lots currently on hold.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Latest QC Inspections ─────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {/* Table Header with Tabs and Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Latest QC Inspections</h3>
            {/* Tabs */}
            <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap">
              {[
                { key: 'All', label: `All (${tabCounts.All})` },
                { key: 'Pending', label: `Pending (${tabCounts.Pending})` },
                { key: 'Completed', label: `Completed (${tabCounts.Completed})` },
                { key: 'On Hold', label: `On Hold (${tabCounts['On Hold']})` },
                { key: 'Reprocess', label: `Reprocess (${tabCounts.Reprocess})` },
                { key: 'Rejected', label: `Rejected (${tabCounts.Rejected})` },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    activeTab === t.key
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search, Filter, Export Actions */}
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by QC No., Item, Supplier..."
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
                <th className="py-2.5 px-3">QC No.</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Source Type</th>
                <th className="py-2.5 px-3">GRN / JWI No.</th>
                <th className="py-2.5 px-3">Supplier</th>
                <th className="py-2.5 px-3">Item Code</th>
                <th className="py-2.5 px-3">Item Name</th>
                <th className="py-2.5 px-3">Lot No.</th>
                <th className="py-2.5 px-3 text-center">Taka/Roll</th>
                <th className="py-2.5 px-3 text-right">Received ({cards.totalReceived.uom})</th>
                <th className="py-2.5 px-3 text-right">Inspected ({cards.inspected.uom})</th>
                <th className="py-2.5 px-3 text-right">Good ({cards.good.uom})</th>
                <th className="py-2.5 px-3 text-right">Hold ({cards.hold.uom})</th>
                <th className="py-2.5 px-3 text-right">Reprocess ({cards.reprocess.uom})</th>
                <th className="py-2.5 px-3 text-right">Rejected ({cards.rejected.uom})</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-semibold text-blue-600">{r.id}</td>
                    <td className="py-2 px-3 text-slate-500">{r.date}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {r.sourceType}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{r.refNo}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{r.supplier}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{r.itemCode}</td>
                    <td className="py-2 px-3 text-slate-800 max-w-[200px] truncate" title={r.itemName}>
                      {r.itemName}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{r.lotNo}</td>
                    <td className="py-2 px-3 text-center font-mono">{r.takaRoll}</td>
                    <td className="py-2 px-3 text-right font-mono font-medium">{Number(r.received).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right font-mono font-medium">{Number(r.inspected).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-600 font-medium">
                      {r.good > 0 ? Number(r.good).toLocaleString('en-IN') : '0'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-amber-600 font-medium">
                      {r.hold > 0 ? Number(r.hold).toLocaleString('en-IN') : '0'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-purple-600 font-medium">
                      {r.reprocess > 0 ? Number(r.reprocess).toLocaleString('en-IN') : '0'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-rose-600 font-medium">
                      {r.rejected > 0 ? Number(r.rejected).toLocaleString('en-IN') : '0'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${
                          r.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.status === 'On Hold'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : r.status === 'Reprocess' || r.status === 'Rework'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : r.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-orange-50 text-orange-700 border border-orange-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecord(r);
                          setDispositionNote(r.defectReason || '');
                        }}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-xs cursor-pointer hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Package className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-600">No QC inspection records found.</p>
                      <p className="text-slate-400 text-xs">
                        Goods receipts recorded under Purchase / GRN will automatically display here for quality verification.
                      </p>
                      <Link
                        to="/purchase/receipts"
                        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Receive Incoming Goods (GRN)
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Inspection Detail & Disposition Modal ────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                  QC
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedRecord.id} — Inspection Details</h3>
                  <p className="text-xs text-slate-400">
                    {selectedRecord.refNo} • {selectedRecord.supplier} • {selectedRecord.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Item Info Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10.5px]">Item Code</span>
                <span className="font-mono font-semibold text-slate-800">{selectedRecord.itemCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Item Name</span>
                <span className="font-medium text-slate-800 truncate block">{selectedRecord.itemName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Lot / Taka</span>
                <span className="font-semibold text-slate-800">
                  {selectedRecord.lotNo} ({selectedRecord.takaRoll} Taka)
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Inspector</span>
                <span className="font-medium text-slate-800">{selectedRecord.inspector}</span>
              </div>
            </div>

            {/* Quantity Breakdown Grid */}
            <div className={`grid grid-cols-3 ${selectedRecord.second > 0 ? "sm:grid-cols-7" : "sm:grid-cols-6"} gap-2 text-center text-xs`}>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                <span className="text-slate-400 text-[10px] block">Received</span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedRecord.received} {selectedRecord.uom}
                </span>
              </div>
              <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-2">
                <span className="text-blue-500 text-[10px] block">Inspected</span>
                <span className="font-bold text-blue-900 text-sm">
                  {selectedRecord.inspected} {selectedRecord.uom}
                </span>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-2">
                <span className="text-emerald-500 text-[10px] block">Good</span>
                <span className="font-bold text-emerald-900 text-sm">
                  {selectedRecord.good} {selectedRecord.uom}
                </span>
              </div>
              {selectedRecord.second > 0 && (
                <div className="bg-sky-50/60 border border-sky-200 rounded-lg p-2">
                  <span className="text-sky-500 text-[10px] block">Second Quality</span>
                  <span className="font-bold text-sky-900 text-sm">
                    {selectedRecord.second} {selectedRecord.uom}
                  </span>
                </div>
              )}
              <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-2">
                <span className="text-amber-500 text-[10px] block">Hold</span>
                <span className="font-bold text-amber-900 text-sm">
                  {selectedRecord.hold} {selectedRecord.uom}
                </span>
              </div>
              <div className="bg-purple-50/60 border border-purple-200 rounded-lg p-2">
                <span className="text-purple-500 text-[10px] block">Reprocess</span>
                <span className="font-bold text-purple-900 text-sm">
                  {selectedRecord.reprocess} {selectedRecord.uom}
                </span>
              </div>
              <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-2">
                <span className="text-rose-500 text-[10px] block">Rejected</span>
                <span className="font-bold text-rose-900 text-sm">
                  {selectedRecord.rejected} {selectedRecord.uom}
                </span>
              </div>
            </div>

            {/* Defect Remarks / Observations */}
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Inspection Observations & Defect Log
              </h4>
              <textarea
                value={dispositionNote}
                onChange={(e) => setDispositionNote(e.target.value)}
                placeholder="Enter inspection remarks, defect points or disposition rationale..."
                className="w-full h-16 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Disposition Actions */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <span className="font-semibold text-slate-700 block">Record Disposition Verdict:</span>
              {!canDisposeSelected ? (
                <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600">
                  {selectedRecord.receiptId
                    ? 'QC for this GRN is already recorded — nothing is left at QC Hold to disposition.'
                    : 'Record the verdict for job-work inwards from the Pending Inspections screen.'}
                </p>
              ) : selectedRecord.awaiting > 0 && (
                <p className="text-slate-500">
                  Applies to the {selectedRecord.awaiting} {selectedRecord.uom} still at QC Hold.
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={updatingDisposition || !canDisposeSelected}
                  onClick={() => handleUpdateDisposition('Approved')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ Pass & Approve Good
                </button>
                <button
                  type="button"
                  disabled={updatingDisposition || !canDisposeSelected}
                  onClick={() => handleUpdateDisposition('Pending Approval')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⏸ Move to QC Hold
                </button>
                <button
                  type="button"
                  disabled={updatingDisposition || !canDisposeSelected}
                  onClick={() => handleUpdateDisposition('Rework')}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ↻ Send for Reprocess
                </button>
                <button
                  type="button"
                  disabled={updatingDisposition || !canDisposeSelected}
                  onClick={() => handleUpdateDisposition('Rejected')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✕ Reject Lot
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                Current Status: <span className="font-semibold text-slate-800">{selectedRecord.status}</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
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
