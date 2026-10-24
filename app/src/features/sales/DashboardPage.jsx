import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAppStore } from '../../stores/appStore';
import {
  BarChart3, Banknote, ShoppingCart, Settings, Truck, FileText,
  Landmark, Database, Package, TrendingUp, TrendingDown, Minus,
  Factory, ShieldCheck, Users, TriangleAlert, ArrowRight, ChevronDown,
  Layers, ClipboardList, Cog, Boxes, RotateCcw, Ban, HelpCircle, Loader2, RefreshCw,
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
const lakhTick = (v) => (v >= 10 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(2));

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

function ChangeBadge({ pct }) {
  if (pct === null) {
    return (
      <span className="flex items-center gap-1 text-slate-400">
        <Minus size={13} /> —
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span className={`flex items-center gap-1 ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function KpiTile({ icon: Icon, label, value, pct, vs, tileBg, iconBg, iconColor }) {
  const up = pct >= 0;
  const trendText = pct !== null ? `${up ? '+' : ''}${pct.toFixed(1)}% vs ${vs}` : undefined;
  return (
    <KpiCard
      icon={Icon}
      label={label}
      value={value}
      trend={trendText}
      iconBg={iconBg}
      iconColor={iconColor}
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
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    const now = new Date();
    const target = period === 'yesterday'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      : now;
    setLoading(true);
    setError('');
    api.get('/reports/sales-dashboard/', { query: { date: localIso(target) } })
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
  }, [period, reloadKey]);

  const periodLabel = period === 'yesterday' ? 'Yesterday' : 'Today';
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
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="appearance-none rounded-lg border border-[#dce5f4] bg-white py-2 pl-3.5 pr-9 text-[12.5px] font-semibold text-slate-700 shadow-xs outline-none cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
  const gp = kpis.grossProfit || { current: 0, previous: 0 };
  const gpPct = pctChange(gp.current, gp.previous);

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

  /* sales & collection trend, in lakhs */
  const salesL = trend.map((t) => num(t.sales) / 100000);
  const collL = trend.map((t) => num(t.collection) / 100000);
  const maxLakh = Math.max(0, ...salesL, ...collL);
  const trendEmpty = trend.length === 0 || maxLakh <= 0;

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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {KPI_DEFS.map((k) => {
            const v = kpis[k.key] || { current: 0, previous: 0 };
            return (
              <KpiTile
                key={k.key} icon={k.icon} label={k.label}
                value={inr(v.current)} pct={pctChange(v.current, v.previous)}
                vs={inr(v.previous)} tileBg={k.tileBg} iconBg={k.iconBg} iconColor={k.iconColor}
              />
            );
          })}
        </div>
      </section>

      {/* funds row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Landmark, label: 'Funds Position', value: inr(funds.total),
            sub: Array.isArray(funds.accounts) && funds.accounts.length
              ? `Cash & Bank · ${funds.accounts.length} account${funds.accounts.length === 1 ? '' : 's'}`
              : 'No cash / bank accounts',
            bg: '#e8f1fd', fg: '#2563eb',
          },
          {
            icon: Database, label: 'Working Capital', value: inr(wc.workingCapital),
            sub: `${inr(wc.currentAssets)} assets − ${inr(wc.currentLiabilities)} liab.`,
            bg: '#e7f6ef', fg: '#0d9488',
          },
          { icon: Package, label: 'Stock Value', value: inr(data.stockValue), sub: 'On hand at weighted average cost', bg: '#e7f6ec', fg: '#16a34a' },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: c.bg, color: c.fg }}>
              <c.icon size={21} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500">{c.label}</p>
              <p className="truncate text-[18px] font-extrabold tracking-tight text-[#17294e]">{c.value}</p>
              <p className="truncate text-[11px] text-slate-400">{c.sub}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#efe9fd] text-violet-600">
            <BarChart3 size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-500">Gross Profit ({periodLabel})</p>
            <p className={`truncate text-[18px] font-extrabold tracking-tight ${num(gp.current) < 0 ? 'text-rose-600' : 'text-[#17294e]'}`}>{inr(gp.current)}</p>
          </div>
          <div className="flex flex-col items-end text-right text-[11px] font-bold">
            <ChangeBadge pct={gpPct} />
            <span className="font-medium text-slate-400">vs. {inr(gp.previous)}</span>
          </div>
        </div>
      </div>

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
        <SectionCard icon={BarChart3} title="Sales & Collection (Last 7 Days)" linkTo="/sales/invoices">
          {trendEmpty ? (
            <EmptyNote>No sales or collections in the last 7 days.</EmptyNote>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-4 text-[11px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-[#2563eb]" />Sales</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-[#34d399]" />Collection</span>
              </div>
              <div className="flex gap-1.5">
                <div className="flex w-9 flex-col justify-between py-0.5 text-right text-[9px] font-semibold text-slate-400">
                  {[1, 0.75, 0.5, 0.25, 0].map((f) => <span key={f}>{lakhTick(maxLakh * f)}</span>)}
                </div>
                <div className="relative flex-1">
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[0, 1, 2, 3, 4].map((i) => <div key={i} className="border-t border-dashed border-slate-100" />)}
                  </div>
                  <div className="relative flex h-40 items-end gap-1.5">
                    {trend.map((t, i) => {
                      const s = salesL[i];
                      const c = collL[i];
                      const h = (v) => (v > 0 ? `${Math.max(2, (v / maxLakh) * 100)}%` : '0%');
                      return (
                        <div key={t.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                          <div className="flex w-full max-w-[46px] flex-1 items-end justify-center gap-1">
                            <div className="w-1/2 rounded-t-[4px] bg-[#2563eb]" style={{ height: h(s) }} title={`Sales ${inr(t.sales)}`} />
                            <div className="w-1/2 rounded-t-[4px] bg-[#34d399]" style={{ height: h(c) }} title={`Collection ${inr(t.collection)}`} />
                          </div>
                          <span className="text-[8.5px] font-semibold text-slate-400">{dayLabel(t.date)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <p className="mt-1 text-[10px] font-semibold text-slate-400">₹ in Lakhs</p>
            </>
          )}
        </SectionCard>

        <SectionCard icon={Users} title="Customer Receivable Ageing" linkTo="/sales/invoices">
          {ageingTotal === 0 ? (
            <EmptyNote>No outstanding receivables.</EmptyNote>
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
