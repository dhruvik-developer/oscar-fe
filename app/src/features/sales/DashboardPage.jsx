import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAppStore } from '../../stores/appStore';
import {
  BarChart3, Banknote, ShoppingCart, Settings, Truck, FileText,
  Landmark, Database, Package, TrendingUp, TrendingDown,
  Factory, ShieldCheck, Users, TriangleAlert, ArrowRight, ChevronDown,
  Layers, ClipboardList, Cog, Boxes, RotateCcw, Ban, HelpCircle, Loader2, RefreshCw, CheckCircle2, Calendar,
} from 'lucide-react';
import PageInfoButton from '../../components/ui/PageInfoButton';
import KpiCard from '../../components/ui/KpiCard';

/*
 * Business position dashboard. Every figure comes from
 * GET /reports/sales-dashboard/?date=YYYY-MM-DD — this page only renders.
 * Amounts arrive as decimal strings; Number() is used for display only.
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const inr = (v) => `₹ ${num(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const meters = (v) => `${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} m`;
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
const dayLabel = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`;
};
/** % change vs previous; null when there is no previous figure to compare with. */
const pctChange = (cur, prev) => {
  const c = num(cur);
  const p = num(prev);
  if (p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
};
const getAdaptiveChartScale = (maxVal) => {
  if (maxVal <= 0) {
    return {
      niceMax: 100000,
      unitLabel: '₹ in Lakhs',
      formatTick: (v) => (v === 0 ? '0' : `${+(v / 100000).toFixed(1)}L`),
    };
  }
  if (maxVal >= 10000000) {
    const cr = maxVal / 10000000;
    const niceCr = Math.ceil(cr * 1.15 * 10) / 10;
    return {
      niceMax: niceCr * 10000000,
      unitLabel: '₹ in Crores',
      formatTick: (v) => (v === 0 ? '0' : `${+(v / 10000000).toFixed(niceCr >= 10 ? 0 : 1)} Cr`),
    };
  }
  if (maxVal >= 100000) {
    const l = maxVal / 100000;
    const niceL = Math.ceil(l * 1.15 * 10) / 10;
    return {
      niceMax: niceL * 100000,
      unitLabel: '₹ in Lakhs',
      formatTick: (v) => (v === 0 ? '0' : `${+(v / 100000).toFixed(2)}L`),
    };
  }
  if (maxVal >= 1000) {
    const k = maxVal / 1000;
    const niceK = Math.ceil(k * 1.15 / 5) * 5;
    return {
      niceMax: niceK * 1000,
      unitLabel: '₹ in Thousands',
      formatTick: (v) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`),
    };
  }
  const nice = Math.ceil((maxVal * 1.15) / 100) * 100;
  return {
    niceMax: nice,
    unitLabel: 'Amounts in ₹',
    formatTick: (v) => (v === 0 ? '0' : `₹${Math.round(v)}`),
  };
};

function Donut({ pct, size = 128, stroke = 13, color = '#22c55e', track = '#e6ecf4', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, num(pct)));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {p > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, pct, vs, index }) {
  return (
    <KpiCard
      icon={Icon}
      label={label}
      value={value}
      pct={pct}
      vs={vs}
      index={index}
    />
  );
}

function SectionCard({ icon: Icon, title, linkTo, linkLabel = 'View Details', children, className = '', iconColor = '#2563eb' }) {
  return (
    <section className={`rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#17294e]">
          <Icon size={16} style={{ color: iconColor }} />
          {title}
        </h3>
        {linkTo && (
          <Link to={linkTo} className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#2563eb] hover:underline">
            {linkLabel} <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyNote({ children }) {
  return <div className="py-6 text-center text-xs text-slate-400">{children}</div>;
}

const KPI_DEFS = [
  { key: 'sales', icon: BarChart3, label: 'Sales', tileBg: '#e9f1fd', iconBg: '#d9e8fd', iconColor: '#2563eb' },
  { key: 'collection', icon: Banknote, label: 'Collection', tileBg: '#e7f6ec', iconBg: '#d3efdb', iconColor: '#16a34a' },
  { key: 'purchase', icon: ShoppingCart, label: 'Purchase', tileBg: '#fdeeee', iconBg: '#fbdcdc', iconColor: '#ef4444' },
  { key: 'jobWorkExpense', icon: Settings, label: 'Job Work Expense', tileBg: '#efe9fd', iconBg: '#ddd0fa', iconColor: '#7c3aed' },
  { key: 'transport', icon: Truck, label: 'Transport', tileBg: '#fdf3e0', iconBg: '#fbe5bd', iconColor: '#d97706' },
  { key: 'otherExpense', icon: FileText, label: 'Other Expense', tileBg: '#e7f6ef', iconBg: '#d2efe0', iconColor: '#0d9488' },
];

const AGEING_COLORS = ['#22c55e', '#38bdf6', '#facc15', '#fb923c', '#f87171'];
const JW_COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#7c3aed'];

export const DashboardPage = () => {
  const currentUser = useAppStore((s) => s.currentUser);
  const todayIso = localIso(new Date());
  const yesterdayIso = localIso(new Date(Date.now() - 86400000));
  const [selectedDate, setSelectedDate] = useState(() => todayIso);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [batchView, setBatchView] = useState('profitable');
  const [hoveredDayIdx, setHoveredDayIdx] = useState(null);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    if (!selectedDate) return;
    setLoading(true);
    setError('');
    api.get('/reports/sales-dashboard/', { query: { date: selectedDate } })
      .then((res) => {
        if (!active) return;
        setData(res?.data && res.data.kpis ? res.data : res);
      })
      .catch((err) => {
        if (!active) return;
        setData(null);
        setError(err?.message || 'Could not load the dashboard.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedDate, reloadKey]);

  const periodLabel = selectedDate === todayIso
    ? 'Today'
    : selectedDate === yesterdayIso
      ? 'Yesterday'
      : displayDate(selectedDate);
  const header = (
    <div className="relative overflow-hidden rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
      <img
        src="/guide/febric.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[300px] object-cover object-center sm:block md:w-[380px]"
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[300px] bg-gradient-to-r from-white via-white/55 to-transparent sm:block md:w-[380px]" />
      <div className="relative flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[21px] font-extrabold tracking-tight text-[#17294e]">Business Position</h1>
            <PageInfoButton title="Dashboard Overview" />
          </div>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            {currentUser?.name ? `Welcome, ${currentUser.name}. ` : ''}
            {data?.date ? `Figures for ${displayDate(data.date)}, compared with ${displayDate(data.previousDate)}.` : 'Live figures from the books.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-[#dce5f4] bg-white px-3 py-1.5 shadow-xs transition-colors focus-within:border-[#2563eb]">
            <Calendar size={15} className="text-[#2563eb] shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              onClick={(e) => {
                if (e.target.showPicker) {
                  try { e.target.showPicker(); } catch {}
                }
              }}
              className="bg-transparent text-[12.5px] font-semibold text-slate-700 outline-none cursor-pointer"
            />
          </div>
          {selectedDate !== todayIso && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayIso)}
              className="rounded-lg border border-[#dce5f4] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#2563eb] hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
              title="Reset to Today"
            >
              Today
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const shell = (children) => (
    <div className="-m-3 md:-m-5 bg-[#edf3fc] p-3 md:p-5 space-y-3 min-h-[calc(100vh-62px)]">
      {header}
      {children}
    </div>
  );

  if (loading && !data) {
    return shell(
      <div className="flex items-center justify-center gap-2 rounded-xl border border-[#e2eaf5] bg-white p-10 text-[13px] font-semibold text-slate-500">
        <Loader2 size={18} className="animate-spin text-[#2563eb]" /> Loading business position…
      </div>,
    );
  }

  if (error) {
    return shell(
      <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-white p-8 text-center">
        <TriangleAlert size={26} className="text-rose-500" />
        <div>
          <p className="text-[14px] font-extrabold text-[#17294e]">Could not load the dashboard</p>
          <p className="mt-1 text-[12.5px] text-rose-600">{error}</p>
        </div>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-[12.5px] font-bold text-white hover:bg-blue-700 cursor-pointer"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>,
    );
  }

  if (!data) {
    return shell(<EmptyNote>No dashboard data returned.</EmptyNote>);
  }

  const kpis = data.kpis || {};
  const funds = data.funds || {};
  const wc = data.workingCapital || {};
  const inv = data.inventoryPosition || {};
  const production = data.production || {};
  const jwInProcess = Array.isArray(data.jobWorkInProcess) ? data.jobWorkInProcess : [];
  const qc = data.qc || {};
  const trend = Array.isArray(data.salesTrend) ? data.salesTrend : [];
  const ageingData = data.receivableAgeing || {};
  const attention = Array.isArray(data.attention) ? data.attention : [];
  // null when the viewer may not see batch cost (view_ledger).
  const bp = data.batchProfit;
  const bpRows = bp ? (batchView === 'loss' ? (Array.isArray(bp.lossMaking) ? bp.lossMaking : bp.worst || []) : (Array.isArray(bp.profitable) ? bp.profitable : bp.best || [])) : [];

  /* inventory position */
  const lotSub = (row) => `${meters(row?.qty)}${row?.lots ? ` · ${num(row.lots).toLocaleString('en-IN')} lot${num(row.lots) === 1 ? '' : 's'}` : ''}`;
  const inventoryRows = [
    { key: 'grey', icon: Layers, tint: '#e8f1fd', fg: '#2563eb', l: 'Grey Stock', row: inv.grey, s: meters(inv.grey?.qty) },
    { key: 'finished', icon: Boxes, tint: '#e7f6ef', fg: '#0d9488', l: 'Finished Stock', row: inv.finished, s: meters(inv.finished?.qty) },
    ...(num(inv.unclassified?.qty) > 0
      ? [{ key: 'unclassified', icon: HelpCircle, tint: '#f1f5f9', fg: '#64748b', l: 'Unclassified', row: inv.unclassified, s: `${meters(inv.unclassified?.qty)} · no fabric type` }]
      : []),
    { key: 'externalWip', icon: ClipboardList, tint: '#e7f6ec', fg: '#16a34a', l: 'External WIP', row: inv.externalWip, s: meters(inv.externalWip?.qty) },
    { key: 'qcHold', icon: Cog, tint: '#fdf3e0', fg: '#d97706', l: 'QC Hold', row: inv.qcHold, s: lotSub(inv.qcHold) },
    { key: 'reprocess', icon: RotateCcw, tint: '#fdeeee', fg: '#ef4444', l: 'Reprocess', row: inv.reprocess, s: lotSub(inv.reprocess) },
    { key: 'rejected', icon: Ban, tint: '#fdeeee', fg: '#b91c1c', l: 'Rejected', row: inv.rejected, s: lotSub(inv.rejected) },
  ];
  const inventoryEmpty = inventoryRows.every((r) => num(r.row?.qty) === 0 && num(r.row?.value) === 0);

  /* sales & collection trend */
  const maxRawVal = Math.max(0, ...trend.map((t) => Math.max(num(t.sales), num(t.collection))));
  const total7dSales = trend.reduce((sum, t) => sum + num(t.sales), 0);
  const total7dColl = trend.reduce((sum, t) => sum + num(t.collection), 0);
  const chartScale = getAdaptiveChartScale(maxRawVal);
  const trendEmpty = trend.length === 0 || maxRawVal <= 0;

  /* receivable ageing */
  const bucketOrder = Array.isArray(ageingData.bucketOrder) && ageingData.bucketOrder.length
    ? ageingData.bucketOrder
    : Object.keys(ageingData.buckets || {});
  const ageingTotal = num(ageingData.total);
  const ageing = bucketOrder.map((key) => {
    const amount = num(ageingData.buckets?.[key]);
    return {
      key,
      label: `${String(key).replace('-', ' – ')} Days`,
      amount,
      pct: ageingTotal > 0 ? Math.round((amount / ageingTotal) * 100) : 0,
    };
  });

  const completion = production.completionPct;
  const yieldPct = qc.yieldPct;

  return shell(
    <>
      {loading && (
        <div className="flex items-center gap-2 px-1 text-[11.5px] font-semibold text-slate-500">
          <Loader2 size={13} className="animate-spin" /> Refreshing…
        </div>
      )}

      {/* business position */}
      <section className="rounded-xl border border-[#e2eaf5] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <h2 className="mb-3 px-0.5 text-[13px] font-extrabold text-[#17294e]">{periodLabel}&apos;s Business Position</h2>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 2xl:grid-cols-6">
          {KPI_DEFS.map((k, idx) => {
            const v = kpis[k.key] || { current: 0, previous: 0 };
            return (
              <KpiTile
                key={k.key} icon={k.icon} label={k.label}
                value={inr(v.current)} pct={pctChange(v.current, v.previous)}
                vs={inr(v.previous)} index={idx}
              />
            );
          })}
        </div>
      </section>

      {/* funds row */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Landmark}
          label="Funds Position"
          value={inr(funds.total)}
          sub={Array.isArray(funds.accounts) && funds.accounts.length
            ? `Cash & Bank · ${funds.accounts.length} account${funds.accounts.length === 1 ? '' : 's'}`
            : 'No cash / bank accounts'}
          variant="white"
          index={0}
        />
        <KpiCard
          icon={Database}
          label="Working Capital"
          value={inr(wc.workingCapital)}
          sub={`${inr(wc.currentAssets)} assets − ${inr(wc.currentLiabilities)} liab.`}
          variant="white"
          index={1}
        />
        <KpiCard
          icon={Package}
          label="Stock Value"
          value={inr(data.stockValue)}
          sub="On hand at weighted average cost"
          variant="white"
          index={2}
        />
        {bp && (
          <Link to="/inventory/batch-profitability" className="block">
            <KpiCard
              icon={Boxes}
              label="Batch Realized Profit"
              value={inr(bp.netRealizedContribution || bp.net)}
              sub={num(bp.profitableCount || bp.profitable) + num(bp.lossMakingCount || bp.lossMaking) > 0
                ? `${num(bp.profitableCount || bp.profitable)} profitable · ${num(bp.lossMakingCount || bp.lossMaking)} loss-making`
                : `${num(bp.unsoldBatchesCount || bp.totalBatches || 0)} unsold (Not Yet Realized)`}
              variant="white"
              index={3}
            />
          </Link>
        )}
      </div>

      {bp && (
        <SectionCard
          icon={TrendingUp}
          title="Batch-wise Profitability"
          linkTo="/inventory/batch-profitability"
          linkLabel="View All Batch Profitability →"
        >
          {/* Header Description & View Toggle */}
          <div className="-mt-1 mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11.5px] text-slate-500">
              Realized profit &amp; loss per batch from commercial dispatches (Revenue − Sold Landed Cost − Direct Expenses). Unsold stock is preserved as Not Yet Realized.
            </p>
            <div className="flex rounded-lg border border-slate-200 p-0.5 text-[11px] font-bold bg-slate-50">
              <button
                type="button"
                onClick={() => setBatchView('profitable')}
                className={`rounded-md px-3 py-1 cursor-pointer transition-colors ${
                  batchView === 'profitable'
                    ? 'bg-[#2563eb] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top 5 Profitable Batches {num(bp.profitableCount ?? bp.profitable) > 0 ? `(${num(bp.profitableCount ?? bp.profitable)})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setBatchView('loss')}
                className={`rounded-md px-3 py-1 cursor-pointer transition-colors ${
                  batchView === 'loss'
                    ? 'bg-[#2563eb] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top 5 Loss-making Batches {num(bp.lossMakingCount ?? bp.lossMaking) > 0 ? `(${num(bp.lossMakingCount ?? bp.lossMaking)})` : ''}
              </button>
            </div>
          </div>

          {/* 4 Summary Metrics Cards */}
          <div className="mb-4 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            <KpiCard
              label="Total Realized Profit"
              value={inr(bp.totalRealizedProfit || bp.totalProfit)}
              sub="Dispatched sales gain"
              icon={TrendingUp}
              tone="green"
            />
            <KpiCard
              label="Total Realized Loss"
              value={inr(bp.totalRealizedLoss || bp.totalLoss)}
              sub="Dispatched sales loss"
              icon={TrendingDown}
              tone="pink"
            />
            <KpiCard
              label="Profitable Batches"
              value={num(bp.profitableCount ?? bp.profitable)}
              sub="Batches with net positive margin"
              icon={ShieldCheck}
              tone="blue"
            />
            <KpiCard
              label="Loss-making Batches"
              value={num(bp.lossMakingCount ?? bp.lossMaking)}
              sub="Batches with net negative margin"
              icon={TriangleAlert}
              tone="amber"
            />
          </div>

          {/* Table or Empty/Unsold State */}
          {bpRows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-center">
              <ShieldCheck size={28} className="mx-auto mb-2 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-800">
                {batchView === 'loss'
                  ? 'No Loss-Making Batches Found'
                  : 'All Batches Held in Inventory (Not Yet Realized)'}
              </h4>
              <p className="mx-auto mt-1 max-w-xl text-xs text-slate-500 leading-relaxed">
                {batchView === 'loss'
                  ? 'There are currently no batches that incurred a realized net loss on commercial sales dispatches.'
                  : `Currently, all ${num(bp.unsoldBatchesCount || bp.totalBatches || 0)} active batches are maintained in warehouse inventory (${inr(bp.totalUnsoldValue)} valuation). Under OSCAR realized profit principles, unsold stock is strictly classified as "Not Yet Realized" and never counted as premature profit.`}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Link
                  to="/inventory/batch-profitability"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-600 transition-colors"
                >
                  Open Full Batch Profitability Ledger <ArrowRight size={14} />
                </Link>
                <Link
                  to="/inventory/batches"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Boxes size={14} /> Batch Registry
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="py-2.5 px-3">Batch Code</th>
                    <th className="py-2.5 px-3">Fabric Name</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3 text-right">Total Sold Qty</th>
                    <th className="py-2.5 px-3 text-right">Allocated Revenue</th>
                    <th className="py-2.5 px-3 text-right">Total Allocated Cost</th>
                    <th className="py-2.5 px-3 text-right">Net Profit / Loss</th>
                    <th className="py-2.5 px-3 text-center">Profit Margin %</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bpRows.map((r) => {
                    const isLoss = num(r.netResult) < 0;
                    const isGrey = String(r.stage || r.fabricType).toUpperCase() === 'GREY';
                    const isDyed = String(r.stage || r.fabricType).toUpperCase() === 'DYED';

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-bold font-mono">
                          <Link
                            to={`/inventory/batches/${encodeURIComponent(r.batchCode)}`}
                            className="text-[#2563eb] hover:underline"
                            title="Open Batch Passport"
                          >
                            {r.batchCode}
                          </Link>
                        </td>
                        <td className="max-w-[200px] truncate py-2.5 px-3 font-medium text-slate-700" title={r.fabricName || r.item || ''}>
                          {r.fabricName || r.item || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isGrey
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isDyed
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {r.stage || r.fabricType || 'Fabric'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700">
                          {meters(r.soldQty)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700">
                          {inr(r.salesRevenue || r.revenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700">
                          {inr(r.totalAllocatedCost || r.cost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className={`font-extrabold ${isLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {!isLoss ? '+' : ''}{inr(r.netResult)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {r.marginPct === null || r.marginPct === undefined ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span className={isLoss ? 'text-rose-600' : 'text-emerald-600'}>
                              {num(r.marginPct).toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Link
                            to={`/inventory/batch-profitability?search=${encodeURIComponent(r.batchCode)}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors"
                          >
                            Audit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* production / inventory / qc */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <SectionCard icon={Factory} title="Production & Job Work" linkTo="/pms/production-instructions">
          {completion === null || completion === undefined ? (
            <EmptyNote>No active instructions.</EmptyNote>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <Donut pct={completion}>
                  <strong className="text-[21px] font-extrabold text-[#17294e]">{num(completion).toFixed(1)}%</strong>
                </Donut>
                <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">
                  Production<br />Completion
                </p>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-[12px] font-medium text-slate-600">
                {[
                  ['Instructions', num(production.instructions).toLocaleString('en-IN'), '#64748b'],
                  ['Planned', meters(production.plannedMeters), '#2563eb'],
                  ['Produced', meters(production.producedMeters), '#22c55e'],
                  ['Pending', meters(production.pendingMeters), '#f59e0b'],
                ].map(([l, v, c]) => (
                  <li key={l} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
                    <span className="font-bold text-slate-800">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-[12px] font-bold text-slate-700">Job Work (In Process)</p>
            {jwInProcess.length === 0 ? (
              <p className="py-1 text-[11px] text-slate-400">No fabric out at job-work vendors.</p>
            ) : (
              <ul className="space-y-1.5 text-[12px] font-medium text-slate-600">
                {jwInProcess.map(({ process, qty }, idx) => (
                  <li key={process} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full" style={{ background: JW_COLORS[idx % JW_COLORS.length] }} />
                      {process}
                    </span>
                    <span className="font-bold text-slate-800">{meters(qty)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={Package} title="Inventory Position (Value)" linkTo="/inventory/stock-position">
          {inventoryEmpty ? (
            <EmptyNote>No stock on hand.</EmptyNote>
          ) : (
            <ul className="divide-y divide-slate-100">
              {inventoryRows.map((r) => (
                <li key={r.key}>
                  <Link to="/inventory/stock-position" className="group flex items-center gap-3 py-[9px]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: r.tint, color: r.fg }}>
                      <r.icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-bold text-slate-700">{r.l}</span>
                      <span className="block text-[11px] text-slate-400">{r.s}</span>
                    </span>
                    {r.row?.value === null || r.row?.value === undefined ? (
                      <span className="text-[11.5px] font-semibold italic text-slate-400" title="Some fabric at vendors has no material rate to value it at">Not valued</span>
                    ) : (
                      <span className="text-[13px] font-extrabold text-[#17294e]">{inr(r.row.value)}</span>
                    )}
                    <ArrowRight size={13} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={ShieldCheck} title="QC & Wastage" linkTo="/job-work/inward">
          <p className="-mt-2 mb-2 text-[11px] text-slate-400">Job-work inwards since {displayDate(qc.since)}</p>
          {yieldPct === null || yieldPct === undefined ? (
            <EmptyNote>No job-work inwards received in this period.</EmptyNote>
          ) : (
            <div className="flex items-center gap-4">
              <Donut pct={yieldPct}>
                <strong className="text-[18px] font-extrabold text-[#17294e]">{num(yieldPct).toFixed(1)}%</strong>
                <span className="text-[10.5px] font-medium text-slate-500">Good Yield</span>
              </Donut>
              <ul className="min-w-0 flex-1 space-y-1.5 text-[12px] font-medium text-slate-600">
                {[
                  ['Received', meters(qc.received)],
                  ['Good', meters(qc.good)],
                  ['Reprocess', meters(qc.reprocess)],
                  ['Reject', meters(qc.reject)],
                  ['Loss', meters(qc.loss)],
                ].map(([l, v]) => (
                  <li key={l} className="flex items-center justify-between gap-2">
                    <span>{l}</span><span className="font-bold text-slate-800">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {qc.lossPct !== null && qc.lossPct !== undefined && (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#fdeeee] px-3 py-2 text-[12px] font-bold text-[#dc2626]">
              <TriangleAlert size={14} /> {num(qc.lossPct).toFixed(1)}% Process Loss (finished orders)
            </div>
          )}
        </SectionCard>
      </div>

      {/* sales chart / ageing / attention */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <SectionCard icon={BarChart3} title="Sales & Collection (Last 7 Days)" linkTo="/sales/invoices" className="flex flex-col justify-between">
          {trendEmpty ? (
            <EmptyNote>No sales or collections in the last 7 days.</EmptyNote>
          ) : (
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <div className="mb-3 flex items-center justify-between gap-2 text-[11.5px]">
                  <div className="flex items-center gap-3 font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-xs bg-[#2563eb]" />Sales</span>
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-xs bg-[#10b981]" />Collection</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {hoveredDayIdx !== null && trend[hoveredDayIdx] ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
                        {dayLabel(trend[hoveredDayIdx].date)}: <span className="font-bold text-[#2563eb]">{inr(trend[hoveredDayIdx].sales)}</span> | <span className="font-bold text-[#10b981]">{inr(trend[hoveredDayIdx].collection)}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">{chartScale.unitLabel}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex w-12 shrink-0 flex-col justify-between py-0.5 pr-2 text-right text-[9.5px] font-semibold text-slate-400 font-mono">
                    {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                      <span key={f}>{chartScale.formatTick(chartScale.niceMax * f)}</span>
                    ))}
                  </div>
                  <div className="relative flex-1">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="border-t border-dashed border-slate-100" />)}
                    </div>
                    <div className="relative flex h-44 items-end gap-2">
                      {trend.map((t, i) => {
                        const s = num(t.sales);
                        const c = num(t.collection);
                        const h = (v) => (v > 0 ? `${Math.max(4, (v / chartScale.niceMax) * 100)}%` : '0%');
                        const isHovered = hoveredDayIdx === i;
                        return (
                          <div
                            key={t.date}
                            onMouseEnter={() => setHoveredDayIdx(i)}
                            onMouseLeave={() => setHoveredDayIdx(null)}
                            className={`flex h-full flex-1 flex-col items-center justify-end gap-1.5 rounded-md transition-colors cursor-pointer py-0.5 ${isHovered ? 'bg-slate-50' : ''}`}
                          >
                            <div className="flex w-full max-w-[48px] flex-1 items-end justify-center gap-1 px-0.5">
                              <div
                                className="w-1/2 rounded-t-md bg-[#2563eb] transition-all hover:brightness-110 shadow-xs"
                                style={{ height: h(s) }}
                                title={`Sales: ${inr(t.sales)} on ${dayLabel(t.date)}`}
                              />
                              <div
                                className="w-1/2 rounded-t-md bg-[#10b981] transition-all hover:brightness-110 shadow-xs"
                                style={{ height: h(c) }}
                                title={`Collection: ${inr(t.collection)} on ${dayLabel(t.date)}`}
                              />
                            </div>
                            <span className={`text-[9.5px] font-semibold tracking-tight ${isHovered ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                              {dayLabel(t.date)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Sleek Bottom Executive Summary Strip (fills space beautifully) ── */}
              <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5">
                <div className="rounded-lg bg-blue-50/60 border border-blue-100/70 px-3 py-2 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">7D Sales</span>
                    <strong className="block text-[14px] font-black font-mono text-blue-700 leading-tight">{inr(total7dSales)}</strong>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                </div>
                <div className="rounded-lg bg-emerald-50/60 border border-emerald-100/70 px-3 py-2 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">7D Collection</span>
                    <strong className="block text-[14px] font-black font-mono text-emerald-700 leading-tight">{inr(total7dColl)}</strong>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Users} title="Customer Receivable Ageing" linkTo="/sales/invoices">
          {ageingTotal === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-3 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-[13px] font-bold text-slate-800">All Receivables Settled</h4>
              <p className="mt-1 text-[11px] text-slate-500 max-w-[240px]">
                All customer sales invoices are fully paid or reconciled. Zero pending or overdue receivables across all accounts.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50/70 border border-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                <span>Total Balance Due:</span>
                <span className="font-extrabold font-mono">₹0.00</span>
              </div>
            </div>
          ) : (
            <>
              <ul className="space-y-3 pt-1">
                {ageing.map((b, i) => (
                  <li key={b.key} className="flex items-center gap-2 text-[12px]">
                    <span className="w-[84px] shrink-0 font-medium text-slate-500">{b.label}</span>
                    <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-[#eef2f7]">
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(b.amount > 0 ? 6 : 0, b.pct))}%`, background: AGEING_COLORS[i % AGEING_COLORS.length] }} />
                    </span>
                    <span className="w-[84px] shrink-0 text-right font-extrabold text-[#17294e]">{inr(b.amount)}</span>
                    <span className="w-[40px] shrink-0 text-right text-[11px] font-semibold text-slate-400">({b.pct}%)</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-right text-[11px] font-semibold text-slate-500">Total outstanding: <span className="font-extrabold text-[#17294e]">{inr(ageingTotal)}</span></p>
            </>
          )}
        </SectionCard>

        <section className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#dc2626]">
              <TriangleAlert size={16} /> Attention Required
            </h3>
          </div>
          {attention.length === 0 ? (
            <EmptyNote>Nothing needs attention.</EmptyNote>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((a) => {
                const row = (
                  <>
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#fdeeee] text-[#dc2626]">
                      <TriangleAlert size={11} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{a.label}</span>
                    <span className={`font-extrabold ${num(a.count) > 0 ? 'text-[#dc2626]' : 'text-slate-400'}`}>{num(a.count).toLocaleString('en-IN')}</span>
                  </>
                );
                return (
                  <li key={a.key || a.label}>
                    {a.link ? (
                      <Link to={a.link} className="flex items-center gap-2 py-[6.5px] text-[12.5px] font-medium text-slate-600 hover:text-[#2563eb]">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 py-[6.5px] text-[12.5px] font-medium text-slate-600">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>,
  );
};

export default DashboardPage;
