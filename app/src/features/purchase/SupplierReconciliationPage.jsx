import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GitCompare,
  Filter,
  Search,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  PackageCheck,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Boxes,
  Eye,
  Calendar,
} from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { numIN } from '../../utils/formatters';

const STATUS_BADGES = {
  'Fully Reconciled': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Short Intake': 'bg-amber-50 text-amber-700 border-amber-200',
  'Excess Intake': 'bg-rose-50 text-rose-700 border-rose-200',
  'Pending Invoice': 'bg-blue-50 text-blue-700 border-blue-200',
  'Over Invoiced': 'bg-purple-50 text-purple-700 border-purple-200',
  'Has Returns': 'bg-orange-50 text-orange-700 border-orange-200',
  'In Progress': 'bg-slate-50 text-slate-700 border-slate-200',
};

export default function SupplierReconciliationPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ rows: [], summary: {} });
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  // Load vendors list
  useEffect(() => {
    api.get('/purchase/vendors/').then((res) => {
      const rows = Array.isArray(res) ? res : (res?.results || []);
      setVendors(rows);
    }).catch(() => {});
  }, []);

  const fetchReconciliation = useCallback(async () => {
    setLoading(true);
    try {
      const query = {};
      if (selectedVendor) query.vendorId = selectedVendor;
      if (dateFrom) query.dateFrom = dateFrom;
      if (dateTo) query.dateTo = dateTo;

      const res = await api.get('/purchase/receipts/reconciliation/', { query });
      setData(res || { rows: [], summary: {} });
    } catch (err) {
      console.error('Failed to load supplier reconciliation:', err);
      setData({ rows: [], summary: {} });
    } finally {
      setLoading(false);
    }
  }, [selectedVendor, dateFrom, dateTo]);

  useEffect(() => {
    fetchReconciliation();
  }, [fetchReconciliation]);

  const filteredRows = useMemo(() => {
    let rows = data.rows || [];
    if (statusFilter !== 'All') {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        (r.poNumber || '').toLowerCase().includes(q) ||
        (r.vendorName || '').toLowerCase().includes(q) ||
        (r.itemName || '').toLowerCase().includes(q) ||
        (r.sku || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data.rows, statusFilter, search]);

  const summary = data.summary || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Reconciliation"
        subtitle="3-way & 4-way matching: PO ordered qty vs GRN received vs Billed vs Returned"
        breadcrumb={[
          { label: 'Purchase', path: '/purchase/orders' },
          { label: 'Supplier Reconciliation' },
        ]}
        actions={
          <button
            onClick={fetchReconciliation}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Ordered"
          value={`${numIN(summary.totalOrderedQty || 0)} m`}
          icon={Boxes}
          tone="slate"
        />
        <StatCard
          label="Total Received"
          value={`${numIN(summary.totalReceivedQty || 0)} m`}
          icon={PackageCheck}
          tone="emerald"
        />
        <StatCard
          label="Total Billed"
          value={`${numIN(summary.totalBilledQty || 0)} m`}
          icon={Receipt}
          tone="blue"
        />
        <StatCard
          label="Total Returned"
          value={`${numIN(summary.totalReturnedQty || 0)} m`}
          icon={RotateCcw}
          tone="amber"
        />
        <StatCard
          label="Discrepancies"
          value={String(summary.discrepancies || 0)}
          icon={AlertTriangle}
          tone={(summary.discrepancies || 0) > 0 ? 'rose' : 'slate'}
        />
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#dce5f4] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Supplier Picker */}
          <div className="w-56">
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Suppliers</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name} ({v.code || 'Vendor'})</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium focus:border-blue-500 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Fully Reconciled">Fully Reconciled</option>
              <option value="Short Intake">Short Intake</option>
              <option value="Excess Intake">Excess Intake</option>
              <option value="Pending Invoice">Pending Invoice</option>
              <option value="Over Invoiced">Over Invoiced</option>
              <option value="Has Returns">Has Returns</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-1.5 text-slate-500">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg text-slate-700 bg-white"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg text-slate-700 bg-white"
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search PO, Supplier, Fabric..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:outline-none text-xs"
          />
        </div>
      </div>

      {/* Main Reconciliation Table */}
      <div className="bg-white rounded-xl border border-[#dce5f4] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-blue-500" />
            Loading reconciliation records...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No purchase order records found for this reconciliation criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-3.5 py-3">PO Number</th>
                  <th className="px-3.5 py-3">Date</th>
                  <th className="px-3.5 py-3">Supplier</th>
                  <th className="px-3.5 py-3">Fabric Item</th>
                  <th className="px-3.5 py-3 text-right">PO Ordered</th>
                  <th className="px-3.5 py-3 text-right">Received (GRN)</th>
                  <th className="px-3.5 py-3 text-right">Billed</th>
                  <th className="px-3.5 py-3 text-right">Returned</th>
                  <th className="px-3.5 py-3 text-right">Intake Gap</th>
                  <th className="px-3.5 py-3 text-right">Bill Gap</th>
                  <th className="px-3.5 py-3 text-center">Status</th>
                  <th className="px-3.5 py-3 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const badgeClass = STATUS_BADGES[row.status] || STATUS_BADGES['In Progress'];
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-2.5 font-mono font-semibold text-blue-600">
                        {row.poNumber || '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                        {row.poDate || '—'}
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-slate-800">
                        {row.vendorName || '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700">
                        <div className="font-medium text-slate-900">{row.itemName}</div>
                        {row.sku && <span className="font-mono text-[10px] text-slate-400">{row.sku}</span>}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-800">
                        {numIN(row.orderedQty)} {row.uom}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-emerald-700">
                        {numIN(row.receivedQty)} {row.uom}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-blue-700">
                        {numIN(row.billedQty)} {row.uom}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-amber-700">
                        {row.returnedQty > 0 ? `${numIN(row.returnedQty)} ${row.uom}` : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono">
                        {row.pendingReceiptQty > 0 ? (
                          <span className="text-amber-600 font-medium">-{numIN(row.pendingReceiptQty)} {row.uom}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono">
                        {row.pendingBillQty > 0 ? (
                          <span className="text-blue-600 font-medium">{numIN(row.pendingBillQty)} {row.uom}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClass}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <button
                          onClick={() => setSelectedRow(row)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Line Reconciliation Breakdown</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedRow.poNumber} • {selectedRow.vendorName}</p>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Fabric Item:</span>
                  <span className="font-semibold text-slate-800">{selectedRow.itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SKU:</span>
                  <span className="font-mono text-slate-700">{selectedRow.sku || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PO Date:</span>
                  <span className="text-slate-700">{selectedRow.poDate}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-slate-200">
                  <p className="text-slate-500 text-[11px]">PO Ordered Quantity</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">{numIN(selectedRow.orderedQty)} {selectedRow.uom}</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200">
                  <p className="text-slate-500 text-[11px]">GRN Received Quantity</p>
                  <p className="text-base font-bold text-emerald-700 mt-0.5">{numIN(selectedRow.receivedQty)} {selectedRow.uom}</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200">
                  <p className="text-slate-500 text-[11px]">Billed Quantity</p>
                  <p className="text-base font-bold text-blue-700 mt-0.5">{numIN(selectedRow.billedQty)} {selectedRow.uom}</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200">
                  <p className="text-slate-500 text-[11px]">Returned Quantity</p>
                  <p className="text-base font-bold text-amber-700 mt-0.5">{numIN(selectedRow.returnedQty)} {selectedRow.uom}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-blue-900">Reconciliation Status</span>
                  <p className="text-xs text-blue-700 mt-0.5">{selectedRow.status}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_BADGES[selectedRow.status]}`}>
                  {selectedRow.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
