import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  FileCode,
  DollarSign,
  TrendingUp,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Truck,
  Landmark,
  Layers,
  AlertCircle,
  RefreshCw,
  Search,
  Users,
  ShieldCheck,
  ChevronRight,
  CreditCard,
  Building2,
  PackageCheck,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import PageInfoButton from '../../components/ui/PageInfoButton';
import { Button } from '../../components/ui/Button';
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
  describeApiError,
} from './accountingShared';
import { accountingService } from '../../services/domainServices';
import { useTableSort } from '../../hooks/useTableSort';
import SortableTh from '../../components/ui/SortableTh';

const TABS = [
  { id: 'sales', label: 'Sales Invoices' },
  { id: 'collections', label: 'Collections' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'disbursements', label: 'Disbursements' },
  { id: 'logistics', label: 'Logistics / Trips' },
  { id: 'overdue', label: 'Salesperson & Broker Overdue' },
  { id: 'subledgers', label: 'Sub-Ledger Balances' },
];

export default function DayBookPage() {
  const [asOfDate, setAsOfDate] = useState(todayISO());
  const [activeTab, setActiveTab] = useState('sales');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dayBookData, setDayBookData] = useState(null);
  const [overdueData, setOverdueData] = useState(null);
  const [brokerSubLedger, setBrokerSubLedger] = useState(null);
  const [incentiveSubLedger, setIncentiveSubLedger] = useState(null);
  const [search, setSearch] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dbRes, odRes, brLedger, incLedger] = await Promise.all([
        accountingService.getDayBook({ as_of: asOfDate }),
        accountingService.getOverdueSummary({ as_of: asOfDate }),
        accountingService.getSubLedgers({ ledger_type: 'brokerage' }),
        accountingService.getSubLedgers({ ledger_type: 'incentive' }),
      ]);
      setDayBookData(dbRes);
      setOverdueData(odRes);
      setBrokerSubLedger(brLedger);
      setIncentiveSubLedger(incLedger);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = dayBookData?.summary || {};

  // Search-filtered rows per tab, sorted by the clicked column.
  const matches = (value) => value?.toLowerCase().includes(search.toLowerCase());
  const salesSort = useTableSort(
    (dayBookData?.salesVouchers || []).filter((s) => !search || matches(s.voucherNumber) || matches(s.partyName)),
  );
  const collectionSort = useTableSort(
    (dayBookData?.collectionVouchers || []).filter((c) => !search || matches(c.voucherNumber) || matches(c.partyName)),
    { accessors: { mode: (row) => row.mode || 'Cash/Bank', bank: (row) => row.bank || 'Main Cash / Bank' } },
  );
  const purchaseSort = useTableSort(
    (dayBookData?.purchaseVouchers || []).filter((p) => !search || matches(p.voucherNumber) || matches(p.partyName)),
  );
  const disbursementSort = useTableSort(
    (dayBookData?.disbursementVouchers || []).filter((d) => !search || matches(d.voucherNumber) || matches(d.partyName)),
    { accessors: { mode: (row) => row.mode || 'Direct', bank: (row) => row.bank || 'Main Bank' } },
  );
  const tripSort = useTableSort(
    (dayBookData?.tripVouchers || []).filter((t) => !search || matches(t.voucherNumber) || matches(t.vehicleNumber)),
  );
  const salespersonOverdueSort = useTableSort(overdueData?.bySalesperson || []);
  const brokerOverdueSort = useTableSort(overdueData?.byBroker || []);
  const brokerLedgerSort = useTableSort(brokerSubLedger?.rows || []);
  const incentiveLedgerSort = useTableSort(incentiveSubLedger?.rows || [], {
    accessors: {
      calculated: (row) => row.accrued || row.calculated,
      posted: (row) => row.payable || row.posted,
    },
  });

  const handleDownload = async (download) => {
    setShowExportMenu(false);
    setError('');
    try {
      await download();
    } catch (err) {
      setError(describeApiError(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Landmark size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Day Book & Business Position</h1>
                <PageInfoButton title="Day Book & Business Position" />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time daily transaction position, ledger liquidity, receivables, payables and Tally exports.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* As-Of Date Selector */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <Calendar size={15} className="text-slate-500 ml-1.5" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none border-none pr-2 cursor-pointer"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            icon={RefreshCw}
            disabled={loading}
          >
            Refresh
          </Button>

          {/* Export dropdown */}
          <div className="relative">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowExportMenu((v) => !v)}
              icon={Download}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Export Registers
            </Button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-xs">
                <div className="px-3 py-1.5 font-bold text-[10px] text-slate-400 uppercase tracking-wider">
                  Tally ERP / Prime (XML)
                </div>
                <button
                  onClick={() => handleDownload(() => accountingService.downloadTallyExport('vouchers', asOfDate, asOfDate))}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-slate-700 hover:text-blue-600"
                >
                  <FileCode size={14} className="text-blue-500" />
                  <span>Day's Vouchers XML (Tally)</span>
                </button>
                <button
                  onClick={() => handleDownload(() => accountingService.downloadTallyExport('masters'))}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-slate-700 hover:text-blue-600"
                >
                  <FileCode size={14} className="text-indigo-500" />
                  <span>All Ledger Masters XML (Tally)</span>
                </button>

                <div className="border-t border-slate-100 my-1"></div>
                <div className="px-3 py-1.5 font-bold text-[10px] text-slate-400 uppercase tracking-wider">
                  Excel / CSV Registers
                </div>
                <button
                  onClick={() => handleDownload(() => accountingService.downloadExcelExport('sales', asOfDate, asOfDate))}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <FileSpreadsheet size={14} className="text-emerald-500" />
                  <span>Sales Register CSV</span>
                </button>
                <button
                  onClick={() => handleDownload(() => accountingService.downloadExcelExport('purchase', asOfDate, asOfDate))}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <FileSpreadsheet size={14} className="text-amber-500" />
                  <span>Purchase Register CSV</span>
                </button>
                <button
                  onClick={() => handleDownload(() => accountingService.downloadExcelExport('standalone_notes', asOfDate, asOfDate))}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <FileSpreadsheet size={14} className="text-purple-500" />
                  <span>Debit/Credit Notes CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* KPI Business Position Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiCard
          label="Sales (Today)"
          value={formatINR(summary.salesTotal)}
          sub={`Billed invoices on ${formatDate(asOfDate)}`}
          icon={ArrowUpRight}
          tone="emerald"
        />
        <KpiCard
          label="Collections (In)"
          value={formatINR(summary.collectionTotal)}
          sub="Customer payments received"
          icon={ArrowDownLeft}
          tone="teal"
        />
        <KpiCard
          label="Purchases"
          value={formatINR(summary.purchaseTotal)}
          sub="Vendor bills received"
          icon={Receipt}
          tone="amber"
        />
        <KpiCard
          label="Disbursements (Out)"
          value={formatINR(summary.disbursementTotal)}
          sub="Supplier & expense payouts"
          icon={ArrowUpRight}
          tone="rose"
        />
        <KpiCard
          label="Freight & Trips"
          value={formatINR(summary.freightTotal)}
          sub="Tempo freight charges"
          icon={Truck}
          tone="blue"
        />
        <KpiCard
          label="Cash & Bank Bal"
          value={formatINR(summary.cashBankBalance)}
          sub="Net liquid asset balance"
          icon={Landmark}
          tone="indigo"
        />
        <KpiCard
          label="Total Receivables"
          value={formatINR(summary.totalReceivable)}
          sub="Total customer book debt"
          icon={CreditCard}
          tone="cyan"
        />
        <KpiCard
          label="Total Payables"
          value={formatINR(summary.totalPayable)}
          sub="Total vendor creditor balance"
          icon={Building2}
          tone="orange"
        />
        <KpiCard
          label="Stock Valuation"
          value={formatINR(summary.stockValue)}
          sub="On-hand inventory landed value"
          icon={PackageCheck}
          tone="purple"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Tabs & Controls */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 border-b border-slate-100 pb-4">
          <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter voucher or party..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState label="Calculating ledger positions..." />
        ) : (
          <div>
            {/* 1. SALES INVOICES TAB */}
            {activeTab === 'sales' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <SortableTh sort={salesSort} sortKey="voucherNumber" className={thClass}>Invoice #</SortableTh>
                      <SortableTh sort={salesSort} sortKey="partyName" className={thClass}>Customer</SortableTh>
                      <SortableTh sort={salesSort} sortKey="taxable" className={`${thClass} text-right`} align="right">Taxable Value</SortableTh>
                      <SortableTh sort={salesSort} sortKey="tax" className={`${thClass} text-right`} align="right">GST Tax</SortableTh>
                      <SortableTh sort={salesSort} sortKey="amount" className={`${thClass} text-right`} align="right">Total Amount</SortableTh>
                      <SortableTh sort={salesSort} sortKey="status" className={`${thClass} text-center`} align="center">Status</SortableTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesSort.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-semibold text-blue-600">{row.voucherNumber}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{row.partyName || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatINR(row.taxable)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatINR(row.tax)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatINR(row.amount)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    {(!dayBookData?.salesVouchers || dayBookData.salesVouchers.length === 0) && (
                      <EmptyRow colSpan={6} message={`No sales invoices recorded on ${formatDate(asOfDate)}.`} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. COLLECTIONS TAB */}
            {activeTab === 'collections' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <SortableTh sort={collectionSort} sortKey="voucherNumber" className={thClass}>Receipt #</SortableTh>
                      <SortableTh sort={collectionSort} sortKey="partyName" className={thClass}>Customer</SortableTh>
                      <SortableTh sort={collectionSort} sortKey="mode" className={thClass}>Mode</SortableTh>
                      <SortableTh sort={collectionSort} sortKey="bank" className={thClass}>Deposited Bank</SortableTh>
                      <SortableTh sort={collectionSort} sortKey="amount" className={`${thClass} text-right`} align="right">Amount Collected</SortableTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {collectionSort.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-semibold text-emerald-600">{row.voucherNumber}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{row.partyName || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{row.mode || 'Cash/Bank'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{row.bank || 'Main Cash / Bank'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatINR(row.amount)}</td>
                        </tr>
                      ))}
                    {(!dayBookData?.collectionVouchers || dayBookData.collectionVouchers.length === 0) && (
                      <EmptyRow colSpan={5} message={`No payment collections recorded on ${formatDate(asOfDate)}.`} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. PURCHASES TAB */}
            {activeTab === 'purchases' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <SortableTh sort={purchaseSort} sortKey="voucherNumber" className={thClass}>Bill #</SortableTh>
                      <SortableTh sort={purchaseSort} sortKey="partyName" className={thClass}>Vendor</SortableTh>
                      <SortableTh sort={purchaseSort} sortKey="taxable" className={`${thClass} text-right`} align="right">Taxable Value</SortableTh>
                      <SortableTh sort={purchaseSort} sortKey="amount" className={`${thClass} text-right`} align="right">Total Bill Amount</SortableTh>
                      <SortableTh sort={purchaseSort} sortKey="status" className={`${thClass} text-center`} align="center">Status</SortableTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseSort.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-semibold text-amber-700">{row.voucherNumber}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{row.partyName || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatINR(row.taxable)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">{formatINR(row.amount)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    {(!dayBookData?.purchaseVouchers || dayBookData.purchaseVouchers.length === 0) && (
                      <EmptyRow colSpan={5} message={`No purchase bills booked on ${formatDate(asOfDate)}.`} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. DISBURSEMENTS TAB */}
            {activeTab === 'disbursements' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <SortableTh sort={disbursementSort} sortKey="voucherNumber" className={thClass}>Payment #</SortableTh>
                      <SortableTh sort={disbursementSort} sortKey="partyName" className={thClass}>Vendor / Beneficiary</SortableTh>
                      <SortableTh sort={disbursementSort} sortKey="mode" className={thClass}>Mode</SortableTh>
                      <SortableTh sort={disbursementSort} sortKey="bank" className={thClass}>Bank Account</SortableTh>
                      <SortableTh sort={disbursementSort} sortKey="amount" className={`${thClass} text-right`} align="right">Amount Paid</SortableTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {disbursementSort.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-semibold text-rose-600">{row.voucherNumber}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{row.partyName || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{row.mode || 'Direct'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{row.bank || 'Main Bank'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatINR(row.amount)}</td>
                        </tr>
                      ))}
                    {(!dayBookData?.disbursementVouchers || dayBookData.disbursementVouchers.length === 0) && (
                      <EmptyRow colSpan={5} message={`No disbursements recorded on ${formatDate(asOfDate)}.`} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. LOGISTICS TAB */}
            {activeTab === 'logistics' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <SortableTh sort={tripSort} sortKey="voucherNumber" className={thClass}>Trip #</SortableTh>
                      <SortableTh sort={tripSort} sortKey="vehicleNumber" className={thClass}>Vehicle Number</SortableTh>
                      <SortableTh sort={tripSort} sortKey="paidBy" className={thClass}>Freight Paid By</SortableTh>
                      <SortableTh sort={tripSort} sortKey="amount" className={`${thClass} text-right`} align="right">Total Charges</SortableTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tripSort.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-semibold text-blue-700">{row.voucherNumber}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-800">{row.vehicleNumber || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{row.paidBy}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatINR(row.amount)}</td>
                        </tr>
                      ))}
                    {(!dayBookData?.tripVouchers || dayBookData.tripVouchers.length === 0) && (
                      <EmptyRow colSpan={4} message={`No logistics or tempo trips dispatched on ${formatDate(asOfDate)}.`} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6. OVERDUE SUMMARY TAB */}
            {activeTab === 'overdue' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                  <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold">
                    <AlertCircle size={16} className="text-rose-600" />
                    <span>Total Overdue Receivables across all Salespersons & Brokers:</span>
                  </div>
                  <span className="text-base font-mono font-bold text-rose-700">
                    {formatINR(overdueData?.totalOverdue || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Salesperson Overdue */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                      <span>Salesperson-Wise Overdue</span>
                      <span className="text-[10px] text-slate-500">Sorted by highest overdue</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <SortableTh sort={salespersonOverdueSort} sortKey="name" className={thClass}>Salesperson</SortableTh>
                            <SortableTh sort={salespersonOverdueSort} sortKey="invoiceCount" className={`${thClass} text-center`} align="center">Invoices</SortableTh>
                            <SortableTh sort={salespersonOverdueSort} sortKey="maxDaysOverdue" className={`${thClass} text-center`} align="center">Max Overdue</SortableTh>
                            <SortableTh sort={salespersonOverdueSort} sortKey="totalOverdue" className={`${thClass} text-right`} align="right">Overdue Amount</SortableTh>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {salespersonOverdueSort.rows.map((sp) => (
                            <tr key={sp.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{sp.name}</td>
                              <td className="py-2.5 px-3 text-center text-slate-600">{sp.invoiceCount}</td>
                              <td className="py-2.5 px-3 text-center text-rose-600 font-semibold">{sp.maxDaysOverdue} days</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatINR(sp.totalOverdue)}</td>
                            </tr>
                          ))}
                          {(!overdueData?.bySalesperson || overdueData.bySalesperson.length === 0) && (
                            <EmptyRow colSpan={4} message="No overdue invoices by salesperson." />
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Broker Overdue */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                      <span>Broker-Wise Overdue</span>
                      <span className="text-[10px] text-slate-500">Sorted by highest overdue</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <SortableTh sort={brokerOverdueSort} sortKey="name" className={thClass}>Broker</SortableTh>
                            <SortableTh sort={brokerOverdueSort} sortKey="invoiceCount" className={`${thClass} text-center`} align="center">Invoices</SortableTh>
                            <SortableTh sort={brokerOverdueSort} sortKey="maxDaysOverdue" className={`${thClass} text-center`} align="center">Max Overdue</SortableTh>
                            <SortableTh sort={brokerOverdueSort} sortKey="totalOverdue" className={`${thClass} text-right`} align="right">Overdue Amount</SortableTh>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {brokerOverdueSort.rows.map((br) => (
                            <tr key={br.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{br.name}</td>
                              <td className="py-2.5 px-3 text-center text-slate-600">{br.invoiceCount}</td>
                              <td className="py-2.5 px-3 text-center text-rose-600 font-semibold">{br.maxDaysOverdue} days</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{formatINR(br.totalOverdue)}</td>
                            </tr>
                          ))}
                          {(!overdueData?.byBroker || overdueData.byBroker.length === 0) && (
                            <EmptyRow colSpan={4} message="No overdue invoices by broker." />
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. SUB-LEDGER BALANCES TAB */}
            {activeTab === 'subledgers' && (
              <div className="space-y-6">
                {/* Brokerage Payable Sub-Ledger */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users size={15} className="text-blue-600" />
                      <span>Brokerage Payable Sub-Ledger</span>
                    </span>
                    <span className="text-[11px] text-slate-500">Accrued, Approved, Payable & Paid per Broker</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200">
                        <tr>
                          <SortableTh sort={brokerLedgerSort} sortKey="name" className={thClass}>Broker Name</SortableTh>
                          <SortableTh sort={brokerLedgerSort} sortKey="accrued" className={`${thClass} text-right`} align="right">Accrued</SortableTh>
                          <SortableTh sort={brokerLedgerSort} sortKey="approved" className={`${thClass} text-right`} align="right">Approved</SortableTh>
                          <SortableTh sort={brokerLedgerSort} sortKey="payable" className={`${thClass} text-right`} align="right">Payable (Hold)</SortableTh>
                          <SortableTh sort={brokerLedgerSort} sortKey="paid" className={`${thClass} text-right`} align="right">Paid to Date</SortableTh>
                          <SortableTh sort={brokerLedgerSort} sortKey="balance" className={`${thClass} text-right`} align="right">Net Outstanding</SortableTh>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {brokerLedgerSort.rows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{row.name}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatINR(row.accrued)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-amber-600">{formatINR(row.approved)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-blue-600 font-semibold">{formatINR(row.payable)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-600">{formatINR(row.paid)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatINR(row.balance)}</td>
                          </tr>
                        ))}
                        {(!brokerSubLedger?.rows || brokerSubLedger.rows.length === 0) && (
                          <EmptyRow colSpan={6} message="No brokerage ledger entries found." />
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Salesperson Incentive Sub-Ledger */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TrendingUp size={15} className="text-emerald-600" />
                      <span>Salesperson Incentive Payable Sub-Ledger</span>
                    </span>
                    <span className="text-[11px] text-slate-500">Calculated, Approved, Posted & Paid per Salesperson</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200">
                        <tr>
                          <SortableTh sort={incentiveLedgerSort} sortKey="name" className={thClass}>Salesperson</SortableTh>
                          <SortableTh sort={incentiveLedgerSort} sortKey="calculated" className={`${thClass} text-right`} align="right">Calculated</SortableTh>
                          <SortableTh sort={incentiveLedgerSort} sortKey="approved" className={`${thClass} text-right`} align="right">Approved</SortableTh>
                          <SortableTh sort={incentiveLedgerSort} sortKey="posted" className={`${thClass} text-right`} align="right">Posted to Ledger</SortableTh>
                          <SortableTh sort={incentiveLedgerSort} sortKey="paid" className={`${thClass} text-right`} align="right">Disbursed / Paid</SortableTh>
                          <SortableTh sort={incentiveLedgerSort} sortKey="balance" className={`${thClass} text-right`} align="right">Net Balance</SortableTh>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {incentiveLedgerSort.rows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{row.name}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatINR(row.accrued || row.calculated)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-amber-600">{formatINR(row.approved)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-blue-600 font-semibold">{formatINR(row.payable || row.posted)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-600">{formatINR(row.paid)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatINR(row.balance)}</td>
                          </tr>
                        ))}
                        {(!incentiveSubLedger?.rows || incentiveSubLedger.rows.length === 0) && (
                          <EmptyRow colSpan={6} message="No salesperson incentive calculations found." />
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
