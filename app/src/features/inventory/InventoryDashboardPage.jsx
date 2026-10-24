import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  CheckCircle2,
  FlaskConical,
  Trash2,
  RefreshCw,
  Undo2,
  Warehouse,
  FolderTree,
  Scissors,
  Palette,
  Calendar,
  Info,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShoppingCart,
  Clock,
  XCircle,
  RotateCcw,
  RefreshCwOff,
  Filter,
  AlertCircle,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { inventoryService } from '../../services/domainServices';
import PageInfoButton from '../../components/ui/PageInfoButton';

// Helper for Indian Currency Formatting
function formatINR(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹ 0';
  const num = Math.round(Number(val));
  return '₹ ' + num.toLocaleString('en-IN');
}

// Helper for Quantity Formatting
function formatQty(val, uom = '') {
  if (val === null) return 'Mixed units';
  if (val === undefined || isNaN(val)) return '0.00' + (uom ? ` ${uom}` : '');
  const num = Number(val);
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return uom ? `${formatted} ${uom}` : formatted;
}

// Helper for Compact Quantities/Values (e.g. 52.4k, 4.68 Cr)
function formatCompact(val) {
  const n = Number(val || 0);
  if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000) return (n / 100000).toFixed(2) + ' L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString('en-IN');
}

export function InventoryDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters state
  const [godown, setGodown] = useState('');
  const [category, setCategory] = useState('');
  const [fabric, setFabric] = useState('');
  const [colour, setColour] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Widget switchers
  const [distMode, setDistMode] = useState('qty'); // 'qty' | 'val'
  const [trendMode, setTrendMode] = useState('qty'); // 'qty' | 'val'
  const [trendCat, setTrendCat] = useState('all');
  const [catMode, setCatMode] = useState('qty'); // 'qty' | 'val'
  const [godownMode, setGodownMode] = useState('qty'); // 'qty' | 'val'

  // Fetch dashboard data strictly from backend API
  const fetchDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const query = {};
      if (godown) query.godown_id = godown;
      if (category) query.category_id = category;
      if (fabric) query.fabric = fabric;
      if (colour) query.colour = colour;
      if (startDate) query.start_date = startDate;
      if (endDate) query.end_date = endDate;

      const res = await inventoryService.getDashboard(query);
      setData(res);
      // Sync date range if not customized by user
      if (!startDate && res?.filters?.dateRange?.from) {
        setStartDate(res.filters.dateRange.from);
      }
      if (!endDate && res?.filters?.dateRange?.to) {
        setEndDate(res.filters.dateRange.to);
      }
    } catch (err) {
      console.error('Failed to load inventory dashboard:', err);
      setError(err?.message || 'Unable to load inventory dashboard data from backend server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [godown, category, fabric, colour, startDate, endDate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // The stock unit of the items in view; quantities in different units are
  // never summed, so combined figures read "Mixed units" when there are several.
  const unitsMixed = Boolean(data?.units?.mixed);
  const scopeUom = data?.units?.inScope?.length === 1 ? data.units.inScope[0] : 'Mtr';

  // Summary Cards
  const cards = useMemo(() => {
    const sc = data?.summaryCards || {};
    return [
      {
        id: 'total',
        title: 'Total Fabric Stock',
        qty: sc.totalStock ? sc.totalStock.qty : 0,
        byUom: sc.totalStock?.byUom,
        uom: sc.totalStock?.uom || scopeUom,
        val: sc.totalStock?.value || 0,
        change: sc.totalStock?.changePct ?? 0,
        changeLabel: 'vs last month',
        icon: Layers,
        iconBg: '#eff6ff',
        iconColor: '#2563eb',
        borderColor: '#bfdbfe',
        info: 'Total physical inventory across all locations & QC states',
      },
      {
        id: 'good',
        title: 'Good Fabric Stock',
        qty: sc.goodStock ? sc.goodStock.qty : 0,
        byUom: sc.goodStock?.byUom,
        uom: sc.goodStock?.uom || scopeUom,
        val: sc.goodStock?.value || 0,
        change: sc.goodStock?.changePct ?? 0,
        changeLabel: '',
        icon: CheckCircle2,
        iconBg: '#f0fdf4',
        iconColor: '#16a34a',
        borderColor: '#bbf7d0',
        info: 'QC-passed ready-for-use or sale fabric',
      },
      {
        id: 'sample',
        title: 'Sample Stock',
        qty: sc.sampleStock ? sc.sampleStock.qty : 0,
        byUom: sc.sampleStock?.byUom,
        uom: sc.sampleStock?.uom || scopeUom,
        val: sc.sampleStock?.value || 0,
        change: sc.sampleStock?.changePct ?? 0,
        changeLabel: '',
        icon: FlaskConical,
        iconBg: '#f0fdfa',
        iconColor: '#0d9488',
        borderColor: '#99f6e4',
        info: 'Cut pieces and lab samples retained for testing & client display',
      },
      {
        id: 'wastage',
        title: 'Wastage Stock',
        qty: sc.wastageStock ? sc.wastageStock.qty : 0,
        byUom: sc.wastageStock?.byUom,
        uom: sc.wastageStock?.uom || scopeUom,
        val: sc.wastageStock?.value || 0,
        change: sc.wastageStock?.changePct ?? 0,
        changeLabel: '',
        icon: Trash2,
        iconBg: '#fff1f2',
        iconColor: '#e11d48',
        borderColor: '#fecdd3',
        info: 'Damaged, rejected, cut-waste and salvage stock',
      },
      {
        id: 'reprocessing',
        title: 'Reprocessing Stock',
        qty: sc.reprocessingStock ? sc.reprocessingStock.qty : 0,
        byUom: sc.reprocessingStock?.byUom,
        uom: sc.reprocessingStock?.uom || scopeUom,
        val: sc.reprocessingStock?.value || 0,
        change: sc.reprocessingStock?.changePct ?? 0,
        changeLabel: '',
        icon: RefreshCw,
        iconBg: '#fffbeb',
        iconColor: '#d97706',
        borderColor: '#fde68a',
        info: 'Fabric dispatched or set aside for dyeing, printing or re-washing',
      },
      {
        id: 'customerReturn',
        title: 'Customer Return Stock',
        qty: sc.customerReturnStock ? sc.customerReturnStock.qty : 0,
        byUom: sc.customerReturnStock?.byUom,
        uom: sc.customerReturnStock?.uom || scopeUom,
        val: sc.customerReturnStock?.value || 0,
        change: sc.customerReturnStock?.changePct ?? 0,
        changeLabel: '',
        icon: Undo2,
        iconBg: '#f5f3ff',
        iconColor: '#7c3aed',
        borderColor: '#ddd6fe',
        info: 'Material received back from customers pending QC verification',
      },
    ];
  }, [data, scopeUom]);

  // Donut SVG Calculations for Stock Distribution
  const donutData = useMemo(() => {
    const rawList = data?.stockDistribution || [];
    const isVal = distMode === 'val';
    const total = rawList.reduce((acc, item) => acc + (isVal ? item.value : item.qty), 0);

    if (total <= 0) {
      return {
        totalDisplay: isVal ? '₹ 0' : '0.00 Mtr',
        slices: [],
        items: rawList.map((it) => ({
          ...it,
          displayVal: isVal ? formatINR(it.value) : formatQty(it.qty),
          pct: 0,
        })),
      };
    }

    let cumAngle = 0;
    const slices = rawList.map((it) => {
      const val = isVal ? it.value : it.qty;
      const pct = (val / total) * 100;
      const angle = (val / total) * 360;
      const start = cumAngle;
      cumAngle += angle;
      return {
        ...it,
        pct: Number(pct.toFixed(1)),
        startAngle: start,
        endAngle: cumAngle,
        val,
      };
    });

    return {
      totalDisplay: isVal ? formatINR(total) : formatQty(unitsMixed ? null : total, scopeUom),
      slices,
      items: rawList.map((it) => ({
        ...it,
        displayVal: isVal ? formatINR(it.value) : formatQty(it.qty),
        pct: isVal ? it.pctValue : it.pct,
      })),
    };
  }, [data, distMode, scopeUom, unitsMixed]);

  // Line Chart Calculations for Stock Trend
  const trendData = useMemo(() => {
    const list = data?.stockTrend || [];
    if (!list.length) return { points: [], maxVal: 100, yLabels: [0, 25, 50, 75, 100] };

    const vals = list.flatMap((item) => [
      item.total || 0,
      item.good || 0,
      item.sample || 0,
      item.wastage || 0,
      item.reprocessing || 0,
      item.customerReturn || 0,
      item.greyWip || 0,
    ]);
    const peak = Math.max(...vals, 10);
    // Nice rounded peak (e.g. 100, 1000, 20000, 60000)
    const factor = Math.pow(10, Math.floor(Math.log10(peak)));
    const roundedMax = Math.ceil(peak / (factor / 2)) * (factor / 2) || 100;

    const yLabels = [
      0,
      Math.round(roundedMax * 0.25),
      Math.round(roundedMax * 0.5),
      Math.round(roundedMax * 0.75),
      roundedMax,
    ];

    return {
      points: list,
      maxVal: roundedMax,
      yLabels,
    };
  }, [data]);

  return (
    <div className="space-y-5">
      {/* ── TOP HEADER & FILTER BAR ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Inventory Dashboard
            </h1>
            <PageInfoButton title="Inventory Dashboard" />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Live overview of fabric stock, QC status, movement and value
          </p>
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Godown Selector */}
          <div className="relative inline-flex items-center">
            <span className="absolute left-2.5 text-slate-400 pointer-events-none">
              <Warehouse size={14} />
            </span>
            <select
              value={godown}
              onChange={(e) => setGodown(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer appearance-none"
            >
              <option value="">All Godown</option>
              {data?.filters?.godowns?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 text-slate-400 pointer-events-none" />
          </div>

          {/* Fabric Category Selector */}
          <div className="relative inline-flex items-center">
            <span className="absolute left-2.5 text-slate-400 pointer-events-none">
              <FolderTree size={14} />
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer appearance-none"
            >
              <option value="">All Fabric Category</option>
              {data?.filters?.categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 text-slate-400 pointer-events-none" />
          </div>

          {/* Fabric Selector */}
          <div className="relative inline-flex items-center">
            <span className="absolute left-2.5 text-slate-400 pointer-events-none">
              <Scissors size={14} />
            </span>
            <select
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer appearance-none"
            >
              <option value="">All Fabric</option>
              {data?.filters?.fabrics?.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 text-slate-400 pointer-events-none" />
          </div>

          {/* Colour Selector */}
          <div className="relative inline-flex items-center">
            <span className="absolute left-2.5 text-slate-400 pointer-events-none">
              <Palette size={14} />
            </span>
            <select
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs cursor-pointer appearance-none"
            >
              <option value="">All Colour</option>
              {data?.filters?.colours?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 text-slate-400 pointer-events-none" />
          </div>

          {/* Date Range Picker */}
          <div className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 shadow-xs">
            <Calendar size={13} className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
              title="Start Date"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
              title="End Date"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchDashboard(true)}
            disabled={loading || refreshing}
            className="h-8 w-8 grid place-items-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-blue-600 hover:border-slate-300 shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchDashboard()}
            className="px-2.5 py-1 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── ROW 1: 6 TOP METRIC TILES ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {cards.map((card) => {
          const Icon = card.icon;
          const isUp = card.change >= 0;
          return (
            <div
              key={card.id}
              className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3.5 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                {/* Header: Icon + Title */}
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg shadow-2xs"
                    style={{ background: card.iconBg, color: card.iconColor }}
                  >
                    <Icon size={17} />
                  </span>
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span
                      className="text-xs font-bold text-slate-700 truncate"
                      title={card.title}
                    >
                      {card.title}
                    </span>
                    {card.info && (
                      <span title={card.info} className="text-slate-300 hover:text-slate-500 cursor-help">
                        <Info size={12} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Primary Metric: Quantity */}
                <div className="text-lg sm:text-[19px] font-extrabold tracking-tight text-slate-900 leading-none">
                  {loading ? (
                    <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
                  ) : (
                    card.byUom?.length
                      // Several units in view: show each unit, never one summed figure.
                      ? <span className="text-[15px]">{card.byUom.map((u) => formatQty(u.qty, u.uom)).join(' + ')}</span>
                      : formatQty(card.qty, card.uom)
                  )}
                </div>

                {/* Secondary Metric: Valuation INR */}
                <div className="text-xs font-semibold text-slate-500 mt-1">
                  {loading ? (
                    <div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse mt-1" />
                  ) : (
                    formatINR(card.val)
                  )}
                </div>
              </div>

              {/* Trend Badge */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] font-bold">
                {card.change !== 0 ? (
                  <>
                    {isUp ? (
                      <TrendingUp size={12} className="text-emerald-600" />
                    ) : (
                      <TrendingDown size={12} className="text-rose-500" />
                    )}
                    <span className={isUp ? 'text-emerald-600' : 'text-rose-500'}>
                      {isUp ? '+' : ''}
                      {card.change.toFixed(1)}%
                    </span>
                    {card.changeLabel && (
                      <span className="text-slate-400 font-normal ml-0.5">
                        {card.changeLabel}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400 font-medium">0.0% vs last month</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ROW 2: 3 WIDGETS (DISTRIBUTION, TREND, CATEGORY-WISE) ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Widget 1: Stock Distribution (Donut Chart) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              Stock Distribution ({distMode === 'qty' ? 'Quantity' : 'Value'})
            </h2>
            <div className="relative inline-flex items-center">
              <select
                value={distMode}
                onChange={(e) => setDistMode(e.target.value)}
                className="h-7 px-2 pr-6 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none cursor-pointer appearance-none"
              >
                <option value="qty">Quantity (Mtr)</option>
                <option value="val">Value (₹)</option>
              </select>
              <ChevronDown size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Donut Chart & Legend Body */}
          <div className="flex flex-col sm:flex-row items-center gap-4 py-3 my-auto">
            {/* Donut SVG */}
            <div className="relative shrink-0 w-36 h-36 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="15"
                />
                {/* Segments */}
                {donutData.slices.map((slice, idx) => {
                  if (slice.val <= 0) return null;
                  const r = 38;
                  const c = 2 * Math.PI * r;
                  const dash = (slice.pct / 100) * c;
                  const offset = c - ((slice.startAngle / 360) * c);
                  return (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r={r}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="15"
                      strokeDasharray={`${dash} ${c}`}
                      strokeDashoffset={-((slice.startAngle / 360) * c)}
                      className="transition-all duration-500 hover:opacity-85"
                    />
                  );
                })}
              </svg>
              {/* Donut Hole Center Value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
                <span className="text-[13px] font-extrabold text-slate-900 leading-tight">
                  {donutData.totalDisplay}
                </span>
                <span className="text-[10px] font-medium text-slate-400">Total</span>
              </div>
            </div>

            {/* Legend Breakdown List */}
            <div className="flex-1 w-full space-y-1.5 min-w-0">
              {donutData.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-0.5 hover:bg-slate-50 px-1 rounded transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: item.color }}
                    />
                    <span className="font-semibold text-slate-700 truncate text-[11.5px]">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                    <span className="text-slate-800 font-bold">{item.displayVal}</span>
                    <span className="text-slate-400 w-11 text-right">{item.pct.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Widget 2: Stock Trend (Last 6 Months Multi-Line Chart) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              Stock Trend (Last 6 Months)
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative inline-flex items-center">
                <select
                  value={trendMode}
                  onChange={(e) => setTrendMode(e.target.value)}
                  className="h-7 px-2 pr-6 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="qty">Quantity (Mtr)</option>
                  <option value="val">Value (₹)</option>
                </select>
                <ChevronDown size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative inline-flex items-center">
                <select
                  value={trendCat}
                  onChange={(e) => setTrendCat(e.target.value)}
                  className="h-7 px-2 pr-6 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="all">All Categories</option>
                  {data?.filters?.categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* SVG Multi-Line Chart */}
          <div className="py-2 my-auto">
            <div className="relative h-44 w-full">
              <svg viewBox="0 0 320 140" className="w-full h-full overflow-visible">
                {/* Horizontal Grid Lines */}
                {trendData.yLabels.map((lbl, idx) => {
                  const y = 120 - (idx * (100 / (trendData.yLabels.length - 1)));
                  return (
                    <g key={idx}>
                      <line
                        x1="35"
                        y1={y}
                        x2="310"
                        y2={y}
                        stroke="#f1f5f9"
                        strokeDasharray="2 2"
                        strokeWidth="1"
                      />
                      <text
                        x="30"
                        y={y + 3}
                        textAnchor="end"
                        fontSize="8"
                        fill="#94a3b8"
                        fontWeight="600"
                        fontFamily="monospace"
                      >
                        {formatCompact(lbl)}
                      </text>
                    </g>
                  );
                })}

                {/* Vertical Guides and Month Labels */}
                {trendData.points.map((pt, idx) => {
                  const count = trendData.points.length;
                  const x = 45 + (idx * ((300 - 45) / Math.max(1, count - 1)));
                  return (
                    <g key={idx}>
                      <line
                        x1={x}
                        y1="20"
                        x2={x}
                        y2="120"
                        stroke="#f8fafc"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y="132"
                        textAnchor="middle"
                        fontSize="9"
                        fill="#64748b"
                        fontWeight="bold"
                      >
                        {pt.month}
                      </text>
                    </g>
                  );
                })}

                {/* Primary Trend Line (Good Fabric) */}
                {trendData.points.length > 1 && (
                  (() => {
                    const count = trendData.points.length;
                    const coords = trendData.points.map((pt, idx) => {
                      const x = 45 + (idx * ((300 - 45) / Math.max(1, count - 1)));
                      const y = 120 - ((pt.total / trendData.maxVal) * 100);
                      return `${x},${y}`;
                    });
                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={coords.join(' ')}
                        />
                        {/* Data dots */}
                        {trendData.points.map((pt, idx) => {
                          const x = 45 + (idx * ((300 - 45) / Math.max(1, count - 1)));
                          const y = 120 - ((pt.total / trendData.maxVal) * 100);
                          return (
                            <circle
                              key={idx}
                              cx={x}
                              cy={y}
                              r="3.5"
                              fill="#2563eb"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                            />
                          );
                        })}
                      </>
                    );
                  })()
                )}
              </svg>
            </div>

            {/* Bottom Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[10.5px] font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2563eb]" /> Good Fabric
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#06b6d4]" /> Sample
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f43f5e]" /> Wastage
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Reprocessing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" /> Customer Return
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#94a3b8]" /> Grey / WIP
              </span>
            </div>
          </div>
        </div>

        {/* Widget 3: Fabric Category-wise Stock (Horizontal Bars) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              Fabric Category-wise Stock
            </h2>
            <div className="relative inline-flex items-center">
              <select
                value={catMode}
                onChange={(e) => setCatMode(e.target.value)}
                className="h-7 px-2 pr-6 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none cursor-pointer appearance-none"
              >
                <option value="qty">Quantity (Mtr)</option>
                <option value="val">Value (₹)</option>
              </select>
              <ChevronDown size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Bar List */}
          <div className="space-y-2.5 py-2 my-auto">
            {(data?.categoryWiseStock || []).slice(0, 7).map((cat, idx) => {
              const maxQ = Math.max(...(data?.categoryWiseStock || []).map((c) => (catMode === 'val' ? c.value : c.qty)), 1);
              const curVal = catMode === 'val' ? cat.value : cat.qty;
              const fillPct = Math.min(100, Math.round((curVal / maxQ) * 100));

              // Colors matching Oscar categories
              const gradients = [
                'from-blue-500 to-indigo-600',
                'from-cyan-500 to-blue-500',
                'from-teal-400 to-emerald-500',
                'from-amber-400 to-orange-500',
                'from-rose-400 to-pink-500',
                'from-purple-400 to-violet-600',
                'from-slate-400 to-slate-600',
              ];
              const grad = gradients[idx % gradients.length];

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 truncate pr-2">{cat.category}</span>
                    <span className="text-slate-900 font-bold font-mono">
                      {catMode === 'val' ? formatINR(cat.value) : formatQty(cat.qty)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${grad} rounded-full transition-all duration-500`}
                      style={{ width: `${curVal > 0 ? fillPct : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {(!data?.categoryWiseStock || data.categoryWiseStock.length === 0) && (
              <div className="py-8 text-center text-slate-400 text-xs">
                No fabric stock by category recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 3: 3 BOTTOM WIDGETS (STOCK BY GODOWN, QC SUMMARY, RECENT MOVEMENTS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Widget 1: Stock by Godown Table */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              Stock by Godown
            </h2>
            <div className="relative inline-flex items-center">
              <select
                value={godownMode}
                onChange={(e) => setGodownMode(e.target.value)}
                className="h-7 px-2 pr-6 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none cursor-pointer appearance-none"
              >
                <option value="qty">Quantity (Mtr)</option>
                <option value="val">Value (₹)</option>
              </select>
              <ChevronDown size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto py-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2 pr-2">Godown</th>
                  <th className="py-2 px-2 text-right">Total Stock</th>
                  <th className="py-2 px-2 text-right text-emerald-600">Good</th>
                  <th className="py-2 px-2 text-right text-cyan-600">Sample</th>
                  <th className="py-2 px-2 text-right text-rose-600">Wastage</th>
                  <th className="py-2 px-2 text-right text-blue-600">Reprocess</th>
                  <th className="py-2 px-2 text-right text-purple-600">Customer Return</th>
                  <th className="py-2 pl-2 text-right text-slate-500">Grey / WIP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11.5px]">
                {(data?.stockByGodown || []).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 pr-2 font-sans font-bold text-slate-800">
                      {row.godown}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900">
                      {formatQty(row.totalStock)}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-600 font-semibold">
                      {row.good > 0 ? formatQty(row.good) : '-'}
                    </td>
                    <td className="py-2 px-2 text-right text-cyan-600">
                      {row.sample > 0 ? formatQty(row.sample) : '-'}
                    </td>
                    <td className="py-2 px-2 text-right text-rose-600">
                      {row.wastage > 0 ? formatQty(row.wastage) : '-'}
                    </td>
                    <td className="py-2 px-2 text-right text-blue-600">
                      {row.reprocess > 0 ? formatQty(row.reprocess) : '-'}
                    </td>
                    <td className="py-2 px-2 text-right text-purple-600">
                      {row.customerReturn > 0 ? formatQty(row.customerReturn) : '-'}
                    </td>
                    <td className="py-2 pl-2 text-right text-slate-500">
                      {row.greyWip > 0 ? formatQty(row.greyWip) : '-'}
                    </td>
                  </tr>
                ))}

                {/* If no locations registered */}
                {(!data?.stockByGodown || data.stockByGodown.length === 0) && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center font-sans text-slate-400">
                      No godown records found. Stocks will reflect here once established.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Total Footer */}
              {data?.stockByGodown?.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold text-[11.5px] font-mono text-slate-900 bg-slate-50/50">
                    <td className="py-2 pr-2 font-sans">Total</td>
                    <td className="py-2 px-2 text-right">
                      {formatQty(
                        data.stockByGodown.reduce((sum, r) => sum + (r.totalStock || 0), 0)
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-600">
                      {formatQty(
                        data.stockByGodown.reduce((sum, r) => sum + (r.good || 0), 0)
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-cyan-600">
                      {formatQty(
                        data.stockByGodown.reduce((sum, r) => sum + (r.sample || 0), 0)
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-rose-600">
                      {formatQty(
                        data.stockByGodown.reduce((sum, r) => sum + (r.wastage || 0), 0)
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-blue-600">
                      {formatQty(
                        data.stockByGodown.reduce((sum, r) => sum + (r.reprocess || 0), 0)
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-purple-600">
                      {formatQty(
                        data.stockByGodown.reduce((sum, r) => sum + (r.customerReturn || 0), 0)
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right text-slate-600">
                      {formatQty(
                        data.stockByGodown.reduce((sum, r) => sum + (r.greyWip || 0), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Widget 2: QC Summary (This Month) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              QC Summary (This Month)
            </h2>
            <Link
              to="/inventory/qc"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
            >
              View Details
            </Link>
          </div>

          {/* QC Status Rows */}
          <div className="space-y-3 py-2 my-auto">
            {/* Total Received (GRN) */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/60 border border-blue-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white grid place-items-center shadow-xs">
                  <ShoppingCart size={14} />
                </span>
                <div>
                  <div className="text-[11px] font-bold text-slate-600 leading-tight">
                    Total Received (GRN)
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 font-mono">
                    {formatQty(unitsMixed ? null : (data?.qcSummary?.totalReceived?.qty || 0), scopeUom)}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                {data?.qcSummary?.totalReceived?.challans || 0} Challans
              </span>
            </div>

            {/* QC Passed (Good) */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white grid place-items-center shadow-xs">
                  <CheckCircle2 size={14} />
                </span>
                <div>
                  <div className="text-[11px] font-bold text-slate-600 leading-tight">
                    QC Passed (Good)
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 font-mono">
                    {formatQty(unitsMixed ? null : (data?.qcSummary?.qcPassed?.qty || 0), scopeUom)}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                {(data?.qcSummary?.qcPassed?.pct || 0).toFixed(1)}%
              </span>
            </div>

            {/* QC On Hold */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-amber-500 text-white grid place-items-center shadow-xs">
                  <Clock size={14} />
                </span>
                <div>
                  <div className="text-[11px] font-bold text-slate-600 leading-tight">
                    QC On Hold
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 font-mono">
                    {formatQty(unitsMixed ? null : (data?.qcSummary?.qcOnHold?.qty || 0), scopeUom)}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                {(data?.qcSummary?.qcOnHold?.pct || 0).toFixed(1)}%
              </span>
            </div>

            {/* QC Rejected (Wastage) */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/60 border border-rose-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-rose-600 text-white grid place-items-center shadow-xs">
                  <XCircle size={14} />
                </span>
                <div>
                  <div className="text-[11px] font-bold text-slate-600 leading-tight">
                    QC Rejected (Wastage)
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 font-mono">
                    {formatQty(unitsMixed ? null : (data?.qcSummary?.qcRejected?.qty || 0), scopeUom)}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                {(data?.qcSummary?.qcRejected?.pct || 0).toFixed(1)}%
              </span>
            </div>

            {/* Sent for Reprocessing */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50/60 border border-purple-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-purple-600 text-white grid place-items-center shadow-xs">
                  <RotateCcw size={14} />
                </span>
                <div>
                  <div className="text-[11px] font-bold text-slate-600 leading-tight">
                    Sent for Reprocessing
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 font-mono">
                    {formatQty(unitsMixed ? null : (data?.qcSummary?.sentForReprocessing?.qty || 0), scopeUom)}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full">
                {(data?.qcSummary?.sentForReprocessing?.pct || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Widget 3: Recent Stock Movements Table */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              Recent Stock Movements
            </h2>
            <Link
              to="/inventory/stock-position"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
            >
              View All
            </Link>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto py-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2 pr-1">Date</th>
                  <th className="py-2 px-1">Type</th>
                  <th className="py-2 px-1">Ref No.</th>
                  <th className="py-2 px-1">Fabric</th>
                  <th className="py-2 px-1 text-right">Qty (Mtr)</th>
                  <th className="py-2 px-1">Category</th>
                  <th className="py-2 pl-1">Godown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {(data?.recentMovements || []).slice(0, 8).map((m, idx) => {
                  // Category Badge Colors
                  const catBadgeColors = {
                    Inward: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    Good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    Wastage: 'bg-rose-50 text-rose-700 border-rose-200',
                    Sample: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                    Reprocessing: 'bg-amber-50 text-amber-700 border-amber-200',
                    'Customer Return': 'bg-purple-50 text-purple-700 border-purple-200',
                    Transfer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                  };
                  const badgeClass =
                    catBadgeColors[m.category] || 'bg-slate-50 text-slate-700 border-slate-200';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-1.5 pr-1 whitespace-nowrap text-slate-500 font-mono text-[10px]">
                        {m.date}
                      </td>
                      <td className="py-1.5 px-1 font-bold text-slate-700">
                        {m.type}
                      </td>
                      <td className="py-1.5 px-1 font-mono text-slate-600 text-[10.5px]">
                        {m.refNo}
                      </td>
                      <td className="py-1.5 px-1 font-medium text-slate-800 truncate max-w-[80px]" title={m.fabric}>
                        {m.fabric}
                      </td>
                      <td className="py-1.5 px-1 text-right font-bold text-slate-900 font-mono">
                        {formatQty(m.qty)}
                      </td>
                      <td className="py-1.5 px-1">
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${badgeClass}`}
                        >
                          {m.category}
                        </span>
                      </td>
                      <td className="py-1.5 pl-1 text-slate-600 truncate max-w-[65px]" title={m.godown}>
                        {m.godown}
                      </td>
                    </tr>
                  );
                })}

                {/* If no movements recorded */}
                {(!data?.recentMovements || data.recentMovements.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans text-xs">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InventoryDashboardPage;
