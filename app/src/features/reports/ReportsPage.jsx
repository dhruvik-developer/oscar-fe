import React, { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/common/PageHeader';
import { exportToCSV } from '../../services/exportUtils';
import {
  Card,
  EmptyRow,
  ErrorState,
  Kpi,
  LoadingState,
  TabBar,
  formatDate,
  formatINR,
  formatNumberIN,
  inputClass,
  labelClass,
  thClass,
  todayISO,
  unwrapList,
  useApiGet,
} from '../accounts/accountingShared';

const reportsGuide = {
  title: 'Financial & Inventory Analytics',
  subtitle: 'Stock valuation, customer revenue, vendor spend, AR/AP ageing and P&L — all computed on the server.',
  purpose:
    'Every figure on this page is returned by a backend report endpoint (/reports/<key>/). Nothing is recalculated in the browser.',
  keyTerms: [
    { term: 'AR/AP Ageing', definition: 'Outstanding receivables / payables grouped by days overdue: 0-30, 31-60, 61-90, 91-120, 120+.' },
    { term: 'Inventory Valuation', definition: 'On-hand quantity × weighted average cost per item and location.' },
    { term: 'Gross Margin %', definition: 'Gross profit as a percentage of revenue, from the journal.' },
  ],
  tips: ['Use the period filter for revenue, spend and P&L; use the as-of date for ageing.'],
};

const TABS = [
  { id: 'inventory', label: 'Inventory Valuation' },
  { id: 'sales', label: 'Customer Revenue' },
  { id: 'purchases', label: 'Vendor Allocation' },
  { id: 'aging', label: 'AR / AP Ageing' },
  { id: 'pnl', label: 'Profit & Loss' },
];

// Display order of the server's ageing bucket keys; amounts always come from the response.
const AGEING_ORDER = ['0-30', '31-60', '61-90', '91-120', '120+'];
const BAR_COLORS = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-500', 'bg-orange-600', 'bg-rose-600', 'bg-purple-600', 'bg-teal-600'];

function orderedBuckets(buckets) {
  if (!buckets || typeof buckets !== 'object') return [];
  const keys = [...AGEING_ORDER.filter((k) => k in buckets), ...Object.keys(buckets).filter((k) => !AGEING_ORDER.includes(k))];
  return keys.map((k) => [k, buckets[k]]);
}

function ShareBar({ pct, color }) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return null;
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.min(100, Math.max(0, n))}%` }} />
    </div>
  );
}

/* ───────── Inventory valuation ───────── */
function InventorySection({ report }) {
  const { data, loading, error, reload } = report;
  const rows = unwrapList(data);
  const agg = data?.aggregates || {};
  const buckets = Object.entries(agg.buckets || {});
  return (
    <div className="space-y-4">
      <ErrorState message={error ? `Inventory valuation could not be loaded — ${error}` : ''} onRetry={reload} />
      {loading ? <LoadingState label="Loading inventory valuation…" /> : data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label={`Total Valuation (${agg.method || 'WAC'})`} value={formatINR(agg.totalValuation)} />
            <Kpi label="Stock Lines" value={String(data.count ?? rows.length)} />
            <Kpi label="Stale Stock (91+ days)" value={formatINR(agg.staleValuation)} tone="text-amber-700" />
            <Kpi label="Depreciation Reserve" value={formatINR(agg.totalDepreciation)} tone="text-rose-700" />
          </div>
          <Card title="Valuation by Stock Age">
            {buckets.length === 0 ? (
              <p className="text-xs text-slate-400">No stock on hand.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {buckets.map(([label, value]) => (
                  <div key={label} className="border border-[#dce5f4] rounded-xl p-3">
                    <span className="text-[11px] font-semibold text-slate-500">{label}</span>
                    <p className="font-mono font-bold text-slate-900 mt-1">{formatINR(value)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Item Valuation">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-[#dce5f4]">
                  <tr>
                    <th className={thClass}>Item</th>
                    <th className={thClass}>Category</th>
                    <th className={thClass}>Location</th>
                    <th className={`${thClass} text-right`}>Qty</th>
                    <th className={`${thClass} text-right`}>Unit Cost</th>
                    <th className={`${thClass} text-right`}>Value</th>
                    <th className={`${thClass} text-right`}>Age (days)</th>
                    <th className={`${thClass} text-right`}>Reserve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 && <EmptyRow colSpan={8} message="No stock on hand to value." />}
                  {rows.map((r, idx) => (
                    <tr key={`${r.itemId}-${r.location}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3"><span className="font-semibold text-slate-800">{r.name}</span> <span className="font-mono text-[10px] text-slate-400">{r.sku}</span></td>
                      <td className="py-1.5 px-3">{r.category}</td>
                      <td className="py-1.5 px-3">{r.location}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{formatNumberIN(r.quantity, 4)}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{formatINR(r.unitCost)}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{formatINR(r.value)}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{r.ageDays}</td>
                      <td className="py-1.5 px-3 text-right font-mono">{formatINR(r.depreciationReserve)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ───────── Customer revenue / vendor allocation ───────── */
function PartySection({ report, kind }) {
  const { data, loading, error, reload } = report;
  const rows = unwrapList(data);
  const agg = data?.aggregates || {};
  const isSales = kind === 'sales';
  return (
    <div className="space-y-4">
      <ErrorState message={error ? `${isSales ? 'Customer revenue' : 'Vendor allocation'} could not be loaded — ${error}` : ''} onRetry={reload} />
      {loading ? <LoadingState label="Loading…" /> : data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Kpi label={isSales ? 'Revenue (taxable value)' : 'Procurement Spend'} value={formatINR(isSales ? agg.totalRevenue : agg.totalSpend)} />
            <Kpi label={isSales ? 'Customers Billed' : 'Vendors Billed'} value={String(data.count ?? rows.length)} />
          </div>
          <Card title={isSales ? 'Revenue by Customer' : 'Spend by Vendor'}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-[#dce5f4]">
                  <tr>
                    <th className={thClass}>{isSales ? 'Customer' : 'Vendor'}</th>
                    <th className={`${thClass} text-right`}>{isSales ? 'Invoices' : 'Bills'}</th>
                    <th className={`${thClass} text-right`}>{isSales ? 'Revenue' : 'Spend'}</th>
                    {isSales && <th className={`${thClass} text-right`}>Invoiced</th>}
                    <th className={`${thClass} text-right`}>{isSales ? 'Received' : 'Paid'}</th>
                    <th className={`${thClass} text-right`}>Outstanding</th>
                    <th className={`${thClass} text-right w-40`}>Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 && <EmptyRow colSpan={isSales ? 7 : 6} message={isSales ? 'No posted sales invoices in this period.' : 'No purchase bills in this period.'} />}
                  {rows.map((r, idx) => (
                    <tr key={(isSales ? r.customerId : r.vendorId) || idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{isSales ? r.customerName : r.vendorName}</td>
                      <td className="py-2 px-3 text-right font-mono">{isSales ? r.invoiceCount : r.billCount}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatINR(isSales ? r.revenue : r.spend)}</td>
                      {isSales && <td className="py-2 px-3 text-right font-mono">{formatINR(r.invoiced)}</td>}
                      <td className="py-2 px-3 text-right font-mono">{formatINR(isSales ? r.received : r.paid)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatINR(r.outstanding)}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="font-mono">{formatNumberIN(r.sharePct, 1)}%</span>
                        <ShareBar pct={r.sharePct} color={BAR_COLORS[idx % BAR_COLORS.length]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ───────── Ageing ───────── */
function AgeingCard({ report, title }) {
  const { data, loading, error, reload } = report;
  const rows = data?.rows || [];
  const buckets = orderedBuckets(data?.buckets);
  return (
    <Card title={title} subtitle={data ? `As of ${formatDate(data.asOf)} · total outstanding ${formatINR(data.total)}` : undefined}>
      <ErrorState message={error ? `${title} could not be loaded — ${error}` : ''} onRetry={reload} />
      {loading ? <LoadingState label="Loading ageing…" /> : data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {buckets.map(([label, value], idx) => (
              <div key={label} className="border border-[#dce5f4] rounded-xl p-3 text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">{label} days</span>
                <p className={`font-mono font-bold mt-1 ${idx >= 3 ? 'text-rose-700' : 'text-slate-900'}`}>{formatINR(value)}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-[#dce5f4]">
                <tr>
                  <th className={thClass}>Document</th>
                  <th className={thClass}>Party</th>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Due</th>
                  <th className={`${thClass} text-right`}>Total</th>
                  <th className={`${thClass} text-right`}>Outstanding</th>
                  <th className={`${thClass} text-right`}>Days Overdue</th>
                  <th className={`${thClass} text-center`}>Bucket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && <EmptyRow colSpan={8} message="Nothing outstanding." />}
                {rows.map((r) => (
                  <tr key={r.documentId} className="hover:bg-slate-50">
                    <td className="py-1.5 px-3 font-mono font-semibold text-slate-800">{r.documentNumber}</td>
                    <td className="py-1.5 px-3">{r.partyName}</td>
                    <td className="py-1.5 px-3 font-mono whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="py-1.5 px-3 font-mono whitespace-nowrap">{formatDate(r.dueDate)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{formatINR(r.total)}</td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{formatINR(r.outstanding)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{r.daysOverdue}</td>
                    <td className="py-1.5 px-3 text-center"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{r.bucket}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ───────── P&L ───────── */
function PnlSection({ report }) {
  const { data: p, loading, error, reload } = report;
  const line = (label, value, strong = false) => (
    <div className={`flex justify-between gap-3 py-2 px-2 border-b border-slate-100 ${strong ? 'bg-slate-50 rounded font-bold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span className={`font-mono ${Number(value) < 0 ? 'text-rose-600' : ''}`}>{formatINR(value)}</span>
    </div>
  );
  return (
    <Card title="Profit & Loss Summary" subtitle="From posted journal lines (income and expense accounts).">
      <ErrorState message={error ? `Profit & Loss could not be loaded — ${error}` : ''} onRetry={reload} />
      {loading ? <LoadingState label="Loading Profit & Loss…" /> : p && (
        <div className="space-y-1 text-xs max-w-xl">
          {line('Revenue', p.revenue)}
          {line('Cost of goods sold', p.cogs)}
          {line(`Gross profit (margin ${formatNumberIN(p.grossMarginPct)}%)`, p.grossProfit, true)}
          {line('Operating expenses', p.operatingExpenses)}
          {line('Net operating profit', p.netOperatingProfit, true)}
        </div>
      )}
    </Card>
  );
}

export const ReportsPage = () => {
  const [activeReport, setActiveReport] = useState('inventory');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [asOf, setAsOf] = useState('');

  const period = { date_from: dateFrom, date_to: dateTo };
  const inventory = useApiGet('/reports/inventory-valuation/', {}, { enabled: activeReport === 'inventory' });
  const customers = useApiGet('/reports/customer-revenue/', period, { enabled: activeReport === 'sales' });
  const vendors = useApiGet('/reports/vendor-allocation/', period, { enabled: activeReport === 'purchases' });
  const ar = useApiGet('/reports/ar-ap-ageing/', { type: 'receivable', asOf }, { enabled: activeReport === 'aging' });
  const ap = useApiGet('/reports/ar-ap-ageing/', { type: 'payable', asOf }, { enabled: activeReport === 'aging' });
  const pnl = useApiGet('/reports/profit-and-loss/', period, { enabled: activeReport === 'pnl' });

  const handleExportReport = () => {
    const stamp = todayISO();
    if (activeReport === 'inventory' && inventory.data) {
      exportToCSV(`Inventory_Valuation_${stamp}`,
        ['SKU', 'Item', 'Category', 'Location', 'Quantity', 'Unit Cost', 'Value', 'Age (days)', 'Ageing Bucket', 'Reserve'],
        unwrapList(inventory.data).map((r) => [r.sku, r.name, r.category, r.location, r.quantity, r.unitCost, r.value, r.ageDays, r.agingBucket, r.depreciationReserve]));
    } else if (activeReport === 'sales' && customers.data) {
      exportToCSV(`Customer_Revenue_${stamp}`,
        ['Customer', 'Invoices', 'Revenue', 'Invoiced', 'Received', 'Outstanding', 'Share %'],
        unwrapList(customers.data).map((r) => [r.customerName, r.invoiceCount, r.revenue, r.invoiced, r.received, r.outstanding, r.sharePct]));
    } else if (activeReport === 'purchases' && vendors.data) {
      exportToCSV(`Vendor_Allocation_${stamp}`,
        ['Vendor', 'Bills', 'Spend', 'Paid', 'Outstanding', 'Share %'],
        unwrapList(vendors.data).map((r) => [r.vendorName, r.billCount, r.spend, r.paid, r.outstanding, r.sharePct]));
    } else if (activeReport === 'aging' && (ar.data || ap.data)) {
      const toRows = (rep, type) => (rep?.rows || []).map((r) => [type, r.documentNumber, r.partyName, r.date, r.dueDate, r.total, r.outstanding, r.daysOverdue, r.bucket]);
      exportToCSV(`AR_AP_Ageing_${stamp}`,
        ['Type', 'Document', 'Party', 'Date', 'Due Date', 'Total', 'Outstanding', 'Days Overdue', 'Bucket'],
        [...toRows(ar.data, 'Receivable'), ...toRows(ap.data, 'Payable')]);
    } else if (activeReport === 'pnl' && pnl.data) {
      const p = pnl.data;
      exportToCSV(`Profit_and_Loss_${stamp}`, ['Line', 'Amount'], [
        ['Revenue', p.revenue], ['Cost of goods sold', p.cogs], ['Gross profit', p.grossProfit],
        ['Gross margin %', p.grossMarginPct], ['Operating expenses', p.operatingExpenses], ['Net operating profit', p.netOperatingProfit],
      ]);
    }
  };

  const usesPeriod = ['sales', 'purchases', 'pnl'].includes(activeReport);

  return (
    <div className="space-y-6 printable-document">
      <PageHeader
        title="Financial & Inventory Reports"
        subtitle="Stock valuation, customer revenue, vendor spend, AR/AP ageing and P&L from the server."
        guide={reportsGuide}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print Report</Button>
            <Button icon={Download} onClick={handleExportReport}>Export Report (CSV)</Button>
          </div>
        }
      />

      <TabBar tabs={TABS} active={activeReport} onChange={setActiveReport} />

      {(usesPeriod || activeReport === 'aging') && (
        <div className="bg-white border border-[#dce5f4] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
          {usesPeriod ? (
            <>
              <div>
                <label className={labelClass}>Period from</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Period to</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
              </div>
            </>
          ) : (
            <div>
              <label className={labelClass}>Ageing as of</label>
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={inputClass} />
            </div>
          )}
        </div>
      )}

      {activeReport === 'inventory' && <InventorySection report={inventory} />}
      {activeReport === 'sales' && <PartySection report={customers} kind="sales" />}
      {activeReport === 'purchases' && <PartySection report={vendors} kind="purchases" />}
      {activeReport === 'aging' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Kpi label="Total Receivable (AR)" value={ar.data ? formatINR(ar.data.total) : '—'} />
            <Kpi label="Total Payable (AP)" value={ap.data ? formatINR(ap.data.total) : '—'} />
          </div>
          <AgeingCard report={ar} title="Accounts Receivable Ageing" />
          <AgeingCard report={ap} title="Accounts Payable Ageing" />
        </div>
      )}
      {activeReport === 'pnl' && <PnlSection report={pnl} />}
    </div>
  );
};

export default ReportsPage;
