import React, { useMemo } from 'react';
import {
  ShoppingCart, FileText, Clock, Package, CheckCircle2, AlertCircle,
  TrendingUp, ArrowRight, Layers, PackageCheck, Eye, Calendar,
  Truck, Building2, BarChart2, RefreshCw, ChevronRight, ArrowUpRight
} from 'lucide-react';
import { usePurchaseDashboardLists, DASHBOARD_ROW_LIMIT } from './usePurchaseDashboardLists';
import { formatCompactCurrency } from '../../utils/currencyUtils';
import { toISODate } from '../../utils/dateUtils';
import KpiCard from '../../components/ui/KpiCard';

// ── Helper: standardized global KPI card ───────────────────────────────────
function MiniKpi({ icon: Icon, value, label, index, tone, sub }) {
  return (
    <KpiCard
      icon={Icon}
      value={value}
      label={label}
      index={index}
      tone={tone}
      sub={sub}
    />
  );
}

// ── Helper: status badge ────────────────────────────────────────────────────
const STATUS_PILL = {
  Draft: 'bg-amber-50 text-amber-700 border-amber-200',
  'Pending Approval': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Approved: 'bg-blue-50 text-blue-700 border-blue-200',
  'In Production': 'bg-violet-50 text-violet-700 border-violet-200',
  'Partially Received': 'bg-orange-50 text-orange-700 border-orange-200',
  'Fully Received': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_PILL[status] || STATUS_PILL.Draft}`}>
      {status}
    </span>
  );
}

/**
 * Calendar month key (`YYYY-MM`) for a purchase order date.
 *
 * POs reach the dashboard in two shapes: freshly created rows keep the ISO
 * date (`2025-11-05`) while rows pulled from the API carry the display string
 * (`05-11-2025`). Slicing either raw string at 7 characters grouped the second
 * form by *day-month*, which repeated month labels across the chart. Every
 * known shape is normalised here first, and ISO timestamps are read as written
 * so a UTC value can never shift a PO into the previous month.
 */
export function poMonthKey(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  // ISO date or ISO timestamp — take the calendar date as written.
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  // DD-MM-YYYY / DD/MM/YYYY — the format formatDateDDMMYYYY renders.
  const dmy = str.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}`;
  // 'Today' and other natural-language strings.
  const fallback = toISODate(str);
  return fallback ? fallback.slice(0, 7) : '';
}

/**
 * The Monthly Purchase Trend series: exactly 6 consecutive calendar months in
 * chronological order, one aggregated purchase value per month.
 *
 * Months with no purchase orders are kept as explicit zero rows, and the window
 * ends at the later of the current month and the most recent PO so recent
 * activity is never cut off. `Date` arithmetic handles Dec → Jan and the year
 * rollover.
 */
export function buildMonthlyTrend(purchaseOrders = [], now = new Date()) {
  // 1. Aggregate purchase value by real calendar month and year.
  const byMonth = new Map();
  let latestKey = '';
  purchaseOrders.forEach(p => {
    const key = poMonthKey(p.date);
    if (!key) return;
    const entry = byMonth.get(key) || { month: key, value: 0, count: 0 };
    entry.value += Number(p.amount) || Number(p.total) || 0;
    entry.count += 1;
    byMonth.set(key, entry);
    if (key > latestKey) latestKey = key;
  });

  // 2. Emit the 6-month window.
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [anchorY, anchorM] = (latestKey > nowKey ? latestKey : nowKey).split('-').map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(anchorY, anchorM - 1 - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return byMonth.get(key) || { month: key, value: 0, count: 0 };
  });
}

export function PurchaseOverviewDashboard({
  purchaseOrders = [],
  purchaseBills = [],
  vendorBills = [],
  paymentOuts = [],
  formatCurrency,
  formatDateDDMMYYYY,
  units,
  getOscarStatus,
  getPoLines,
  getPoQty,
  getPoReceivedQty,
  getPoFabric,
  poQtyText,
  poReceivedText,
  statusCounts = {},
  fabricTotals = [],
  onViewAllOrders,
  onViewAllVendors,
  onViewAllDeliveries,
  onViewAllPending,
  onCreatePo,
  onManageReceipts,
  onRecordGrn,
  formatQty,
  sumByUnit,
  formatUnitTotals,
}) {

  // Compact Indian currency (₹51.30L / ₹66.00K) for charts and summary totals.
  // Falls back to the standalone utility when no context formatter is supplied.
  const fmtCompact = (value) => (
    formatCurrency ? formatCurrency(value, { compact: true }) : formatCompactCurrency(value)
  );

  // ── KPI computations ──────────────────────────────────────────────────────
  const totalPoValue = useMemo(
    () => purchaseOrders.reduce((s, p) => s + (Number(p.amount) || Number(p.total) || 0), 0),
    [purchaseOrders]
  );

  const kpis = useMemo(() => {
    const totalCount = purchaseOrders.length;
    const openCount = purchaseOrders.filter(p => !['Fully Received', 'Cancelled'].includes(getOscarStatus(p))).length;
    const draftCount = purchaseOrders.filter(p => getOscarStatus(p) === 'Draft').length;
    const fullyRecdCount = purchaseOrders.filter(p => getOscarStatus(p) === 'Fully Received').length;
    const partialRecdCount = purchaseOrders.filter(p => getOscarStatus(p) === 'Partially Received').length;
    const pendingApprovalCount = purchaseOrders.filter(p => getOscarStatus(p) === 'Pending Approval').length;

    const orderedLines = purchaseOrders.flatMap(p => getPoLines(p).map(l => ({ qty: Number(l.qty) || 0, uom: l.uom || 'Mtr' })));
    const receivedLines = purchaseOrders.flatMap(p => {
      const r = getPoReceivedQty(p);
      const lines = getPoLines(p);
      const uom = lines[0]?.uom || 'Mtr';
      return r > 0 ? [{ qty: r, uom }] : [];
    });

    const orderedTotals = sumByUnit ? sumByUnit(orderedLines, { units }) : [];
    const receivedTotals = sumByUnit ? sumByUnit(receivedLines, { units }) : [];

    const totalOrderedQtyStr = formatUnitTotals ? formatUnitTotals(orderedTotals, { units }) : orderedLines.reduce((s, l) => s + l.qty, 0).toLocaleString('en-IN');
    const totalReceivedQtyStr = formatUnitTotals ? formatUnitTotals(receivedTotals, { units }) : receivedLines.reduce((s, l) => s + l.qty, 0).toLocaleString('en-IN');

    const totalOrdered = orderedLines.reduce((s, l) => s + l.qty, 0);
    const totalReceived = receivedLines.reduce((s, l) => s + l.qty, 0);
    const pendingQty = Math.max(0, totalOrdered - totalReceived);

    return {
      totalCount, openCount, draftCount, fullyRecdCount, partialRecdCount, pendingApprovalCount,
      totalOrderedQtyStr, totalReceivedQtyStr, pendingQty, totalOrdered, totalReceived,
    };
  }, [purchaseOrders, units, getOscarStatus, getPoLines, getPoReceivedQty, sumByUnit, formatUnitTotals]);

  // ── Monthly purchase trend ────────────────────────────────────────────────
  const monthlyTrend = useMemo(() => buildMonthlyTrend(purchaseOrders), [purchaseOrders]);

  const maxTrendVal = Math.max(1, ...monthlyTrend.map(m => m.value));

  const formatMonthShort = (ym) => {
    if (!ym || !ym.includes('-')) return ym || '';
    const [y, m] = ym.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = parseInt(m, 10) - 1;
    return `${months[idx] || m} '${y.slice(2)}`;
  };

  // ── Vendor summary — complete data, the card shows the top five ──────────
  // No server endpoint aggregates purchase value per vendor, so the ranking is
  // computed from the complete collection the page already holds.
  const vendorSummary = useMemo(() => {
    const map = {};
    purchaseOrders.forEach(p => {
      const v = p.vendor || 'Unknown';
      if (!map[v]) map[v] = { vendor: v, count: 0, value: 0 };
      map[v].count += 1;
      map[v].value += Number(p.amount) || Number(p.total) || 0;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [purchaseOrders]);

  const topVendors = useMemo(
    () => vendorSummary.slice(0, DASHBOARD_ROW_LIMIT),
    [vendorSummary]
  );

  // ── Card rows ────────────────────────────────────────────────────────────
  // Each card reads its own five-row server page (usePurchaseDashboardLists),
  // so no card walks the whole collection just to show five rows. `null` is a
  // failed read and `undefined` a read still in flight; both fall back to the
  // complete collection below, so a card never renders empty.
  const serverCards = usePurchaseDashboardLists();

  const toExpectedIso = (value) => (
    typeof value === 'string' && value.includes('-') ? value.slice(0, 10) : ''
  );

  const recentRows = useMemo(() => {
    const source = serverCards.recent
      ?? [...purchaseOrders].slice(-DASHBOARD_ROW_LIMIT).reverse();
    return source.slice(0, DASHBOARD_ROW_LIMIT).map((p) => ({
      id: p.id,
      po: p.poNumber,
      supplier: p.vendor,
      fabric: getPoFabric(p),
      qty: getPoQty(p),
      qtyText: poQtyText(p),
      date: formatDateDDMMYYYY(p.date),
      exp: formatDateDDMMYYYY(p.expectedDate),
      status: getOscarStatus(p),
      value: formatCurrency(p.amount ?? p.total ?? 0),
      raw: p,
    }));
  }, [
    serverCards.recent, purchaseOrders, getPoFabric, getPoQty, poQtyText,
    getOscarStatus, formatCurrency, formatDateDDMMYYYY,
  ]);

  // ── Upcoming / overdue deliveries ─────────────────────────────────────────
  // The complete list feeds the "of N" total and the offline fallback.
  const allDeliveries = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return purchaseOrders
      .filter(p => !['Fully Received', 'Cancelled'].includes(getOscarStatus(p)) && p.expectedDate)
      .map(p => ({ ...p, expectedIso: toExpectedIso(p.expectedDate) }))
      .filter(p => p.expectedIso)
      .sort((a, b) => (a.expectedIso > b.expectedIso ? 1 : -1))
      .map(p => ({ ...p, overdue: p.expectedIso < today }));
  }, [purchaseOrders, getOscarStatus]);

  const upcomingDeliveries = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const source = serverCards.deliveries
      ? serverCards.deliveries
        .map(p => ({ ...p, expectedIso: toExpectedIso(p.expectedDate) }))
        .filter(p => p.expectedIso)
      : allDeliveries;
    return source
      .slice(0, DASHBOARD_ROW_LIMIT)
      .map(p => ({
        ...p,
        orderedQty: getPoQty(p),
        receivedQty: getPoReceivedQty(p),
        fabric: getPoFabric(p),
        status: getOscarStatus(p),
        overdue: Boolean(p.expectedIso) && p.expectedIso < today,
      }));
  }, [
    serverCards.deliveries, allDeliveries, getPoQty, getPoReceivedQty,
    getPoFabric, getOscarStatus,
  ]);

  // ── Pending receipts ──────────────────────────────────────────────────────
  const allPendingReceipts = useMemo(
    () => purchaseOrders
      .filter(p => ['Approved', 'Partially Received', 'In Production'].includes(getOscarStatus(p)))
      .map(p => {
        const ordered = getPoQty(p);
        const received = getPoReceivedQty(p);
        return {
          ...p,
          expectedIso: toExpectedIso(p.expectedDate),
          ordered,
          received,
          pending: Math.max(0, ordered - received),
        };
      })
      .filter(p => p.pending > 0),
    [purchaseOrders, getOscarStatus, getPoQty, getPoReceivedQty]
  );

  const pendingReceipts = useMemo(() => {
    const source = serverCards.pendingReceipts
      ? serverCards.pendingReceipts.map(p => {
        const ordered = getPoQty(p);
        const received = getPoReceivedQty(p);
        return {
          ...p,
          expectedIso: toExpectedIso(p.expectedDate),
          ordered,
          received,
          pending: Math.max(0, ordered - received),
        };
      })
      : allPendingReceipts;
    // Nearest expected date first, then the largest shortfall.
    const byExpectedDate = (a, b) => (
      (a.expectedIso || '9999-12-31').localeCompare(b.expectedIso || '9999-12-31')
      || b.pending - a.pending
    );
    return source
      .filter(p => p.pending > 0)
      .sort(byExpectedDate)
      .slice(0, DASHBOARD_ROW_LIMIT)
      .map(p => ({ ...p, fabric: getPoFabric(p), status: getOscarStatus(p) }));
  }, [
    serverCards.pendingReceipts, allPendingReceipts, getPoQty, getPoReceivedQty,
    getPoFabric, getOscarStatus,
  ]);

  // ── Bar chart helpers ─────────────────────────────────────────────────────
  const barDefs = [
    { k: 'Draft', color: '#f59e0b', label: 'Draft' },
    { k: 'Pending Approval', color: '#fbbf24', label: 'Pending' },
    { k: 'Approved', color: '#3b82f6', label: 'Approved' },
    { k: 'In Production', color: '#8b5cf6', label: 'In Prod.' },
    { k: 'Partially Received', color: '#f97316', label: 'Part. Recd.' },
    { k: 'Fully Received', color: '#10b981', label: 'Fully Recd.' },
  ];
  const maxBarVal = Math.max(1, ...barDefs.map(b => statusCounts[b.k] || 0));

  // ── Fabric donut ──────────────────────────────────────────────────────────
  const DONUT_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#7dd3fc'];
  const fabricTotal = fabricTotals.reduce((s, f) => s + f.qty, 0);

  return (
    <div className="space-y-4">

      {/* ── KPI Cards (10 Core Metrics) ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <MiniKpi icon={ShoppingCart} label="Total PO Value" value={totalPoValue ? fmtCompact(totalPoValue) : '₹0.00'} index={0} />
        <MiniKpi icon={FileText} label="Total Purchase Orders" value={kpis.totalCount.toString()} index={1} />
        <MiniKpi icon={Layers} label="Open Purchase Orders" value={kpis.openCount.toString()} index={2} />
        <MiniKpi icon={Clock} label="Draft Purchase Orders" value={kpis.draftCount.toString()} index={3} />
        <MiniKpi icon={CheckCircle2} label="Fully Received Orders" value={kpis.fullyRecdCount.toString()} index={4} />
      </div>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <MiniKpi icon={AlertCircle} label="Partially Received" value={kpis.partialRecdCount.toString()} index={0} />
        <MiniKpi icon={RefreshCw} label="Pending Approval" value={kpis.pendingApprovalCount.toString()} index={1} />
        <MiniKpi icon={Package} label="Total Ordered Quantity" value={kpis.totalOrderedQtyStr} index={2} />
        <MiniKpi icon={PackageCheck} label="Total Received Quantity" value={kpis.totalReceivedQtyStr} index={3} />
        <MiniKpi icon={Truck} label="Pending Receipt Quantity" value={kpis.pendingQty > 0 ? kpis.pendingQty.toLocaleString('en-IN') : '0'} index={4} />
      </div>

      {/* ── Row 1: Status Overview + Monthly Trend + Fabric Quantity ───────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

        {/* 1. Purchase Order Status Overview */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-extrabold text-[#17294e]">PO Status Overview</h3>
              <span className="text-[10px] font-semibold text-slate-400">{kpis.totalCount} Orders Total</span>
            </div>
            <div className="flex h-36 items-end gap-1.5 pt-2">
              {barDefs.map(b => {
                const count = statusCounts[b.k] || 0;
                const pct = maxBarVal > 0 ? (count / maxBarVal) * 100 : 0;
                return (
                  <div key={b.k} className="flex flex-1 flex-col items-center gap-1 group">
                    <span className="text-[9px] font-bold tabular-nums text-slate-500">{count}</span>
                    <div
                      className="w-full rounded-t-sm transition-all group-hover:brightness-95"
                      style={{ height: `${Math.max(4, pct * 1.15)}px`, background: b.color }}
                      title={`${b.k}: ${count}`}
                    />
                    <span className="text-center text-[7.5px] font-semibold leading-tight text-slate-500 truncate w-full">{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-100 pt-2.5">
            {barDefs.map(b => (
              <div key={b.k} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: b.color }} />
                <span className="truncate">{b.k}: <strong>{statusCounts[b.k] || 0}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Monthly Purchase Trend */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] lg:col-span-4 flex flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={14} className="text-blue-600" />
                <h3 className="text-[13px] font-extrabold text-[#17294e]">Monthly Purchase Trend</h3>
              </div>
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Last 6 Months</span>
            </div>
            {monthlyTrend.length > 0 ? (
              <div className="flex min-h-[136px] flex-1 items-stretch gap-2 pt-1">
                {monthlyTrend.map(m => {
                  const pct = maxTrendVal > 0 ? (m.value / maxTrendVal) * 100 : 0;
                  return (
                    <div key={m.month} className="group flex flex-1 flex-col items-center gap-1">
                      <span className="text-[8.5px] font-mono font-bold text-slate-600 truncate">
                        {fmtCompact(m.value)}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-sm bg-gradient-to-t from-blue-600 to-blue-400 transition-all group-hover:brightness-110"
                          style={{ height: m.value > 0 ? `${Math.max(3, pct)}%` : '0%' }}
                          title={`${formatMonthShort(m.month)}: ${fmtCompact(m.value)} (${m.count} POs)`}
                        />
                      </div>
                      <span className="text-[8.5px] font-semibold text-slate-500 whitespace-nowrap">{formatMonthShort(m.month)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="flex flex-1 items-center justify-center text-[11px] text-slate-400">No purchase order trend data yet.</p>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[10px] text-slate-500">
            <span>Recent 6-Month Orders: <strong>{monthlyTrend.reduce((s, m) => s + m.count, 0)} POs</strong></span>
            <span>Total Spend: <strong className="text-slate-800">{fmtCompact(monthlyTrend.reduce((s, m) => s + m.value, 0))}</strong></span>
          </div>
        </div>

        {/* 3. Fabric-wise Purchase Quantity */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-extrabold text-[#17294e]">Fabric-wise Purchase Qty</h3>
              <span className="text-[10px] font-semibold text-slate-400">{fabricTotals.length} Fabrics</span>
            </div>
            {fabricTotals.length > 0 ? (
              <div className="space-y-2 pt-1">
                {fabricTotals.slice(0, 5).map((f, i) => {
                  const pct = fabricTotal > 0 ? (f.qty / fabricTotal) * 100 : 0;
                  return (
                    <div key={f.name}>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="font-semibold text-slate-600 truncate max-w-[140px]">{f.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-700 whitespace-nowrap">{f.qty.toLocaleString('en-IN')} <span className="font-normal text-slate-400 text-[9px]">({Math.round(pct)}%)</span></span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-12 text-center text-[11px] text-slate-400">No fabric purchases recorded yet.</p>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[10px] text-slate-500">
            <span>Total Fabric Ordered:</span>
            <span className="font-mono font-bold text-slate-800">{fabricTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* ── Row 2: Recent Purchase Orders + Vendor-wise Summary ────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

        {/* 4. Recent Purchase Orders */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)] lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-blue-600" />
                <h3 className="text-[13px] font-extrabold text-[#17294e]">Recent Purchase Orders</h3>
              </div>
              <button
                type="button"
                onClick={onViewAllOrders}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                View All Orders <ChevronRight size={12} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-3.5 py-2">PO Number</th>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Fabric</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3.5 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentRows.slice(0, DASHBOARD_ROW_LIMIT).map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-3.5 py-2 font-mono text-[11px] font-bold text-blue-600">{r.po}</td>
                      <td className="px-3 py-2 font-medium text-slate-700 max-w-[120px] truncate" title={r.supplier}>{r.supplier}</td>
                      <td className="px-3 py-2 text-slate-500 max-w-[110px] truncate" title={r.fabric}>{r.fabric || '—'}</td>
                      <td className="px-3 py-2 font-mono text-slate-700 text-right whitespace-nowrap">{r.qtyText || '—'}</td>
                      <td className="px-3 py-2 font-mono font-bold text-[#17294e] text-right whitespace-nowrap">{r.value}</td>
                      <td className="px-3.5 py-2 text-center"><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                  {recentRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[12px] text-slate-400">No purchase orders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-400">
            <span>Showing latest {Math.min(DASHBOARD_ROW_LIMIT, recentRows.length)} of {kpis.totalCount} orders</span>
            <button onClick={onViewAllOrders} className="text-blue-600 font-semibold hover:underline">Go to All Purchase Orders →</button>
          </div>
        </div>

        {/* 5. Vendor-wise Purchase Summary */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)] lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-blue-600" />
                <h3 className="text-[13px] font-extrabold text-[#17294e]">Vendor-wise Purchase Summary</h3>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-semibold text-slate-400">Top {topVendors.length} by value</span>
                <button
                  type="button"
                  onClick={onViewAllVendors}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  View All <ChevronRight size={12} />
                </button>
              </div>
            </div>
            {vendorSummary.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-3.5 py-2">Vendor Name</th>
                      <th className="px-2 py-2 text-center">Orders</th>
                      <th className="px-3.5 py-2 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {topVendors.map((v, i) => (
                      <tr key={v.vendor} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[8.5px] font-bold text-blue-700">{i + 1}</span>
                            <span className="font-semibold text-slate-700 truncate max-w-[130px]" title={v.vendor}>{v.vendor}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-mono font-bold text-slate-600">{v.count}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-[#17294e] tabular-nums whitespace-nowrap">
                          {formatCurrency ? formatCurrency(v.value) : `₹${v.value.toLocaleString('en-IN')}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-12 text-center text-[11px] text-slate-400">No vendor purchase data available.</p>
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-500">
            <span>Active Suppliers: <strong>{vendorSummary.length}</strong> · Showing top {topVendors.length}</span>
            <span>Total Value: <strong className="text-slate-800">{fmtCompact(totalPoValue)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Row 3: Upcoming Deliveries + Pending Receipts ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

        {/* 6. Upcoming Expected Deliveries */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)] lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-blue-600" />
                <h3 className="text-[13px] font-extrabold text-[#17294e]">Upcoming Expected Deliveries</h3>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9.5px] font-bold text-blue-700">
                  Next {upcomingDeliveries.length}
                </span>
                <button
                  type="button"
                  onClick={onViewAllDeliveries}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  View All <ChevronRight size={12} />
                </button>
              </div>
            </div>
            <div className="divide-y divide-slate-50 overflow-y-auto max-h-72">
              {upcomingDeliveries.length > 0 ? upcomingDeliveries.map((p, i) => (
                <div key={p.id || i} className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${p.overdue ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/60'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-blue-600">{p.poNumber || '—'}</span>
                      <StatusPill status={p.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-slate-700">{p.vendor || '—'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{p.fabric || '—'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[11px] font-mono font-bold ${p.overdue ? 'text-amber-700' : 'text-slate-700'}`}>
                      {formatDateDDMMYYYY ? formatDateDDMMYYYY(p.expectedDate) : p.expectedDate || '—'}
                    </p>
                    {p.overdue ? (
                      <span className="inline-block mt-0.5 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                        Overdue
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-slate-400">Scheduled</span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="px-4 py-10 text-center text-[12px] text-slate-400">No pending upcoming deliveries.</div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 bg-slate-50/50 text-[10px] text-slate-400">
            <span>Showing next {upcomingDeliveries.length} of {allDeliveries.length} · overdue highlighted in amber</span>
            <button type="button" onClick={onViewAllDeliveries} className="shrink-0 text-blue-600 font-semibold hover:underline">View All Deliveries →</button>
          </div>
        </div>

        {/* 7. Pending Receipts */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)] lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Truck size={14} className="text-amber-600" />
                <h3 className="text-[13px] font-extrabold text-[#17294e]">Pending Receipts</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] font-bold text-amber-800">
                  Next {pendingReceipts.length}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onViewAllPending}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  View All <ChevronRight size={12} />
                </button>
                <button
                  type="button"
                  onClick={onManageReceipts}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  title="Open the Goods Receipt (GRN) module"
                >
                  Manage Receipts <ChevronRight size={12} />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-3.5 py-2">PO Number</th>
                    <th className="px-3 py-2">Vendor & Fabric</th>
                    <th className="px-2.5 py-2 text-right">Ordered</th>
                    <th className="px-2.5 py-2 text-right">Received</th>
                    <th className="px-3 py-2 text-right">Pending</th>
                    <th className="px-3.5 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pendingReceipts.map((p, i) => (
                    <tr key={p.id || i} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-3.5 py-2 font-mono text-[11px] font-bold text-blue-600">{p.poNumber || '—'}</td>
                      <td className="px-3 py-2 min-w-0">
                        <p className="font-semibold text-slate-700 truncate max-w-[150px]">{p.vendor || '—'}</p>
                        <p className="text-[9.5px] text-slate-400 truncate max-w-[150px]">{p.fabric || '—'}</p>
                      </td>
                      <td className="px-2.5 py-2 font-mono font-semibold tabular-nums text-slate-600 text-right">{p.ordered.toLocaleString('en-IN')}</td>
                      <td className="px-2.5 py-2 font-mono font-semibold tabular-nums text-emerald-700 text-right">{p.received.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 font-mono font-extrabold tabular-nums text-amber-700 text-right">{p.pending.toLocaleString('en-IN')}</td>
                      <td className="px-3.5 py-2 text-center"><StatusPill status={p.status} /></td>
                    </tr>
                  ))}
                  {pendingReceipts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[12px] text-slate-400">No pending receipts — all approved orders received!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-500">
            <span>Showing next {pendingReceipts.length} of {allPendingReceipts.length} pending orders</span>
            <span>Pending Intake Total: <strong className="text-amber-800 font-mono">{kpis.pendingQty.toLocaleString('en-IN')} Mtr</strong></span>
            <button
              type="button"
              onClick={() => onRecordGrn?.(pendingReceipts[0] || null)}
              className="text-blue-600 font-semibold hover:underline"
              title="Open the All Purchase Orders tab with the most pending purchase order highlighted"
            >
              Record GRN in Orders Tab →
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
