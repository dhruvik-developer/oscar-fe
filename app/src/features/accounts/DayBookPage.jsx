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
                      <th className={thClass}>Invoice #</th>
                      <th className={thClass}>Customer</th>
                      <th className={`${thClass} text-right`}>Taxable Value</th>
                      <th className={`${thClass} text-right`}>GST Tax</th>
                      <th className={`${thClass} text-right`}>Total Amount</th>
                      <th className={`${thClass} text-center`}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(dayBookData?.salesVouchers || [])
                      .filter((s) => !search || s.voucherNumber?.toLowerCase().includes(search.toLowerCase()) || s.partyName?.toLowerCase().includes(search.toLowerCase()))
                      .map((row) => (
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
                      <th className={thClass}>Receipt #</th>
                      <th className={thClass}>Customer</th>
                      <th className={thClass}>Mode</th>
                      <th className={thClass}>Deposited Bank</th>
                      <th className={`${thClass} text-right`}>Amount Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(dayBookData?.collectionVouchers || [])
                      .filter((c) => !search || c.voucherNumber?.toLowerCase().includes(search.toLowerCase()) || c.partyName?.toLowerCase().includes(search.toLowerCase()))
                      .map((row) => (
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
                      <th className={thClass}>Bill #</th>
                      <th className={thClass}>Vendor</th>
                      <th className={`${thClass} text-right`}>Taxable Value</th>
                      <th className={`${thClass} text-right`}>Total Bill Amount</th>
                      <th className={`${thClass} text-center`}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(dayBookData?.purchaseVouchers || [])
                      .filter((p) => !search || p.voucherNumber?.toLowerCase().includes(search.toLowerCase()) || p.partyName?.toLowerCase().includes(search.toLowerCase()))
                      .map((row) => (
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
                      <th className={thClass}>Payment #</th>
                      <th className={thClass}>Vendor / Beneficiary</th>
                      <th className={thClass}>Mode</th>
                      <th className={thClass}>Bank Account</th>
                      <th className={`${thClass} text-right`}>Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(dayBookData?.disbursementVouchers || [])
                      .filter((d) => !search || d.voucherNumber?.toLowerCase().includes(search.toLowerCase()) || d.partyName?.toLowerCase().includes(search.toLowerCase()))
                      .map((row) => (
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
                      <th className={thClass}>Trip #</th>
                      <th className={thClass}>Vehicle Number</th>
                      <th className={thClass}>Freight Paid By</th>
                      <th className={`${thClass} text-right`}>Total Charges</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(dayBookData?.tripVouchers || [])
                      .filter((t) => !search || t.voucherNumber?.toLowerCase().includes(search.toLowerCase()) || t.vehicleNumber?.toLowerCase().includes(search.toLowerCase()))
                      .map((row) => (
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
                            <th className={thClass}>Salesperson</th>
                            <th className={`${thClass} text-center`}>Invoices</th>
                            <th className={`${thClass} text-center`}>Max Overdue</th>
                            <th className={`${thClass} text-right`}>Overdue Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(overdueData?.bySalesperson || []).map((sp) => (
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
                            <th className={thClass}>Broker</th>
                            <th className={`${thClass} text-center`}>Invoices</th>
                            <th className={`${thClass} text-center`}>Max Overdue</th>
                            <th className={`${thClass} text-right`}>Overdue Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(overdueData?.byBroker || []).map((br) => (
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
                          <th className={thClass}>Broker Name</th>
                          <th className={`${thClass} text-right`}>Accrued</th>
                          <th className={`${thClass} text-right`}>Approved</th>
                          <th className={`${thClass} text-right`}>Payable (Hold)</th>
                          <th className={`${thClass} text-right`}>Paid to Date</th>
                          <th className={`${thClass} text-right`}>Net Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(brokerSubLedger?.rows || []).map((row) => (
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
                          <th className={thClass}>Salesperson</th>
                          <th className={`${thClass} text-right`}>Calculated</th>
                          <th className={`${thClass} text-right`}>Approved</th>
                          <th className={`${thClass} text-right`}>Posted to Ledger</th>
                          <th className={`${thClass} text-right`}>Disbursed / Paid</th>
                          <th className={`${thClass} text-right`}>Net Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(incentiveSubLedger?.rows || []).map((row) => (
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
