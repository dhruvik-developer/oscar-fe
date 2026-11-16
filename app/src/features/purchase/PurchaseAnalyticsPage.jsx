import React, { useState, useMemo } from 'react';
import {
  TrendingUp, BarChart3, PieChart, Users, Package, CheckCircle2,
  Filter, Calendar, ArrowUpRight, ArrowDownRight, Layers, FileText,
  Clock, AlertCircle, ShoppingCart, Percent
} from 'lucide-react';
import { formatCompactCurrency } from '../../utils/currencyUtils';
import { poMonthKey } from './PurchaseOverviewDashboard';

export function PurchaseAnalyticsPage({
  purchaseOrders = [],
  formatCurrency,
  formatDateDDMMYYYY,
  getOscarStatus,
  getPoLines,
  getPoQty,
  getPoReceivedQty,
  getPoFabric,
  formatQty,
}) {
  // ── Filters State ─────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState('6m'); // '3m' | '6m' | '12m' | 'all'
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [selectedFabric, setSelectedFabric] = useState('all');

  const fmtCompact = (val) => formatCompactCurrency(val, formatCurrency);

  // ── Vendor & Fabric Options ───────────────────────────────────────────────
  const vendorOptions = useMemo(() => {
    const set = new Set();
    purchaseOrders.forEach((p) => {
      if (p.vendor) set.add(p.vendor);
    });
    return Array.from(set).sort();
  }, [purchaseOrders]);

  const fabricOptions = useMemo(() => {
    const set = new Set();
    purchaseOrders.forEach((p) => {
      const fab = getPoFabric ? getPoFabric(p) : p.fabric;
      if (fab && fab !== '—') set.add(fab);
    });
    return Array.from(set).sort();
  }, [purchaseOrders, getPoFabric]);

  // ── Date Filtering ────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const now = new Date();
    let cutoff = null;
    if (timeRange === '3m') {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (timeRange === '6m') {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    } else if (timeRange === '12m') {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }

    return purchaseOrders.filter((p) => {
      // Vendor filter
      if (selectedVendor !== 'all' && p.vendor !== selectedVendor) return false;
      // Fabric filter
      if (selectedFabric !== 'all') {
        const fab = getPoFabric ? getPoFabric(p) : p.fabric;
        if (fab !== selectedFabric) return false;
      }
      // Date filter
      if (cutoff) {
        const key = poMonthKey(p.date);
        if (key) {
          const [y, m] = key.split('-').map(Number);
          const pDate = new Date(y, m - 1, 1);
          if (pDate < cutoff) return false;
        }
      }
      return true;
    });
  }, [purchaseOrders, timeRange, selectedVendor, selectedFabric, getPoFabric]);

  // ── Aggregate Analytics KPIs ──────────────────────────────────────────────
  const analyticsKpis = useMemo(() => {
    let totalValue = 0;
    let totalOrdered = 0;
    let totalReceived = 0;

    filteredOrders.forEach((p) => {
      totalValue += Number(p.amount) || Number(p.total) || 0;
      const ord = getPoQty ? getPoQty(p) : Number(p.quantity || p.orderedQty) || 0;
      const rec = getPoReceivedQty ? getPoReceivedQty(p) : Number(p.receivedQty) || 0;
      totalOrdered += ord;
      totalReceived += rec;
    });

    const orderCount = filteredOrders.length;
    const aov = orderCount > 0 ? totalValue / orderCount : 0;
    const fulfillmentRate = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

    return {
      totalValue,
      orderCount,
      aov,
      totalOrdered,
      totalReceived,
      fulfillmentRate,
    };
  }, [filteredOrders, getPoQty, getPoReceivedQty]);

  // ── Monthly Purchase Value & Trend ────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const byMonth = new Map();
    filteredOrders.forEach((p) => {
      const key = poMonthKey(p.date);
      if (!key) return;
      const entry = byMonth.get(key) || { month: key, value: 0, count: 0, ordered: 0, received: 0 };
      entry.value += Number(p.amount) || Number(p.total) || 0;
      entry.count += 1;
      entry.ordered += getPoQty ? getPoQty(p) : Number(p.quantity || p.orderedQty) || 0;
      entry.received += getPoReceivedQty ? getPoReceivedQty(p) : Number(p.receivedQty) || 0;
      byMonth.set(key, entry);
    });

    // Sort chronologically
    return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredOrders, getPoQty, getPoReceivedQty]);

  const maxMonthValue = useMemo(() => {
    return Math.max(1, ...monthlyData.map((m) => m.value));
  }, [monthlyData]);

  // ── Vendor-wise Purchase Breakdown ────────────────────────────────────────
  const vendorBreakdown = useMemo(() => {
    const byVendor = new Map();
    filteredOrders.forEach((p) => {
      const v = p.vendor || 'Unknown Vendor';
      const entry = byVendor.get(v) || { vendor: v, value: 0, count: 0, ordered: 0, received: 0 };
      entry.value += Number(p.amount) || Number(p.total) || 0;
      entry.count += 1;
      entry.ordered += getPoQty ? getPoQty(p) : 0;
      entry.received += getPoReceivedQty ? getPoReceivedQty(p) : 0;
      byVendor.set(v, entry);
    });

    return Array.from(byVendor.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 vendors
  }, [filteredOrders, getPoQty, getPoReceivedQty]);

  // ── Fabric-wise Quantity Breakdown ────────────────────────────────────────
  const fabricBreakdown = useMemo(() => {
    const byFabric = new Map();
    filteredOrders.forEach((p) => {
      const fab = (getPoFabric ? getPoFabric(p) : p.fabric) || 'Other Fabric';
      const entry = byFabric.get(fab) || { fabric: fab, qty: 0, value: 0, count: 0 };
      entry.qty += getPoQty ? getPoQty(p) : Number(p.quantity) || 0;
      entry.value += Number(p.amount) || Number(p.total) || 0;
      entry.count += 1;
      byFabric.set(fab, entry);
    });

    return Array.from(byFabric.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8); // Top 8 fabrics
  }, [filteredOrders, getPoFabric, getPoQty]);

  // ── PO Status Distribution ────────────────────────────────────────────────
  const statusDistribution = useMemo(() => {
    const counts = {};
    filteredOrders.forEach((p) => {
      const s = getOscarStatus ? getOscarStatus(p) : p.status || 'Draft';
      counts[s] = (counts[s] || 0) + 1;
    });

    const STATUS_CONFIG = [
      { key: 'Fully Received', color: '#10b981', label: 'Fully Received' },
      { key: 'Partially Received', color: '#f97316', label: 'Partially Received' },
      { key: 'In Production', color: '#8b5cf6', label: 'In Production' },
      { key: 'Approved', color: '#3b82f6', label: 'Approved' },
      { key: 'Pending Approval', color: '#fbbf24', label: 'Pending Approval' },
      { key: 'Draft', color: '#94a3b8', label: 'Draft' },
      { key: 'Cancelled', color: '#f43f5e', label: 'Cancelled' },
    ];

    const total = filteredOrders.length;
    return STATUS_CONFIG.map((cfg) => {
      const count = counts[cfg.key] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { ...cfg, count, pct };
    }).filter((item) => item.count > 0 || ['Fully Received', 'Partially Received', 'Approved', 'Draft'].includes(item.key));
  }, [filteredOrders, getOscarStatus]);

  function formatMonthLabel(key) {
    if (!key) return '';
    const [y, m] = key.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
  }

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2eaf5] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#17294e]">
            <Filter size={14} className="text-[#2563eb]" />
            Filters:
          </span>

          {/* Time range selector */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {[
              { id: '3m', label: '3 Months' },
              { id: '6m', label: '6 Months' },
              { id: '12m', label: '1 Year' },
              { id: 'all', label: 'All Time' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeRange(t.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  timeRange === t.id
                    ? 'bg-white text-[#2563eb] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Vendor Filter */}
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-medium text-slate-700 outline-none focus:border-[#2563eb]"
          >
            <option value="all">All Vendors ({vendorOptions.length})</option>
            {vendorOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {/* Fabric Filter */}
          <select
            value={selectedFabric}
            onChange={(e) => setSelectedFabric(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-medium text-slate-700 outline-none focus:border-[#2563eb]"
          >
            <option value="all">All Fabrics ({fabricOptions.length})</option>
            {fabricOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] font-medium text-slate-500">
          Showing data for <strong className="text-[#17294e]">{filteredOrders.length}</strong> purchase orders
        </div>
      </div>

      {/* ── Summary KPI Metrics ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#bfdbfe] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Total Purchase Value</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563eb]">
              <ShoppingCart size={15} />
            </div>
          </div>
          <p className="mt-2 font-mono text-[18px] font-extrabold text-[#17294e]">
            {fmtCompact(analyticsKpis.totalValue)}
          </p>
          <p className="mt-1 text-[10.5px] text-slate-500">
            Across {analyticsKpis.orderCount} purchase orders
          </p>
        </div>

        <div className="rounded-xl border border-[#e2eaf5] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Avg PO Value (AOV)</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp size={15} />
            </div>
          </div>
          <p className="mt-2 font-mono text-[18px] font-extrabold text-[#17294e]">
            {fmtCompact(analyticsKpis.aov)}
          </p>
          <p className="mt-1 text-[10.5px] text-slate-500">Average ticket size per order</p>
        </div>

        <div className="rounded-xl border border-[#a7f3d0] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Receipt Fulfillment Rate</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <p className="mt-2 font-mono text-[18px] font-extrabold text-[#059669]">
            {analyticsKpis.fulfillmentRate}%
          </p>
          <p className="mt-1 text-[10.5px] text-slate-500">
            {analyticsKpis.totalReceived.toLocaleString('en-IN')} of {analyticsKpis.totalOrdered.toLocaleString('en-IN')} units
          </p>
        </div>

        <div className="rounded-xl border border-[#fed7aa] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Pending Receipt Qty</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <Clock size={15} />
            </div>
          </div>
          <p className="mt-2 font-mono text-[18px] font-extrabold text-orange-600">
            {Math.max(0, analyticsKpis.totalOrdered - analyticsKpis.totalReceived).toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-[10.5px] text-slate-500">Pending warehouse intake</p>
        </div>
      </div>

      {/* ── Row 1: Monthly Purchase Value & Spend Trend ────────────────────── */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Monthly Purchase Spend & Order Volume</h3>
            <p className="text-[11px] text-slate-500">Month-on-month total purchasing spend and order counts</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#2563eb]" />
              Purchase Spend (₹)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              PO Count
            </span>
          </div>
        </div>

        {monthlyData.length > 0 ? (
          <div className="space-y-3">
            <div className="flex h-48 items-end gap-3 pt-6 border-b border-slate-100 pb-2">
              {monthlyData.map((m) => {
                const heightPct = maxMonthValue > 0 ? (m.value / maxMonthValue) * 100 : 0;
                return (
                  <div key={m.month} className="group flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[9.5px] font-mono font-bold text-slate-600">
                      {fmtCompact(m.value)}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-[#1d4ed8] to-[#3b82f6] transition-all group-hover:brightness-110"
                        style={{ height: `${Math.max(6, heightPct)}%` }}
                        title={`${formatMonthLabel(m.month)}: ${fmtCompact(m.value)} (${m.count} POs)`}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-amber-50 px-1 text-[8.5px] font-bold text-amber-700 border border-amber-200">
                        {m.count}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600 whitespace-nowrap">
                      {formatMonthLabel(m.month)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="py-12 text-center text-[12px] text-slate-400">No monthly purchase data available for the selected filters.</p>
        )}
      </div>

      {/* ── Row 2: Vendor Breakdown & Ordered vs Received ──────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Vendor Breakdown */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-extrabold text-[#17294e]">Vendor-wise Purchase Value</h3>
              <p className="text-[10.5px] text-slate-500">Top vendors by total purchase order amount</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">{vendorBreakdown.length} Vendors</span>
          </div>

          {vendorBreakdown.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {vendorBreakdown.map((v) => {
                const totalSpend = analyticsKpis.totalValue;
                const pct = totalSpend > 0 ? (v.value / totalSpend) * 100 : 0;
                return (
                  <div key={v.vendor} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="font-bold text-[#17294e] truncate max-w-[220px]">{v.vendor}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-slate-800">{fmtCompact(v.value)}</span>
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-bold text-[#2563eb]">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#2563eb] transition-all"
                        style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{v.count} Purchase Orders</span>
                      <span>Fulfillment: {v.ordered > 0 ? Math.round((v.received / v.ordered) * 100) : 0}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-[11.5px] text-slate-400">No vendor purchase records available.</p>
          )}
        </div>

        {/* PO Status Distribution */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-extrabold text-[#17294e]">PO Status Distribution</h3>
                <p className="text-[10.5px] text-slate-500">Current status spread across active orders</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">{filteredOrders.length} Total</span>
            </div>

            <div className="space-y-2 pt-1">
              {statusDistribution.map((s) => (
                <div key={s.key} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-[11.5px] font-medium text-slate-700">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11.5px] font-extrabold text-[#17294e]">{s.count}</span>
                    <span className="text-[10.5px] text-slate-400">({s.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-blue-50/70 border border-blue-100 p-2.5 text-[11px] text-blue-900">
            <strong>Procurement Insight:</strong>{' '}
            {analyticsKpis.fulfillmentRate >= 80
              ? 'High fulfillment performance. Order receipts are mostly on schedule.'
              : 'Attention needed on pending receipts to prevent production bottlenecks.'}
          </div>
        </div>
      </div>

      {/* ── Row 3: Fabric-wise Quantity Distribution ──────────────────────── */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-extrabold text-[#17294e]">Fabric-wise Purchase Volume</h3>
            <p className="text-[10.5px] text-slate-500">Volume distribution across fabrics in meters and units</p>
          </div>
          <span className="text-[10px] font-semibold text-slate-400">{fabricBreakdown.length} Fabrics</span>
        </div>

        {fabricBreakdown.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
            {fabricBreakdown.map((f, i) => {
              const totalFabricQty = fabricBreakdown.reduce((s, x) => s + x.qty, 0);
              const pct = totalFabricQty > 0 ? (f.qty / totalFabricQty) * 100 : 0;
              const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#0ea5e9', '#059669', '#8b5cf6', '#d97706', '#64748b'];
              const col = COLORS[i % COLORS.length];

              return (
                <div key={f.fabric} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="h-2 w-2 rounded-full" style={{ background: col }} />
                    <span className="rounded bg-white px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600 border border-slate-200">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <h4 className="mt-2 text-[12px] font-bold text-[#17294e] truncate" title={f.fabric}>
                    {f.fabric}
                  </h4>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-mono text-[14px] font-extrabold text-slate-800">
                      {f.qty.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400">{f.count} POs</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                  </div>
                  <p className="mt-1.5 text-[10px] font-medium text-slate-500">
                    Spend: <strong className="text-slate-700">{fmtCompact(f.value)}</strong>
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-[11.5px] text-slate-400">No fabric quantity records available.</p>
        )}
      </div>
    </div>
  );
}
