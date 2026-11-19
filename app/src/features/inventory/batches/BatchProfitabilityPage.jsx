import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, IndianRupee, Search, Filter, RefreshCw,
  Eye, Boxes, Calendar, ArrowUpDown, ChevronRight, X, ArrowLeft,
  AlertCircle, ShieldCheck, ShoppingCart, Truck, Factory, Layers,
  Receipt, FileText, CheckCircle2, PackageCheck, HelpCircle, Download
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import AppPagination from '../../../components/ui/AppPagination';
import { api } from '../../../services/api';
import { formatINR } from '../../accounts/accountingShared';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const inr = (v) => {
  if (v === null || v === undefined) return '—';
  return `₹ ${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const meters = (v) => `${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} m`;

export default function BatchProfitabilityPage({ inDrawer = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ summary: {}, rows: [] });

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [fabricType, setFabricType] = useState(searchParams.get('fabricType') || 'ALL');
  const [status, setStatus] = useState(searchParams.get('status') || 'ALL');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'highest_profit');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, fabricType, status, sortBy, dateFrom, dateTo]);

  // Detail slideout state
  const [selectedBatchCode, setSelectedBatchCode] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  const fetchProfitability = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = {
        search: search.trim() || undefined,
        fabricType: fabricType !== 'ALL' ? fabricType : undefined,
        status: status !== 'ALL' ? status : undefined,
        sortBy: sortBy || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      };
      const res = await api.get('/inventory/batches/profitability/', { query });
      setData(res?.data || res || { summary: {}, rows: [] });
    } catch (err) {
      console.error('Failed to load batch profitability:', err);
      setError(err?.message || 'Unable to load batch profitability data.');
    } finally {
      setLoading(false);
    }
  }, [search, fabricType, status, sortBy, dateFrom, dateTo]);

  useEffect(() => {
    fetchProfitability();
  }, [fetchProfitability]);

  // Load batch detail for modal
  const openDetail = async (code) => {
    setSelectedBatchCode(code);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await api.get(`/inventory/batches/${encodeURIComponent(code)}/profitability/`);
      setDetailData(res?.data || res);
    } catch (err) {
      console.error('Failed to load batch detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedBatchCode(null);
    setDetailData(null);
  };

  const summary = data.summary || {};
  const rows = data.rows || [];

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const handleResetFilters = () => {
    setSearch('');
    setFabricType('ALL');
    setStatus('ALL');
    setSortBy('highest_profit');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
      {/* Top Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {!inDrawer && (
                <Link
                  to="/dashboard"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  title="Back to Dashboard"
                >
                  <ArrowLeft size={16} />
                </Link>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-[#17294e]">
                    Batch-wise Profit & Loss
                  </h1>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                    Audit Certified
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Realized profit/loss calculated from actual sales dispatches and landed costs. Unsold stock is held as Not Yet Realized inventory.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/inventory/batches"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs"
              >
                <Boxes size={14} /> Batch Registry
              </Link>
              <button
                type="button"
                onClick={fetchProfitability}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-600 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            index={0}
            label="Realized Profit"
            value={inr(summary.totalRealizedProfit)}
            icon={TrendingUp}
            sub={`${num(summary.profitableCount)} profitable batch${num(summary.profitableCount) === 1 ? '' : 'es'}`}
          />
          <KpiCard
            index={1}
            label="Realized Loss"
            value={inr(summary.totalRealizedLoss)}
            icon={TrendingDown}
            sub={`${num(summary.lossMakingCount)} loss-making batch${num(summary.lossMakingCount) === 1 ? '' : 'es'}`}
          />
          <KpiCard
            index={2}
            label="Net Realized Result"
            value={inr(summary.netRealizedContribution)}
            icon={IndianRupee}
            sub={`${meters(summary.totalSoldMeters)} total sold`}
          />
          <KpiCard
            index={3}
            label="Unsold Stock (Not Realized)"
            value={inr(summary.totalUnsoldValue)}
            icon={Boxes}
            sub={`${num(summary.unsoldBatchesCount)} batches held in inventory`}
          />
        </div>

        {/* Filter and Search Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex flex-wrap rounded-lg bg-slate-100 p-1 text-xs font-bold">
              {[
                ['ALL', 'All Batches'],
                ['PROFITABLE', `Profitable (${num(summary.profitableCount)})`],
                ['LOSS_MAKING', `Loss-making (${num(summary.lossMakingCount)})`],
                ['UNSOLD', `Unsold / Not Realized (${num(summary.unsoldBatchesCount)})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
                    status === key
                      ? 'bg-white text-[#17294e] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="highest_profit">Highest Profit First</option>
                <option value="highest_loss">Highest Loss First</option>
                <option value="highest_revenue">Highest Sales Revenue</option>
                <option value="highest_stock_value">Highest Remaining Stock Value</option>
                <option value="batch_code">Batch Code (A – Z)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 pt-1">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search batch code or fabric…"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Fabric Stage */}
            <div>
              <select
                value={fabricType}
                onChange={(e) => setFabricType(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Stages (Grey / Dyed / Finished)</option>
                <option value="GREY">Grey Fabric</option>
                <option value="DYED">Dyed Fabric</option>
                <option value="FINISHED">Finished Fabric</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                title="Creation date from"
              />
            </div>

            {/* Date To */}
            <div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                title="Creation date to"
              />
            </div>

            {/* Reset */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Informative Banner when all batches are currently held as unsold inventory */}
        {num(summary.unsoldBatchesCount) > 0 && num(summary.profitableCount) === 0 && num(summary.lossMakingCount) === 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <ShieldCheck size={20} className="shrink-0 text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-blue-900">
                  Strict Realized Profit Accounting Active
                </h3>
                <p className="mt-1 text-xs text-blue-700 leading-relaxed">
                  All <strong>{summary.unsoldBatchesCount} active batches</strong> are currently held in warehouse inventory (Total Valuation: <strong>{inr(summary.totalUnsoldValue)}</strong>).
                  In OSCAR ERP, unsold inventory is strictly designated as <strong>&quot;Not Yet Realized&quot;</strong> and will never appear as false revenue or artificial profit. Realized profit and loss are recognized only as meters are dispatched on commercial sales invoices.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes size={16} className="text-slate-500" />
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                Batch Profitability Ledger ({rows.length} Batches{rows.length > pageSize ? ` · Page ${page} of ${Math.ceil(rows.length / pageSize)}` : ''})
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Amounts in Indian Rupees (INR)
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw size={24} className="animate-spin text-blue-600 mb-3" />
              <p className="text-xs font-semibold">Calculating true batch-wise costs and profit allocation…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Boxes size={36} className="mx-auto mb-2 opacity-40 text-slate-500" />
              <p className="text-sm font-bold text-slate-600">No batches matched the selected filters.</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting the search keywords or stage filter.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Batch Code</th>
                    <th className="py-3 px-3">Fabric & Origin</th>
                    <th className="py-3 px-3">Stage</th>
                    <th className="py-3 px-3 text-right">Landed Cost/m</th>
                    <th className="py-3 px-3 text-right">Remaining Stock</th>
                    <th className="py-3 px-3 text-right">Sold Qty</th>
                    <th className="py-3 px-3 text-right">Allocated Cost</th>
                    <th className="py-3 px-3 text-right">Sales Revenue</th>
                    <th className="py-3 px-3 text-right">Realized P&amp;L</th>
                    <th className="py-3 px-3 text-center">Margin %</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((r) => {
                    const isSold = r.isSold;
                    const isProfitable = r.status === 'PROFITABLE';
                    const isLoss = r.status === 'LOSS_MAKING';
                    const isGrey = String(r.fabricType).toUpperCase() === 'GREY';
                    const isDyed = String(r.fabricType).toUpperCase() === 'DYED';

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Batch Code */}
                        <td className="py-3 px-4 font-bold font-mono">
                          <Link
                            to={`/inventory/batches/${encodeURIComponent(r.batchCode)}`}
                            className="text-[#2563eb] hover:underline"
                            title="Open Batch Passport"
                          >
                            {r.batchCode}
                          </Link>
                          {r.purchaseOrder && (
                            <span className="block text-[10px] text-slate-400 font-sans font-normal">
                              PO: {r.purchaseOrder}
                            </span>
                          )}
                        </td>

                        {/* Fabric & Origin */}
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800 truncate max-w-[170px]" title={r.fabricName}>
                            {r.fabricName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {r.supplier || r.origin}
                          </p>
                        </td>

                        {/* Stage */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isGrey
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isDyed
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {r.stage}
                          </span>
                        </td>

                        {/* Landed Cost / m */}
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                          ₹ {num(r.costPerMeter).toFixed(2)}
                        </td>

                        {/* Remaining Stock */}
                        <td className="py-3 px-3 text-right font-mono">
                          <span className="font-bold text-slate-800">{meters(r.remainingQty)}</span>
                          <span className="block text-[10px] text-slate-400 font-sans">
                            {inr(r.remainingValue)}
                          </span>
                        </td>

                        {/* Sold Qty */}
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {isSold ? meters(r.soldQty) : <span className="text-slate-400 font-sans">0 m</span>}
                        </td>

                        {/* Total Allocated Cost */}
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                          {inr(r.totalAllocatedCost)}
                        </td>

                        {/* Sales Revenue */}
                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                          {isSold ? inr(r.salesRevenue) : <span className="text-slate-400 font-sans">—</span>}
                        </td>

                        {/* Realized Profit / Loss */}
                        <td className="py-3 px-3 text-right font-mono">
                          {isProfitable ? (
                            <span className="font-extrabold text-emerald-600">
                              +{inr(r.netResult)}
                            </span>
                          ) : isLoss ? (
                            <span className="font-extrabold text-rose-600">
                              {inr(r.netResult)}
                            </span>
                          ) : isSold ? (
                            <span className="font-bold text-slate-600">₹ 0.00</span>
                          ) : (
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-500 font-sans whitespace-nowrap">
                              Not Yet Realized
                            </span>
                          )}
                        </td>

                        {/* Margin % */}
                        <td className="py-3 px-3 text-center font-bold">
                          {isSold && r.marginPct !== null ? (
                            <span className={num(r.marginPct) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {num(r.marginPct).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isProfitable
                                ? 'bg-emerald-100 text-emerald-800'
                                : isLoss
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {r.statusLabel}
                          </span>
                        </td>

                        {/* Audit Details Button */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => openDetail(r.batchCode)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Inspect batch cost allocation & sales audit"
                          >
                            <Eye size={12} /> Audit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

              {/* Pagination Controls */}
              {rows.length > 0 && (
                <AppPagination
                  totalItems={rows.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50, 100]}
                  bordered={true}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Batch Audit Breakdown Slideout / Modal */}
      {selectedBatchCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="border-b border-slate-200 bg-[#17294e] text-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-wide font-mono">
                      {selectedBatchCode}
                    </h3>
                    {detailData && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                        detailData.status === 'PROFITABLE'
                          ? 'bg-emerald-500 text-white'
                          : detailData.status === 'LOSS_MAKING'
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-600 text-white'
                      }`}>
                        {detailData.statusLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Batch Profitability &amp; Cost Traceability Audit
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/inventory/batches/${encodeURIComponent(selectedBatchCode)}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    Open Passport <ChevronRight size={14} />
                  </Link>
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {detailLoading || !detailData ? (
                <div className="py-20 text-center text-slate-400">
                  <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="text-xs font-semibold">Loading batch audit records…</p>
                </div>
              ) : (
                <>
                  {/* Batch Summary Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Fabric Item</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{detailData.fabricName}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Stage / Type</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{detailData.fabricType}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Purchase Order</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{detailData.purchaseOrder || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Goods Receipt (GRN)</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{detailData.goodsReceipt || '—'}</p>
                    </div>
                  </div>

                  {/* Financial Outcome Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                      <p className="text-[11px] font-semibold text-slate-500">Allocated Landed Cost</p>
                      <p className="text-lg font-black text-slate-800 font-mono mt-1">
                        {inr(detailData.totalAllocatedCost)}
                      </p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5 font-mono">
                        ₹ {num(detailData.costPerMeter).toFixed(2)} / meter
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                      <p className="text-[11px] font-semibold text-slate-500">Realized Sales Revenue</p>
                      <p className="text-lg font-black text-slate-800 font-mono mt-1">
                        {detailData.isSold ? inr(detailData.salesRevenue) : '—'}
                      </p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5 font-mono">
                        {meters(detailData.soldQty)} sold
                      </p>
                    </div>

                    <div className={`rounded-xl border p-3.5 shadow-xs ${
                      detailData.status === 'PROFITABLE'
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : detailData.status === 'LOSS_MAKING'
                          ? 'border-rose-200 bg-rose-50/50'
                          : 'border-slate-200 bg-slate-50'
                    }`}>
                      <p className="text-[11px] font-semibold text-slate-600">Net Realized Profit / Loss</p>
                      <p className={`text-lg font-black font-mono mt-1 ${
                        detailData.status === 'PROFITABLE'
                          ? 'text-emerald-700'
                          : detailData.status === 'LOSS_MAKING'
                            ? 'text-rose-700'
                            : 'text-slate-700'
                      }`}>
                        {detailData.isSold ? inr(detailData.netResult) : 'Not Yet Realized'}
                      </p>
                      <p className="text-[10.5px] text-slate-500 mt-0.5 font-semibold">
                        {detailData.marginPct !== null ? `Margin: ${num(detailData.marginPct).toFixed(1)}%` : 'Inventory held in stock'}
                      </p>
                    </div>
                  </div>

                  {/* Landed Cost Entries Table */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                        1. Direct Batch Landed Cost Entries ({detailData.costEntries?.length || 0})
                      </h4>
                      <span className="text-[11px] font-bold text-slate-500 font-mono">
                        Total: {inr(detailData.totalAllocatedCost)}
                      </span>
                    </div>

                    {detailData.costEntries?.length === 0 ? (
                      <p className="p-4 text-xs text-slate-400 text-center">No explicit cost entries found for this batch.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-[10.5px] font-bold uppercase text-slate-400">
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Cost Type</th>
                              <th className="py-2 px-3">Source Doc</th>
                              <th className="py-2 px-3 text-right">Quantity</th>
                              <th className="py-2 px-3 text-right">Rate</th>
                              <th className="py-2 px-3 text-right">Amount (₹)</th>
                              <th className="py-2 px-3 text-center">Approved</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {detailData.costEntries?.map((e) => (
                              <tr key={e.id}>
                                <td className="py-2 px-3 text-slate-600">{e.date}</td>
                                <td className="py-2 px-3 font-semibold text-slate-800">{e.costTypeLabel || e.costType}</td>
                                <td className="py-2 px-3 text-slate-500">{e.sourceDocumentNumber || '—'}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{e.quantity ? meters(e.quantity) : '—'}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{e.rate ? `₹${e.rate}` : '—'}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{inr(e.amount)}</td>
                                <td className="py-2 px-3 text-center">
                                  {e.isApproved ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                      <CheckCircle2 size={12} /> Yes
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-600 font-semibold">Pending</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Linked Sales Documents */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                        2. Linked Sales &amp; Dispatch Traceability ({detailData.salesDocuments?.length || 0})
                      </h4>
                      <span className="text-[11px] font-bold text-slate-500 font-mono">
                        Revenue: {inr(detailData.salesRevenue)}
                      </span>
                    </div>

                    {detailData.salesDocuments?.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-500 font-semibold">No sales dispatches recorded yet for this batch.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Remaining unsold quantity: <strong>{meters(detailData.availableQty)}</strong> (Valuation: <strong>{inr(detailData.remainingInventoryValue)}</strong>).
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-[10.5px] font-bold uppercase text-slate-400">
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Document Type</th>
                              <th className="py-2 px-3">Document #</th>
                              <th className="py-2 px-3 text-right">Dispatched Qty</th>
                              <th className="py-2 px-3 text-right">Selling Rate</th>
                              <th className="py-2 px-3 text-right">Allocated Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {detailData.salesDocuments?.map((sd, i) => (
                              <tr key={i}>
                                <td className="py-2 px-3 text-slate-600">{sd.date}</td>
                                <td className="py-2 px-3 font-semibold text-slate-800">{sd.referenceType}</td>
                                <td className="py-2 px-3 font-mono text-blue-600">{sd.referenceNumber}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{meters(sd.quantity)}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{sd.sellingRate ? `₹${sd.sellingRate}/m` : '—'}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{inr(sd.allocatedRevenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                OSCAR Digital Batch Audit Trail · ISO 9001 Compliant
              </span>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-lg bg-white border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
