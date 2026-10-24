import React, { useEffect, useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Send,
  ArrowDownLeft,
  AlertCircle,
  Clock,
  Layers,
  Search,
  CheckCircle2,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import KpiCard from '../../components/ui/KpiCard';
import { jobworkService } from '../../services/domainServices';

const num = (val) =>
  val != null
    ? parseFloat(val).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : '0';

const inr = (val) =>
  val != null
    ? `₹${parseFloat(val).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`
    : '₹0';

export default function ITC04ReportPage() {
  const [activeTab, setActiveTab] = useState('table4'); // 'table4' | 'table5a'
  const [financialYear, setFinancialYear] = useState('2026-27');
  const [quarter, setQuarter] = useState('Q3');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [table4Page, setTable4Page] = useState(1);
  const [table4PageSize, setTable4PageSize] = useState(10);
  const [table5aPage, setTable5aPage] = useState(1);
  const [table5aPageSize, setTable5aPageSize] = useState(10);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await jobworkService.getITC04Report({ financialYear, quarter });
      setReportData(res);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load ITC-04 statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [financialYear, quarter]);

  const handleExport = async (table = 'both') => {
    setError('');
    setExporting(true);
    try {
      await jobworkService.downloadITC04Export(financialYear, quarter, table);
    } catch (err) {
      setError(err?.message || 'Failed to export ITC-04 statement');
    } finally {
      setExporting(false);
    }
  };

  const summary = reportData?.summary || {};
  const table4Rows = (reportData?.table4 || []).filter((r) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return (
      (r.challanNumber || '').toLowerCase().includes(q) ||
      (r.jwoNumber || '').toLowerCase().includes(q) ||
      (r.vendorName || '').toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setTable4Page(1);
    setTable5aPage(1);
  }, [tableSearch, financialYear, quarter]);

  const paginatedTable4 = (table4Rows || []).slice(
    (table4Page - 1) * table4PageSize,
    table4Page * table4PageSize
  );

  const table5aRows = (reportData?.table5a || []).filter((r) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return (
      (r.inwardChallanNumber || '').toLowerCase().includes(q) ||
      (r.originalChallanNumber || '').toLowerCase().includes(q) ||
      (r.jwoNumber || '').toLowerCase().includes(q) ||
      (r.vendorName || '').toLowerCase().includes(q)
    );
  });
  const paginatedTable5a = table5aRows.slice(
    (table5aPage - 1) * table5aPageSize,
    table5aPage * table5aPageSize
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Form GST ITC-04 Statutory Reporting"
        subtitle="Quarterly declaration for textile inputs sent to and received back from job workers."
      >
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 outline-none bg-white font-medium text-slate-800"
          >
            <option value="2026-27">FY 2026-27</option>
            <option value="2025-26">FY 2025-26</option>
            <option value="2024-25">FY 2024-25</option>
          </select>
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 outline-none bg-white font-semibold text-indigo-700"
          >
            <option value="Q1">Q1 (Apr - Jun)</option>
            <option value="Q2">Q2 (Jul - Sep)</option>
            <option value="Q3">Q3 (Oct - Dec)</option>
            <option value="Q4">Q4 (Jan - Mar)</option>
          </select>
          <button
            onClick={() => handleExport(activeTab)}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Sent"
          value={`${num(summary.totalSentMeters)} Mtr`}
          sub={`Sent (${summary.totalSentTakas || 0} Takas)`}
          icon={Send}
          tone="indigo"
        />
        <KpiCard
          label="Total Received"
          value={`${num(summary.totalReceivedMeters)} Mtr`}
          sub={`Received (${summary.totalReceivedTakas || 0} Takas)`}
          icon={ArrowDownLeft}
          tone="emerald"
        />
        <KpiCard
          label="Approved Job Losses"
          value={`${num(summary.totalLossMeters)} Mtr`}
          icon={AlertCircle}
          tone="rose"
        />
        <KpiCard
          label="Closing WIP with Vendors"
          value={`${num(summary.pendingWithProcessorsMeters)} Mtr`}
          icon={Clock}
          tone="amber"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('table4')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'table4'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="w-4 h-4" />
          Table 4: Goods Sent for Job Work ({reportData?.table4?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('table5a')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'table5a'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Table 5A: Goods Received Back ({reportData?.table5a?.length || 0})
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search challan, JWO no, vendor..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-full focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="text-xs text-slate-500">
          Showing{' '}
          <span className="font-semibold">
            {activeTab === 'table4' ? table4Rows.length : table5aRows.length}
          </span>{' '}
          entry(ies)
        </div>
      </div>

      {/* TABLE 4 */}
      {activeTab === 'table4' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-3">Outward Challan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">JWO No</th>
                  <th className="py-3 px-3">Job Worker / GSTIN</th>
                  <th className="py-3 px-3">State</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3 text-right">Quantity (Mtr)</th>
                  <th className="py-3 px-3 text-right">Takas</th>
                  <th className="py-3 px-3 text-right">Weight (Kg)</th>
                  <th className="py-3 px-3 text-right font-bold text-slate-900">Taxable Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Loading Table 4 records...
                    </td>
                  </tr>
                ) : table4Rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No outward challans found for this quarter.
                    </td>
                  </tr>
                ) : (
                  paginatedTable4.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                        {r.challanNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{r.challanDate}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{r.jwoNumber}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{r.vendorName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{r.vendorGstin || 'URP'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{r.state || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{r.process || r.goodsType}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{num(r.quantity)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{r.takaCount}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{num(r.weightKg)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {inr(r.taxableValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={table4Page}
            pageSize={table4PageSize}
            totalItems={table4Rows.length}
            onPageChange={setTable4Page}
            onPageSizeChange={(sz) => { setTable4PageSize(sz); setTable4Page(1); }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </div>
      )}

      {/* TABLE 5A */}
      {activeTab === 'table5a' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-3">Inward Receipt</th>
                  <th className="py-3 px-3">Inward Date</th>
                  <th className="py-3 px-3">Orig Challan</th>
                  <th className="py-3 px-3">JWO No</th>
                  <th className="py-3 px-3">Job Worker</th>
                  <th className="py-3 px-3 text-right">Received (Mtr)</th>
                  <th className="py-3 px-3 text-right">Accepted</th>
                  <th className="py-3 px-3 text-right text-rose-600">Rejected</th>
                  <th className="py-3 px-3 text-right">Takas</th>
                  <th className="py-3 px-3 text-right">Loss (Mtr)</th>
                  <th className="py-3 px-3 text-right font-bold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      Loading Table 5A records...
                    </td>
                  </tr>
                ) : table5aRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No inward receipts found for this quarter.
                    </td>
                  </tr>
                ) : (
                  paginatedTable5a.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                        {r.inwardChallanNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{r.inwardDate}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {r.originalChallanNumber || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{r.jwoNumber}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{r.vendorName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{r.vendorGstin || 'URP'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {num(r.quantityReceived)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700">
                        {num(r.quantityAccepted)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600">{num(r.quantityRejected)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{r.takaCount}</td>
                      <td className="py-2.5 px-3 text-right text-rose-600">{num(r.approvedLoss)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700 font-medium">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={table5aPage}
            pageSize={table5aPageSize}
            totalItems={table5aRows.length}
            onPageChange={setTable5aPage}
            onPageSizeChange={(sz) => { setTable5aPageSize(sz); setTable5aPage(1); }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </div>
      )}
    </div>
  );
}
