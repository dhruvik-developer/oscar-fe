import React, { useState } from 'react';
import {
  Download,
  Printer,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  X,
  FileText,
  DollarSign,
  TrendingDown,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import MasterSourceLink, { useMasterDataRefresh } from '../../components/common/MasterSourceLink';
import { Button } from '../../components/ui/Button';
import { accountingService } from '../../services/domainServices';
import { exportToCSV } from '../../services/exportUtils';
import {
  formatINR,
  formatDate,
  unwrapList,
  describeApiError,
  todayISO,
  inputClass,
  labelClass,
  Card,
  Kpi,
  TabBar,
  ErrorState,
  LoadingState,
  EmptyRow,
  thClass,
  useApiGet,
} from './accountingShared';

const TABS = [
  { id: 'pl', label: 'Profit & Loss' },
  { id: 'bs', label: 'Balance Sheet' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'gst', label: 'GST Summary (GSTR-1 / 3B)' },
  { id: 'ageing', label: 'AR / AP Ageing' },
  { id: 'budget', label: 'Budgets & Variances' },
];

const accountName = (a) => `${a.code ? `${a.code} - ` : ''}${a.name}`;

function Amount({ value, strong = false }) {
  const n = Number(value);
  const tone = !Number.isFinite(n) || n === 0 ? 'text-slate-600' : n > 0 ? 'text-slate-900' : 'text-rose-600';
  return <span className={`font-mono ${strong ? 'font-bold' : ''} ${tone}`}>{formatINR(value)}</span>;
}

function SectionRow({ label, tone }) {
  return (
    <tr>
      <td colSpan={2} className={`py-2 px-3 font-bold text-[11px] uppercase tracking-wider ${tone}`}>{label}</td>
    </tr>
  );
}

function LineRow({ label, value, total = false, indent = false }) {
  return (
    <tr className={total ? 'bg-slate-50 font-bold border-t border-[#dce5f4]' : 'hover:bg-slate-50'}>
      <td className={`py-1.5 px-3 ${indent ? 'pl-8 text-slate-500' : 'text-slate-800'}`}>{label}</td>
      <td className="py-1.5 px-3 text-right"><Amount value={value} strong={total} /></td>
    </tr>
  );
}

export function FinancialReportsPage() {
  const [reportType, setReportType] = useState('pl');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [asOf, setAsOf] = useState('');
  const [ageingType, setAgeingType] = useState('receivable'); // 'receivable' | 'payable'

  // Budgets CRUD state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetModalError, setBudgetModalError] = useState('');
  const [budgetForm, setBudgetForm] = useState({
    accountId: '',
    period_start: todayISO(),
    period_end: todayISO(),
    amount: '',
    notes: '',
  });

  const period = { date_from: dateFrom, date_to: dateTo };
  const pnl = useApiGet('/accounts/reports/profit-and-loss/', period, { enabled: reportType === 'pl' });
  const bs = useApiGet('/accounts/reports/balance-sheet/', { asOf }, { enabled: reportType === 'bs' });
  const cf = useApiGet('/accounts/reports/cash-flow/', period, { enabled: reportType === 'cashflow' });
  const gst = useApiGet('/accounts/reports/gst-summary/', { dateFrom, dateTo }, { enabled: reportType === 'gst' });
  const ageing = useApiGet('/accounts/reports/ageing/', { type: ageingType, asOf }, { enabled: reportType === 'ageing' });
  const budgets = useApiGet('/accounts/budgets/', { page_size: 200, date_from: dateFrom, date_to: dateTo }, { enabled: reportType === 'budget' });
  const chartOfAccounts = useApiGet('/accounts/chart-of-accounts/', { page_size: 200 }, { enabled: showBudgetModal });
  // Reload the budget account list after accounts are edited from the "+ Add / Manage" popup.
  useMasterDataRefresh(chartOfAccounts.reload, ['ledgerAccounts']);

  const p = pnl.data;
  const b = bs.data;
  const c = cf.data;
  const g = gst.data;
  const ag = ageing.data;
  const budgetRows = unwrapList(budgets.data);
  const accountsList = unwrapList(chartOfAccounts.data);

  const handleExport = () => {
    const stamp = todayISO();
    if (reportType === 'pl' && p) {
      exportToCSV(`Profit_and_Loss_${stamp}`, ['Section', 'Account', 'Amount'], [
        ...(p.incomeAccounts || []).map((a) => ['Income', accountName(a), a.amount]),
        ['Total', 'Revenue', p.revenue],
        ['Total', 'Cost of goods sold', p.cogs],
        ['Total', 'Gross profit', p.grossProfit],
        ...(p.expenseAccounts || []).map((a) => ['Expense', accountName(a), a.amount]),
        ['Total', 'Operating expenses', p.operatingExpenses],
        ['Total', 'Net operating profit', p.netOperatingProfit],
      ]);
    } else if (reportType === 'bs' && b) {
      exportToCSV(`Balance_Sheet_${stamp}`, ['Section', 'Account', 'Amount'], [
        ...(b.assets || []).map((a) => ['Assets', accountName(a), a.amount]),
        ['Assets', 'Total assets', b.totalAssets],
        ...(b.liabilities || []).map((a) => ['Liabilities', accountName(a), a.amount]),
        ['Liabilities', 'Total liabilities', b.totalLiabilities],
        ...(b.equity || []).map((a) => ['Equity', accountName(a), a.amount]),
        ['Equity', 'Retained earnings', b.retainedEarnings],
        ['Equity', 'Total equity', b.totalEquity],
      ]);
    } else if (reportType === 'cashflow' && c) {
      exportToCSV(`Cash_Flow_${stamp}`, ['Period', 'Inflow', 'Outflow', 'Net'], (c.periods || []).map((r) => [r.period, r.inflow, r.outflow, r.net]));
    } else if (reportType === 'gst' && g) {
      exportToCSV(`GST_Summary_${stamp}`, ['HSN Code', 'Taxable Value', 'Tax', 'Count'], (g.byHsn || []).map((r) => [r.hsnCode, r.taxableValue, r.tax, r.lineCount]));
    } else if (reportType === 'ageing' && ag) {
      exportToCSV(`Ageing_${ageingType}_${stamp}`, ['Document #', 'Party', 'Date', 'Due Date', 'Total', 'Outstanding', 'Days Overdue', 'Bucket'], (ag.rows || []).map((r) => [r.documentNumber, r.partyName, r.date, r.dueDate, r.total, r.outstanding, r.daysOverdue, r.bucket]));
    } else if (reportType === 'budget') {
      exportToCSV(`Budget_vs_Actual_${stamp}`, ['Account', 'Period start', 'Period end', 'Budget', 'Actual', 'Variance'], budgetRows.map((r) => [r.accountName, r.periodStart, r.periodEnd, r.amount, r.actual, r.variance]));
    }
  };

  const handleOpenAddBudget = () => {
    setEditingBudget(null);
    setBudgetForm({
      accountId: accountsList[0]?.id || '',
      period_start: todayISO(),
      period_end: todayISO(),
      amount: '',
      notes: '',
    });
    setBudgetModalError('');
    setShowBudgetModal(true);
  };

  const handleOpenEditBudget = (item) => {
    setEditingBudget(item);
    setBudgetForm({
      accountId: item.accountId || item.account?.id || '',
      period_start: item.period_start || item.periodStart || '',
      period_end: item.period_end || item.periodEnd || '',
      amount: String(item.amount || ''),
      notes: item.notes || '',
    });
    setBudgetModalError('');
    setShowBudgetModal(true);
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!budgetForm.accountId) {
      setBudgetModalError('Please select an account.');
      return;
    }
    if (!budgetForm.amount || parseFloat(budgetForm.amount) <= 0) {
      setBudgetModalError('Budget amount must be greater than 0.');
      return;
    }

    setSavingBudget(true);
    setBudgetModalError('');
    try {
      const payload = {
        accountId: budgetForm.accountId,
        period_start: budgetForm.period_start,
        period_end: budgetForm.period_end,
        amount: parseFloat(budgetForm.amount),
        notes: budgetForm.notes || undefined,
      };

      if (editingBudget) {
        await accountingService.updateBudget(editingBudget.id, payload);
      } else {
        await accountingService.createBudget(payload);
      }
      setShowBudgetModal(false);
      budgets.reload();
    } catch (err) {
      setBudgetModalError(describeApiError(err));
    } finally {
      setSavingBudget(false);
    }
  };

  const handleDeleteBudget = async (id) => {
    if (!window.confirm('Are you sure you want to delete this budget?')) return;
    try {
      await accountingService.deleteBudget(id);
      budgets.reload();
    } catch (err) {
      alert(describeApiError(err));
    }
  };

  const activeReady =
    (reportType === 'pl' && p) ||
    (reportType === 'bs' && b) ||
    (reportType === 'cashflow' && c) ||
    (reportType === 'gst' && g) ||
    (reportType === 'ageing' && ag) ||
    (reportType === 'budget' && budgets.data);

  return (
    <div className="space-y-6 printable-document">
      <PageHeader
        title="Financial Reports"
        subtitle="Profit & Loss, Balance Sheet, Cash Flow, GST Summaries, AR/AP Ageing, and Budgets Management."
        breadcrumb={[{ label: 'Accounts', to: '/accounts/cash-bank' }, { label: 'Reports' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>
            <Button icon={Download} onClick={handleExport} disabled={!activeReady}>Export CSV</Button>
          </div>
        }
      />

      <div className="bg-white border border-[#dce5f4] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
        <div>
          <label className={labelClass}>Period from (P&amp;L, Cash Flow, GST, Budgets)</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Period to</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>As of Date (Balance Sheet, Ageing)</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="Revenue" value={p ? formatINR(p.revenue) : '—'} />
        <Kpi label="Cost of Goods" value={p ? formatINR(p.cogs) : '—'} />
        <Kpi label="Operating Expenses" value={p ? formatINR(p.operatingExpenses) : '—'} />
        <Kpi
          label="Net Operating Profit"
          value={p ? formatINR(p.netOperatingProfit) : '—'}
          tone={p && Number(p.netOperatingProfit) < 0 ? 'text-rose-700' : 'text-emerald-700'}
          note={p ? `Gross margin ${Number(p.grossMarginPct).toLocaleString('en-IN')}%` : undefined}
        />
        <Kpi label="Total Assets" value={b ? formatINR(b.totalAssets) : '—'} note={b ? `As of ${formatDate(b.asOf)}` : undefined} />
        <Kpi label="Total Equity" value={b ? formatINR(b.totalEquity) : '—'} note={b ? `Liabilities ${formatINR(b.totalLiabilities)}` : undefined} />
      </div>

      <Card actions={<TabBar tabs={TABS} active={reportType} onChange={setReportType} />}>
        {/* PROFIT & LOSS */}
        {reportType === 'pl' && (
          <div className="space-y-3">
            <ErrorState message={pnl.error ? `Profit & Loss could not be loaded — ${pnl.error}` : ''} onRetry={pnl.reload} />
            {pnl.loading ? <LoadingState label="Loading Profit & Loss…" /> : p && (
              <div className="overflow-x-auto">
                <p className="text-[11px] text-slate-500 mb-2">
                  Period: {p.periodFrom ? formatDate(p.periodFrom) : 'beginning'} to {p.periodTo ? formatDate(p.periodTo) : 'today'}
                </p>
                <table className="w-full min-w-[480px] text-left text-xs">
                  <tbody>
                    <SectionRow label="Income" tone="bg-blue-50 text-blue-800" />
                    {(p.incomeAccounts || []).length === 0 && <EmptyRow colSpan={2} message="No income postings in this period." />}
                    {(p.incomeAccounts || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                    <LineRow label="Revenue" value={p.revenue} total />
                    <LineRow label="Cost of goods sold" value={p.cogs} />
                    <LineRow label="Gross profit" value={p.grossProfit} total />
                    <SectionRow label="Expenses" tone="bg-rose-50 text-rose-800" />
                    {(p.expenseAccounts || []).length === 0 && <EmptyRow colSpan={2} message="No expense postings in this period." />}
                    {(p.expenseAccounts || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                    <LineRow label="Operating expenses" value={p.operatingExpenses} total />
                    <LineRow label="Net operating profit" value={p.netOperatingProfit} total />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BALANCE SHEET */}
        {reportType === 'bs' && (
          <div className="space-y-3">
            <ErrorState message={bs.error ? `Balance sheet could not be loaded — ${bs.error}` : ''} onRetry={bs.reload} />
            {bs.loading ? <LoadingState label="Loading balance sheet…" /> : b && (
              <>
                <p className="text-[11px] text-slate-500">As of {formatDate(b.asOf)}</p>
                {Number(b.difference) !== 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Assets do not equal liabilities + equity — difference reported by the server: {formatINR(b.difference)}.
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <tbody>
                      <SectionRow label="Assets" tone="bg-blue-50 text-blue-800" />
                      {(b.assets || []).length === 0 && <EmptyRow colSpan={2} message="No asset balances." />}
                      {(b.assets || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                      <LineRow label="Total assets" value={b.totalAssets} total />
                      <SectionRow label="Liabilities" tone="bg-rose-50 text-rose-800" />
                      {(b.liabilities || []).length === 0 && <EmptyRow colSpan={2} message="No liability balances." />}
                      {(b.liabilities || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                      <LineRow label="Total liabilities" value={b.totalLiabilities} total />
                      <SectionRow label="Equity" tone="bg-emerald-50 text-emerald-800" />
                      {(b.equity || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                      <LineRow label="Retained earnings (net operating profit to date)" value={b.retainedEarnings} indent />
                      <LineRow label="Total equity" value={b.totalEquity} total />
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* CASH FLOW */}
        {reportType === 'cashflow' && (
          <div className="space-y-3">
            <ErrorState message={cf.error ? `Cash flow could not be loaded — ${cf.error}` : ''} onRetry={cf.reload} />
            {cf.loading ? <LoadingState label="Loading cash flow…" /> : c && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-[#dce5f4]">
                    <tr>
                      <th className={thClass}>Month</th>
                      <th className={`${thClass} text-right`}>Inflow</th>
                      <th className={`${thClass} text-right`}>Outflow</th>
                      <th className={`${thClass} text-right`}>Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(c.periods || []).length === 0 && <EmptyRow colSpan={4} message="No bank or cash movement in this period." />}
                    {(c.periods || []).map((r) => (
                      <tr key={r.period} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{String(r.period).slice(0, 7)}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatINR(r.inflow)}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-700">{formatINR(r.outflow)}</td>
                        <td className="py-2 px-3 text-right"><Amount value={r.net} strong /></td>
                      </tr>
                    ))}
                  </tbody>
                  {(c.periods || []).length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t-2 border-[#dce5f4]">
                        <td className="py-2 px-3 text-slate-900">Total</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-800">{formatINR(c.totalInflow)}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-800">{formatINR(c.totalOutflow)}</td>
                        <td className="py-2 px-3 text-right"><Amount value={c.netCashFlow} strong /></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {/* GST SUMMARY (GSTR-1 / 3B) */}
        {reportType === 'gst' && (
          <div className="space-y-4">
            <ErrorState message={gst.error ? `GST Summary could not be loaded — ${gst.error}` : ''} onRetry={gst.reload} />
            {gst.loading ? <LoadingState label="Loading GST Summary…" /> : g && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block">Outward Tax (Sales GST)</span>
                    <span className="font-mono font-bold text-base text-slate-900 block mt-0.5">
                      {formatINR(g.outward?.totalTax || 0)}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Taxable: {formatINR(g.outward?.taxable || 0)} ({g.outward?.count || 0} invoices)
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-purple-700 block">Inward Tax (Input Credit - ITC)</span>
                    <span className="font-mono font-bold text-base text-slate-900 block mt-0.5">
                      {formatINR(g.inward?.totalTax || 0)}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Taxable: {formatINR(g.inward?.taxable || 0)} ({g.inward?.count || 0} bills)
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Net GST Payable / (Credit)</span>
                    <span className={`font-mono font-bold text-base block mt-0.5 ${Number(g.netPayable) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {formatINR(g.netPayable || 0)}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {Number(g.netPayable) > 0 ? 'Payable to Government' : 'ITC Carry Forward'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Outward Breakdown */}
                  <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3">
                    <h4 className="font-bold text-slate-800 text-xs uppercase mb-2">Outward Supplies (GSTR-1)</h4>
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="border-b border-slate-200 py-1">
                          <td className="py-1 text-slate-600">Taxable Value:</td>
                          <td className="py-1 text-right font-mono font-semibold">{formatINR(g.outward?.taxable)}</td>
                        </tr>
                        <tr className="border-b border-slate-200 py-1">
                          <td className="py-1 text-slate-600">CGST:</td>
                          <td className="py-1 text-right font-mono">{formatINR(g.outward?.cgst)}</td>
                        </tr>
                        <tr className="border-b border-slate-200 py-1">
                          <td className="py-1 text-slate-600">SGST:</td>
                          <td className="py-1 text-right font-mono">{formatINR(g.outward?.sgst)}</td>
                        </tr>
                        <tr className="border-b border-slate-200 py-1">
                          <td className="py-1 text-slate-600">IGST:</td>
                          <td className="py-1 text-right font-mono">{formatINR(g.outward?.igst)}</td>
                        </tr>
                        <tr className="py-1 font-bold">
                          <td className="py-1 text-slate-800">Total Output Tax:</td>
                          <td className="py-1 text-right font-mono text-blue-600">{formatINR(g.outward?.totalTax)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Inward Breakdown */}
                  <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3">
                    <h4 className="font-bold text-slate-800 text-xs uppercase mb-2">Inward Supplies / ITC (GSTR-3B)</h4>
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="border-b border-slate-200 py-1">
                          <td className="py-1 text-slate-600">Taxable Purchases:</td>
                          <td className="py-1 text-right font-mono font-semibold">{formatINR(g.inward?.taxable)}</td>
                        </tr>
                        <tr className="border-b border-slate-200 py-1">
                          <td className="py-1 text-slate-600">Input CGST:</td>
                          <td className="py-1 text-right font-mono">{formatINR(g.inward?.cgst)}</td>
                        </tr>
                        <tr className="border-b border-slate-200 py-1">
                          <td className="py-1 text-slate-600">Input SGST:</td>
                          <td className="py-1 text-right font-mono">{formatINR(g.inward?.sgst)}</td>
                        </tr>
                        <tr className="border-b border-slate-200 py-1">
                          <td className="py-1 text-slate-600">Input IGST:</td>
                          <td className="py-1 text-right font-mono">{formatINR(g.inward?.igst)}</td>
                        </tr>
                        <tr className="py-1 font-bold">
                          <td className="py-1 text-slate-800">Total Input Credit:</td>
                          <td className="py-1 text-right font-mono text-purple-600">{formatINR(g.inward?.totalTax)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* HSN Summary */}
                {g.byHsn && g.byHsn.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase">
                      HSN / SAC Outward Tax Summary
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-[10px]">
                        <tr>
                          <th className="py-2 px-3">HSN Code</th>
                          <th className="py-2 px-3 text-right">Taxable Value</th>
                          <th className="py-2 px-3 text-right">Tax Amount</th>
                          <th className="py-2 px-3 text-center">Items Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {g.byHsn.map((h) => (
                          <tr key={h.hsnCode} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">{h.hsnCode}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">{formatINR(h.taxableValue)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatINR(h.tax)}</td>
                            <td className="py-2 px-3 text-center font-mono text-slate-500">{h.lineCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AR / AP AGEING */}
        {reportType === 'ageing' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAgeingType('receivable')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition ${
                    ageingType === 'receivable'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Accounts Receivable (Customer Overdue)
                </button>
                <button
                  type="button"
                  onClick={() => setAgeingType('payable')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition ${
                    ageingType === 'payable'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Accounts Payable (Vendor Overdue)
                </button>
              </div>

              <span className="text-xs text-slate-500">
                As of: <strong>{ag?.asOf ? formatDate(ag.asOf) : 'Today'}</strong>
              </span>
            </div>

            <ErrorState message={ageing.error ? `Ageing could not be loaded — ${ageing.error}` : ''} onRetry={ageing.reload} />

            {ageing.loading ? <LoadingState label="Loading Ageing Report…" /> : ag && (
              <div className="space-y-4">
                {/* Bucket Breakdown Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div className="p-3 bg-slate-100 rounded-xl col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Outstanding</span>
                    <span className="font-mono font-bold text-base text-slate-900 block mt-0.5">
                      {formatINR(ag.total)}
                    </span>
                  </div>
                  {Object.entries(ag.buckets || {}).map(([bkt, amt]) => (
                    <div key={bkt} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">{bkt} Days</span>
                      <span className="font-mono font-bold text-xs text-slate-900 block mt-0.5">
                        {formatINR(amt)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Aging Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10.5px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Document #</th>
                        <th className="py-2.5 px-3">Party Name</th>
                        <th className="py-2.5 px-3">Doc Date</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Outstanding</th>
                        <th className="py-2.5 px-3 text-center">Overdue</th>
                        <th className="py-2.5 px-3 text-center">Bucket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(ag.rows || []).length === 0 ? (
                        <EmptyRow colSpan={8} message={`No ${ageingType} documents outstanding.`} />
                      ) : (
                        ag.rows.map((r) => (
                          <tr key={r.documentId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{r.documentNumber}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{r.partyName}</td>
                            <td className="py-2.5 px-3 text-slate-600">{formatDate(r.date)}</td>
                            <td className="py-2.5 px-3 text-slate-600">{formatDate(r.dueDate)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatINR(r.total)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatINR(r.outstanding)}</td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span className={r.daysOverdue > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                                {r.daysOverdue > 0 ? `${r.daysOverdue}d overdue` : 'Current'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {r.bucket}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BUDGETS & VARIANCES (CRUD) */}
        {reportType === 'budget' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-xs text-slate-700 uppercase">
                Annual & Monthly Budgets Management
              </span>
              <Button
                icon={Plus}
                onClick={handleOpenAddBudget}
                className="!py-1 !px-3 !text-xs !bg-blue-600 hover:!bg-blue-700"
              >
                Set Budget
              </Button>
            </div>

            <ErrorState message={budgets.error ? `Budgets could not be loaded — ${budgets.error}` : ''} onRetry={budgets.reload} />

            {budgets.loading ? <LoadingState label="Loading budgets…" /> : budgets.data && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-[#dce5f4]">
                    <tr>
                      <th className={thClass}>Account</th>
                      <th className={thClass}>Period</th>
                      <th className={`${thClass} text-right`}>Budget</th>
                      <th className={`${thClass} text-right`}>Actual</th>
                      <th className={`${thClass} text-right`}>Variance</th>
                      <th className={`${thClass} text-center`}>Status</th>
                      <th className={`${thClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {budgetRows.length === 0 && <EmptyRow colSpan={7} message="No budgets defined in this period. Click 'Set Budget' to create one." />}
                    {budgetRows.map((r) => {
                      const over = r.variance !== null && r.variance !== undefined && Number(r.variance) < 0;
                      return (
                        <tr key={r.id} className={`hover:bg-slate-50 ${over ? 'bg-rose-50/50' : ''}`}>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{r.accountName}</td>
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">{formatDate(r.period_start || r.periodStart)} – {formatDate(r.period_end || r.periodEnd)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatINR(r.amount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatINR(r.actual)}</td>
                          <td className="py-2.5 px-3 text-right"><Amount value={r.variance} strong /></td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${over ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                              {over ? 'Over budget' : 'Within budget'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditBudget(r)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                title="Edit Budget"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBudget(r.id)}
                                className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded"
                                title="Delete Budget"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          </div>
        )}
      </Card>

      {/* ADD / EDIT BUDGET MODAL */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">
                {editingBudget ? 'Edit Account Budget' : 'Set Account Budget'}
              </h3>
              <button
                type="button"
                onClick={() => setShowBudgetModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {budgetModalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{budgetModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveBudget} className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Account (Chart of Accounts) *</label>
                  <MasterSourceLink source="ledgerAccounts" />
                </div>
                <select
                  required
                  value={budgetForm.accountId}
                  onChange={(e) => setBudgetForm({ ...budgetForm, accountId: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                >
                  <option value="">Select Account...</option>
                  {accountsList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code ? `${a.code} - ` : ''}{a.name} ({a.account_type || a.accountType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period Start *</label>
                  <input
                    type="date"
                    required
                    value={budgetForm.period_start}
                    onChange={(e) => setBudgetForm({ ...budgetForm, period_start: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period End *</label>
                  <input
                    type="date"
                    required
                    value={budgetForm.period_end}
                    onChange={(e) => setBudgetForm({ ...budgetForm, period_end: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Budget Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={budgetForm.amount}
                  onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={budgetForm.notes}
                  onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                  placeholder="Fiscal year, department, or project justification..."
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBudget}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingBudget ? 'Saving…' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FinancialReportsPage;
