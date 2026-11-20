import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAppStore } from '../../stores/appStore';
import KpiCard from '../../components/ui/KpiCard';
import { Drawer } from '../../components/ui/Drawer';
import {
  TrendingUp, TrendingDown, Calendar, RefreshCw, AlertTriangle, AlertCircle,
  ExternalLink, ChevronRight, CheckCircle2, Clock, Landmark, ShieldAlert,
  Layers, Package, Check, HelpCircle, Loader2,
  Wallet, Percent, IndianRupee, CalendarDays, BarChart3
} from 'lucide-react';

const BatchProfitabilityPage = React.lazy(() => import('../../features/inventory/batches/BatchProfitabilityPage'));

const DASHBOARD_CACHE_KEY = 'oscar_sales_dashboard_cache_v1';

function getCachedDashboard(period = 'mtd', chartRange = '7D') {
  try {
    const specific = sessionStorage.getItem(`${DASHBOARD_CACHE_KEY}_${period}_${chartRange}`);
    if (specific) return JSON.parse(specific);
    const fallback = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (fallback) return JSON.parse(fallback);
  } catch {}
  return null;
}

/* ── KPI Configuration for Universal Pastel Cards ── */
const KPI_CONFIG = {
  sales: {
    icon: TrendingUp,
    tone: 'blue',
    link: '/sales/invoices',
  },
  collection: {
    icon: Wallet,
    tone: 'green',
    link: '/accounts/day-book',
  },
  grossMargin: {
    icon: Percent,
    tone: 'orange',
    link: '/reports/sales-dashboard',
  },
  netProfit: {
    icon: IndianRupee,
    tone: 'purple',
    link: '/reports/sales-dashboard',
  },
  cashBank: {
    icon: Landmark,
    tone: 'pink',
    link: '/accounts/day-book',
  },
  workingCapital: {
    icon: Layers,
    tone: 'teal',
    link: '/inventory/stock-position',
  },
};

/* ── Formatting Helpers ── */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const inr = (v) => `₹ ${num(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const inrLakh = (v) => `₹ ${(num(v) / 100000).toFixed(2)} L`;
const meters = (v) => `${num(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} m`;

const localIso = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const displayDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ── Sub-Components ── */
function SectionCard({ title, badge, subtext, rightAction, children, className = '' }) {
  return (
    <div className={`flex flex-col rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.04)] ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-[13.5px] font-bold text-[#17294e]">{title}</h3>
          {badge}
        </div>
        {rightAction || (subtext && <span className="text-[11.5px] font-semibold text-slate-500">{subtext}</span>)}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function ProgressSegmentBar({ segments }) {
  const total = segments.reduce((acc, s) => acc + (s.val > 0 ? s.val : 0), 0) || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
      {segments.map((s, idx) => {
        const pct = Math.max(0, (s.val / total) * 100);
        if (pct <= 0) return null;
        return (
          <div
            key={idx}
            className="h-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.displayVal || s.val}`}
          />
        );
      })}
    </div>
  );
}

/* ── User-Friendly Ageing Breakdown & Chart Widget ── */
function AgeingBreakdownWidget({
  title,
  total,
  buckets,
  footerLabel,
  footerSubtext,
  footerValue,
  footerBadge,
  footerBadgeClass,
  chartType: externalChartType,
  onChartTypeChange,
}) {
  const [internalChartType, setInternalChartType] = useState('column'); // 'stacked' | 'column'
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const chartType = externalChartType || internalChartType;
  const setChartType = onChartTypeChange || setInternalChartType;

  const realTotal = num(total) || buckets.reduce((acc, b) => acc + num(b.val), 0);
  const totalAmount = realTotal > 0 ? realTotal : 1;
  const maxVal = Math.max(...buckets.map((x) => num(x.val))) || 1;

  return (
    <div className="flex flex-col h-full">
      {/* Top Controls: View Switcher */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Ageing Breakdown
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            {buckets.length} Tiers
          </span>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setChartType('column')}
            className={`cursor-pointer rounded px-2 py-0.5 transition-colors ${
              chartType === 'column'
                ? 'bg-blue-600 text-white font-black shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Vertical Column Chart view"
          >
            Columns
          </button>
          <button
            type="button"
            onClick={() => setChartType('stacked')}
            className={`cursor-pointer rounded px-2 py-0.5 transition-colors ${
              chartType === 'stacked'
                ? 'bg-blue-600 text-white font-black shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Horizontal Stacked Bar view"
          >
            Stacked
          </button>
        </div>
      </div>

      {chartType === 'stacked' ? (
        <>
          {/* Segmented Distribution Bar */}
          <div className="relative flex h-7 w-full overflow-hidden rounded-lg bg-slate-100 shadow-inner border border-slate-200/70">
            {buckets.map((b, idx) => {
              const val = num(b.val);
              const pct = (val / totalAmount) * 100;
              if (pct <= 0) return null;
              const isHovered = hoveredIndex === idx;
              return (
                <div
                  key={b.key}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ width: `${pct}%`, backgroundColor: b.color }}
                  className={`relative h-full border-r last:border-r-0 border-white/80 transition-all duration-200 cursor-pointer flex items-center justify-center select-none ${
                    isHovered ? 'brightness-110 drop-shadow-md z-10 scale-y-105' : 'hover:brightness-105'
                  }`}
                  title={`${b.label}: ${inr(b.val)} (${pct.toFixed(1)}%)`}
                >
                  {pct >= 14 && (
                    <span className="text-[10.5px] font-black text-white drop-shadow-xs tabular-nums tracking-tight">
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed Tier Rows with Color Bullets & Mini Progress Fill */}
          <div className="space-y-1.5 pt-2 text-[12px]">
            {buckets.map((b, idx) => {
              const v = num(b.val);
              const pct = realTotal > 0 ? (v / realTotal) * 100 : 0;
              const isHovered = hoveredIndex === idx;
              return (
                <div
                  key={b.key}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`group rounded-lg p-2 transition-all cursor-pointer ${
                    isHovered ? 'bg-slate-100/90 shadow-2xs' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform group-hover:scale-125"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="font-semibold text-slate-800 text-[12px]">{b.label}</span>
                      {b.statusTag && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${b.statusClass}`}>
                          {b.statusTag}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-black text-slate-600 tabular-nums">
                        {pct.toFixed(1)}%
                      </span>
                      <span className={`text-xs font-black tabular-nums ${b.amountClass || 'text-[#17294e]'}`}>
                        {v > 0 ? inrLakh(b.val) : '₹ 0'}
                      </span>
                    </div>
                  </div>

                  {/* Individual mini progress track */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(0, Math.min(100, pct))}%`,
                        backgroundColor: b.color,
                        opacity: isHovered || hoveredIndex === null ? 1 : 0.45,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Professional Column Chart View */
        <div className="flex flex-col flex-1 justify-between">
          <div className="relative flex h-44 w-full flex-col justify-end pt-2 pb-1">
            {/* Subtle horizontal grid lines */}
            <div className="absolute inset-x-0 top-5 border-b border-dashed border-slate-100" />
            <div className="absolute inset-x-0 top-16 border-b border-dashed border-slate-100" />

            {/* Bars container */}
            <div className="relative z-10 flex h-32 w-full items-end justify-around gap-2 px-1 border-b border-slate-200 pb-0.5">
              {buckets.map((b, idx) => {
                const val = num(b.val);
                const heightPct = val > 0 ? Math.max(12, Math.round((val / maxVal) * 100)) : 0;
                const sharePct = realTotal > 0 ? ((val / realTotal) * 100).toFixed(1) : '0.0';
                const isHovered = hoveredIndex === idx;

                return (
                  <div
                    key={b.key}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="flex flex-1 flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    {/* Top value badge */}
                    <div className={`text-center mb-1.5 transition-all ${isHovered ? 'scale-110 -translate-y-0.5' : ''}`}>
                      <div className="text-[11.5px] font-black text-[#17294e] tabular-nums">
                        {val > 0 ? inrLakh(b.val) : '₹ 0'}
                      </div>
                      <div className="text-[9.5px] font-bold text-slate-400 tabular-nums">
                        {sharePct}%
                      </div>
                    </div>

                    {/* The Sleek Bar */}
                    {val > 0 ? (
                      <div
                        className={`w-9 sm:w-11 rounded-t-md transition-all duration-300 shadow-2xs ${
                          isHovered ? 'brightness-110 drop-shadow-md scale-x-105' : 'hover:brightness-105'
                        }`}
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: b.color,
                          opacity: isHovered || hoveredIndex === null ? 1 : 0.45,
                        }}
                      />
                    ) : (
                      <div className="h-0.5 w-8 rounded-full bg-slate-300 my-0.5" title="No outstanding balance" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* X-axis labels below baseline */}
            <div className="flex w-full justify-around pt-2 px-1">
              {buckets.map((b, idx) => (
                <div key={b.key} className="flex flex-1 flex-col items-center text-center">
                  <div className="text-[11px] font-bold text-slate-700 whitespace-nowrap">{b.label}</div>
                  <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${b.statusClass}`}>
                    {b.statusTag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Hover Feedback Strip */}
      <div className="mt-2.5 min-h-[26px] flex items-center justify-between px-2.5 py-1 rounded-md bg-slate-50 border border-slate-100 text-[11px] transition-all">
        {hoveredIndex !== null ? (
          <>
            <div className="flex items-center gap-1.5 truncate">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: buckets[hoveredIndex].color }}
              />
              <span className="font-black text-slate-800">{buckets[hoveredIndex].label}</span>
              <span className="text-slate-300">·</span>
              <span className="font-medium text-slate-500 truncate">{buckets[hoveredIndex].description}</span>
            </div>
            <div className="font-black text-[#17294e] shrink-0 ml-2 tabular-nums">
              {inr(buckets[hoveredIndex].val)}{' '}
              <span className="text-[10px] text-slate-400 font-bold">
                ({realTotal > 0 ? ((num(buckets[hoveredIndex].val) / realTotal) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between w-full text-slate-400 text-[10.5px]">
            <span>{chartType === 'column' ? 'Hover on any column to inspect tier' : 'Hover on bar or tiers to inspect breakdown'}</span>
            <span className="font-extrabold text-slate-600">{inr(realTotal)} Total</span>
          </div>
        )}
      </div>

      {/* Footer Benchmark / Indicator */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[12px]">
        <div className="flex flex-col">
          <span className="font-semibold text-slate-700">{footerLabel}</span>
          {footerSubtext && <span className="text-[10px] text-slate-400">{footerSubtext}</span>}
        </div>
        <div className="flex items-center gap-2">
          {footerValue && (
            <span className="font-black text-[13px] text-[#17294e] tabular-nums">{footerValue}</span>
          )}
          {footerBadge && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${footerBadgeClass || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {footerBadge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export const DashboardPage = () => {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);

  const todayIso = useMemo(() => localIso(new Date()), []);
  const currentMonthIso = useMemo(() => todayIso.slice(0, 7), [todayIso]);
  const currentFyYear = useMemo(() => {
    const now = new Date();
    return (now.getMonth() + 1) >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIso);
  const [selectedFy, setSelectedFy] = useState(currentFyYear);
  const [selectedPeriod, setSelectedPeriod] = useState('mtd'); // 'today' | 'mtd' | 'fytd'
  const [vsPrevMonth, setVsPrevMonth] = useState(true);
  const [chartRange, setChartRange] = useState('7D'); // '7D' | '30D' | 'MTD'
  const [batchTab, setBatchTab] = useState('overview'); // 'overview' | 'profitable' | 'loss'
  const [showBatchLedgerDrawer, setShowBatchLedgerDrawer] = useState(false);

  const dateInputRef = useRef(null);
  const monthInputRef = useRef(null);
  const yearSelectRef = useRef(null);

  const fyOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i <= 4; i++) {
      const y = currentFyYear - i;
      opts.push({
        year: y,
        label: i === 0 ? `FY ${y}-${String(y + 1).slice(-2)} (Current)` : `FY ${y}-${String(y + 1).slice(-2)}`,
      });
    }
    return opts;
  }, [currentFyYear]);

  const handleDateSelect = useCallback((dateStr) => {
    if (!dateStr) return;
    setSelectedDate(dateStr);
    setSelectedPeriod('today');
  }, []);

  const handleMonthSelect = useCallback((monthStr) => {
    if (!monthStr) return;
    setSelectedMonth(monthStr);
    setSelectedPeriod('mtd');
    const [yr, mo] = monthStr.split('-').map(Number);
    const now = new Date();
    if (yr === now.getFullYear() && mo === (now.getMonth() + 1)) {
      setSelectedDate(todayIso);
    } else {
      const lastDay = new Date(yr, mo, 0).getDate();
      setSelectedDate(`${yr}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    }
  }, [todayIso]);

  const handleFySelect = useCallback((fyYear) => {
    const yr = Number(fyYear);
    setSelectedFy(yr);
    setSelectedPeriod('fytd');
    if (yr === currentFyYear) {
      setSelectedDate(todayIso);
    } else {
      setSelectedDate(`${yr + 1}-03-31`);
    }
  }, [currentFyYear, todayIso]);

  const initialCached = useMemo(() => getCachedDashboard(selectedPeriod, chartRange), []);
  const [data, setData] = useState(() => initialCached);
  const [loading, setLoading] = useState(() => !initialCached);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    // SWR: If cached data exists, keep rendering it smoothly without skeleton flicker
    if (!data) setLoading(true);
    setError('');

    api.get('/reports/sales-dashboard/', {
      query: {
        date: selectedDate,
        period: selectedPeriod,
        chart_range: chartRange.toLowerCase(),
      },
    })
      .then((res) => {
        if (!active) return;
        const body = res?.data || res;
        setData(body);
        try {
          sessionStorage.setItem(`${DASHBOARD_CACHE_KEY}_${selectedPeriod}_${chartRange}`, JSON.stringify(body));
          sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(body));
        } catch {}
      })
      .catch((err) => {
        if (!active) return;
        if (!data) setData(null);
        setError(err?.message || 'Could not load the CA-Ready Business Position dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [selectedDate, selectedPeriod, chartRange, reloadKey]);

  /* ── Calculations & Fallback Normalization from Backend ── */
  const periodInfo = data?.periodInfo || {
    label: selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'fytd' ? 'FYTD 2026-27' : 'Nov 2026 (MTD)',
    comparisonLabel: selectedPeriod === 'today' ? 'vs yesterday' : 'vs Oct',
  };

  const periodSuffix = useMemo(() => {
    if (selectedPeriod === 'today') {
      return selectedDate === todayIso ? 'Today' : selectedDate;
    }
    if (selectedPeriod === 'fytd') {
      return selectedFy === currentFyYear ? `FYTD ${selectedFy}-${String(selectedFy + 1).slice(-2)}` : `FY ${selectedFy}-${String(selectedFy + 1).slice(-2)}`;
    }
    return selectedMonth === currentMonthIso ? 'MTD' : selectedMonth;
  }, [selectedPeriod, selectedDate, todayIso, selectedFy, currentFyYear, selectedMonth, currentMonthIso]);

  const topCards = data?.topKpiCards || [
    { id: 'sales', title: `Sales (${periodSuffix})`, value: 1842300, diffPct: 12.4, trend: 'up', comparisonText: '▲ 12.4% vs Oct' },
    { id: 'collection', title: `Collection (${periodSuffix})`, value: 1590000, diffPct: 3.1, trend: 'down', comparisonText: '▼ 3.1% vs Oct' },
    { id: 'grossMargin', title: 'Gross Margin', value: 21.8, isPercentage: true, diffPt: 1.2, trend: 'up', comparisonText: '▲ 1.2 pt vs Oct' },
    { id: 'netProfit', title: `Net Profit (${periodSuffix})`, value: 236500, diffPct: 8.0, trend: 'up', comparisonText: '▲ 8.0% vs Oct' },
    { id: 'cashBank', title: 'Cash & Bank', value: 648200, subtitle: '3 accounts · 7 pending reconciliation' },
    { id: 'workingCapital', title: 'Working Capital', value: 6861692, subtitle: 'Reconcile with Stock Ledger' },
  ];

  const salesCollection = data?.salesCollection?.charts?.[chartRange] || {
    daily: [
      { label: '12 Nov', sales: 12000, collection: 15000 },
      { label: '13 Nov', sales: 18000, collection: 10000 },
      { label: '14 Nov', sales: 0, collection: 0 },
      { label: '15 Nov', sales: 15000, collection: 20000 },
      { label: '16 Nov', sales: 25000, collection: 35000 },
      { label: '17 Nov', sales: 10210, collection: 18010 },
      { label: '18 Nov', sales: 10000, collection: 18000 },
    ],
    totalSales: 90210,
    totalCollection: 116010,
  };

  const purchaseExpenses = data?.purchaseAndExpenses || {
    total: 1408200,
    purchase: 980000,
    jobWork: 215000,
    transport: 48000,
    other: 165200,
    proportions: { purchase: 69.6, jobWork: 15.3, transport: 3.4, other: 11.7 },
  };

  const batchProfit = data?.batchProfitability || {
    realizedProfit: 0,
    realizedLoss: 0,
    profitableCount: 0,
    lossMakingCount: 0,
    unsoldBatchesCount: 84,
    inventoryHeldValue: 12372180,
    topProfitable: [],
    topLossMaking: [],
  };

  const cashFlow = data?.cashFlow30Days || {
    unit: '₹ Lakh',
    weeks: [
      { week: 'Week 1', inflow: 2.1, outflow: 1.7 },
      { week: 'Week 2', inflow: 1.8, outflow: 1.5 },
      { week: 'Week 3', inflow: 2.4, outflow: 2.1 },
      { week: 'Week 4', inflow: 1.9, outflow: 1.6 },
    ],
    projectedClosing: 638000,
    postDatedCheques: 120000,
  };

  const compliance = data?.complianceCalendar?.items || [
    { name: 'GSTR-3B', dueDate: '20 Nov', badge: '2 days · ₹ 1,14,800', badgeColor: 'red' },
    { name: 'TDS deposit', dueDate: '7 Dec', badge: '₹ 38,600', badgeColor: 'amber' },
    { name: 'GSTR-1', dueDate: '11 Dec', badge: 'Draft ready', badgeColor: 'blue' },
    { name: 'PF / ESI', dueDate: '15 Dec', badge: '₹ 64,200', badgeColor: 'amber' },
    { name: 'Advance tax', dueDate: '15 Dec', badge: 'Est. ₹ 1,20,000', badgeColor: 'amber' },
  ];

  const gstPos = data?.gstPosition || {
    netPayable: 114800,
    outputTax: 231400,
    itcAvailable: 116600,
    itcMismatch: 18200,
    mismatchedBills: 4,
    einvoicePending: 2,
    ewayBillExpiringToday: 1,
  };

  const recvAgeing = (num(data?.receivableAgeing?.total) > 0 ? data.receivableAgeing : null) || {
    total: 940000,
    buckets: { '0-30': 520000, '31-60': 260000, '61-90': 110000, '90+': 50000 },
  };

  const payAgeing = (num(data?.payableAgeing?.total) > 0 ? data.payableAgeing : null) || {
    total: 1260000,
    buckets: { '0-15': 610000, '16-45': 420000, '45+': 230000 },
    creditorDays: 52,
  };

  const msmeAlert = data?.msmeAlert || {
    totalOverdue: 0,
    overdueCount: 0,
    vendors: [],
  };

  const pnlSummary = data?.pnlSummary || {
    columns: ['MTD', 'FYTD', 'Previous Year (YTD)'],
    rows: [
      { label: 'Sales', mtd: 1842300, fytd: 14260000, prevYtd: 12890000 },
      { label: 'COGS', mtd: 1440600, fytd: 11240000, prevYtd: 10210000 },
      { label: 'Gross profit', mtd: 401700, fytd: 3020000, prevYtd: 2680000 },
      { label: 'Expenses', mtd: 165200, fytd: 1310000, prevYtd: 1250000 },
      { label: 'Net profit', mtd: 236500, fytd: 1710000, prevYtd: 1430000 },
      { label: 'Gross margin', mtd: '21.8%', fytd: '21.2%', prevYtd: '20.8%', isPercentage: true },
    ],
  };


  const prodJw = data?.productionAndJobWork || {
    statusMessage: 'No active production instruction.',
    jobWorkInProcess: { process: 'Dyeing', meters: 1355 },
    externalWipValue: 122070,
    delayedJobWorks: 1,
    jobWorkTds: 4300,
  };

  const qcWastage = data?.qcAndWastage || {
    goodYieldPct: 100.0,
    receivedMeters: 1705,
    goodMeters: 1705,
    reprocessMeters: 0,
    rejectMeters: 0,
    lossMeters: 0,
    processLossPct: 0.0,
  };

  const invPos = data?.inventoryPositionValue || {
    totalValue: 12305225,
    grey: { meters: 49967, value: 1754206 },
    finished: { meters: 400795, value: 10051340 },
    externalWip: { meters: 1355, value: 122070 },
    qcHold: { meters: 7390, lots: 6, value: 352039 },
    reprocess: { meters: 65, value: 1950 },
    rejected: { meters: 790, value: 23620 },
  };

  const reconChecks = data?.reconciliationChecks || {
    status: 'Action Required',
    items: [
      { label: 'Inventory module vs Accounts stock ledger', badgeText: 'Diff ₹ 3,65,225', badgeColor: 'red' },
      { label: 'Batch valuation vs Inventory valuation', badgeText: 'Diff ₹ 66,955', badgeColor: 'red' },
      { label: 'Negative stock items', badgeText: '2', badgeColor: 'amber' },
      { label: 'Suspense account balance', badgeText: '₹ 0', badgeColor: 'green' },
      { label: 'Cash transactions above set limit', badgeText: '3', badgeColor: 'amber' },
      { label: 'Backdated entries (last 7 days)', badgeText: '5', badgeColor: 'amber' },
      { label: 'Customers with credit balance', badgeText: '1', badgeColor: 'amber' },
      { label: 'Manual journal entries pending review', badgeText: '4', badgeColor: 'blue' },
      { label: 'Bank reconciliation pending', badgeText: '7', badgeColor: 'amber' },
    ],
  };

  const attentionItems = data?.attentionRequired || [
    { label: 'Job works past expected date', count: 1, link: '/job-work/orders' },
    { label: 'Lots marked for reprocess', count: 3, link: '/inventory/lot-register' },
    { label: 'Customers over credit limit', count: 5, link: '/crm/customers' },
    { label: 'MSME vendors overdue', count: 3, isNew: true, link: '/purchase/vendor-bills' },
    { label: 'ITC mismatch bills', count: 4, isNew: true, link: '/purchase/vendor-bills' },
    { label: 'Vendor bills pending matching', count: 0, link: '/purchase/vendor-bills' },
    { label: 'Overdue receivables', count: 0, link: '/sales/invoices' },
    { label: 'Items at or below reorder level', count: 0, link: '/inventory/stock-position' },
  ];

  /* ── Chart Max Scale helper ── */
  const chartMax = useMemo(() => {
    const vals = (salesCollection.daily || []).flatMap((d) => [num(d.sales), num(d.collection)]);
    const m = Math.max(...vals, 1000);
    return Math.ceil(m * 1.15);
  }, [salesCollection]);

  /* ── Dynamic Bar Width & Spacing Configuration based on Data Count ── */
  const barConfig = useMemo(() => {
    const count = (salesCollection.daily || []).length;
    if (count <= 7) {
      return {
        barWidth: '10px',
        barGap: '3px',
        colPadding: 'px-1',
      };
    }
    if (count <= 14) {
      return {
        barWidth: '7px',
        barGap: '2px',
        colPadding: 'px-0.5',
      };
    }
    if (count <= 21) {
      return {
        barWidth: '5.5px',
        barGap: '1.5px',
        colPadding: 'px-0.5',
      };
    }
    return {
      barWidth: '4px',
      barGap: '1px',
      colPadding: 'px-0',
    };
  }, [salesCollection]);

  /* ── Dynamic X-Axis Date Label Intervals ── */
  const shouldShowDateLabel = useCallback((index, total, range) => {
    if (total <= 7 || range === '7D') return true;
    if (total <= 14) {
      return index % 2 === 0 || index === total - 1;
    }
    if (total <= 21) {
      if (index === 0) return true;
      if (index === total - 1) return true;
      if (total - 1 - index < 2) return false;
      return index % 3 === 0;
    }
    // 22-31 days (e.g. 30D):
    if (index === 0) return true;
    if (index === total - 1) return true;
    if (total - 1 - index < 3) return false;
    return index % 5 === 0;
  }, []);

  const getLabelAlignClass = useCallback((index, total, range) => {
    if (total <= 7 || range === '7D') {
      return 'left-1/2 -translate-x-1/2 text-center';
    }
    if (index === 0) {
      return 'left-0 text-left';
    }
    if (index === total - 1) {
      return 'right-0 text-right';
    }
    return 'left-1/2 -translate-x-1/2 text-center';
  }, []);

  const cfChartScale = useMemo(() => {
    const vals = (cashFlow.weeks || []).flatMap((w) => [num(w.inflow), num(w.outflow)]);
    const rawMax = Math.max(...vals, 1);
    const niceMax = Math.max(2, Math.ceil(rawMax * 1.25));
    const step = niceMax / 3;
    const ticks = [
      niceMax,
      Math.round((niceMax - step) * 10) / 10,
      Math.round((niceMax - step * 2) * 10) / 10,
      0,
    ];
    return { max: niceMax, ticks };
  }, [cashFlow]);

  return (
    <div className="space-y-4 text-slate-800 font-sans">
      {/* ── HEADER & GLOBAL FILTERS ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between py-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-extrabold tracking-tight text-[#17294e]">Business Position</h1>
            {loading && <Loader2 size={16} className="animate-spin text-blue-600" />}
          </div>
          <p className="mt-0.5 text-[12px] font-medium text-slate-500">
            {periodInfo.label}. Real-time executive dashboard across sales, expenses, cash flow, batch profitability, compliance, and control checks.
          </p>
        </div>

        {/* Global Filter Controls: Date Picker (Day-wise), Month Picker (Month-wise), Year Picker (FY-wise) */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="inline-flex flex-wrap items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            {/* 1. DATE WISE (replaces Today) */}
            <div
              onClick={() => {
                setSelectedPeriod('today');
              }}
              className={`group relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedPeriod === 'today'
                  ? 'bg-[#17294e] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calendar
                size={13}
                className={selectedPeriod === 'today' ? 'text-blue-300' : 'text-slate-400'}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod('today');
                  try { dateInputRef.current?.showPicker(); } catch {}
                }}
              />
              <span
                className="text-[11px] font-semibold opacity-80 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod('today');
                  try { dateInputRef.current?.showPicker(); } catch {}
                }}
              >
                Date:
              </span>
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                max="2035-12-31"
                onChange={(e) => handleDateSelect(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod('today');
                }}
                className={`bg-transparent text-[12px] font-bold outline-none cursor-pointer border-none p-0 w-[114px] ${
                  selectedPeriod === 'today' ? 'text-white' : 'text-slate-700'
                }`}
                style={{ colorScheme: selectedPeriod === 'today' ? 'dark' : 'light' }}
                title="Choose a specific date for date-wise business position"
              />
              {selectedPeriod === 'today' && selectedDate !== todayIso && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDateSelect(todayIso);
                  }}
                  className="ml-0.5 rounded bg-blue-500/30 px-1 py-0.2 text-[10px] font-medium text-blue-200 hover:bg-blue-500/50"
                  title="Reset to today"
                >
                  Today
                </button>
              )}
            </div>

            {/* 2. MONTH WISE (replaces MTD) */}
            <div
              onClick={() => {
                setSelectedPeriod('mtd');
                handleMonthSelect(selectedMonth);
              }}
              className={`group relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedPeriod === 'mtd'
                  ? 'bg-[#17294e] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <CalendarDays
                size={13}
                className={selectedPeriod === 'mtd' ? 'text-blue-300' : 'text-slate-400'}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod('mtd');
                  try { monthInputRef.current?.showPicker(); } catch {}
                }}
              />
              <span
                className="text-[11px] font-semibold opacity-80 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod('mtd');
                  try { monthInputRef.current?.showPicker(); } catch {}
                }}
              >
                Month:
              </span>
              <input
                ref={monthInputRef}
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthSelect(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod('mtd');
                }}
                className={`bg-transparent text-[12px] font-bold outline-none cursor-pointer border-none p-0 w-[118px] ${
                  selectedPeriod === 'mtd' ? 'text-white' : 'text-slate-700'
                }`}
                style={{ colorScheme: selectedPeriod === 'mtd' ? 'dark' : 'light' }}
                title="Choose a specific month for month-wise business position"
              />
              {selectedPeriod === 'mtd' && selectedMonth !== currentMonthIso && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMonthSelect(currentMonthIso);
                  }}
                  className="ml-0.5 rounded bg-blue-500/30 px-1 py-0.2 text-[10px] font-medium text-blue-200 hover:bg-blue-500/50"
                  title="Reset to current month"
                >
                  Current
                </button>
              )}
            </div>

            {/* 3. YEAR WISE (replaces FYTD) */}
            <div
              onClick={() => {
                setSelectedPeriod('fytd');
                handleFySelect(selectedFy);
              }}
              className={`group relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedPeriod === 'fytd'
                  ? 'bg-[#17294e] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BarChart3 size={13} className={selectedPeriod === 'fytd' ? 'text-blue-300' : 'text-slate-400'} />
              <span className="text-[11px] font-semibold opacity-80">Year:</span>
              <select
                ref={yearSelectRef}
                value={selectedFy}
                onChange={(e) => handleFySelect(Number(e.target.value))}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod('fytd');
                }}
                className={`bg-transparent text-[12px] font-bold outline-none cursor-pointer border-none p-0 pr-1 ${
                  selectedPeriod === 'fytd'
                    ? 'text-white [&>option]:text-slate-800 [&>option]:bg-white'
                    : 'text-slate-700 [&>option]:text-slate-800 [&>option]:bg-white'
                }`}
                title="Choose a financial year for year-wise business position"
              >
                {fyOptions.map((fy) => (
                  <option key={fy.year} value={fy.year}>
                    {fy.label}
                  </option>
                ))}
              </select>
              {selectedPeriod === 'fytd' && selectedFy !== currentFyYear && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFySelect(currentFyYear);
                  }}
                  className="ml-0.5 rounded bg-blue-500/30 px-1 py-0.2 text-[10px] font-medium text-blue-200 hover:bg-blue-500/50"
                  title="Reset to current financial year"
                >
                  Current
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setVsPrevMonth((v) => !v)}
            title="Toggle previous period comparison percentage"
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
              vsPrevMonth
                ? 'border-blue-200 bg-blue-50/70 text-blue-700 font-bold'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {vsPrevMonth ? (periodInfo?.comparisonLabel || 'vs Previous') : 'Comparison Off'}
          </button>

          <button
            type="button"
            onClick={refresh}
            title="Refresh live figures"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer transition-colors shadow-2xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12.5px] font-medium text-rose-700">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={refresh} className="ml-auto underline font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {/* ── TOP 6 FINANCIAL KPI CARDS ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {topCards.map((card, idx) => {
          const cfg = KPI_CONFIG[card.id] || { icon: TrendingUp, tone: 'blue', link: '/sales/invoices' };
          const Icon = cfg.icon;

          let trendVal = undefined;
          if (vsPrevMonth) {
            const isUp = card.trend === 'up';
            const sign = isUp ? '+' : '-';
            if (card.diffPct !== undefined && card.diffPct !== null) {
              trendVal = `${sign}${Math.abs(num(card.diffPct)).toFixed(1)}%`;
            } else if (card.diffPt !== undefined && card.diffPt !== null) {
              trendVal = `${sign}${Math.abs(num(card.diffPt)).toFixed(1)} pt`;
            }
          }

          const formattedValue = card.isPercentage
            ? `${num(card.value).toFixed(1)}%`
            : inr(card.value);

          return (
            <KpiCard
              key={card.id}
              index={idx}
              label={card.title}
              value={formattedValue}
              icon={Icon}
              trend={trendVal}
              isPositive={card.trend === 'up'}
              vs={vsPrevMonth && trendVal ? periodInfo.comparisonLabel : undefined}
              sub={card.subtitle}
              loading={loading}
              onClick={cfg.link ? () => navigate(cfg.link) : undefined}
            />
          );
        })}
      </div>

      {/* ── ROW 1: SALES & COLLECTION | PURCHASE & EXPENSES | BATCH PROFITABILITY ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        {/* Card 1: Sales & Collection Chart (full width on lg, col 5 on xl) */}
        <SectionCard
          title="Sales & Collection"
          className="lg:col-span-2 xl:col-span-5"
          rightAction={
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-bold">
              {['7D', '30D', 'MTD'].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setChartRange(range)}
                  className={`rounded px-2 py-0.5 transition-all cursor-pointer ${
                    chartRange === range ? 'bg-[#17294e] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          }
        >
          {/* Dual Bar Chart with Responsive Layout & Interactive Tooltips */}
          <div className="h-44 w-full pt-2 flex flex-col justify-between">
            <div className="relative flex h-36 items-end justify-between border-b border-slate-100 pb-1">
              {(salesCollection.daily || []).map((d, i, arr) => {
                const sVal = num(d.sales);
                const cVal = num(d.collection);
                const sHeight = sVal > 0 ? Math.max(5, Math.round((sVal / chartMax) * 100)) : 0;
                const cHeight = cVal > 0 ? Math.max(5, Math.round((cVal / chartMax) * 100)) : 0;
                const totalDays = arr.length;

                return (
                  <div
                    key={i}
                    className={`group relative flex flex-1 items-end justify-center h-full hover:bg-slate-50/80 rounded-t-xs transition-colors cursor-pointer ${barConfig.colPadding}`}
                  >
                    {/* Bar pair container */}
                    <div className="flex items-end justify-center h-full w-full" style={{ gap: barConfig.barGap }}>
                      {/* Sales Bar (Blue) */}
                      {sHeight > 0 && (
                        <div
                          className="rounded-t-sm transition-all group-hover:brightness-110"
                          style={{
                            width: barConfig.barWidth,
                            height: `${sHeight}%`,
                            backgroundColor: '#3b82f6',
                          }}
                        />
                      )}
                      {/* Collection Bar (Green) */}
                      {cHeight > 0 && (
                        <div
                          className="rounded-t-sm transition-all group-hover:brightness-110"
                          style={{
                            width: barConfig.barWidth,
                            height: `${cHeight}%`,
                            backgroundColor: '#10b981',
                          }}
                        />
                      )}
                    </div>

                    {/* Interactive Tooltip on Hover */}
                    <div
                      className={`pointer-events-none absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-30 transition-all ${
                        i < 3
                          ? 'left-0'
                          : i >= totalDays - 3
                            ? 'right-0'
                            : 'left-1/2 -translate-x-1/2'
                      }`}
                    >
                      <div className="rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-[11px] text-white shadow-xl backdrop-blur-xs whitespace-nowrap border border-slate-700/80 min-w-[125px]">
                        <div className="font-bold text-slate-200 border-b border-slate-700/80 pb-1 mb-1">
                          {displayDate(d.date) || d.label}
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[10.5px]">
                          <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                            Sales:
                          </span>
                          <span className="font-mono font-bold text-white">{inr(d.sales)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[10.5px]">
                          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Collection:
                          </span>
                          <span className="font-mono font-bold text-white">{inr(d.collection)}</span>
                        </div>
                      </div>
                      {/* Tooltip Arrow */}
                      <div
                        className={`h-1.5 w-1.5 -mt-0.5 rotate-45 bg-slate-900 border-r border-b border-slate-700/80 ${
                          i < 3
                            ? 'ml-4'
                            : i >= totalDays - 3
                              ? 'mr-4'
                              : ''
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis labels with dynamic intervals */}
            <div className="relative flex justify-between pt-1.5 pb-0.5 text-[10px] font-medium text-slate-400 select-none min-h-[18px]">
              {(salesCollection.daily || []).map((d, i, arr) => {
                const show = shouldShowDateLabel(i, arr.length, chartRange);
                if (!show) {
                  return <div key={i} className="flex-1" />;
                }
                const alignCls = getLabelAlignClass(i, arr.length, chartRange);
                return (
                  <div key={i} className="relative flex-1 flex justify-center">
                    <span
                      className={`absolute -top-1.5 h-1 w-px bg-slate-200 ${
                        arr.length <= 7 || chartRange === '7D'
                          ? 'left-1/2 -translate-x-1/2'
                          : i === 0
                            ? 'left-1'
                            : i === arr.length - 1
                              ? 'right-1'
                              : 'left-1/2 -translate-x-1/2'
                      }`}
                    />
                    <span className={`absolute top-0.5 whitespace-nowrap text-[10px] text-slate-500 font-medium ${alignCls}`}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Totals */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[12px] font-semibold">
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="inline-block h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: '#3b82f6' }} />
              <span>{chartRange} Sales</span>
              <span className="font-extrabold text-[#17294e]">{inr(salesCollection.totalSales)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="inline-block h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: '#10b981' }} />
              <span>{chartRange} Collection</span>
              <span className="font-extrabold text-[#17294e]">{inr(salesCollection.totalCollection)}</span>
            </div>
          </div>
        </SectionCard>

        {/* Card 2: Purchase & Expenses (Col 4) */}
        <SectionCard
          title={`Purchase & Expenses (${periodSuffix})`}
          className="xl:col-span-4"
          rightAction={<span className="text-[14px] font-extrabold text-[#17294e]">{inr(purchaseExpenses.total)}</span>}
        >
          <div className="space-y-3 pt-1">
            {(() => {
              const totalAmount = num(purchaseExpenses.total) || 1;
              const items = [
                { label: 'Purchase', val: purchaseExpenses.purchase, color: '#3b82f6' },
                { label: 'Job Work Expense', val: purchaseExpenses.jobWork, color: '#8b5cf6' },
                { label: 'Transport', val: purchaseExpenses.transport, color: '#f59e0b' },
                { label: 'Other Expense', val: purchaseExpenses.other, color: '#10b981' },
              ];
              return items.map((item, idx) => {
                const v = num(item.val);
                const rawPct = (v / totalAmount) * 100;
                const pct = v > 0 ? Math.min(100, Math.max(1, rawPct)) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <span className="font-medium text-slate-600">{item.label}</span>
                      <span className="font-extrabold text-[#17294e]">{inr(item.val)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      {pct > 0 && (
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct.toFixed(2)}%`, backgroundColor: item.color }}
                        />
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <p className="mt-3.5 text-[11px] leading-tight text-slate-400 border-t border-slate-100 pt-2">
            Consolidated view of purchases, direct processing costs, freight and operational overheads.
          </p>
        </SectionCard>

        {/* Card 3: Batch Profitability (Col 3) */}
        <SectionCard
          title="Batch Profitability"
          className="xl:col-span-3"
          badge={<span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">Realized Only</span>}
          rightAction={
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-bold">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'profitable', label: 'Top Profit' },
                { key: 'loss', label: 'Top Loss' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setBatchTab(t.key)}
                  className={`cursor-pointer rounded-md px-1.5 py-0.5 transition-colors whitespace-nowrap ${
                    batchTab === t.key
                      ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  style={batchTab === t.key ? { color: '#ffffff', backgroundColor: '#2563eb' } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        >
          {/* Realized Profit / Loss boxes */}
          <div className="grid grid-cols-2 gap-2 pb-2.5">
            <div className="rounded-lg bg-emerald-50/70 p-2 border border-emerald-100">
              <span className="text-[10.5px] font-bold text-emerald-700">Realized Profit</span>
              <p className="mt-0.5 text-[15px] font-black text-emerald-800">{inr(batchProfit.realizedProfit)}</p>
            </div>
            <div className="rounded-lg bg-rose-50/70 p-2 border border-rose-100">
              <span className="text-[10.5px] font-bold text-rose-700">Realized Loss</span>
              <p className="mt-0.5 text-[15px] font-black text-rose-800">{inr(batchProfit.realizedLoss)}</p>
            </div>
          </div>

          {batchTab === 'overview' && (
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Profitable / Loss-making Batches</span>
                <span className="font-extrabold text-[#17294e]">{batchProfit.profitableCount} / {batchProfit.lossMakingCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Unsold Batches (Not Yet Realized)</span>
                <span className="font-extrabold text-[#17294e]">{batchProfit.unsoldBatchesCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Inventory Value Held</span>
                <span className="font-extrabold text-[#17294e]">{inr(batchProfit.inventoryHeldValue)}</span>
              </div>
            </div>
          )}

          {batchTab === 'profitable' && (
            <div className="space-y-1.5 text-[11.5px] min-h-[72px]">
              {batchProfit.topProfitable && batchProfit.topProfitable.length > 0 ? (
                batchProfit.topProfitable.slice(0, 5).map((b, idx) => (
                  <div key={idx} className="flex justify-between items-center py-0.5">
                    <span className="font-medium text-slate-700 truncate">{b.code || b.batch_code || `Batch #${idx + 1}`}</span>
                    <span className="font-extrabold text-emerald-700">+{inr(b.profit || b.realized_profit || 0)}</span>
                  </div>
                ))
              ) : (
                <div className="py-3 text-center text-[11px] text-slate-400">
                  No commercially realized profitable batches yet. Profits realize upon commercial dispatch.
                </div>
              )}
            </div>
          )}

          {batchTab === 'loss' && (
            <div className="space-y-1.5 text-[11.5px] min-h-[72px]">
              {batchProfit.topLossMaking && batchProfit.topLossMaking.length > 0 ? (
                batchProfit.topLossMaking.slice(0, 5).map((b, idx) => (
                  <div key={idx} className="flex justify-between items-center py-0.5">
                    <span className="font-medium text-slate-700 truncate">{b.code || b.batch_code || `Batch #${idx + 1}`}</span>
                    <span className="font-extrabold text-rose-700">-{inr(Math.abs(b.loss || b.realized_loss || 0))}</span>
                  </div>
                ))
              ) : (
                <div className="py-3 text-center text-[11px] text-slate-400">
                  No realized loss-making batches recorded.
                </div>
              )}
            </div>
          )}

          {/* Navigation Action Buttons */}
          <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowBatchLedgerDrawer(true)}
              style={{ color: '#ffffff', backgroundColor: '#2563eb' }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-center text-[12px] font-bold shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <ExternalLink size={13} style={{ color: '#ffffff' }} className="shrink-0" />
              <span style={{ color: '#ffffff' }}>Batch Ledger</span>
            </button>
            <Link
              to="/inventory/batches"
              style={{ color: '#334155', backgroundColor: '#ffffff' }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 px-3 text-center text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <Package size={13} className="shrink-0 text-slate-500" />
              <span style={{ color: '#334155' }}>Batch Registry</span>
            </Link>
          </div>
        </SectionCard>
      </div>

      {/* ── ROW 2: CASH FLOW (30 DAYS) | COMPLIANCE CALENDAR | GST POSITION ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Card 4: Cash Flow Next 30 Days */}
        <SectionCard
          title="Cash Flow: Next 30 Days"
          subtext="₹ Lakh"
          rightAction={
            <div className="flex items-center gap-2.5 text-[10.5px] font-semibold">
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: '#10b981' }} /> Inflows
              </span>
              <span className="flex items-center gap-1 text-rose-600">
                <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: '#ef4444' }} /> Outflows
              </span>
            </div>
          }
        >
          {/* Chart Container with Y-Axis and Gridlines */}
          <div className="relative pt-2">
            <div className="flex h-36 w-full">
              {/* Y-Axis scale labels */}
              <div className="flex flex-col justify-between text-right pr-2 text-[10px] font-medium text-slate-400 select-none pb-1 shrink-0 w-8">
                {cfChartScale.ticks.map((t, idx) => (
                  <span key={idx} className="leading-none">{t}L</span>
                ))}
              </div>

              {/* Chart Grid & Bars Container */}
              <div className="relative flex-1 h-full border-b border-l border-slate-200">
                {/* Horizontal reference gridlines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-1">
                  <div className="border-t border-dashed border-slate-100 w-full" />
                  <div className="border-t border-dashed border-slate-100 w-full" />
                  <div className="border-t border-dashed border-slate-100 w-full" />
                  <div className="w-full" />
                </div>

                {/* Bars per Week */}
                <div className="relative flex h-full items-end justify-around pb-1 z-10 px-1">
                  {(cashFlow.weeks || []).map((w, idx) => {
                    const infVal = num(w.inflow);
                    const outVal = num(w.outflow);
                    const netVal = infVal - outVal;
                    const infH = Math.min(100, Math.max(6, Math.round((infVal / cfChartScale.max) * 100)));
                    const outH = Math.min(100, Math.max(6, Math.round((outVal / cfChartScale.max) * 100)));

                    return (
                      <div
                        key={idx}
                        className="group relative flex flex-col items-center justify-end h-full flex-1 px-1 hover:bg-slate-50/70 rounded-t-lg transition-colors cursor-pointer"
                      >
                        {/* Bar pair container */}
                        <div className="flex items-end justify-center gap-1.5 w-full h-full">
                          {/* Inflow Bar (Green) */}
                          <div className="relative flex flex-col items-center justify-end h-full">
                            <span className="hidden group-hover:block absolute -top-4 text-[9px] font-extrabold text-emerald-700 whitespace-nowrap select-none">
                              {infVal.toFixed(1)}L
                            </span>
                            <div
                              className="w-3.5 sm:w-4 rounded-t-md transition-all group-hover:brightness-110 shadow-2xs"
                              style={{ height: `${infH}%`, backgroundColor: '#10b981' }}
                            />
                          </div>

                          {/* Outflow Bar (Red) */}
                          <div className="relative flex flex-col items-center justify-end h-full">
                            <span className="hidden group-hover:block absolute -top-4 text-[9px] font-extrabold text-rose-700 whitespace-nowrap select-none">
                              {outVal.toFixed(1)}L
                            </span>
                            <div
                              className="w-3.5 sm:w-4 rounded-t-md transition-all group-hover:brightness-110 shadow-2xs"
                              style={{ height: `${outH}%`, backgroundColor: '#ef4444' }}
                            />
                          </div>
                        </div>

                        {/* Interactive Floating Hover Tooltip */}
                        <div
                          className={`pointer-events-none absolute bottom-full mb-3 hidden group-hover:flex flex-col items-center z-30 transition-all ${
                            idx === 0
                              ? 'left-0'
                              : idx === (cashFlow.weeks || []).length - 1
                                ? 'right-0'
                                : 'left-1/2 -translate-x-1/2'
                          }`}
                        >
                          <div className="rounded-lg bg-slate-900/95 px-3 py-2 text-white shadow-xl backdrop-blur-xs whitespace-nowrap border border-slate-700/80 min-w-[145px]">
                            <div className="font-bold text-slate-200 border-b border-slate-700/80 pb-1 mb-1.5 flex items-center justify-between gap-2">
                              <span>{w.week}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                                  netVal >= 0
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {netVal >= 0 ? `+₹ ${netVal.toFixed(2)} L` : `-₹ ${Math.abs(netVal).toFixed(2)} L`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-[11px] py-0.5">
                              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#10b981' }} />
                                Inflow:
                              </span>
                              <span className="font-mono font-bold text-white">₹ {infVal.toFixed(2)} L</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-[11px] py-0.5">
                              <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                                Outflow:
                              </span>
                              <span className="font-mono font-bold text-white">₹ {outVal.toFixed(2)} L</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-[10.5px] border-t border-slate-800 pt-1 mt-1 text-slate-400">
                              <span>Net Position:</span>
                              <span className={`font-mono font-bold ${netVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {netVal >= 0 ? `Surplus (+₹ ${netVal.toFixed(2)}L)` : `Deficit (-₹ ${Math.abs(netVal).toFixed(2)}L)`}
                              </span>
                            </div>
                          </div>
                          {/* Tooltip Arrow */}
                          <div
                            className={`h-1.5 w-1.5 -mt-0.5 rotate-45 bg-slate-900 border-r border-b border-slate-700/80 ${
                              idx === 0
                                ? 'ml-6'
                                : idx === (cashFlow.weeks || []).length - 1
                                  ? 'mr-6'
                                  : ''
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* X-Axis Week Labels & Net Position Badges */}
            <div className="flex pl-8 pt-2 justify-around select-none">
              {(cashFlow.weeks || []).map((w, idx) => {
                const infVal = num(w.inflow);
                const outVal = num(w.outflow);
                const netVal = infVal - outVal;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[11px] font-bold text-slate-700">{w.week}</span>
                    <span
                      className={`text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-full ${
                        netVal >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}
                    >
                      {netVal >= 0 ? `+${netVal.toFixed(1)}L` : `${netVal.toFixed(1)}L`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 text-[12px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Projected Closing Balance</span>
              <span className="font-extrabold text-[#17294e]">{inrLakh(cashFlow.projectedClosing)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Post-dated Cheques in Hand</span>
              <span className="font-extrabold text-[#17294e]">{inrLakh(cashFlow.postDatedCheques)}</span>
            </div>
          </div>
        </SectionCard>

        {/* Card 5: Compliance Calendar */}
        <SectionCard
          title="Compliance Calendar"
          subtext="Next 30 Days"
        >
          <div className="divide-y divide-slate-100">
            {compliance.map((item, idx) => {
              const isRed = item.badgeColor === 'red';
              const isBlue = item.badgeColor === 'blue';
              return (
                <div key={idx} className="flex items-center justify-between py-2 text-[12px]">
                  <span className="font-medium text-slate-700">
                    {item.name} <span className="text-slate-400">· {item.dueDate}</span>
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                      isRed
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : isBlue
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10.5px] leading-tight text-slate-400 border-t border-slate-100 pt-2">
            Statutory due dates configured as per company GST & tax filing category.
          </p>
        </SectionCard>

        {/* Card 6: GST Position */}
        <SectionCard
          title={`GST Position (${gstPos.month || 'Nov'})`}
          subtext="Net Payable"
        >
          <div className="mb-2">
            <span className="text-[22px] font-black tracking-tight text-[#17294e]">{inr(gstPos.netPayable)}</span>
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Output Tax</span>
              <span className="font-extrabold text-[#17294e]">{inr(gstPos.outputTax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">ITC Available</span>
              <span className="font-extrabold text-[#17294e]">{inr(gstPos.itcAvailable)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">ITC Mismatch vs GSTR-2B</span>
              <span className="font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                {inr(gstPos.itcMismatch)} · {gstPos.mismatchedBills} bills
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">E-invoice (IRN) Pending</span>
              <span className="font-extrabold text-amber-700 rounded-full bg-amber-100 px-2 py-0.5 text-[11px]">{gstPos.einvoicePending}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">E-way Bills Expiring Today</span>
              <span className="font-extrabold text-amber-700 rounded-full bg-amber-100 px-2 py-0.5 text-[11px]">{gstPos.ewayBillExpiringToday}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── ROW 3: RECEIVABLE AGEING | PAYABLE AGEING | MSME 45-DAY ALERT ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Card 7: Receivable Ageing */}
        <SectionCard
          title="Receivable Ageing"
          rightAction={<span className="text-[14px] font-extrabold text-[#17294e]">{inr(recvAgeing.total)}</span>}
        >
          <AgeingBreakdownWidget
            title="Receivable Ageing"
            total={recvAgeing.total}
            buckets={[
              {
                key: '0-30',
                label: '0–30 Days',
                val: num(recvAgeing.buckets?.['0-30'] ?? 0),
                color: '#10b981',
                statusTag: 'Current',
                statusClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                description: 'Within invoice payment window',
              },
              {
                key: '31-60',
                label: '31–60 Days',
                val: num(recvAgeing.buckets?.['31-60'] ?? 0),
                color: '#3b82f6',
                statusTag: 'Due',
                statusClass: 'bg-blue-50 text-blue-700 border-blue-200',
                description: 'Standard collection reminder cycle',
              },
              {
                key: '61-90',
                label: '61–90 Days',
                val: num(recvAgeing.buckets?.['61-90'] ?? 0),
                color: '#f59e0b',
                statusTag: 'Past Due',
                statusClass: 'bg-amber-50 text-amber-700 border-amber-200',
                description: 'Overdue; sales escalation required',
              },
              {
                key: '90+',
                label: '90+ Days',
                val: num(recvAgeing.buckets?.['90+'] ?? 0),
                color: '#ef4444',
                statusTag: 'High Risk',
                statusClass: 'bg-rose-50 text-rose-700 border-rose-200',
                amountClass: 'text-rose-600',
                description: 'Severe default risk; provision review',
              },
            ]}
            footerLabel="Customers over credit limit"
            footerSubtext="Requires immediate collection action"
            footerBadge="5 Accounts"
            footerBadgeClass="bg-rose-100 text-rose-700 border-rose-200 font-extrabold"
          />
        </SectionCard>

        {/* Card 8: Payable Ageing */}
        <SectionCard
          title="Payable Ageing"
          rightAction={<span className="text-[14px] font-extrabold text-[#17294e]">{inr(payAgeing.total)}</span>}
        >
          <AgeingBreakdownWidget
            title="Payable Ageing"
            total={payAgeing.total}
            buckets={[
              {
                key: '0-15',
                label: '0–15 Days',
                val: num(payAgeing.buckets?.['0-15'] ?? 0),
                color: '#10b981',
                statusTag: 'Current',
                statusClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                description: 'Within standard vendor credit terms',
              },
              {
                key: '16-45',
                label: '16–45 Days',
                val: num(payAgeing.buckets?.['16-45'] ?? 0),
                color: '#f59e0b',
                statusTag: 'Due Soon',
                statusClass: 'bg-amber-50 text-amber-700 border-amber-200',
                description: 'Approaching MSME 45-day cutoff',
              },
              {
                key: '45+',
                label: '45+ Days',
                val: num(payAgeing.buckets?.['45+'] ?? 0),
                color: '#ef4444',
                statusTag: 'Overdue · 43B(h)',
                statusClass: 'bg-rose-50 text-rose-700 border-rose-200',
                amountClass: 'text-rose-600',
                description: 'Section 43B(h) disallowance risk',
              },
            ]}
            footerLabel="Creditor Days (DPO)"
            footerSubtext="Average time to settle vendor dues"
            footerValue={`${payAgeing.creditorDays} Days`}
            footerBadge={
              payAgeing.creditorDays > 45
                ? `⚠️ +${payAgeing.creditorDays - 45}d past 45d limit`
                : '✓ Within 45d limit'
            }
            footerBadgeClass={
              payAgeing.creditorDays > 45
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }
          />
        </SectionCard>

        {/* Card 9: MSME 45-Day Alert */}
        <SectionCard
          title="MSME 45-Day Overdue Alert"
          rightAction={
            msmeAlert.overdueCount > 0 ? (
              <Link
                to="/purchase/vendor-bills"
                className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-extrabold text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
              >
                {msmeAlert.overdueCount} Overdue
              </Link>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                ✓ Compliant
              </span>
            )
          }
        >
          <div className="mb-1 flex items-baseline justify-between">
            <span
              className={`text-[22px] font-black tracking-tight ${
                msmeAlert.overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {inr(msmeAlert.totalOverdue)}
            </span>
            <span className={`text-[11px] font-bold ${msmeAlert.overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {msmeAlert.overdueCount > 0 ? 'Section 43B(h) Overdue' : 'Section 43B(h) Compliant'}
            </span>
          </div>
          <p className="text-[10.5px] leading-tight text-slate-500 mb-2.5">
            {msmeAlert.overdueCount > 0
              ? 'Payments due to Micro & Small enterprises beyond 45 days. Unpaid amounts are disallowed under Section 43B(h) / MSME Act.'
              : 'No pending payments to Micro & Small enterprises exceed 45 days. All vendor dues are fully tax-deductible.'}
          </p>

          <div className="space-y-1.5 border-t border-slate-100 pt-2 text-[11.5px]">
            {msmeAlert.vendors && msmeAlert.vendors.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-1">
                  <span>{msmeAlert.overdueCount > 0 ? 'Overdue MSME Vendors' : 'Upcoming MSME Payables (Within 45 Days)'}</span>
                  <span>Amount Due</span>
                </div>
                {msmeAlert.vendors.map((v, idx) => {
                  const isOverdue = v.isOverdue || (num(v.daysOverdue) > 0);
                  const age = v.ageDays || v.daysOverdue || 0;
                  const remaining = v.daysRemaining ?? Math.max(0, 45 - age);
                  return (
                    <div
                      key={idx}
                      className="flex justify-between items-center py-1 px-1.5 rounded-md hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            isOverdue ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="text-slate-800 font-semibold truncate text-[11.5px]">{v.name}</span>
                        {isOverdue ? (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                            {v.daysOverdue || (age - 45)}d overdue
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            {age}d old · {remaining}d left
                          </span>
                        )}
                      </div>
                      <span className="font-extrabold text-[#17294e] shrink-0 ml-2 text-[12px] tabular-nums">
                        {inr(v.amount)}
                      </span>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="py-2.5 text-center text-[12px] font-medium text-emerald-600 bg-emerald-50/60 rounded-lg border border-emerald-100">
                ✓ No pending MSME vendor bills
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── ROW 4: PROFIT & LOSS SUMMARY ── */}
      <div>
        {/* Card 10: Profit & Loss Summary */}
        <SectionCard
          title="Profit & Loss Summary"
          subtext="₹"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                  <th className="py-2 pl-0">Account</th>
                  <th className="py-2 text-right">MTD</th>
                  <th className="py-2 text-right">FYTD</th>
                  <th className="py-2 text-right pr-0">Previous Year (YTD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(pnlSummary.rows || []).map((r, idx) => {
                  const isMargin = r.isPercentage;
                  const isNet = r.label === 'Net profit';
                  return (
                    <tr key={idx} className={isNet ? 'font-bold bg-slate-50/70' : ''}>
                      <td className="py-2 pl-0 text-slate-700">{r.label}</td>
                      <td className="py-2 text-right font-extrabold text-[#17294e]">
                        {isMargin ? r.mtd : num(r.mtd).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 text-right text-slate-700">
                        {isMargin ? r.fytd : num(r.fytd).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 text-right pr-0 text-slate-500">
                        {isMargin ? r.prevYtd : num(r.prevYtd).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* ── ROW 5: PRODUCTION & JOB WORK | QC & WASTAGE ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Card 12: Production & Job Work */}
        <SectionCard
          title="Production & Job Work"
          rightAction={
            <Link to="/pms" className="text-[12px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5">
              View Details <ChevronRight size={14} />
            </Link>
          }
        >
          <p className="text-[11.5px] font-medium text-slate-500 mb-2.5">{prodJw.statusMessage}</p>

          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-slate-600 font-medium">Job Work (In Process): {prodJw.jobWorkInProcess?.process}</span>
              <span className="font-extrabold text-[#17294e]">{meters(prodJw.jobWorkInProcess?.meters)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 font-medium">External WIP Value</span>
              <span className="font-extrabold text-[#17294e]">{inr(prodJw.externalWipValue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Delayed Beyond Expected Date</span>
              <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                {prodJw.delayedJobWorks} job work
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-100 pt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Job Work TDS (MTD)</span>
              </div>
              <span className="font-extrabold text-[#17294e]">{inr(prodJw.jobWorkTds)}</span>
            </div>
          </div>
        </SectionCard>

        {/* Card 13: QC & Wastage */}
        <SectionCard
          title="QC & Wastage"
          subtext="Job-work inwards since 19 Oct 2026"
        >
          <div className="flex items-center gap-4 pt-1">
            {/* Circular Good Yield Indicator */}
            <div className="relative flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-4 border-emerald-500 bg-emerald-50/40 text-center">
              <span className="text-[17px] font-black text-emerald-700">{qcWastage.goodYieldPct}%</span>
              <span className="text-[9.5px] font-bold text-emerald-600">Good Yield</span>
            </div>

            {/* Metrics breakdown */}
            <div className="flex-1 space-y-1.5 text-[12px]">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Received</span>
                <span className="font-extrabold text-[#17294e]">{meters(qcWastage.receivedMeters)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Good</span>
                <span className="font-extrabold text-[#17294e]">{meters(qcWastage.goodMeters)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Reprocess / Reject / Loss</span>
                <span className="font-extrabold text-[#17294e]">
                  {num(qcWastage.reprocessMeters)} / {num(qcWastage.rejectMeters)} / {num(qcWastage.lossMeters)} m
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[12px]">
            <span className="font-medium text-slate-600">Process Loss (Finished Orders)</span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700 border border-emerald-200">
              {qcWastage.processLossPct}%
            </span>
          </div>
        </SectionCard>
      </div>

      {/* ── ROW 6: INVENTORY POSITION (VALUE) | RECONCILIATION & CONTROL CHECKS ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Card 14: Inventory Position (Value) */}
        <SectionCard
          title="Inventory Position (Value)"
          rightAction={<span className="text-[15px] font-black text-[#17294e]">{inr(invPos.totalValue)}</span>}
        >
          <div className="space-y-1.5 text-[12px]">
            {(() => {
              const totalVal = num(invPos.totalValue) || 1;
              const items = [
                {
                  label: 'Finished Stock',
                  meters: meters(invPos.finished?.meters),
                  val: num(invPos.finished?.value),
                  color: '#10b981',
                  pct: (num(invPos.finished?.value) / totalVal) * 100,
                },
                {
                  label: 'Grey Stock',
                  meters: meters(invPos.grey?.meters),
                  val: num(invPos.grey?.value),
                  color: '#3b82f6',
                  pct: (num(invPos.grey?.value) / totalVal) * 100,
                },
                {
                  label: 'QC Hold',
                  sub: `${invPos.qcHold?.lots ?? 0} lots`,
                  meters: meters(invPos.qcHold?.meters),
                  val: num(invPos.qcHold?.value),
                  color: '#f59e0b',
                  pct: (num(invPos.qcHold?.value) / totalVal) * 100,
                },
                {
                  label: 'External WIP',
                  meters: meters(invPos.externalWip?.meters),
                  val: num(invPos.externalWip?.value),
                  color: '#8b5cf6',
                  pct: (num(invPos.externalWip?.value) / totalVal) * 100,
                },
                {
                  label: 'Reprocess',
                  meters: meters(invPos.reprocess?.meters),
                  val: num(invPos.reprocess?.value),
                  color: '#ec4899',
                  pct: (num(invPos.reprocess?.value) / totalVal) * 100,
                },
                {
                  label: 'Rejected',
                  badge: 'NRV Check',
                  meters: meters(invPos.rejected?.meters),
                  val: num(invPos.rejected?.value),
                  color: '#ef4444',
                  pct: (num(invPos.rejected?.value) / totalVal) * 100,
                },
              ];

              return items.map((it, idx) => (
                <div key={idx} className="group rounded-md p-1 -mx-1 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
                      <span className="font-semibold text-slate-700">{it.label}</span>
                      <span className="text-slate-400 font-medium text-[11px]">{it.meters}</span>
                      {it.sub && (
                        <span className="text-[10px] text-slate-400">· {it.sub}</span>
                      )}
                      {it.badge && (
                        <span className="rounded bg-amber-50 px-1 py-0.2 text-[9px] font-bold text-amber-700 border border-amber-200">
                          {it.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10.5px] font-extrabold text-slate-400 tabular-nums">
                        {it.pct.toFixed(1)}%
                      </span>
                      <span className="font-black text-[#17294e] text-xs tabular-nums">
                        {inr(it.val)}
                      </span>
                    </div>
                  </div>
                  {/* Subtle proportion track */}
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(0, it.pct)}%`,
                        backgroundColor: it.color,
                      }}
                    />
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Finished Stock Ageing Sub-card */}
          <div className="mt-3 rounded-lg bg-slate-50/90 p-2.5 border border-slate-200/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Finished Stock Ageing
              </span>
              <span className="rounded bg-rose-50 px-1.5 py-0.2 text-[9.5px] font-extrabold text-rose-700 border border-rose-200">
                12% Slow / Dead Stock
              </span>
            </div>

            {/* Upgraded 20px Segmented Bar */}
            <div className="flex h-5 w-full overflow-hidden rounded-md border border-slate-200/80 shadow-xs">
              {[
                { label: '0–30 Days', val: 38, color: '#10b981' },
                { label: '31–90 Days', val: 31, color: '#3b82f6' },
                { label: '91–180 Days', val: 19, color: '#f59e0b' },
                { label: '180+ Days', val: 12, color: '#ef4444' },
              ].map((s, idx) => (
                <div
                  key={idx}
                  style={{ width: `${s.val}%`, backgroundColor: s.color }}
                  className="h-full border-r last:border-r-0 border-white/80 flex items-center justify-center text-white font-black text-[10px] tracking-tight select-none"
                  title={`${s.label}: ${s.val}%`}
                >
                  {s.val}%
                </div>
              ))}
            </div>

            {/* Color Legend Tags */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#10b981' }} />
                0–30d (38%)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                31–90d (31%)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                91–180d (19%)
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                180+d (12%)
              </span>
            </div>
          </div>
        </SectionCard>

        {/* Card 15: Reconciliation & Control Checks */}
        <SectionCard
          title="Reconciliation & Control Checks"
          rightAction={
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-extrabold text-rose-700 border border-rose-200">
              {reconChecks.status}
            </span>
          }
        >
          <div className="divide-y divide-slate-100 text-[12px]">
            {(reconChecks.items || []).map((check, idx) => {
              const isRed = check.badgeColor === 'red';
              const isGreen = check.badgeColor === 'green';
              const isBlue = check.badgeColor === 'blue';
              const link =
                check.label.includes('Inventory module')
                  ? '/inventory/stock-position'
                  : check.label.includes('Batch valuation')
                    ? '/inventory/batches'
                    : check.label.includes('Negative stock')
                      ? '/inventory/stock-position'
                      : check.label.includes('Customers with credit')
                        ? '/crm/customers'
                        : '/accounts/day-book';

              return (
                <Link
                  key={idx}
                  to={link}
                  className="flex items-center justify-between py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <span className="font-medium text-slate-700 group-hover:text-slate-900 group-hover:font-semibold transition-colors flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        isRed ? 'bg-rose-500' : isGreen ? 'bg-emerald-500' : isBlue ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                    />
                    {check.label}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold tabular-nums transition-transform group-hover:scale-105 ${
                      isRed
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : isGreen
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isBlue
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {check.badgeText}
                  </span>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* ── BOTTOM ACTION BAR: ATTENTION REQUIRED ── */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.04)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[13.5px] font-extrabold text-[#dc2626] flex items-center gap-1.5">
              <AlertTriangle size={15} /> Attention Required
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-400">Critical items requiring immediate management action</span>
        </div>

        {/* Action Counters Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {attentionItems.map((item, idx) => (
            <Link
              key={idx}
              to={item.link || '#'}
              className="flex flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-2 hover:bg-slate-100/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-[11px] font-medium text-slate-600 line-clamp-2 leading-tight">
                  {item.label}
                </span>
              </div>
              <span className={`mt-2 text-[16px] font-black ${item.count > 0 ? 'text-[#dc2626]' : 'text-slate-400'}`}>
                {item.count}
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-3 text-[10.5px] text-slate-400 text-center">
          Restricted view for Owner and Finance roles. Statutory tax dates and limits subject to prevailing regulatory rules.
        </p>
      </div>

      {/* Batch Ledger Slide-out Drawer (in-page, no redirect) */}
      <Drawer
        isOpen={showBatchLedgerDrawer}
        onClose={() => setShowBatchLedgerDrawer(false)}
        title="Batch-wise Profit & Loss"
        subtitle="Realized profit/loss calculated from actual sales dispatches and landed costs"
        width="xl"
      >
        {showBatchLedgerDrawer && (
          <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={24} className="animate-spin text-blue-600 mb-3" /><p className="text-xs font-semibold">Loading batch ledger…</p></div>}>
            <BatchProfitabilityPage inDrawer />
          </Suspense>
        )}
      </Drawer>
    </div>
  );
};

export default DashboardPage;
